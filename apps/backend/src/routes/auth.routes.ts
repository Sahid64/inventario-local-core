import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', (req, res, next) => authController.login(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.me(req, res, next));

router.get('/users', authenticate, authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  authController.listUsers(req, res, next)
);
router.post('/users', authenticate, authorize('ADMIN'), (req, res, next) =>
  authController.createUser(req, res, next)
);
router.patch('/users/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  authController.updateUser(req, res, next)
);
router.delete('/users/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  authController.deleteUser(req, res, next)
);

export default router;
