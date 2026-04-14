import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagDto, UpdateTagDto } from './dto/tag.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TagService {
  constructor(private prisma: PrismaService) {}

  async createTag(dto: CreateTagDto) {
    try {
      const tag = await this.prisma.tag.create({
        data: dto,
      });
      return { success: true, data: tag };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('A tag with this slug already exists.');
        }
      }
      throw error;
    }
  }

  async getAllTags() {
    const tags = await this.prisma.tag.findMany({
      include: {
        _count: {
          select: { productTags: true }
        }
      }
    });
    
    // Map productTags count to products for frontend consistency
    const mapped = tags.map(tag => ({
      ...tag,
      _count: {
        products: tag._count.productTags
      }
    }));

    return { success: true, data: mapped };
  }

  async getTagById(id: string | number) {
    const tag = await this.prisma.tag.findUnique({
      where: { id: BigInt(id) },
      include: {
        _count: {
          select: { productTags: true }
        }
      }
    });
    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found.`);
    }
    return tag;
  }

  async getTagBySlug(slug: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { productTags: true }
        }
      }
    });
    if (!tag) {
      throw new NotFoundException(`Tag ${slug} not found.`);
    }
    return tag;
  }

  async updateTag(id: string | number, dto: UpdateTagDto) {
    try {
      const tag = await this.prisma.tag.update({
        where: { id: BigInt(id) },
        data: dto,
      });
      return { success: true, data: tag };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Tag with ID ${id} not found.`);
        }
      }
      throw error;
    }
  }

  async deleteTag(id: string | number) {
    try {
      return await this.prisma.tag.delete({
        where: { id: BigInt(id) },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Tag with ID ${id} not found.`);
        }
      }
      throw error;
    }
  }
}
