import { Router } from 'express';
import authRoutes from './auth.routes';
import difyConfigRoutes from './dify-config.routes';
import agentRoutes from './agent.routes';
import assetRoutes from './asset.routes';
import folderRoutes from './folder.routes';
import searchRoutes from './search.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dify-config', difyConfigRoutes);
router.use('/agents', agentRoutes);
router.use('/assets', assetRoutes);
router.use('/folders', folderRoutes);
router.use('/search', searchRoutes);

export default router;
