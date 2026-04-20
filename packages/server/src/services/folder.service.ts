import { prisma } from '../config/database';

export async function listFolders(userId: string) {
  const folders = await prisma.folder.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { assets: true } } },
  });

  return folders.map((f) => ({
    id: f.id,
    name: f.name,
    isDefault: f.isDefault,
    assetCount: f._count.assets,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }));
}

export async function createFolder(userId: string, name: string) {
  return prisma.folder.create({
    data: { name, userId },
  });
}

export async function renameFolder(userId: string, folderId: string, newName: string) {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } });
  if (!folder) throw new Error('Folder not found');

  return prisma.folder.update({
    where: { id: folderId },
    data: { name: newName },
  });
}

export async function deleteFolder(userId: string, folderId: string) {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } });
  if (!folder) throw new Error('Folder not found');
  if (folder.isDefault) throw new Error('Cannot delete default folder');

  // Move all assets back to "All Files" (set folderId to null)
  await prisma.asset.updateMany({
    where: { folderId },
    data: { folderId: null },
  });

  return prisma.folder.delete({ where: { id: folderId } });
}
