'use strict';
// verify-flags.test.js: every flag of every verify-* command in the nine connectors is declared
// (batch G4, task A3; D10 on PR #9: --not-before was not recorded).
//
// EXPECTED DECISION (written before the module)
// - scripts/adapters/verify-flags.js holds, in one block per connector, every flag each of its
//   verify-* commands takes: a pass flag with its rule (a switch, a time bound, or a closed set,
//   number or digest), or not a pass flag with its reason (it names the object read, or it is free
//   text the trail does not record).
// - The flags each command takes are read from the connector's own command table, so a flag added
//   to a connector and not declared fails here; a declaration removed fails here too.
// - The owner's minimum is declared as pass flags wherever a command takes it: --not-before,
//   --absent, --expect-sha256, --type, --method and --expect.
// - The audit trail's PASS_FLAGS are built from these declarations and from nothing else.
// Run: node --test scripts/adapters/verify-flags.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const { test } = require('node:test');

const declared = require('./verify-flags.js');
const audit = require('../audit/audit-log.js');

// The flags each verify-* command takes, from each connector's own command table, and the keys
// each table entry may hold: a key not listed may carry flags the reader below does not see, so it
// fails the test until the reader learns it.
const READERS = {
  fleet: { table: () => require('./fleet-client.js').VERIFIES, flags: (s) => [...(s.values || []), ...(s.booleans || [])], keys: ['summary', 'usage', 'values', 'booleans', 'required', 'check', 'requests', 'then', 'verify'] },
  github: { table: () => require('./github-client.js').COMMANDS, flags: (s) => [...(s.flags || []), ...(s.optional || []), ...(s.booleans || [])], keys: ['kind', 'flags', 'optional', 'booleans', 'roleRule', 'stateRule', 'resolutionRule', 'reasonRule', 'steps', 'expected'] },
  'google-workspace': { table: () => require('./gws-client.js').COMMANDS, flags: (s) => [...(s.required || []), ...(s.optional || [])], keys: ['kind', 'required', 'optional', 'paths', 'expected'] },
  jamf: { table: () => require('./jamf-client.js').COMMANDS, flags: (s) => [...(s.flags || []), ...(s.optional || [])], keys: ['kind', 'flags', 'optional', 'plans', 'pages', 'expected'] },
  linear: { table: () => require('./linear-client.js').COMMANDS, flags: (s) => [...(s.flags || []), ...(s.optional || [])], keys: ['kind', 'document', 'flags', 'optional', 'variables', 'expected'] },
  msgraph: { table: () => require('./msgraph-client.js').COMMANDS, flags: (s) => [...(s.flags || []), ...(s.optional || []), ...(s.booleans || [])], keys: ['kind', 'flags', 'optional', 'booleans', 'guidUser', 'steps', 'expected'] },
  okta: { table: () => require('./okta-client.js').COMMANDS, flags: (s) => [...(s.required || []), ...(s.optional || [])], keys: ['kind', 'required', 'optional', 'plans', 'expected', 'pages'] },
  slack: { table: () => require('./slack-client.js').COMMANDS, flags: (s) => Object.keys(s.flags || {}), keys: ['kind', 'team', 'flags', 'required', 'steps', 'pagination', 'verify'] },
  jira: { table: () => require('../jira-client.js').VERIFY_FLAGS, flags: (s) => s.filter((f) => f !== 'execute'), keys: null },
};

function taken() {
  const found = {};
  for (const [connector, reader] of Object.entries(READERS)) {
    found[connector] = {};
    for (const [command, spec] of Object.entries(reader.table())) {
      if (!/^verify-/.test(command)) continue;
      if (reader.keys) for (const key of Object.keys(spec)) assert.ok(reader.keys.includes(key), `${connector} ${command}: its table entry has the key ${key}, which this test does not read flags from`);
      found[connector][command] = reader.flags(spec);
    }
  }
  return found;
}

