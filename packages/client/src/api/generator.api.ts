import apiClient from './client';

export async function sendChat(message: string, sessionId: string, action: string = '') {
  const { data } = await apiClient.post('/generator/chat', {
    message,
    session_id: sessionId,
    action,
  });
  return data as {
    reply: string;
    session_id: string;
    state: string;
    dsl?: string;
    options?: string[];
  };
}

export async function getDsl(sessionId: string) {
  const { data } = await apiClient.get(`/generator/dsl/${sessionId}`);
  return data as { dsl: string; filename: string };
}
