#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MANUAL_COMMANDS = [
  'aegis-update.md',
  'alpha-signal.md',
  'ask-hermes.md',
  'dashboard-render.md',
  'hermes-status.md',
  'jira-create.md',
  'jira-update.md',
  'morning-brief.md',
  'portfolio-status.md',
  'ps-script.md',
  'war-room.md'
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('credential-sensitive and direct-write commands are manual and risk classified', () => {
  for (const file of MANUAL_COMMANDS) {
    const content = read(path.join('.claude', 'commands', file));
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(frontmatter, `${file}: missing YAML frontmatter`);
    assert.match(frontmatter[1], /^disable-model-invocation: true$/m, `${file}: must be operator-only`);
    assert.match(content, /^## Risk metadata$/m, `${file}: missing risk metadata`);
    assert.match(content, /^- \*\*Risk level:\*\*/m, `${file}: missing risk level`);
    assert.match(content, /^- \*\*Access:\*\*/m, `${file}: missing access classification`);
    assert.match(content, /^- \*\*Credential-sensitive:\*\*/m, `${file}: missing credential classification`);
    assert.match(content, /^- \*\*Invocation:\*\*/m, `${file}: missing invocation classification`);
  }
});

test('the dashboard renderer is described as a reversible remote write', () => {
  const content = read(path.join('.claude', 'commands', 'dashboard-render.md'));
  assert.match(content, /R1 remote write/);
  assert.match(content, /\*\*Undo:\*\*/);
  assert.doesNotMatch(content, /not a state mutation|State-read-only|verified \*\*read-only\*\*/i);
});

test('public claims distinguish behavioral policy from deterministic controls', () => {
  const readme = read('README.md');
  const instructions = read('CLAUDE.md');
  assert.doesNotMatch(readme, /provably \*won't\* do|Every request flows through/);
  assert.match(readme, /R0–R3 is behavioral policy/);
  assert.match(instructions, /not a complete deterministic authorization boundary/);
});

test('tracked tip contains no privileged host/path examples or fixed development path', () => {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT });
  const files = output.toString('utf8').split('\0').filter(Boolean);
  const forbidden = [
    { label: 'privileged remote path', pattern: /\/root\//i },
    { label: 'privileged SSH target', pattern: /\broot@[a-z0-9]/i },
    { label: 'fixed development state path', pattern: /%USERPROFILE%\\ITOps/i }
  ];

  const findings = [];
  for (const file of files) {
    const absolute = path.join(ROOT, file);
    let content;
    try {
      content = fs.readFileSync(absolute, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of forbidden) {
        if (rule.pattern.test(line)) findings.push(`${rule.label}: ${file}:${index + 1}`);
      }
    });
  }

  assert.deepStrictEqual(findings, [], findings.join('\n'));
});
