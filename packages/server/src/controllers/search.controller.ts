import { Request, Response } from 'express';
import * as searchService from '../services/search.service';

export async function searchAssets(req: Request, res: Response) {
  try {
    const { q, fileType, status, from, to, page, pageSize } = req.query as any;
    const results = await searchService.searchAssets(((req as any).user).userId, {
      q,
      fileType,
      status,
      from,
      to,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
    res.json(results);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
