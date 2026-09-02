#!/usr/bin/env node
'use strict';
// command-structure.js — deterministic structure lint for `.claude/commands/*.md`.
//
// `docs/command-output-standard.md` is a model-behavior contract: Aegis SHAPES
// the rendered answer at run time. This lint enforces the subset of that
// contract that is a property of the content sources themselves and can be
// checked without a model:
//
//   gui-steps-present      operational/troubleshooting commands carry at least
//                          one exact portal breadcrumb (Portal → blade → control)
//   gui-before-powershell  the first breadcrumb precedes the first PowerShell fence
//   powershell-collapsed   every PowerShell fence sits inside a <details> block
//   powershell-commented   every PowerShell fence carries a plain-English comment
//   one-final-checklist    exactly one final verification/completion checklist
//   paste-ready-note       exactly one Jira-ready / paste-ready note
//   checklist-before-note  the checklist precedes the note
//   risk-warning-present   troubleshooting commands carry a ⚠️ Risk warning section
//   slash-refs-exist       every referenced `/command` exists in .claude/commands/
//   no-corrupted-chars     no stray combining marks / replacement characters
//   fresh-portal-paths     no admin-center breadcrumb that Microsoft has renamed
//   variant-mapped         every command file is classified (new files must be)
//
// What this lint does NOT prove: that the model leads with the most useful
// action, sizes depth to the ticket class, or carries a failed attempt forward.
// Those stay model-behavior contracts, evaluated by the ticket eval rubric
// (`scripts/eval/README.md`). Zero dependencies; pure fs + regex.
//
// CLI: node scripts/lint/command-structure.js [--json]   exit 0 clean · 1 findings

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const COMMANDS_DIR = path.join(ROOT, '.claude', 'commands');

// ── Variant map (docs/command-output-standard.md §Variants) ───────────────────
// A = operational runbook · B = troubleshooting · C = docs/comms · D = learning
// E = meta/reference (identity switch, harness maintenance, PowerShell teaching)
// ALIAS = thin pointer to a canonical command.
const VARIANTS = {
  A: ['new-user', 'offboard', 'device-wipe', 'sharepoint-access', 'shared-mailbox', 'distribution-list',
    'mailbox-permissions', 'email-whitelist', 'email-quarantine', 'new-device-setup', 'unite-extension-create',
    'unite-voicemail-reset', 'group-membership-audit', 'license-audit', 'onedrive-restore', 'conditional-access',
    'password-reset', 'meraki-site-vpn', 'jira-create', 'jira-update'],
  B: ['troubleshoot', 'mfa-issue', 'printer-issue', 'wifi-issue', 'lan-wan', 'vpn-check', 'ad-connect', 'teams-issue',
    'outlook-issue', 'onedrive-issue', 'email-to-spam', 'intune-compliance', 'meraki-health', 'meraki-vpn-status',
    'sip-trunk-status', 'security-alert-triage'],
  C: ['write-sop', 'runbook', 'incident-report', 'board-report', 'vendor-email', 'escalation-note', 'ticket-response',
    'draft-email', 'daily-start', 'daily-wrap', 'vent'],
  D: ['cloud-lab', 'devops-drill', 'ai-engineer-drill'],
  E: ['aegis', 'aegis-update', 'ps-error-decode', 'ps-script', 'field', 'unite-migration-status'],
  ALIAS: ['onboard', 'shared-mailbox-create'],
};
const VARIANT_OF = {};
for (const [v, names] of Object.entries(VARIANTS)) for (const n of names) VARIANT_OF[n] = v;

// Commands whose whole job is state-changing integration: their output contract
// is the direct-integration policy (scripts/command-policy.test.js), not the
// runbook shape, so the GUI/checklist/note rules do not apply.
const INTEGRATION_ONLY = new Set(['jira-create', 'jira-update']);

