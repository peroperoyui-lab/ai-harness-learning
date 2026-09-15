/** One-time user-requested cleanup of two reviewed, merged and unchanged branches. */
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
assert.equal(process.env.GITHUB_REPOSITORY, 'peroperoyui-lab/ai-harness-learning', 'Unexpected repository');
assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Cleanup must run on main');
const head = process.env.GITHUB_SHA;
assert.match(head || '', /^[0-9a-f]{40}$/);
const reviewed = new Map([
  ['feat/curriculum-audit-and-session-resume', '7fab30b657b10073dc228d6e4980d2cc3dd2044e'],
  ['feat/interactive-harness-lab', 'a6319bc134fe6ae7adf6a6ef02117623f965c673'],
]);
const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const refs = new Map(git(['ls-remote', '--heads', 'origin']).split('\n').filter(Boolean).map(line => {
  const [sha, ref] = line.split(/\s+/); return [ref, sha];
}));
assert.equal(refs.get('refs/heads/main'), head, 'main advanced; stop and review again');
assert.equal(git(['rev-parse', 'HEAD']), head, 'Checkout does not match the verified commit');
const candidates = [];
for (const [branch, expected] of reviewed) {
  const ref = `refs/heads/${branch}`, current = refs.get(ref);
  if (!current) { console.log(`${branch}: already absent`); continue; }
  assert.equal(current, expected, `${branch} changed; refusing to delete unreviewed work`);
  git(['merge-base', '--is-ancestor', expected, head]);
  candidates.push({ ref, expected });
}
if (candidates.length) {
  // Leases guard against concurrent changes; an atomic push deletes all or none.
  // main is never a deletion or force-update target.
  git(['push', '--atomic', ...candidates.map(c => `--force-with-lease=${c.ref}:${c.expected}`), 'origin', ...candidates.map(c => `:${c.ref}`)]);
  for (const c of candidates) console.log(`Deleted reviewed merged branch: ${c.ref}`);
}
