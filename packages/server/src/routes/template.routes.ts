import { Router } from 'express';
import { getTemplates } from '../controllers/template.controller';

const router = Router();
router.get('/', getTemplates);
export default router;
