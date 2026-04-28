import apiClient from './client';
import type { DifyConfig } from '../types';

export async function getDifyConfig() {
  const { data } = await apiClient.get<DifyConfig | null>('/dify-config');
  return data;
}

export async function upsertDifyConfig(difyUrl: string) {
  const { data } = await apiClient.put<DifyConfig>('/dify-config', { difyUrl });
  return data;
}

export async function testDifyConnection(difyUrl?: string) {
  const { data } = await apiClient.post<{ success: boolean; latencyMs?: number; error?: string }>(
    '/dify-config/test',
    difyUrl ? { difyUrl } : {}
  );
  return data;
}
