import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons } from '../web/content/course.js';
import { walkthroughs } from '../web/content/walkthroughs.js';

test('every registered lesson has three labelled snapshots and a predictive exercise', () => {
  assert.deepEqual(Object.keys(walkthroughs).sort(),lessons.map(l=>l.id).sort());
  for (const lesson of lessons) {
    const guide=walkthroughs[lesson.id];
    for (const key of ['title','why','probe','answer','transfer']) assert.ok(typeof guide[key]==='string' && guide[key].length>8,`${lesson.id}: ${key}`);
    assert.equal(guide.stages.length,3,lesson.id);
    for (const step of guide.stages) for (const key of ['title','code','observe']) assert.ok(typeof step[key]==='string' && step[key].length>2,`${lesson.id}: ${key}`);
  }
});
test('MCP examples pin a version and separate model API from external-tool protocol', () => {
  const lesson=lessons.find(l=>l.id==='mcp');
  assert.match(lesson.codeLabel,/2026-07-28/);
  assert.match(JSON.stringify(lesson.code),/server\/discover/);
  assert.match(lesson.sections[2][1],/没有实现 MCP Client/);
});
test('permission feedback describes a terminal denial without weakening content gate', () => {
  assert.ok(lessons.find(l=>l.id==='permissions').quiz[3].length>10);
});
