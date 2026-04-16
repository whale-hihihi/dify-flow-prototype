import apiClient from './client';
import type { User } from '../types';

export async function login(username: string, password: string) {
  const { data } = await apiClient.post<{ token: string; user: User }>('/auth/login', {
    username,
    password,
  });
  return data;
}

export async function getMe() {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}

export async function updateProfile(updates: { username?: string; email?: string }) {
  const { data } = await apiClient.put<User>('/auth/me', updates);
  return data;
}
