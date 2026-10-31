'use strict';
// gate-r-class.test.js: every SAFETY GATE carries an R class (batch G3 close-out 3, owner
// decision H4).
//
// EXPECTED DECISION (written before the runbook change)
// - Every SAFETY GATE in every runbook, in either form (a marker block in the page or a comment
//   block in a fence), has a Reversibility line that carries one class from CLAUDE.md's
//   Risk-Classified Execution Policy, R0 to R3, before any mention of a separate gate.
// - The 58 gates that had none at the base (0a5feb7) carry it first and cite the table's row; a
//   gate that fits no row cleanly takes the higher class and says why (session revocation stays
//   R2, the owner's answer on PR #8 item 2).
// - The check fails when any one class is removed.
// Run: node --test scripts/gate-r-class.test.js

require('./adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const DIR = path.join(__dirname, '..', '.claude', 'commands');

// each gate of a runbook: its id and its Reversibility text (null when it has none)
function gatesOf(text) {
  const lines = text.split('\n');
  const found = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^<!-- SAFETY GATE \[([^\]]+)\] -->$|^# SAFETY GATE \[([^\]]+)\]$/);
    if (!m) continue;
    const portal = Boolean(m[1]);
    let rev = null;
    for (let j = i + 1; j < lines.length; j += 1) {
      const f = portal ? lines[j].match(/^- \*\*([A-Za-z ]+):\*\* (.*)$/) : lines[j].match(/^# ([A-Z][A-Za-z ]+): (.*)$/);
      if (!f) break;
      if (f[1] === 'Reversibility') rev = f[2];
    }
    found.push({ id: m[1] || m[2], rev });
  }
  return found;
}
const classOf = (rev) => (rev === null ? null : (rev.split(/\bseparate\b/)[0].match(/\bR[0-3]\b/g) || []).sort().pop() || null);
// the gates in dir whose Reversibility line names no class
function unclassed(dir) {
  return fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort()
    .flatMap((n) => gatesOf(fs.readFileSync(path.join(dir, n), 'utf8')).filter((g) => !classOf(g.rev)).map((g) => g.id));
}

// The class of each gate that had none at the base, from CLAUDE.md's table (owner decision H4)
const R1 = 'R1'; const R2 = 'R2'; const R3 = 'R3';
const CLASSED = Object.freeze({
  'conditional-access-enable-portal': R3, 'install-graph-conditional-access': R1,
  'device-full-wipe-portal': R3, 'device-full-wipe': R3,
  'distribution-external-senders-portal': R3,
  'quarantine-release-all-portal': R3, 'quarantine-release-one-portal': R2, 'quarantine-delete-portal': R3,
  'install-exchange-quarantine': R1, 'quarantine-release-all': R3, 'quarantine-release-one': R2, 'quarantine-permanent-delete': R3,
  'restricted-entity-unblock-portal': R3, 'install-exchange-spam': R1, 'restricted-entity-unblock': R3,
  'install-exchange-whitelist': R1,
  'license-remove-portal': R3,
  'mailbox-permission-remove-portal': R1, 'mailbox-permission-remove': R1,
  'offboard-ad-disable-portal': R3, 'offboard-cloud-block-portal': R3, 'offboard-revoke-sessions-portal': R2,
  'offboard-password-reset-portal': R2, 'offboard-clear-mfa-portal': R3, 'offboard-mailbox-convert-portal': R1,
  'offboard-mailbox-delegate-portal': R1, 'offboard-onedrive-portal': R1, 'offboard-license-remove-portal': R3,
  'offboard-group-strip-portal': R3, 'offboard-dl-strip-portal': R3, 'offboard-mailbox-delegation-strip-portal': R3,
  'offboard-device-wipe-portal': R3, 'offboard-work-phone-wipe-portal': R3, 'offboard-work-phone-group-remove-portal': R1,
  'offboard-voip-deactivate-portal': R3, 'offboard-voip-reclaim-extension-portal': R2, 'offboard-voicemail-clear-portal': R3,
  'offboard-zoom-portal': R3, 'offboard-adobe-portal': R3, 'offboard-vpn-portal': R3, 'offboard-physical-portal': R3,
  'offboard-disabled-ou-portal': R3,
  'password-reset-synced-portal': R2, 'password-reset-cloud-portal': R2, 'password-session-revoke-portal': R2,
  'password-cloud-reset': R2, 'password-session-revoke': R2,
  'print-queue-delete-portal': R3, 'print-queue-delete': R3,
  'security-session-revoke-portal': R2, 'security-account-block': R3, 'security-synced-ad-disable': R3,
  'security-synced-cloud-gap-block': R3, 'security-session-revoke': R2,
  'shared-mailbox-convert-portal': R1,
  'sharepoint-access-revoke-portal': R1, 'sharepoint-access-revoke': R1,
  'install-teams-module': R1,
});

test('every SAFETY GATE in every runbook carries an R class on its Reversibility line', () => {
  const all = fs.readdirSync(DIR).filter((n) => n.endsWith('.md')).flatMap((n) => gatesOf(fs.readFileSync(path.join(DIR, n), 'utf8')));
  assert.equal(all.length, 343, 'the SAFETY GATE count is unchanged');
  assert.deepEqual(unclassed(DIR), [], 'gates with no R class');
});

test('the check fails when one class is removed', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-r-class-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  for (const n of fs.readdirSync(DIR).filter((x) => x.endsWith('.md'))) fs.copyFileSync(path.join(DIR, n), path.join(tmp, n));
  const file = path.join(tmp, 'device-wipe.md');
  const text = fs.readFileSync(file, 'utf8');
  const stripped = text.replace(/^(- \*\*Reversibility:\*\* )R3 \(CLAUDE\.md[^\n]*?\): (irreversible; data requires a separate backup)$/m, '$1$2');
  assert.notEqual(stripped, text, 'the class of device-full-wipe-portal was removed');
  fs.writeFileSync(file, stripped);
  assert.deepEqual(unclassed(tmp), ['device-full-wipe-portal']);
});

test('the 58 gates classed in this batch carry their class first and cite the row of CLAUDE.md\'s table', () => {
  assert.equal(Object.keys(CLASSED).length, 58);
  const all = new Map(fs.readdirSync(DIR).filter((n) => n.endsWith('.md')).flatMap((n) => gatesOf(fs.readFileSync(path.join(DIR, n), 'utf8')).map((g) => [g.id, g.rev])));
  for (const [id, want] of Object.entries(CLASSED)) {
    const rev = all.get(id);
    assert.ok(rev, `${id}: a Reversibility line`);
    assert.ok(rev.startsWith(`${want} (CLAUDE.md, Risk-Classified Execution Policy`), `${id}: ${want} first, citing the table: ${rev.slice(0, 90)}`);
    assert.deepEqual([...new Set(rev.split(/\bseparate\b/)[0].match(/\bR[0-3]\b/g))], [want], `${id}: one class`);
    if (want === 'R2' && /session|token/i.test(rev)) assert.match(rev, /fits no row cleanly[^)]*the higher of the two/, `${id}: says why`);
  }
});
