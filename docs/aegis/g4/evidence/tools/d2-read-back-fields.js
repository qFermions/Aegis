#!/usr/bin/env node
'use strict';
// d2-read-back-fields.js [--write] [--map FILE]: batch G4, task D2. Adds one Read-back field line
// to every SAFETY GATE in .claude/commands, after the gate's last field line (Failure behavior, or
// Reversibility on the PowerShell gates that end there), and changes nothing else.
// - A gate that binds read-backs at the base names each one as its runbook line runs it, from the
//   client file to `--execute` (`okta-client.js verify-... --change [CHANGE_ID] --execute`): the line
//   without its `node scripts/` path, so no check that reads the lines a runbook runs reads a field
//   as one. The binding is read the way change-record.js read it before D2
//   (the gates a "read-back of [gate]" comment names, else the gate whose section the line sits
//   in), copied here so this tool still reproduces the base's binding after change-record.js reads
//   the field instead.
// - Every other gate gets none with a reason: an R1 gate "R1: no change record"; an R2 or R3 gate
//   the reason in REASONS below, written by hand (the 31 newly classed gates: the reasons of
//   docs/review/batches/g3-closeout-3-checks.md, the H4 table).
// Portal form: `- **Read-back:** \`cmd\`; \`cmd\`` or `- **Read-back:** none (reason)`.
// Fenced form: `# Read-back: cmd` or `# Read-back: none, reason`, with no backtick, parenthesis or
// semicolon, since a comment in a gated bash fence may hold none (command-safety-gates.test.js).
// Without --write it only checks and prints the counts. --map FILE writes the base's binding,
// gate to commands, as JSON. Run from the repository root.
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(process.cwd(), '.claude', 'commands');
const args = process.argv.slice(2);
const write = args.includes('--write');
const mapFile = args.includes('--map') ? args[args.indexOf('--map') + 1] : null;

