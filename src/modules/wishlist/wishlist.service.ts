import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  // Get or Create wishlist for customer
  private async getOrCreateWishlist(customerId: string) {
    if (!customerId || customerId === 'undefined' || customerId === 'null') {
      return { id: BigInt(0), items: [], name: 'Default' };
    }
    const cId = BigInt(customerId);
    // Unique on customerId and name
    let wishlist = await this.prisma.wishlist.findUnique({
      where: { customerId_name: { customerId: cId, name: 'Default' } },
      include: { items: { include: { productVariant: { include: { product: true } } } } },
    });

    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({
        data: {
          customer: { connect: { id: cId } },
          name: 'Default',
        },
        include: { items: { include: { productVariant: { include: { product: true } } } } },
      });
    }
    return wishlist;
  }

  // Get wishlist
  async getWishlist(customerId: string) {
    return this.getOrCreateWishlist(customerId);
  }

  // Toggle item in wishlist
  async toggleItem(customerId: string, variantId: string) {
    const vId = BigInt(variantId);
    const wishlist = await this.getOrCreateWishlist(customerId);

    // Check if variant exists
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: vId },
    });
    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    // Check if already in wishlist
    const existing = await this.prisma.wishlistItem.findFirst({
      where: { wishlistId: wishlist.id, productVariantId: vId },
    });

    if (existing) {
      await this.prisma.wishlistItem.delete({ where: { id: existing.id } });
      return { added: false };
    }

    await this.prisma.wishlistItem.create({
      data: {
        wishlist: { connect: { id: wishlist.id } },
        productVariant: { connect: { id: vId } },
      },
    });
    return { added: true };
  }

  // Clear wishlist
  async clearWishlist(customerId: string) {
    const wishlist = await this.getOrCreateWishlist(customerId);
    await this.prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id },
    });
    return { success: true };
  }
}
