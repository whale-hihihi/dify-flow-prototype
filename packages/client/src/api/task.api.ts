import apiClient from './client';
import type { Task } from '../types';

export async function listTasks(status?: string) {
  const params = status && status !== 'all' ? { status } : {};
  const { data } = await apiClient.get<Task[]>('/tasks', { params });
  return data;
}

export async function createTask(input: {
  name: string;
  type: string;
  agentId: string;
  assetIds: string[];
  prompt?: string;
  cronExpression?: string;
}) {
  const { data } = await apiClient.post<Task>('/tasks', input);
  return data;
}

export async function retryTask(id: string) {
  const { data } = await apiClient.post<{ success: boolean }>(`/tasks/${id}/retry`);
  return data;
}

export async function cancelTask(id: string) {
  const { data } = await apiClient.post<{ success: boolean }>(`/tasks/${id}/cancel`);
  return data;
}

export async function deleteTask(id: string) {
  const { data } = await apiClient.delete<{ success: boolean }>(`/tasks/${id}`);
  return data;
}

export async function toggleScheduled(id: string, enabled: boolean) {
  const { data } = await apiClient.put<Task>(`/tasks/${id}/toggle`, { enabled });
  return data;
}
