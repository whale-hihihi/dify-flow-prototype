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
  onProgress?: (progress: number) => void,
): Promise<{ answer: string }> {
  const baseUrl = endpoint.replace(/\/$/, '') + '/';
  const headers = { Authorization: `Bearer ${apiKey}` };

  // Fetch agent parameters to discover input variables
  let inputs: Record<string, any> = {};
  let fileInputKey: string | null = null;
  let fileInputType: 'file-list' | 'single-file' | null = null;
  try {
    const paramsUrl = new URL('parameters', baseUrl);
    const paramsRaw = await httpGet(paramsUrl, headers);
    const paramsJson = JSON.parse(paramsRaw);
    console.log('[chatWithDifyAgent] parameters:', JSON.stringify(paramsJson).slice(0, 500));
    const userInput = paramsJson?.user_input_form;
    if (Array.isArray(userInput)) {
      for (const field of userInput) {
        const key = Object.keys(field)[0];
        const fieldDef = field[key];
        if (!key) continue;
        if (fieldDef?.type === 'file-list' || fieldDef?.type === 'single-file') {
          fileInputKey = key;
          fileInputType = fieldDef.type;
        } else {
          inputs[key] = message;
        }
      }
    }
  } catch (e: any) {
    console.log('[chatWithDifyAgent] parameters fetch failed:', e.message);
  }

  // Fallback: if no inputs discovered, use a sensible default
  if (Object.keys(inputs).length === 0 && !fileInputKey) {
    inputs = { query: message };
    console.log('[chatWithDifyAgent] no inputs from parameters, using fallback: { query }');
  }

  // If workflow with file input, upload text as .txt file to Dify
  if (mode === 'workflow' && fileInputKey && textFileContent) {
    try {
      const fileId = await uploadFileToDify(
        baseUrl, apiKey,
        Buffer.from(textFileContent, 'utf-8'),
        'input.txt',
        'text/plain',
      );
      console.log('[chatWithDifyAgent] uploaded text file ->', fileId);
      if (fileInputType === 'single-file') {
        inputs[fileInputKey] = { type: 'document', transfer_method: 'local_file', upload_file_id: fileId };
      } else {
        inputs[fileInputKey] = [{ type: 'document', transfer_method: 'local_file', upload_file_id: fileId }];
      }
    } catch (e: any) {
      console.log('[chatWithDifyAgent] file upload failed:', e.message);
      // Fallback: put text content directly in the input as plain text
      inputs[fileInputKey] = textFileContent;
    }
  }

  let path: string;
  let body: string;

  if (mode === 'workflow') {
    path = 'workflows/run';
    body = JSON.stringify({ inputs, response_mode: 'streaming', user: 'difyflow-test' });
  } else if (mode === 'completion') {
    path = 'completion-messages';
    body = JSON.stringify({ inputs, query: message, response_mode: 'streaming', user: 'difyflow-test' });
  } else {
    path = 'chat-messages';
    body = JSON.stringify({ inputs, query: message, response_mode: 'streaming', user: 'difyflow-test' });
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
        timeout: 120000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = mod.request(options, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            reject(new Error(`Dify API error: ${res.statusCode} ${raw.slice(0, 200)}`));
          });
          return;
        }

        // SSE parsing state
        let buffer = '';
        let fullAnswer = '';
        let nodeFinished = 0;
        let totalNodes = 1;
        let chunkCount = 0;

        res.on('data', (chunk) => {
          buffer += chunk.toString('utf-8');
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const jsonStr = line.slice(5).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const event = JSON.parse(jsonStr);

                if (mode === 'workflow') {
                  if (event.event === 'workflow_started') {
                    totalNodes = Math.max(1, event.data?.total_nodes || 1);
                  } else if (event.event === 'node_finished') {
                    nodeFinished++;
                    if (onProgress) {
                      onProgress(Math.min(95, Math.round((nodeFinished / totalNodes) * 95)));
                    }
                  } else if (event.event === 'workflow_finished') {
                    const outputs = event.data?.outputs;
                    fullAnswer = outputs?.text || outputs?.result || JSON.stringify(outputs);
                  }
                } else {
                  // chat / completion mode
                  if (event.event === 'agent_message' || event.event === 'message') {
                    fullAnswer += event.answer || '';
                    chunkCount++;
                    if (onProgress) {
                      // Estimate progress: first chunk = 10%, then asymptotically approach 95%
                      onProgress(Math.min(95, 10 + Math.round(85 * (1 - Math.exp(-chunkCount / 8)))));
                    }
                  } else if (event.event === 'message_end') {
                    if (!fullAnswer && event.answer) fullAnswer = event.answer;
                  }
                }
              } catch { /* skip malformed SSE */ }
            }
          }
        });

        res.on('end', () => {
          if (!fullAnswer) {
            // Fallback: try to parse buffer as a single JSON (non-streaming response)
            try {
              const json = JSON.parse(buffer);
              fullAnswer = json.answer || json.data?.outputs?.text || JSON.stringify(json);
            } catch {
              fullAnswer = buffer.slice(0, 2000);
            }
          }
          resolve({ answer: fullAnswer });
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
