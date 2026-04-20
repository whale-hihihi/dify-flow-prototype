import { Request, Response } from 'express';
import * as agentService from '../services/agent.service';

export async function listAgents(req: Request, res: Response) {
  try {
    const agents = await agentService.listAgents(((req as any).user).userId);
    res.json(agents);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getAgent(req: Request, res: Response) {
  try {
    const agent = await agentService.getAgent(((req as any).user).userId, req.params.id);
    res.json(agent);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
}

export async function createAgent(req: Request, res: Response) {
  try {
    const agent = await agentService.createAgent(((req as any).user).userId, req.body);
    res.status(201).json(agent);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateAgent(req: Request, res: Response) {
  try {
    const agent = await agentService.updateAgent(((req as any).user).userId, req.params.id, req.body);
    res.json(agent);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteAgent(req: Request, res: Response) {
  try {
    await agentService.deleteAgent(((req as any).user).userId, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function testAgentConnection(req: Request, res: Response) {
  try {
    const result = await agentService.testAgentConnection(((req as any).user).userId, req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function checkOnline(req: Request, res: Response) {
  try {
    const agents = await agentService.checkAgentsOnline(((req as any).user).userId);
    res.json(agents);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function chatTest(req: Request, res: Response) {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const result = await agentService.chatTest(((req as any).user).userId, req.params.id, message);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
