#!/usr/bin/env node
'use strict';
// claim.test.js — multi-session coordination regression (K non-overlap, L collision).
// Sandboxed: runs the CLI against a temp copy of the repo layout so real
// tasks/active state is never touched. Run: node scripts/dev/claim.test.js.

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

function sandboxRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-claim-'));
  fs.mkdirSync(path.join(root, 'scripts', 'dev'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tasks'), { recursive: true });
  // pin module type: a stray {"type":"module"} package.json in a Temp parent
  // must not reclassify the sandboxed CommonJS CLI
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"commonjs"}\n');
  fs.copyFileSync(path.join(ROOT, 'scripts', 'dev', 'claim.js'), path.join(root, 'scripts', 'dev', 'claim.js'));
  return root;
}
function run(root, args, expectExit = 0) {
  try {
    const out = execFileSync('node', [path.join(root, 'scripts', 'dev', 'claim.js'), ...args], { encoding: 'utf8' });
    assert.equal(expectExit, 0, `expected exit ${expectExit}, got 0`);
    return JSON.parse(out);
  } catch (e) {
    assert.equal(e.status, expectExit, e.stderr || e.message);
    return JSON.parse(e.stderr);
  }
}

test('K: two sessions with non-overlapping scopes both claim, see each other, and complete', () => {
  const root = sandboxRepo();
  const a = run(root, ['claim', '--task', 'fix-tier2-google', '--owner', 'session-A', '--scope', '.claude/agents/tier2-support.md']);
  const b = run(root, ['claim', '--task', 'harden-jira-docs', '--owner', 'session-B', '--scope', 'docs/jira-notes.md,scripts/jira-client.js']);
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  const list = run(root, ['list']);
  assert.equal(list.active.length, 2, 'both sessions visible to each other');
  assert.ok(list.active.some((t) => t.owner === 'session-A') && list.active.some((t) => t.owner === 'session-B'));
  run(root, ['release', '--task', 'fix-tier2-google', '--summary', 'done']);
  run(root, ['release', '--task', 'harden-jira-docs', '--summary', 'done']);
  assert.equal(run(root, ['list']).active.length, 0);
  assert.ok(fs.existsSync(path.join(root, 'tasks', 'completed', 'fix-tier2-google.md')), 'completed task archived, not deleted');
});

test('L: a second session claiming an overlapping scope is REFUSED and told who owns it', () => {
  const root = sandboxRepo();
  run(root, ['claim', '--task', 'rework-tier-guard', '--owner', 'session-A', '--scope', 'scripts/tier']);
  const refusal = run(root, ['claim', '--task', 'guard-tweak', '--owner', 'session-B', '--scope', 'scripts/tier/tier-guard.js'], 1);
  assert.equal(refusal.ok, false);
  assert.match(refusal.error, /SCOPE COLLISION/);
  assert.equal(refusal.collisions[0].owner, 'session-A', 'refusal must name the owning session');
  assert.equal(run(root, ['list']).active.length, 1, 'the refused claim wrote nothing');
  // after explicit release, the same claim succeeds — coordination, not deadlock
  run(root, ['release', '--task', 'rework-tier-guard']);
  assert.equal(run(root, ['claim', '--task', 'guard-tweak', '--owner', 'session-B', '--scope', 'scripts/tier/tier-guard.js']).ok, true);
});

test('L2: duplicate task id is an atomic refusal (O_EXCL), never an overwrite', () => {
  const root = sandboxRepo();
  run(root, ['claim', '--task', 'same-id', '--owner', 'session-A', '--scope', 'docs/a.md']);
  const refusal = run(root, ['claim', '--task', 'same-id', '--owner', 'session-B', '--scope', 'docs/b.md'], 1);
  assert.match(refusal.error, /already claimed/);
  const kept = fs.readFileSync(path.join(root, 'tasks', 'active', 'same-id.md'), 'utf8');
  assert.match(kept, /owner: session-A/, 'first claimant preserved');
});

test('check is report-only and directional overlap works both ways', () => {
  const root = sandboxRepo();
  run(root, ['claim', '--task', 'docs-pass', '--owner', 'A', '--scope', 'docs']);
  const c1 = run(root, ['check', '--scope', 'docs/harness.md']);
  assert.equal(c1.clear, false, 'child path collides with claimed parent dir');
  const c2 = run(root, ['check', '--scope', 'scripts/replay/replay-cli.js']);
  assert.equal(c2.clear, true);
});

test('bootstrap canon exists for fresh sessions (contract, state, team, dev roles)', () => {
  for (const f of ['PRODUCT_CONTRACT.md', 'PROJECT_STATE.md', 'TEAM.md']) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} missing`);
  }
  assert.match(fs.readFileSync(path.join(ROOT, 'PRODUCT_CONTRACT.md'), 'utf8'), /AEGIS ADVISES\. HUMAN ADMINISTRATORS EXECUTE\./);
  for (const card of ['zac.md', 'atlas.md', 'forge.md', 'warden.md']) {
    const src = fs.readFileSync(path.join(ROOT, '.claude', 'agents', card), 'utf8');
    assert.match(src, /DEVELOPMENT plane/i, `${card}: must be dev-plane scoped`);
    assert.match(src, /Never for IT tickets/i, `${card}: must refuse the support lane`);
  }
  assert.match(fs.readFileSync(path.join(ROOT, '.claude', 'agents', 'zac.md'), 'utf8'), /^model:\s*opus$/m);
  assert.match(fs.readFileSync(path.join(ROOT, '.claude', 'agents', 'forge.md'), 'utf8'), /^model:\s*fable$/m);
});
