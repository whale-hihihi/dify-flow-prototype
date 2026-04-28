import { Request, Response } from 'express';
import * as difyConfigService from '../services/dify-config.service';

export async function getConfig(req: Request, res: Response) {
  try {
    const config = await difyConfigService.getConfig(((req as any).user).userId);
    res.json(config);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function upsertConfig(req: Request, res: Response) {
  try {
    const { difyUrl } = req.body;
    if (!difyUrl) return res.status(400).json({ error: 'difyUrl is required' });
    const config = await difyConfigService.upsertConfig(((req as any).user).userId, difyUrl);
    res.json(config);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function testConnection(req: Request, res: Response) {
  try {
    const { difyUrl } = req.body;
    const result = await difyConfigService.testConfig(((req as any).user).userId, difyUrl);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
