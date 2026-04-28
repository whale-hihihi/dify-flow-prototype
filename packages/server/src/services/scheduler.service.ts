import cron, { ScheduledTask } from 'node-cron';
import { prisma } from '../config/database';
import { executeTask } from './task.service';

const jobs = new Map<string, ScheduledTask>();

export async function initScheduler() {
  const tasks = await prisma.task.findMany({
    where: { type: 'scheduled', enabled: true, cronExpression: { not: null } },
  });

  for (const task of tasks) {
    if (task.cronExpression) {
      addJob(task.id, task.userId, task.cronExpression);
    }
  }

  console.log(`[Scheduler] Initialized with ${jobs.size} scheduled jobs`);
}

export function addJob(taskId: string, userId: string, cronExpression: string) {
  removeJob(taskId);

  if (!cron.validate(cronExpression)) {
    console.warn(`[Scheduler] Invalid cron expression for task ${taskId}: ${cronExpression}`);
    return;
  }

  const task = cron.schedule(cronExpression, () => {
    console.log(`[Scheduler] Triggering scheduled task ${taskId}`);
    executeScheduledTask(taskId, userId).catch((err) => {
      console.error(`[Scheduler] Error executing task ${taskId}:`, err.message);
    });
  }, { timezone: 'Asia/Shanghai' });

  jobs.set(taskId, task);
  console.log(`[Scheduler] Registered job for task ${taskId}: ${cronExpression}`);
}

export function removeJob(taskId: string) {
  const existing = jobs.get(taskId);
  if (existing) {
    existing.stop();
    jobs.delete(taskId);
    console.log(`[Scheduler] Removed job for task ${taskId}`);
  }
}

export function stopAll() {
  for (const [id, task] of jobs) {
    task.stop();
  }
  jobs.clear();
  console.log('[Scheduler] All jobs stopped');
}

async function executeScheduledTask(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.enabled || task.type !== 'scheduled') {
    removeJob(taskId);
    return;
  }

  // Reset task state for re-execution
  await prisma.taskItem.updateMany({
    where: { taskId, status: { in: ['completed', 'failed'] } },
    data: { status: 'pending', progress: 0, error: null, resultAssetId: null },
  });
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'pending', completedFiles: 0 },
  });

  // Delete previous result assets
  const items = await prisma.taskItem.findMany({ where: { taskId, resultAssetId: { not: null } } });
  for (const item of items) {
    if (item.resultAssetId) {
      await prisma.asset.delete({ where: { id: item.resultAssetId } }).catch(() => {});
    }
  }

  await executeTask(taskId, userId);
}
