import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeState, createStore } from '../web/lib/storage.js';
import { latestExplanationPair, canResume, parseHistoryImport, mergeHistory, MAX_IMPORT_BYTES } from '../web/lib/history.js';
const pair = [ { role: 'user', content: '解释 Harness', task: 'explain' }, { role: 'assistant', content: '围绕模型的运行系统', task: 'explain' } ];
const record = (id = 'one', messages = pair) => ({ id, title: '课堂', date: '2026-09-16T00:00:00Z', mode: 'live', messages });
const state = (sessions = [record()]) => ({ version: 1, completed: ['harness'], sessions });

test('only complete explicitly-labelled explanation turns may be resent', () => {
  assert.deepEqual(latestExplanationPair(pair), pair.map(({role,content}) => ({role,content})));
  for (const messages of [null, [], pair.slice(0, 1), pair.map(m => ({...m, task: undefined})), pair.map(m => ({...m, task:'tool'})), pair.map(m => ({...m, task:'json'})), [...pair,{role:'event',content:'stop'}], [pair[0], {...pair[1],content:''}]]) assert.deepEqual(latestExplanationPair(messages), []);
  assert.equal(latestExplanationPair(pair.map(m=>({...m,content:'长'.repeat(1000)})))[0].content.length,400);
});
test('event traces and empty records are not resumable chat', () => {
  assert.equal(canResume(record()), true);
  assert.equal(canResume(record('old', pair.map(({role,content})=>({role,content})))), true);
  for (const value of [null, {}, record('empty',[]),record('trace',[{role:'event',content:'step'}])]) assert.equal(canResume(value),false);
});
test('import format/version errors never silently erase records', () => {
  for (const text of ['oops', '{}', 'null', JSON.stringify({...state(),version:2}), JSON.stringify({...state(),completed:null})]) assert.throws(()=>parseHistoryImport(text));
});
test('import bounds cover bytes, counts, roles and messages', () => {
  assert.throws(()=>parseHistoryImport(' '.repeat(MAX_IMPORT_BYTES + 1)),/MiB/);
  const invalid = [state(Array.from({length:21},(_,i)=>record(''+i))),state([record('a',Array(41).fill(pair[0]))]),state([record('a',[{role:'system',content:'instruction'}])]),state([record('a',[{role:'user',content:'x'.repeat(12001)}])]),state([{...record(),id:''}])];
  for (const value of invalid) assert.throws(()=>parseHistoryImport(JSON.stringify(value)));
});
test('import drops credentials, URLs and executable configuration at every level', () => {
  const unsafe = {...state(),apiKey:'secret',endpoint:'https://unknown.invalid',sessions:[{...record(),credential:'secret',messages:[{...pair[0],apiKey:'secret',execute:true},{...pair[1],task:'unknown'}]}]};
  const safe = parseHistoryImport(JSON.stringify(unsafe));
  assert.equal(JSON.stringify(safe).includes('secret'),false);
  assert.equal(JSON.stringify(safe).includes('unknown.invalid'),false);
  assert.equal(safe.sessions[0].messages[0].task,'explain');
  assert.equal(safe.sessions[0].messages[1].task,undefined);
});
test('import preserves markup as text and never evaluates it', () => {
  const value=state([record('x',[{role:'assistant',content:'<script>throw new Error(1)</script>'}])]);
  assert.equal(parseHistoryImport(JSON.stringify(value)).sessions[0].messages[0].content,value.sessions[0].messages[0].content);
});
test('ID collisions import copies without overwriting the original', () => {
  const original=state([record('one')]);
  const merged=mergeHistory(original,state([record('one'),record('one-import-1')]));
  assert.equal(new Set(merged.sessions.map(s=>s.id)).size,3);
  assert.equal(merged.sessions.at(-1).id,'one');
  assert.deepEqual(original,state([record('one')]));
  assert.equal(mergeHistory(state(Array.from({length:20},(_,i)=>record('old-'+i))),state()).sessions.length,20);
});
test('version-one roundtrip preserves recognized task labels and safe legacy messages', () => {
  const legacy=record('legacy',pair.map(({role,content})=>({role,content})));
  const value=state([record(),legacy]);
  assert.deepEqual(parseHistoryImport(JSON.stringify(value)),sanitizeState(value));
  assert.deepEqual(latestExplanationPair(parseHistoryImport(JSON.stringify(value)).sessions[1].messages),[]);
});
