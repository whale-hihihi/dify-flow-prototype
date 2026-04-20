import { getParser } from '../parsers/parser-factory';
import { prisma } from '../config/database';
import { broadcastToUser } from '../ws/socket-manager';
import { MAX_CONCURRENT_PARSE } from '../config/constants';

let running = 0;
const queue: { assetId: string; filePath: string; fileType: string; userId: string }[] = [];

export function enqueueParseJob(assetId: string, filePath: string, fileType: string, userId: string) {
  queue.push({ assetId, filePath, fileType, userId });
  processQueue();
}

function processQueue() {
  while (queue.length > 0 && running < MAX_CONCURRENT_PARSE) {
    running++;
    const job = queue.shift()!;
    processJob(job).finally(() => {
      running--;
      processQueue();
    });
  }
}

async function processJob(job: { assetId: string; filePath: string; fileType: string; userId: string }) {
  try {
    await prisma.asset.update({
      where: { id: job.assetId },
      data: { status: 'parsing' },
    });
    broadcastToUser(job.userId, {
      type: 'asset:status',
      payload: { id: job.assetId, status: 'parsing' },
    });

    const parser = getParser(job.fileType);
    const parsedText = await parser.parse(job.filePath);

    await prisma.asset.update({
      where: { id: job.assetId },
      data: { parsedText, status: 'ready' },
    });
    broadcastToUser(job.userId, {
      type: 'asset:status',
      payload: { id: job.assetId, status: 'ready' },
    });
  } catch (err: any) {
    await prisma.asset.update({
      where: { id: job.assetId },
      data: { status: 'failed', errorMessage: err.message },
    });
    broadcastToUser(job.userId, {
      type: 'asset:status',
      payload: { id: job.assetId, status: 'failed', error: err.message },
    });
  }
}
