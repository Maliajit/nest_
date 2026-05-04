import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { Prisma } from '@prisma/client';
import { MarketingService } from '../marketing/marketing.service';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private marketingService: MarketingService,
  ) {}

  // Get or Create active cart for customer
  private async getOrCreateCart(customerId: string | number | bigint) {
    if (!customerId || customerId === 'undefined' || customerId === 'null' || customerId === '') {
      return { id: BigInt(0), items: [] as any[], subtotal: new Prisma.Decimal(0), discountTotal: new Prisma.Decimal(0), grandTotal: new Prisma.Decimal(0) };
    }

    const customerIdStr = customerId.toString();
    const isNumeric = !isNaN(Number(customerIdStr)) && !customerIdStr.includes('usr_');
    
    let cart = await this.prisma.cart.findFirst({
      where: isNumeric 
        ? { customerId: BigInt(customerIdStr), status: 'active' }
        : { sessionId: customerIdStr, status: 'active' },
      include: { items: { include: { productVariant: { include: { product: true, variantAttributes: { include: { attributeValue: { include: { attribute: true } } } }, variantImages: { include: { media: true } } } } } } },
    });

    if (!cart) {
      try {
        if (isNumeric) {
          cart = await this.prisma.cart.create({
            data: {
              customer: { connect: { id: BigInt(customerIdStr) } },
              status: 'active',
            },
            include: { items: { include: { productVariant: { include: { product: true, variantAttributes: { include: { attributeValue: { include: { attribute: true } } } }, variantImages: { include: { media: true } } } } } } },
          });
        } else {
          cart = await this.prisma.cart.create({
            data: {
              sessionId: customerIdStr,
              status: 'active',
            },
            include: { items: { include: { productVariant: { include: { product: true, variantAttributes: { include: { attributeValue: { include: { attribute: true } } } }, variantImages: { include: { media: true } } } } } } },
          });
        }
      } catch (err) {
        // Fallback for non-existent numeric users: treat as session
        cart = await this.prisma.cart.create({
          data: {
            sessionId: customerIdStr,
            status: 'active',
          },
          include: { items: { include: { productVariant: { include: { product: true, variantAttributes: { include: { attributeValue: { include: { attribute: true } } } }, variantImages: { include: { media: true } } } } } } },
        });
      }
    }
    return cart;
  }

  // Get current cart
  async getCart(customerId: string) {
    return this.getOrCreateCart(customerId);
  }

  // Apply a coupon code
  async applyCoupon(customerId: string, code: string) {
    const cart = await this.getOrCreateCart(customerId);
    
    // 1. Validate the coupon
    const offer = await this.marketingService.validateCoupon(customerId, code, Number(cart.subtotal));

    // 2. Associate the offer with the cart
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { offerId: offer.id },
    });

    // 3. Recalculate totals
    await this.updateCartTotals(cart.id);
    
    return { success: true, message: 'Coupon applied successfully' };
  }

  // Add item to cart
  async addItem(customerId: string, dto: AddToCartDto) {
    try {
      if (!dto.variantId && !dto.productId) throw new BadRequestException('variantId or productId is required');
      const cart = await this.getOrCreateCart(customerId);
      
      let variantId: bigint;

      if (dto.variantId) {
        variantId = BigInt(dto.variantId);
      } else {
        // Find or create default variant for simple product
        const pId = BigInt(dto.productId!);
        const product = await this.prisma.product.findUnique({
          where: { id: pId },
          include: { variants: true }
        });
        if (!product) throw new NotFoundException('Product not found');
        
        if (product.variants.length > 0) {
          variantId = product.variants[0].id;
        } else {
          // Create a default variant if missing
          const newVariant = await this.prisma.productVariant.create({
            data: {
              productId: pId,
              sku: `DEF-${product.slug}-${Date.now()}`,
              price: product.price || new Prisma.Decimal(0),
              qty: 99,
            }
          });
          variantId = newVariant.id;
        }
      }

      // Validate variant exists
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      if (!variant) {
        throw new NotFoundException('Product variant not found');
      }

      // Check if item already in cart
      const existingItem = (cart.items as any[]).find((item) => item.productVariantId === variantId);

      if (existingItem) {
        return this.updateItem(customerId, existingItem.id.toString(), {
          userId: customerId,
          quantity: existingItem.quantity + dto.quantity,
        });
      }

      // Create new item
      const newItem = await this.prisma.cartItem.create({
        data: {
          cart: { connect: { id: cart.id } },
          productVariant: { connect: { id: variantId } },
          quantity: dto.quantity,
          unitPrice: variant.price || new Prisma.Decimal(0),
          total: new Prisma.Decimal((variant.price?.toNumber() || 0) * dto.quantity),
        },
      });

      await this.updateCartTotals(cart.id);
      return newItem;
    } catch (err) {
      console.error('CRITICAL ERROR in addItem:', err);
      throw err;
    }
  }

  // Update item quantity
  async updateItem(customerId: string, itemId: string, dto: UpdateCartItemDto) {
    const iId = BigInt(itemId);
    
    const item = await this.prisma.cartItem.findUnique({
      where: { id: iId },
      include: { cart: true },
    });

    const customerIdStr = customerId.toString();
    const isNumeric = !isNaN(Number(customerIdStr)) && !customerIdStr.includes('usr_') && customerIdStr !== '';
    
    const ownerMatch = isNumeric 
      ? (item && item.cart.customerId === BigInt(customerIdStr))
      : (item && item.cart.sessionId === customerIdStr);

    if (!item || !ownerMatch) {
      throw new NotFoundException('Cart item not found');
    }

    const updatedItem = await this.prisma.cartItem.update({
      where: { id: iId },
      data: {
        quantity: dto.quantity,
        total: new Prisma.Decimal((item.unitPrice?.toNumber() || 0) * dto.quantity),
      },
    });

    await this.updateCartTotals(item.cartId);
    return updatedItem;
  }

  // Remove item
  async removeItem(customerId: string, itemId: string) {
    const iId = BigInt(itemId);
    const item = await this.prisma.cartItem.findUnique({
      where: { id: iId },
      include: { cart: true },
    });

    const customerIdStr = customerId.toString();
    const isNumeric = !isNaN(Number(customerIdStr)) && !customerIdStr.includes('usr_') && customerIdStr !== '';
    
    const ownerMatch = isNumeric 
      ? (item && item.cart.customerId === BigInt(customerIdStr))
      : (item && item.cart.sessionId === customerIdStr);

    if (!item || !ownerMatch) {
      throw new NotFoundException('Cart item not found');
    }

    const cartId = item.cartId;
    await this.prisma.cartItem.delete({ where: { id: iId } });
    await this.updateCartTotals(cartId);
    return { success: true };
  }

  // Clear cart
  async clearCart(customerId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { customerId: BigInt(customerId), status: 'active' },
    });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { offerId: null },
      });
      await this.updateCartTotals(cart.id);
    }
    return { success: true };
  }

  // Recalculate totals
  private async updateCartTotals(cartId: bigint) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: true, offer: true },
    });

    if (!cart) return;

    const subtotal = cart.items.reduce((sum, item) => sum + (item.total?.toNumber() || 0), 0);
    let discount = 0;

    if (cart.offerId && cart.offer) {
       discount = this.marketingService.calculateDiscount(cart.offer, subtotal);
    }

    await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        subtotal: new Prisma.Decimal(subtotal),
        discountTotal: new Prisma.Decimal(discount),
        grandTotal: new Prisma.Decimal(subtotal - discount),
      },
    });
  }
}
