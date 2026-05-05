import { prisma } from '../config/database';
import { decrypt } from '../utils/crypto';
import { chatWithDifyAgent } from './dify-client.service';
import { broadcastToUser } from '../ws/socket-manager';
import { addJob, removeJob } from './scheduler.service';

export async function createTask(
  userId: string,
  data: { name: string; type: string; agentId: string; assetIds: string[]; prompt?: string; cronExpression?: string; inputs?: Record<string, any>; sourceFields?: string[]; processingMode?: string },
) {
  const { name, type, agentId, assetIds, prompt, cronExpression, inputs, sourceFields, processingMode } = data;

  const existing = await prisma.task.findFirst({ where: { name, userId } });
  if (existing) throw new Error('已存在同名任务，请使用其他名称');

  const existingFolder = await prisma.folder.findFirst({ where: { name, userId } });
  if (existingFolder) throw new Error('已存在同名文件夹，请使用其他名称');

  const task = await prisma.task.create({
    data: {
      name,
      type: type || 'immediate',
      processingMode: processingMode || 'per-file',
      agentId,
      userId,
      totalFiles: assetIds.length,
      completedFiles: 0,
      prompt: prompt || null,
      inputs: inputs || undefined,
      sourceFields: sourceFields || undefined,
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

// Execute task: process each file sequentially or batch
export async function executeTask(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { items: true, agent: true },
  });
  if (!task) return;

  await prisma.task.update({ where: { id: taskId }, data: { status: 'running' } });
  pushProgress(userId, taskId, 'running', 0);

  const apiKey = decrypt(task.agent.apiKeyEncrypted, task.agent.apiKeyIv);

  if (task.processingMode === 'batch') {
    // Batch mode: concatenate all files, one Dify call
    await executeBatch(task, userId, apiKey);
  } else {
    // Per-file mode: sequential processing
    await executePerFile(task, userId, apiKey);
  }
}

async function executeBatch(task: any, userId: string, apiKey: string) {
  const taskId = task.id;
  const total = task.items.length;

  try {
    // Collect all file contents
    const parts: string[] = [];
    for (const item of task.items) {
      const asset = await prisma.asset.findUnique({ where: { id: item.sourceAssetId } });
      if (asset?.parsedText) {
        parts.push(`=== ${asset.originalName} ===\n${asset.parsedText.slice(0, 8000)}`);
      }
    }

    if (parts.length === 0) throw new Error('No files with parsed content');

    const combinedText = parts.join('\n\n');
    const userPrompt = task.prompt || '请处理以下内容';

    pushProgress(userId, taskId, 'running', 10);

    const result = await chatWithDifyAgent(
      task.agent.endpoint, apiKey, userPrompt, task.agent.mode,
      combinedText,
      (fileProgress: number) => {
        pushProgress(userId, taskId, 'running', Math.min(95, 10 + Math.round(fileProgress * 0.85)));
      },
      async (correctMode: string) => {
        await prisma.agent.update({ where: { id: task.agent.id }, data: { mode: correctMode } });
      },
      (task.inputs as Record<string, any>) || undefined,
      (task.sourceFields as string[]) || undefined,
    );

    // Store result on task level
    await prisma.task.update({
      where: { id: taskId },
      data: { result: result.answer },
    });

    // Mark all items as completed
    await prisma.taskItem.updateMany({
      where: { taskId },
      data: { status: 'completed', progress: 100 },
    });

    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'completed', completedFiles: total },
    });
    pushProgress(userId, taskId, 'completed', 100);
  } catch (err: any) {
    await prisma.taskItem.updateMany({
      where: { taskId },
      data: { status: 'failed', error: err.message },
    });
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'failed' },
    });
    pushProgress(userId, taskId, 'failed');
  }

  // Auto-save results
  await autoSaveResults(taskId, userId);
}

