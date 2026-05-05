import apiClient from './client';
import type { Asset, PaginatedResponse, Folder } from '../types';

export async function uploadAssets(files: File[], folderId?: string) {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  if (folderId) formData.append('folderId', folderId);

  const { data } = await apiClient.post<Asset[]>('/assets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
  return data;
}

export async function listAssets(params?: {
  folderId?: string;
  status?: string;
  fileType?: string | string[];
  search?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
  sourceType?: 'uploaded' | 'processed';
}) {
  const { data } = await apiClient.get<PaginatedResponse<Asset>>('/assets', { params });
  return data;
}

export async function getAsset(id: string) {
  const { data } = await apiClient.get<Asset>(`/assets/${id}`);
  return data;
}

export async function deleteAsset(id: string) {
  await apiClient.delete(`/assets/${id}`);
}

export async function moveAsset(id: string, folderId: string | null) {
  const { data } = await apiClient.post<Asset>(`/assets/${id}/move`, { folderId });
  return data;
}

export async function moveAssetWithOverride(id: string, folderId: string) {
  const { data } = await apiClient.post<Asset>(`/assets/${id}/move-override`, { folderId });
  return data;
}

export async function downloadAsset(id: string, filename: string) {
  const response = await apiClient.get(`/assets/${id}/download`, {
    responseType: 'blob',
  });
  // 从 Content-Disposition 提取文件名，或使用传入的文件名
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function copyAsset(id: string, folderId: string | null) {
  const { data } = await apiClient.post<Asset>(`/assets/${id}/copy`, { folderId });
  return data;
}

export async function copyAssetWithOverride(id: string, folderId: string) {
  const { data } = await apiClient.post<Asset>(`/assets/${id}/copy-override`, { folderId });
  return data;
}

export async function getAssetFolders(id: string) {
  const { data } = await apiClient.get(`/assets/${id}/folders`);
  return data;
}

export async function addToFolder(id: string, folderId: string) {
  const { data } = await apiClient.post(`/assets/${id}/add-to-folder`, { folderId });
  return data;
}

export async function removeFromFolder(assetFolderId: string) {
  const response = await apiClient.delete(`/assets/asset-folder/${assetFolderId}`);
  return response;
}

// 回收站相关API
export async function moveToTrash(assetIds: string[]) {
  const { data } = await apiClient.post('/trash/move-to-trash', { assetIds });
  return data;
}

export async function restoreAssets(assetIds: string[]) {
  const { data } = await apiClient.post('/trash/restore', { assetIds });
  return data;
}

export async function permanentlyDeleteAssets(assetIds: string[]) {
  const { data } = await apiClient.post('/trash/permanent-delete', { assetIds });
  return data;
}

export async function listTrashAssets(params?: {
  status?: string;
  fileType?: string | string[];
  search?: string;
}) {
  const { data } = await apiClient.get('/trash/', { params });
  return data;
}

export async function checkBatchDuplicateFiles(assetIds: string[], targetFolderId: string) {
  const { data } = await apiClient.post('/assets/check-batch-duplicates', {
    assetIds,
    targetFolderId,
  });
  return data;
}

export async function checkUploadDuplicates(files: File[], folderId?: string) {
  const fileMetadata = files.map(file => ({
    name: file.name,
    size: file.size,
    type: file.type,
  }));

  const { data } = await apiClient.post('/assets/check-upload-duplicates', {
    files: fileMetadata,
    folderId,
  });
  return data;
}

export async function confirmUploadFiles(files: File[], folderId?: string, overrideOptions?: Record<string, boolean>) {
  const fileMetadata = files.map(file => ({
    name: file.name,
    size: file.size,
    type: file.type,
  }));

  const { data } = await apiClient.post('/assets/confirm-upload', {
    files: fileMetadata,
    folderId,
    overrideOptions,
  });
  return data;
}
