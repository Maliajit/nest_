import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SpecificationService {
  constructor(private prisma: PrismaService) {}

  // --- Specification Methods ---
  async findAll() {
    const specs = await this.prisma.specification.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return { success: true, data: specs };
  }

  async findOne(id: number | string) {
    const spec = await this.prisma.specification.findUnique({
      where: { id: BigInt(id) },
    });
    if (!spec) throw new NotFoundException('Specification not found');
    return { success: true, data: spec };
  }

  async create(data: any) {
    const spec = await this.prisma.specification.create({
      data: {
        name: data.name,
        code: data.code || data.name.toLowerCase().replace(/ /g, '_'),
        type: data.type || 'text',
        sortOrder: data.sortOrder || 0,
      },
    });
    return { success: true, data: spec };
  }

  async update(id: number | string, data: any) {
    const spec = await this.prisma.specification.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name,
        code: data.code,
        type: data.type,
        sortOrder: data.sortOrder,
      },
    });
    return { success: true, data: spec };
  }

  async remove(id: number | string) {
    await this.prisma.specification.delete({
      where: { id: BigInt(id) },
    });
    return { success: true, message: 'Specification deleted' };
  }

  // --- Specification Group Methods ---
  async findAllGroups() {
    const groups = await this.prisma.specificationGroup.findMany({
      include: {
        specifications: {
          include: { specification: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    
    // Map to include a simple specs_count
    return { 
      success: true, 
      data: groups.map(g => ({
        ...g,
        specs_count: g.specifications.length
      })) 
    };
  }

  async findOneGroup(id: number | string) {
    const group = await this.prisma.specificationGroup.findUnique({
      where: { id: BigInt(id) },
      include: {
        specifications: {
          include: { specification: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!group) throw new NotFoundException('Specification group not found');
    return { success: true, data: group };
  }

  async createGroup(data: any) {
    const group = await this.prisma.specificationGroup.create({
      data: {
        name: data.name,
        sortOrder: data.sortOrder || 0,
      },
    });
    return { success: true, data: group };
  }

  async updateGroup(id: number | string, data: any) {
    const group = await this.prisma.specificationGroup.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name,
        sortOrder: data.sortOrder,
      },
    });
    return { success: true, data: group };
  }

  async removeGroup(id: number | string) {
    await this.prisma.specificationGroup.delete({
      where: { id: BigInt(id) },
    });
    return { success: true, message: 'Specification group deleted' };
  }

  // --- Group Specification Mapping ---
  async addSpecToGroup(groupId: number | string, specId: number | string, sortOrder: number = 0) {
    const mapping = await this.prisma.specGroupSpec.create({
      data: {
        specificationGroupId: BigInt(groupId),
        specificationId: BigInt(specId),
        sortOrder,
      },
    });
    return { success: true, data: mapping };
  }

  async removeSpecFromGroup(groupId: number | string, specId: number | string) {
    await this.prisma.specGroupSpec.delete({
      where: {
        specificationGroupId_specificationId: {
          specificationGroupId: BigInt(groupId),
          specificationId: BigInt(specId),
        },
      },
    });
    return { success: true, message: 'Specification removed from group' };
  }
}
