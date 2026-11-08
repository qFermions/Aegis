'use strict';
// sim/gates.js: the SIMULATED OPERATOR. This is the only code in the demo that changes a tenant,
// and what it changes is the simulated tenant file inside one run folder. It stands in for the
// human administrator who, in production, carries out an approved step: AEGIS ADVISES; HUMANS
// EXECUTE. Nothing Aegis runs can reach it: the Aegis session has no Bash and no Write tool, and
// only scripts/demo/customer-desk.js imports this file.
//
// SIM_GATES maps a runbook's SAFETY GATE id to the state change that gate describes. A gate that is
// not here is "not simulated", and the ticket stops OPEN. An entry's platform is the connector whose
// system holds the state: since batch 9 Exchange mailboxes and quarantine are exo (exo-client.js). target holds the ticket's fictional
// values for that platform, by the runbook's placeholder.

const fs = require('node:fs');
const path = require('node:path');

const { writeReplacing, loadData, fill } = require('../customers.js');

const AUTHENTICATOR_LIKE = /(?:microsoftAuthenticator|phone|softwareOath)AuthenticationMethod$/;

// A mailbox in the simulated tenant, by the runbook's [MAILBOX] placeholder, and one delegate added to one list.
const boxOf = (s, t) => s.mailboxes.find((m) => m.address.toLowerCase() === String(t['[MAILBOX]']).toLowerCase());
const grant = (s, t, list) => { const b = boxOf(s, t); b[list] = [...new Set([...(b[list] || []), t['[UPN]']])]; };

// A data transfer the Admin console starts (batch 10, task 4), shaped as the Data Transfer API's DataTransfer
// (vendor facts W-10, W-12): the source user's Google user ID, the new owner's, and one completed entry for
// the application. A ticket names no manager, so the transfer's ID and the new owner come from the gate's
// values (the desk fills the runbook's [TRANSFER_ID] and [MANAGER_UPN] with them). The new owner is Customer
// D's second Google account (customers/d/tenant.json), the one simulated tenant with two Google accounts; on a
// tenant without that account the gate cannot be acted out, and the ticket stops OPEN.
const simNewOwner = () => fill('reporting.user@[@Aegion_DOMAIN]', loadData().customers.find((c) => c.id === 'D'));
const transferGate = (what, transferId, applicationId) => Object.freeze({
  platform: 'google-workspace', effect: `transfers the user's ${what} to their manager`,
  values: () => ({ '[TRANSFER_ID]': transferId, '[MANAGER_UPN]': simNewOwner() }),
  apply: (s, t, now) => {
    const source = s.gws.users[t['[USER@DOMAIN.COM]']];
    const owner = s.gws.users[simNewOwner()];
    if (!source || !owner) throw new Error('the simulated tenant holds no Google account for the source user or the new owner');
    (s.gws.transfers = s.gws.transfers || []).push({
      kind: 'admin#datatransfer#DataTransfer', id: transferId, oldOwnerUserId: source.id, newOwnerUserId: owner.id,
      applicationDataTransfers: [{ applicationId, applicationTransferStatus: 'completed' }], overallTransferStatusCode: 'completed', requestTime: now,
    });
  },
});

