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

// Security review of batch 12d, a gap older than the batch. Wrong implementation this catches: the deny list written
// for the checkout alone, while agent worktrees under .claude/worktrees are whole copies of it: each holds the case
// file, progress.md, checks.md, the demo's expected answers and a .git file with a local path, and none was denied.
test('the agent worktrees inside the repository are denied whole, to every sealed session', () => {
  const rule = abs(path.join(REPO_ROOT, '.claude', 'worktrees', '**'));
  assert.ok(backends.readDenyRules().includes(rule), 'in the pinned rules');
  for (const args of [backends.sutArgs({ prompt: 'P' }), backends.sutArgs({ prompt: 'F', resume: 'sess-1' }), askArgs('P', os.tmpdir(), '1'), chatArgs(null, os.tmpdir())]) {
    assert.ok(denyOf(args).includes(rule));
  }
});

// The judged run of batch 12d (SWE10): the read of .git was refused, and the answer still named this repository's
// branch as the asker's. Claude Code itself gives a session a git status snapshot when it starts: the current branch,
// the main branch, the status and the recent commits (code.claude.com/docs/en/settings-reference, includeGitInstructions).
// Wrong implementations this catches: .git denied to the session's tools while the CLI hands the same facts to the
// model; the setting turned off for one entrypoint only; the environment variable left to the caller's own value.
test('no sealed session gets the git status snapshot: the setting is off in every session and in the environment', () => {
  const settingsOf = (args) => JSON.parse(args[args.indexOf('--settings') + 1]);
  const sessions = {
    'judged first turn': backends.sutArgs({ prompt: 'P' }),
    'judged follow-up': backends.sutArgs({ prompt: 'F', resume: 'sess-1' }),
    'ask-aegis': askArgs('P', os.tmpdir(), '1'),
    chat: chatArgs(null, os.tmpdir()),
    judge: backends.judgeArgs({ prompt: 'J' }),
  };
  for (const [name, args] of Object.entries(sessions)) assert.equal(settingsOf(args).includeGitInstructions, false, name);
  assert.equal(backends.scrubEnv({ PATH: '/usr/bin' }, new Set()).CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS, '1');
  assert.equal(backends.scrubEnv({ PATH: '/usr/bin', CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS: '0' }, new Set()).CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS, '1', 'the caller\'s own value does not turn it back on');
});

// A real sealed session's Grep from the repository root found docs/aegis/batch12/lanes/infrastructure-dev-cases.jsonl:
// the four lane case files of batch 12 (58 cases with their expected decisions) sit in a folder no rule named. Wrong
// implementations this catches: the case file denied at scripts/eval/judged alone; a later copy of a case file tracked
// anywhere else in the repository with no rule over it.
test('every tracked case file is under a deny rule, the lane case files of batch 12 included', () => {
  const { execFileSync } = require('node:child_process');
  const rules = backends.readDenyRules().map((r) => r.slice('Read(//'.length, -1));
  // the file's path in the rules' own form (abs), so a Windows drive letter reads as the rules write it: the first
  // form of this test compared "D:/..." with the rules' "d/..." and failed on the Windows runner alone
  const covered = (file) => {
    const full = abs(path.join(REPO_ROOT, ...file.split('/'))).slice('Read(//'.length, -1);
    return rules.some((r) => r === full || (r.endsWith('/**') && !r.slice(0, -3).includes('*') && full.startsWith(`${r.slice(0, -3)}/`)));
  };
  const tracked = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' }).split('\n').filter((f) => /dev-cases[^/]*\.jsonl$/.test(f));
  assert.ok(tracked.length >= 5, `the case files are tracked (${tracked.length})`);
  assert.deepEqual(tracked.filter((f) => !covered(f)), [], 'case files no deny rule covers');
  assert.ok(covered('docs/aegis/batch12/lanes/security-notes.md'), 'the lane notes beside them, which describe the cases');
});
