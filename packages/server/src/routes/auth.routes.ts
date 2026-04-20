import { Router } from 'express';
import { login, getMe, updateProfile, listUsers, createUser, updateUserRole, deleteUser, resetPassword } from '../controllers/auth.controller';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, updateProfile);

// Admin-only: team management
router.get('/users', authMiddleware, requireRole('admin'), listUsers);
router.post('/users', authMiddleware, requireRole('admin'), createUser);
router.put('/users/:id/role', authMiddleware, requireRole('admin'), updateUserRole);
router.delete('/users/:id', authMiddleware, requireRole('admin'), deleteUser);
router.put('/users/:id/password', authMiddleware, requireRole('admin'), resetPassword);

export default router;
