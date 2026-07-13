#!/usr/bin/env node
/**
 * Zero-dependency regression tests for deploy-check.js.
 * No Git hooks, tracked files, or external commands are modified.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  EXIT,
  STATUS,
  createContext,
  resolveGitHookPath,
  summarize,
  validateCommand,
  validateGitHook,
  validateScanner,
  validateTrackedTextAbsent,
} = require('./deploy-check');

const FORBIDDEN_MARKER = ['TO', 'DO:'].join('');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write(`  ok  ${name}\n`);
  } catch (error) {
    failed++;
    process.stdout.write(`FAIL  ${name}\n      ${error.stack || error.message}\n`);
  }
}

function execution(status, stdout = '', stderr = '') {
  return { error: null, signal: null, status, stdout, stderr };
}

test('command: silent nonzero exit is FAIL', () => {
  const context = createContext({ spawnSync: () => execution(7) });
  const check = validateCommand({ command: 'fixture', args: [], expect: 'empty' }, context);
  assert.strictEqual(check.status, STATUS.FAIL);
  assert.match(check.detail, /status 7/);
  assert.match(check.detail, /no output/);
});

test('command: missing executable is FAIL, never PASS or SKIPPED', () => {
  const error = Object.assign(new Error('tool not found'), { code: 'ENOENT' });
  const context = createContext({
    spawnSync: () => ({ error, signal: null, status: null, stdout: '', stderr: '' }),
  });
  const check = validateCommand({ command: 'missing-tool', args: [] }, context);
  assert.strictEqual(check.status, STATUS.FAIL);
  assert.match(check.detail, /ENOENT/);
});

test('command: executable and arguments are passed without a shell', () => {
  let observed;
  const context = createContext({
    spawnSync: (command, args, options) => {
      observed = { command, args, options };
      return execution(0, 'version 1');
    },
  });
  const check = validateCommand({
    command: 'fixture-tool',
    args: ['--flag', 'value with spaces'],
    expect: 'contains:version',
  }, context);
  assert.strictEqual(check.status, STATUS.PASS);
  assert.strictEqual(observed.command, 'fixture-tool');
  assert.deepStrictEqual(observed.args, ['--flag', 'value with spaces']);
  assert.strictEqual(observed.options.shell, false);
});

test('hook: absent active hook is FAIL', () => {
  const context = createContext({
    fs: { existsSync: () => false },
    resolveHookPath: () => ({ ok: true, path: '/repo/.git/hooks/pre-commit' }),
  });
  const check = validateGitHook({ scanner: 'scripts/pre-commit-check.js' }, context);
  assert.strictEqual(check.status, STATUS.FAIL);
  assert.match(check.detail, /not installed/);
});

test('hook: installed Windows hook must invoke the scanner', () => {
  const hookPath = 'C:\\repo\\.git\\hooks\\pre-commit';
  let observed;
  const context = createContext({
    cwd: 'C:\\repo',
    fs: {
      existsSync: () => true,
      readFileSync: file => file === hookPath
        ? '#!/bin/sh\nnode scripts/pre-commit-check.js\n'
        : '',
      statSync: () => ({ isFile: () => true, mode: 0o100644 }),
    },
    platform: 'win32',
    resolveHookPath: () => ({ ok: true, path: hookPath }),
    spawnSync: (command, args, options) => {
      observed = { command, args, options };
      return execution(0);
    },
  });
  const check = validateGitHook({ scanner: 'scripts/pre-commit-check.js' }, context);
  assert.strictEqual(check.status, STATUS.PASS);
  assert.strictEqual(observed.command, 'git');
  assert.deepStrictEqual(observed.args, ['hook', 'run', 'pre-commit']);
  assert.strictEqual(observed.options.shell, false);
});

test('hook: installed hook behavior failure is FAIL even when silent', () => {
  const context = createContext({
    fs: {
      existsSync: () => true,
      readFileSync: () => '#!/bin/sh\nnode scripts/pre-commit-check.js\n',
      statSync: () => ({ isFile: () => true, mode: 0o100755 }),
    },
    platform: 'linux',
    resolveHookPath: () => ({ ok: true, path: '/repo/.git/hooks/pre-commit' }),
    spawnSync: () => execution(9),
  });
  const check = validateGitHook({ scanner: 'scripts/pre-commit-check.js' }, context);
  assert.strictEqual(check.status, STATUS.FAIL);
  assert.match(check.detail, /status 9/);
  assert.match(check.detail, /no output/);
});

test('hook: Unix hook without executable mode is FAIL', () => {
  const context = createContext({
    fs: {
      existsSync: () => true,
      readFileSync: () => '#!/bin/sh\nnode scripts/pre-commit-check.js\n',
      statSync: () => ({ isFile: () => true, mode: 0o100644 }),
    },
    platform: 'linux',
    resolveHookPath: () => ({ ok: true, path: '/repo/.git/hooks/pre-commit' }),
  });
  const check = validateGitHook({ scanner: 'scripts/pre-commit-check.js' }, context);
  assert.strictEqual(check.status, STATUS.FAIL);
  assert.match(check.detail, /not executable/);
});

test('hook: a commented scanner command does not count as active behavior', () => {
  const context = createContext({
    fs: {
      existsSync: () => true,
      readFileSync: () => '#!/bin/sh\n# node scripts/pre-commit-check.js\nexit 0\n',
      statSync: () => ({ isFile: () => true, mode: 0o100755 }),
    },
    platform: 'linux',
    resolveHookPath: () => ({ ok: true, path: '/repo/.git/hooks/pre-commit' }),
  });
  const check = validateGitHook({ scanner: 'scripts/pre-commit-check.js' }, context);
  assert.strictEqual(check.status, STATUS.FAIL);
  assert.match(check.detail, /one unmasked scanner command/);
});

test('hook: an early successful exit cannot mask an unreachable scanner', () => {
  const context = createContext({
    fs: {
      existsSync: () => true,
      readFileSync: () => '#!/bin/sh\nexit 0\nnode scripts/pre-commit-check.js\n',
      statSync: () => ({ isFile: () => true, mode: 0o100755 }),
    },
    platform: 'linux',
    resolveHookPath: () => ({ ok: true, path: '/repo/.git/hooks/pre-commit' }),
    spawnSync: () => execution(0),
  });
  assert.strictEqual(
    validateGitHook({ scanner: 'scripts/pre-commit-check.js' }, context).status,
    STATUS.FAIL
  );
});

test('hook: a shell success mask cannot hide scanner failure', () => {
  const context = createContext({
    fs: {
      existsSync: () => true,
      readFileSync: () => '#!/bin/sh\nnode scripts/pre-commit-check.js || true\n',
      statSync: () => ({ isFile: () => true, mode: 0o100755 }),
    },
    platform: 'linux',
    resolveHookPath: () => ({ ok: true, path: '/repo/.git/hooks/pre-commit' }),
    spawnSync: () => execution(0),
  });
  assert.strictEqual(
    validateGitHook({ scanner: 'scripts/pre-commit-check.js' }, context).status,
    STATUS.FAIL
  );
});

test('hook: a scanner path in a trailing comment is not behavior', () => {
  const context = createContext({
    fs: {
      existsSync: () => true,
      readFileSync: () => '#!/bin/sh\nnode --version # scripts/pre-commit-check.js\n',
      statSync: () => ({ isFile: () => true, mode: 0o100755 }),
    },
    platform: 'linux',
    resolveHookPath: () => ({ ok: true, path: '/repo/.git/hooks/pre-commit' }),
    spawnSync: () => execution(0),
  });
  assert.strictEqual(
    validateGitHook({ scanner: 'scripts/pre-commit-check.js' }, context).status,
    STATUS.FAIL
  );
});

test('hook: Git active-hook lookup uses argument arrays without a shell', () => {
  let observed;
  const context = createContext({
    spawnSync: (command, args, options) => {
      observed = { command, args, options };
      return execution(0, '/repo/.githooks/pre-commit\n');
    },
  });
  const resolved = resolveGitHookPath(context);
  assert.strictEqual(resolved.ok, true);
  assert.strictEqual(resolved.path, '/repo/.githooks/pre-commit');
  assert.strictEqual(observed.command, 'git');
  assert.deepStrictEqual(observed.args, [
    'rev-parse', '--path-format=absolute', '--git-path', 'hooks/pre-commit',
  ]);
  assert.strictEqual(observed.options.shell, false);
});

test('scanner: default checklist requires --all mode', () => {
  const checklist = JSON.parse(fs.readFileSync(path.join(__dirname, 'checklist.json'), 'utf8'));
  const scanner = checklist.checks.find(check => check.type === 'scanner');
  assert.ok(scanner, 'expected scanner check');
  assert.deepStrictEqual(scanner.args, ['--all']);
});

test('scanner: validator executes the full-tree mode with the active Node runtime', () => {
  let observed;
  const context = createContext({
    cwd: path.resolve(__dirname, '..', '..', '..'),
    execPath: '/runtime/node',
    fs: { existsSync: () => true },
    spawnSync: (command, args, options) => {
      observed = { command, args, options };
      return execution(0, 'pre-commit-check: --all mode — scanning 1 tracked files.');
    },
  });
  const check = validateScanner({
    path: 'scripts/pre-commit-check.js',
    args: ['--all'],
    expect: 'contains:pre-commit-check: --all mode',
  }, context);
  assert.strictEqual(check.status, STATUS.PASS);
  assert.strictEqual(observed.command, '/runtime/node');
  assert.strictEqual(observed.args.at(-1), '--all');
  assert.strictEqual(observed.options.shell, false);
});

test('scanner: missing --all is FAIL before execution', () => {
  let called = false;
  const context = createContext({
    fs: { existsSync: () => true },
    spawnSync: () => { called = true; return execution(0); },
  });
  const check = validateScanner({ path: 'scripts/pre-commit-check.js', args: [] }, context);
  assert.strictEqual(check.status, STATUS.FAIL);
  assert.strictEqual(called, false);
});

test('tracked text: Node inspection replaces Unix redirection and true', () => {
  let observed;
  const context = createContext({
    cwd: '/repo',
    fs: {
      readFileSync: file => String(file).endsWith('clean.md') ? 'No marker here\n' : '',
    },
    spawnSync: (command, args, options) => {
      observed = { command, args, options };
      return execution(0, 'clean.md\0');
    },
  });
  const check = validateTrackedTextAbsent({ needles: [FORBIDDEN_MARKER], extensions: ['.md'] }, context);
  assert.strictEqual(check.status, STATUS.PASS);
  assert.strictEqual(observed.command, 'git');
  assert.deepStrictEqual(observed.args, ['ls-files', '-z']);
  assert.strictEqual(observed.options.shell, false);
});

test('tracked text: a forbidden marker is FAIL', () => {
  const context = createContext({
    cwd: '/repo',
    fs: { readFileSync: () => `${FORBIDDEN_MARKER} unresolved\n` },
    spawnSync: () => execution(0, 'tracked.md\0'),
  });
  const check = validateTrackedTextAbsent({ needles: [FORBIDDEN_MARKER], extensions: ['.md'] }, context);
  assert.strictEqual(check.status, STATUS.FAIL);
  assert.match(check.detail, /tracked\.md/);
});

test('checklist: contains no Unix shell control or redirection snippets', () => {
  const raw = fs.readFileSync(path.join(__dirname, 'checklist.json'), 'utf8');
  assert.doesNotMatch(raw, /\/dev\/null|\|\||&&|2>/);
});

test('summary: READY requires every required check to PASS', () => {
  const ready = summarize([
    { required: true, status: STATUS.PASS },
    { required: false, status: STATUS.SKIPPED },
  ]);
  assert.strictEqual(ready.exitCode, EXIT.READY);

  const blocked = summarize([{ required: true, status: STATUS.SKIPPED }]);
  assert.strictEqual(blocked.exitCode, EXIT.BLOCKED);
  assert.strictEqual(blocked.state, 'BLOCKED');

  const noRequiredChecks = summarize([{ required: false, status: STATUS.PASS }]);
  assert.strictEqual(noRequiredChecks.exitCode, EXIT.BLOCKED);
});

test('summary: optional UNKNOWN is DEGRADED, not READY', () => {
  const summary = summarize([
    { required: true, status: STATUS.PASS },
    { required: false, status: STATUS.UNKNOWN },
  ]);
  assert.strictEqual(summary.exitCode, EXIT.DEGRADED);
  assert.strictEqual(summary.counts.UNKNOWN, 1);
});

test('summary: an invalid optional status is normalized to UNKNOWN and DEGRADED', () => {
  const summary = summarize([
    { required: true, status: STATUS.PASS },
    { required: false, status: 'BROKEN' },
  ]);
  assert.strictEqual(summary.exitCode, EXIT.DEGRADED);
  assert.strictEqual(summary.counts.UNKNOWN, 1);
});

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
