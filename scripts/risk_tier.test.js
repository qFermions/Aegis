#!/usr/bin/env node
'use strict';
// risk_tier.test.js: the review tier is set by the changed paths, never by the author.
// Sandboxed: every case builds a throwaway git repository carrying the real
// .github/risk-tiers.json, so the repo's own history is never read or touched.
// Run: node --test scripts/risk_tier.test.js

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'risk_tier.mjs');
const TIERS = path.join(ROOT, '.github', 'risk-tiers.json');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } });
}

function write(cwd, file, content = `${file}\n`) {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), content);
}

// Every sandbox is removed when the file's tests finish.
const sandboxes = [];
test.after(() => { for (const dir of sandboxes) fs.rmSync(dir, { recursive: true, force: true }); });

// A repo with `main` holding one commit and a work branch checked out on top of it.
function sandbox() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-risk-tier-'));
  sandboxes.push(cwd);
  git(cwd, 'init', '-q', '-b', 'main');
  git(cwd, 'config', 'user.email', '[USER@DOMAIN.COM]'); // the scanner's canonical placeholder; git accepts it as an ident
  git(cwd, 'config', 'user.name', 'risk-tier test');
  git(cwd, 'config', 'commit.gpgsign', 'false');
  write(cwd, '.github/risk-tiers.json', fs.readFileSync(TIERS, 'utf8'));
  write(cwd, 'README.md', '# sandbox\n');
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', 'base');
  git(cwd, 'checkout', '-q', '-b', 'work');
  return cwd;
}

function commit(cwd, files, message = 'change') {
  for (const file of files) write(cwd, file);
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', message);
}

function run(cwd, args = [], expectExit = 0, options = {}) {
  const result = spawnSync('node', [options.script || SCRIPT, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...options.env } });
  assert.equal(result.status, expectExit, `expected exit ${expectExit}, got ${result.status}: ${result.stderr}`);
  return expectExit === 0 ? result.stdout.trim().split('\n') : result.stderr.trim();
}

test('A: a docs-only change is tier A and lists no path', () => {
  const cwd = sandbox();
  commit(cwd, ['docs/notes.md', 'README.md']);
  assert.deepEqual(run(cwd, ['main']), ['tier=A']);
});

test('B: evaluation code is tier B and only the B paths are listed', () => {
  const cwd = sandbox();
  commit(cwd, ['scripts/eval/ms-ticket-eval.js', 'docs/notes.md']);
  assert.deepEqual(run(cwd, ['main']), ['tier=B', 'scripts/eval/ms-ticket-eval.js']);
});

test('C: a CI workflow change is tier C', () => {
  const cwd = sandbox();
  commit(cwd, ['.github/workflows/ci.yml']);
  assert.deepEqual(run(cwd, ['main']), ['tier=C', '.github/workflows/ci.yml']);
});

test('C: the checklist command runner modules/automation/scripts/deploy-check.js is tier C, not modules/** B', () => {
  // It runs any executable a checklist names (boundary audit, docs/aegis/boundary-audit.md), so it is a tool adapter.
  const cwd = sandbox();
  commit(cwd, ['modules/automation/scripts/deploy-check.js', 'modules/automation/README.md']);
  assert.deepEqual(run(cwd, ['main']), ['tier=C', 'modules/automation/scripts/deploy-check.js']);
});

test('C: scripts/init-memory.js, which writes Claude Code memory files, is tier C like scripts/memory/**', () => {
  const cwd = sandbox();
  commit(cwd, ['scripts/init-memory.js', 'scripts/dev/claim.js']);
  assert.deepEqual(run(cwd, ['main']), ['tier=C', 'scripts/init-memory.js']);
});

test('one C path wins over many B paths, and only the C path is listed', () => {
  const cwd = sandbox();
  const many = Array.from({ length: 12 }, (_, i) => `scripts/eval/case-${i}.js`);
  commit(cwd, [...many, 'modules/security/security-doctrine.md']);
  assert.deepEqual(run(cwd, ['main']), ['tier=C', 'modules/security/security-doctrine.md']);
});

test('** matches nested paths at any depth', () => {
  const cwd = sandbox();
  commit(cwd, ['.claude/agents/deep/deeper/card.md', 'scripts/memory/store/v2/index.js']);
  assert.deepEqual(run(cwd, ['main']), ['tier=C', '.claude/agents/deep/deeper/card.md', 'scripts/memory/store/v2/index.js']);
});

test('uncommitted and untracked changes count toward the tier', () => {
  const cwd = sandbox();
  commit(cwd, ['docs/notes.md']);
  write(cwd, 'CLAUDE.md', '# staged but not committed\n');
  git(cwd, 'add', 'CLAUDE.md');
  write(cwd, 'scripts/replay/untracked.js');
  assert.deepEqual(run(cwd, ['main']), ['tier=C', 'CLAUDE.md', 'scripts/replay/untracked.js']);
});

