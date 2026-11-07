'use strict';
// quarantine-readback-shell.test.js: code review round 1 (batch 9), finding 4. A HUMAN-RUN read-back line is
// pasted into a shell: a Message-ID carries angle brackets (redirections in bash) and a quarantine identity a
// backslash, so both placeholders are double-quoted. Wrong implementations it catches: an unquoted placeholder
// in the line or the Read-back field, and a desk that passes the quote marks to the connector.
// Run: node --test scripts/quarantine-readback-shell.test.js

require('./adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const text = fs.readFileSync(path.join(__dirname, '..', '.claude', 'commands', 'email-quarantine.md'), 'utf8');

test('every exo read-back line and field quotes [MESSAGE_ID] and [MESSAGE_IDENTITY_GUID]', () => {
  const lines = text.split('\n').filter((l) => /exo-client\.js verify-quarantine-released/.test(l));
  assert.ok(lines.length >= 6, `${lines.length} lines`);
  for (const l of lines) {
    assert.doesNotMatch(l, /(?<!")\[MESSAGE_ID\]|\[MESSAGE_ID\](?!")/, l);
    assert.doesNotMatch(l, /(?<!")\[MESSAGE_IDENTITY_GUID\]|\[MESSAGE_IDENTITY_GUID\](?!")/, l);
  }
});

test('the desk hands the connector the bound read-back\'s values without their quote marks', () => {
  const { catalog } = require('./demo/catalog.js');
  const g = catalog().get('quarantine-release-one-portal');
  assert.ok(g.bound.length, 'a bound read-back');
  assert.ok(g.bound[0].argv.includes('[MESSAGE_ID]'), g.bound[0].argv.join(' '));
});

// Code review round 1 (batch 9), finding 14: CLAUDE.md says a token is added through the placeholder dictionary,
// never defined in a runbook. Wrong implementation it catches: a read-back line with a token the dictionary lacks.
test('every token in the Exchange read-back lines is in the placeholder dictionary', () => {
  const dictionary = fs.readFileSync(path.join(__dirname, '..', 'modules', 'security', 'placeholder-dictionary.md'), 'utf8');
  const runbooks = ['email-quarantine', 'mailbox-permissions', 'shared-mailbox'].map((n) => fs.readFileSync(path.join(__dirname, '..', '.claude', 'commands', `${n}.md`), 'utf8')).join('\n');
  const tokens = new Set(runbooks.split('\n').filter((l) => /exo-client\.js verify-/.test(l)).flatMap((l) => l.match(/\[[A-Z@._]+\]/g) || []).filter((tok) => tok !== '[CHANGE_ID]'));
  for (const tok of tokens) assert.ok(dictionary.includes(`\`${tok}\``), `${tok} is in the dictionary`);
});
