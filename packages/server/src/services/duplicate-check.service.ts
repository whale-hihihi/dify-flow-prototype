import { prisma } from '../config/database';
import { FILE_TYPE_MAP } from '../config/constants';

export interface DuplicateCheckResult {
  totalDuplicates: number;
  duplicateInCurrentFolder?: any;
  duplicateInOtherFolders?: any[];
  folderName?: string;
}

export async function checkUploadDuplicate(
  userId: string,
  file: Express.Multer.File,
  folderId?: string
): Promise<DuplicateCheckResult> {
  const fileName = file.originalname;
  const fileType = FILE_TYPE_MAP[file.mimetype];

  // 查找当前用户下所有同名文件
  const duplicateAssets = await prisma.asset.findMany({
    where: {
      userId,
      originalName: fileName,
      fileType,
      deletedAt: null, // 只查找未删除的文件
    },
    include: {
      folders: {
        include: {
          folder: true,
        },
      },
    },
  });

  if (duplicateAssets.length === 0) {
    return {
      totalDuplicates: 0,
    };
  }

  // 检查当前文件夹是否有重复
  let duplicateInCurrentFolder: any = null;
  if (folderId) {
    duplicateInCurrentFolder = duplicateAssets.find(asset =>
      asset.folders.some((folderAsset: any) => folderAsset.folderId === folderId)
    );
  }

  // 检查其他文件夹的重复
  const duplicateInOtherFolders = duplicateAssets.filter((asset: any) => {
    if (folderId && duplicateInCurrentFolder) {
      return asset.id !== duplicateInCurrentFolder.id;
    }
    if (folderId) {
      return !asset.folders.some((folderAsset: any) => folderAsset.folderId === folderId);
    }
    return false;
  });

  // 获取文件夹名称
  let folderName;
  if (duplicateInOtherFolders.length > 0) {
    const firstOtherFolder = duplicateInOtherFolders[0].folders[0];
    if (firstOtherFolder) {
      folderName = firstOtherFolder.folder.name;
    }
  }

  return {
    totalDuplicates: duplicateAssets.length,
    duplicateInCurrentFolder,
    duplicateInOtherFolders,
    folderName,
  };
}

export async function checkBatchUploadDuplicates(
  userId: string,
  files: Express.Multer.File[],
  folderId?: string
): Promise<{
  files: Array<{
    fileName: string;
    result: DuplicateCheckResult;
  }>;
  summary: {
    totalFiles: number;
    duplicateFiles: number;
    conflictFiles: number;
  };
}> {
  const fileResults = [];
  let duplicateCount = 0;
  let conflictCount = 0;

  for (const file of files) {
    const result = await checkUploadDuplicate(userId, file, folderId);

    if (result.totalDuplicates > 0) {
      duplicateCount++;
      if (result.duplicateInCurrentFolder) {
        conflictCount++;
      }
    }

    fileResults.push({
      fileName: file.originalname,
      result,
    });
  }

  return {
    files: fileResults,
    summary: {
      totalFiles: files.length,
      duplicateFiles: duplicateCount,
      conflictFiles: conflictCount,
    },
  };
}

export function getFileTypeFromMimeType(mimeType: string): string {
  return FILE_TYPE_MAP[mimeType] || 'unknown';
}