import http from 'http';
import https from 'https';

export async function testDifyConnection(difyUrl: string, apiKey?: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  return new Promise((resolve) => {
    try {
      const url = new URL('/parameters', difyUrl.replace(/\/$/, ''));
      const mod = url.protocol === 'https:' ? https : http;
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        timeout: 10000,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      };

      const req = mod.request(options, (res) => {
        res.resume(); // consume response body
        if (res.statusCode && res.statusCode < 500) {
          resolve({ success: true, latencyMs: Date.now() - start });
        } else {
          resolve({ success: false, latencyMs: Date.now() - start, error: `HTTP ${res.statusCode}` });
        }
      });

      req.on('error', (err) => {
        resolve({ success: false, latencyMs: Date.now() - start, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, latencyMs: Date.now() - start, error: 'Connection timeout' });
      });

      req.end();
    } catch (err: any) {
      resolve({ success: false, latencyMs: Date.now() - start, error: err.message });
    }
  });
}