test('every verify-* command of the nine connectors declares every flag it takes, and nothing it does not take', () => {
  const t = taken();
  assert.deepEqual(Object.keys(declared.VERIFY_FLAGS).sort(), Object.keys(READERS).sort(), 'one block per connector');
  const commands = Object.values(t).reduce((n, c) => n + Object.keys(c).length, 0);
  assert.ok(commands >= 60, `verify-* commands read: ${commands}`);
  assert.deepEqual(declared.undeclared(declared.VERIFY_FLAGS, t), []);
});

test('a declaration removed, or a flag a connector takes that no declaration names, is caught', () => {
  const t = taken();
  const copy = JSON.parse(JSON.stringify(declared.VERIFY_FLAGS, (k, v) => (v instanceof RegExp ? String(v) : v)));
  delete copy.msgraph['verify-sessions-revoked']['not-before'];
  assert.deepEqual(declared.undeclared(copy, t), ['msgraph verify-sessions-revoked --not-before: taken, not declared']);
  const more = JSON.parse(JSON.stringify(t));
  more.okta['verify-status'].push('since');
  assert.deepEqual(declared.undeclared(declared.VERIFY_FLAGS, more), ['okta verify-status --since: taken, not declared']);
  const fewer = JSON.parse(JSON.stringify(t));
  fewer.jamf['verify-group-count'] = ['id'];
  assert.deepEqual(declared.undeclared(declared.VERIFY_FLAGS, fewer), ['jamf verify-group-count --expect: declared, not taken']);
  delete fewer.jamf['verify-policy'];
  assert.ok(declared.undeclared(declared.VERIFY_FLAGS, fewer).includes('jamf verify-policy: declared, not a command'));
});

test('the owner\'s minimum is a pass flag wherever a command takes it: --not-before, --absent, --expect-sha256, --type, --method, --expect', () => {
  const t = taken();
  let seen = 0;
  for (const [connector, commands] of Object.entries(t)) {
    for (const [command, flags] of Object.entries(commands)) {
      for (const flag of flags.filter((f) => ['not-before', 'absent', 'expect-sha256', 'type', 'method', 'expect'].includes(f))) {
        const rule = declared.VERIFY_FLAGS[connector][command][flag];
        assert.ok(declared.isPassRule(rule), `${connector} ${command} --${flag} is a pass flag`);
        seen += 1;
      }
    }
  }
  assert.ok(seen >= 30, `minimum flags seen: ${seen}`);
  assert.equal(declared.VERIFY_FLAGS.msgraph['verify-sessions-revoked']['not-before'], declared.TIME);
  assert.equal(declared.VERIFY_FLAGS.jira['verify-create']['not-before'], declared.TIME);
});

test('every flag that is not a pass flag says why, and the trail\'s PASS_FLAGS are exactly the declared pass flags', () => {
  const built = {};
  for (const [connector, commands] of Object.entries(declared.VERIFY_FLAGS)) {
    for (const [command, flags] of Object.entries(commands)) {
      for (const [flag, rule] of Object.entries(flags)) {
        if (declared.isPassRule(rule)) {
          if (!built[`${connector}:${command}`]) built[`${connector}:${command}`] = {};
          built[`${connector}:${command}`][flag] = rule;
          if (rule instanceof RegExp) assert.ok(!rule.test('two words') && !rule.test(''), `${connector} ${command} --${flag}: no free text, no empty value`);
        } else {
          assert.equal(typeof rule.reason, 'string', `${connector} ${command} --${flag}: a reason`);
          assert.ok(rule.reason.length > 20, `${connector} ${command} --${flag}: a reason in words`);
        }
      }
    }
  }
  assert.deepEqual(Object.keys(audit.PASS_FLAGS).sort(), Object.keys(built).sort());
  for (const [kind, flags] of Object.entries(built)) assert.deepEqual(Object.keys(audit.PASS_FLAGS[kind]).sort(), Object.keys(flags).sort(), kind);
});

test('the declarations module loads no connector and no network module', () => {
  const src = require('node:fs').readFileSync(require.resolve('./verify-flags.js'), 'utf8');
  assert.doesNotMatch(src, /require\(/, 'pure data: it requires nothing');
});
