'use strict';
// sim/gates.js: the SIMULATED OPERATOR. This is the only code in the demo that changes a tenant,
// and what it changes is the simulated tenant file inside one run folder. It stands in for the
// human administrator who, in production, carries out an approved step: AEGIS ADVISES; HUMANS
// EXECUTE. Nothing Aegis runs can reach it: the Aegis session has no Bash and no Write tool, and
// only scripts/demo/customer-desk.js imports this file.
//
// SIM_GATES maps a runbook's SAFETY GATE id to the state change that gate describes. A gate that is
// not here is "not simulated", and the ticket stops OPEN. An entry's platform is the connector whose
// system holds the state, or, for Exchange and Defender, which no connector reads, the Microsoft
// connector name that says the customer is on Microsoft 365. target holds the ticket's fictional
// values for that platform, by the runbook's placeholder.

const fs = require('node:fs');
const path = require('node:path');

const { writeReplacing } = require('../customers.js');

const AUTHENTICATOR_LIKE = /(?:microsoftAuthenticator|phone|softwareOath)AuthenticationMethod$/;

const SIM_GATES = Object.freeze({
  // Microsoft 365
  'mfa-require-reregister-portal': {
    platform: 'msgraph', effect: 'removes the user\'s Authenticator, phone and software OATH methods, so they register again',
    apply: (s, t) => { const id = t['[USER_ID]']; s.msgraph.methods[id] = s.msgraph.methods[id].filter((m) => !AUTHENTICATOR_LIKE.test(m['@odata.type'])); },
  },
  'mfa-method-delete-portal': {
    platform: 'msgraph', effect: 'removes the one named authentication method',
    apply: (s, t) => { const id = t['[USER_ID]']; s.msgraph.methods[id] = s.msgraph.methods[id].filter((m) => m.id !== t['[METHOD_ID]']); },
  },
  'mfa-session-revoke-portal': {
    platform: 'msgraph', effect: 'revokes the user\'s sign-in sessions',
    apply: (s, t, now) => { s.msgraph.users[t['[USER_ID]']].signInSessionsValidFromDateTime = now; },
  },
  'security-session-revoke-portal': {
    platform: 'msgraph', effect: 'revokes the user\'s sign-in sessions',
    apply: (s, t, now) => { s.msgraph.users[t['[USER_ID]']].signInSessionsValidFromDateTime = now; },
  },
  'quarantine-release-one-portal': {
    platform: 'msgraph', effect: 'releases the quarantined message to its one recipient',
    apply: (s) => { for (const q of s.quarantine || []) q.released = true; },
  },
  'quarantine-release-all-portal': {
    platform: 'msgraph', effect: 'releases the quarantined message to all its recipients',
    apply: (s) => { for (const q of s.quarantine || []) q.released = true; },
  },
  // Okta
  'okta-user-lifecycle-deactivate-portal': {
    platform: 'okta', effect: 'deactivates the Okta user',
    apply: (s, t) => { s.okta.users[t['[OKTA_USER_ID]']].status = 'DEPROVISIONED'; },
  },
  'okta-user-lifecycle-suspend-portal': {
    platform: 'okta', effect: 'suspends the Okta user',
    apply: (s, t) => { s.okta.users[t['[OKTA_USER_ID]']].status = 'SUSPENDED'; },
  },
  'okta-user-lifecycle-clear-sessions-portal': {
    platform: 'okta', effect: 'clears the Okta user\'s sessions',
    apply: (s, t, now) => { s.okta.logs.push({ eventType: 'user.session.clear', published: now, target: [{ id: t['[OKTA_USER_ID]'] }], outcome: { result: 'SUCCESS' } }); },
  },
  'okta-user-lifecycle-unsuspend-portal': {
    platform: 'okta', effect: 'unsuspends the Okta user',
    apply: (s, t) => { s.okta.users[t['[OKTA_USER_ID]']].status = 'ACTIVE'; },
  },
  'okta-user-lifecycle-reset-password-portal': {
    platform: 'okta', effect: 'resets the Okta user\'s password',
    apply: (s, t, now) => { s.okta.logs.push({ eventType: 'user.account.reset_password', published: now, target: [{ id: t['[OKTA_USER_ID]'] }], outcome: { result: 'SUCCESS' } }); },
  },
  'okta-mfa-reset-all-portal': {
    platform: 'okta', effect: 'resets every factor of the Okta user',
    apply: (s, t) => { s.okta.factors[t['[OKTA_USER_ID]']] = []; },
  },
  'okta-mfa-reset-selected-portal': {
    platform: 'okta', effect: 'resets the user\'s Okta Verify push factor',
    apply: (s, t) => { const id = t['[OKTA_USER_ID]']; s.okta.factors[id] = s.okta.factors[id].filter((f) => f.factorType !== 'push'); },
  },
  // GitHub
  'github-offboard-member-remove-portal': {
    platform: 'github', effect: 'removes the member from the GitHub organization',
    apply: (s, t) => { delete s.github.members[t['[GITHUB_USER]']]; },
  },
  // Google Workspace
  'gws-account-containment-suspend-portal': {
    platform: 'google-workspace', effect: 'suspends the Google Workspace user',
    apply: (s, t) => { const u = s.gws.users[t['[USER@DOMAIN.COM]']]; u.suspended = true; u.suspensionReason = 'ADMIN'; },
  },
  'gws-offboard-suspend-portal': {
    platform: 'google-workspace', effect: 'suspends the Google Workspace user',
    apply: (s, t) => { const u = s.gws.users[t['[USER@DOMAIN.COM]']]; u.suspended = true; u.suspensionReason = 'ADMIN'; },
  },
  'gws-offboard-drive-transfer-portal': {
    platform: 'google-workspace', effect: 'transfers the user\'s Drive files to their manager',
    apply: (s, t) => { (s.gws.transfers = s.gws.transfers || []).push({ user: t['[USER@DOMAIN.COM]'], what: 'drive' }); },
  },
  'gws-offboard-calendar-transfer-portal': {
    platform: 'google-workspace', effect: 'transfers the user\'s calendars to their manager',
    apply: (s, t) => { (s.gws.transfers = s.gws.transfers || []).push({ user: t['[USER@DOMAIN.COM]'], what: 'calendar' }); },
  },
  'gws-offboard-okta-deactivate-portal': {
    platform: 'okta', effect: 'deactivates the Okta user that provisions the Google account',
    apply: (s, t) => { s.okta.users[t['[OKTA_USER_ID]']].status = 'DEPROVISIONED'; },
  },
  // Linear
  'linear-workspace-admin-suspend-portal': {
    platform: 'linear', effect: 'suspends the Linear member',
    apply: (s, t) => { for (const u of s.linear.users) if (u.id === t['[USER_ID]']) u.active = false; },
  },
  // Jamf Pro
  'jamf-lock-erase-lock-portal': {
    platform: 'jamf', effect: 'locks the Mac at its next check-in',
    apply: (s, t) => { for (const d of s.devices) if (d.serial === t['[SERIAL_NUMBER]']) d.lock_state = 'locked'; },
  },
  'jamf-lock-erase-wipe-portal': {
    platform: 'jamf', effect: 'wipes the Mac at its next check-in',
    apply: (s, t) => { for (const d of s.devices) if (d.serial === t['[SERIAL_NUMBER]']) d.wipe_state = 'wiped'; },
  },
});