// ── Pattern sets ──────────────────────────────────────────────────────────────
// A breadcrumb is a non-fence line with an arrow AND a recognizable admin surface.
const BREADCRUMB_ROOT = /(admin center|admin\.microsoft\.com|entra\.microsoft\.com|intune\.microsoft\.com|admin\.exchange\.microsoft\.com|security\.microsoft\.com|admin\.teams\.microsoft\.com|portal\.azure\.com|dashboard\.meraki\.com|\bEAC\b|\bADUC\b|\bEntra\b|\bIntune\b|\bDefender\b|\bMeraki\b|\bSettings\b|Control Panel|Task Manager|Device Manager|File Explorer|\bOutlook\b|\bTeams\b|\bOneDrive\b|\bWin\+R\b|\bStart\b|\[@Aegion_VOIP_URL\]|\[@Aegion_JIRA_URL\]|Jira|Zoom|Adobe|Company Portal|Synchronization Service|Dashboard|dashboard|portal)/;

const CHECKLIST_HEADING = /^## (✅ Verification checklist|✅ Completion checklist|Final verification checklist)\s*$/;
const NOTE_HEADING = /^## (📝 Jira-ready note|Paste-ready ticket note)\s*$/;
const RISK_HEADING = /^## ⚠️ Risk warning\s*$/;
const FENCE_OPEN = /^```([A-Za-z0-9_-]*)\s*$/;

// Application switches that look like slash commands but are not (Outlook /safe,
// OneDrive /reset, …). Keep explicit — an allowlist is auditable, a heuristic is not.
const APP_SWITCH_ALLOWLIST = new Set(['reset', 'safe', 'cleanviews', 'resetnavpane', 'resetfolders', 'importprf',
  'regserver', 'profiles', 'recycle', 'online', 'offline', 'all', 'ticket', 'summary', 'reason']);

// Unicode ranges that only appear in this corpus as corruption.
const CORRUPTION = /[̀-ͯ҃-҉�-]/;

// Admin-center breadcrumbs Microsoft has renamed. Each entry cites the current
// Microsoft Learn wording it was checked against (2026-09-01). Extend when a
// portal moves; never delete — a removed entry lets the stale path come back.
const STALE_PORTAL_PATHS = [
  { pattern: /Identity\s*→\s*(Users|Groups|Roles|Devices|Applications)/, current: 'Entra ID → Users / Groups / Roles & admins (learn.microsoft.com/entra/identity/users/users-revoke-access)' },
  { pattern: /(Identity\s*→\s*)?Hybrid management\s*→/, current: 'Entra ID → Entra Connect → Connect sync (learn.microsoft.com/entra/identity/hybrid/connect/how-to-connect-post-installation)' },
  { pattern: /(?<!ID )Protection\s*→\s*(Conditional Access|CA\b|Identity Protection|Authentication methods|Risky)/, current: 'Entra ID → Conditional Access · Entra ID → Authentication methods → Policies · ID Protection → Risky users (learn.microsoft.com/entra/identity/conditional-access/managed-policies)' },
  { pattern: /(?<!& health\s*)(?<!&\s)Monitoring\s*→\s*(Sign-in logs|Audit logs|Diagnostic settings|Provisioning logs|Workbooks)/, current: 'Entra ID → Monitoring & health → … (learn.microsoft.com/entra/identity/monitoring-health/how-to-view-applied-conditional-access-policies)' },
  { pattern: /Azure Active Directory\s*→/, current: 'Entra ID → … (the Azure AD blade name retired with the Entra rename)' },
];
// Markdown emphasis must not hide a breadcrumb from the freshness check
// ("Protection → **Conditional Access**" is the same retired path).
const plainNav = (line) => line.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<\/?[a-z][^>]*>/gi, '').replace(/[*_`]/g, '');

