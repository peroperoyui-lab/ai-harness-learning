import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, normalizeResponse, validateDemo, PROTOCOLS } from '../web/lib/protocol.js';
import { interpretResult } from '../server/upstream.mjs';
const input = { protocol: 'responses', model: 'test-model', prompt: '解释 Harness', maxTokens: 128, task: 'explain' };
for (const [protocol, preset] of Object.entries(PROTOCOLS)) {
  test(`${protocol}: correct endpoint budget and minimal defaults`, () => {
    const request = buildRequest({ ...input, protocol });
    assert.equal(request.path, preset.path); assert.equal(request.body[preset.limit], 128); assert.equal(request.body.stream, false); assert.equal(request.body.model, 'test-model');
    assert.ok(!('temperature' in request.body)); assert.ok(!('apiKey' in request.body));
    if (protocol === 'responses') { assert.equal(request.body.store, false); assert.ok(request.body.instructions); assert.equal(request.body.input.length, 1); }
    else if (protocol === 'anthropic') { assert.ok(request.body.system); assert.equal(request.body.messages[0].role, 'user'); }
    else assert.equal(request.body.messages[0].role, 'system');
  });
  test(`${protocol}: tools use expected nested schema`, () => {
    const body = buildRequest({ ...input, protocol, task: 'tool' }).body;
    const tool = body.tools[0];
    const schema = protocol === 'anthropic' ? tool.input_schema : protocol === 'responses' ? tool.parameters : tool.function.parameters;
    assert.equal(schema.additionalProperties, false); assert.deepEqual(schema.required, ['operation', 'a', 'b']);
  });
}
for (const [name, patch] of [['unknown protocol', { protocol: 'bad' }], ['empty model', { model: '' }], ['large prompt', { prompt: 'x'.repeat(601) }], ['large output budget', { maxTokens: 4096 }], ['partial history', { history: [{ role: 'user', content: 'hi' }] }], ['invalid history role', { history: [{ role: 'system', content: 'x' }, { role: 'assistant', content: 'x' }] }], ['long history', { history: [{ role: 'user', content: 'x'.repeat(401) }, { role: 'assistant', content: 'x' }] }], ['tool history', { task: 'tool', history: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'x' }] }]]) {
  test(`budget contract rejects ${name}`, () => assert.throws(() => validateDemo({ ...input, ...patch })));
}
test('previous complete pair is explicit and bounded', () => { const body = buildRequest({ ...input, history: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }] }).body; assert.equal(body.input.length, 3); });
test('normalizes Chat text tools and usage', () => {
  const result = normalizeResponse('chat-compatible', { choices: [{ message: { content: 'hi', tool_calls: [{ id: 'c', function: { name: 'calculator', arguments: '{}' } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 10, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 4 } } });
  assert.equal(result.text, 'hi'); assert.equal(result.calls[0].name, 'calculator'); assert.deepEqual(result.usage, { input: 10, output: 2, cached: 4, cacheCreation: null });
});
test('normalizes Responses output and tool calls', () => { const r = normalizeResponse('responses', { output: [{ type: 'message', content: [{ type: 'output_text', text: 'hello' }] }, { type: 'function_call', name: 'calculator', arguments: '{}', call_id: 'c' }], status: 'completed', usage: { input_tokens: 12, output_tokens: 4 } }); assert.equal(r.text, 'hello'); assert.equal(r.calls[0].id, 'c'); assert.equal(r.usage.input, 12); });
test('normalizes Anthropic content and cache fields without inventing totals', () => { const r = normalizeResponse('anthropic', { content: [{ type: 'text', text: 'hi' }, { type: 'tool_use', name: 'calculator', id: 'c', input: {} }], usage: { input_tokens: 5, output_tokens: 2, cache_creation_input_tokens: 4, cache_read_input_tokens: 3 }, stop_reason: 'tool_use' }); assert.equal(r.usage.input, 5); assert.equal(r.usage.cached, 3); assert.equal(r.usage.cacheCreation, 4); });
test('missing usage remains unknown rather than zero', () => { const r = normalizeResponse('responses', { output: [] }); assert.equal(r.usage.input, null); assert.equal(r.usage.output, null); });
test('rejects error and malformed responses', () => { assert.throws(() => normalizeResponse('responses', { error: {} })); assert.throws(() => normalizeResponse('anthropic', {})); assert.throws(() => normalizeResponse('chat-compatible', {})); });
const toolReply = { text: '', calls: [{ name: 'calculator', arguments: '{"operation":"multiply","a":23,"b":7}', id: '1' }], usage: {}, finish: 'tool_calls' };
test('one allowed tool proposal executes actual calculator', () => { assert.equal(interpretResult(toolReply, 'tool').toolResult, 161); });
test('unregistered or multiple tools never execute', () => { assert.equal(interpretResult({ ...toolReply, calls: [{ name: 'shell', arguments: '{}' }] }, 'tool').toolResult, null); assert.equal(interpretResult({ ...toolReply, calls: [...toolReply.calls, ...toolReply.calls] }, 'tool').toolResult, null); });
test('invalid tool JSON and arguments never execute', () => { assert.equal(interpretResult({ ...toolReply, calls: [{ name: 'calculator', arguments: 'invalid' }] }, 'tool').toolResult, null); });
test('JSON task validates structure but does not claim factual verification', () => { const good = interpretResult({ ...toolReply, calls: [], text: '{"concept":"a","meaning":"b"}' }, 'json'); assert.match(good.validation, /验证通过/); const bad = interpretResult({ ...toolReply, text: '{"concept":1}' }, 'json'); assert.match(bad.validation, /未通过/); });
