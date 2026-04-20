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
        res.resume();
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

function httpGet(url: URL, headers: Record<string, string>): Promise<string> {
  const mod = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request({
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: 'GET', timeout: 10000, headers,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// Upload a binary file to Dify's file upload API, returns upload_file_id
async function uploadFileToDify(baseUrl: string, apiKey: string, fileBuffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const boundary = '----FormBoundary' + Date.now();

  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([prefix, fileBuffer, suffix]);

  const url = new URL('files/upload', baseUrl);
  const mod = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = mod.request({
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: 'POST', timeout: 30000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        try {
          const json = JSON.parse(raw);
          if (json.id) resolve(json.id);
          else reject(new Error(`Upload failed: ${raw.slice(0, 200)}`));
        } catch { reject(new Error(`Upload parse error: ${raw.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Upload timeout')); });
    req.write(body);
    req.end();
  });
}

async function uploadTextAsFile(baseUrl: string, apiKey: string, content: string, filename: string): Promise<string> {
  return uploadFileToDify(baseUrl, apiKey, Buffer.from(content, 'utf-8'), filename, 'text/plain');
}

export async function chatWithDifyAgent(
  endpoint: string,
  apiKey: string,
  message: string,
  mode: string,
  textFileContent?: string,
): Promise<{ answer: string }> {
  const baseUrl = endpoint.replace(/\/$/, '') + '/';
  const headers = { Authorization: `Bearer ${apiKey}` };

  // Fetch agent parameters to discover input variables
  let inputs: Record<string, any> = {};
  let fileListKey: string | null = null;
  try {
    const paramsUrl = new URL('parameters', baseUrl);
    const paramsRaw = await httpGet(paramsUrl, headers);
    const paramsJson = JSON.parse(paramsRaw);
    const userInput = paramsJson?.user_input_form;
    if (Array.isArray(userInput)) {
      for (const field of userInput) {
        const key = Object.keys(field)[0];
        const fieldDef = field[key];
        if (!key) continue;
        if (fieldDef?.type === 'file-list') {
          fileListKey = key;
        } else {
          inputs[key] = message;
        }
      }
    }
  } catch { /* ignore */ }

  // If workflow with file-list input, upload text as .txt file to Dify
  if (mode === 'workflow' && fileListKey && textFileContent) {
    try {
      const fileId = await uploadFileToDify(
        baseUrl, apiKey,
        Buffer.from(textFileContent, 'utf-8'),
        'input.txt',
        'text/plain',
      );
      console.log('[chatWithDifyAgent] uploaded text file ->', fileId);
      inputs[fileListKey] = [{ type: 'document', transfer_method: 'local_file', upload_file_id: fileId }];
    } catch (e: any) {
      console.log('[chatWithDifyAgent] file upload failed:', e.message);
    }
  }

  let path: string;
  let body: string;

  if (mode === 'workflow') {
    path = 'workflows/run';
    // workflow mode: no query field, inputs carry all data
    body = JSON.stringify({ inputs, response_mode: 'blocking', user: 'difyflow-test' });
  } else if (mode === 'completion') {
    path = 'completion-messages';
    body = JSON.stringify({ inputs, query: message, response_mode: 'blocking', user: 'difyflow-test' });
  } else {
    path = 'chat-messages';
    body = JSON.stringify({ inputs, query: message, response_mode: 'blocking', user: 'difyflow-test' });
  }

  console.log('[chatWithDifyAgent] mode=%s url=%s body=%s', mode, baseUrl + path, body);

  return new Promise((resolve, reject) => {
    try {
      const url = new URL(path, baseUrl);
      const mod = url.protocol === 'https:' ? https : http;
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        timeout: 30000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = mod.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Dify API error: ${res.statusCode} ${raw.slice(0, 200)}`));
            return;
          }
          try {
            const json = JSON.parse(raw);
            resolve({ answer: json.answer || json.data?.outputs?.text || JSON.stringify(json) });
          } catch {
            resolve({ answer: raw.slice(0, 2000) });
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      req.write(body);
      req.end();
    } catch (err: any) {
      reject(err);
    }
  });
}
