import { Router } from 'express';
import { searchAssets } from '../controllers/search.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', searchAssets);

export default router;
