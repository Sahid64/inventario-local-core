import { prisma } from '../config/db';

export interface StockReportFilter {
  warehouseId?: string;
  categoryId?: string;
  lowStockOnly?: boolean;
  search?: string;
}

export interface MovementsReportFilter {
  warehouseId?: string;
  variantId?: string;
  type?: string;
  fromDate?: string;
  toDate?: string;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  // BOM UTF-8 para compatibilidad directa con Excel en Windows
  return `\uFEFF${lines.join('\r\n')}`;
}

export class ReportService {
  /**
   * Calcula KPIs principales para el Dashboard: valorización a costo y venta,
   * alertas de stock bajo, resumen por almacén, mayor rotación y últimos movimientos.
   */
  async getDashboardKpis(warehouseId?: string) {
    const [activeProducts, activeVariants, warehouses, stockLevels, recentMovements] =
      await Promise.all([
        prisma.product.count({ where: { isActive: true } }),
        prisma.productVariant.count({ where: { product: { isActive: true } } }),
        prisma.warehouse.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
        prisma.stockLevel.findMany({
          where: {
            ...(warehouseId ? { warehouseId } : {}),
            variant: { product: { isActive: true } },
          },
          include: {
            warehouse: { select: { id: true, name: true } },
            variant: {
              include: {
                product: { select: { id: true, name: true, unit: true } },
              },
            },
          },
        }),
        prisma.inventoryMovement.findMany({
          where: warehouseId ? { warehouseId } : undefined,
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                product: { select: { id: true, name: true, unit: true } },
              },
            },
            warehouse: { select: { id: true, name: true } },
            user: { select: { id: true, username: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

    let totalUnits = 0;
    let totalCostValue = 0;
    let totalSaleValue = 0;

    const warehouseSummaryMap = new Map<
      string,
      {
        warehouseId: string;
        warehouseName: string;
        location: string | null;
        totalUnits: number;
        costValue: number;
        saleValue: number;
        lowStockCount: number;
      }
    >();

    for (const wh of warehouses) {
      if (warehouseId && wh.id !== warehouseId) continue;
      warehouseSummaryMap.set(wh.id, {
        warehouseId: wh.id,
        warehouseName: wh.name,
        location: wh.location,
        totalUnits: 0,
        costValue: 0,
        saleValue: 0,
        lowStockCount: 0,
      });
    }

    const lowStockAlerts: Array<{
      variantId: string;
      sku: string;
      productName: string;
      unit: string;
      warehouseId: string;
      warehouseName: string;
      quantity: number;
      minStock: number;
      deficit: number;
    }> = [];

    for (const level of stockLevels) {
      const qty = level.quantity;
      const costVal = qty * level.variant.costPrice;
      const saleVal = qty * level.variant.salePrice;

      totalUnits += qty;
      totalCostValue += costVal;
      totalSaleValue += saleVal;

      const whSummary = warehouseSummaryMap.get(level.warehouseId);
      if (whSummary) {
        whSummary.totalUnits += qty;
        whSummary.costValue += costVal;
        whSummary.saleValue += saleVal;
      }

      if (qty <= level.variant.minStock) {
        if (whSummary) whSummary.lowStockCount += 1;
        lowStockAlerts.push({
          variantId: level.variantId,
          sku: level.variant.sku,
          productName: level.variant.product.name,
          unit: level.variant.product.unit,
          warehouseId: level.warehouseId,
          warehouseName: level.warehouse.name,
          quantity: qty,
          minStock: level.variant.minStock,
          deficit: Math.max(0, level.variant.minStock - qty),
        });
      }
    }

    // También alertar variantes activas sin registro en StockLevel (stock = 0) cuando minStock > 0
    if (warehouses.length > 0) {
      const targetWarehouses = warehouseId
        ? warehouses.filter((w) => w.id === warehouseId)
        : [warehouses.find((w) => w.isDefault) ?? warehouses[0]];

      const existingKeys = new Set(stockLevels.map((s) => `${s.variantId}:${s.warehouseId}`));
      const variantsWithMin = await prisma.productVariant.findMany({
        where: {
          minStock: { gt: 0 },
          product: { isActive: true },
        },
        include: {
          product: { select: { name: true, unit: true } },
        },
      });

      for (const wh of targetWarehouses) {
        for (const variant of variantsWithMin) {
          const key = `${variant.id}:${wh.id}`;
          if (!existingKeys.has(key)) {
            const whSummary = warehouseSummaryMap.get(wh.id);
            if (whSummary) whSummary.lowStockCount += 1;
            lowStockAlerts.push({
              variantId: variant.id,
              sku: variant.sku,
              productName: variant.product.name,
              unit: variant.product.unit,
              warehouseId: wh.id,
              warehouseName: wh.name,
              quantity: 0,
              minStock: variant.minStock,
              deficit: variant.minStock,
            });
          }
        }
      }
    }

    lowStockAlerts.sort((a, b) => b.deficit - a.deficit);

    // Productos con mayor rotación (salidas en los últimos 30 días)
    const since30Days = new Date();
    since30Days.setDate(since30Days.getDate() - 30);

    const outMovements = await prisma.inventoryMovement.groupBy({
      by: ['variantId'],
      where: {
        type: 'OUT',
        createdAt: { gte: since30Days },
        ...(warehouseId ? { warehouseId } : {}),
      },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 8,
    });

    const topVariantIds = outMovements.map((m) => m.variantId);
    const topVariantDetails = topVariantIds.length
      ? await prisma.productVariant.findMany({
          where: { id: { in: topVariantIds } },
          include: { product: { select: { name: true, unit: true } } },
        })
      : [];
    const topVariantMap = new Map(topVariantDetails.map((v) => [v.id, v]));

    const topRotating = outMovements.map((m) => {
      const detail = topVariantMap.get(m.variantId);
      return {
        variantId: m.variantId,
        sku: detail?.sku ?? 'N/A',
        productName: detail?.product.name ?? 'Desconocido',
        unit: detail?.product.unit ?? 'PZA',
        totalOutQuantity: m._sum.quantity ?? 0,
        movementsCount: m._count.id,
      };
    });

    return {
      summary: {
        activeProducts,
        activeVariants,
        totalUnits: Number(totalUnits.toFixed(2)),
        totalCostValue: Number(totalCostValue.toFixed(2)),
        totalSaleValue: Number(totalSaleValue.toFixed(2)),
        potentialMargin: Number((totalSaleValue - totalCostValue).toFixed(2)),
        lowStockCount: lowStockAlerts.length,
      },
      lowStockAlerts: lowStockAlerts.slice(0, 25),
      warehouseSummary: Array.from(warehouseSummaryMap.values()).map((w) => ({
        ...w,
        totalUnits: Number(w.totalUnits.toFixed(2)),
        costValue: Number(w.costValue.toFixed(2)),
        saleValue: Number(w.saleValue.toFixed(2)),
      })),
      topRotating,
      recentMovements,
    };
  }

  /**
   * Reporte detallado de existencias valorizadas.
   */
  async getStockReport(filters: StockReportFilter = {}) {
    const search = filters.search?.trim();

    const rows = await prisma.stockLevel.findMany({
      where: {
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        variant: {
          product: {
            isActive: true,
            ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
          },
          ...(search
            ? {
                OR: [
                  { sku: { contains: search } },
                  { barcode: { contains: search } },
                  { product: { name: { contains: search } } },
                ],
              }
            : {}),
        },
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        variant: {
          include: {
            product: {
              include: { category: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: [{ warehouse: { name: 'asc' } }, { variant: { sku: 'asc' } }],
    });

    const mapped = rows.map((row) => ({
      stockLevelId: row.id,
      warehouseId: row.warehouse.id,
      warehouseName: row.warehouse.name,
      variantId: row.variant.id,
      sku: row.variant.sku,
      barcode: row.variant.barcode,
      productName: row.variant.product.name,
      categoryName: row.variant.product.category?.name ?? 'Sin categoría',
      unit: row.variant.product.unit,
      quantity: row.quantity,
      minStock: row.variant.minStock,
      maxStock: row.variant.maxStock,
      costPrice: row.variant.costPrice,
      salePrice: row.variant.salePrice,
      costValuation: Number((row.quantity * row.variant.costPrice).toFixed(2)),
      saleValuation: Number((row.quantity * row.variant.salePrice).toFixed(2)),
      isLowStock: row.quantity <= row.variant.minStock,
    }));

    return filters.lowStockOnly ? mapped.filter((item) => item.isLowStock) : mapped;
  }

  async exportStockCsv(filters: StockReportFilter = {}): Promise<string> {
    const data = await this.getStockReport(filters);
    const headers = [
      'Almacén',
      'SKU',
      'Código de Barras',
      'Producto',
      'Categoría',
      'Unidad',
      'Existencia',
      'Stock Mínimo',
      'Costo Unitario',
      'Precio Venta',
      'Valorización Costo',
      'Valorización Venta',
      'Estado',
    ];

    const rows = data.map((item) => [
      item.warehouseName,
      item.sku,
      item.barcode ?? '',
      item.productName,
      item.categoryName,
      item.unit,
      item.quantity,
      item.minStock,
      item.costPrice,
      item.salePrice,
      item.costValuation,
      item.saleValuation,
      item.isLowStock ? 'STOCK BAJO' : 'OK',
    ]);

    return buildCsv(headers, rows);
  }

  async exportMovementsCsv(filters: MovementsReportFilter = {}): Promise<string> {
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        ...(filters.variantId ? { variantId: filters.variantId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.fromDate || filters.toDate
          ? {
              createdAt: {
                ...(filters.fromDate ? { gte: new Date(filters.fromDate) } : {}),
                ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
              },
            }
          : {}),
      },
      include: {
        variant: {
          include: {
            product: { select: { name: true, unit: true } },
          },
        },
        warehouse: { select: { name: true } },
        user: { select: { username: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const headers = [
      'Fecha',
      'Tipo',
      'Almacén',
      'SKU',
      'Producto',
      'Cantidad',
      'Stock Anterior',
      'Stock Nuevo',
      'Costo Unitario',
      'Motivo',
      'Referencia',
      'Usuario',
      'Notas',
    ];

    const rows = movements.map((m) => [
      m.createdAt.toISOString(),
      m.type,
      m.warehouse.name,
      m.variant.sku,
      m.variant.product.name,
      m.quantity,
      m.previousStock,
      m.newStock,
      m.unitCost,
      m.reason ?? '',
      m.referenceDoc ?? '',
      m.user.fullName,
      m.notes ?? '',
    ]);

    return buildCsv(headers, rows);
  }
}

export const reportService = new ReportService();
