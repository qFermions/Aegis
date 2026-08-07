#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { TextDecoder } = require('util');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const decoder = new TextDecoder('utf-8', { fatal: true });

function workingTreeFiles() {
  return execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: ROOT })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

function textFiles() {
  return workingTreeFiles();
}

test('all command files have valid description frontmatter', () => {
  const directory = path.join(ROOT, '.claude', 'commands');
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.md')).sort();
  assert.strictEqual(files.length, 58);

  const failures = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(directory, file), 'utf8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match || !/^description:\s*\S.+$/m.test(match[1])) failures.push(file);
  }
  assert.deepStrictEqual(failures, [], `Invalid command frontmatter: ${failures.join(', ')}`);
});

test('the bundled Claude plugin uses the canonical manifest and resolvable command paths', () => {
  const pluginRoot = path.join(ROOT, '.claude', 'plugins', 'enterprise-it-ops');
  const manifestPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.strictEqual(manifest.name, 'enterprise-it-ops');
  assert.strictEqual(manifest.displayName, 'Enterprise IT Operations');
  assert.ok(Array.isArray(manifest.commands) && manifest.commands.length > 0);
  for (const commandPath of manifest.commands) {
    assert.match(commandPath, /^\.\//, 'plugin component paths must be relative to the plugin root');
    const absolute = path.resolve(pluginRoot, commandPath);
    assert.strictEqual(fs.existsSync(absolute), true, `missing plugin command: ${commandPath}`);
    assert.match(fs.readFileSync(absolute, 'utf8'), /^---\n[\s\S]*?^description:\s*\S.+$[\s\S]*?^---$/m);
  }
});

test('fresh release staging includes the public password-reset runbook without weakening credential ignores', () => {
  const ignored = file => spawnSync(
    'git',
    ['check-ignore', '--quiet', '--no-index', '--', file],
    { cwd: ROOT, encoding: 'utf8' }
  );
  const publicRunbook = ignored('.claude/commands/password-reset.md');
  const unrelatedPasswordArtifact = ignored('local-password-notes.txt');

  assert.strictEqual(publicRunbook.error, undefined);
  assert.strictEqual(publicRunbook.status, 1, 'the canonical public runbook must not be ignored');
  assert.strictEqual(unrelatedPasswordArtifact.error, undefined);
  assert.strictEqual(unrelatedPasswordArtifact.status, 0, 'unrelated password-named artifacts must stay ignored');
});

test('working-tree JSON parses and every tracked or non-ignored file is strict UTF-8 text', () => {
  const encodingFailures = [];
  const jsonFailures = [];
  for (const file of textFiles()) {
    const absolute = path.join(ROOT, file);
    const bytes = fs.readFileSync(absolute);
    try {
      decoder.decode(bytes);
    } catch {
      encodingFailures.push(file);
      continue;
    }
    if (path.extname(file) === '.json') {
      try {
        JSON.parse(bytes.toString('utf8'));
      } catch {
        jsonFailures.push(file);
      }
    }
  }
  assert.deepStrictEqual(encodingFailures, [], `Invalid UTF-8: ${encodingFailures.join(', ')}`);
  assert.deepStrictEqual(jsonFailures, [], `Invalid JSON: ${jsonFailures.join(', ')}`);
});

test('Markdown fences are balanced', () => {
  const failures = [];
  for (const file of workingTreeFiles().filter(file => file.endsWith('.md'))) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const fences = content.split(/\r?\n/).filter(line => /^\s*```/.test(line)).length;
    if (fences % 2 !== 0) failures.push(file);
  }
  assert.deepStrictEqual(failures, [], `Unbalanced Markdown fences: ${failures.join(', ')}`);
});

test('working-tree text files end with a newline and have no UTF-8 BOM', () => {
  const missingNewline = [];
  const bom = [];
  for (const file of textFiles()) {
    const bytes = fs.readFileSync(path.join(ROOT, file));
    if (bytes.length > 0 && bytes[bytes.length - 1] !== 0x0a) missingNewline.push(file);
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bom.push(file);
  }
  assert.deepStrictEqual(missingNewline, [], `Missing EOF newline: ${missingNewline.join(', ')}`);
  assert.deepStrictEqual(bom, [], `UTF-8 BOM found: ${bom.join(', ')}`);
});

test('legacy parallel tenant and operator placeholders are absent', () => {
  const failures = [];
  const legacyToken = /\[YOUR_[A-Z0-9_*]+\]|\[[A-Za-z0-9._%+-]+@YOUR_[A-Z0-9_]+\]/g;
  for (const file of textFiles()) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const matches = content.match(legacyToken);
    if (matches) failures.push(`${file}: ${matches.join(', ')}`);
  }
  assert.deepStrictEqual(failures, [], `Legacy parallel placeholders found: ${failures.join('; ')}`);
});
