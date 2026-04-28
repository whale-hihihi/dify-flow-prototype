import apiClient from './client';
import type { User } from '../types';

export async function login(username: string, password: string) {
  const { data } = await apiClient.post<{ token: string; user: User }>('/auth/login', { username, password });
  return data;
}

export async function getMe() {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}

export async function updateProfile(updates: { username?: string; email?: string; defaultAgentId?: string | null }) {
  const { data } = await apiClient.put<User>('/auth/me', updates);
  return data;
}

export async function listUsers() {
  const { data } = await apiClient.get<User[]>('/auth/users');
  return data;
}

export async function createUser(input: { username: string; email: string; password: string; role?: string }) {
  const { data } = await apiClient.post<User>('/auth/users', input);
  return data;
}

export async function updateUserRole(userId: string, role: string) {
  const { data } = await apiClient.put<User>(`/auth/users/${userId}/role`, { role });
  return data;
}

export async function deleteUser(userId: string) {
  const { data } = await apiClient.delete<{ success: boolean }>(`/auth/users/${userId}`);
  return data;
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const { data } = await apiClient.put<{ success: boolean }>(`/auth/users/${userId}/password`, { newPassword });
  return data;
}
