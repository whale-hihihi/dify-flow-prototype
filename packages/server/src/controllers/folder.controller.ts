import { Request, Response } from 'express';
import * as folderService from '../services/folder.service';

export async function listFolders(req: Request, res: Response) {
  try {
    const folders = await folderService.listFolders(((req as any).user).userId);
    res.json(folders);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function createFolder(req: Request, res: Response) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const folder = await folderService.createFolder(((req as any).user).userId, name);
    res.status(201).json(folder);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function renameFolder(req: Request, res: Response) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const folder = await folderService.renameFolder(((req as any).user).userId, req.params.id, name);
    res.json(folder);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteFolder(req: Request, res: Response) {
  try {
    await folderService.deleteFolder(((req as any).user).userId, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
