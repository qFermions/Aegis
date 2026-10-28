/**
 * sanitize.js — Aegis Ticket Graph edge sanitizer
 *
 * Applies the repo's deterministic content-safety pattern set to every payload
 * crossing a graph edge (ticket intake + every node artifact). Nothing else
 * watches inter-agent messages: the commit-time scanner only fires at commit.
 *
 * Pattern set mirrors scripts/pre-commit-check.js — that file is canonical;
 * keep the two in sync. (Not require()d directly because pre-commit-check.js
 * executes main() on load.)
 *
 * Severity model at the graph edge:
 *   BLOCK  — tenant/org literal (SR-8), credential/secret formats → submit refused
 *   WARN   — dangerous PowerShell patterns, PII patterns → recorded in state
 *   FLAG   — prompt-injection markers → quoted as data, never followed (SR-3)
 */

const fs = require('fs');
const path = require('path');
// Shared untrusted-text rules (pure, no I/O): one copy for this sanitizer and the replay cache.
const { foldedForms, INJECTION_MARKERS, injectionMarkersIn, hasForeignOrgToken, containsLiteral, maskCanonicalPlaceholders } = require('../tier/tier-guard.js');

// ── Dangerous PowerShell patterns (WARN) — mirror of pre-commit-check.js ─────
const DANGEROUS_PS_PATTERNS = [
  { pattern: /Remove-Item\s+.*-Recurse\s+.*-Force|Remove-Item\s+.*-Force\s+.*-Recurse/i, label: 'Remove-Item -Recurse -Force — mass file deletion' },
  { pattern: /Remove-Mg\w+/i, label: 'Remove-Mg* — Graph API deletion cmdlet' },
  { pattern: /Remove-Mailbox/i, label: 'Remove-Mailbox — permanent mailbox deletion' },
  { pattern: /Format-\w+/i, label: 'Format-* — potential disk format' },
  { pattern: /Clear-Mailbox/i, label: 'Clear-Mailbox — wipes mailbox contents' },
  { pattern: /Clear-MobileDevice/i, label: 'Clear-MobileDevice — remote device wipe' },
  { pattern: /Disable-Mg\w+|Disable-ADAccount/i, label: 'Disable-* — account/object disable' },
  { pattern: /Revoke-Mg\w+|Revoke-\w+/i, label: 'Revoke-* — session/token revocation' },
  { pattern: /BlockCredential\s*\$true/i, label: 'BlockCredential $true — blocks user sign-in' },
  { pattern: /Invoke-Expression|[^a-z]IEX[^a-z]/i, label: 'Invoke-Expression / IEX — arbitrary code execution' },
  { pattern: /ConvertTo-SecureString.*-AsPlainText.*-Force/i, label: 'ConvertTo-SecureString -AsPlainText — plaintext credential in script' },
  { pattern: /git\s+push\s+.*--force|git\s+push\s+-f\b/i, label: 'git push --force — can overwrite remote history' },
  { pattern: /git\s+reset\s+--hard/i, label: 'git reset --hard — destroys uncommitted work' },
];

// ── PII patterns (WARN at the edge; only canonical placeholder tokens are blanked first) ──
const PII_PATTERNS = [
  { pattern: /\b[A-Za-z0-9._%+-]+@(?!YOUR_DOMAIN|example-corp\.|vendor-example\.|example\.|github\.com|noreply\.github\.com)[a-z0-9.-]+\.(org|com|net)\b/, label: 'Real email address (use [USER@DOMAIN.COM])' },
  { pattern: /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/, label: 'Phone number pattern (use [PHONE_NUMBER])' },
];

// ── Credential/secret patterns (BLOCK) ───────────────────────────────────────
const CREDENTIAL_PATTERNS = [
  { pattern: /\$\w*(password|secret|token|key|cred)\w*\s*=\s*["'][^"']{4,}["']/i, label: 'Hardcoded credential variable' },
  { pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, label: 'GitHub token' },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/, label: 'GitHub fine-grained PAT' },
  { pattern: /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\b/, label: 'JWT' },
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: 'Private key block' },
  { pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/, label: 'API secret key (sk-…)' },
  { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, label: 'Slack token' },
  { pattern: /AccountKey=[A-Za-z0-9+/=]{40,}/, label: 'Azure storage account key' },
  { pattern: /SharedAccessSignature\s*=/i, label: 'Azure SAS token assignment' },
];

