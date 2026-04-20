import { Router } from 'express';
import {
  uploadAssets,
  listAssets,
  getAsset,
  downloadAsset,
  updateAsset,
  deleteAsset,
} from '../controllers/asset.controller';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authMiddleware);

router.post('/upload', upload.array('files', 20), uploadAssets);
router.get('/', listAssets);
router.get('/:id', getAsset);
router.get('/:id/download', downloadAsset);
router.put('/:id', updateAsset);
router.delete('/:id', deleteAsset);

export default router;
