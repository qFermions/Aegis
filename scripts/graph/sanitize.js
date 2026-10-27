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

// ── PII patterns (WARN at the edge; placeholders exempt the line) ────────────
const PII_PATTERNS = [
  { pattern: /\b[A-Za-z0-9._%+-]+@(?!YOUR_DOMAIN|example-corp\.|vendor-example\.|example\.|github\.com|noreply\.github\.com)[a-z0-9.-]+\.(org|com|net)\b/g, label: 'Real email address (use [USER@DOMAIN.COM])' },
  { pattern: /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, label: 'Phone number pattern (use [PHONE_NUMBER])' },
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

// ── Prompt-injection markers (FLAG — data, never instructions) ───────────────
const INJECTION_MARKERS = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i, marker: 'ignore-previous-instructions' },
  { pattern: /disregard\s+(your|all|previous)\s+(rules|instructions|guidelines)/i, marker: 'disregard-rules' },
  { pattern: /\bnew\s+system\s+prompt\b/i, marker: 'system-prompt-override' },
  { pattern: /\byou\s+are\s+now\s+(in\s+)?(admin|developer|maintenance)\s+mode\b/i, marker: 'mode-override-claim' },
];

// Confusable folding for the injection-marker scan. A marker a model can read
// but this regex cannot see is an open instruction channel, so each line is
// matched as written AND in two folded forms: invisible format characters
// (zero-width space and joiners, soft hyphen, word joiner, BOM) removed, or
// turned into a space (a zero-width character used as the word separator);
// then NFKD (fullwidth and mathematical letters to ASCII), combining marks
// stripped, and the Latin look-alikes below mapped. Same method as the SR-2
// trigger scan in engine.js and the lane guard under scripts/tier (kept local:
// the edge sanitizer imports neither). Only marker matching uses the folded
// forms; the flag quotes the original line.
const MARKER_CONFUSABLES = {
  'ı': 'i', 'ſ': 's', 'ɡ': 'g', 'ɩ': 'i',
  'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ǫ': 'q', 'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z',
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'һ': 'h', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w',
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'Ѕ': 'S', 'І': 'I', 'Ј': 'J',
  'ο': 'o', 'ν': 'v', 'ρ': 'p', 'α': 'a', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'τ': 't', 'υ': 'u', 'χ': 'x', 'γ': 'y',
};

function foldForMarkers(line, formatCharAs) {
  return line.replace(/\p{Cf}/gu, formatCharAs).normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/[^\x00-\x7F]/g, (ch) => MARKER_CONFUSABLES[ch] || ch);
}

function markerForms(line) {
  return Array.from(new Set([line, foldForMarkers(line, ''), foldForMarkers(line, ' ')]));
}

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

function isPlaceholderLine(line) {
  return /\[.*\]/.test(line);
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
    const lower = line.toLowerCase();

    for (const literal of tenantLiterals) {
      if (literal && lower.includes(literal)) {
        result.blocks.push({ line: n, label: 'Tenant/org literal (SR-8) — use the [@Aegion_*] token', text: '[REDACTED — tenant literal on this line]' });
      }
    }
    for (const { pattern, label } of CREDENTIAL_PATTERNS) {
      if (pattern.test(line)) result.blocks.push({ line: n, label, text: '[REDACTED — credential pattern on this line]' });
    }
    for (const { pattern, label } of DANGEROUS_PS_PATTERNS) {
      if (pattern.test(line)) { result.warnings.push({ line: n, label, text: line.trim().slice(0, 100) }); break; }
    }
    if (!isPlaceholderLine(line)) {
      for (const { pattern, label } of PII_PATTERNS) {
        if (pattern.test(line)) result.piiWarnings.push({ line: n, label });
      }
    }
    const forms = markerForms(line);
    for (const { pattern, marker } of INJECTION_MARKERS) {
      if (forms.some((f) => pattern.test(f))) result.injectionFlags.push({ line: n, marker, quote: line.trim().slice(0, 160) });
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
