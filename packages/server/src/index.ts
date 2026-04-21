import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { initWSS } from './ws/socket-manager';
import { initScheduler, stopAll as stopScheduler } from './services/scheduler.service';

const server = http.createServer(app);
initWSS(server);

server.listen(env.PORT, async () => {
  console.log(`DifyFlow server running on http://localhost:${env.PORT}`);
  await initScheduler();
});

process.on('SIGTERM', () => {
  stopScheduler();
  server.close();
});

process.on('SIGINT', () => {
  stopScheduler();
  server.close();
  process.exit(0);
});
