import { prisma } from '../config/database';
import { testDifyConnection } from './dify-client.service';

export async function getConfig(userId: string) {
  return prisma.difyConfig.findFirst({ where: { userId } });
}

export async function upsertConfig(userId: string, difyUrl: string) {
  return prisma.difyConfig.upsert({
    where: { id: (await prisma.difyConfig.findFirst({ where: { userId } }))?.id || '' },
    update: { difyUrl },
    create: { difyUrl, userId },
  });
}

export async function testConfig(userId: string, difyUrl?: string) {
  let url = difyUrl;
  if (!url) {
    const config = await prisma.difyConfig.findFirst({ where: { userId } });
    if (!config) return { success: false, error: 'No Dify config found' };
    url = config.difyUrl;
  }

  const result = await testDifyConnection(url);

  // Update connection status
  await prisma.difyConfig.updateMany({
    where: { userId },
    data: { connectionStatus: result.success ? 'connected' : 'disconnected' },
  });

  return result;
}
