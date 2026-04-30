import { Request, Response } from 'express';
import * as trashService from '../services/trash.service';

export async function moveToTrash(req: Request, res: Response) {
  try {
    const { assetIds } = req.body;
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ error: 'Invalid asset IDs' });
    }

    const result = await trashService.moveToTrash(((req as any).user).userId, assetIds);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function restoreFromTrash(req: Request, res: Response) {
  try {
    const { assetIds } = req.body;
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ error: 'Invalid asset IDs' });
    }

    const result = await trashService.restoreFromTrash(((req as any).user).userId, assetIds);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function permanentlyDeleteAssets(req: Request, res: Response) {
  try {
    const { assetIds } = req.body;
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ error: 'Invalid asset IDs' });
    }

    const result = await trashService.permanentlyDeleteAssets(((req as any).user).userId, assetIds);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function emptyTrash(req: Request, res: Response) {
  try {
    const result = await trashService.emptyTrash(((req as any).user).userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getTrashContents(req: Request, res: Response) {
  try {
    const { status, fileType, search } = req.query as any;
    const result = await trashService.getTrashContents(((req as any).user).userId, {
      status,
      fileType,
      search,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
