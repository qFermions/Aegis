#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { TextDecoder } = require('util');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const decoder = new TextDecoder('utf-8', { fatal: true });

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

function textFiles() {
  return trackedFiles();
}

test('all command files have valid description frontmatter', () => {
  const directory = path.join(ROOT, '.claude', 'commands');
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.md')).sort();
  assert.strictEqual(files.length, 65);

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

test('tracked JSON parses and every tracked file is strict UTF-8 text', () => {
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
  for (const file of trackedFiles().filter(file => file.endsWith('.md'))) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const fences = content.split(/\r?\n/).filter(line => /^\s*```/.test(line)).length;
    if (fences % 2 !== 0) failures.push(file);
  }
  assert.deepStrictEqual(failures, [], `Unbalanced Markdown fences: ${failures.join(', ')}`);
});

test('tracked text files end with a newline and have no UTF-8 BOM', () => {
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
