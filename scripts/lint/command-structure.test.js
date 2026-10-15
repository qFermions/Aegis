#!/usr/bin/env node
'use strict';
// command-structure.test.js — proves the GUI-first structure lint checks the
// implementation, not just the fixtures: (1) the live command surface is clean,
// (2) each rule fires on a synthetic violation, (3) a compliant synthetic file
// passes, (4) the freshness list stays wired to real docs.
// Run: node --test scripts/lint/command-structure.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const lint = require('./command-structure.js');
const ROOT = path.resolve(__dirname, '..', '..');

const KNOWN = new Set(['password-reset', 'mfa-issue', 'troubleshoot']);
const GOOD = `---
description: synthetic
---

# /synthetic

**Verdict:** something.

## What to check first
- Microsoft 365 admin center → Users → Active users → \`[UPN]\` → Licenses and apps

## Step-by-step fix (portal first)
1. Entra ID → Users → \`[UPN]\` → **Authentication methods** → read what is registered.
2. If stuck, use \`/mfa-issue\`.

<details>
<summary>PowerShell — for reference only</summary>

\`\`\`powershell
Get-MgUser -UserId "[UPN]"   # read-only: confirm the account exists
\`\`\`
</details>

## ⚠️ Risk warning
- none of the steps above change state.

## ✅ Verification checklist
- [ ] user signs in

## 📝 Jira-ready note
> Resolved [date/time]. Time spent: [X] min.
`;

function findings(text, variant = 'B', name = 'synthetic') {
  return lint.lintCommand(name, text, { commands: KNOWN, variant }).findings.map((f) => f.rule);
}

test('live command surface: every operational/troubleshooting command satisfies the GUI-first structural contract', () => {
  const results = lint.lintAll();
  const bad = results.filter((r) => r.findings.length);
  assert.deepEqual(bad.map((r) => `${r.name}: ${r.findings.map((f) => f.rule + '@' + f.line).join(', ')}`), [], 'lint findings on tracked commands');
  assert.ok(results.length >= 50, 'lint must cover the whole command surface');
  assert.ok(results.every((r) => r.variant), 'every command classified');
});

test('live docs carrying portal paths are fresh and uncorrupted', () => {
  for (const f of lint.FRESHNESS_DOCS) assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} missing`);
  assert.deepEqual(lint.lintDocFreshness(lint.FRESHNESS_DOCS), []);
});

test('a compliant synthetic command passes every rule (the lint is not vacuously strict)', () => {
  assert.deepEqual(findings(GOOD), []);
});

test('an unclassified command is a finding — new commands must be classified', () => {
  const r = lint.lintCommand('brand-new-thing', GOOD, { commands: KNOWN });
  assert.ok(r.findings.some((f) => f.rule === 'variant-mapped'));
});

test('gui-before-powershell: a PowerShell fence ahead of the first breadcrumb fails', () => {
  const psFirst = GOOD.replace('## What to check first\n- Microsoft 365 admin center → Users → Active users → `[UPN]` → Licenses and apps\n', '## What to check first\n<details>\n<summary>PS</summary>\n\n```powershell\nGet-MgUser -UserId "[UPN]"   # read\n```\n</details>\n- Microsoft 365 admin center → Users → Active users → `[UPN]` → Licenses and apps\n');
  assert.ok(findings(psFirst).includes('gui-before-powershell'));
});

test('powershell-collapsed / powershell-commented: uncollapsed or uncommented PowerShell fails', () => {
  const uncollapsed = GOOD.replace('<details>\n<summary>PowerShell — for reference only</summary>\n\n', '').replace('</details>\n', '');
  assert.ok(findings(uncollapsed).includes('powershell-collapsed'));
  const uncommented = GOOD.replace('Get-MgUser -UserId "[UPN]"   # read-only: confirm the account exists', 'Get-MgUser -UserId "[UPN]"');
  assert.ok(findings(uncommented).includes('powershell-commented'));
});

test('one-final-checklist / paste-ready-note / checklist-before-note', () => {
  const twoChecklists = GOOD + '\n## ✅ Verification checklist\n- [ ] dup\n';
  assert.ok(findings(twoChecklists).includes('one-final-checklist'));
  const noNote = GOOD.replace('## 📝 Jira-ready note\n> Resolved [date/time]. Time spent: [X] min.\n', '');
  assert.ok(findings(noNote).includes('paste-ready-note'));
  const swapped = GOOD.replace('## ✅ Verification checklist\n- [ ] user signs in\n\n## 📝 Jira-ready note\n> Resolved [date/time]. Time spent: [X] min.\n', '## 📝 Jira-ready note\n> Resolved [date/time]. Time spent: [X] min.\n\n## ✅ Verification checklist\n- [ ] user signs in\n');
  assert.ok(findings(swapped).includes('checklist-before-note'));
});

