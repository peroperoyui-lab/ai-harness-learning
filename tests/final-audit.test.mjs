import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../web/lib/storage.js';
import { canResume } from '../web/lib/history.js';

test('malformed chat records are not resumable and never throw', () => {
  for (const messages of [[null], [false], [42], [{ role: 'user' }], [{ role: 'assistant', content: {} }]]) {
    assert.equal(canResume({ messages }), false);
  }
  assert.equal(canResume({ messages: [{ role: 'assistant', content: 'legacy text' }] }), true);
});
test('failed persistent deletion is distinguishable from successful deletion', () => {
  const notices = [];
  const store = createStore({ getItem: () => null, setItem: () => {}, removeItem: () => { throw new Error('denied'); } }, text => notices.push(text));
  store.set({ version: 1, completed: ['harness'], sessions: [] });
  assert.equal(store.clear(), false);
  assert.deepEqual(store.get().completed, []);
  assert.match(notices[0], /拒绝清除/);
});
test('successful persistent deletion returns a confirmation without warnings', () => {
  let removed = '';
  const store = createStore({ getItem: () => null, setItem: () => {}, removeItem: key => { removed = key; } }, () => assert.fail('unexpected storage warning'));
  assert.equal(store.clear(), true);
  assert.equal(removed, 'harness-lab:v1');
});
