import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { FILE_TYPE_MAP } from '../config/constants';
import { enqueueParseJob } from '../workers/parse-worker';
import { checkUploadDuplicate, checkBatchUploadDuplicates, DuplicateCheckResult } from './duplicate-check.service';

/**
 * 统一文件路径为正斜杠，确保 Windows/Linux 跨平台兼容
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * 上传文件并进行重复检查
 * 如果存在重复文件，返回重复信息供前端确认
 */
export async function uploadAssetsWithDuplicateCheck(
  userId: string,
  files: Express.Multer.File[],
  folderId?: string
) {
  // 批量检查重复文件
  const duplicateResults = await checkBatchUploadDuplicates(userId, files, folderId);

  return {
    files: duplicateResults.files,
    summary: duplicateResults.summary
  };
}

/**
 * 确认上传并处理重复文件
 * 用户确认后调用此函数完成实际的上传
 */
export async function confirmUploadAssets(
  userId: string,
  files: Express.Multer.File[],
  folderId?: string,
  overrideOptions?: Record<string, boolean> // 文件名是否覆盖的映射
) {
  const results = [];
  const overridenAssetIds = new Set(); // 记录被覆盖的文件ID

  for (const file of files) {
    const fileType = FILE_TYPE_MAP[file.mimetype];
    if (!fileType) continue;

    const duplicateResult = await checkUploadDuplicate(userId, file, folderId);

    // 如果有重复且用户没有选择覆盖，跳过
    if (duplicateResult.totalDuplicates && !overrideOptions?.[file.originalname]) {
      continue;
    }

    // 检查是否有重复文件需要覆盖
    if (duplicateResult.duplicateInCurrentFolder) {
      // 覆盖当前文件夹的重复文件
      const duplicateAsset = duplicateResult.duplicateInCurrentFolder;
      await prisma.assetFolder.deleteMany({
        where: {
          assetId: duplicateAsset.id,
          folderId: folderId || undefined,
        },
      });

      // 如果文件没有在其他文件夹中使用，永久删除
      const otherFolders = await prisma.assetFolder.count({
        where: { assetId: duplicateAsset.id },
      });
      if (otherFolders === 0) {
        await prisma.asset.delete({ where: { id: duplicateAsset.id } });
      }

      overridenAssetIds.add(duplicateAsset.id);
    }

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
        userId,
        // 如果有覆盖的文件，记录源文件ID
        ...(overridenAssetIds.size > 0 ? { sourceAssetId: overridenAssetIds.values().next().value as string } : {}),
      },
    });

    // 如果指定了文件夹，添加到文件夹
    if (folderId) {
      await prisma.assetFolder.create({
        data: {
          assetId: asset.id,
          folderId,
        },
      });
    }

    // Enqueue parsing job（用原始路径，本地文件系统操作需要原生分隔符）
    enqueueParseJob(asset.id, file.path, fileType, userId);

    results.push(asset);
  }

  return results;
}

