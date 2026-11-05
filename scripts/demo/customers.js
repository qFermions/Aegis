'use strict';
// customers.js: loads the fictional customers and tickets of the Customer Desk.
//
// A data file writes a customer's own domain as [@Aegion_DOMAIN], because the repository's scanner
// allows only the bare example.* domains in an address. fill() puts the customer's fictional
// AEGION_DOMAIN in its place when the customer sends the item, or when the simulated tenant is
// copied into a run folder. Nothing here reads a real tenant, a credential or the network.

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, 'customers');
const DOMAIN_TOKEN = '[@Aegion_DOMAIN]';

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));

function loadData() {
  return { customers: readJson('customers.json').customers, tickets: readJson('tickets.json').tickets };
}

function fill(text, customer) {
  return String(text).split(DOMAIN_TOKEN).join(customer.tenant_vars.AEGION_DOMAIN);
}

// The raw item as the customer sends it: its bytes as stored, with the domain filled in.
function rawItem(ticket, customer) {
  return fill(fs.readFileSync(path.join(DATA_DIR, ticket.file), 'utf8'), customer);
}

// The tenant variables with the domain filled in (an admin subject holds an address).
function tenantVars(customer) {
  return Object.fromEntries(Object.entries(customer.tenant_vars).map(([k, v]) => [k, fill(v, customer)]));
}

function tenantText(customer) {
  return fill(fs.readFileSync(path.join(DATA_DIR, customer.tenant_file), 'utf8'), customer);
}

function loadTenant(customer) {
  return JSON.parse(tenantText(customer));
}

// The targets of a ticket for one connector, with the domain filled in, or null when it has none.
function targetsFor(ticket, connector, customer) {
  const t = ticket.targets[connector];
  return t ? Object.fromEntries(Object.entries(t).map(([k, v]) => [k, fill(v, customer)])) : null;
}

// ── The data rules (scripts/demo/customers.test.js holds every data file to them) ─────────────
const ALLOWED_DOMAIN = /(?:^|\.)example\.(?:com|net|org)$/i;
const ADDRESS_DOMAIN = /[A-Za-z0-9._%+-]+@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63})\b/g;
const URL_HOST = /\bhttps?:\/\/((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63})\b/g;
// A dotted host beside a word boundary, such as a tenant variable's value. Dotted names that are not
// hosts (a file name, the odata type) have no two-part ending the list below does not know.
const BARE_HOST = /\b((?:[a-z0-9-]+\.)+(?:com|net|org|io|co|ai|dev|app))\b/gi;

function foreignDomains(text) {
  const found = new Set();
  // a placeholder such as [USER@DOMAIN.COM] names no domain
  const masked = String(text).replace(/\[[^\]\n]{1,80}\]/g, ' ');
  for (const re of [ADDRESS_DOMAIN, URL_HOST, BARE_HOST]) {
    for (const m of masked.matchAll(re)) if (!ALLOWED_DOMAIN.test(m[1])) found.add(m[1].toLowerCase());
  }
  return [...found];
}

// Two capitalized words in a row read as a person's name unless they are a product, a role or a
// phrase these tickets use. shortcut: a word list, not a name detector; a new ticket that trips it
// adds its phrase here after a person has read it.
const NOT_A_NAME = new Set([
  'Front Desk', 'Desk Lead', 'Help Desk', 'IT Help', 'Studio Manager', 'Accounts Payable', 'IT Service', 'Service Desk',
  'Office Manager', 'IT Support', 'Full Access', 'Send As', 'Microsoft Authenticator', 'Google Workspace', 'Microsoft Defender',
  'Business Premium', 'Jamf Pro', 'Hybrid Active', 'Active Directory', 'High Confidence', 'Customer Desk',
  'Message ID', 'Content Type', 'Tue Nov', 'Pasting What', 'Fictional Read',
]);
const NAME_SHAPE = /\b([A-Z][a-z]+) ([A-Z][a-z]+)\b/g;

function personNames(text) {
  const found = [];
  for (const m of String(text).matchAll(NAME_SHAPE)) {
    const pair = `${m[1]} ${m[2]}`;
    if (!NOT_A_NAME.has(pair) && !found.includes(pair)) found.push(pair);
  }
  return found;
}

module.exports = { DATA_DIR, DOMAIN_TOKEN, loadData, fill, rawItem, tenantVars, tenantText, loadTenant, targetsFor, foreignDomains, personNames };
