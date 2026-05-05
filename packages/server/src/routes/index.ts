import { Router, Request, Response } from 'express';
import http from 'http';
import authRoutes from './auth.routes';
import difyConfigRoutes from './dify-config.routes';
import agentRoutes from './agent.routes';
import assetRoutes from './asset.routes';
import folderRoutes from './folder.routes';
import searchRoutes from './search.routes';
import taskRoutes from './task.routes';
import templateRoutes from './template.routes';
import trashRoutes from './trash.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dify-config', difyConfigRoutes);
router.use('/agents', agentRoutes);
router.use('/assets', assetRoutes);
router.use('/folders', folderRoutes);
router.use('/trash', trashRoutes);
router.use('/search', searchRoutes);
router.use('/tasks', taskRoutes);
router.use('/templates', templateRoutes);

// Proxy to Python NLG→DSL generator (port 5000)
function proxyToPython(req: Request, res: Response) {
  // Map /generator/xxx → /api/xxx for the Python backend
  const pythonPath = req.path.replace(/^\/generator/, '/api');
  const body = JSON.stringify(req.body);
  const options: http.RequestOptions = {
    hostname: 'localhost',
    port: 5000,
    path: pythonPath,
    method: req.method,
    timeout: 300000,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const proxy = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode || 500);
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
    proxyRes.pipe(res);
  });

  proxy.on('error', () => {
    res.status(502).json({ error: 'Python 生成器服务未启动，请运行: cd nlg-to-dsl && python web_app.py' });
  });
  proxy.on('timeout', () => {
    proxy.destroy();
    res.status(504).json({ error: 'Python 生成器响应超时' });
  });

  proxy.write(body);
  proxy.end();
}

router.post('/generator/chat', (req, res) => proxyToPython(req, res));
router.get('/generator/dsl/:sessionId', (req, res) => proxyToPython(req, res));

export default router;
