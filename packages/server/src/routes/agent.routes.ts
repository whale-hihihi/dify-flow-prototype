import { Router } from 'express';
import {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  testAgentConnection,
  checkOnline,
  chatTest,
} from '../controllers/agent.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', listAgents);
router.get('/check-online', checkOnline);
router.get('/:id', getAgent);
router.post('/', createAgent);
router.put('/:id', updateAgent);
router.delete('/:id', deleteAgent);
router.post('/:id/test', testAgentConnection);
router.post('/:id/chat', chatTest);

export default router;