/**
 * 原始上传函数（保留用于其他场景）
 */
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
        userId,
      },
    });

    // 如果指定了文件夹，添加到文件夹
    if (folderId) {
      await prisma.assetFolder.create({
        data: {
          assetId: asset.id,
          folderId,
        },
      });
    }

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
    fileType?: string | string[];
    search?: string;
    page?: number;
    pageSize?: number;
    includeDeleted?: boolean;
    sourceType?: 'uploaded' | 'processed';
  }
) {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const skip = (page - 1) * pageSize;

  // 检查是否是默认文件夹（所有文件）或没有指定文件夹（查看全部文件）
  let isDefaultFolder = false;
  if (!filters.folderId) {
    // 没有指定文件夹，查看全部文件，需要去重
    isDefaultFolder = true;
  } else {
    const folder = await prisma.folder.findFirst({
      where: { id: filters.folderId, userId },
      select: { isDefault: true },
    });
    isDefaultFolder = folder?.isDefault || false;
  }

  const where: any = { userId };

  // 默认过滤已删除文件，除非特别指定
  if (!filters.includeDeleted) {
    where.deletedAt = null;
  } else {
    // 如果包含已删除文件，只显示未永久删除的
    where.isPermanentlyDeleted = false;
  }

  if (filters.folderId && !isDefaultFolder) {
    // 使用 AssetFolder 关联查询特定文件夹中的文件
    where.folders = {
      some: {
        folderId: filters.folderId,
      },
    };
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.fileType) {
    // 支持单个字符串或数组
    if (Array.isArray(filters.fileType)) {
      where.fileType = { in: filters.fileType };
    } else {
      where.fileType = filters.fileType;
    }
  }
  if (filters.search) {
    where.originalName = { contains: filters.search, mode: 'insensitive' };
  }

  // Filter by source type
  if (filters.sourceType === 'uploaded') {
    where.isProcessed = false;
  } else if (filters.sourceType === 'processed') {
    where.isProcessed = true;
  }

  // 如果是默认文件夹或没有指定文件夹，需要去重（基于 sourceAssetId）
  if (isDefaultFolder) {
    // 查询所有不重复的文件（只显示原始文件或没有sourceAssetId的文件）
    const allAssets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        originalName: true,
        fileType: true,
        fileSize: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        sourceAssetId: true,
        filePath: true,
        isProcessed: true,
        folders: {
          include: {
            folder: true,
          },
        },
      },
    });

    // 去重：保留原始上传文件 + 所有处理结果（isProcessed=true）
    const uniqueAssets = allAssets.filter(asset => asset.isProcessed || !asset.sourceAssetId || !asset.filePath);
    const total = uniqueAssets.length;
    const items = uniqueAssets.slice(skip, skip + pageSize);

    // Batch load source asset names for result files
    const sourceIds = [...new Set(items.filter(a => a.sourceAssetId).map(a => a.sourceAssetId!))];
    let sourceMap: Record<string, { id: string; originalName: string }> = {};
    if (sourceIds.length > 0) {
      const sources = await prisma.asset.findMany({
        where: { id: { in: sourceIds } },
        select: { id: true, originalName: true },
      });
      sources.forEach(s => { sourceMap[s.id] = s; });
    }
    const itemsWithSource = items.map(a => ({
      ...a,
      sourceAsset: a.sourceAssetId ? sourceMap[a.sourceAssetId] || null : null,
    }));

    return { items: itemsWithSource, total, page, pageSize };
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
        createdAt: true,
        updatedAt: true,
        sourceAssetId: true,
        folders: {
          include: {
            folder: true,
          },
        },
      },
    }),
    prisma.asset.count({ where }),
  ]);

  // Batch load source asset names for result files
  const sourceIds = [...new Set(items.filter(a => a.sourceAssetId).map(a => a.sourceAssetId!))];
  let sourceMap: Record<string, { id: string; originalName: string }> = {};
  if (sourceIds.length > 0) {
    const sources = await prisma.asset.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true, originalName: true },
    });
    sources.forEach(s => { sourceMap[s.id] = s; });
  }
  const itemsWithSource = items.map(a => ({
    ...a,
    sourceAsset: a.sourceAssetId ? sourceMap[a.sourceAssetId] || null : null,
  }));

  return { items: itemsWithSource, total, page, pageSize };
}

export async function getAsset(userId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw new Error('Asset not found');
  return asset;
}

export async function deleteAsset(userId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw new Error('Asset not found');

  // 导入回收站服务
  const trashService = await import('./trash.service');
  return trashService.moveToTrash(userId, [assetId]);
}

/**
 * 永久删除文件（原删除逻辑，用于回收站清空）
 */
export async function permanentlyDeleteAsset(userId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw new Error('Asset not found');

  if (asset.filePath) {
    const diskPath = path.resolve(asset.filePath);
    if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
      fs.unlinkSync(diskPath);
    }
  }

  // 删除相关数据库记录
  await prisma.taskItem.deleteMany({
    where: {
      OR: [
        { sourceAssetId: assetId },
        { resultAssetId: assetId }
      ]
    }
  });

  await prisma.assetFolder.deleteMany({ where: { assetId } });

  return prisma.asset.delete({ where: { id: assetId } });
}

export async function moveAsset(userId: string, assetId: string, folderId: string | null) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw new Error('Asset not found');

  // 如果指定了目标文件夹，检查是否有重复文件
  if (folderId) {
    // 查找目标文件夹中同名文件
    const duplicateAsset = await prisma.asset.findFirst({
      where: {
        userId,
        originalName: asset.originalName,
        folders: {
          some: {
            folderId: folderId,
          },
        },
        deletedAt: null,
        id: { not: assetId }, // 排除当前文件本身
      },
    });

    if (duplicateAsset) {
      // 返回冲突信息，包含现有文件的信息
      throw new Error(JSON.stringify({
        code: 'DUPLICATE_FILE',
        message: '目标文件夹中已存在同名文件',
        duplicateAsset: {
          id: duplicateAsset.id,
          originalName: duplicateAsset.originalName,
          createdAt: duplicateAsset.createdAt,
        },
      }));
    }
  }

  // 移除所有文件夹关系
  await prisma.assetFolder.deleteMany({ where: { assetId } });

  // 如果指定了新文件夹，添加关系
  if (folderId) {
    await prisma.assetFolder.create({
      data: {
        assetId,
        folderId,
      },
    });
  }

  return prisma.asset.findUnique({ where: { id: assetId } });
}

