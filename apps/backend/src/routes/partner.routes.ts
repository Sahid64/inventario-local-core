import { Router } from 'express';
import { partnerController } from '../controllers/partner.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', (req, res, next) => partnerController.list(req, res, next));
router.get('/:id', (req, res, next) => partnerController.getById(req, res, next));
router.post('/', (req, res, next) => partnerController.create(req, res, next));
router.patch('/:id', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  partnerController.update(req, res, next)
);
router.delete('/:id', authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  partnerController.delete(req, res, next)
);

export default router;
