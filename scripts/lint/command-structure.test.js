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
