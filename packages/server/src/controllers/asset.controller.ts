import { Request, Response } from 'express';
import path from 'path';
import * as assetService from '../services/asset.service';
import * as duplicateCheckService from '../services/duplicate-check.service';
import { getFileTypeFromMimeType } from '../services/duplicate-check.service';

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
    const { folderId, status, fileType, search, page, pageSize, includeDeleted } = req.query as any;
    const result = await assetService.listAssets(((req as any).user).userId, {
      folderId,
      status,
      fileType,
      search,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      includeDeleted: includeDeleted === 'true',
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

export async function moveToFolder(req: Request, res: Response) {
  try {
    const { folderId } = req.body;
    const asset = await assetService.moveAsset(((req as any).user).userId, req.params.id, folderId ?? null);
    res.json(asset);
  } catch (err: any) {
    // 尝试解析错误信息，如果是重复文件错误，返回特殊格式
    try {
      const errorData = JSON.parse(err.message);
      if (errorData.code === 'DUPLICATE_FILE') {
        return res.status(409).json(errorData);
      }
    } catch (parseError) {
      // 不是JSON格式，返回普通错误
    }
    res.status(400).json({ error: err.message });
  }
}

export async function moveToFolderWithOverride(req: Request, res: Response) {
  try {
    const { folderId } = req.body;
    if (!folderId) {
      return res.status(400).json({ error: 'folderId is required for override operation' });
    }
    const asset = await assetService.moveAssetWithOverride(((req as any).user).userId, req.params.id, folderId);
    res.json(asset);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function copyToFolder(req: Request, res: Response) {
  try {
    const { folderId } = req.body;
    const asset = await assetService.copyAsset(((req as any).user).userId, req.params.id, folderId ?? null);
    res.json(asset);
  } catch (err: any) {
    // 尝试解析错误信息，如果是重复文件错误，返回特殊格式
    try {
      const errorData = JSON.parse(err.message);
      if (errorData.code === 'DUPLICATE_FILE') {
        return res.status(409).json(errorData);
      }
    } catch (parseError) {
      // 不是JSON格式，返回普通错误
    }
    res.status(400).json({ error: err.message });
  }
}

export async function copyToFolderWithOverride(req: Request, res: Response) {
  try {
    const { folderId } = req.body;
    if (!folderId) {
      return res.status(400).json({ error: 'folderId is required for override operation' });
    }
    const asset = await assetService.copyAssetWithOverride(((req as any).user).userId, req.params.id, folderId);
    res.json(asset);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getAssetFolders(req: Request, res: Response) {
  try {
    const folders = await assetService.getAssetFolders(((req as any).user).userId, req.params.id);
    res.json(folders);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function addToFolder(req: Request, res: Response) {
  try {
    const { folderId } = req.body;
    const result = await assetService.addToFolder(((req as any).user).userId, req.params.id, folderId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function removeFromFolder(req: Request, res: Response) {
  try {
    const { folderId } = req.body;
    const result = await assetService.removeFromFolder(((req as any).user).userId, req.params.id, folderId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteAssetFolder(req: Request, res: Response) {
  try {
    const result = await assetService.deleteAssetFolder(((req as any).user).userId, req.params.id);
    res.json({ success: true, data: result });
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

export async function checkBatchDuplicateFiles(req: Request, res: Response) {
  try {
    const { assetIds, targetFolderId } = req.body;
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ error: 'assetIds must be a non-empty array' });
    }
    if (!targetFolderId) {
      return res.status(400).json({ error: 'targetFolderId is required' });
    }
    const result = await assetService.checkBatchDuplicateFiles(
      ((req as any).user).userId,
      assetIds,
      targetFolderId
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function checkUploadDuplicates(req: Request, res: Response) {
  try {
    // 从请求体中获取文件元数据列表
    const { files: filesMetadata, folderId } = req.body;
    if (!Array.isArray(filesMetadata) || filesMetadata.length === 0) {
      return res.status(400).json({ error: 'files must be a non-empty array' });
    }

    // 将前端传来的文件元数据转换为 Multer.File 格式
    const files = filesMetadata.map((meta, index) => ({
      fieldname: 'file',
      originalname: meta.name,
      encoding: '7bit',
      mimetype: meta.type || 'application/octet-stream',
      size: meta.size || 0,
      destination: '',
      filename: `file-${index}-${meta.name}`,
      path: '', // 服务器端不需要实际路径
      stream: null as any,
      buffer: null as any,
      // 保留原始名称的引用
      originalName: meta.name,
      fileType: getFileTypeFromMimeType(meta.type || 'application/octet-stream'),
    }));

    const result = await duplicateCheckService.checkBatchUploadDuplicates(
      ((req as any).user).userId,
      files as any,
      folderId
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function confirmUploadFiles(req: Request, res: Response) {
  try {
    // 从请求体中获取文件元数据列表
    const { files: filesMetadata, folderId, overrideOptions } = req.body;
    if (!Array.isArray(filesMetadata) || filesMetadata.length === 0) {
      return res.status(400).json({ error: 'files must be a non-empty array' });
    }

    // 将前端传来的文件元数据转换为 Multer.File 格式
    const files = filesMetadata.map((meta, index) => ({
      fieldname: 'file',
      originalname: meta.name,
      encoding: '7bit',
      mimetype: meta.type || 'application/octet-stream',
      size: meta.size || 0,
      destination: '',
      filename: `file-${index}-${meta.name}`,
      path: '', // 服务器端不需要实际路径
      stream: null as any,
      buffer: null as any,
      // 保留原始名称的引用
      originalName: meta.name,
      fileType: getFileTypeFromMimeType(meta.type || 'application/octet-stream'),
    }));

    const result = await assetService.confirmUploadAssets(
      ((req as any).user).userId,
      files as any,
      folderId,
      overrideOptions
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
