import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type MovementType = 'IN' | 'OUT' | 'ADJUST';

interface RegisterMovementInput {
  variantId: string;
  warehouseId: string;
  userId: string;
  type: MovementType;
  quantity: number; // Cantidad del movimiento (o nuevo conteo físico si es ADJUST)
  unitCost?: number;
  reason?: string;
  referenceDoc?: string;
  notes?: string;
}

export class InventoryService {
  /**
   * Registra un movimiento en el Kardex y actualiza el stock de forma atómica.
   */
  async registerMovement(data: RegisterMovementInput) {
    if (data.quantity < 0) {
      throw new Error('La cantidad no puede ser negativa.');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Obtener o inicializar el nivel de stock actual en ese almacén
      let stockRecord = await tx.stockLevel.findUnique({
        where: {
          variantId_warehouseId: {
            variantId: data.variantId,
            warehouseId: data.warehouseId,
          },
        },
      });

      if (!stockRecord) {
        stockRecord = await tx.stockLevel.create({
          data: {
            variantId: data.variantId,
            warehouseId: data.warehouseId,
            quantity: 0,
          },
        });
      }

      const previousStock = stockRecord.quantity;
      let newStock = previousStock;
      let movementQty = data.quantity;

      // 2. Calcular el nuevo stock según el tipo de operación
      if (data.type === 'IN') {
        newStock = previousStock + data.quantity;
      } else if (data.type === 'OUT') {
        if (previousStock < data.quantity) {
          throw new Error(`Stock insuficiente. Disponible: ${previousStock}`);
        }
        newStock = previousStock - data.quantity;
      } else if (data.type === 'ADJUST') {
        // En ajuste por conteo físico, data.quantity es el stock real contado
        newStock = data.quantity;
        movementQty = Math.abs(newStock - previousStock);
      }

      // 3. Actualizar existencia actual
      await tx.stockLevel.update({
        where: { id: stockRecord.id },
        data: { quantity: newStock },
      });

      // 4. Registrar el asiento inmutable en el Kardex
      const movement = await tx.inventoryMovement.create({
        data: {
          type: data.type,
          reason: data.reason,
          quantity: movementQty,
          previousStock,
          newStock,
          unitCost: data.unitCost ?? 0,
          referenceDoc: data.referenceDoc,
          notes: data.notes,
          variantId: data.variantId,
          warehouseId: data.warehouseId,
          userId: data.userId,
        },
      });

      return { movement, newStock };
    });
  }
}
