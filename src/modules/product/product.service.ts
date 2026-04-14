import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { MediaService } from '../media/media.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private mediaService: MediaService,
  ) {}

  async createProduct(dto: CreateProductDto, imageFiles?: Array<Express.Multer.File>) {
    const { brandId, mainCategoryId, ...rest } = dto;
    
    // Convert IDs to BigInt and decimals to string for Prisma
    const data: any = {
      ...rest,
      price: rest.price ? rest.price.toString() : '0',
      sellingPrice: rest.price ? rest.price.toString() : '0',
      brandId: brandId ? BigInt(brandId) : null,
      mainCategoryId: mainCategoryId ? BigInt(mainCategoryId) : null,
    };

    if (imageFiles && imageFiles.length > 0) {
      const savedMedia = await Promise.all(
        imageFiles.map(file => this.mediaService.saveUploadedFile(file))
      );
      // Construct public URLs for the images
      data.images = savedMedia.map(m => `/uploads/${m.data.fileName}`);
    }

    if (rest.specialPrice) {
      data.specialPrice = rest.specialPrice.toString();
    }

    // Filter data to only include valid Prisma fields for Product
    const prismaData: any = {
      name: data.name,
      slug: data.slug,
      sku: data.sku,
      productCode: data.productCode,
      productType: data.productType || 'simple',
      description: data.description,
      shortDescription: data.shortDescription,
      price: data.price,
      specialPrice: data.specialPrice,
      specialPriceStart: data.specialPriceStart,
      specialPriceEnd: data.specialPriceEnd,
      sellingPrice: data.sellingPrice,
      manageStock: data.manageStock ?? true,
      qty: data.qty ?? 0,
      inStock: data.inStock ?? true,
      codAvailable: data.codAvailable ?? true,
      status: data.status || 'active',
      heroImage: data.heroImage,
      isFeatured: data.isFeatured ?? false,
      isNew: data.isNew ?? false,
      isBestseller: data.isBestseller ?? false,
      weight: data.weight,
      length: data.length,
      width: data.width,
      height: data.height,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      metaKeywords: data.metaKeywords,
      images: data.images,
      brandId: data.brandId,
      mainCategoryId: data.mainCategoryId,
      subtitle: data.subtitle,
      tagline: data.tagline,
      heritageText: data.heritageText,
      bgColor: data.bgColor,
      accentColor: data.accentColor,
      textColor: data.textColor,
      gradient: data.gradient,
      mistColor: data.mistColor,
    };

    try {
      const product = await this.prisma.product.create({
        data: prismaData,
      });
      return { success: true, data: product };
    } catch (error) {
      console.error('Error creating product:', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return { success: false, error: 'A product with this slug or SKU already exists.' };
        }
      }
      return { success: false, error: error.message || 'Failed to create product' };
    }
  }

  async getAllProducts(filters: any = {}) {
    const {
      search,
      categoryId,
      brandId,
      minPrice,
      maxPrice,
      sort,
      status,
      page = 1,
      limit = 100, // Increased default limit for admin lists
    } = filters;

    const where: Prisma.ProductWhereInput = {};
    
    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.mainCategoryId = BigInt(categoryId);
    }

    if (brandId) {
      where.brandId = BigInt(brandId);
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.sellingPrice = {};
      if (minPrice !== undefined) where.sellingPrice.gte = new Prisma.Decimal(minPrice);
      if (maxPrice !== undefined) where.sellingPrice.lte = new Prisma.Decimal(maxPrice);
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (sort) {
      switch (sort) {
        case 'price_asc':
          orderBy = { sellingPrice: 'asc' };
          break;
        case 'price_desc':
          orderBy = { sellingPrice: 'desc' };
          break;
        case 'bestseller':
          orderBy = { isBestseller: 'desc' };
          break;
        case 'newest':
          orderBy = { createdAt: 'desc' };
          break;
      }
    }

    const skip = (page - 1) * limit;

    console.log('getAllProducts filters:', filters);
    console.log('getAllProducts where clause:', JSON.stringify(where, (key, value) => typeof value === 'bigint' ? value.toString() : value));

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          brand: true,
          mainCategory: true,
          variants: true,
          _count: {
            select: { 
              variants: true,
              productMedia: true 
            }
          }
        },
      }),
    ]);

    const mappedProducts = products.map(p => ({
      ...p,
      isActive: p.status === 'active' || p.status === '1',
      stock: p.qty, // Map qty to stock for frontend consistency
    }));

    return {
      success: true,
      data: mappedProducts,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async getFeaturedProducts() {
    const products = await this.prisma.product.findMany({
      where: { isFeatured: true, status: 'active' },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        brand: true,
        mainCategory: true,
      },
    });

    return {
      success: true,
      data: products.map(p => ({ ...p, isActive: true })),
    };
  }

  async getProductById(idOrSlug: string) {
    const isId = /^\d+$/.test(idOrSlug);
    
    const product = await this.prisma.product.findUnique({
      where: isId ? { id: BigInt(idOrSlug) } : { slug: idOrSlug },
      include: {
        brand: true,
        mainCategory: true,
        variants: {
          include: {
            variantAttributes: {
              include: {
                attributeValue: true
              }
            },
            variantImages: {
              include: {
                media: true
              }
            }
          }
        },
        specifications: {
          include: {
            specification: true
          }
        },
        productMedia: {
          include: {
            media: true
          }
        },
        _count: {
          select: {
            variants: true,
            productMedia: true
          }
        }
      }
    });

    if (!product) {
      throw new NotFoundException(`Product with identifier ${idOrSlug} not found.`);
    }

    // Aggregate Ratings
    const stats = await this.prisma.productReview.aggregate({
      where: { productId: product.id, status: 'approved' },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      ...product,
      isActive: product.status === 'active' || product.status === '1',
      averageRating: stats._avg.rating || 0,
      reviewCount: stats._count.rating || 0,
    };
  }

  async getProductsByCategory(categorySlug: string, filters: any = {}) {
    const category = await this.prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!category) {
      throw new NotFoundException(`Category ${categorySlug} not found.`);
    }

    return this.getAllProducts({ ...filters, categoryId: category.id.toString() });
  }

  async getProductsByBrand(brandSlug: string, filters: any = {}) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug: brandSlug },
    });

    if (!brand) {
      throw new NotFoundException(`Brand ${brandSlug} not found.`);
    }

    return this.getAllProducts({ ...filters, brandId: brand.id.toString() });
  }

  async updateProduct(id: string | number, dto: UpdateProductDto, imageFiles?: Array<Express.Multer.File>) {
    const { brandId, mainCategoryId, ...rest } = dto;
    
    const data: any = { ...rest };

    if (rest.price !== undefined) {
      data.price = rest.price.toString();
    }
    if (rest.specialPrice !== undefined) {
      data.specialPrice = rest.specialPrice ? rest.specialPrice.toString() : null;
    }
    if (brandId !== undefined) {
      data.brandId = brandId ? BigInt(brandId) : null;
    }
    if (mainCategoryId !== undefined) {
      data.mainCategoryId = mainCategoryId ? BigInt(mainCategoryId) : null;
    }

    if (imageFiles && imageFiles.length > 0) {
      const savedMedia = await Promise.all(
        imageFiles.map(file => this.mediaService.saveUploadedFile(file))
      );
      const newImages = savedMedia.map(m => `/uploads/${m.data.fileName}`);
      data.images = newImages; 
    }

    try {
      const product = await this.prisma.product.update({
        where: { id: BigInt(id) },
        data,
      });
      return { success: true, data: product };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Product with ID ${id} not found.`);
        }
      }
      throw error;
    }
  }

  async deleteProduct(id: string | number) {
    try {
      await this.prisma.product.delete({
        where: { id: BigInt(id) },
      });
      return { success: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Product with ID ${id} not found.`);
        }
      }
      throw error;
    }
  }

  async getProductVariants(productId: string | number) {
    const variants = await this.prisma.productVariant.findMany({
      where: { productId: BigInt(productId) },
      include: {
        variantAttributes: {
          include: {
            attributeValue: true
          }
        },
        variantImages: {
          include: {
            media: true
          }
        }
      }
    });
    return { success: true, data: variants };
  }

  async updateVariant(id: string | number, dto: any) {
    const data: any = { ...dto };
    if (dto.price !== undefined) data.price = dto.price.toString();
    
    try {
      const variant = await this.prisma.productVariant.update({
        where: { id: BigInt(id) },
        data,
      });
      return { success: true, data: variant };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Variant with ID ${id} not found.`);
        }
      }
      throw error;
    }
  }

  async uploadProductMedia(productId: string | number, files: Array<Express.Multer.File>, type: string) {
    const savedMedia = await Promise.all(
      files.map(file => this.mediaService.saveUploadedFile(file))
    );

    const productMedia = await Promise.all(
      savedMedia.map((m, index) => 
        this.prisma.productMedia.create({
          data: {
            productId: BigInt(productId),
            mediaId: m.data.id,
            type,
            sortOrder: index
          }
        })
      )
    );

    return { success: true, data: productMedia };
  }

  async uploadVariantMedia(variantId: string | number, files: Array<Express.Multer.File>, type: string) {
    const savedMedia = await Promise.all(
      files.map(file => this.mediaService.saveUploadedFile(file))
    );

    const variantImages = await Promise.all(
      savedMedia.map((m, index) => 
        this.prisma.variantImage.create({
          data: {
            variantId: BigInt(variantId),
            mediaId: m.data.id,
            type: type?.toUpperCase() || 'GALLERY',
            sortOrder: index
          }
        })
      )
    );

    return { success: true, data: variantImages };
  }

  async getInventory() {
    const inventory = await this.prisma.productVariant.findMany({
      include: {
        product: {
          select: {
            name: true,
            sku: true,
          },
        },
        warehouseStocks: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    return {
      success: true,
      data: inventory.map((v) => ({
        id: v.id.toString(),
        product_name: v.product?.name || 'Unknown Product',
        sku: v.sku || v.product?.sku || 'N/A',
        stock: v.qty,
        reserved: v.reservedQuantity,
        available: v.qty - v.reservedQuantity,
        min_stock: 5,
        warehouse: v.warehouseStocks?.[0]?.warehouse?.name || 'Main Warehouse',
      })),
    };
  }

  async updateInventoryStock(variantId: string | number, qty: number, type: string, note?: string, adminId?: string) {
    const vId = BigInt(variantId);
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: vId },
    });

    if (!variant) throw new NotFoundException('Variant not found');

    let newQty = variant.qty;
    if (type === 'Add') newQty += qty;
    else if (type === 'Subtract') newQty = Math.max(0, newQty - qty);
    else if (type === 'Set') newQty = qty;

    const [updated] = await this.prisma.$transaction([
      this.prisma.productVariant.update({
        where: { id: vId },
        data: { qty: newQty },
      }),
      this.prisma.stockHistory.create({
        data: {
          productVariantId: vId,
          productId: variant.productId,
          changeType: type,
          quantity: qty,
          oldQuantity: variant.qty,
          newQuantity: newQty,
          reason: note,
          notes: note,
          adminId: adminId ? BigInt(adminId) : null,
        },
      }),
    ]);

    return { success: true, data: updated };
  }
}
