import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutDto } from './dto/order.dto';
import { Prisma } from '@prisma/client';
import { MarketingService } from '../marketing/marketing.service';
import { LoyaltyService } from '../marketing/loyalty.service';
import { OrderStatusHistoryService } from './order-status-history.service';
import { ShiprocketService } from './shiprocket.service';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  constructor(
    private prisma: PrismaService,
    private marketingService: MarketingService,
    private loyaltyService: LoyaltyService,
    private historyService: OrderStatusHistoryService,
    private shiprocketService: ShiprocketService,
  ) {}

  // Create order from cart (Checkout)
  async checkout(customerId: string, dto: CheckoutDto) {
    const cId = BigInt(customerId);

    // 1. Get active cart
    const cart = await this.prisma.cart.findFirst({
      where: { customerId: cId, status: 'active' },
      include: { 
        items: { 
          include: { 
            productVariant: { include: { product: true } } 
          } 
        },
        customer: true,
        offer: true,
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // 2. Validate Coupon
    let appliedOffer = cart.offer;
    if (dto.couponCode) {
        appliedOffer = await this.marketingService.validateCoupon(customerId, dto.couponCode, Number(cart.subtotal));
    }

    // 3. Handle Loyalty Points Redemption
    let pointDiscount = 0;
    if (dto.redeemPoints && dto.redeemPoints > 0) {
        const balance = await this.loyaltyService.getLoyaltyBalance(customerId);
        if (Number(balance.availablePoints) < dto.redeemPoints) {
            throw new BadRequestException('Insufficient loyalty points');
        }
        pointDiscount = dto.redeemPoints / 100;
    }

    // 4. Validate Addresses
    const shippingAddr = await this.prisma.customerAddress.findUnique({
      where: { id: BigInt(dto.shippingAddressId) },
    });
    if (!shippingAddr || shippingAddr.customerId !== cId) {
      throw new BadRequestException('Invalid shipping address');
    }

    // 5. Create Order via Transaction
    return this.prisma.$transaction(async (tx) => {
      const subtotal = Number(cart.subtotal);
      const discountAmount = appliedOffer ? this.marketingService.calculateDiscount(appliedOffer, subtotal) : 0;
      const totalDiscount = discountAmount + pointDiscount;
      const grandTotal = Math.max(0, subtotal - totalDiscount);
      const pointsEarned = Math.floor(grandTotal);

      // a. Create the Order
      // Calculate Total Weight (Default to 0.5kg per watch if not specified)
      let totalWeight = 0;
      for (const item of cart.items) {
          const itemWeight = item.productVariant.weight ? Number(item.productVariant.weight) : 0.4;
          totalWeight += itemWeight * item.quantity;
      }

      const isCod = dto.paymentMethod === 'cod';
      let shippingTotal = 500; // Default fallback

      try {
          const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '380001';
          const rateData = await this.shiprocketService.checkServiceability(
              pickupPincode,
              shippingAddr.pincode,
              totalWeight
          );

          if (rateData.serviceable === false) {
              this.logger.warn(`Unserviceable pincode: ${shippingAddr.pincode} for customer ${customerId}`);
              throw new BadRequestException('Delivery is not available for this location');
          }

          if (isCod && rateData.codAvailable === false) {
              this.logger.warn(`COD Unavailable for pincode: ${shippingAddr.pincode} for customer ${customerId}`);
              throw new BadRequestException('Cash on Delivery is not available for this location');
          }

          if (rateData.serviceable === null) {
              this.logger.error(`Technical failure in shipping API for pincode: ${shippingAddr.pincode}`);
          }

          shippingTotal = rateData.rate ?? 500;
      } catch (e) {
          if (e instanceof BadRequestException) throw e;
          this.logger.error(`Shiprocket rate calculation failed: ${e.message}`);
          shippingTotal = 500;
      }

      const isOnline = dto.paymentMethod === 'online';
      
      const order = await tx.order.create({
        data: {
          customer: { connect: { id: cId } },
          offer: appliedOffer ? { connect: { id: appliedOffer.id } } : undefined,
          status: 'pending',
          paymentStatus: isOnline ? 'paid' : 'pending',
          shippingStatus: 'pending',
          paymentMethod: dto.paymentMethod || 'cod',
          subtotal: new Prisma.Decimal(subtotal),
          shippingTotal: new Prisma.Decimal(shippingTotal),
          taxTotal: new Prisma.Decimal(0),
          discountTotal: new Prisma.Decimal(totalDiscount),
          grandTotal: new Prisma.Decimal(Math.max(0, subtotal + shippingTotal - totalDiscount)),
          customerNote: dto.notes,
          customerFirstName: cart.customer?.name.split(' ')[0] || 'Customer',
          customerLastName: cart.customer?.name.split(' ').slice(1).join(' ') || 'Name',
          customerMobile: cart.customer?.mobile,
          customerDob: dto.dob ? new Date(dto.dob) : (cart.customer?.dob || null),
          orderNumber: `ORD-${Date.now()}`,
          loyaltyPointsUsed: new Prisma.Decimal(dto.redeemPoints || 0),
          loyaltyPointsEarned: new Prisma.Decimal(pointsEarned),
          createdAt: new Date(),
        },
      });

      // a1. Update Customer Profile with DOB if provided
      if (dto.dob) {
        await tx.customer.update({
          where: { id: cId },
          data: { dob: new Date(dto.dob) },
        });
      }

      // a2. Create Payment record if online
      if (isOnline && dto.paymentId) {
        await tx.payment.create({
          data: {
            orderId: order.id,
            paymentMethod: 'online',
            paymentGateway: 'razorpay',
            transactionId: dto.paymentId,
            amount: order.grandTotal,
            status: 'paid',
            paidAt: new Date(),
          }
        });
      }

      // b. Log History
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'pending',
          notes: 'Order placed by customer',
        }
      });

      // c. Snapshot Addresses
      await tx.orderAddress.create({
        data: {
          order: { connect: { id: order.id } },
          type: 'shipping',
          firstName: shippingAddr.name.split(' ')[0] || 'Customer',
          lastName: shippingAddr.name.split(' ').slice(1).join(' ') || 'Name',
          email: cart.customer?.email || '',
          phone: shippingAddr.mobile,
          address1: shippingAddr.address,
          city: shippingAddr.city,
          state: shippingAddr.state,
          postcode: shippingAddr.pincode,
          country: shippingAddr.country,
        },
      });

      // d. Create Items
      for (const item of cart.items) {
        await tx.orderItem.create({
          data: {
            order: { connect: { id: order.id } },
            product: { connect: { id: item.productVariant.productId } },
            productVariant: { connect: { id: item.productVariantId } },
            productName: item.productVariant.product?.name || 'Product',
            sku: item.productVariant.sku || 'SKU',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.total,
            total: item.total,
            discountAmount: new Prisma.Decimal(0),
            attributes: item.attributes as any,
          },
        });
      }

      // e. Track Marketing Usage
      if (appliedOffer) {
          await tx.offerUsage.create({
              data: {
                  offerId: appliedOffer.id,
                  customerId: cId,
                  orderId: order.id,
                  discountAmount: new Prisma.Decimal(discountAmount),
              }
          });
          await tx.offer.update({
              where: { id: appliedOffer.id },
              data: { usedCount: { increment: 1 } }
          });
      }

      // f. Spend Points
      if (dto.redeemPoints && dto.redeemPoints > 0) {
          const loyalty = await tx.customerLoyalty.findFirst({ where: { customerId: cId } });
          if (loyalty) {
              await tx.loyaltyTransaction.create({
                  data: {
                      customerLoyaltyId: loyalty.id,
                      customerId: cId,
                      type: 'redemption',
                      points: -dto.redeemPoints,
                      balance: Number(loyalty.availablePoints) - dto.redeemPoints,
                      referenceType: 'order',
                      referenceId: order.id,
                      notes: 'Spend on checkout',
                  }
              });
              await tx.customerLoyalty.update({
                  where: { id: loyalty.id },
                  data: {
                      availablePoints: { decrement: dto.redeemPoints },
                      usedPoints: { increment: dto.redeemPoints },
                  }
              });
          }
      }

      // g. Clear Cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: {
          status: 'completed',
          subtotal: 0,
          grandTotal: 0,
          offerId: null,
        },
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: { 
          items: {
            include: {
              product: true,
              productVariant: {
                include: {
                  variantImages: {
                    include: {
                      media: true
                    }
                  },
                  variantAttributes: {
                    include: {
                      attributeValue: {
                        include: {
                          attribute: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
    });
  }

  // Update Status (Admin)
  async updateStatus(orderId: string, status: string, notes?: string, adminId?: string) {
    const oId = BigInt(orderId);
    const order = await this.prisma.order.findUnique({ where: { id: oId } });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: oId },
        data: { status },
      });

      await tx.orderStatusHistory.create({
        data: { orderId: oId, status, notes, adminId: adminId ? BigInt(adminId) : null },
      });

      return { success: true, data: updatedOrder };
    });
  }

  // Cancel Order (Customer)
  async cancelOrder(customerId: string, orderId: string, reason: string) {
    const cId = BigInt(customerId);
    const oId = BigInt(orderId);

    const order = await this.prisma.order.findUnique({ 
        where: { id: oId },
        include: { customer: true }
    });

    if (!order || order.customerId !== cId) throw new NotFoundException('Order not found');
    if (!['pending', 'confirmed'].includes(order.status)) {
        throw new BadRequestException('Order cannot be cancelled in its current state');
    }

    return this.prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
            where: { id: oId },
            data: { 
                status: 'cancelled',
                cancellationReason: reason,
                cancelledAt: new Date(),
            }
        });

        await tx.orderStatusHistory.create({
            data: { orderId: oId, status: 'cancelled', notes: `Cancelled by customer: ${reason}` },
        });

        // Refund Loyalty Points if used
        if (order.loyaltyPointsUsed && order.loyaltyPointsUsed.toNumber() > 0) {
            const points = order.loyaltyPointsUsed.toNumber();
            const loyalty = await tx.customerLoyalty.findFirst({ where: { customerId: cId } });
            if (loyalty) {
                await tx.loyaltyTransaction.create({
                    data: {
                        customerLoyaltyId: loyalty.id,
                        customerId: cId,
                        type: 'refund',
                        points: points,
                        balance: Number(loyalty.availablePoints) + points,
                        referenceType: 'order',
                        referenceId: oId,
                        notes: 'Points refunded due to cancellation',
                    }
                });
                await tx.customerLoyalty.update({
                    where: { id: loyalty.id },
                    data: {
                        availablePoints: { increment: points },
                        usedPoints: { decrement: points },
                    }
                });
            }
        }

        return updatedOrder;
    });
  }


  // Get all orders (Admin)
  async getAllOrders() {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { 
        items: {
          include: {
            product: true
          }
        },
        customer: {
            select: { name: true, email: true }
        }
      },
    });
    return { success: true, data: orders };
  }

  // Get orders for a specific customer
  async getOrders(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId: BigInt(customerId) },
      orderBy: { createdAt: 'desc' },
      include: { 
        items: {
          include: {
            product: true,
            productVariant: {
              include: {
                variantImages: {
                  include: {
                    media: true
                  }
                },
                variantAttributes: {
                  include: {
                    attributeValue: {
                      include: {
                        attribute: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
    });
  }

  async getOrderById(customerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: BigInt(orderId) },
      include: { 
        items: {
          include: {
            product: true,
            productVariant: {
              include: {
                variantImages: {
                  include: {
                    media: true
                  }
                },
                variantAttributes: {
                  include: {
                    attributeValue: {
                      include: {
                        attribute: true
                      }
                    }
                  }
                }
              }
            }
          }
        }, 
        addresses: true, 
        statusHistory: { orderBy: { createdAt: 'desc' } } 
      },
    });
    if (!order || order.customerId !== BigInt(customerId)) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async calculateShipping(customerId: string, pincode: string) {
    const cId = BigInt(customerId);
    const cart = await this.prisma.cart.findFirst({
        where: { customerId: cId, status: 'active' },
        include: { items: { include: { productVariant: true } } }
    });
    if (!cart || cart.items.length === 0) return { serviceable: false, rate: null, message: "Cart is empty" };

    let totalWeight = 0;
    for (const item of cart.items) {
        const itemWeight = item.productVariant.weight ? Number(item.productVariant.weight) : 0.4;
        totalWeight += itemWeight * item.quantity;
    }

    const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '380001';
    const rateData = await this.shiprocketService.checkServiceability(
        pickupPincode,
        pincode,
        totalWeight
    );

    return rateData;
  }
}
