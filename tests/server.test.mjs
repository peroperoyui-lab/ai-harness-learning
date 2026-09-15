import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createApp } from '../server/index.mjs';
import { publicIPv4, validateBaseUrl, resolvePublic } from '../server/security.mjs';
const demo = { protocol: 'responses', model: 'test-model', prompt: '解释 Harness', maxTokens: 128, task: 'explain', baseUrl: 'https://api.openai.com/v1', apiKey: 'test-key-not-real' };
const reply = { text: 'hello', calls: [], usage: { input: 12, output: 3, cached: null }, finish: 'completed' };
async function app(t, options = {}) {
  const server = createApp({ upstream: async () => reply, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const post = (body = demo, extra = {}) => fetch(base + '/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, 'X-Harness-Client': '1', ...extra.headers }, body: JSON.stringify(body), signal: extra.signal });
  return { base, post, server };
}
for (const ip of ['127.0.0.1', '10.0.0.1', '0.0.0.0', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '198.18.0.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '::1']) test(`reject non-public address ${ip}`, () => assert.equal(publicIPv4(ip), false));
test('accept ordinary public IPv4', () => assert.equal(publicIPv4('93.184.216.34'), true));
for (const url of ['http://api.openai.com/v1', 'https://127.0.0.1/v1', 'https://api.openai.com:8443/v1', 'https://user:pass@api.openai.com/v1', 'https://api.openai.com/v1?key=x', 'https://api.openai.com/v1#x', 'https://unapproved.example/v1', 'https://api.openai.com/v1/responses']) test(`reject invalid destination ${url}`, () => assert.throws(() => validateBaseUrl(url)));
test('allow explicit custom host but not implicit wildcard', () => { assert.equal(validateBaseUrl('https://llm.example/v1', ['llm.example']).hostname, 'llm.example'); assert.throws(() => validateBaseUrl('https://sub.llm.example/v1', ['llm.example'])); });
test('reject DNS rebinding/private answer mixed with public answer', async () => { await assert.rejects(resolvePublic('example.org', async () => [{ address: '93.184.216.34' }, { address: '127.0.0.1' }])); assert.equal(await resolvePublic('example.org', async () => [{ address: '93.184.216.34' }]), '93.184.216.34'); });
test('serves application shell and scripts with security headers', async t => {
  const { base } = await app(t);
  const response = await fetch(base); assert.equal(response.status, 200); assert.match(await response.text(), /Harness Lab/); assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.equal((await fetch(base + '/app.js')).status, 200);
});
test('never serves repository files or traversal paths', async t => {
  const { base } = await app(t);
  for (const route of ['/server/index.mjs', '/.env', '/package.json', '/..%2fserver%2findex.mjs', '/%2e%2e%5cserver%5cindex.mjs']) assert.equal((await fetch(base + route)).status, 404, route);
});
test('configuration exposes only limits and allowed hosts', async t => { const { base } = await app(t); const result = await (await fetch(base + '/api/config')).json(); assert.equal(result.relay, true); assert.ok(!JSON.stringify(result).includes(demo.apiKey)); });
test('one valid request uses the shared serializer and fake upstream', async t => {
  let calls = 0;
  const { post } = await app(t, { upstream: async request => { calls++; assert.equal(request.url.href, 'https://api.openai.com/v1/responses'); assert.equal(request.body.max_output_tokens, 128); assert.equal(request.apiKey, demo.apiKey); return reply; } });
  const response = await post(); assert.equal(response.status, 200); assert.equal((await response.json()).text, 'hello'); assert.equal(calls, 1);
});
test('cross-origin and missing custom header requests are denied', async t => { const { post } = await app(t); assert.equal((await post(demo, { headers: { Origin: 'https://evil.example' } })).status, 403); assert.equal((await post(demo, { headers: { 'X-Harness-Client': '' } })).status, 403); });
test('bad Host header is denied even on loopback', async t => {
  const { base } = await app(t);
  const status = await new Promise((resolve, reject) => { const req = http.get(base, { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); });
  assert.equal(status, 403);
});
test('server enforces budget and input size even if UI is bypassed', async t => { let calls = 0; const { post } = await app(t, { upstream: async () => { calls++; return reply; } }); assert.equal((await post({ ...demo, maxTokens: 999 })).status, 400); assert.equal((await post({ ...demo, prompt: 'x'.repeat(601) })).status, 400); assert.equal((await post({ ...demo, prompt: 'x'.repeat(13000) })).status, 413); assert.equal(calls, 0); });
test('only one request may run concurrently', async t => {
  let release, started;
  const start = new Promise(resolve => { started = resolve; });
  const { post } = await app(t, { upstream: async () => { started(); await new Promise(resolve => { release = resolve; }); return reply; } });
  const first = post(); await start;
  assert.equal((await post()).status, 429); release(); assert.equal((await first).status, 200);
});
test('timeout aborts upstream and does not retry', async t => {
  let aborted = false, calls = 0;
  const { post } = await app(t, { timeoutMs: 50, upstream: async ({ signal }) => { calls++; signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); } });
  assert.equal((await post()).status, 408); assert.equal(aborted, true); assert.equal(calls, 1);
});
test('client disconnect propagates cancellation', async t => {
  let started, aborted;
  const ready = new Promise(resolve => { started = resolve; }), stopped = new Promise(resolve => { aborted = resolve; });
  const { post } = await app(t, { upstream: async ({ signal }) => { signal.addEventListener('abort', aborted); started(); return new Promise(() => {}); } });
  const controller = new AbortController(), request = post(demo, { signal: controller.signal });
  await ready; controller.abort(); await assert.rejects(request);
  await Promise.race([stopped, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('cancel did not propagate')), 1000); timer.unref(); })]);
});
test('key echoed by fake upstream is redacted from response', async t => { const { post } = await app(t, { upstream: async () => ({ ...reply, text: 'echo ' + demo.apiKey }) }); const response = await post(); assert.ok(!(await response.text()).includes(demo.apiKey)); });
test('thirteenth attempt in a minute is rate-limited', async t => { const { post } = await app(t); for (let i = 0; i < 12; i++) assert.equal((await post()).status, 200); assert.equal((await post()).status, 429); });
