'use strict';
// endpoint-sync.test.js: the device-status and MDM-sync read-backs (batch G3, task 5d).
//
// EXPECTED DECISION (written before the code)
// - Fleet: `verify-checked-in --id [HOST_ID] --not-before [NOT_BEFORE]` reads the host
//   (GET /api/v1/fleet/hosts/:id) and passes only when the host is the one asked for, its
//   MDM enrollment reads On, and last_mdm_checked_in_at is at or after --not-before (vendor
//   facts F-07, F-08). A host with no MDM is not verified, and the reason says to use
//   seen_time and the host's own status instead.
// - Jamf Pro: `verify-checked-in --serial [SERIAL_NUMBER] --not-before [NOT_BEFORE]` reads
//   the Mac by serial (HARDWARE, then GENERAL, the same record) and passes only when
//   general.lastContactTime is at or after --not-before (vendor fact J-07: Jamf Pro defines
//   no "last MDM check-in" field; lastContactTime is the closest and the output says so).
// - Both are dry runs unless --execute, read only, and print verified true or false
//   (exit 0 or 2) with what they saw.
// Run: node --test scripts/adapters/endpoint-sync.test.js

require('./socket-tripwire.js');

const assert = require('node:assert/strict');
const test = require('node:test');

const fleet = require('./fleet-client.js');
const jamf = require('./jamf-client.js');

const TOKEN = ['sentinel', 'endpoint', 'credential', String(11 * 4021)].join('-');
const NOT_BEFORE = '2026-10-28T09:00:00Z';

function queued(replies) {
  const calls = [];
  const transport = async (request) => {
    calls.push(request);
    const next = replies.length ? replies.shift() : { status: 500, body: '{}' };
    return { status: next.status, headers: {}, body: JSON.stringify(next.body) };
  };
  transport.calls = calls;
  return transport;
}
async function cli(adapter, argv, env, replies) {
  const transport = queued(replies);
  const out = [];
  const code = await adapter.run(argv, env, { transport, sleep: async () => {}, now: () => Date.parse('2026-10-28T10:00:00Z'), out: (s) => out.push(String(s)), err: (s) => out.push(String(s)) });
  const raw = out.join('');
  const i = raw.indexOf('{');
  return { code, text: raw, json: i === -1 ? null : JSON.parse(raw.slice(i, raw.lastIndexOf('}') + 1)), transport };
}

const FLEET_ENV = { FLEET_URL: 'fleet.example.invalid', FLEET_API_TOKEN: TOKEN };
const host = (over = {}) => ({ host: { id: 7, platform: 'darwin', status: 'online', seen_time: '2026-10-28T09:40:00Z', detail_updated_at: '2026-10-28T09:20:00Z', last_mdm_checked_in_at: '2026-10-28T09:30:00Z', mdm: { enrollment_status: 'On (automatic)', connected_to_fleet: true }, ...over } });

test('Fleet verify-checked-in: the MDM check-in after --not-before passes; an older one, MDM off, or another host does not', async () => {
  const yes = await cli(fleet, ['verify-checked-in', '--id', '7', '--not-before', NOT_BEFORE, '--execute'], FLEET_ENV, [{ status: 200, body: host() }]);
  assert.equal(yes.code, 0, yes.text);
  assert.equal(yes.json.verified, true);
  assert.equal(yes.transport.calls.length, 1);
  assert.equal(yes.transport.calls[0].method, 'GET');
  assert.equal(yes.transport.calls[0].path, '/api/v1/fleet/hosts/7?exclude_software=true');
  assert.equal(yes.json.observed['host.last_mdm_checked_in_at'], '2026-10-28T09:30:00Z');
  const old = await cli(fleet, ['verify-checked-in', '--id', '7', '--not-before', NOT_BEFORE, '--execute'], FLEET_ENV, [{ status: 200, body: host({ last_mdm_checked_in_at: '2026-10-27T09:30:00Z' }) }]);
  assert.equal(old.code, 2);
  assert.equal(old.json.verified, false);
  const off = await cli(fleet, ['verify-checked-in', '--id', '7', '--not-before', NOT_BEFORE, '--execute'], FLEET_ENV, [{ status: 200, body: host({ platform: 'ubuntu', last_mdm_checked_in_at: null, mdm: { enrollment_status: null } }) }]);
  assert.equal(off.code, 2);
  assert.match(off.json.note || off.json.reason || '', /seen_time/);
  const other = await cli(fleet, ['verify-checked-in', '--id', '7', '--not-before', NOT_BEFORE, '--execute'], FLEET_ENV, [{ status: 200, body: host({ id: 8 }) }]);
  assert.equal(other.code, 2);
  const dry = await cli(fleet, ['verify-checked-in', '--id', '7', '--not-before', NOT_BEFORE], { FLEET_URL: 'fleet.example.invalid' }, []);
  assert.equal(dry.code, 4, dry.text);
  assert.equal(dry.transport.calls.length, 0);
  assert.ok(!yes.text.includes(TOKEN));
});

const JAMF_ENV = { JAMF_URL: 'jamf.example.invalid', JAMF_CLIENT_ID: 'client-id', JAMF_CLIENT_SECRET: TOKEN };
const SERIAL = 'C02TEST0001';
const jamfReplies = (general) => [
  { status: 200, body: { access_token: 'issued-jamf-access', expires_in: 600 } },
  { status: 200, body: { totalCount: 1, results: [{ id: '7', hardware: { serialNumber: SERIAL } }] } },
  { status: 200, body: { totalCount: 1, results: [{ id: '7', general }] } },
];

test('Jamf Pro verify-checked-in: lastContactTime after --not-before passes, and the output names the field it used', async () => {
  const yes = await cli(jamf, ['verify-checked-in', '--serial', SERIAL, '--not-before', NOT_BEFORE, '--execute'], JAMF_ENV, jamfReplies({ lastContactTime: '2026-10-28T09:30:00.000Z', reportDate: '2026-10-28T09:31:00.000Z', mdmCapable: { capable: true } }));
  assert.equal(yes.code, 0, yes.text);
  assert.equal(yes.json.verified, true);
  assert.equal(yes.json.observed.lastContactTime, '2026-10-28T09:30:00.000Z');
  assert.match(JSON.stringify(yes.json), /lastContactTime/);
  const gets = yes.transport.calls.filter((c) => c.method === 'GET');
  assert.equal(gets.length, 2);
  assert.match(gets[1].path, /section=GENERAL/);
  const old = await cli(jamf, ['verify-checked-in', '--serial', SERIAL, '--not-before', NOT_BEFORE, '--execute'], JAMF_ENV, jamfReplies({ lastContactTime: '2026-10-20T09:30:00.000Z' }));
  assert.equal(old.code, 2);
  assert.equal(old.json.verified, false);
  const none = await cli(jamf, ['verify-checked-in', '--serial', SERIAL, '--not-before', NOT_BEFORE, '--execute'], JAMF_ENV, jamfReplies({}));
  assert.equal(none.code, 5); // batch G4, task D1: no lastContactTime is INCONCLUSIVE
  const dry = await cli(jamf, ['verify-checked-in', '--serial', SERIAL, '--not-before', NOT_BEFORE], { JAMF_URL: 'jamf.example.invalid' }, []);
  assert.equal(dry.code, 4, dry.text);
  assert.equal(dry.transport.calls.length, 0);
  assert.ok(!yes.text.includes(TOKEN) && !yes.text.includes('issued-jamf-access'));
});
