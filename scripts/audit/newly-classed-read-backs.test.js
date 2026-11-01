'use strict';
// newly-classed-read-backs.test.js: the read-back of each of the 31 R2 and R3 gates that had none
// after the batch G3 close-out 3 (batch G4, task D3).
//
// EXPECTED DECISION (written before the runbook change)
// - The owner's words: "For the 31 R2 and R3 gates without a read-back, add a verify-* where a
//   connector already has a GET that proves the change (for example an Active Directory group strip
//   proved by Microsoft Graph verify-group-member --absent after sync); every other gate keeps
//   Read-back: none (<reason>)." The 31 and their reasons: docs/review/batches/g3-closeout-3-checks.md,
//   the H4 table. No connector command is added.
// - Each gate was checked against the nine connectors' verify-* commands (scripts/adapters/*-client.js,
//   scripts/jira-client.js, their routes) and docs/aegis/g3/vendor-facts.md. None has a verify-* whose
//   pass proves the gate's change, so none binds a read-back and the bound and unbound pin stays at 89
//   and 76. Where a GET exists that a reader could take for a proof, the reason now says why it is not:
//   - offboard-ad-disable-portal and security-synced-ad-disable: Graph verify-account-enabled
//     --enabled false also passes after the separate cloud sign-in block the same runbook runs, so it
//     cannot tell the on-premises disable apart.
//   - offboard-group-strip-portal and offboard-dl-strip-portal: Graph verify-group-member --absent
//     reads one Entra group per run, only after a sync, never a group outside the sync scope, and not
//     by the Active Directory IDs the frozen set holds; one pass would not prove the set, and making
//     the gate a counted change would leave it partial whenever one group is not synced. Not bound.
//   - the four Intune wipes: verify-device-synced reads a sync time, not a wipe, and Fleet
//     verify-wipe reads a Fleet host, not the Intune device the gate wipes.
//   - the two license removals: the Graph user read selects no license field.
//   - offboard-disabled-ou-portal: the Graph user read selects no on-premises location.
//   The other 20 keep the H4 table's reason, which already names the missing connector.
// Run: node --test scripts/audit/newly-classed-read-backs.test.js

require('../adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const changes = require('./change-record.js');

const DIR = path.join(__dirname, '..', '..', '.claude', 'commands');

const INTUNE_WIPE = 'Intune wipe: no verify-* command reads a wipe, verify-device-synced reads a sync time and Fleet verify-wipe reads a Fleet host, not the Intune device this gate wipes';
const NO_LICENSE = 'the Graph connector has no license read: its user read selects no license field';
const AD_SET = (what) => `on-premises AD ${what}: Graph verify-group-member --absent reads one Entra group per run, only after a sync, never one outside the sync scope and not by the AD IDs the frozen set holds, so one pass would not prove the set: left unbound in batch G4 D3`;
const QUARANTINE = 'Defender quarantine: no connector reads it';
const OUTCOMES = Object.freeze({
  'conditional-access-enable-portal': 'the Graph connector reads no Conditional Access policy',
  'device-full-wipe-portal': INTUNE_WIPE,
  'device-full-wipe': INTUNE_WIPE,
  'offboard-device-wipe-portal': INTUNE_WIPE,
  'offboard-work-phone-wipe-portal': INTUNE_WIPE,
  'distribution-external-senders-portal': 'Exchange settings and permissions: no Exchange connector',
  'offboard-mailbox-delegation-strip-portal': 'Exchange settings and permissions: no Exchange connector',
  'quarantine-release-all-portal': QUARANTINE,
  'quarantine-release-all': QUARANTINE,
  'quarantine-delete-portal': QUARANTINE,
  'quarantine-permanent-delete': QUARANTINE,
  'quarantine-release-one-portal': QUARANTINE,
  'quarantine-release-one': QUARANTINE,
  'restricted-entity-unblock-portal': 'Defender restricted entities: no connector reads them',
  'restricted-entity-unblock': 'Defender restricted entities: no connector reads them',
  'license-remove-portal': NO_LICENSE,
  'offboard-license-remove-portal': NO_LICENSE,
  'offboard-ad-disable-portal': 'on-premises Active Directory: no connector reads it, and Graph verify-account-enabled --enabled false also passes after the separate cloud sign-in block, so it cannot prove this change',
  'offboard-disabled-ou-portal': 'on-premises Active Directory: no connector reads it, and the Graph user read selects no on-premises location',
  'security-synced-ad-disable': 'on-premises Active Directory: no connector reads it, and Graph verify-account-enabled --enabled false also passes after the separate cloud-gap block, so it cannot prove this change',
  'offboard-group-strip-portal': AD_SET('groups'),
  'offboard-dl-strip-portal': AD_SET('distribution lists'),
  'offboard-voip-deactivate-portal': 'the VoIP platform: no connector',
  'offboard-voicemail-clear-portal': 'the VoIP platform: no connector',
  'offboard-voip-reclaim-extension-portal': 'the VoIP platform: no connector',
  'offboard-zoom-portal': 'Zoom: no connector',
  'offboard-adobe-portal': 'Adobe: no connector',
  'offboard-vpn-portal': 'the VPN: no connector',
  'offboard-physical-portal': 'the alarm and badge systems: no connector',
  'print-queue-delete-portal': 'a local spool folder on one workstation: no connector, its own read is the proof',
  'print-queue-delete': 'a local spool folder on one workstation: no connector, its own read is the proof',
});

const all = new Map();
for (const name of fs.readdirSync(DIR).filter((n) => n.endsWith('.md'))) {
  for (const g of changes.gateFields(fs.readFileSync(path.join(DIR, name), 'utf8'))) all.set(g.id, { ...g, file: name });
}

test('D3: the 31 gates are the H4 table\'s, each R2 or R3', () => {
  assert.equal(Object.keys(OUTCOMES).length, 31);
  for (const id of Object.keys(OUTCOMES)) {
    const g = all.get(id);
    assert.ok(g, `${id} is a runbook gate`);
    assert.ok(g.rClass === 'R2' || g.rClass === 'R3', `${id}: ${g.rClass}`);
  }
});

for (const [id, reason] of Object.entries(OUTCOMES)) {
  test(`D3: ${id} keeps Read-back none, with the reason the review found`, () => {
    const g = all.get(id);
    assert.ok(g && g.readBack, `${id}: a Read-back field`);
    assert.deepEqual(g.readBack.commands, [], `${id}: binds no read-back`);
    assert.equal(g.readBack.none, reason, `${id} (${g.file})`);
  });
}
