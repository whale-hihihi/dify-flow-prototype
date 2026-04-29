import client from './client';

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  mode: string;
  category: string;
  yamlContent: string;
}

export async function listTemplates(category?: string): Promise<Template[]> {
  const params: any = {};
  if (category && category !== 'all') params.category = category;
  const { data } = await client.get('/templates', { params });
  return data;
}
