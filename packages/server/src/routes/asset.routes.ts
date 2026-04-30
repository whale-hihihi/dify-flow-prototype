import { Router } from 'express';
import {
  uploadAssets,
  listAssets,
  getAsset,
  downloadAsset,
  updateAsset,
  deleteAsset,
  moveToFolder,
  moveToFolderWithOverride,
  copyToFolder,
  copyToFolderWithOverride,
  getAssetFolders,
  addToFolder,
  removeFromFolder,
  deleteAssetFolder,
  checkBatchDuplicateFiles,
  checkUploadDuplicates,
  confirmUploadFiles,
} from '../controllers/asset.controller';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authMiddleware);

router.post('/upload', upload.array('files', 20), uploadAssets);
router.post('/check-upload-duplicates', checkUploadDuplicates);
router.post('/confirm-upload', confirmUploadFiles);
router.get('/', listAssets);
router.get('/:id', getAsset);
router.get('/:id/download', downloadAsset);
router.get('/:id/folders', getAssetFolders);
router.put('/:id', updateAsset);
router.post('/:id/move', moveToFolder);
router.post('/:id/move-override', moveToFolderWithOverride);
router.post('/:id/copy', copyToFolder);
router.post('/:id/copy-override', copyToFolderWithOverride);
router.post('/:id/add-to-folder', addToFolder);
router.delete('/:id/remove-from-folder', removeFromFolder);
router.delete('/asset-folder/:id', deleteAssetFolder);
router.delete('/:id', deleteAsset);
router.post('/check-batch-duplicates', checkBatchDuplicateFiles);

export default router;