// Why the desk may not simulate this gate for this customer and ticket, or null.
function notSimulated(gate, table, customer, targets) {
  const entry = table[gate];
  if (!entry) return `not simulated: the operator simulator's table has no entry for ${gate}`;
  if (!customer.connectors.includes(entry.platform)) return `not simulated: ${gate} acts on ${entry.platform}, and ${customer.label} does not run it`;
  if (!targets) return `not simulated: this ticket names no ${entry.platform} target for ${gate}`;
  return null;
}

// Applies a ticket's gates to the simulated tenant file, all or none: they change one copy in memory,
// and the file is written once, after the last. Refuses a file outside the run folder.
function applySimulatedGates({ changes, tenantFile, runDir, now = new Date().toISOString() }) {
  const rel = path.relative(path.resolve(runDir), path.resolve(tenantFile));
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('the SIMULATED OPERATOR refuses a tenant file outside the run folder');
  const state = JSON.parse(fs.readFileSync(tenantFile, 'utf8'));
  for (const { entry, target } of changes) {
    const before = JSON.stringify(state);
    entry.apply(state, target, now);
    if (JSON.stringify(state) === before) throw new Error(`"${entry.effect}" changes nothing in the simulated tenant, so a read-back would prove nothing`);
  }
  writeReplacing(tenantFile, `${JSON.stringify(state, null, 2)}\n`);
  return changes.map(({ entry }) => `SIMULATED OPERATOR: ${entry.effect}, in the simulated tenant only (${path.basename(path.dirname(tenantFile))}/tenant.json in this run's folder).`);
}

module.exports = { SIM_GATES, notSimulated, applySimulatedGates };
