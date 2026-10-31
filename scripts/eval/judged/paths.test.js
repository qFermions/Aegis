'use strict';
require('../../adapters/socket-tripwire.js');
// paths.test.js: where the judged-eval runner may read and write (capability row 26, B2).
//
// EXPECTED DECISION (written before the module)
// - A case file inside the repository working tree is refused; so is one outside it whose
//   real path (a symlink followed) is inside it. A file outside the repository is accepted
//   and its real path returned.
// - A results directory outside the repository is allowed. One inside a repository is
//   allowed only when git ignores it and lists no tracked file under it.
// - A run id is a UTC timestamp plus random hex.
// Run: node --test scripts/eval/judged/paths.test.js

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const paths = require('./paths.js');

const DEV = path.join(__dirname, 'dev-cases.jsonl');

// Windows refuses symlinks without a privilege; the test is skipped there, never weakened.
function symlinkOrSkip(t, target, link, type) {
  try { fs.symlinkSync(target, link, type); return true; } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EACCES') { t.skip('symlinks are not permitted on this system'); return false; }
    throw e;
  }
}

function tmp(t, prefix = 'aegis-judged-paths-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('a case file inside the repository is refused, by its given path and by a relative path', () => {
  assert.throws(() => paths.refuseInsideRepo(DEV, 'the case file'), (e) => e instanceof paths.PathRefused && /inside the repository working tree/.test(e.message));
  const rel = path.relative(process.cwd(), DEV);
  assert.throws(() => paths.refuseInsideRepo(rel, 'the case file'), paths.PathRefused);
});

test('a symlink outside the repository that points into it is refused', (t) => {
  const dir = tmp(t);
  const link = path.join(dir, 'cases.jsonl');
  if (!symlinkOrSkip(t, DEV, link, 'file')) return;
  assert.throws(() => paths.refuseInsideRepo(link, 'the case file'), (e) => e instanceof paths.PathRefused && /through a symlink/.test(e.message));
  const dirLink = path.join(dir, 'repo-link');
  if (!symlinkOrSkip(t, path.dirname(DEV), dirLink, 'dir')) return;
  assert.throws(() => paths.refuseInsideRepo(path.join(dirLink, 'dev-cases.jsonl'), 'the case file'), paths.PathRefused);
});

test('a copy outside the repository is accepted; a missing file is refused', (t) => {
  const dir = tmp(t);
  const copy = path.join(dir, 'dev.jsonl');
  fs.copyFileSync(DEV, copy);
  assert.equal(paths.refuseInsideRepo(copy, 'the case file'), fs.realpathSync(copy));
  assert.throws(() => paths.refuseInsideRepo(path.join(dir, 'none.jsonl'), 'the case file'), /cannot be read/);
});

function gitRepo(t) {
  const root = tmp(t, 'aegis-judged-repo-');
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] });
  git('init', '-q');
  fs.writeFileSync(path.join(root, '.gitignore'), 'state/\n');
  fs.mkdirSync(path.join(root, 'tracked'));
  fs.writeFileSync(path.join(root, 'tracked', 'a.txt'), 'a\n');
  fs.mkdirSync(path.join(root, 'state', 'forced'), { recursive: true });
  fs.writeFileSync(path.join(root, 'state', 'forced', 'b.txt'), 'b\n');
  git('add', '.gitignore', 'tracked/a.txt');
  git('add', '-f', 'state/forced/b.txt');
  return root;
}

test('results: outside allowed, ignored allowed, not-ignored refused, ignored-but-tracked refused, the root refused', (t) => {
  const root = gitRepo(t);
  const outside = tmp(t);
  assert.equal(paths.checkResultsDir(path.join(outside, 'run1'), { repoRoot: root }), path.join(fs.realpathSync(outside), 'run1'));
  assert.ok(paths.checkResultsDir(path.join(root, 'state', 'evals', 'run1'), { repoRoot: root }).endsWith(path.join('state', 'evals', 'run1')));
  assert.throws(() => paths.checkResultsDir(path.join(root, 'tracked', 'run1'), { repoRoot: root }), /not ignored by git/);
  assert.throws(() => paths.checkResultsDir(path.join(root, 'results'), { repoRoot: root }), /not ignored by git/);
  // an ignored folder that holds a file added with --force: refused (git check-ignore already
  // reads a folder with a tracked file as not ignored; git ls-files is the second guard)
  for (const p of [path.join(root, 'state'), path.join(root, 'state', 'forced')]) {
    assert.throws(() => paths.checkResultsDir(p, { repoRoot: root }), /not ignored by git|holds tracked files/);
  }
  const ignoredButTracked = (args) => (args[0] === 'check-ignore' ? { code: 0, stdout: '' } : { code: 0, stdout: 'state/forced/b.txt\n' });
  assert.throws(() => paths.checkResultsDir(path.join(root, 'state'), { repoRoot: root, git: ignoredButTracked }), /holds tracked files/);
  const gitMissing = () => ({ code: 128, stdout: '' });
  assert.throws(() => paths.checkResultsDir(path.join(root, 'state', 'x'), { repoRoot: root, git: gitMissing }), /not ignored by git/);
  assert.throws(() => paths.checkResultsDir(root, { repoRoot: root }), /repository root/);
});

test('results: a symlink outside the repository that points into a tracked folder is refused', (t) => {
  const root = gitRepo(t);
  const outside = tmp(t);
  const link = path.join(outside, 'into-repo');
  if (!symlinkOrSkip(t, path.join(root, 'tracked'), link, 'dir')) return;
  assert.throws(() => paths.checkResultsDir(path.join(link, 'run1'), { repoRoot: root }), /not ignored by git/);
});

test('the default results directory is under .aegis-state/evals and is ignored in this repository', () => {
  const id = paths.newRunId(new Date('2026-10-31T12:34:56.789Z'), () => Buffer.from([0xde, 0xad, 0xbe, 0xef]));
  assert.equal(id, '20261031T123456Z-deadbeef');
  assert.match(paths.newRunId(), /^\d{8}T\d{6}Z-[0-9a-f]{8}$/);
  const dir = paths.defaultResultsDir(id);
  assert.equal(path.relative(paths.REPO_ROOT, dir).split(path.sep).join('/'), `.aegis-state/evals/${id}`);
  assert.ok(paths.checkResultsDir(dir));
});
