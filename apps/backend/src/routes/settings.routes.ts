import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Lectura pública para aplicar marca blanca (logo, color, nombre) desde la pantalla de login
router.get('/', (req, res, next) => settingsController.getSettings(req, res, next));

// Modificaciones restringidas a ADMIN / MANAGER
router.patch('/', authenticate, authorize('ADMIN'), (req, res, next) =>
  settingsController.updateSettings(req, res, next)
);
router.post('/logo', authenticate, authorize('ADMIN'), (req, res, next) =>
  settingsController.uploadLogo(req, res, next)
);
router.post('/reset-demo', authenticate, authorize('ADMIN'), (req, res, next) =>
  settingsController.resetDemo(req, res, next)
);

// Respaldos SQLite
router.get('/backups', authenticate, authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  settingsController.listBackups(req, res, next)
);
router.post('/backups', authenticate, authorize('ADMIN', 'MANAGER'), (req, res, next) =>
  settingsController.createBackup(req, res, next)
);
router.post('/backups/restore', authenticate, authorize('ADMIN'), (req, res, next) =>
  settingsController.restoreBackup(req, res, next)
);

export default router;
