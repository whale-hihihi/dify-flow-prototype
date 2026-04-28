import { Router } from 'express';
import { createTask, listTasks, getTask, retryTask, cancelTask, deleteTask, toggleScheduled } from '../controllers/task.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', createTask);
router.get('/', listTasks);
router.get('/:id', getTask);
router.post('/:id/retry', retryTask);
router.post('/:id/cancel', cancelTask);
router.delete('/:id', deleteTask);
router.put('/:id/toggle', toggleScheduled);

export default router;
