import { prisma } from '../config/database';
import { decrypt } from '../utils/crypto';
import { chatWithDifyAgent } from './dify-client.service';
import { broadcastToUser } from '../ws/socket-manager';
import { addJob, removeJob } from './scheduler.service';

export async function createTask(
  userId: string,
  data: { name: string; type: string; agentId: string; assetIds: string[]; prompt?: string; cronExpression?: string },
) {
  const { name, type, agentId, assetIds, prompt, cronExpression } = data;

  const task = await prisma.task.create({
    data: {
      name,
      type: type || 'immediate',
      agentId,
      userId,
      totalFiles: assetIds.length,
      completedFiles: 0,
      prompt: prompt || null,
      cronExpression: type === 'scheduled' ? cronExpression : null,
      enabled: true,
      items: {
        create: assetIds.map((assetId) => ({ sourceAssetId: assetId })),
      },
    },
    include: { items: true, agent: true },
  });

  if (task.type === 'immediate') {
    executeTask(task.id, userId).catch(() => {});
  } else if (task.type === 'scheduled' && task.cronExpression) {
    addJob(task.id, userId, task.cronExpression);
  }

  return task;
}

export async function listTasks(userId: string, status?: string) {
  const where: any = { userId };
  if (status === 'scheduled') {
    where.type = 'scheduled';
  } else if (status && status !== 'all') {
    where.status = status;
  }
  return prisma.task.findMany({
    where,
    include: { items: { include: { sourceAsset: { select: { id: true, originalName: true } }, resultAsset: { select: { id: true } } } }, agent: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTask(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    include: { items: { include: { sourceAsset: true } }, agent: true },
  });
  if (!task) throw new Error('Task not found');
  return task;
}

export async function deleteTask(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) throw new Error('Task not found');
  removeJob(taskId);
  // Cancel running items first
  if (task.status === 'running') {
    await prisma.taskItem.updateMany({ where: { taskId, status: 'pending' }, data: { status: 'canceled' } });
    await prisma.task.update({ where: { id: taskId }, data: { status: 'canceled' } });
  }
  await prisma.task.delete({ where: { id: taskId } });
}

export async function retryTask(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    include: { items: true },
  });
  if (!task) throw new Error('Task not found');

  // Reset failed items
  await prisma.taskItem.updateMany({
    where: { taskId, status: 'failed' },
    data: { status: 'pending', progress: 0, error: null },
  });
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'running' },
  });

  executeTask(taskId, userId).catch(() => {});
}

export async function cancelTask(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) throw new Error('Task not found');
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'canceled' },
  });
  await prisma.taskItem.updateMany({
    where: { taskId, status: 'pending' },
    data: { status: 'canceled' },
  });
}

export async function toggleScheduledTask(userId: string, taskId: string, enabled: boolean) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) throw new Error('Task not found');
  const updated = await prisma.task.update({ where: { id: taskId }, data: { enabled } });
  if (enabled && task.cronExpression) {
    addJob(taskId, userId, task.cronExpression);
  } else {
    removeJob(taskId);
  }
  return updated;
}

// Execute task: process each file sequentially
export async function executeTask(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { items: true, agent: true },
  });
  if (!task) return;

  await prisma.task.update({ where: { id: taskId }, data: { status: 'running' } });
  pushProgress(userId, taskId, 'running', 0);

  const apiKey = decrypt(task.agent.apiKeyEncrypted, task.agent.apiKeyIv);
  let completed = 0;
  const total = task.items.length;

  for (let idx = 0; idx < total; idx++) {
    const item = task.items[idx];
    // Check if task was canceled
    const current = await prisma.task.findUnique({ where: { id: taskId } });
    if (!current || current.status === 'canceled') return;

    await prisma.taskItem.update({ where: { id: item.id }, data: { status: 'running' } });

    try {
      // Get source file content
      const asset = await prisma.asset.findUnique({ where: { id: item.sourceAssetId } });
      if (!asset?.parsedText) throw new Error('Source file has no parsed content');

      const userPrompt = task.prompt || '请处理以下内容';
      const message = `${userPrompt}\n\n${asset.parsedText.slice(0, 10000)}`;
      const textContent = asset.parsedText || '';

      const result = await chatWithDifyAgent(
        task.agent.endpoint, apiKey, message, task.agent.mode,
        task.agent.mode === 'workflow' ? textContent : undefined,
        (fileProgress: number) => {
          // Map file-local progress (0-95) into overall progress
          const overallProgress = Math.round(((completed + fileProgress / 100) / total) * 100);
          pushProgress(userId, taskId, 'running', Math.min(99, overallProgress));
        },
      );

      // Save result as new asset
      const resultAsset = await prisma.asset.create({
        data: {
          filename: `${task.name}_result_${asset.originalName}`,
          originalName: `${task.name}_result_${asset.originalName}`,
          fileType: 'txt',
          fileSize: Buffer.byteLength(result.answer),
          filePath: '',
          parsedText: result.answer,
          status: 'ready',
          userId,
          sourceAssetId: asset.id,
        },
      });

      await prisma.taskItem.update({
        where: { id: item.id },
        data: { status: 'completed', progress: 100, resultAssetId: resultAsset.id },
      });

      completed++;
      await prisma.task.update({
        where: { id: taskId },
        data: { completedFiles: completed },
      });

      const overallProgress = Math.round(((idx + 1) / total) * 100);
      pushProgress(userId, taskId, 'running', overallProgress);
    } catch (err: any) {
      await prisma.taskItem.update({
        where: { id: item.id },
        data: { status: 'failed', error: err.message },
      });
      completed++;
      pushProgress(userId, taskId, 'running', Math.round(((idx + 1) / total) * 100));
    }
  }

  // Check final status
  const failedCount = await prisma.taskItem.count({ where: { taskId, status: 'failed' } });
  const finalStatus = failedCount === task.items.length ? 'failed' : 'completed';
  await prisma.task.update({ where: { id: taskId }, data: { status: finalStatus } });
  pushProgress(userId, taskId, finalStatus, finalStatus === 'completed' ? 100 : undefined);
}

function pushProgress(userId: string, taskId: string, status: string, progress?: number) {
  broadcastToUser(userId, {
    type: 'task:progress',
    data: { taskId, status, progress },
  });
}
