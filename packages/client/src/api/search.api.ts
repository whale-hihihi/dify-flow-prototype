import apiClient from './client';
import type { PaginatedResponse, SearchResult } from '../types';

export async function searchAssets(params: {
  q?: string;
  fileType?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await apiClient.get<PaginatedResponse<SearchResult>>('/search', { params });
  return data;
}
