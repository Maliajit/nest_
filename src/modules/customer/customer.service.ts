import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped'];

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  private toBigIntId(customerId: string) {
    try {
      return BigInt(customerId);
    } catch (e) {
      throw new BadRequestException(`Invalid customer ID: ${customerId}`);
    }
  }

  private getApiBaseUrl() {
    return process.env.APP_URL || `http://127.0.0.1:${process.env.PORT ?? 3001}`;
  }

  private toIsoString(value: Date | string | null | undefined) {
    if (!value) return null;
    return new Date(value).toISOString();
  }

  private normalizeOrderStatus(status?: string | null) {
    const value = (status || '').toUpperCase();
    if (['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED'].includes(value)) {
      return value;
    }
    return 'PENDING';
  }

  private normalizePaymentStatus(status?: string | null) {
    const value = (status || '').toUpperCase();
    if (['PAID', 'PENDING', 'FAILED'].includes(value)) {
      return value;
    }
    return 'PENDING';
  }

  private toMediaUrl(path?: string | null) {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    const normalized = path.replace(/\\/g, '/');
    const prefix = normalized.startsWith('/') ? '' : '/';
    return `${this.getApiBaseUrl()}${prefix}${normalized}`;
  }

  private buildOrderPreview(order: any) {
    const firstItem = order.items?.[0];
    const firstImage = firstItem?.productVariant?.variantImages?.[0]?.media?.filePath || null;

    return {
      title: firstItem?.productName || 'Product',
      image: this.toMediaUrl(firstImage),
    };
  }

  private mapOrderSummary(order: any) {
    return {
      id: order.id.toString(),
      orderNumber: order.orderNumber,
      createdAt: this.toIsoString(order.createdAt),
      grandTotal: Number(order.grandTotal || 0),
      status: this.normalizeOrderStatus(order.status),
      paymentStatus: this.normalizePaymentStatus(order.paymentStatus),
      preview: this.buildOrderPreview(order),
    };
  }

  private buildTracking(order: any) {
    if (!order) return null;

    return {
      orderId: order.id?.toString(),
      orderNumber: order.orderNumber,
      currentStatus: this.normalizeOrderStatus(order.status),
      timeline: [
        { label: 'Order Placed', date: this.toIsoString(order.createdAt), completed: true },
        { label: 'Confirmed', date: this.toIsoString(order.confirmedAt), completed: !!order.confirmedAt },
        { label: 'Processing', date: this.toIsoString(order.processingAt), completed: !!order.processingAt },
        { label: 'Shipped', date: this.toIsoString(order.shippedAt), completed: !!order.shippedAt },
        { label: 'Delivered', date: this.toIsoString(order.deliveredAt), completed: !!order.deliveredAt },
      ],
    };
  }

  private buildDashboardResponse(
    customer: any,
    allOrders: any[],
    totalOrders: number,
    activeOrders: number,
    totalSpent: number,
    wishlistCount: number,
  ) {
    const recentOrders = allOrders.slice(0, 5);
    const trackableOrders = allOrders
      .filter((order) => ACTIVE_ORDER_STATUSES.includes((order.status || '').toLowerCase()))
      .concat(allOrders.filter((order) => !ACTIVE_ORDER_STATUSES.includes((order.status || '').toLowerCase())));
    const defaultTrackingOrder = trackableOrders[0] || allOrders[0] || null;

    return {
      profile: {
        id: customer.id.toString(),
        name: customer.name,
        email: customer.email || '',
        mobile: customer.mobile || null,
        dob: this.toIsoString(customer.dob),
        status: customer.status === 1 && !customer.isBlock ? 'ACTIVE' : 'INACTIVE',
        isBlock: !!customer.isBlock,
        createdAt: this.toIsoString(customer.createdAt),
        lastLoginAt: this.toIsoString(customer.lastLoginAt),
      },
      stats: {
        totalOrders,
        activeOrders,
        totalSpent,
        wishlistCount,
      },
      recentOrders: recentOrders.map((order) => this.mapOrderSummary(order)),
      orderHistory: allOrders.map((order) => this.mapOrderSummary(order)),
      trackingOrders: trackableOrders.map((order) => ({
        ...this.buildTracking(order),
        createdAt: this.toIsoString(order.createdAt),
        preview: this.buildOrderPreview(order),
      })),
      latestOrderTracking: this.buildTracking(defaultTrackingOrder),
    };
  }

  async getDashboard(customerId: string) {
    const cId = this.toBigIntId(customerId);

    const customer = await this.prisma.customer.findUnique({
      where: { id: cId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const [allOrders, activeOrders, wishlistCount, totalSpentResult] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: cId },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              productVariant: {
                include: {
                  variantImages: {
                    include: {
                      media: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.order.count({
        where: {
          customerId: cId,
          status: { in: ACTIVE_ORDER_STATUSES },
        },
      }),
      this.prisma.wishlistItem.count({
        where: {
          wishlist: {
            customerId: cId,
          },
        },
      }),
      this.prisma.order.aggregate({
        where: {
          customerId: cId,
          paymentStatus: 'paid',
        },
        _sum: {
          grandTotal: true,
        },
      }),
    ]);

    return this.buildDashboardResponse(
      customer,
      allOrders,
      allOrders.length,
      activeOrders,
      Number(totalSpentResult._sum.grandTotal || 0),
      wishlistCount,
    );
  }

  async getAddresses(customerId: string) {
    let cId: bigint;
    try {
      cId = BigInt(customerId);
    } catch (e) {
      return [];
    }
    return this.prisma.customerAddress.findMany({
      where: { customerId: cId },
    });
  }

  async addAddress(customerId: string, createAddressDto: CreateAddressDto) {
    const { isDefault, ...rest } = createAddressDto;
    const cId = this.toBigIntId(customerId);

    const customer = await this.prisma.customer.findUnique({
      where: { id: cId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found. Please sign up or log in again.`);
    }

    if (isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId: cId },
        data: { isDefault: false },
      });
    }

    return this.prisma.customerAddress.create({
      data: {
        ...rest,
        state: rest.state || 'Unknown',
        isDefault: isDefault ?? false,
        customerId: cId,
      },
    });
  }

  async updateAddress(customerId: string, addressId: string, updateAddressDto: UpdateAddressDto) {
    let cId: bigint;
    let aId: bigint;
    try {
      cId = BigInt(customerId);
      aId = BigInt(addressId);
    } catch (e) {
      throw new Error('Invalid ID format');
    }

    const address = await this.prisma.customerAddress.findUnique({
      where: { id: aId },
    });

    if (!address || address.customerId !== cId) {
      throw new NotFoundException('Address not found');
    }

    if (updateAddressDto.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId: cId, NOT: { id: aId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.customerAddress.update({
      where: { id: aId },
      data: updateAddressDto,
    });
  }

  async deleteAddress(customerId: string, addressId: string) {
    let cId: bigint;
    let aId: bigint;
    try {
      cId = BigInt(customerId);
      aId = BigInt(addressId);
    } catch (e) {
      throw new Error('Invalid ID format');
    }

    const address = await this.prisma.customerAddress.findUnique({
      where: { id: aId },
    });

    if (!address || address.customerId !== cId) {
      throw new NotFoundException('Address not found or unauthorized');
    }

    return this.prisma.customerAddress.delete({
      where: { id: aId },
    });
  }

  async getAddressById(customerId: string, addressId: string) {
    let cId: bigint;
    let aId: bigint;
    try {
      cId = BigInt(customerId);
      aId = BigInt(addressId);
    } catch (e) {
      throw new Error('Invalid ID format');
    }

    const address = await this.prisma.customerAddress.findUnique({
      where: { id: aId },
    });

    if (!address || address.customerId !== cId) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  async getProfile(customerId: string) {
    const cId = this.toBigIntId(customerId);

    const customer = await this.prisma.customer.findUnique({
      where: { id: cId },
      include: {
        _count: { select: { orders: true } },
        orders: {
          where: { paymentStatus: 'paid' },
          select: { grandTotal: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const totalSpent = customer.orders.reduce((sum, order) => sum + Number(order.grandTotal), 0);

    const { password: _, orders: __, ...result } = customer;
    return { ...result, totalSpent };
  }

  async updateProfile(customerId: string, data: UpdateProfileDto) {
    const cId = this.toBigIntId(customerId);

    if (data.mobile) {
      const existing = await this.prisma.customer.findUnique({
        where: { mobile: data.mobile },
      });
      if (existing && existing.id !== cId) {
        throw new BadRequestException('Mobile number already in use');
      }
    }

    const updated = await this.prisma.customer.update({
      where: { id: cId },
      data: {
        name: data.name,
        mobile: data.mobile || null,
        dob: data.dob ? new Date(data.dob) : null,
      },
    });

    const { password: _, ...result } = updated as any;
    return {
      id: result.id.toString(),
      name: result.name,
      email: result.email || '',
      mobile: result.mobile || null,
      dob: this.toIsoString(result.dob),
      status: result.status === 1 && !result.isBlock ? 'ACTIVE' : 'INACTIVE',
      isBlock: !!result.isBlock,
      createdAt: this.toIsoString(result.createdAt),
      lastLoginAt: this.toIsoString(result.lastLoginAt),
    };
  }

  async getAllUsers() {
    const customers = await this.prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { orders: true },
        },
        orders: {
          where: { paymentStatus: 'paid' },
          select: { grandTotal: true },
        },
      },
    });

    const mapped = customers.map(c => {
      const totalSpent = c.orders.reduce((sum, order) => sum + Number(order.grandTotal), 0);
      const { password: _, orders: __, ...rest } = c as any;
      return {
        ...rest,
        totalSpent,
        isActive: rest.status === 1 && !rest.isBlock,
        isBlocked: rest.isBlock,
      };
    });

    return {
      success: true,
      data: mapped,
    };
  }

  async updateCustomer(id: string | number, data: any) {
    const cId = BigInt(id);
    const updated = await this.prisma.customer.update({
      where: { id: cId },
      data: {
        ...data,
        status: data.isActive !== undefined ? (data.isActive ? 1 : 0) : data.status,
        isBlock: data.isBlocked !== undefined ? data.isBlocked : data.isBlock,
      },
    });

    const { password: _, ...result } = updated as any;
    return { success: true, data: { ...result, isActive: result.status === 1, isBlocked: result.isBlock } };
  }
}
