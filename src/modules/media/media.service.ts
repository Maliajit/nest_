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
        fileSize: Number(file.size),
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
        fileSize: Number(fileSize)
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
      where: { id: Number(id) }
    });
    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found.`);
    }
    return media;
  }

  async updateMedia(id: string | number, dto: UpdateMediaDto) {
    try {
      const media = await this.prisma.media.update({
        where: { id: Number(id) },
        data: dto
      });
      return { success: true, data: media };
    } catch (error) {
      throw new NotFoundException(`Media with ID ${id} not found.`);
    }
  }

  async deleteMedia(id: string | number) {
    const media = await this.prisma.media.findUnique({
      where: { id: Number(id) }
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found.`);
    }

    try {
      // Delete from database
      await this.prisma.media.delete({
        where: { id: Number(id) }
      });

      // Try to delete from disk if it's a local file
      if (media.disk === 'local' && media.filePath) {
        const fs = require('fs');
        const path = require('path');
        const fullPath = path.join(process.cwd(), media.filePath);
        
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }

      return { success: true, message: 'Media deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete media: ${error.message}`);
    }
  }

  async uploadMultiple(files: Array<Express.Multer.File>, category?: string) {
    const results = await Promise.all(
      files.map(file => this.saveUploadedFile(file))
    );
    return { success: true, data: results.map(r => r.data) };
  }
}


