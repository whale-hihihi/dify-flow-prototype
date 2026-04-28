import { Router } from 'express';
import {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
} from '../controllers/folder.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', listFolders);
router.post('/', createFolder);
router.put('/:id', renameFolder);
router.delete('/:id', deleteFolder);

export default router;
