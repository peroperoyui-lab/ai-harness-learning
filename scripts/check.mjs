import { readdir, access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { lessons, chapters, labs, sources, glossary } from '../web/content/course.js';
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
const files = (await Promise.all(['web', 'server', 'tests', 'scripts'].map(walk))).flat();
for (const file of files.filter(file => /\.(js|mjs)$/.test(file))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${file}: ${result.stderr}`);
}
assert.equal(chapters.length, 6);
assert.equal(lessons.length, 24);
assert.equal(new Set(lessons.map(l => l.id)).size, lessons.length);
for (const lesson of lessons) {
  assert.match(lesson.id, /^[a-z-]+$/);
  for (const field of ['title', 'subtitle', 'goal', 'pitfall', 'challenge', 'codeLabel']) assert.ok(lesson[field]?.length > 5, `${lesson.id}: ${field}`);
  assert.ok(labs[lesson.lab], `${lesson.id}: unknown lab`);
  assert.equal(lesson.sections.length, 3);
  for (const [title, text] of lesson.sections) { assert.ok(title.length > 2); assert.ok(text.length > 60, `${lesson.id}: section too short`); }
  assert.ok(lesson.code.length >= 4);
  assert.equal(lesson.quiz[1].length, 3);
  assert.ok(Number.isInteger(lesson.quiz[2]) && lesson.quiz[2] >= 0 && lesson.quiz[2] < 3);
  assert.ok(lesson.quiz[3].length > 10);
  for (const source of lesson.sources) assert.ok(sources[source], `${lesson.id}: unknown reference ${source}`);
  await access(lesson.source);
}
for (const [, , id] of glossary) assert.ok(lessons.some(l => l.id === id));
for (const [, url] of Object.values(sources)) assert.equal(new URL(url).protocol, 'https:');
const html = await readFile('web/index.html', 'utf8');
assert.ok(html.includes('lang="zh-CN"'));
for (const file of ['web/app.js', 'web/styles.css', 'web/favicon.svg', 'README.md', 'CONTRIBUTING.md', 'docs/PAGES.md', 'SECURITY.md']) await access(file);
console.log(`PASS: syntax and content integrity; ${lessons.length} lessons, ${Object.keys(labs).length} labs, ${glossary.length} glossary entries.`);
