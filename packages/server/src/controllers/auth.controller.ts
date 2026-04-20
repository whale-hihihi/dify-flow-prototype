import { Request, Response } from 'express';
import * as authService from '../services/auth.service';

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    res.json(await authService.login(username, password));
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    res.json(await authService.getUser((req as any).user.userId));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    res.json(await authService.updateUser((req as any).user.userId, req.body));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function listUsers(req: Request, res: Response) {
  try {
    res.json(await authService.listUsers());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Missing required fields' });
    res.status(201).json(await authService.createUser({ username, email, password, role: role || 'member' }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateUserRole(req: Request, res: Response) {
  try {
    res.json(await authService.updateUserRole(req.params.id, req.body.role));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    await authService.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'New password is required' });
    await authService.resetUserPassword(req.params.id, newPassword);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
