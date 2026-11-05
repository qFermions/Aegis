'use strict';
require('../adapters/socket-tripwire.js');
// customers.test.js: the fictional customers and tickets of the Customer Desk (batch 6, task 1).
//
// EXPECTED DECISION (written before the loader)
// - 5 customers (A to E) and 8 tickets (T1 to T8), each with the fields the desk reads.
// - Every domain in every data file is an example.com, example.net or example.org domain or a
//   subdomain of one; every person is a placeholder or a role, never a name.
// - intake.js ACCEPTS each ticket under its own customer's tenant variables, and T6 is flagged.
// What a wrong implementation would be caught by:
// - the domain check catches a ticket or tenant file that names a real domain (its own test feeds
//   it one); the person check catches a display name that is a person (its own test too); the
//   intake check catches a raw item whose tenant evidence does not match the customer.
// Run: node --test scripts/demo/customers.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const intake = require('../intake/intake.js');
const desk = require('./customers.js');

const DIR = path.join(__dirname, 'customers');
const dataFiles = () => fs.readdirSync(DIR, { recursive: true }).map(String).filter((f) => /\.(?:json|eml)$/.test(f)).map((f) => path.join(DIR, f));

const IDS = ['A', 'B', 'C', 'D', 'E'];
const TICKETS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];

test('five customers and eight tickets, each with the fields the desk reads', () => {
  const { customers, tickets } = desk.loadData();
  assert.deepEqual(customers.map((c) => c.id), IDS);
  assert.deepEqual(tickets.map((t) => t.id), TICKETS);
  for (const c of customers) {
    assert.match(c.label, new RegExp(`^Customer ${c.id}: `), c.id);
    assert.ok(Array.isArray(c.stack) && c.stack.length > 0, `${c.id} stack`);
    assert.ok(Array.isArray(c.connectors), `${c.id} connectors`);
    assert.match(c.tenant_vars.AEGION_DOMAIN, /\.example\.(?:com|net|org)$/, `${c.id} domain`);
    const tenant = desk.loadTenant(c);
    for (const key of ['users', 'groups', 'devices', 'mailboxes']) assert.ok(Array.isArray(tenant[key]), `${c.id} tenant ${key}`);
    assert.match(tenant.note, /SIMULATED/, `${c.id} tenant is labeled`);
  }
  for (const t of tickets) {
    assert.ok(IDS.includes(t.customer), `${t.id} customer`);
    assert.ok(['email', 'slack'].includes(t.source), `${t.id} source`);
    assert.ok(['R0', 'R1', 'R2', 'R3', 'none'].includes(t.change_class), `${t.id} class`);
    assert.ok(['', 'injection'].includes(t.probe), `${t.id} probe`);
    assert.ok(t.title && t.expected_path, `${t.id} text`);
    assert.ok(fs.existsSync(path.join(DIR, t.file)), `${t.id} raw file`);
    assert.equal(typeof t.targets, 'object', `${t.id} targets`);
  }
  const customers5 = new Set(customers.map((c) => c.tenant_vars.AEGION_DOMAIN));
  assert.equal(customers5.size, 5, 'no two customers share a domain');
});

test('the charter\'s customer stacks and ticket routing hold', () => {
  const { customers, tickets } = desk.loadData();
  const by = Object.fromEntries(customers.map((c) => [c.id, c]));
  assert.match(by.A.label, /14-seat dental office/);
  assert.match(by.B.label, /40-person design studio/);
  assert.match(by.C.label, /80-person logistics company/);
  assert.match(by.D.label, /30-person software startup/);
  assert.match(by.E.label, /12-person accounting firm/);
  const route = Object.fromEntries(tickets.map((t) => [t.id, `${t.customer}/${t.source}`]));
  assert.deepEqual(route, { T1: 'A/email', T2: 'D/slack', T3: 'B/email', T4: 'E/email', T5: 'C/email', T6: 'D/slack', T7: 'B/slack', T8: 'E/email' });
});

test('every domain in the data is an example.* domain; a real domain is caught', () => {
  assert.deepEqual(desk.foreignDomains('write to help@contoso.com or see https://portal.contoso.com/x'), ['contoso.com', 'portal.contoso.com']);
  assert.deepEqual(desk.foreignDomains('a@example.com b@x.example.net c@y.z.example.org [USER@DOMAIN.COM] d@[@Aegion_DOMAIN]'), []);
  for (const file of dataFiles()) assert.deepEqual(desk.foreignDomains(fs.readFileSync(file, 'utf8')), [], path.relative(DIR, file));
  for (const c of desk.loadData().customers) {
    assert.deepEqual(desk.foreignDomains(Object.values(c.tenant_vars).join(' ')), [], `${c.id} tenant variables`);
  }
});

test('every person is a placeholder or a role; a name is caught', () => {
  assert.deepEqual(desk.personNames('From: Jane Doe <a@example.com>\nHi, Bob Smith here.'), ['Jane Doe', 'Bob Smith']);
  assert.deepEqual(desk.personNames('From: Office Manager <a@example.com>\nPlease give [UPN] Full Access. Thanks, [FIRST_NAME]'), []);
  for (const file of dataFiles()) assert.deepEqual(desk.personNames(fs.readFileSync(file, 'utf8')), [], path.relative(DIR, file));
});

test('intake ACCEPTS every ticket under its own customer\'s tenant variables, and flags T6', () => {
  const { customers, tickets } = desk.loadData();
  for (const t of tickets) {
    const c = customers.find((x) => x.id === t.customer);
    const raw = desk.rawItem(t, c);
    assert.ok(!raw.includes('[@Aegion_DOMAIN]'), `${t.id}: the customer's domain is filled in`);
    const r = intake.fromText(t.source, raw, { env: c.tenant_vars });
    assert.equal(r.state, 'ACCEPTED', `${t.id}: ${r.reason || ''}`);
    assert.equal(r.injection_flags > 0, t.id === 'T6', `${t.id} injection flags: ${r.injection_flags}`);
  }
});

test('the targets and tenant files fill the customer domain and name no address outside it', () => {
  const { customers, tickets } = desk.loadData();
  const d = customers.find((c) => c.id === 'D');
  const t2 = tickets.find((t) => t.id === 'T2');
  assert.equal(desk.fill(t2.targets['google-workspace']['[USER@DOMAIN.COM]'], d), `departing.engineer@${d.tenant_vars.AEGION_DOMAIN}`);
  const tenant = desk.loadTenant(d);
  assert.ok(JSON.stringify(tenant).includes(`departing.engineer@${d.tenant_vars.AEGION_DOMAIN}`));
  assert.ok(!JSON.stringify(tenant).includes('[@Aegion_DOMAIN]'));
});