/**
 * 移动文件到目标文件夹，如果存在同名文件则覆盖
 */
export async function moveAssetWithOverride(
  userId: string,
  assetId: string,
  targetFolderId: string
) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw new Error('Asset not found');

  // 查找目标文件夹中的同名文件
  const duplicateAsset = await prisma.asset.findFirst({
    where: {
      userId,
      originalName: asset.originalName,
      folders: {
        some: {
          folderId: targetFolderId,
        },
      },
      deletedAt: null,
      id: { not: assetId },
    },
  });

  // 如果存在同名文件，从目标文件夹中移除它，然后永久删除它（不进入回收站）
  if (duplicateAsset) {
    // 从目标文件夹中移除旧文件
    await prisma.assetFolder.deleteMany({
      where: {
        assetId: duplicateAsset.id,
        folderId: targetFolderId,
      },
    });

    // 检查旧文件是否还在其他文件夹中
    const remainingFolders = await prisma.assetFolder.count({
      where: { assetId: duplicateAsset.id },
    });

    // 如果不在任何文件夹中了，永久删除该文件
    if (remainingFolders === 0) {
      // 删除物理文件
      if (duplicateAsset.filePath) {
        const diskPath = path.resolve(duplicateAsset.filePath);
        try {
          if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
            fs.unlinkSync(diskPath);
          }
        } catch (error) {
          console.error(`[OVERRIDE] Failed to delete physical file:`, error);
        }
      }

      // 永久删除数据库记录（不使用回收站）
      await prisma.taskItem.deleteMany({
        where: {
          OR: [
            { sourceAssetId: duplicateAsset.id },
            { resultAssetId: duplicateAsset.id }
          ]
        }
      });

      await prisma.asset.delete({
        where: { id: duplicateAsset.id },
      });
    }
  }

  // 移除当前文件的所有文件夹关系
  await prisma.assetFolder.deleteMany({ where: { assetId } });

  // 将当前文件添加到目标文件夹
  await prisma.assetFolder.create({
    data: {
      assetId,
      folderId: targetFolderId,
    },
  });

  return prisma.asset.findUnique({ where: { id: assetId } });
}

export async function getAssetFilePath(userId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw new Error('Asset not found');
  return { filePath: path.resolve(asset.filePath), originalName: asset.originalName };
}

export async function copyAsset(userId: string, assetId: string, targetFolderId: string | null) {
  // 查找原始文件
  const sourceAsset = await prisma.asset.findFirst({
    where: { id: assetId, userId },
  });
  if (!sourceAsset) throw new Error('Asset not found');

  // 如果指定了目标文件夹，检查是否有重复文件
  if (targetFolderId) {
    // 查找目标文件夹中同名文件
    const duplicateAsset = await prisma.asset.findFirst({
      where: {
        userId,
        originalName: sourceAsset.originalName,
        folders: {
          some: {
            folderId: targetFolderId,
          },
        },
        deletedAt: null,
      },
    });

    if (duplicateAsset) {
      // 返回冲突信息，包含现有文件的信息
      throw new Error(JSON.stringify({
        code: 'DUPLICATE_FILE',
        message: '目标文件夹中已存在同名文件',
        duplicateAsset: {
          id: duplicateAsset.id,
          originalName: duplicateAsset.originalName,
          createdAt: duplicateAsset.createdAt,
        },
      }));
    }
  }

  // 创建新的文件记录（复制的文件内容保持不变）
  const newAsset = await prisma.asset.create({
    data: {
      filename: sourceAsset.filename,
      originalName: sourceAsset.originalName,
      fileType: sourceAsset.fileType,
      fileSize: sourceAsset.fileSize,
      filePath: sourceAsset.filePath,
      status: sourceAsset.status,
      parsedText: sourceAsset.parsedText,
      errorMessage: sourceAsset.errorMessage,
      userId,
      sourceAssetId: sourceAsset.id, // 记录这是从哪个文件复制的
    },
  });

  // 仅将复制的文件添加到目标文件夹
  // 注意：不复制原始文件的文件夹关系
  if (targetFolderId) {
    await prisma.assetFolder.create({
      data: {
        assetId: newAsset.id,
        folderId: targetFolderId,
      },
    });
  }

  return newAsset;
}

/**
 * 复制文件到目标文件夹，如果存在同名文件则覆盖
 */