// ── Parsing helpers ───────────────────────────────────────────────────────────
function parse(text) {
  const lines = text.split('\n');
  const fenceAt = new Array(lines.length).fill(null); // language of enclosing fence or null
  const detailsDepthAt = new Array(lines.length).fill(0);
  let fence = null;
  let depth = 0;
  // YAML frontmatter is metadata, not content: a `description:` carrying an
  // arrow must never count as the first breadcrumb.
  let frontmatterEnd = -1;
  if (lines[0].trim() === '---') { const close = lines.findIndex((l, i) => i > 0 && l.trim() === '---'); if (close > 0) frontmatterEnd = close; }
  lines.forEach((line, i) => {
    if (i <= frontmatterEnd) { fenceAt[i] = 'frontmatter'; detailsDepthAt[i] = 0; return; }
    if (fence === null) {
      const m = line.match(FENCE_OPEN);
      if (m) { fence = m[1] || 'text'; fenceAt[i] = fence; detailsDepthAt[i] = depth; return; }
      depth += (line.match(/<details\b/g) || []).length;
      depth -= (line.match(/<\/details>/g) || []).length;
      detailsDepthAt[i] = depth;
    } else {
      fenceAt[i] = fence;
      detailsDepthAt[i] = depth;
      if (/^```\s*$/.test(line)) fence = null;
    }
  });
  return { lines, fenceAt, detailsDepthAt };
}

function commandNames(dir = COMMANDS_DIR) {
  return new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)));
}

// ── The lint ──────────────────────────────────────────────────────────────────
/**
 * lintCommand(name, text, opts) → { name, variant, findings: [{ rule, line, message }] }
 * opts.commands: Set of existing command names (for slash-refs-exist)
 * opts.variant: override the variant map (tests)
 */
function lintCommand(name, text, opts = {}) {
  const findings = [];
  const add = (rule, line, message) => findings.push({ rule, line, message });
  const variant = opts.variant || VARIANT_OF[name];
  if (!variant) {
    add('variant-mapped', 0, `command "${name}" is not classified in scripts/lint/command-structure.js VARIANTS — classify it (A/B/C/D/E/ALIAS)`);
  }
  const known = opts.commands || commandNames();
  const { lines, fenceAt, detailsDepthAt } = parse(text);

  // no-corrupted-chars (all variants)
  lines.forEach((line, i) => { if (CORRUPTION.test(line)) add('no-corrupted-chars', i + 1, `stray combining/replacement character: ${JSON.stringify(line.match(CORRUPTION)[0])}`); });

  // slash-refs-exist (all variants) — backticked `/name` and bold **/name**
  lines.forEach((line, i) => {
    if (fenceAt[i]) return;
    for (const m of line.matchAll(/(?:`|\*\*)\/([a-z][a-z0-9-]*)(?:`|\*\*)/g)) {
      const ref = m[1];
      if (!known.has(ref) && !APP_SWITCH_ALLOWLIST.has(ref)) add('slash-refs-exist', i + 1, `references /${ref}, which does not exist in .claude/commands/`);
    }
  });

  // fresh-portal-paths (all variants, prose and fences alike — a stale path in a comment misleads too)
  lines.forEach((line, i) => {
    const nav = plainNav(line);
    for (const { pattern, current } of STALE_PORTAL_PATHS) {
      if (pattern.test(nav)) add('fresh-portal-paths', i + 1, `stale admin-center path "${nav.match(pattern)[0]}" — current: ${current}`);
    }
  });

  const structural = (variant === 'A' || variant === 'B') && !INTEGRATION_ONLY.has(name);
  if (!structural) return { name, variant: variant || null, findings };

  // locate structure
  const breadcrumbLines = [];
  const psFences = []; // { open, close }
  const checklistLines = [];
  const noteLines = [];
  const riskLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!fenceAt[i] && line.includes('→') && BREADCRUMB_ROOT.test(line)) breadcrumbLines.push(i + 1);
    if (fenceAt[i] && /^```powershell\s*$/i.test(line)) psFences.push({ open: i + 1, close: null, depth: detailsDepthAt[i] });
    else if (fenceAt[i] && /^```\s*$/.test(line) && psFences.length && psFences[psFences.length - 1].close === null && fenceAt[i] === 'powershell') psFences[psFences.length - 1].close = i + 1;
    if (!fenceAt[i] && CHECKLIST_HEADING.test(line)) checklistLines.push(i + 1);
    if (!fenceAt[i] && NOTE_HEADING.test(line)) noteLines.push(i + 1);
    if (!fenceAt[i] && RISK_HEADING.test(line)) riskLines.push(i + 1);
  }

  if (!breadcrumbLines.length) add('gui-steps-present', 0, 'no exact portal breadcrumb (a line with → and an admin surface) found');
  if (checklistLines.length !== 1) add('one-final-checklist', checklistLines[1] || 0, `expected exactly one final checklist heading, found ${checklistLines.length}`);
  if (noteLines.length !== 1) add('paste-ready-note', noteLines[1] || 0, `expected exactly one Jira-ready / paste-ready note heading, found ${noteLines.length}`);
  if (checklistLines.length === 1 && noteLines.length === 1 && checklistLines[0] > noteLines[0]) add('checklist-before-note', noteLines[0], 'the paste-ready note precedes the final checklist');
  if (variant === 'B' && riskLines.length !== 1) add('risk-warning-present', 0, `troubleshooting command needs exactly one "## ⚠️ Risk warning" section, found ${riskLines.length}`);

  for (const f of psFences) {
    if (f.depth < 1) add('powershell-collapsed', f.open, 'PowerShell fence is not inside a <details> block (PowerShell is secondary — collapse it)');
    const body = lines.slice(f.open, (f.close || lines.length) - 1);
    if (!body.some((l) => /#/.test(l))) add('powershell-commented', f.open, 'PowerShell fence carries no plain-English comment line');
  }
  if (psFences.length && breadcrumbLines.length && psFences[0].open < breadcrumbLines[0]) {
    add('gui-before-powershell', psFences[0].open, `first PowerShell fence (line ${psFences[0].open}) precedes the first portal breadcrumb (line ${breadcrumbLines[0]})`);
  }
  return { name, variant, findings };
}

function lintAll(dir = COMMANDS_DIR) {
  const known = commandNames(dir);
  const results = [];
  for (const name of [...known].sort()) {
    const text = fs.readFileSync(path.join(dir, name + '.md'), 'utf8');
    results.push(lintCommand(name, text, { commands: known }));
  }
  return results;
}

// Freshness check for docs that carry portal paths but are not commands.
function lintDocFreshness(files) {
  const out = [];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    text.split('\n').forEach((line, i) => {
      const nav = plainNav(line);
      for (const { pattern, current } of STALE_PORTAL_PATHS) {
        if (pattern.test(nav)) out.push({ file: rel, line: i + 1, rule: 'fresh-portal-paths', message: `stale admin-center path "${nav.match(pattern)[0]}" — current: ${current}` });
      }
      if (CORRUPTION.test(line)) out.push({ file: rel, line: i + 1, rule: 'no-corrupted-chars', message: 'stray combining/replacement character' });
    });
  }
  return out;
}

const FRESHNESS_DOCS = ['docs/portal-nav-2026.md', 'docs/ticket-examples.md', 'docs/plan-mode-templates.md', 'docs/examples.md',
  'modules/it_support/README.md', 'modules/it_support/troubleshooting.md', 'modules/it_support/workflows.md',
  'modules/security/compliance_checks.md', 'modules/security/incident_response.md', 'modules/security/vulnerability_scan.md',
  'modules/security/threat_detection.md', 'modules/systems/health_checks.md', 'modules/systems/infrastructure.md',
  'modules/systems/network_ops.md', 'modules/automation/powershell/examples.md', '.claude/plugins/enterprise-it-ops/skills/it-ops.md', 'CLAUDE.md'];

module.exports = { lintCommand, lintAll, lintDocFreshness, VARIANTS, VARIANT_OF, STALE_PORTAL_PATHS, FRESHNESS_DOCS, APP_SWITCH_ALLOWLIST, parse };

if (require.main === module) {
  const json = process.argv.includes('--json');
  const results = lintAll();
  const docFindings = lintDocFreshness(FRESHNESS_DOCS);
  const total = results.reduce((n, r) => n + r.findings.length, 0) + docFindings.length;
  if (json) {
    console.log(JSON.stringify({ ok: total === 0, commands: results, docs: docFindings }, null, 2));
  } else {
    const byVariant = {};
    for (const r of results) byVariant[r.variant || 'UNMAPPED'] = (byVariant[r.variant || 'UNMAPPED'] || 0) + 1;
    console.log(`command-structure lint — ${results.length} commands (${Object.entries(byVariant).map(([k, v]) => `${k}:${v}`).join(' ')})`);
    for (const r of results) for (const f of r.findings) console.log(`  ${r.name}.md:${f.line}  [${f.rule}]  ${f.message}`);
    for (const f of docFindings) console.log(`  ${f.file}:${f.line}  [${f.rule}]  ${f.message}`);
    console.log(total ? `\n${total} finding(s)` : '\nclean — structural GUI-first contract holds for every operational/troubleshooting command');
  }
  process.exit(total ? 1 : 0);
}