// Prompt-injection markers (FLAG: data, never instructions), confusable folding and the
// second-org-namespace rule (BLOCK) live in scripts/tier/tier-guard.js, shared with the
// replay cache. Marker matching and the org rule use the folded forms; the flag quotes the
// original line, and the org report never echoes the token.

// Tenant literals (SR-8): loaded at call time from env + gitignored replacements.txt.
// Real values never appear in this file; scan reports never echo them.
function loadTenantLiterals() {
  const literals = [];
  for (const v of ['AEGION_DOMAIN', 'AEGION_ORG_NAME']) {
    if (process.env[v]) literals.push(process.env[v]);
  }
  const repFile = path.join(__dirname, '..', '..', 'replacements.txt');
  if (fs.existsSync(repFile)) {
    fs.readFileSync(repFile, 'utf8').split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((l) => literals.push(l));
  }
  return Array.from(new Set(literals.map((l) => l.toLowerCase())));
}

/**
 * Scan one text payload.
 * Returns { blocks:[], warnings:[], injectionFlags:[], piiWarnings:[] }
 * Entries carry { line, label } (or { line, marker, quote } for injection).
 * Tenant-literal hits are redacted — the report never contains the literal.
 */
function scanText(text, opts = {}) {
  const tenantLiterals = opts.tenantLiterals || loadTenantLiterals();
  const result = { blocks: [], warnings: [], injectionFlags: [], piiWarnings: [] };
  const lines = String(text).split('\n');

  lines.forEach((line, i) => {
    const n = i + 1;
    const forms = foldedForms(line); // one fold per line, shared by every check below
    const lowerForms = forms.map((f) => f.toLowerCase()); // lower-cased once for the literal checks

    for (const literal of tenantLiterals) {
      if (literal && containsLiteral(line, literal, forms, lowerForms)) {
        result.blocks.push({ line: n, label: 'Tenant/org literal (SR-8) — use the [@Aegion_*] token', text: '[REDACTED — tenant literal on this line]' });
      }
    }
    for (const { pattern, label } of CREDENTIAL_PATTERNS) {
      if (pattern.test(line)) result.blocks.push({ line: n, label, text: '[REDACTED — credential pattern on this line]' });
    }
    for (const { pattern, label } of DANGEROUS_PS_PATTERNS) {
      if (pattern.test(line)) { result.warnings.push({ line: n, label, text: line.trim().slice(0, 100) }); break; }
    }
    // Canonical placeholders are blanked, nothing else: a real address or number on
    // the same line as [JIRA-###] or [UPN] is still found.
    const unmasked = maskCanonicalPlaceholders(line);
    for (const { pattern, label } of PII_PATTERNS) {
      if (pattern.test(unmasked)) result.piiWarnings.push({ line: n, label });
    }
    if (hasForeignOrgToken(line, forms)) {
      result.blocks.push({ line: n, label: 'Mixed-tenant case: an org token from another namespace than [@Aegion_*] (one deployment serves one tenant; split the case; a chat handle ending in a dictionary word reads as one: write it without the brackets)', text: '[REDACTED: foreign org token on this line]' });
    }
    for (const marker of injectionMarkersIn(line, forms)) {
      result.injectionFlags.push({ line: n, marker, quote: line.trim().slice(0, 160) });
    }
  });

  return result;
}

/** Collect every string leaf of a JSON value with its path (for artifact scans). */
function collectStrings(value, basePath, out) {
  if (typeof value === 'string') {
    out.push({ path: basePath, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collectStrings(v, `${basePath}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) collectStrings(value[k], basePath ? `${basePath}.${k}` : k, out);
  }
}

/**
 * Scan a whole artifact object. Same result shape as scanText, but entries
 * carry the JSON path of the offending field instead of only a line number.
 */
function scanArtifact(obj, opts = {}) {
  const tenantLiterals = opts.tenantLiterals || loadTenantLiterals();
  const merged = { blocks: [], warnings: [], injectionFlags: [], piiWarnings: [] };
  const strings = [];
  collectStrings(obj, '', strings);

  for (const { path: p, text } of strings) {
    const r = scanText(text, { tenantLiterals });
    for (const key of Object.keys(merged)) {
      for (const entry of r[key]) merged[key].push({ ...entry, path: p });
    }
  }
  return merged;
}

module.exports = {
  scanText,
  scanArtifact,
  loadTenantLiterals,
  DANGEROUS_PS_PATTERNS,
  INJECTION_MARKERS,
};
