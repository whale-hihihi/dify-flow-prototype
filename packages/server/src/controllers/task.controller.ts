import { Request, Response } from 'express';
import * as taskService from '../services/task.service';

export async function createTask(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const { name, type, agentId, assetIds, prompt, cronExpression } = req.body;
    if (!name || !agentId || !assetIds?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const task = await taskService.createTask(userId, { name, type, agentId, assetIds, prompt, cronExpression });
    res.status(201).json(task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function listTasks(req: Request, res: Response) {
  try {
    const tasks = await taskService.listTasks((req as any).user.userId, req.query.status as string);
    res.json(tasks);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getTask(req: Request, res: Response) {
  try {
    const task = await taskService.getTask((req as any).user.userId, req.params.id);
    res.json(task);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
}

export async function retryTask(req: Request, res: Response) {
  try {
    await taskService.retryTask((req as any).user.userId, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function cancelTask(req: Request, res: Response) {
  try {
    await taskService.cancelTask((req as any).user.userId, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteTask(req: Request, res: Response) {
  try {
    await taskService.deleteTask((req as any).user.userId, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function toggleScheduled(req: Request, res: Response) {
  try {
    const { enabled } = req.body;
    const task = await taskService.toggleScheduledTask((req as any).user.userId, req.params.id, enabled);
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
