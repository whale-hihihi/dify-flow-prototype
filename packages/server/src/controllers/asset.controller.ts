import { Request, Response } from 'express';
import path from 'path';
import * as assetService from '../services/asset.service';

export async function uploadAssets(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    const folderId = req.body.folderId || undefined;
    const results = await assetService.uploadAssets(((req as any).user).userId, files, folderId);
    res.status(201).json(results);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function listAssets(req: Request, res: Response) {
  try {
    const { folderId, status, fileType, search, page, pageSize } = req.query as any;
    const result = await assetService.listAssets(((req as any).user).userId, {
      folderId,
      status,
      fileType,
      search,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getAsset(req: Request, res: Response) {
  try {
    const asset = await assetService.getAsset(((req as any).user).userId, req.params.id);
    res.json(asset);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
}

export async function downloadAsset(req: Request, res: Response) {
  try {
    const { filePath, originalName } = await assetService.getAssetFilePath(((req as any).user).userId, req.params.id);
    res.download(filePath, originalName);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
}

export async function updateAsset(req: Request, res: Response) {
  try {
    const { folderId } = req.body;
    const asset = await assetService.moveAsset(((req as any).user).userId, req.params.id, folderId ?? null);
    res.json(asset);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteAsset(req: Request, res: Response) {
  try {
    await assetService.deleteAsset(((req as any).user).userId, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
