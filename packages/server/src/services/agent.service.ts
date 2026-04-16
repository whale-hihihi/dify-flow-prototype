import { prisma } from '../config/database';
import { encrypt, decrypt } from '../utils/crypto';
import { testDifyConnection } from './dify-client.service';

export async function listAgents(userId: string) {
  return prisma.agent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAgent(userId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, userId } });
  if (!agent) throw new Error('Agent not found');
  return agent;
}

interface CreateAgentData {
  name: string;
  mode: string;
  description?: string;
  appId: string;
  apiKey: string;
  endpoint?: string;
}

export async function createAgent(userId: string, data: CreateAgentData) {
  const { encrypted, iv } = encrypt(data.apiKey);
  return prisma.agent.create({
    data: {
      name: data.name,
      mode: data.mode,
      description: data.description,
      appId: data.appId,
      apiKeyEncrypted: encrypted,
      apiKeyIv: iv,
      endpoint: data.endpoint || 'http://localhost/v1',
      userId,
    },
  });
}

interface UpdateAgentData {
  name?: string;
  mode?: string;
  description?: string;
  appId?: string;
  apiKey?: string;
  endpoint?: string;
}

export async function updateAgent(userId: string, agentId: string, data: UpdateAgentData) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, userId } });
  if (!agent) throw new Error('Agent not found');

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.mode !== undefined) updateData.mode = data.mode;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.appId !== undefined) updateData.appId = data.appId;
  if (data.endpoint !== undefined) updateData.endpoint = data.endpoint;

  if (data.apiKey) {
    const { encrypted, iv } = encrypt(data.apiKey);
    updateData.apiKeyEncrypted = encrypted;
    updateData.apiKeyIv = iv;
  }

  return prisma.agent.update({ where: { id: agentId }, data: updateData });
}

export async function deleteAgent(userId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, userId } });
  if (!agent) throw new Error('Agent not found');
  return prisma.agent.delete({ where: { id: agentId } });
}

export async function testAgentConnection(userId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, userId } });
  if (!agent) throw new Error('Agent not found');

  const apiKey = decrypt(agent.apiKeyEncrypted, agent.apiKeyIv);
  const result = await testDifyConnection(agent.endpoint, apiKey);

  // Update online status
  await prisma.agent.update({
    where: { id: agentId },
    data: { isOnline: result.success },
  });

  return result;
}
