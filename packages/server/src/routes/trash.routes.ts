import { Router } from 'express';
import * as trashController from '../controllers/trash.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// 移动文件到回收站
router.post('/move-to-trash', trashController.moveToTrash);

// 从回收站恢复文件
router.post('/restore', trashController.restoreFromTrash);

// 永久删除文件
router.post('/permanent-delete', trashController.permanentlyDeleteAssets);

// 清空回收站
router.post('/empty', trashController.emptyTrash);

// 获取回收站内容
router.get('/', trashController.getTrashContents);

export default router;
