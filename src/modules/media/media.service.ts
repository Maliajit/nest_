import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMediaDto, UpdateMediaDto } from './dto/media.dto';
import { extname } from 'path';

@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService) {}

  async saveUploadedFile(file: Express.Multer.File) {
    const ext = extname(file.originalname).toLowerCase();
    const media = await this.prisma.media.create({
      data: {
        originalFilename: file.originalname,
        fileName: file.filename,
        filePath: file.path.replace(/\\/g, '/'), // Ensure cross-platform paths
        mimeType: file.mimetype,
        extension: ext.replace('.', ''),
        fileSize: BigInt(file.size),
        disk: 'local',
        fileType: file.mimetype.split('/')[0], // 'image', 'video', etc.
      },
    });
    return { success: true, data: media };
  }

  async createMedia(dto: CreateMediaDto) {
    const { fileSize, ...rest } = dto;
    const media = await this.prisma.media.create({
      data: {
        ...rest,
        fileSize: BigInt(fileSize)
      }
    });
    return { success: true, data: media };
  }

  async getAllMedia() {
    const media = await this.prisma.media.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, data: media };
  }

  async getMediaById(id: string | number) {
    const media = await this.prisma.media.findUnique({
      where: { id: BigInt(id) }
    });
    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found.`);
    }
    return media;
  }

  async updateMedia(id: string | number, dto: UpdateMediaDto) {
    try {
      const media = await this.prisma.media.update({
        where: { id: BigInt(id) },
        data: dto
      });
      return { success: true, data: media };
    } catch (error) {
      throw new NotFoundException(`Media with ID ${id} not found.`);
    }
  }

  async deleteMedia(id: string | number) {
    try {
      return await this.prisma.media.delete({
        where: { id: BigInt(id) }
      });
    } catch (error) {
      throw new NotFoundException(`Media with ID ${id} not found.`);
    }
  }

  async uploadMultiple(files: Array<Express.Multer.File>, category?: string) {
    const results = await Promise.all(
      files.map(file => this.saveUploadedFile(file))
    );
    return { success: true, data: results.map(r => r.data) };
  }
}
