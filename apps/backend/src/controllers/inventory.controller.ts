import {
  createWarehouseSchema,
  movementQuerySchema,
  registerMovementSchema,
  transferStockSchema,
  updateWarehouseSchema,
} from '@inventario-local/shared/schemas';
import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middlewares/error.middleware';
import { InventoryService } from '../services/inventory.service';

const inventoryService = new InventoryService();

export class InventoryController {
  /**
   * Registra un movimiento IN, OUT o ADJUST usando el motor transaccional de InventoryService.
   * Restringe ADJUST únicamente a ADMIN y MANAGER.
   */
  async registerMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = registerMovementSchema.parse(req.body);

      if (input.type === 'ADJUST' && req.user!.role === 'OPERATOR') {
        throw new AppError(
          403,
          'Solo administradores o encargados pueden realizar ajustes de inventario.',
          'Forbidden'
        );
      }

      try {
        const result = await inventoryService.registerMovement({
          variantId: input.variantId,
          warehouseId: input.warehouseId,
          userId: req.user!.id,
          type: input.type,
          quantity: input.quantity,
          unitCost: input.unitCost,
          reason: input.reason,
          referenceDoc: input.referenceDoc,
          notes: input.notes,
        });

        res.status(201).json(result);
      } catch (err) {
        if (err instanceof Error && (err.message.includes('Stock insuficiente') || err.message.includes('negativa'))) {
          throw new AppError(400, err.message, 'InventoryBusinessRuleError');
        }
        throw err;
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Consulta paginada del historial Kardex con filtros.
   */
  async listMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = movementQuerySchema.parse(req.query);
      const where = {
        ...(query.variantId ? { variantId: query.variantId } : {}),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.fromDate || query.toDate
          ? {
              createdAt: {
                ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
                ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
              },
            }
          : {}),
      };

      const [data, total] = await Promise.all([
        prisma.inventoryMovement.findMany({
          where,
          include: {
            variant: {
              include: {
                product: { select: { id: true, name: true, unit: true } },
              },
            },
            warehouse: { select: { id: true, name: true } },
            user: { select: { id: true, username: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.inventoryMovement.count({ where }),
      ]);

      res.status(200).json({
        data,
        total,
        page: query.page,
        limit: query.limit,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Traspaso atómico entre dos almacenes con doble asiento inmutable tipo TRANSFER en el Kardex.
   */
  async transferStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = transferStockSchema.parse(req.body);

      const result = await prisma.$transaction(async (tx) => {
        const [fromWh, toWh, variant] = await Promise.all([
          tx.warehouse.findUnique({ where: { id: input.fromWarehouseId } }),
          tx.warehouse.findUnique({ where: { id: input.toWarehouseId } }),
          tx.productVariant.findUnique({ where: { id: input.variantId } }),
        ]);

        if (!fromWh || !toWh) {
          throw new AppError(404, 'Almacén origen o destino no encontrado.', 'WarehouseNotFound');
        }
        if (!variant) {
          throw new AppError(404, 'Variante/SKU no encontrada.', 'VariantNotFound');
        }

        const sourceStock = await tx.stockLevel.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: input.variantId,
              warehouseId: input.fromWarehouseId,
            },
          },
        });

        const sourcePrevious = sourceStock?.quantity ?? 0;
        if (sourcePrevious < input.quantity) {
          throw new AppError(
            400,
            `Stock insuficiente en ${fromWh.name}. Disponible: ${sourcePrevious}`,
            'InsufficientStock'
          );
        }

        const sourceNew = sourcePrevious - input.quantity;
        await tx.stockLevel.update({
          where: { id: sourceStock!.id },
          data: { quantity: sourceNew },
        });

        let destStock = await tx.stockLevel.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: input.variantId,
              warehouseId: input.toWarehouseId,
            },
          },
        });

        if (!destStock) {
          destStock = await tx.stockLevel.create({
            data: {
              variantId: input.variantId,
              warehouseId: input.toWarehouseId,
              quantity: 0,
            },
          });
        }

        const destPrevious = destStock.quantity;
        const destNew = destPrevious + input.quantity;

        await tx.stockLevel.update({
          where: { id: destStock.id },
          data: { quantity: destNew },
        });

        const outMovement = await tx.inventoryMovement.create({
          data: {
            type: 'TRANSFER',
            reason: `Traspaso hacia ${toWh.name}`,
            quantity: input.quantity,
            previousStock: sourcePrevious,
            newStock: sourceNew,
            unitCost: variant.costPrice,
            referenceDoc: input.referenceDoc,
            notes: input.notes,
            variantId: input.variantId,
            warehouseId: input.fromWarehouseId,
            userId: req.user!.id,
          },
        });

        const inMovement = await tx.inventoryMovement.create({
          data: {
            type: 'TRANSFER',
            reason: `Traspaso desde ${fromWh.name}`,
            quantity: input.quantity,
            previousStock: destPrevious,
            newStock: destNew,
            unitCost: variant.costPrice,
            referenceDoc: input.referenceDoc,
            notes: input.notes,
            variantId: input.variantId,
            warehouseId: input.toWarehouseId,
            userId: req.user!.id,
          },
        });

        return {
          outMovement,
          inMovement,
          sourceNewStock: sourceNew,
          destNewStock: destNew,
        };
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================================================
  // Gestión de Almacenes
  // ==========================================================================

  async listWarehouses(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const warehouses = await prisma.warehouse.findMany({
        include: {
          _count: {
            select: { stocks: true, movements: true },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
      res.status(200).json(warehouses);
    } catch (error) {
      next(error);
    }
  }

  async createWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createWarehouseSchema.parse(req.body);

      const warehouse = await prisma.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.warehouse.updateMany({ data: { isDefault: false } });
        }

        return tx.warehouse.create({
          data: {
            name: input.name,
            location: input.location ?? null,
            isDefault: input.isDefault,
          },
        });
      });

      res.status(201).json(warehouse);
    } catch (error) {
      next(error);
    }
  }

  async updateWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateWarehouseSchema.parse(req.body);

      const warehouse = await prisma.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.warehouse.updateMany({
            where: { NOT: { id: req.params.id } },
            data: { isDefault: false },
          });
        }

        return tx.warehouse.update({
          where: { id: req.params.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.location !== undefined ? { location: input.location ?? null } : {}),
            ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          },
        });
      });

      res.status(200).json(warehouse);
    } catch (error) {
      next(error);
    }
  }

  async deleteWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: req.params.id },
      });
      if (!warehouse) {
        throw new AppError(404, 'Almacén no encontrado.', 'WarehouseNotFound');
      }

      if (warehouse.isDefault) {
        throw new AppError(
          400,
          'No puedes eliminar el almacén predeterminado. Marca otro como predeterminado primero.',
          'DefaultWarehouseProtection'
        );
      }

      const movementsCount = await prisma.inventoryMovement.count({
        where: { warehouseId: req.params.id },
      });
      if (movementsCount > 0) {
        throw new AppError(
          400,
          'No se puede eliminar un almacén que ya tiene movimientos registrados en el Kardex.',
          'WarehouseHasMovements'
        );
      }

      await prisma.warehouse.delete({ where: { id: req.params.id } });
      res.status(200).json({ deleted: true, id: req.params.id });
    } catch (error) {
      next(error);
    }
  }
}

export const inventoryController = new InventoryController();
