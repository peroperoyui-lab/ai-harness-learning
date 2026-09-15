import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_HOSTS, validateBaseUrl, validateKey, validHostHeader, validOrigin } from './security.mjs';
import { buildRequest, validateDemo } from '../web/lib/protocol.js';
import { callUpstream, interpretResult } from './upstream.mjs';
import { redactExact } from '../web/lib/storage.js';

const WEB = path.resolve(fileURLToPath(new URL('../web/', import.meta.url)));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
function send(res, status, value) {
  if (!res.destroyed && !res.writableEnded) res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(value));
}
async function readJSON(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12288) throw new Error('请求超过 12 KB 限制');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('请求必须是有效 JSON'); }
}

/** The dependency injection seam is for offline tests, not user-supplied code. */
export function createApp({ allowedHosts = DEFAULT_HOSTS, upstream = callUpstream, timeoutMs = 20000, now = Date.now } = {}) {
  let active = false, attempts = [];
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    if (!validHostHeader(req)) { send(res, 403, { error: '仅允许本机地址访问' }); req.resume(); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { send(res, 400, { error: '路径无效' }); return; }
    if (pathname === '/api/config' && req.method === 'GET') { send(res, 200, { relay: true, allowedHosts, maxTokens: 256, maxPromptChars: 600, timeoutMs }); return; }
    if (pathname === '/api/demo') {
      if (req.method !== 'POST') { send(res, 405, { error: '只允许 POST' }); req.resume(); return; }
      if (!validOrigin(req)) { send(res, 403, { error: '请求来源不匹配；请从本机学习页面发送' }); req.resume(); return; }
      if (!String(req.headers['content-type']).startsWith('application/json')) { send(res, 415, { error: '只允许 JSON 请求' }); req.resume(); return; }
      if (Number(req.headers['content-length']) > 12288) { send(res, 413, { error: '请求过大' }); req.resume(); return; }
      if (active) { send(res, 429, { error: '已有请求运行中，请停止或等待当前请求结束' }); req.resume(); return; }
      attempts = attempts.filter(time => now() - time < 60000);
      if (attempts.length >= 12) { send(res, 429, { error: '学习模式每分钟最多 12 次尝试' }); req.resume(); return; }
      attempts.push(now()); active = true;
      const controller = new AbortController();
      let key = '';
      const onClose = () => { if (!res.writableEnded) controller.abort(); };
      res.on('close', onClose);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const aborted = new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('请求已停止或超时；已产生的费用不一定撤销')), { once: true });
      });
      try {
        const raw = await Promise.race([readJSON(req), aborted]);
        if (controller.signal.aborted) throw new Error('请求已停止');
        key = validateKey(raw.apiKey);
        const config = validateDemo(raw), base = validateBaseUrl(raw.baseUrl, allowedHosts), request = buildRequest(config);
        const url = new URL(base.href.replace(/\/$/, '') + request.path);
        const result = await Promise.race([upstream({ url, protocol: config.protocol, body: request.body, apiKey: key, signal: controller.signal }), aborted]);
        send(res, 200, JSON.parse(redactExact(JSON.stringify(interpretResult(result, config.task)), key)));
      } catch (error) {
        send(res, controller.signal.aborted ? 408 : 400, { error: redactExact(error instanceof Error ? error.message : '请求失败', key).slice(0, 240) });
      } finally { clearTimeout(timer); res.off('close', onClose); key = ''; active = false; }
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { send(res, 405, { error: '方法不支持' }); req.resume(); return; }
    if (pathname.startsWith('/api/')) { send(res, 404, { error: '接口不存在' }); return; }
    try {
      if (pathname.includes('\\') || pathname.includes('\0')) throw new Error('path');
      const actual = await realpath(path.resolve(WEB, '.' + (pathname === '/' ? '/index.html' : pathname)));
      if (!actual.startsWith(WEB + path.sep) || !TYPES[path.extname(actual)]) throw new Error('path');
      const body = await readFile(actual);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(actual)] });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { send(res, 404, { error: '页面不存在' }); }
  });
  server.headersTimeout = 10000; server.requestTimeout = 25000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hosts = [...DEFAULT_HOSTS];
  let port = 4173;
  for (const arg of process.argv.slice(2)) {
    if (/^--port=\d+$/.test(arg)) port = Number(arg.split('=')[1]);
    else if (arg.startsWith('--allow-host=')) {
      const host = arg.slice(13).toLowerCase();
      if (!/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) || !host.includes('.') || /^\d+[.\d]*$/.test(host)) throw new Error('自定义主机名无效');
      hosts.push(host);
    } else throw new Error(`未知启动参数：${arg}`);
  }
  if (port < 1024 || port > 65535) throw new Error('端口须为 1024–65535');
  const server = createApp({ allowedHosts: [...new Set(hosts)] });
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? '端口被占用，请使用 npm start -- --port=4174' : '本机服务启动失败'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Harness Lab 已启动：http://127.0.0.1:${port}\n课程与模拟无需密钥。按 Ctrl+C 完全停止服务。`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); server.closeAllConnections(); });
}
