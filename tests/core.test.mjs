import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, validateCalculator } from '../web/lib/calculator.js';
import { createRun, advanceRun, cancelRun } from '../web/lib/engine.js';
import { packContext, retrieve, costOf, scheduleWorkflow } from '../web/lib/algorithms.js';
import { createSSEParser } from '../web/lib/sse.js';
import { sanitizeState, createStore, redactExact } from '../web/lib/storage.js';
import { documents } from '../web/content/course.js';

function finish(state, decision) {
  for (let i = 0; i < 100 && ['ready', 'running', 'awaiting_approval'].includes(state.status); i++) {
    if (state.status === 'awaiting_approval' && !decision) break;
    state = advanceRun(state, decision);
  }
  return state;
}
test('calculator executes addition and multiplication, including negative and zero', () => {
  for (const [operation, a, b, expected] of [['add', 2, 3, 5], ['multiply', 23, 7, 161], ['multiply', -4, 3, -12], ['multiply', 0, 8, 0]]) assert.equal(calculate({ operation, a, b }), expected);
});
for (const [name, args] of [['null', null], ['array', []], ['string number', { operation: 'add', a: '2', b: 3 }], ['unknown operation', { operation: 'divide', a: 3, b: 2 }], ['extra field', { operation: 'add', a: 3, b: 2, extra: 1 }], ['large value', { operation: 'add', a: 1000001, b: 2 }], ['NaN', { operation: 'add', a: NaN, b: 2 }], ['Infinity', { operation: 'add', a: Infinity, b: 2 }]]) {
  test(`calculator rejects ${name}`, () => { assert.ok(validateCalculator(args).length); assert.throws(() => calculate(args)); });
}
test('success finishes with two model calls and actual tool result', () => {
  const state = finish(createRun());
  assert.equal(state.status, 'completed'); assert.equal(state.turns, 2); assert.equal(state.result, 161);
  assert.equal(state.messages.filter(m => m.role === 'tool').length, 1);
  const request = state.messages.find(m => m.tool_calls);
  assert.equal(request.tool_calls[0].id, state.messages.find(m => m.role === 'tool').tool_call_id);
});
test('state transitions do not mutate old snapshots', () => {
  const initial = createRun(), copy = structuredClone(initial); advanceRun(initial); assert.deepEqual(initial, copy);
});
test('invalid parameters never reach execution', () => {
  const state = finish(createRun('invalid')); assert.equal(state.status, 'failed'); assert.equal(state.result, null); assert.ok(!state.events.some(e => e.node === 'tool'));
});
test('approval blocks and deny terminates without execution', () => {
  const waiting = finish(createRun('approval')); assert.equal(waiting.status, 'awaiting_approval'); assert.equal(waiting.result, null);
  assert.deepEqual(advanceRun(waiting), waiting);
  const denied = advanceRun(waiting, 'deny'); assert.equal(denied.status, 'denied'); assert.equal(denied.result, null);
  assert.equal(finish(advanceRun(waiting, 'approve')).status, 'completed');
});
test('loop stops exactly at model call budget', () => { const state = finish(createRun('loop', 3)); assert.equal(state.status, 'limited'); assert.equal(state.turns, 3); });
test('one model call budget can stop after calculation but before final answer', () => { const state = finish(createRun('success', 1)); assert.equal(state.status, 'limited'); assert.equal(state.result, 161); });
test('cancellation is terminal and idempotent', () => { const cancelled = cancelRun(advanceRun(createRun())); assert.equal(cancelled.status, 'cancelled'); assert.deepEqual(cancelRun(cancelled), cancelled); assert.deepEqual(advanceRun(cancelled), cancelled); });
test('invalid scenario and budget are rejected', () => { assert.throws(() => createRun('unknown')); assert.throws(() => createRun('success', 0)); });
test('context preserves required items, packs by priority, and declares overflow', () => {
  const items = [{ id: 'task', tokens: 100, required: true }, { id: 'old', tokens: 100, priority: 1 }, { id: 'new', tokens: 100, priority: 10 }];
  assert.deepEqual(packContext(items, 300, 100).selected.map(x => x.id), ['task', 'new']);
  assert.equal(packContext(items, 150, 100).overflow, true);
  assert.throws(() => packContext(items, 50, 100));
});
test('retrieval ranks matching Chinese evidence and excludes zero-score documents', () => {
  const result = retrieve('工具 权限', documents); assert.equal(result[0].id, 'doc-1'); assert.ok(result[0].score > 0); assert.equal(retrieve('qzxwv', documents).length, 0); assert.equal(retrieve('工具', documents, 1).length, 1);
});
test('cost separates cached from uncached input', () => {
  assert.equal(costOf({ input: 1000, cached: 600, output: 128, inputPrice: 1, cachePrice: .2, outputPrice: 3, calls: 1 }), .000904);
  assert.throws(() => costOf({ input: 1, cached: 2, output: 1, inputPrice: 1, cachePrice: 1, outputPrice: 1, calls: 1 }));
});
test('parallel scheduling reduces latency, not total work', () => { const serial = scheduleWorkflow('serial'), parallel = scheduleWorkflow('parallel'); assert.equal(serial.latency, 10); assert.equal(parallel.latency, 7); assert.equal(parallel.work, serial.work); });
for (const size of [1, 2, 3, 7, 64]) {
  test(`SSE handles UTF-8 and CRLF split into ${size}-byte chunks`, () => {
    const events = [], parser = createSSEParser(e => events.push(e));
    const bytes = new TextEncoder().encode(': comment\r\nid: 4\r\nevent: delta\r\ndata: 你好\r\ndata: 世界\r\n\r\ndata: final\n\n');
    for (let i = 0; i < bytes.length; i += size) parser.push(bytes.slice(i, i + size));
    parser.end();
    assert.deepEqual(events, [{ event: 'delta', data: '你好\n世界', id: '4' }, { event: 'message', data: 'final', id: '4' }]);
  });
}
test('SSE does not dispatch an unclosed partial event', () => { const events = [], parser = createSSEParser(e => events.push(e)); parser.push(new TextEncoder().encode('data: partial\n')); parser.end(); assert.equal(events.length, 0); });
test('storage allow-list removes credentials and bounds sessions and messages', () => {
  const raw = { version: 1, apiKey: 'not-a-real-key', settings: { key: 'x' }, completed: ['harness', 'harness'], sessions: Array.from({ length: 25 }, (_, i) => ({ id: String(i), apiKey: 'not-a-real-key', messages: Array.from({ length: 45 }, () => ({ role: 'assistant', content: 'hello', secret: 'not-a-real-key' })) })) };
  const state = sanitizeState(raw);
  assert.equal(state.sessions.length, 20); assert.equal(state.sessions[0].messages.length, 40); assert.deepEqual(state.completed, ['harness']); assert.ok(!JSON.stringify(state).includes('not-a-real-key'));
});
test('unknown storage version resets safely and blocked storage falls back to memory', () => {
  assert.deepEqual(sanitizeState({ version: 2 }), { version: 1, completed: [], sessions: [] });
  const notices = [], store = createStore({ getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } }, text => notices.push(text));
  store.set({ version: 1, completed: ['harness'], sessions: [] }); assert.deepEqual(store.get().completed, ['harness']); assert.equal(notices.length, 2);
  store.clear(); assert.equal(store.get().completed.length, 0);
});
test('exact secret redaction does not interpret regular-expression characters', () => { assert.equal(redactExact('a+b a+b', 'a+b'), '[REDACTED] [REDACTED]'); });
