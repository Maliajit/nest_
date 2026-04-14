import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CmsService {
  constructor(private prisma: PrismaService) {}

  // Fetch active banners filtered by position
  async getBanners(position?: string) {
    const where: any = { isActive: true };
    if (position) where.position = position;

    return this.prisma.banner.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
  }

  // Fetch active popups
  async getActivePopups() {
    const now = new Date();
    return this.prisma.popup.findMany({
      where: {
        isActive: true,
        OR: [
          { startsAt: null },
          { startsAt: { lte: now } }
        ],
        AND: [
          { OR: [ { endsAt: null }, { endsAt: { gte: now } } ] }
        ]
      },
    });
  }

  // Admin Methods
  async getAllPages() {
    const pages = await this.prisma.page.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    return { success: true, data: pages };
  }

  async createPage(data: any) {
    const page = await this.prisma.page.create({ data });
    return { success: true, data: page };
  }

  async updatePage(id: number, data: any) {
    const page = await this.prisma.page.update({ where: { id }, data });
    return { success: true, data: page };
  }

  async deletePage(id: number) {
    await this.prisma.page.delete({ where: { id } });
    return { success: true };
  }

  // Fetch static page by slug
  async getPageBySlug(slug: string) {
    return this.prisma.page.findUnique({
      where: { slug },
    });
  }

  // Banners
  async getAllBanners() {
    const banners = await this.prisma.banner.findMany({
      orderBy: { sortOrder: 'asc' }
    });
    return { success: true, data: banners };
  }

  async createBanner(data: any) {
    const banner = await this.prisma.banner.create({ data });
    return { success: true, data: banner };
  }

  async updateBanner(id: number, data: any) {
    const banner = await this.prisma.banner.update({ where: { id }, data });
    return { success: true, data: banner };
  }

  async deleteBanner(id: number) {
    await this.prisma.banner.delete({ where: { id } });
    return { success: true };
  }

  // Testimonials
  async getTestimonials() {
    const testimonials = await this.prisma.testimonial.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return { success: true, data: testimonials };
  }

  async createTestimonial(data: any) {
    const testimonial = await this.prisma.testimonial.create({
      data: {
        name: data.name,
        designation: data.designation,
        message: data.message || data.content,
        rating: Number(data.rating) || 5,
        isActive: data.isActive ?? true,
        image: data.image,
      },
    });
    return { success: true, data: testimonial };
  }

  async updateTestimonial(id: number, data: any) {
    const testimonial = await this.prisma.testimonial.update({
      where: { id },
      data: {
        name: data.name,
        designation: data.designation,
        message: data.message || data.content,
        rating: data.rating ? Number(data.rating) : undefined,
        isActive: data.isActive,
        image: data.image,
      },
    });
    return { success: true, data: testimonial };
  }

  async deleteTestimonial(id: number | bigint) {
    const tId = BigInt(id);
    await this.prisma.testimonial.delete({
      where: { id: tId },
    });
    return { success: true };
  }

  // Home Page Sections
  async getHomeSections() {
    const list = await this.prisma.homeSection.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    // Frontend expects 'name' but backend has 'title'
    const mapped = list.map(s => ({
        ...s,
        name: s.title
    }));
    return { success: true, data: mapped };
  }

  async createHomeSection(data: any) {
    const section = await this.prisma.homeSection.create({
      data: {
        title: data.name,
        type: data.type || 'products',
        sortOrder: Number(data.order) || 0,
        isActive: data.status ?? true,
      },
    });
    return { success: true, data: { ...section, name: section.title } };
  }

  async updateHomeSection(id: number | bigint, data: any) {
    const sId = BigInt(id);
    const section = await this.prisma.homeSection.update({
      where: { id: sId },
      data: {
        title: data.name,
        type: data.type,
        sortOrder: data.order ? Number(data.order) : undefined,
        isActive: data.status,
      },
    });
    return { success: true, data: { ...section, name: section.title } };
  }

  async deleteHomeSection(id: number | bigint) {
    const sId = BigInt(id);
    await this.prisma.homeSection.delete({
      where: { id: sId },
    });
    return { success: true };
  }
}
