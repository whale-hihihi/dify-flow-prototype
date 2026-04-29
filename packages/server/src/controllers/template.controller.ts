import { Request, Response } from 'express';
import { listTemplates } from '../services/template.service';

export async function getTemplates(req: Request, res: Response) {
  const category = req.query.category as string | undefined;
  const templates = listTemplates(category);
  res.json(templates);
}