test('gui-steps-present: a command with no exact breadcrumb fails; a docs/comms command is exempt', () => {
  const noGui = GOOD.replace(/.*→.*\n/g, '');
  assert.ok(findings(noGui).includes('gui-steps-present'));
  assert.ok(!findings(noGui, 'C').includes('gui-steps-present'), 'variant C carries no GUI requirement');
});

test('risk-warning-present applies to troubleshooting commands only', () => {
  const noRisk = GOOD.replace('## ⚠️ Risk warning\n- none of the steps above change state.\n\n', '');
  assert.ok(findings(noRisk, 'B').includes('risk-warning-present'));
  assert.ok(!findings(noRisk, 'A').includes('risk-warning-present'));
});

test('slash-refs-exist: a dangling command reference fails; app switches are allowlisted', () => {
  assert.ok(findings(GOOD.replace('`/mfa-issue`', '`/does-not-exist`')).includes('slash-refs-exist'));
  assert.ok(!findings(GOOD.replace('`/mfa-issue`', 'Win+R → `outlook /safe` and `/reset`')).includes('slash-refs-exist'));
});

test('no-corrupted-chars: a stray combining mark fails', () => {
  assert.ok(findings(GOOD.replace('something.', 'start/҅update')).includes('no-corrupted-chars'));
});

test('fresh-portal-paths: a retired Entra breadcrumb fails, in prose or inside a fence', () => {
  assert.ok(findings(GOOD.replace('Entra ID → Users', 'Entra → Identity → Users')).includes('fresh-portal-paths'));
  assert.ok(findings(GOOD.replace('# read-only: confirm the account exists', '# Protection → Conditional Access')).includes('fresh-portal-paths'));
  for (const s of lint.STALE_PORTAL_PATHS) assert.match(s.current, /learn\.microsoft\.com|retired/, 'every stale entry cites its source');
});

test('fresh-portal-paths: Markdown emphasis, links, or HTML cannot hide a retired breadcrumb (review finding)', () => {
  for (const wrapped of ['Entra → Protection → **Conditional Access**', '**Monitoring** → _Sign-in logs_', 'Entra → Protection → [Conditional Access](https://example.org)', 'Entra → <b>Identity</b> → Users']) {
    assert.ok(findings(GOOD.replace('Entra ID → Users', wrapped)).includes('fresh-portal-paths'), wrapped);
  }
  assert.ok(findings(GOOD.replace('Entra ID → Users', 'Entra → Monitoring → Diagnostic settings')).includes('fresh-portal-paths'));
  assert.ok(!findings(GOOD.replace('Entra ID → Users', 'Entra ID → Monitoring & health → Diagnostic settings')).includes('fresh-portal-paths'));
  assert.ok(!findings(GOOD.replace('Entra ID → Users', 'entra.microsoft.com → ID Protection → Risky users')).includes('fresh-portal-paths'), 'ID Protection is the current sibling menu');
});

test('gui-before-powershell: a frontmatter description arrow is not a breadcrumb (review finding)', () => {
  const fm = GOOD.replace('description: synthetic', 'description: Entra ID → Users → check it');
  const psBeforeBody = fm.replace('## What to check first\n- Microsoft 365 admin center → Users → Active users → `[UPN]` → Licenses and apps\n', '<details>\n<summary>PS</summary>\n\n```powershell\nGet-MgUser -UserId "[UPN]"   # read\n```\n</details>\n\n## What to check first\n- Microsoft 365 admin center → Users → Active users → `[UPN]` → Licenses and apps\n');
  assert.ok(findings(psBeforeBody).includes('gui-before-powershell'));
  assert.deepEqual(findings(fm), [], 'the arrow in frontmatter alone changes nothing');
});

test('CLI exits 0 on the live tree', () => {
  const { execFileSync } = require('node:child_process');
  const out = execFileSync('node', [path.join(__dirname, 'command-structure.js')], { encoding: 'utf8' });
  assert.match(out, /clean/);
});

// ── G1: Google Workspace / Okta / Jamf / macOS lane ──────────────────────────
const G1_GOOD = `---
description: synthetic G1
---

# /synthetic-g1

## Fast path
1. Admin console → Directory → Users → \`[USER@DOMAIN.COM]\` → read the status banner.

\`\`\`bash
# read-only: confirm the account and its organizational unit
gam info user "[USER@DOMAIN.COM]"   # prints status, OU and licences
\`\`\`

<details>
<summary>GAM — the scale version (HUMAN-RUN)</summary>

\`\`\`bash
# HUMAN-RUN — the administrator runs this; Aegis never does
gam update user "[USER@DOMAIN.COM]" org "[OU_PATH]"   # moves the user to the new organizational unit
\`\`\`
</details>

## ⚠️ Risk warning
- moving an OU changes which policies apply.

## ✅ Verification checklist
- [ ] the user shows the new OU

## 📝 Jira-ready note
> Resolved [date/time]. Time spent: [X] min.
`;
const g1Findings = (text, variant = 'A') => lint.lintCommand('synthetic-g1', text, { commands: KNOWN, variant }).findings.map((f) => f.rule);

