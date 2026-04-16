import { Router } from 'express';
import { getConfig, upsertConfig, testConnection } from '../controllers/dify-config.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getConfig);
router.put('/', upsertConfig);
router.post('/test', testConnection);

export default router;