async function executePerFile(task: any, userId: string, apiKey: string) {
  const taskId = task.id;
  let completed = 0;
  const total = task.items.length;

  for (let idx = 0; idx < total; idx++) {
    const item = task.items[idx];
    const current = await prisma.task.findUnique({ where: { id: taskId } });
    if (!current || current.status === 'canceled') return;

    await prisma.taskItem.update({ where: { id: item.id }, data: { status: 'running' } });

    try {
      const asset = await prisma.asset.findUnique({ where: { id: item.sourceAssetId } });
      if (!asset?.parsedText) throw new Error('Source file has no parsed content');

      const userPrompt = task.prompt || '请处理以下内容';
      const sourceText = asset.parsedText.slice(0, 10000);

      const result = await chatWithDifyAgent(
        task.agent.endpoint, apiKey, userPrompt, task.agent.mode,
        sourceText,
        (fileProgress: number) => {
          const overallProgress = Math.round(((completed + fileProgress / 100) / total) * 100);
          pushProgress(userId, taskId, 'running', Math.min(99, overallProgress));
        },
        async (correctMode: string) => {
          await prisma.agent.update({ where: { id: task.agent.id }, data: { mode: correctMode } });
        },
        (task.inputs as Record<string, any>) || undefined,
        (task.sourceFields as string[]) || undefined,
      );

      await prisma.taskItem.update({
        where: { id: item.id },
        data: { status: 'completed', progress: 100, result: result.answer },
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

  const failedCount = await prisma.taskItem.count({ where: { taskId, status: 'failed' } });
  const finalStatus = failedCount === task.items.length ? 'failed' : 'completed';
  await prisma.task.update({ where: { id: taskId }, data: { status: finalStatus } });
  pushProgress(userId, taskId, finalStatus, finalStatus === 'completed' ? 100 : undefined);

  // Auto-save results
  await autoSaveResults(taskId, userId);
}

export async function saveTaskResultToAsset(userId: string, taskId: string, taskItemId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) throw new Error('Task not found');

  const item = await prisma.taskItem.findFirst({
    where: { id: taskItemId, taskId },
    include: { sourceAsset: { select: { originalName: true } } },
  });
  if (!item) throw new Error('Task item not found');
  if (!item.result) throw new Error('No result to save');

  // Check if already saved
  if (item.resultAssetId) {
    const existing = await prisma.asset.findUnique({ where: { id: item.resultAssetId } });
    if (existing) throw new Error('Result already saved to assets');
  }

  const resultAsset = await prisma.asset.create({
    data: {
      filename: `${task.name}_result_${item.sourceAsset?.originalName || 'unknown'}`,
      originalName: `${task.name}_result_${item.sourceAsset?.originalName || 'unknown'}`,
      fileType: 'txt',
      fileSize: Buffer.byteLength(item.result),
      filePath: '',
      parsedText: item.result,
      status: 'ready',
      userId,
      sourceAssetId: item.sourceAssetId,
    },
  });

  await prisma.taskItem.update({
    where: { id: taskItemId },
    data: { resultAssetId: resultAsset.id },
  });

  return resultAsset;
}

async function autoSaveResults(taskId: string, userId: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        items: {
          include: { sourceAsset: { select: { originalName: true } } },
        },
      },
    });
    if (!task || task.status !== 'completed') return;

    // Find user's default folder ("全部文件")
    const defaultFolder = await prisma.folder.findFirst({
      where: { userId, isDefault: true },
    });

    // Create folder named after the task
    const folder = await prisma.folder.create({
      data: { name: task.name, userId },
    });

    const linkAssetToFolders = async (assetId: string) => {
      // Link to task folder
      await prisma.assetFolder.create({
        data: { assetId, folderId: folder.id },
      });
      // Also link to default folder so it appears in "全部文件"
      if (defaultFolder) {
        await prisma.assetFolder.create({
          data: { assetId, folderId: defaultFolder.id },
        }).catch(() => {});
      }
    };

    if (task.processingMode === 'batch') {
      // Batch: one result asset from task.result
      if (!task.result) return;
      const resultAsset = await prisma.asset.create({
        data: {
          filename: `${task.name}_综合结果.txt`,
          originalName: `${task.name}_综合结果.txt`,
          fileType: 'txt',
          fileSize: Buffer.byteLength(task.result),
          filePath: '',
          parsedText: task.result,
          status: 'ready',
          userId,
          isProcessed: true,
        },
      });
      await linkAssetToFolders(resultAsset.id);
    } else {
      // Per-file: one result asset per TaskItem
      for (const item of task.items) {
        if (!item.result || item.resultAssetId) continue;
        const resultAsset = await prisma.asset.create({
          data: {
            filename: `${task.name}_result_${item.sourceAsset?.originalName || 'unknown'}`,
            originalName: `${task.name}_result_${item.sourceAsset?.originalName || 'unknown'}`,
            fileType: 'txt',
            fileSize: Buffer.byteLength(item.result),
            filePath: '',
            parsedText: item.result,
            status: 'ready',
            userId,
            sourceAssetId: item.sourceAssetId,
            isProcessed: true,
          },
        });
        await prisma.taskItem.update({
          where: { id: item.id },
          data: { resultAssetId: resultAsset.id },
        });
        await linkAssetToFolders(resultAsset.id);
      }
    }

    console.log(`[AutoSave] Task "${task.name}": results saved to folder ${folder.id} + default folder`);
  } catch (err) {
    console.error(`[AutoSave] Failed for task ${taskId}:`, err);
  }
}

function pushProgress(userId: string, taskId: string, status: string, progress?: number) {
  broadcastToUser(userId, {
    type: 'task:progress',
    data: { taskId, status, progress },
  });
}