// One session clear, two gates: /okta-user-lifecycle Phase C and the Okta Verify loop's admin step in
// /okta-mfa-reset (batch 9b; code review 1, finding 12: one entry, so the two cannot drift apart).
const CLEAR_OKTA_SESSIONS = Object.freeze({
  platform: 'okta', effect: 'clears the Okta user\'s sessions',
  apply: (s, t, now) => { s.okta.logs.push({ eventType: 'user.session.clear', published: now, target: [{ id: t['[OKTA_USER_ID]'] }], outcome: { result: 'SUCCESS' } }); },
});

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
  // Exchange Online (batch 9, tasks 5 and 6): platform exo, read back by exo-client.js
  'quarantine-release-one-portal': {
    platform: 'exo', effect: 'releases the quarantined message to its one recipient',
    apply: (s, t) => { for (const q of (s.quarantine || []).filter((x) => x.message_id === t['[MESSAGE_ID]'] && x.recipient === t['[USER@DOMAIN.COM]'])) { q.released = true; q.released_users = [...new Set([...(q.released_users || []), q.recipient])]; } },
  },
  'quarantine-release-all-portal': {
    platform: 'exo', effect: 'releases the quarantined message to all its recipients',
    apply: (s, t) => { for (const q of (s.quarantine || []).filter((x) => x.identity === t['[MESSAGE_IDENTITY_GUID]'])) { q.released = true; q.released_users = [q.recipient]; } },
  },
  'shared-mailbox-full-access-portal': { platform: 'exo', effect: 'grants the delegate Full Access to the shared mailbox', apply: (s, t) => grant(s, t, 'full_access') },
  'mailbox-full-access-grant-portal': { platform: 'exo', effect: 'grants the delegate Full Access to the mailbox', apply: (s, t) => grant(s, t, 'full_access') },
  'shared-mailbox-send-as-portal': { platform: 'exo', effect: 'grants the delegate Send As on the shared mailbox', apply: (s, t) => grant(s, t, 'send_as') },
  'mailbox-send-as-grant-portal': { platform: 'exo', effect: 'grants the delegate Send As on the mailbox', apply: (s, t) => grant(s, t, 'send_as') },
  'mailbox-send-as-remove-portal': { platform: 'exo', effect: 'removes Send As from the delegate', apply: (s, t) => { const b = boxOf(s, t); b.send_as = (b.send_as || []).filter((u) => u.toLowerCase() !== t['[UPN]'].toLowerCase()); } },
  // Slack (batch 9, task 9: T2m's "whatever else" adds Slack)
  'slack-user-lifecycle-deactivate-portal': {
    platform: 'slack', effect: 'deactivates the Slack member',
    apply: (s, t) => { s.slack.users[t['[USER_ID]']].deleted = true; },
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
  'okta-user-lifecycle-clear-sessions-portal': CLEAR_OKTA_SESSIONS,
  // batch 9b: the Okta Verify loop's admin step in okta-mfa-reset, the same change as Phase C above
  'okta-mfa-reset-clear-sessions-portal': CLEAR_OKTA_SESSIONS,
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
  'gws-password-reset-password-portal': {
    platform: 'google-workspace', effect: 'resets the Google Workspace password to a temporary one the user must change',
    // batch 9, task 7: the Admin console records the change as a CHANGE_PASSWORD admin event, actor the admin
    // ([UPN]) and target the account, which the runbook's verify-event read finds
    apply: (s, t, now) => {
      const u = s.gws.users[t['[USER@DOMAIN.COM]']]; u.changePasswordAtNextLogin = true; u.passwordResetAt = now;
      (s.gws.activities = s.gws.activities || []).push({ app: 'admin', name: 'CHANGE_PASSWORD', time: now, actor: t['[UPN]'], target: t['[USER@DOMAIN.COM]'] });
    },
  },
  'gws-password-reset-cookies-portal': {
    platform: 'google-workspace', effect: 'resets the user\'s Google sign-in cookies, so every device signs in again',
    // batch 10, task 3: the Admin console records the reset as a RESET_SIGNIN_COOKIES admin event (vendor fact
    // W-07), actor the admin ([UPN]) and target the account, which the runbook's verify-event read finds
    apply: (s, t, now) => {
      s.gws.users[t['[USER@DOMAIN.COM]']].signInCookiesResetAt = now;
      (s.gws.activities = s.gws.activities || []).push({ app: 'admin', name: 'RESET_SIGNIN_COOKIES', time: now, actor: t['[UPN]'], target: t['[USER@DOMAIN.COM]'] });
    },
  },
  'gws-offboard-suspend-portal': {
    platform: 'google-workspace', effect: 'suspends the Google Workspace user',
    apply: (s, t) => { const u = s.gws.users[t['[USER@DOMAIN.COM]']]; u.suspended = true; u.suspensionReason = 'ADMIN'; },
  },
  // batch 10, task 4: read back by gws-client.js verify-transfer, Drive and Docs (55656082996) and Calendar (435070579839)
  'gws-offboard-drive-transfer-portal': transferGate('Drive files', 'simDriveTransfer01', '55656082996'),
  'gws-offboard-calendar-transfer-portal': transferGate('calendars', 'simCalendarTransfer01', '435070579839'),
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
    // batch 10, task 3: the lock gate binds verify-command --type DEVICE_LOCK. The simulated Mac checks in
    // at once, as the runbook's WAIT UNTIL asks before the read-back, so the lock reads Acknowledged; the
    // wipe below stays Pending, so the desk still shows a read that proves nothing yet
    apply: (s, t, now) => { for (const d of s.devices) if (d.serial === t['[SERIAL_NUMBER]']) { d.lock_state = 'locked'; (d.mdm_commands = d.mdm_commands || []).push({ command: 'DEVICE_LOCK', status: 'Acknowledged', dateSent: now, dateCompleted: now }); } },
  },
  'jamf-lock-erase-wipe-portal': {
    platform: 'jamf', effect: 'wipes the Mac at its next check-in',
    // batch 9, task 7: the erase is sent now and runs at the Mac's next check-in, so its ERASE_DEVICE command
    // stays Pending and the runbook's verify-command read proves nothing yet (exit 5). Batch 9 simulated the lock
    // the same way; since batch 10 the simulated lock is acknowledged at once (above), so a ticket that only
    // locks can resolve at the desk, and this wipe is the desk's case of a sent command not yet proved
    // (customer-desk.test.js, "the simulated Jamf wipe leaves a pending erase command")
    apply: (s, t, now) => { for (const d of s.devices) if (d.serial === t['[SERIAL_NUMBER]']) { d.wipe_state = 'wipe sent'; (d.mdm_commands = d.mdm_commands || []).push({ command: 'ERASE_DEVICE', status: 'Pending', dateSent: now }); } },
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

// Applies gates to the simulated tenant file, all or none: they change one copy in memory, and the file
// is written once, after the last. The desk calls it once per gate (batch 8, task 5) and passes origin,
// the tenant as the ticket started, so "changes nothing" is still judged against that state too.
// Refuses a file outside the run folder.
// dryRun: apply to the copy in memory only and write nothing, so the desk can learn that every gate
// applies before it applies the first.
function applySimulatedGates({ changes, tenantFile, runDir, now = new Date().toISOString(), origin = null, dryRun = false }) {
  const rel = path.relative(path.resolve(runDir), path.resolve(tenantFile));
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('the SIMULATED OPERATOR refuses a tenant file outside the run folder');
  const state = JSON.parse(fs.readFileSync(tenantFile, 'utf8'));
  const start = origin === null ? JSON.stringify(state) : JSON.stringify(JSON.parse(origin));
  for (const { entry, target } of changes) {
    // changing nothing means against the state the ticket started from and against the state the gate
    // before it left: two gates may overlap, and an unsuspend undoes the suspend before it
    const alone = JSON.parse(start);
    entry.apply(alone, target, now);
    const previous = JSON.stringify(state);
    entry.apply(state, target, now);
    if (JSON.stringify(alone) === start && JSON.stringify(state) === previous) throw new Error(`"${entry.effect}" changes nothing in the simulated tenant, so a read-back would prove nothing`);
  }
  if (!dryRun) writeReplacing(tenantFile, `${JSON.stringify(state, null, 2)}\n`);
  return changes.map(({ entry }) => `SIMULATED OPERATOR: ${entry.effect}, in the simulated tenant only (${path.basename(path.dirname(tenantFile))}/tenant.json in this run's folder).`);
}

module.exports = { SIM_GATES, notSimulated, applySimulatedGates };
