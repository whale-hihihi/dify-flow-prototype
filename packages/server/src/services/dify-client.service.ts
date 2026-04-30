import http from 'http';
import https from 'https';

const DIFY_MODES = ['workflow', 'completion', 'chat'] as const;

function normalizeMode(mode: string): string {
  if (mode === 'advanced-chat' || mode === 'agent-chat') return 'chat';
  if ((DIFY_MODES as readonly string[]).includes(mode)) return mode;
  return 'chat';
}

export async function fetchDifyParameters(
  endpoint: string,
  apiKey: string,
): Promise<{ userInputForm: any[] }> {
  const baseUrl = endpoint.replace(/\/$/, '') + '/';
  const headers = { Authorization: `Bearer ${apiKey}` };
  try {
    const paramsUrl = new URL('parameters', baseUrl);
    const paramsRaw = await httpGet(paramsUrl, headers);
    const paramsJson = JSON.parse(paramsRaw);
    return { userInputForm: paramsJson?.user_input_form || [] };
  } catch {
    return { userInputForm: [] };
  }
}

function isSourceField(variable: string, label: string): boolean {
  const name = (variable || '').toLowerCase();
  const lbl = (label || '').toLowerCase();
  const sourceKw = ['content', 'source', 'document', 'body', 'article', 'passage'];
  return sourceKw.some(k => name.includes(k) || lbl.includes(k));
}

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