test('G1: a compliant Google/Okta/Jamf command passes every rule (read-only fence may stay open)', () => {
  assert.deepEqual(g1Findings(G1_GOOD), []);
  assert.deepEqual(g1Findings(G1_GOOD, 'B'), []);
});

test('G1 breadcrumb roots: Admin console, Okta, Jamf Pro, Apple Business, Fleet, System Settings, Self Service, Finder, Terminal and Zoom Rooms count; an unknown root does not', () => {
  for (const crumb of ['Admin console → Directory → Users', 'admin.google.com → Directory → Users', 'Okta Admin Console → Directory → People',
    'Okta → Directory → People', 'Jamf Pro → Computers → Search inventory', 'Jamf → Computers → PreStage enrollments',
    'Apple Business Manager → Devices → Inventory', 'Apple Business → Devices → Inventory', 'Fleet → Hosts → Actions',
    'System Settings → Privacy & Security → FileVault', 'Self Service → Featured', 'Finder → Applications → Utilities',
    'Terminal → New Window', 'Zoom Rooms → Room Management', 'Zoom admin → Room Management → Zoom Rooms']) {
    const text = G1_GOOD.replace('Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read the status banner.', `${crumb} → read it.`);
    assert.ok(!g1Findings(text).includes('gui-steps-present'), crumb);
  }
  const unknown = G1_GOOD.replace('Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read the status banner.', 'Somewhere → Elsewhere → read it.');
  assert.ok(g1Findings(unknown).includes('gui-steps-present'));
});

test('G1 cli-collapsed: a mutating gam/jamf/curl/profiles fence outside <details> fails; read-only diagnostics may stay open', () => {
  const open = G1_GOOD.replace('<details>\n<summary>GAM — the scale version (HUMAN-RUN)</summary>\n\n', '').replace('</details>\n', '');
  assert.ok(g1Findings(open).includes('cli-collapsed'));
  for (const sink of ['sudo jamf recon   # sends inventory', 'sudo profiles renew -type enrollment   # re-runs enrollment',
    'curl -sS -X POST "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/suspend"   # suspends in Okta']) {
    const text = G1_GOOD.replace('gam info user "[USER@DOMAIN.COM]"   # prints status, OU and licences', sink);
    assert.ok(g1Findings(text).includes('cli-collapsed'), sink);
  }
  for (const diagnostic of ['profiles show -type enrollment   # lists installed profiles', 'dscl . -read /Users/[FIRST_NAME]   # reads the local account',
    'system_profiler SPHardwareDataType   # hardware summary', 'log show --last 1h --style compact   # recent log', 'networksetup -getairportnetwork en0   # current Wi-Fi',
    'gam print users query "isSuspended=True"   # lists suspended users', 'dig +short [@Aegion_DOMAIN] mx   # mail exchangers', 'fdesetup status   # FileVault state']) {
    const text = G1_GOOD.replace('gam info user "[USER@DOMAIN.COM]"   # prints status, OU and licences', diagnostic);
    assert.ok(!g1Findings(text).includes('cli-collapsed'), diagnostic);
  }
});

test('G1 cli-commented: every CLI invocation carries a plain-English comment (trailing or on the line above)', () => {
  // the HUMAN-RUN label moves below the command, so nothing explains the bare line
  const bare = G1_GOOD.replace('# HUMAN-RUN — the administrator runs this; Aegis never does\ngam update user "[USER@DOMAIN.COM]" org "[OU_PATH]"   # moves the user to the new organizational unit',
    'gam update user "[USER@DOMAIN.COM]" org "[OU_PATH]"\n# HUMAN-RUN — the administrator runs this; Aegis never does');
  assert.notEqual(bare, G1_GOOD);
  assert.ok(g1Findings(bare).includes('cli-commented'));
  const above = bare.replace('gam update user "[USER@DOMAIN.COM]" org "[OU_PATH]"', '# moves the user to the new organizational unit\ngam update user "[USER@DOMAIN.COM]" org "[OU_PATH]"');
  assert.ok(!g1Findings(above).includes('cli-commented'));
  const bareRead = G1_GOOD.replace('gam info user "[USER@DOMAIN.COM]"   # prints status, OU and licences', 'gam info user "[USER@DOMAIN.COM]"')
    .replace('# read-only: confirm the account and its organizational unit\n', '');
  assert.ok(g1Findings(bareRead).includes('cli-commented'), 'read-only diagnostics still need the comment');
});

