import apiClient from './client';
import type { Asset, PaginatedResponse } from '../types';

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
  fileType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
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
  const { data } = await apiClient.put<Asset>(`/assets/${id}`, { folderId });
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
