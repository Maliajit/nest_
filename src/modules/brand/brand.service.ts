import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BrandService {
  constructor(private prisma: PrismaService) {}

  async createBrand(dto: CreateBrandDto) {
    const { logoId, ...rest } = dto;
    
    const data: any = {
      ...rest,
      logoId: logoId ? BigInt(logoId) : null,
      isActive: dto.isActive ?? true,
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
    const { logoId, ...rest } = dto;
    
    const data: any = { ...rest };

    if (logoId !== undefined) {
      data.logoId = logoId ? BigInt(logoId) : null;
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
