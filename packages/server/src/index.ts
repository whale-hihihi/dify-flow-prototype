import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { initWSS } from './ws/socket-manager';

const server = http.createServer(app);
initWSS(server);

server.listen(env.PORT, () => {
  console.log(`DifyFlow server running on http://localhost:${env.PORT}`);
});
