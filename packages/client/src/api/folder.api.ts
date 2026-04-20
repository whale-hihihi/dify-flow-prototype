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
