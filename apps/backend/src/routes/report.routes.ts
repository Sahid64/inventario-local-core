import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/dashboard', (req, res, next) => reportController.dashboard(req, res, next));
router.get('/stock', (req, res, next) => reportController.stock(req, res, next));
router.get('/stock/export', (req, res, next) => reportController.exportStockCsv(req, res, next));
router.get('/movements/export', (req, res, next) =>
  reportController.exportMovementsCsv(req, res, next)
);

export default router;
