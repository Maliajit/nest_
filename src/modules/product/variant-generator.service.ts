import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class VariantGeneratorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generates all possible combinations (Cartesian Product) of the provided attributes and values.
   * @param productId The ID of the product
   * @param selections An array of objects containing attributeId and array of selected attributeValueIds
   * @param productCode The base product code for SKU generation
   */
  async generateVariants(productId: bigint, selections: { attributeId: bigint, valueIds: bigint[] }[], productCode: string) {
    if (selections.length === 0) {
      throw new BadRequestException('No attributes selected for variant generation.');
    }

    // 1. Calculate Cartesian Product
    const combinations = this.cartesianProduct(selections.map(s => s.valueIds));

    if (combinations.length > 1000) {
       throw new BadRequestException('Too many combinations (>1000). Please reduce attribute selections.');
    }

    // 2. Fetch all AttributeValues to get their codes/labels for SKU generation
    const allValueIds = selections.flatMap(s => s.valueIds);
    const attributeValues = await this.prisma.attributeValue.findMany({
      where: { id: { in: allValueIds } },
      include: { attribute: true }
    });

    const valueMap = new Map<string, any>(attributeValues.map(v => [v.id.toString(), v]));

    const variantsToCreate: any[] = [];

    for (const combo of combinations) {
      // combo is an array of attributeValueIds
      const comboValues = combo.map(id => valueMap.get(id.toString())).filter(v => v !== undefined);
      
      if (comboValues.length !== selections.length) {
        continue; // Should not happen with clean DB data
      }

      // Generate SKU: PRODUCTCODE-VAL1CODE-VAL2CODE...
      const skuParts = [productCode];
      for (const val of comboValues) {
        const code = val.code || val.value.substring(0, 3).toUpperCase();
        skuParts.push(code);
      }
      const sku = skuParts.join('-');

      variantsToCreate.push({
        sku,
        price: new Prisma.Decimal(0), // Default price
        qty: 0, // Default stock
        inStock: true,
        isActive: true,
        attributeValueIds: combo // Temporary storage for mapping later
      });
    }

    // 3. Database Operations (Transaction recommended)
    const results = await this.prisma.$transaction(async (tx) => {
      const createdVariants: any[] = [];
      
      for (const vData of variantsToCreate) {
        const { attributeValueIds, ...variantFields } = vData;
        
        const variant = await tx.productVariant.create({
          data: {
            ...variantFields,
            productId,
          }
        });

        // Create VariantAttribute records
        for (const valueId of attributeValueIds) {
          const attrValue = valueMap.get(valueId.toString());
          if (attrValue) {
            await tx.variantAttribute.create({
              data: {
                variantId: variant.id,
                attributeId: attrValue.attributeId,
                attributeValueId: valueId,
              }
            });
          }
        }
        
        createdVariants.push(variant);
      }
      
      return createdVariants;
    });

    return {
      success: true,
      count: results.length,
      variants: results
    };
  }

  private cartesianProduct(arrays: bigint[][]): bigint[][] {
    return arrays.reduce((a, b) => {
      return a.flatMap(d => b.map(e => [d, e].flat())) as bigint[][];
    }, [[]] as bigint[][]);
  }
}
