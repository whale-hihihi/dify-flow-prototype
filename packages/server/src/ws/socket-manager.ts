import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { verifyToken } from '../utils/jwt';

const clients = new Map<string, Set<WebSocket>>();

export function initWSS(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (!token) {
        ws.close(4001, 'Missing token');
        return;
      }

      const payload = verifyToken(token);
      const userId = payload.userId;

      if (!clients.has(userId)) clients.set(userId, new Set());
      clients.get(userId)!.add(ws);

      ws.on('close', () => {
        clients.get(userId)?.delete(ws);
        if (clients.get(userId)?.size === 0) clients.delete(userId);
      });
    } catch {
      ws.close(4001, 'Authentication failed');
    }
  });
}

export function broadcastToUser(userId: string, event: object) {
  const sockets = clients.get(userId);
  if (!sockets) return;
  const message = JSON.stringify(event);
  sockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}
