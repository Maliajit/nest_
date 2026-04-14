import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController, VariantController } from './product.controller';
import { VariantGeneratorService } from './variant-generator.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [ProductController, VariantController],
  providers: [ProductService, VariantGeneratorService],
})
export class ProductModule {}
