#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

function trackedMarkdown() {
  return execFileSync('git', ['ls-files', '-z', '*.md'], { cwd: ROOT })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

function linkTarget(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('<')) {
    const end = trimmed.indexOf('>');
    return end === -1 ? trimmed : trimmed.slice(1, end);
  }
  return trimmed.split(/\s+/, 1)[0];
}

test('relative Markdown file links resolve inside the repository', () => {
  const missing = [];
  for (const file of trackedMarkdown()) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const links = content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g);
    for (const match of links) {
      let target = linkTarget(match[1]);
      if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      target = target.split('#', 1)[0].split('?', 1)[0];
      if (!target || path.isAbsolute(target)) continue;

      let decoded;
      try {
        decoded = decodeURIComponent(target);
      } catch {
        missing.push(`${file}: malformed link encoding`);
        continue;
      }

      const absolute = path.resolve(ROOT, path.dirname(file), decoded);
      const relativeToRoot = path.relative(ROOT, absolute);
      if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) continue;
      if (!fs.existsSync(absolute)) missing.push(`${file} -> ${target}`);
    }
  }
  assert.deepStrictEqual(missing, [], `Missing local links:\n${missing.join('\n')}`);
});
