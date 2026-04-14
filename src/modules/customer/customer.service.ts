import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  // Get all addresses for a customer
  async getAddresses(customerId: string) {
    return this.prisma.customerAddress.findMany({
      where: { customerId: BigInt(customerId) },
    });
  }

  // Add a new address
  async addAddress(customerId: string, createAddressDto: CreateAddressDto) {
    const { isDefault, ...rest } = createAddressDto;
    const cId = BigInt(customerId);

    // If this is the first address or isDefault is true, set others to false
    if (isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId: cId },
        data: { isDefault: false },
      });
    }

    return this.prisma.customerAddress.create({
      data: {
        ...rest,
        isDefault: isDefault ?? false,
        customer: { connect: { id: cId } },
      },
    });
  }

  // Update an address
  async updateAddress(customerId: string, addressId: string, updateAddressDto: UpdateAddressDto) {
    const cId = BigInt(customerId);
    const aId = BigInt(addressId);

    // Ensure address belongs to customer
    const address = await this.prisma.customerAddress.findUnique({
      where: { id: aId },
    });

    if (!address || address.customerId !== cId) {
      throw new NotFoundException('Address not found');
    }

    if (updateAddressDto.isDefault) {
      // Set all other addresses for this customer to NOT default
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

  // Delete an address
  async deleteAddress(customerId: string, addressId: string) {
    const cId = BigInt(customerId);
    const aId = BigInt(addressId);

    // Ensure address belongs to customer
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

  // Get single address
  async getAddressById(customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findUnique({
      where: { id: BigInt(addressId) },
    });

    if (!address || address.customerId !== BigInt(customerId)) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  // Get customer profile
  async getProfile(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: BigInt(customerId) },
      include: {
        _count: { select: { orders: true } },
        orders: {
          where: { paymentStatus: 'paid' },
          select: { grandTotal: true }
        }
      }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const totalSpent = customer.orders.reduce((sum, order) => sum + Number(order.grandTotal), 0);

    const { password: _, orders: __, ...result } = customer;
    return { ...result, totalSpent };
  }

  // Update customer profile
  async updateProfile(customerId: string, data: any) {
    const cId = BigInt(customerId);

    // If email is changing, check for duplicates
    if (data.email) {
      const existing = await this.prisma.customer.findUnique({
        where: { email: data.email },
      });
      if (existing && existing.id !== cId) {
        throw new BadRequestException('Email already in use');
      }
    }

    // If mobile is changing, check for duplicates
    if (data.mobile) {
      const existing = await this.prisma.customer.findUnique({
        where: { mobile: data.mobile },
      });
      if (existing && existing.id !== cId) {
        throw new BadRequestException('Mobile number already in use');
      }
    }

    return this.prisma.customer.update({
      where: { id: cId },
      data,
    });
  }

  // Admin: Get all customers
  async getAllUsers() {
    const customers = await this.prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { orders: true }
        },
        orders: {
            where: { paymentStatus: 'paid' },
            select: { grandTotal: true }
        }
      }
    });

    const mapped = customers.map(c => {
        const totalSpent = c.orders.reduce((sum, order) => sum + Number(order.grandTotal), 0);
        const { password: _, orders: __, ...rest } = c as any;
        return {
            ...rest,
            totalSpent,
            isActive: rest.status === 1 && !rest.isBlock,
            isBlocked: rest.isBlock
        };
    });

    return { 
      success: true, 
      data: mapped 
    };
  }

  // Admin: Update customer status or details
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
