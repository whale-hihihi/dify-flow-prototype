import apiClient from './client';
import type { Folder } from '../types';

export async function listFolders() {
  const { data } = await apiClient.get<Folder[]>('/folders');
  return data;
}

export async function createFolder(name: string) {
  const { data } = await apiClient.post<Folder>('/folders', { name });
  return data;
}

export async function renameFolder(id: string, name: string) {
  const { data } = await apiClient.put<Folder>(`/folders/${id}`, { name });
  return data;
}

export async function deleteFolder(id: string) {
  await apiClient.delete(`/folders/${id}`);
}

export async function deleteOnlineDriveFolder(datasetId: string, folderId: string) {
  await apiClient.delete(`/datasets/${datasetId}/online-drive/folders?folder_id=${folderId}`);
}

// 回收站相关API
export async function emptyTrash() {
  const { data } = await apiClient.post('/trash/empty');
  return data;
}
