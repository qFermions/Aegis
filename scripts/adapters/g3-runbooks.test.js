'use strict';
// g3-runbooks.test.js: the batch G3 connectors and the runbooks that call them (task 5).
//
// EXPECTED DECISION (written before the runbook changes)
// - Every `node scripts/adapters/<connector>-client.js ...` line in a runbook wired to a G3
//   connector runs exactly as written: with each placeholder filled by a valid sample
//   value and --execute dropped, the connector's own dry run exits 0 and sends nothing.
//   A command that does not exist, a flag the command does not take, or a value the
//   connector refuses fails here, so a runbook can never tell a person to run a read-back
//   that would not work.
// - Each runbook carries the read-backs its changes need (REQUIRED below).
// - No runbook line calls a connector with anything but a read: there is no write command
//   to call (each connector refuses every non-GET and every unknown command).
// Run: node --test scripts/adapters/g3-runbooks.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(ROOT, '.claude', 'commands', `${name}.md`), 'utf8');

const CONNECTORS = {
  msgraph: {
    client: () => require('./msgraph-client.js'),
    env: { MS_TENANT_ID: '11111111-2222-4333-8444-555555555555' },
    values: {
      '[USER_ID]': 'aaaaaaaa-0000-4000-8000-000000000001', '[GROUP_ID]': 'bbbbbbbb-0000-4000-8000-000000000002',
      '[DEVICE_ID]': 'cccccccc-0000-4000-8000-000000000003', '[NOT_BEFORE]': '2026-10-28T09:00:00Z', '[UPN]': 'person@example.com',
    },
    runbooks: {
      'password-reset': ['verify-password-changed', 'verify-signin'],
      'mfa-issue': ['verify-mfa-cleared', 'verify-mfa-method', 'verify-signin'],
    },
  },
};

// The connector command lines in a runbook, as argv arrays (simple double quotes kept together).
function commandLines(text, connector) {
  const re = new RegExp(`^\\s*node scripts/adapters/${connector}-client\\.js (.+)$`, 'gm');
  return [...text.matchAll(re)].map((m) => (m[1].match(/"[^"]*"|\S+/g) || []).map((t) => t.replace(/^"|"$/g, '')));
}

for (const [connector, c] of Object.entries(CONNECTORS)) {
  for (const [runbook, required] of Object.entries(c.runbooks)) {
    test(`${runbook}: every ${connector} line runs as written (dry run) and the required read-backs are there`, async () => {
      const lines = commandLines(read(runbook), connector);
      const commands = new Set(lines.map((argv) => argv[0]));
      for (const name of required) assert.ok(commands.has(name), `${runbook} calls ${name}`);
      for (const argv of lines) {
        const filled = argv.filter((t) => t !== '--execute').map((t) => (Object.prototype.hasOwnProperty.call(c.values, t) ? c.values[t] : t));
        const unfilled = filled.filter((t) => /^\[[A-Z_@.]+\]$/.test(t));
        assert.deepEqual(unfilled, [], `${runbook}: a placeholder with no sample value in ${argv.join(' ')}`);
        const out = [];
        let sent = 0;
        const code = await c.client().run(filled, c.env, { transport: async () => { sent += 1; throw new Error('no network in a dry run'); }, out: (s) => out.push(s), err: (s) => out.push(s) });
        assert.equal(code, 0, `${runbook}: ${argv.join(' ')}\n${out.join('')}`);
        assert.equal(sent, 0);
        assert.match(out.join(''), /dry run/);
      }
    });
  }
}