test('the base defaults to the default branch and falls back to origin/<default> when the local ref is missing', () => {
  const cwd = sandbox();
  commit(cwd, ['.nvmrc']);
  // simulate a CI checkout: the remote-tracking ref exists, the local branch does not
  git(cwd, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(cwd, 'branch', '-D', 'main');
  assert.deepEqual(run(cwd, ['main']), ['tier=C', '.nvmrc']);
  assert.deepEqual(run(cwd, []), ['tier=C', '.nvmrc']);
});

test('a missing base ref fails closed with exit 1 and a named ref', () => {
  const cwd = sandbox();
  commit(cwd, ['docs/notes.md']);
  assert.match(run(cwd, ['no-such-branch'], 1), /base ref not found: no-such-branch/);
});

test('glob grammar: * stays in one segment, ? is one character, matching is case-sensitive', async () => {
  // a file URL, not a bare path: on Windows the ESM loader rejects 'D:\\...' as an unsupported scheme
  const { globToRegExp } = await import(pathToFileURL(SCRIPT).href);
  assert.equal(globToRegExp('docs/portal-nav-*.md').test('docs/portal-nav-2026.md'), true);
  assert.equal(globToRegExp('docs/portal-nav-*.md').test('docs/portal-nav-2026/index.md'), false);
  assert.equal(globToRegExp('scripts/*.js').test('scripts/lint/x.js'), false);
  assert.equal(globToRegExp('scripts/**').test('scripts/lint/deep/x.js'), true);
  assert.equal(globToRegExp('scripts/**').test('scripts'), true);
  assert.equal(globToRegExp('a/**/b.md').test('a/b.md'), true);
  assert.equal(globToRegExp('a/**/b.md').test('a/x/y/b.md'), true);
  assert.equal(globToRegExp('file?.md').test('file1.md'), true);
  assert.equal(globToRegExp('file?.md').test('file12.md'), false);
  assert.equal(globToRegExp('CLAUDE.md').test('claude.md'), false);
  assert.equal(globToRegExp('scripts/x.js').test('scripts/xzjs'), false, 'a literal dot is not a wildcard');
});

test('a path git would quote (non-ASCII) still matches its tier glob', () => {
  const cwd = sandbox();
  commit(cwd, ['.claude/commands/caf\u00e9-reset.md']);
  assert.deepEqual(run(cwd, ['main']), ['tier=C', '.claude/commands/caf\u00e9-reset.md']);
});

test('a file moved out of a C path still sets tier C (both sides of the rename are listed)', () => {
  const cwd = sandbox();
  git(cwd, 'checkout', '-q', 'main');
  commit(cwd, ['modules/security/old-doctrine.md'], 'seed');
  git(cwd, 'checkout', '-q', 'work');
  git(cwd, 'merge', '-q', 'main');
  fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  git(cwd, 'mv', 'modules/security/old-doctrine.md', 'docs/old-doctrine.md');
  git(cwd, 'commit', '-q', '-m', 'move');
  assert.deepEqual(run(cwd, ['main']), ['tier=C', 'modules/security/old-doctrine.md']);
});

test('a malformed tier file fails closed with exit 1 instead of reporting tier A', () => {
  const cwd = sandbox();
  commit(cwd, ['.github/workflows/ci.yml']);
  const cases = [
    [{ C: [['.github/**']], B: [] }, /non-string or empty glob/],
    [{ C: [''], B: [] }, /non-string or empty glob/],
    [{ c: ['.github/**'], B: ['scripts/**'] }, /unknown tier key\(s\) \["c"\]/],
    [{ C: ['.github/**'], B: ['scripts/**'], c: ['CLAUDE.md'] }, /unknown tier key\(s\) \["c"\]/],
    [{ C: ['.github/**'], B: ['scripts/**'], A: ['docs/**'] }, /unknown tier key\(s\) \["A"\]/],
    [{ C: ['.github/**'] }, /"B" must be an array of globs/],
    [[], /must be a JSON object/],
    ['globs', /must be a JSON object/],
  ];
  for (const [shape, message] of cases) {
    write(cwd, 'broken-tiers.json', JSON.stringify(shape));
    assert.match(run(cwd, ['main'], 1, { env: { RISK_TIERS_FILE: path.join(cwd, 'broken-tiers.json') } }), message, JSON.stringify(shape));
  }
});

test('the CLI runs when invoked through a symlinked path', (t) => {
  const cwd = sandbox();
  commit(cwd, ['.nvmrc']);
  const link = path.join(cwd, 'risk_tier_link.mjs');
  try {
    fs.symlinkSync(SCRIPT, link);
  } catch (error) {
    // Windows needs SeCreateSymbolicLinkPrivilege or Developer Mode to create a symlink; without
    // it the behavior under test cannot be exercised on this host. Anywhere else an EPERM is a failure.
    if (process.platform === 'win32' && error.code === 'EPERM') return t.skip('symlink creation is not permitted on this Windows host');
    throw error;
  }
  assert.deepEqual(run(cwd, ['main'], 0, { script: link }), ['tier=C', '.nvmrc']);
});

// G2: every read-only adapter and the Google Workspace posture audit generator is an API
// client or a report generator (REVIEW.md tier C), one case per path.
for (const adapterPath of [
  'scripts/adapters/readonly-contract.js',
  'scripts/adapters/fleet-client.js',
  'scripts/adapters/jamf-client.js',
  'scripts/adapters/slack-client.js',
  'scripts/adapters/linear-client.js',
  'scripts/adapters/gws-client.js',
  'scripts/gws-posture-audit.js',
]) {
  test(`C: ${adapterPath} is tier C, not scripts/** B`, () => {
    const cwd = sandbox();
    commit(cwd, [adapterPath, 'scripts/eval/notes.md']);
    assert.deepEqual(run(cwd, ['main']), ['tier=C', adapterPath]);
  });
}
