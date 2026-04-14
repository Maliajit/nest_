import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async createCategory(dto: CreateCategoryDto) {
    const { parentId, imageId, image, imageUrl, ...rest } = dto;
    
    const data: any = {
      ...rest,
      parentId: parentId ? BigInt(parentId) : null,
      imageId: imageId ? BigInt(imageId) : null,
      imageUrl: imageUrl || image || null,
    };

    try {
      const category = await this.prisma.category.create({
        data,
      });
      return { success: true, data: category };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('A category with this slug already exists.');
        }
      }
      throw error;
    }
  }

  async getAllCategories() {
    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: { products: true }
        },
        image: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Map to include isActive and potentially other frontend fields
    const mapped = categories.map(cat => ({
      ...cat,
      isActive: cat.status === 1,
    }));

    return { success: true, data: mapped };
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        image: true,
        _count: {
          select: { products: true }
        }
      }
    });

    if (!category) {
      throw new NotFoundException(`Category ${slug} not found.`);
    }

    return {
      ...category,
      isActive: category.status === 1,
    };
  }

  async getCategoryTree() {
    const allCategories = await this.prisma.category.findMany({
      where: { status: 1 },
      include: {
        image: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    const buildTree = (parentId: bigint | null = null): any[] => {
      return allCategories
        .filter((cat) => cat.parentId === parentId)
        .map((cat) => ({
          ...cat,
          isActive: true,
          children: buildTree(cat.id),
        }));
    };

    return buildTree(null);
  }

  async getCategoryById(id: string | number) {
    const category = await this.prisma.category.findUnique({
      where: { id: BigInt(id) },
      include: {
        image: true,
        _count: {
          select: { products: true }
        }
      }
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found.`);
    }
    return {
      ...category,
      isActive: category.status === 1,
    };
  }

  async updateCategory(id: string | number, dto: UpdateCategoryDto) {
    const { parentId, imageId, image, imageUrl, ...rest } = dto;
    
    const data: any = { ...rest };

    if (parentId !== undefined) {
      data.parentId = parentId ? BigInt(parentId) : null;
    }
    if (imageId !== undefined) {
      data.imageId = imageId ? BigInt(imageId) : null;
    }
    if (imageUrl !== undefined || image !== undefined) {
      data.imageUrl = imageUrl || image || null;
    }

    try {
      const category = await this.prisma.category.update({
        where: { id: BigInt(id) },
        data,
      });
      return { success: true, data: category };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Category with ID ${id} not found.`);
        }
        if (error.code === 'P2002') {
          throw new ConflictException('A category with this slug already exists.');
        }
      }
      throw error;
    }
  }

  async deleteCategory(id: string | number) {
    try {
      return await this.prisma.category.delete({
        where: { id: BigInt(id) },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Category with ID ${id} not found.`);
        }
      }
      throw error;
    }
  }
}
