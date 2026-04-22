import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BrandService {
  constructor(private prisma: PrismaService) {}

  async createBrand(dto: CreateBrandDto) {
    const data: any = {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      isActive: dto.status !== undefined ? (String(dto.status) === '1') : (dto.isActive ?? true),
      isFeatured: dto.isFeatured ? 1 : 0,
      sortOrder: Number(dto.sortOrder) || 0,
      metaTitle: dto.metaTitle,
      metaDescription: dto.metaDescription,
      metaKeywords: dto.metaKeywords,
      logoId: dto.logoId ? BigInt(dto.logoId) : null,
    };

    try {
      const brand = await this.prisma.brand.create({
        data,
      });
      return { success: true, data: brand };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('A brand with this slug already exists.');
        }
      }
      throw error;
    }
  }

  async getAllBrands() {
    const brands = await this.prisma.brand.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { products: true }
        },
        logo: true,
      }
    });

    return { success: true, data: brands };
  }

  async getBrandBySlug(slug: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug },
      include: {
        logo: true,
        _count: {
          select: { products: true }
        }
      }
    });
    if (!brand) {
      throw new NotFoundException(`Brand ${slug} not found.`);
    }
    return brand;
  }

  async getBrandById(id: string | number) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: BigInt(id) },
      include: {
        logo: true,
        _count: {
          select: { products: true }
        }
      }
    });
    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found.`);
    }
    return brand;
  }

  async updateBrand(id: string | number, dto: UpdateBrandDto) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.metaTitle !== undefined) data.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined) data.metaDescription = dto.metaDescription;
    if (dto.metaKeywords !== undefined) data.metaKeywords = dto.metaKeywords;
    if (dto.sortOrder !== undefined) data.sortOrder = Number(dto.sortOrder);
    if (dto.isFeatured !== undefined) data.isFeatured = dto.isFeatured ? 1 : 0;
    
    if (dto.logoId !== undefined) {
      data.logoId = dto.logoId ? BigInt(dto.logoId) : null;
    }

    if (dto.status !== undefined) {
      data.isActive = (String(dto.status) === '1');
    } else if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    try {
      const brand = await this.prisma.brand.update({
        where: { id: BigInt(id) },
        data,
      });
      return { success: true, data: brand };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Brand with ID ${id} not found.`);
        }
        if (error.code === 'P2002') {
          throw new ConflictException('A brand with this slug already exists.');
        }
      }
      throw error;
    }
  }

  async deleteBrand(id: string | number) {
    try {
      return await this.prisma.brand.update({
        where: { id: BigInt(id) },
        data: { deletedAt: new Date() }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Brand with ID ${id} not found.`);
        }
      }
      throw error;
    }
  }
}
