import { prisma } from '../config/database';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';
import * as trashService from './trash.service';

export async function listFolders(userId: string) {
  const folders = await prisma.folder.findMany({
    where: { userId },
    orderBy: [
      { isDefault: 'desc' },    // 默认文件夹优先
      { isTrash: 'desc' },       // 回收站其次
      { name: 'asc' },           // 其他文件夹按名称排序
    ],
    include: { _count: { select: { assets: true } } },
  });

  return folders.map((f) => ({
    id: f.id,
    name: f.name,
    isDefault: f.isDefault,
    isTrash: f.isTrash || false,
    assetCount: f._count.assets,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }));
}

export async function createFolder(userId: string, name: string) {
  // 检查是否尝试创建名为"回收站"的文件夹
  if (name.trim() === '回收站') {
    throw new Error('无法创建名为"回收站"的文件夹');
  }

  return prisma.folder.create({
    data: { name, userId },
  });
}

export async function renameFolder(userId: string, folderId: string, newName: string) {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } });
  if (!folder) throw new Error('Folder not found');

  // 检查是否尝试重命名为"回收站"
  if (newName.trim() === '回收站') {
    throw new Error('无法重命名为"回收站"');
  }

  return prisma.folder.update({
    where: { id: folderId },
    data: { name: newName },
  });
}

export async function deleteFolder(userId: string, folderId: string) {
  console.log(`[DELETE FOLDER] Starting deleteFolder for folderId: ${folderId}, userId: ${userId}`);

  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } });
  if (!folder) throw new Error('Folder not found');
  if (folder.isDefault) throw new Error('Cannot delete default folder');
  if (folder.isTrash) throw new Error('Cannot delete trash folder');

  console.log(`[DELETE FOLDER] Found folder: ${folder.name}`);

  // 将文件夹中的文件移到回收站
  const trashResult = await trashService.moveFolderAssetsToTrash(userId, folderId);
  console.log(`[DELETE FOLDER] ${trashResult.message}`);

  // 删除文件夹
  console.log(`[DELETE FOLDER] Deleting folder from database`);
  const deletedFolder = await prisma.folder.delete({ where: { id: folderId } });
  console.log(`[DELETE FOLDER] ✓ Folder deleted successfully: ${deletedFolder.name}`);

  return {
    ...deletedFolder,
    trashResult,
  };
}
