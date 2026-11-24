import { Router } from 'express';
import { inventoryController } from '../controllers/inventory.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Movimientos y Kardex
router.get('/movements', (req, res, next) => inventoryController.listMovements(req, res, next));
router.post('/movements', (req, res, next) => inventoryController.registerMovement(req, res, next));
router.post('/transfers', (req, res, next) => inventoryController.transferStock(req, res, next));

// Almacenes
router.get('/warehouses', (req, res, next) => inventoryController.listWarehouses(req, res, next));
router.post('/warehouses', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  inventoryController.createWarehouse(req, res, next)
);
router.patch('/warehouses/:id', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  inventoryController.updateWarehouse(req, res, next)
);
router.delete('/warehouses/:id', authorize('ADMIN'), (req, res, next) =>
  inventoryController.deleteWarehouse(req, res, next)
);

export default router;