export async function copyAssetWithOverride(
  userId: string,
  assetId: string,
  targetFolderId: string
) {
  // 查找原始文件
  const sourceAsset = await prisma.asset.findFirst({
    where: { id: assetId, userId },
  });
  if (!sourceAsset) throw new Error('Asset not found');

  // 查找目标文件夹中的同名文件
  const duplicateAsset = await prisma.asset.findFirst({
    where: {
      userId,
      originalName: sourceAsset.originalName,
      folders: {
        some: {
          folderId: targetFolderId,
        },
      },
      deletedAt: null,
    },
  });

  // 如果存在同名文件，先从目标文件夹中移除它，然后永久删除它（不进入回收站）
  if (duplicateAsset) {
    // 从目标文件夹中移除旧文件
    await prisma.assetFolder.deleteMany({
      where: {
        assetId: duplicateAsset.id,
        folderId: targetFolderId,
      },
    });

    // 检查旧文件是否还在其他文件夹中
    const remainingFolders = await prisma.assetFolder.count({
      where: { assetId: duplicateAsset.id },
    });

    // 如果不在任何文件夹中了，永久删除该文件
    if (remainingFolders === 0) {
      // 删除物理文件
      if (duplicateAsset.filePath) {
        const diskPath = path.resolve(duplicateAsset.filePath);
        try {
          if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
            fs.unlinkSync(diskPath);
          }
        } catch (error) {
          console.error(`[OVERRIDE] Failed to delete physical file:`, error);
        }
      }

      // 永久删除数据库记录（不使用回收站）
      await prisma.taskItem.deleteMany({
        where: {
          OR: [
            { sourceAssetId: duplicateAsset.id },
            { resultAssetId: duplicateAsset.id }
          ]
        }
      });

      await prisma.asset.delete({
        where: { id: duplicateAsset.id },
      });
    }
  }

  // 创建新的文件记录（复制的文件内容保持不变）
  const newAsset = await prisma.asset.create({
    data: {
      filename: sourceAsset.filename,
      originalName: sourceAsset.originalName,
      fileType: sourceAsset.fileType,
      fileSize: sourceAsset.fileSize,
      filePath: sourceAsset.filePath,
      status: sourceAsset.status,
      parsedText: sourceAsset.parsedText,
      errorMessage: sourceAsset.errorMessage,
      userId,
      sourceAssetId: sourceAsset.id, // 记录这是从哪个文件复制的
    },
  });

  // 将复制的文件添加到目标文件夹
  await prisma.assetFolder.create({
    data: {
      assetId: newAsset.id,
      folderId: targetFolderId,
    },
  });

  return newAsset;
}

export async function getAssetFolders(userId: string, assetId: string) {
  // 先查询asset本身
  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      userId,
    },
  });

  if (!asset) {
    return [];
  }

  // 查找所有共享同一物理文件的Asset记录
  // 通过 filePath 查找，而不是通过 sourceAssetId
  // 这样可以找到所有共享同一物理文件的Asset记录，无论复制顺序如何
  const allRelatedAssets = await prisma.asset.findMany({
    where: {
      userId,
      filePath: asset.filePath,  // 相同的物理文件路径
      deletedAt: null,
    },
    select: { id: true },
  });

  const allRelatedAssetIds = allRelatedAssets.map(a => a.id);

  // 查询这些文件所在的所有真实文件夹（排除回收站）
  const folderRelations = await prisma.assetFolder.findMany({
    where: {
      assetId: { in: allRelatedAssetIds },
      folder: {
        isTrash: false, // 排除回收站文件夹
      },
    },
    include: {
      folder: true,
      asset: true,
    },
  });

  // 去重：每个文件夹只显示一次
  const uniqueFolderIds = new Set();
  const uniqueFolderRelations = folderRelations.filter(relation => {
    if (uniqueFolderIds.has(relation.folderId)) {
      return false;
    }
    uniqueFolderIds.add(relation.folderId);
    return true;
  });

  // 按照左侧文件夹目录的排序逻辑排序
  // 1. isDefault: desc (默认文件夹优先)
  // 2. isTrash: desc (回收站其次)
  // 3. name: asc (其他文件夹按名称排序)
  uniqueFolderRelations.sort((a, b) => {
    const folderA = a.folder;
    const folderB = b.folder;

    // 如果一个是默认文件夹，一个不是，默认文件夹在前
    if (folderA.isDefault && !folderB.isDefault) return -1;
    if (!folderA.isDefault && folderB.isDefault) return 1;

    // 如果一个是回收站，一个不是，回收站在后
    if (folderA.isTrash && !folderB.isTrash) return 1;
    if (!folderA.isTrash && folderB.isTrash) return -1;

    // 按名称升序排序
    return folderA.name.localeCompare(folderB.name, 'zh-CN');
  });

  // 构建结果列表，始终包含"全部文件"（放在第一位）
  const result = [{
    id: 'default-folder',
    assetId,
    folderId: 'default',
    createdAt: new Date(),
    folder: {
      id: 'default',
      name: '全部文件',
      isDefault: true,
      isTrash: false,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }];

  // 将所有真实文件夹关系添加到结果中（已按名称排序）
  result.push(...uniqueFolderRelations);

  return result;
}