async function chatWithDifyAgentOnce(
  endpoint: string,
  apiKey: string,
  message: string,
  mode: string,
  textFileContent?: string,
  onProgress?: (progress: number) => void,
  customInputs?: Record<string, any>,
): Promise<{ answer: string }> {
  const baseUrl = endpoint.replace(/\/$/, '') + '/';
  const headers = { Authorization: `Bearer ${apiKey}` };

  // Fetch agent parameters to discover input variables
  let inputs: Record<string, any> = {};
  const fileInputs: Array<{ key: string; type: 'file-list' | 'single-file' }> = [];
  try {
    const paramsUrl = new URL('parameters', baseUrl);
    const paramsRaw = await httpGet(paramsUrl, headers);
    const paramsJson = JSON.parse(paramsRaw);
    console.log('[chatWithDifyAgent] parameters:', JSON.stringify(paramsJson).slice(0, 500));
    const userInput = paramsJson?.user_input_form;
    if (Array.isArray(userInput)) {
      // Parse all fields and classify by type
      const allFields: Array<{ varName: string; label: string; fieldType: string; fieldDef: any }> = [];

      for (const field of userInput) {
        const typeKey = Object.keys(field)[0];
        const fieldDef = field[typeKey];
        if (!typeKey || !fieldDef) continue;
        const varName = fieldDef.variable || typeKey;
        const fieldType = fieldDef.type || typeKey;
        const label = fieldDef.label || varName;

        if (fieldType === 'file-list' || fieldType === 'single-file') {
          fileInputs.push({ key: varName, type: fieldType });
        } else {
          allFields.push({ varName, label, fieldType, fieldDef });
        }
      }

      // Fill each field: customInputs > auto-detect source fields > default
      const sourceText = textFileContent || '';
      const prompt = message || '';
      const hasCustomInputs = customInputs && Object.keys(customInputs).length > 0;

      for (const f of allFields) {
        // User provided value takes priority
        if (customInputs?.[f.varName] !== undefined && customInputs[f.varName] !== '') {
          inputs[f.varName] = customInputs[f.varName];
        } else if (isSourceField(f.varName, f.label)) {
          // Source field: auto-fill with file content, fallback to prompt, then default
          inputs[f.varName] = sourceText || prompt || (f.fieldDef?.default ?? '');
        } else if (!hasCustomInputs && prompt) {
          // No customInputs (I/O test): fill first non-source field with prompt
          if (!Object.values(inputs).some(v => v === prompt)) {
            inputs[f.varName] = prompt;
          } else {
            inputs[f.varName] = f.fieldDef?.default ?? '';
          }
        } else {
          // All other fields: use default
          inputs[f.varName] = f.fieldDef?.default ?? '';
        }
      }

      console.log('[chatWithDifyAgent] mapped inputs:', JSON.stringify(inputs, null, 2));
    }
  } catch (e: any) {
    console.log('[chatWithDifyAgent] parameters fetch failed:', e.message);
  }

  // Fallback: if no inputs discovered
  if (Object.keys(inputs).length === 0 && fileInputs.length === 0) {
    if (mode === 'workflow') {
      const combined = message + (textFileContent ? '\n\n' + textFileContent : '');
      inputs = { input: combined, query: combined, text: combined };
    } else {
      inputs = { query: message };
    }
    console.log('[chatWithDifyAgent] no inputs from parameters, using fallback:', JSON.stringify(Object.keys(inputs)));
  }

  // If workflow with file input, upload text as .txt file to Dify
  if (mode === 'workflow' && fileInputs.length > 0 && textFileContent) {
    try {
      const fileId = await uploadFileToDify(
        baseUrl, apiKey,
        Buffer.from(textFileContent, 'utf-8'),
        'input.txt',
        'text/plain',
      );
      console.log('[chatWithDifyAgent] uploaded text file ->', fileId);
      for (const fi of fileInputs) {
        const fileRef = { type: 'document', transfer_method: 'local_file', upload_file_id: fileId };
        inputs[fi.key] = fi.type === 'single-file' ? fileRef : [fileRef];
      }
    } catch (e: any) {
      console.log('[chatWithDifyAgent] file upload failed:', e.message);
      for (const fi of fileInputs) {
        inputs[fi.key] = textFileContent;
      }
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

  console.log('[chatWithDifyAgent] mode=%s url=%s body=%s', mode, baseUrl + path, body.slice(0, 300));

  return new Promise((resolve, reject) => {
    try {
      const url = new URL(path, baseUrl);
      const mod = url.protocol === 'https:' ? https : http;
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        timeout: 300000,
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
            reject(new Error(`Dify API error: ${res.statusCode} ${raw.slice(0, 300)}`));
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
                    fullAnswer = outputs?.text || outputs?.result || outputs?.output || (outputs ? Object.values(outputs)[0] as string : '') || JSON.stringify(outputs);
                  }
                } else {
                  // chat / completion mode
                  if (event.event === 'agent_message' || event.event === 'message') {
                    fullAnswer += event.answer || '';
                    chunkCount++;
                    if (onProgress) {
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

export async function chatWithDifyAgent(
  endpoint: string,
  apiKey: string,
  message: string,
  mode: string,
  textFileContent?: string,
  onProgress?: (progress: number) => void,
  onModeDetected?: (correctMode: string) => Promise<void>,
  customInputs?: Record<string, any>,
): Promise<{ answer: string }> {
  const normalizedMode = normalizeMode(mode);
  const modesToTry = [normalizedMode, ...DIFY_MODES.filter(m => m !== normalizedMode)];

  let lastError: Error | null = null;
  for (const tryMode of modesToTry) {
    try {
      const result = await chatWithDifyAgentOnce(endpoint, apiKey, message, tryMode, textFileContent, onProgress, customInputs);
      // If the mode was auto-detected (different from original), notify caller
      if (tryMode !== normalizedMode && onModeDetected) {
        await onModeDetected(tryMode);
      }
      return result;
    } catch (err: any) {
      const errMsg = err.message || '';
      const isModeError = errMsg.includes('Dify API error: 404')
        || errMsg.includes('not_workflow_app')
        || errMsg.includes('not_chat_app')
        || errMsg.includes('not_completion_app')
        || errMsg.includes('app mode matches');
      if (!isModeError) throw err;
      lastError = err;
      console.log(`[chatWithDifyAgent] mode=${tryMode} failed: ${errMsg.slice(0, 100)}, trying next...`);
    }
  }
  throw new Error(`所有 Dify 端点均失败。API Key 可能无效或应用不存在。已尝试: ${modesToTry.join(', ')}`);
}