const MARK = /^<!-- SAFETY GATE \[([^\]]+)\] -->$|^# SAFETY GATE \[([^\]]+)\]$/;
const PORTAL_FIELD = /^- \*\*([A-Za-z -]+):\*\* (.*)$/;
const FENCED_FIELD = /^# ([A-Z][A-Za-z -]+): (.*)$/;
const RUNBOOK_LINE = /node scripts\/(?:adapters\/)?([a-z]+)-client\.js (verify-[a-z0-9-]+)([^`\n]*)/;
const NAMED_FOR = /^# [^\n]*\bread-back of (\[[a-z0-9-]+\](?:(?:,? or |,? and |, )\[[a-z0-9-]+\])*)/;
const namedGates = (comment) => {
  const m = String(comment || '').match(NAMED_FOR);
  return m ? [...m[1].matchAll(/\[([a-z0-9-]+)\]/g)].map((x) => x[1]) : null;
};
// the command a runbook line runs, from its client file to `--execute`
function commandOf(line) {
  const rest = line.slice(line.match(RUNBOOK_LINE).index).replace(/^node scripts\/(?:adapters\/)?/, '');
  const end = rest.indexOf(' --execute');
  if (end < 0) throw new Error(`no --execute: ${line}`);
  return rest.slice(0, end + ' --execute'.length);
}
// the base's binding: every line run with --change, with the gates it proves
function baseBinding(lines) {
  const found = [];
  let current = null;
  lines.forEach((l, i) => {
    if (/^## /.test(l)) current = null;
    const g = l.match(/<!-- SAFETY GATE \[([^\]]+)\] -->|^# SAFETY GATE \[([^\]]+)\]/);
    if (g) current = g[1] || g[2];
    if (!RUNBOOK_LINE.test(l) || !/--change \[CHANGE_ID\]/.test(l)) return;
    found.push({ line: i + 1, gates: namedGates(lines[i - 1]) || (current ? [current] : []), command: commandOf(l) });
  });
  return found;
}
const classOf = (rev) => (rev === null ? null : (rev.split(/\bseparate\b/)[0].match(/\bR[0-3]\b/g) || []).sort().pop() || null);

const NO_EXCHANGE = 'Exchange settings and permissions: no Exchange connector';
const QUARANTINE = 'Defender quarantine: no connector reads it';
const RESTRICTED = 'Defender restricted entities: no connector reads them';
const INTUNE_WIPE = 'Intune wipe: the Graph connector reads a managed device but has no wipe read-back';
const NO_LICENSE = 'the Graph connector has no license read';
const ON_PREM_AD = 'on-premises Active Directory: no connector reads it';
const AD_SETS = 'on-premises AD groups and distribution lists: Graph verify-group-member --absent sees only those synced to Entra, after a sync, so it is not written as their proof';
const VOIP = 'the VoIP platform: no connector';
const SPOOL = 'a local spool folder on one workstation: no connector, its own read is the proof';
const NOT_NAMED = 'no read-back is named for it in this runbook: its proof is the read its own step names';
const RULESET = 'no verify-* command reads a ruleset, verify-protection reads the classic rule: its proof is the rulesets read its step names';
const LOOSEN = 'verify-protection passes only while protection is on, so it cannot prove a loosening: its proof is the read its step names';
const ORG_ROLE = 'no verify-* command reads an organization role: its proof is the read its step names';
const OU_SETTING = 'an organizational unit setting no verify-* command reads: its proof is the read its step names';
const SHARING = 'an organization sharing setting no verify-* command reads: its proof is the read its step names';
const CHROMEOS = 'no verify-* command reads a ChromeOS device: its proof is the device read its step names';
const TRANSFER = 'no verify-* command reads Drive ownership or a data transfer: its proof is the read its step names';
const DNS = 'DNS records at the domain host: no connector reads DNS';
const GWS_GROUP = 'no Google Workspace verify-* command reads group membership, group-members is a read: its proof is that read';
const GWS_LICENCE = 'no verify-* command reads a Google Workspace licence: its proof is the read its step names';
const GWS_DELETE = 'no verify-* command proves a deleted account: its proof is the read its step names';
const TWO_SV_OFF = 'no verify-* command reads 2-Step Verification enrollment, the 2SV read-backs read enforcement: its proof is the read its step names';
const EXPORT = 'an export to the administrator computer leaves no state a read-back reads';
const SLACK_SETTING = 'a workspace setting no Slack verify-* command reads: its proof is the read its step names';
const SLACK_CONNECT = 'no Slack verify-* command reads a Slack Connect organization or invitation: its proof is the read its step names';
const OKTA_DELETE = 'no Okta verify-* command proves a deleted user, verify-status reads a live one: its proof is the read its step names';

const REASONS = Object.freeze({
  // the 31 newly classed gates (g3-closeout-3-checks.md, H4)
  'conditional-access-enable-portal': 'the Graph connector reads no Conditional Access policy',
  'device-full-wipe-portal': INTUNE_WIPE,
  'device-full-wipe': INTUNE_WIPE,
  'offboard-device-wipe-portal': INTUNE_WIPE,
  'offboard-work-phone-wipe-portal': INTUNE_WIPE,
  'distribution-external-senders-portal': NO_EXCHANGE,
  'offboard-mailbox-delegation-strip-portal': NO_EXCHANGE,
  'quarantine-release-all-portal': QUARANTINE,
  'quarantine-release-all': QUARANTINE,
  'quarantine-delete-portal': QUARANTINE,
  'quarantine-permanent-delete': QUARANTINE,
  'quarantine-release-one-portal': QUARANTINE,
  'quarantine-release-one': QUARANTINE,
  'restricted-entity-unblock-portal': RESTRICTED,
  'restricted-entity-unblock': RESTRICTED,
  'license-remove-portal': NO_LICENSE,
  'offboard-license-remove-portal': NO_LICENSE,
  'offboard-ad-disable-portal': ON_PREM_AD,
  'offboard-disabled-ou-portal': ON_PREM_AD,
  'security-synced-ad-disable': ON_PREM_AD,
  'offboard-group-strip-portal': AD_SETS,
  'offboard-dl-strip-portal': AD_SETS,
  'offboard-voip-deactivate-portal': VOIP,
  'offboard-voicemail-clear-portal': VOIP,
  'offboard-voip-reclaim-extension-portal': VOIP,
  'offboard-zoom-portal': 'Zoom: no connector',
  'offboard-adobe-portal': 'Adobe: no connector',
  'offboard-vpn-portal': 'the VPN: no connector',
  'offboard-physical-portal': 'the alarm and badge systems: no connector',
  'print-queue-delete-portal': SPOOL,
  'print-queue-delete': SPOOL,
  // the other R2 and R3 gates with no read-back at the base
  'fleet-osquery-investigation-export-portal': EXPORT,
  'fleet-vulnerable-software-install-automation-portal': 'no Fleet verify-* command reads a policy automation: its proof is the read its step names',
  'github-branch-protection-create-ruleset-portal': RULESET,
  'github-branch-protection-activate-ruleset-portal': RULESET,
  'github-branch-protection-remove-bypass-portal': RULESET,
  'github-branch-protection-add-bypass-portal': RULESET,
  'github-branch-protection-disable-ruleset-portal': RULESET,
  'github-branch-protection-allow-force-push-portal': LOOSEN,
  'github-branch-protection-allow-deletion-portal': LOOSEN,
  'github-branch-protection-lower-reviews-portal': LOOSEN,
  'github-branch-protection-admin-bypass-portal': LOOSEN,
  'github-branch-protection-delete-rule-portal': LOOSEN,
  'github-org-security-owner-demote-portal': ORG_ROLE,
  'github-org-security-owner-grant-portal': ORG_ROLE,
  'github-repo-access-team-remove-portal': 'no verify-* command reads the access of a team to a repository, verify-team-member reads team membership: its proof is the read its step names',
  'gws-2sv-enforcement-allow-portal': OU_SETTING,
  'gws-2sv-enforcement-allow-rollback-portal': OU_SETTING,
  'gws-2sv-enforcement-exception-portal': 'a group setting no verify-* command reads, the 2SV read-backs read one user: Phase C2 proves each member with verify-2sv-not-enforced',
  'gws-2sv-reset-key-remove-portal': 'no verify-* command reads security keys or passkeys: its proof is the read its step names',
  'gws-2sv-reset-turn-off-portal': TWO_SV_OFF,
  'gws-2sv-reset-turn-off': TWO_SV_OFF,
  'gws-admin-roles-recovery-allow-portal': OU_SETTING,
  'gws-admin-roles-recovery-off-portal': OU_SETTING,
  'gws-chromeos-device-clear-profiles-portal': CHROMEOS,
  'gws-chromeos-device-powerwash-portal': CHROMEOS,
  'gws-chromeos-device-deprovision-portal': CHROMEOS,
  'gws-chromeos-device-wipe-users': CHROMEOS,
  'gws-chromeos-device-powerwash': CHROMEOS,
  'gws-chromeos-device-deprovision': CHROMEOS,
  'gws-drive-sharing-allowlist-add-portal': SHARING,
  'gws-drive-sharing-allowlist-remove-portal': SHARING,
  'gws-drive-sharing-restrict-portal': SHARING,
  'gws-drive-sharing-turn-off-portal': SHARING,
  'gws-drive-sharing-allow-portal': SHARING,
  'gws-drive-transfer-drive-portal': TRANSFER,
  'gws-drive-transfer-calendar-portal': TRANSFER,
  'gws-drive-transfer-drive': TRANSFER,
  'gws-drive-transfer-datatransfer': TRANSFER,
  'gws-drive-transfer-calendar': TRANSFER,
  'gws-gmail-delivery-mx-change-portal': DNS,
  'gws-gmail-delivery-spf-change-portal': DNS,
  'gws-group-membership-remove-portal': GWS_GROUP,
  'gws-group-membership-remove': GWS_GROUP,
  'gws-license-assign-remove-portal': GWS_LICENCE,
  'gws-license-assign-remove': GWS_LICENCE,
  'gws-offboard-okta-deactivate-portal': NOT_NAMED,
  'gws-offboard-okta-deactivate': NOT_NAMED,
  'gws-offboard-drive-transfer-portal': TRANSFER,
  'gws-offboard-calendar-transfer-portal': TRANSFER,
  'gws-offboard-data-transfer': TRANSFER,
  'gws-offboard-delete-portal': GWS_DELETE,
  'gws-offboard-delete': GWS_DELETE,
  'gws-ou-move-user-portal': NOT_NAMED,
  'gws-ou-move-user': NOT_NAMED,
  'gws-security-posture-forwarding-off-portal': OU_SETTING,
  'gws-security-posture-forwarding-allow-portal': OU_SETTING,
  'gws-security-posture-app-block-portal': 'an app access setting no verify-* command reads: its proof is the read its step names',
  'jamf-filevault-widen-profile-portal': NOT_NAMED,
  'jamf-filevault-one-mac-scope-portal': NOT_NAMED,
  'jamf-filevault-show-key-portal': 'a key shown on screen leaves no state a read-back reads',
  'jamf-inventory-groups-static-members-portal': 'each Mac is read with the computer read, not a verify-* command',
  'jamf-inventory-groups-delete-portal': 'no Jamf verify-* command proves a deleted group: its proof is the read its step names',
  'jamf-lock-erase-lock-portal': NOT_NAMED,
  'jamf-lock-erase-wipe-portal': NOT_NAMED,
  'jamf-lock-erase-unmanage': NOT_NAMED,
  'jamf-lock-erase-remove-mdm-portal': NOT_NAMED,
  'jamf-lock-erase-lock-api': NOT_NAMED,
  'jamf-lock-erase-wipe-api': NOT_NAMED,
  'jamf-patch-management-pilot-policy-portal': 'no Jamf verify-* command reads a patch policy, verify-policy reads a policy: its proof is the read its step names',
  'jamf-patch-management-widen-policy-portal': 'no Jamf verify-* command reads a patch policy, verify-policy reads a policy: its proof is the read its step names',
  'jamf-patch-management-pilot-plan-portal': 'no Jamf verify-* command reads a Managed Software Update plan: its proof is the read its step names',
  'jamf-patch-management-fleet-plan-portal': 'no Jamf verify-* command reads a Managed Software Update plan: its proof is the read its step names',
  'jamf-patch-management-app-installer-portal': 'no Jamf verify-* command reads an App Installers deployment: its proof is the read its step names',
  'jamf-patch-management-app-installer-rollout-portal': 'no Jamf verify-* command reads an App Installers deployment: its proof is the read its step names',
  'jamf-policies-self-service-flush-one-portal': 'no Jamf verify-* command reads a policy log: its proof is the read its step names',
  'jamf-policies-self-service-flush-all-portal': 'no Jamf verify-* command reads a policy log: its proof is the read its step names',
  'linear-ticket-note-delete-portal': 'no Linear verify-* command proves a deleted comment: its proof is the read its step names',
  'linear-workspace-admin-unsuspend-portal': 'verify-suspended passes only for a suspended member, so it cannot prove an unsuspend: its proof is the read its step names',
  'linear-workspace-admin-export-portal': EXPORT,
  'mac-troubleshoot-prk-replace': NOT_NAMED,
  'okta-group-membership-rule-deactivate-portal': 'no Okta verify-* command reads a group rule: its proof is the read its step names',
  'okta-user-lifecycle-delete-portal': OKTA_DELETE,
  'okta-user-lifecycle-delete': OKTA_DELETE,
  'slack-app-approval-require-portal': SLACK_SETTING,
  'slack-app-approval-request-managers-grant-portal': 'no Slack verify-* command reads who manages app requests: its proof is the read its step names',
  'slack-guests-connect-approve-invitation-portal': SLACK_CONNECT,
  'slack-guests-connect-remove-org-portal': SLACK_CONNECT,
  'slack-guests-connect-disconnect-org-portal': SLACK_CONNECT,
  'slack-guests-connect-readd-members-portal': 'proved in the GUI, the Slack connector reads no channel membership',
  'slack-retention-export-legal-hold-portal': 'no Slack verify-* command reads a legal hold: its proof is the read its step names',
  'slack-retention-export-public-export-portal': EXPORT,
  'slack-retention-export-all-conversations-portal': EXPORT,
  'slack-retention-export-shorten-retention-portal': 'no Slack verify-* command reads a retention setting: its proof is the read its step names',
  'slack-retention-export-delete-messages-portal': 'no Slack verify-* command proves a deleted message: its proof is the read its step names',
  'slack-retention-export-delete-channel-portal': 'no Slack verify-* command proves a deleted channel, verify-archived reads an archived one: its proof is the read its step names',
  'slack-security-settings-2fa-require-portal': SLACK_SETTING,
  'slack-security-settings-2fa-off-portal': SLACK_SETTING,
  'slack-security-settings-saml-require-portal': SLACK_SETTING,
  'slack-security-settings-session-duration-portal': SLACK_SETTING,
  'slack-security-settings-approved-domains-portal': SLACK_SETTING,
  'slack-security-settings-file-sharing-portal': SLACK_SETTING,
  'slack-security-settings-sms-block-portal': SLACK_SETTING,
  'slack-user-lifecycle-to-member-portal': 'verify-guest passes only for a guest, so no Slack verify-* command proves a member: its proof is the read its step names',
  'slack-user-lifecycle-session-reset-portal': 'no Slack verify-* command reads sessions: its proof is the read its step names',
});
const UNSAFE_FENCED = /[`$;|&<>()\\'!]/;

const map = {};
const used = new Set();
let added = 0;
const tally = { bound: 0, r1: 0, reason: 0 };
for (const name of fs.readdirSync(DIR).filter((n) => n.endsWith('.md')).sort()) {
  const file = path.join(DIR, name);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const binding = baseBinding(lines);
  const inserts = [];
  lines.forEach((l, i) => {
    const m = l.match(MARK);
    if (!m) return;
    const portal = Boolean(m[1]);
    const id = m[1] || m[2];
    let last = i;
    let rev = null;
    for (let j = i + 1; j < lines.length; j += 1) {
      const f = lines[j].match(portal ? PORTAL_FIELD : FENCED_FIELD);
      if (!f) break;
      if (f[1] === 'Read-back') throw new Error(`${name}: ${id} already has a Read-back field`);
      if (f[1] === 'Reversibility') rev = f[2];
      last = j;
    }
    const cls = classOf(rev);
    const commands = [...new Set(binding.filter((b) => b.gates.includes(id)).map((b) => b.command))];
    map[`${name} ${id}`] = commands;
    let value;
    if (commands.length) {
      if (cls !== 'R2' && cls !== 'R3') throw new Error(`${name}: ${id} (${cls}) binds a read-back`);
      tally.bound += 1;
      if (portal) value = commands.map((c) => `\`${c}\``).join('; ');
      else {
        if (commands.length > 1 || UNSAFE_FENCED.test(commands[0])) throw new Error(`${name}: ${id}: a fenced field takes one plain command`);
        value = commands[0];
      }
    } else {
      let reason;
      if (cls === 'R0' || cls === 'R1') { reason = `${cls}: no change record`; tally.r1 += 1; } else {
        reason = REASONS[id];
        if (!reason) throw new Error(`${name}: ${id} (${cls}) needs a reason`);
        used.add(id);
        tally.reason += 1;
      }
      if (UNSAFE_FENCED.test(reason)) throw new Error(`${id}: the reason holds a character a gated fence comment may not`);
      value = portal ? `none (${reason})` : `none, ${reason}`;
    }
    inserts.push({ after: last, line: portal ? `- **Read-back:** ${value}` : `# Read-back: ${value}` });
  });
  for (const { after, line } of inserts.reverse()) lines.splice(after + 1, 0, line);
  added += inserts.length;
  if (write) fs.writeFileSync(file, lines.join('\n'));
}
const unused = Object.keys(REASONS).filter((id) => REASONS[id] && !used.has(id));
if (unused.length) throw new Error(`reasons for no unbound R2 or R3 gate: ${unused.join(', ')}`);
if (mapFile) fs.writeFileSync(mapFile, `${JSON.stringify(map, null, 1)}\n`);
console.log(`Read-back fields: ${added} (${tally.bound} naming read-backs, ${tally.r1} R1: no change record, ${tally.reason} R2 or R3 with a reason); ${write ? 'written' : 'not written (no --write)'}`);