export async function addToFolder(userId: string, assetId: string, folderId: string) {
  // 检查文件和文件夹是否都属于该用户
  const [asset, folder] = await Promise.all([
    prisma.asset.findFirst({ where: { id: assetId, userId } }),
    prisma.folder.findFirst({ where: { id: folderId, userId } }),
  ]);

  if (!asset) throw new Error('Asset not found');
  if (!folder) throw new Error('Folder not found');

  // 检查是否已经在这个文件夹中
  const existing = await prisma.assetFolder.findUnique({
    where: { assetId_folderId: { assetId, folderId } },
  });

  if (existing) {
    throw new Error('Asset already in this folder');
  }

  // 添加到文件夹
  return prisma.assetFolder.create({
    data: {
      assetId,
      folderId,
    },
  });
}

export async function removeFromFolder(userId: string, assetId: string, folderId: string) {
  // 检查文件是否真的在这个文件夹中
  const relationship = await prisma.assetFolder.findFirst({
    where: {
      assetId,
      folderId,
      asset: { userId },
    },
  });

  if (!relationship) {
    throw new Error('Asset not found in this folder');
  }

  // 从文件夹中移除
  await prisma.assetFolder.delete({
    where: { id: relationship.id },
  });

  // 如果文件不在任何文件夹中了，folderId字段保持为null（默认状态）
  const remainingFolders = await prisma.assetFolder.count({
    where: { assetId },
  });

  if (remainingFolders === 0) {
    // 文件已经不在任何文件夹中，无需额外操作
    // Asset模型中的folderId字段已经为null
  }
}

export async function deleteAssetFolder(userId: string, assetFolderId: string) {
  // 查找AssetFolder关系并验证权限
  const relationship = await prisma.assetFolder.findFirst({
    where: {
      id: assetFolderId,
      asset: { userId },
    },
    include: {
      asset: true,
    },
  });

  if (!relationship) {
    throw new Error('Asset-folder relationship not found');
  }

  // 直接调用moveToTrash，让它完整处理：
  // 记录原始文件夹 → 删除所有文件夹关联 → 移入回收站
  // 不能先删除关系再调moveToTrash，否则originalFolderId会丢失，导致无法恢复
  const trashService = await import('./trash.service');
  return trashService.moveToTrash(userId, [relationship.assetId]);
}

/**
 * 批量检查重复文件
 * 检查多个文件移动/复制到目标文件夹时是否会与现有文件重复
 */
export async function checkBatchDuplicateFiles(
  userId: string,
  assetIds: string[],
  targetFolderId: string
) {
  // 获取所有源文件
  const sourceAssets = await prisma.asset.findMany({
    where: {
      id: { in: assetIds },
      userId,
    },
    select: {
      id: true,
      originalName: true,
      fileType: true,
      createdAt: true,
    },
  });

  if (sourceAssets.length === 0) {
    return { duplicateFiles: [] };
  }

  // 查找目标文件夹中与源文件同名的所有文件
  const duplicateAssets = await prisma.asset.findMany({
    where: {
      userId,
      originalName: {
        in: sourceAssets.map(a => a.originalName),
      },
      folders: {
        some: {
          folderId: targetFolderId,
        },
      },
      deletedAt: null,
      id: {
        notIn: assetIds, // 排除源文件本身
      },
    },
    select: {
      id: true,
      originalName: true,
      fileType: true,
      createdAt: true,
    },
  });

  // 匹配重复的文件对
  const duplicateFiles = sourceAssets
    .map(sourceAsset => {
      const duplicate = duplicateAssets.find(
        d => d.originalName === sourceAsset.originalName
      );
      if (duplicate) {
        return {
          sourceAsset: {
            id: sourceAsset.id,
            originalName: sourceAsset.originalName,
            fileType: sourceAsset.fileType,
            createdAt: sourceAsset.createdAt,
          },
          duplicateAsset: {
            id: duplicate.id,
            originalName: duplicate.originalName,
            fileType: duplicate.fileType,
            createdAt: duplicate.createdAt,
          },
        };
      }
      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return { duplicateFiles };
}
