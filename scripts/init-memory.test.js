#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const SCRIPT = path.join(__dirname, 'init-memory.js');
const {
  encodeProjectRoot,
  parseArgs,
  resolveMemoryDir,
  validateProjectKey,
  writeFilesAtomically
} = require('./init-memory');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-init-memory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function runCli(memoryDir, ...args) {
  return spawnSync(process.execPath, [SCRIPT, '--memory-dir', memoryDir, ...args], {
    encoding: 'utf8',
    env: { ...process.env }
  });
}

test('dry-run previews every file without creating the target directory', t => {
  const memoryDir = path.join(fixture(t), 'memory');
  const result = runCli(memoryDir, '--dry-run');

  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /preview only/);
  assert.match(result.stdout, /MEMORY\.md/);
  assert.strictEqual(fs.existsSync(memoryDir), false);
});

test('initialization succeeds once and refuses an unforced replacement', t => {
  const memoryDir = path.join(fixture(t), 'memory');
  const first = runCli(memoryDir);
  assert.strictEqual(first.status, 0, first.stderr);
  assert.strictEqual(fs.readdirSync(memoryDir).filter(name => name.endsWith('.md')).length, 6);

  const before = fs.readFileSync(path.join(memoryDir, 'MEMORY.md'), 'utf8');
  const second = runCli(memoryDir);
  assert.strictEqual(second.status, 2);
  assert.match(second.stderr, /Refusing to replace existing memory/);
  assert.strictEqual(fs.readFileSync(path.join(memoryDir, 'MEMORY.md'), 'utf8'), before);
});

test('partial initialization is reported and remains unchanged without force', t => {
  const memoryDir = path.join(fixture(t), 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });
  const partialFile = path.join(memoryDir, 'user_role.md');
  fs.writeFileSync(partialFile, 'operator-owned marker\n', 'utf8');

  const result = runCli(memoryDir);
  assert.strictEqual(result.status, 2);
  assert.match(result.stdout, /Partial initialization detected: 1\/6/);
  assert.strictEqual(fs.readFileSync(partialFile, 'utf8'), 'operator-owned marker\n');
  assert.deepStrictEqual(fs.readdirSync(memoryDir), ['user_role.md']);
});

test('--force creates and verifies a timestamped backup before replacement', t => {
  const memoryDir = path.join(fixture(t), 'memory');
  assert.strictEqual(runCli(memoryDir).status, 0);
  const ownedFile = path.join(memoryDir, 'user_role.md');
  fs.writeFileSync(ownedFile, 'operator-owned marker\n', 'utf8');

  const result = runCli(memoryDir, '--force');
  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /Verified backup:/);
  assert.doesNotMatch(fs.readFileSync(ownedFile, 'utf8'), /operator-owned marker/);

  const backupRoot = path.join(memoryDir, '.backups');
  const backups = fs.readdirSync(backupRoot);
  assert.strictEqual(backups.length, 1);
  const backedUp = path.join(backupRoot, backups[0], 'user_role.md');
  assert.strictEqual(fs.readFileSync(backedUp, 'utf8'), 'operator-owned marker\n');
});

test('a caught install failure restores every original file', t => {
  const memoryDir = path.join(fixture(t), 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });
  fs.writeFileSync(path.join(memoryDir, 'one.md'), 'original one\n', 'utf8');
  fs.writeFileSync(path.join(memoryDir, 'two.md'), 'original two\n', 'utf8');

  let installs = 0;
  assert.throws(() => writeFilesAtomically(memoryDir, [
    { file: 'one.md', content: 'replacement one\n' },
    { file: 'two.md', content: 'replacement two\n' }
  ], {
    replaceFiles: new Set(['one.md', 'two.md']),
    installFile(from, to) {
      installs += 1;
      if (installs === 2) throw new Error('simulated interruption');
      fs.renameSync(from, to);
    }
  }), /simulated interruption/);

  assert.strictEqual(fs.readFileSync(path.join(memoryDir, 'one.md'), 'utf8'), 'original one\n');
  assert.strictEqual(fs.readFileSync(path.join(memoryDir, 'two.md'), 'utf8'), 'original two\n');
  assert.strictEqual(fs.readdirSync(memoryDir).some(name => name.endsWith('.tmp')), false);
});

test('a concurrently created target is never replaced without prior ownership', t => {
  const memoryDir = path.join(fixture(t), 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });
  const target = path.join(memoryDir, 'new.md');
  fs.writeFileSync(target, 'concurrent owner content\n', 'utf8');

  assert.throws(() => writeFilesAtomically(memoryDir, [
    { file: 'new.md', content: 'planned content\n' }
  ]), /Atomic memory update failed/);

  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'concurrent owner content\n');
  assert.strictEqual(fs.readdirSync(memoryDir).some(name => name.endsWith('.tmp')), false);

  const lateTarget = path.join(memoryDir, 'late.md');
  assert.throws(() => writeFilesAtomically(memoryDir, [
    { file: 'late.md', content: 'planned late content\n' }
  ], {
    beforeInstall() {
      fs.writeFileSync(lateTarget, 'late concurrent owner content\n', 'utf8');
    }
  }), /Atomic memory update failed/);
  assert.strictEqual(fs.readFileSync(lateTarget, 'utf8'), 'late concurrent owner content\n');
});

test('repository-derived keys include the full stable path', () => {
  assert.notStrictEqual(
    encodeProjectRoot(path.join('C:', 'one', 'repo')),
    encodeProjectRoot(path.join('D:', 'two', 'repo'))
  );
});

test('PROJECT_KEY accepts only a bounded slug and cannot escape the project root', () => {
  assert.strictEqual(validateProjectKey('aegis_public-1'), 'aegis_public-1');
  for (const unsafe of ['../escape', '..', '.', '/absolute', '\\absolute', 'C:\\escape', 'nested/path', 'nested\\path', '-leading']) {
    assert.throws(() => resolveMemoryDir({}, { PROJECT_KEY: unsafe }), /PROJECT_KEY must be a simple/);
  }
  assert.throws(() => validateProjectKey('x'.repeat(129)), /PROJECT_KEY must be a simple/);
});

test('boolean flags reject attached or trailing values', () => {
  assert.throws(() => parseArgs(['--force=false']), /Unknown argument/);
  assert.throws(() => parseArgs(['--force', 'false']), /Unknown argument/);
  assert.throws(() => parseArgs(['--memory-dir', '--force']), /requires a path/);
});
