import { prisma } from '../config/database';
import fs from 'fs';
import path from 'path';

/**
 * 确保用户有回收站文件夹
 */
export async function ensureTrashFolder(userId: string) {
  const trashFolder = await prisma.folder.upsert({
    where: { userId_name: { userId, name: '回收站' } },
    update: {},
    create: {
      name: '回收站',
      isDefault: false,
      isTrash: true,
      userId,
    },
  });

  return trashFolder;
}

/**
 * 获取用户的回收站文件夹
 */
export async function getTrashFolder(userId: string) {
  const trashFolder = await prisma.folder.findFirst({
    where: {
      userId,
      name: '回收站',
      isTrash: true,
    },
  });

  return trashFolder;
}

/**
 * 移动文件到回收站
 */
export async function moveToTrash(userId: string, assetIds: string[]) {
  const trashFolder = await ensureTrashFolder(userId);

  // 获取要移动的文件及其原始文件夹信息
  const assets = await prisma.asset.findMany({
    where: {
      id: { in: assetIds },
      userId,
      deletedAt: null, // 只处理未删除的文件
    },
    include: {
      folders: true,
    },
  });

  if (assets.length === 0) {
    return { count: 0, message: '没有找到可移动的文件' };
  }

  const results = [];

  for (const asset of assets) {
    // 记录原始文件夹ID
    const originalFolderId = asset.folders.length > 0 ? asset.folders[0].folderId : null;

    // 移除文件与所有文件夹的关联
    await prisma.assetFolder.deleteMany({
      where: { assetId: asset.id },
    });

    // 将文件添加到回收站文件夹
    await prisma.assetFolder.create({
      data: {
        assetId: asset.id,
        folderId: trashFolder.id,
      },
    });

    // 更新文件信息
    const updatedAsset = await prisma.asset.update({
      where: { id: asset.id },
      data: {
        originalFolderId,
        deletedAt: new Date(),
        isPermanentlyDeleted: false,
      },
    });

    results.push(updatedAsset);
  }

  return {
    count: results.length,
    assets: results,
    message: `已将 ${results.length} 个文件移至回收站`,
  };
}

/**
 * 从回收站恢复文件
 */
export async function restoreFromTrash(userId: string, assetIds: string[]) {
  const results = [];

  for (const assetId of assetIds) {
    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        userId,
        deletedAt: { not: null },
        isPermanentlyDeleted: false,
      },
    });

    if (!asset) {
      continue;
    }

    // 从回收站文件夹中移除文件
    const trashFolder = await getTrashFolder(userId);
    if (trashFolder) {
      await prisma.assetFolder.deleteMany({
        where: {
          assetId,
          folderId: trashFolder.id,
        },
      });
    }

    // 尝试恢复到原始文件夹
    let targetFolderId = asset.originalFolderId;

    // 检查原始文件夹是否存在
    if (targetFolderId) {
      const originalFolder = await prisma.folder.findFirst({
        where: { id: targetFolderId },
      });

      if (!originalFolder) {
        // 原始文件夹不存在，移到"全部文件"
        const defaultFolder = await prisma.folder.findFirst({
          where: {
            userId,
            name: '全部文件',
            isDefault: true,
          },
        });
        targetFolderId = defaultFolder?.id || null;
      }
    }

    // 添加到目标文件夹
    if (targetFolderId) {
      await prisma.assetFolder.create({
        data: {
          assetId,
          folderId: targetFolderId,
        },
      });
    }

    // 更新文件信息
    const restoredAsset = await prisma.asset.update({
      where: { id: assetId },
      data: {
        deletedAt: null,
        isPermanentlyDeleted: false,
      },
    });

    results.push(restoredAsset);
  }

  return {
    count: results.length,
    assets: results,
    message: `已恢复 ${results.length} 个文件`,
  };
}

/**
 * 永久删除文件
 */
export async function permanentlyDeleteAssets(userId: string, assetIds: string[]) {
  let deletedCount = 0;

  for (const assetId of assetIds) {
    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        userId,
      },
    });

    if (!asset) continue;

    // 删除物理文件
    try {
      const filePath = path.join(process.cwd(), asset.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`删除文件失败: ${asset.filePath}`, error);
      // 继续删除数据库记录
    }

    // 删除数据库记录
    await prisma.taskItem.deleteMany({
      where: {
        OR: [
          { sourceAssetId: assetId },
          { resultAssetId: assetId },
        ],
      },
    });

    await prisma.assetFolder.deleteMany({
      where: { assetId },
    });

    await prisma.asset.delete({
      where: { id: assetId },
    });

    deletedCount++;
  }

  return {
    count: deletedCount,
    message: `已永久删除 ${deletedCount} 个文件`,
  };
}

/**
 * 清空回收站
 */
export async function emptyTrash(userId: string) {
  const trashFolder = await getTrashFolder(userId);

  if (!trashFolder) {
    return { count: 0, message: '回收站不存在' };
  }

  // 获取回收站中的所有文件
  const assetFolders = await prisma.assetFolder.findMany({
    where: { folderId: trashFolder.id },
    include: { asset: true },
  });

  const assetIds = assetFolders.map(af => af.assetId);

  if (assetIds.length === 0) {
    return { count: 0, message: '回收站为空' };
  }

  // 永久删除所有文件
  const result = await permanentlyDeleteAssets(userId, assetIds);

  return {
    ...result,
    message: `回收站已清空，${result.count} 个文件已永久删除`,
  };
}

/**
 * 获取回收站内容
 */
export async function getTrashContents(
  userId: string,
  filters?: {
    status?: string;
    fileType?: string | string[];
    search?: string;
  }
) {
  const trashFolder = await getTrashFolder(userId);

  if (!trashFolder) {
    return { items: [], total: 0, folder: null };
  }

  const where: any = { folderId: trashFolder.id };

  // 构建筛选条件
  const assetWhere: any = {
    userId,
    isPermanentlyDeleted: false,
  };

  if (filters?.status) {
    assetWhere.status = filters.status;
  }

  if (filters?.fileType) {
    if (Array.isArray(filters.fileType)) {
      assetWhere.fileType = { in: filters.fileType };
    } else {
      assetWhere.fileType = filters.fileType;
    }
  }

  if (filters?.search) {
    assetWhere.originalName = { contains: filters.search, mode: 'insensitive' };
  }

  const assetFolders = await prisma.assetFolder.findMany({
    where: {
      folderId: trashFolder.id,
      asset: assetWhere,
    },
    include: { asset: true },
    orderBy: { createdAt: 'desc' },
  });

  const assets = assetFolders.map(af => af.asset);

  return {
    items: assets,
    total: assets.length,
    folder: trashFolder,
  };
}

/**
 * 删除文件夹时将文件移到回收站
 */
export async function moveFolderAssetsToTrash(userId: string, folderId: string) {
  // 获取文件夹中的所有文件
  const assetFolders = await prisma.assetFolder.findMany({
    where: { folderId },
    include: { asset: true },
  });

  if (assetFolders.length === 0) {
    return { count: 0, message: '文件夹为空' };
  }

  const assetIds = assetFolders.map(af => af.assetId);

  // 移动文件到回收站
  return await moveToTrash(userId, assetIds);
}