test('G1 gui-before-cli: a CLI fence ahead of the first portal breadcrumb fails', () => {
  const cliFirst = G1_GOOD.replace('## Fast path\n1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read the status banner.\n\n', '').replace('## ⚠️ Risk warning', 'Admin console → Directory → Users → check.\n\n## ⚠️ Risk warning');
  assert.ok(g1Findings(cliFirst).includes('gui-before-cli'));
});

test('G1 cli-human-run: a mutating CLI fence must say HUMAN-RUN', () => {
  const unlabeled = G1_GOOD.replace('# HUMAN-RUN — the administrator runs this; Aegis never does\n', '# the administrator runs this\n');
  assert.ok(g1Findings(unlabeled).includes('cli-human-run'));
});

test('G1 cli-in-shell-fence: Google/Okta/Jamf/macOS CLI inside a PowerShell or untagged fence fails (the gate grammar would not see it)', () => {
  const inPowerShell = G1_GOOD.replace('```bash\n# HUMAN-RUN', '```powershell\n# HUMAN-RUN');
  assert.ok(g1Findings(inPowerShell).includes('cli-in-shell-fence'));
  const untagged = G1_GOOD.replace('```bash\n# HUMAN-RUN', '```\n# HUMAN-RUN');
  assert.ok(g1Findings(untagged).includes('cli-in-shell-fence'));
});

test('G1 fresh-portal-paths: retired Google, Okta, Jamf and Apple paths fail; the current wording passes; every entry cites a vendor page and a check date', () => {
  const stale = [
    'Admin console → Apps → G Suite → Gmail', 'Admin console → Security → Basic settings', 'Admin console → Devices → Mobile devices',
    'Admin console → Security → 2-step verification', 'Admin console → Users → Add new user', 'Okta Admin Console → Applications → Applications',
    'Jamf Pro → Computers → [SERIAL_NUMBER] → Management → Erase Computer', 'Apple Business Manager → Devices → Edit MDM Server',
  ];
  const current = [
    'Admin console → Apps → Google Workspace → Gmail', 'Admin console → Security → Authentication → 2-step verification',
    'Admin console → Devices → Mobile & endpoints → Devices', 'Admin console → Devices → Overview → Mobile devices', 'Admin console → Directory → Users → Add new user',
    'Okta Admin Console → Applications and Resources → Applications', 'Jamf Pro → Computers → [SERIAL_NUMBER] → Management → Wipe Computer',
    'Apple Business → Devices → Inventory → Assign Device Management',
    'Admin console → Directory → Users → `[USER@DOMAIN.COM]` → Security → 2-step verification',
    'admin.google.com → Directory → Users → [USER@DOMAIN.COM] → Security → 2-Step Verification',
  ];
  for (const s of stale) assert.ok(g1Findings(G1_GOOD.replace('Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read the status banner.', s)).includes('fresh-portal-paths'), s);
  for (const c of current) assert.ok(!g1Findings(G1_GOOD.replace('Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read the status banner.', c)).includes('fresh-portal-paths'), c);
  assert.ok(lint.STALE_PORTAL_PATHS_G1.length >= 8);
  for (const s of lint.STALE_PORTAL_PATHS_G1) {
    assert.match(s.source, /^https:\/\/(?:knowledge\.workspace\.google\.com|support\.google\.com|help\.okta\.com|learn\.jamf\.com|support\.apple\.com)\//, 'every G1 stale entry cites an official vendor page');
    assert.match(s.checked, /^\d{4}-\d{2}-\d{2}$/, 'every G1 stale entry carries its check date');
  }
});

test('G1 commands are classified: every Phase-3 runbook name has a variant', () => {
  for (const name of ['gws-new-user', 'gws-offboard', 'gws-password-reset', 'gws-2sv-reset', 'gws-group-membership', 'gws-ou-move', 'gws-license-assign',
    'gws-drive-transfer', 'gws-audit-log', 'gws-chromeos-device', 'okta-app-assignment', 'okta-mfa-reset', 'okta-user-lifecycle', 'jamf-enroll-mac',
    'jamf-lock-erase', 'mac-new-hire-laptop']) assert.equal(lint.VARIANT_OF[name], 'A', name);
  for (const name of ['gws-gmail-delivery', 'mac-troubleshoot', 'zoom-room-issue']) assert.equal(lint.VARIANT_OF[name], 'B', name);
});

test('G1 knowledge docs are on the freshness list (retired vendor wording can never come back there)', () => {
  for (const doc of ['docs/portal-nav-google-2026.md', 'docs/gws-reversibility.md', 'docs/evidence/gws/README.md']) {
    assert.ok(lint.FRESHNESS_DOCS.includes(doc), doc);
  }
  const findings = lint.lintDocFreshness(['docs/portal-nav-google-2026.md']);
  assert.deepEqual(findings, []);
});
