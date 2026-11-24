import { Router } from 'express';
import { catalogController } from '../controllers/catalog.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Categorías
router.get('/categories', (req, res, next) => catalogController.listCategories(req, res, next));
router.post('/categories', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  catalogController.createCategory(req, res, next)
);
router.patch('/categories/:id', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  catalogController.updateCategory(req, res, next)
);
router.delete('/categories/:id', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  catalogController.deleteCategory(req, res, next)
);

// Productos
router.get('/products', (req, res, next) => catalogController.listProducts(req, res, next));
router.get('/products/:id', (req, res, next) => catalogController.getProductById(req, res, next));
router.post('/products', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  catalogController.createProduct(req, res, next)
);
router.patch('/products/:id', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  catalogController.updateProduct(req, res, next)
);
router.delete('/products/:id', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  catalogController.deleteProduct(req, res, next)
);

// Variantes / SKUs
router.post('/products/:id/variants', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  catalogController.addVariant(req, res, next)
);
router.patch('/variants/:variantId', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  catalogController.updateVariant(req, res, next)
);
router.delete('/variants/:variantId', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  catalogController.deleteVariant(req, res, next)
);

// Escaneo rápido y generador EAN-13
router.get('/scan/:code', (req, res, next) => catalogController.scanCode(req, res, next));
router.get('/barcode/generate', (req, res, next) =>
  catalogController.generateBarcode(req, res, next)
);

export default router;
