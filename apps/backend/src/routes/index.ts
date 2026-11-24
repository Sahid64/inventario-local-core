import { Router } from 'express';
import authRoutes from './auth.routes';
import catalogRoutes from './catalog.routes';
import inventoryRoutes from './inventory.routes';
import partnerRoutes from './partner.routes';
import reportRoutes from './report.routes';
import settingsRoutes from './settings.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/catalog', catalogRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/partners', partnerRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingsRoutes);

export default router;
