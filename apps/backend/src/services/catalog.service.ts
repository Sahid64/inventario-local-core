import type {
  CreateCategoryInput,
  CreateProductInput,
  CreateVariantInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateVariantInput,
} from '@inventario-local/shared/schemas';
import { prisma } from '../config/db';
import { AppError } from '../middlewares/error.middleware';
import { generateInternalEan13 } from '../utils/barcode.util';

export interface ListProductsFilter {
  search?: string;
  categoryId?: string;
  warehouseId?: string;
  includeInactive?: boolean;
}

export class CatalogService {
  // ==========================================================================
  // Categorías
  // ==========================================================================

  async listCategories() {
    return prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(input: CreateCategoryInput) {
    return prisma.category.create({
      data: {
        name: input.name,
        description: input.description ?? null,
      },
    });
  }

  async updateCategory(id: string, input: UpdateCategoryInput) {
    return prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      },
    });
  }

  async deleteCategory(id: string) {
    await prisma.product.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });

    await prisma.category.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ==========================================================================
  // Productos y Variantes
  // ==========================================================================

  async listProducts(filters: ListProductsFilter = {}) {
    const search = filters.search?.trim();

    return prisma.product.findMany({
      where: {
        ...(filters.includeInactive ? {} : { isActive: true }),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
                {
                  variants: {
                    some: {
                      OR: [
                        { sku: { contains: search } },
                        { barcode: { contains: search } },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        variants: {
          include: {
            stocks: {
              ...(filters.warehouseId ? { where: { warehouseId: filters.warehouseId } } : {}),
              include: {
                warehouse: {
                  select: { id: true, name: true },
                },
              },
            },
          },
          orderBy: { sku: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: {
          include: {
            stocks: {
              include: {
                warehouse: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { sku: 'asc' },
        },
      },
    });

    if (!product) {
      throw new AppError(404, 'Producto no encontrado.', 'ProductNotFound');
    }

    return product;
  }

  async createProduct(input: CreateProductInput) {
    return prisma.product.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        unit: input.unit,
        isActive: input.isActive,
        categoryId: input.categoryId ?? null,
        variants: {
          create: input.variants.map((v) => ({
            sku: v.sku,
            barcode: v.barcode ?? null,
            attributes: v.attributes ?? null,
            costPrice: v.costPrice,
            salePrice: v.salePrice,
            minStock: v.minStock,
            maxStock: v.maxStock ?? null,
          })),
        },
      },
      include: {
        category: true,
        variants: {
          include: { stocks: true },
        },
      },
    });
  }

  async updateProduct(id: string, input: UpdateProductInput) {
    return prisma.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      },
      include: {
        category: true,
        variants: {
          include: { stocks: true },
        },
      },
    });
  }

  async deleteProduct(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { variants: { select: { id: true } } },
    });

    if (!product) {
      throw new AppError(404, 'Producto no encontrado.', 'ProductNotFound');
    }

    const variantIds = product.variants.map((v) => v.id);
    const movementsCount = variantIds.length
      ? await prisma.inventoryMovement.count({
          where: { variantId: { in: variantIds } },
        })
      : 0;

    if (movementsCount > 0) {
      // Preservar historial inmutable del Kardex mediante baja lógica
      const archived = await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        deleted: false,
        archived: true,
        product: archived,
        message: 'El producto tiene historial en Kardex y fue desactivado en lugar de eliminarse.',
      };
    }

    await prisma.product.delete({ where: { id } });
    return { deleted: true, archived: false, id };
  }

  async addVariant(productId: string, input: CreateVariantInput) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppError(404, 'Producto no encontrado.', 'ProductNotFound');
    }

    return prisma.productVariant.create({
      data: {
        productId,
        sku: input.sku,
        barcode: input.barcode ?? null,
        attributes: input.attributes ?? null,
        costPrice: input.costPrice,
        salePrice: input.salePrice,
        minStock: input.minStock,
        maxStock: input.maxStock ?? null,
      },
      include: { stocks: true },
    });
  }

  async updateVariant(variantId: string, input: UpdateVariantInput) {
    return prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.barcode !== undefined ? { barcode: input.barcode || null } : {}),
        ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
        ...(input.costPrice !== undefined ? { costPrice: input.costPrice } : {}),
        ...(input.salePrice !== undefined ? { salePrice: input.salePrice } : {}),
        ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
        ...(input.maxStock !== undefined ? { maxStock: input.maxStock } : {}),
      },
      include: {
        product: { select: { id: true, name: true, unit: true } },
        stocks: true,
      },
    });
  }

  async deleteVariant(variantId: string) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) {
      throw new AppError(404, 'Variante no encontrada.', 'VariantNotFound');
    }

    const siblings = await prisma.productVariant.count({
      where: { productId: variant.productId },
    });
    if (siblings <= 1) {
      throw new AppError(
        400,
        'Todo producto debe conservar al menos una variante/SKU.',
        'LastVariantProtection'
      );
    }

    const movementsCount = await prisma.inventoryMovement.count({
      where: { variantId },
    });
    if (movementsCount > 0) {
      throw new AppError(
        400,
        'No se puede eliminar una variante con movimientos registrados en el Kardex.',
        'VariantHasMovements'
      );
    }

    await prisma.productVariant.delete({ where: { id: variantId } });
    return { deleted: true, id: variantId };
  }

  /**
   * Búsqueda rápida para pistola lectora USB por código de barras exacto o SKU.
   */
  async findVariantByCode(code: string, warehouseId?: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      throw new AppError(400, 'Debe proporcionar un código de barras o SKU.', 'EmptyCode');
    }

    const variant = await prisma.productVariant.findFirst({
      where: {
        OR: [{ barcode: trimmed }, { sku: trimmed }],
        product: { isActive: true },
      },
      include: {
        product: {
          include: { category: true },
        },
        stocks: {
          ...(warehouseId ? { where: { warehouseId } } : {}),
          include: {
            warehouse: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!variant) {
      throw new AppError(404, `No se encontró ningún producto con el código "${trimmed}".`, 'VariantNotFound');
    }

    return variant;
  }

  /**
   * Genera un código EAN-13 interno garantizando que no exista aún en la BD.
   */
  async generateUniqueBarcode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateInternalEan13('200');
      const exists = await prisma.productVariant.findUnique({
        where: { barcode: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }

    throw new AppError(500, 'No fue posible generar un código de barras único.', 'BarcodeGenerationError');
  }
}

export const catalogService = new CatalogService();
