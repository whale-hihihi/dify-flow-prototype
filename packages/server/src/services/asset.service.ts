import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { FILE_TYPE_MAP } from '../config/constants';
import { enqueueParseJob } from '../workers/parse-worker';

/**
 * 统一文件路径为正斜杠，确保 Windows/Linux 跨平台兼容
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

export async function uploadAssets(
  userId: string,
  files: Express.Multer.File[],
  folderId?: string
) {
  const results = [];

  for (const file of files) {
    const fileType = FILE_TYPE_MAP[file.mimetype];
    if (!fileType) continue;

    // 统一存储正斜杠路径，跨平台兼容
    const normalizedPath = normalizePath(file.path);

    const asset = await prisma.asset.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        fileType,
        fileSize: file.size,
        filePath: normalizedPath,
        status: 'uploading',
        folderId: folderId || null,
        userId,
      },
    });

    // Enqueue parsing job（用原始路径，本地文件系统操作需要原生分隔符）
    enqueueParseJob(asset.id, file.path, fileType, userId);

    results.push(asset);
  }

  return results;
}

export async function listAssets(
  userId: string,
  filters: {
    folderId?: string;
    status?: string;
    fileType?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const skip = (page - 1) * pageSize;

  const where: any = { userId };

  if (filters.folderId) {
    where.folderId = filters.folderId;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.fileType) {
    where.fileType = filters.fileType;
  }
  if (filters.search) {
    where.originalName = { contains: filters.search, mode: 'insensitive' };
  }

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        filename: true,
        originalName: true,
        fileType: true,
        fileSize: true,
        status: true,
        folderId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.asset.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getAsset(userId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw new Error('Asset not found');
  return asset;
}

export async function deleteAsset(userId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw new Error('Asset not found');

  if (asset.filePath) {
    const diskPath = path.resolve(asset.filePath);
    if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
      fs.unlinkSync(diskPath);
    }
  }

  return prisma.asset.delete({ where: { id: assetId } });
}

export async function moveAsset(userId: string, assetId: string, folderId: string | null) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw new Error('Asset not found');

  return prisma.asset.update({
    where: { id: assetId },
    data: { folderId },
  });
}

export async function getAssetFilePath(userId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw new Error('Asset not found');
  return { filePath: path.resolve(asset.filePath), originalName: asset.originalName };
}
