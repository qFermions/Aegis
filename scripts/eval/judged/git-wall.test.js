'use strict';
require('../../adapters/socket-tripwire.js');
// git-wall.test.js: a sealed session cannot read this repository's own .git (batch 12d, task 2).
//
// EXPECTED DECISION (written before the code)
// - .git is denied to every sealed session the way the case folder is: its contents (Read(//<repo>/.git/**)) and
//   the entry itself (Read(//<repo>/.git)), which in a linked worktree is a file that holds a local path.
// - In a linked worktree the git folder that file names, and the shared folder behind it, are denied too.
// - Every entrypoint that starts a sealed session carries the rules: the judged runner's first turn and its
//   follow-up, ask-aegis and the chat (the desk builds its sessions with the same backends.sutArgs).
// What this proves: the rules are in the --settings of every sealed session. That the CLI refuses a read a deny
// rule names is shown only by a real session (docs/aegis/demo/evidence/full-run-1/, and the judged run of this batch).
// Run: node --test scripts/eval/judged/git-wall.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const backends = require('./backends.js');
const { REPO_ROOT } = require('./paths.js');
const { askArgs } = require('../../ask-aegis.js');
const { chatArgs } = require('../../aegis-chat.js');

// the CLI's absolute rule form, as exam-wall.test.js writes it
const abs = (p) => `Read(//${p.split(path.sep).join('/').replace(/^\/+/, '').replace(/^([A-Za-z]):/, (m, d) => d.toLowerCase())})`;
const denyOf = (args) => JSON.parse(args[args.indexOf('--settings') + 1]).permissions.deny;
const GIT = path.join(REPO_ROOT, '.git');

// Wrong implementations this catches: only the folder's contents denied, so the .git file of a linked worktree
// (one line with a local path) stays readable; only the entry denied, so .git/HEAD and .git/logs stay readable.
test('the deny rules name .git itself and everything under it', () => {
  const rules = backends.readDenyRules();
  assert.ok(rules.includes(abs(GIT)), 'the entry itself');
  assert.ok(rules.includes(abs(path.join(GIT, '**'))), 'its contents');
});

// Wrong implementations this catches: the rule added to the judged first turn only; an entrypoint that builds its
// own settings and forgets the rule.
test('every sealed session carries the .git rules: first turn, follow-up, ask-aegis and the chat', () => {
  const sessions = {
    'judged first turn': backends.sutArgs({ prompt: 'P' }),
    'judged follow-up': backends.sutArgs({ prompt: 'F', resume: 'sess-1' }),
    'ask-aegis': askArgs('P', os.tmpdir(), '1'),
    chat: chatArgs(null, os.tmpdir()),
    'chat with no tool server': chatArgs(null, os.tmpdir(), null, null, { tools: false }),
  };
  for (const [name, args] of Object.entries(sessions)) {
    assert.ok(denyOf(args).includes(abs(GIT)), `${name}: .git`);
    assert.ok(denyOf(args).includes(abs(path.join(GIT, '**'))), `${name}: .git/**`);
  }
});

// Wrong implementations this catches: a worktree's .git file followed no further, so the real git folder (named by
// an absolute local path) stays readable; a missing or unreadable .git treated as an error that stops every session.
test('gitDirs: a checkout gives .git; a linked worktree adds the folder its .git file names and the shared one', (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-wall-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const main = path.join(root, 'main');
  const tree = path.join(root, 'tree');
  const linked = path.join(main, '.git', 'worktrees', 'tree');
  fs.mkdirSync(linked, { recursive: true });
  fs.mkdirSync(tree);
  assert.deepEqual(backends.gitDirs(main), [path.join(main, '.git')], 'a checkout: .git is a folder');
  assert.deepEqual(backends.gitDirs(tree), [path.join(tree, '.git')], 'no .git at all: the name is still denied');
  fs.writeFileSync(path.join(tree, '.git'), `gitdir: ${linked}\n`);
  assert.deepEqual(backends.gitDirs(tree), [path.join(tree, '.git'), linked], 'a linked worktree with no commondir file');
  fs.writeFileSync(path.join(linked, 'commondir'), '../..\n');
  assert.deepEqual(backends.gitDirs(tree), [path.join(tree, '.git'), linked, path.join(main, '.git')], 'the shared folder too');
  fs.writeFileSync(path.join(tree, '.git'), 'not a git file\n');
  assert.deepEqual(backends.gitDirs(tree), [path.join(tree, '.git')], 'a .git file that names nothing');
});
