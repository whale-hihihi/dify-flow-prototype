import apiClient from './client';
import type { Agent, AgentFormData } from '../types';

export async function listAgents() {
  const { data } = await apiClient.get<Agent[]>('/agents');
  return data;
}

export async function createAgent(form: AgentFormData) {
  const { data } = await apiClient.post<Agent>('/agents', form);
  return data;
}

export async function updateAgent(id: string, form: Partial<AgentFormData>) {
  const { data } = await apiClient.put<Agent>(`/agents/${id}`, form);
  return data;
}

export async function deleteAgent(id: string) {
  await apiClient.delete(`/agents/${id}`);
}

export async function testAgentConnection(id: string) {
  const { data } = await apiClient.post<{ success: boolean; latencyMs?: number; error?: string }>(
    `/agents/${id}/test`
  );
  return data;
}
