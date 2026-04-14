import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  parentId?: number | string;

  @IsOptional()
  imageId?: number | string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
  @IsNumber()
  status?: number;

  @IsOptional()
  @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
  @IsNumber()
  featured?: number;

  @IsOptional()
  @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
  @IsNumber()
  showInNav?: number;

  @IsOptional()
  @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  metaKeywords?: string;
}
