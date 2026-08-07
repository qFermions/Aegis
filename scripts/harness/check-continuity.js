#!/usr/bin/env node
// check-continuity.js — machine gate for the fresh-session continuity snapshot.
//
// Validates tasks/continuity.md so a brand-new session can trust it:
//   1. file exists and is UTF-8 readable (BOM/CRLF tolerated)
//   2. required sections present (## Identity, ## Repo ground truth,
//      ## Component state, ## Active work, ## Next actions, ## Verification)
//   3. freshness binding: "HEAD: <sha>" line must match `git rev-parse HEAD`
//      → mismatch exits 2 (STALE — refresh the snapshot), not 1
//   4. every backtick-quoted repo-relative path in the doc must exist on disk
//      (placeholder tokens like [@Aegion_*] / [UPN] are skipped)
//   5. size stays concise: warn > 6 KB, FAIL > 12 KB
//   6. SR-8 guard: if AEGION_DOMAIN is set in the env, the literal must not
//      appear in the snapshot (reported redacted, never echoed)
//
// Exit codes: 0 PASS · 1 structural FAIL · 2 STALE (HEAD moved since snapshot)
// Usage: node scripts/harness/check-continuity.js [path-to-snapshot]

'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const target = process.argv[2] || path.join(repoRoot, 'tasks', 'continuity.md');

const REQUIRED_SECTIONS = [
  '## Identity',
  '## Repo ground truth',
  '## Component state',
  '## Active work',
  '## Next actions',
  '## Verification',
];

let failures = 0;
let warnings = 0;
const fail = (msg) => { failures++; console.log(`FAIL  ${msg}`); };
const warn = (msg) => { warnings++; console.log(`WARN  ${msg}`); };
const pass = (msg) => { console.log(`PASS  ${msg}`); };

// 1. file exists
if (!fs.existsSync(target)) {
  fail(`snapshot not found: ${target}`);
  console.log(`\n0 passed, 1 failed — no snapshot to validate`);
  process.exit(1);
}
let raw = fs.readFileSync(target, 'utf8');
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // strip BOM
const text = raw.replace(/\r\n/g, '\n');
pass(`snapshot readable (${Buffer.byteLength(raw, 'utf8')} bytes)`);

// 2. required sections
for (const section of REQUIRED_SECTIONS) {
  const re = new RegExp(`^${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
  if (re.test(text)) pass(`section present: ${section}`);
  else fail(`missing section: ${section}`);
}

// 3. freshness binding to HEAD
let staleHead = false;
const headLine = text.match(/^HEAD:\s*([0-9a-f]{7,40})\s*$/m);
if (!headLine) {
  fail('no "HEAD: <sha>" line — snapshot is not bound to a commit');
} else {
  let liveHead = '';
  try {
    liveHead = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
  } catch (e) {
    warn('git rev-parse failed — HEAD binding not verifiable here');
  }
  if (liveHead) {
    if (liveHead.startsWith(headLine[1])) {
      pass(`HEAD binding current (${headLine[1].slice(0, 7)})`);
    } else {
      staleHead = true;
      console.log(`STALE HEAD in snapshot ${headLine[1].slice(0, 7)} != live ${liveHead.slice(0, 7)} — refresh the snapshot`);
    }
  }
}
if (!/^Snapshot-Date:\s*\d{4}-\d{2}-\d{2}\s*$/m.test(text)) {
  fail('no "Snapshot-Date: YYYY-MM-DD" line');
} else {
  pass('Snapshot-Date present');
}

// 4. every backticked repo-relative path must exist
const candidates = [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
let pathsChecked = 0;
let pathsMissing = 0;
for (const c of candidates) {
  // only path-shaped tokens: no spaces, no placeholders, no URLs/commands/flags
  if (/[\s]/.test(c)) continue;
  if (c.includes('[') || c.includes(']')) continue; // placeholder tokens
  if (/^(https?:|--|-[a-z])/i.test(c)) continue;
  if (!/[\\/]/.test(c) && !/\.(md|js|ps1|json|bat|yml|yaml|txt)$/i.test(c)) continue;
  if (/^[A-Za-z]:[\\/]/.test(c) || c.startsWith('~')) continue; // absolute/home paths: out of repo scope
  const rel = c.replace(/[\\/]+$/, '');
  pathsChecked++;
  if (fs.existsSync(path.join(repoRoot, rel))) continue;
  pathsMissing++;
  fail(`referenced path missing on disk: ${c}`);
}
if (pathsMissing === 0) pass(`all ${pathsChecked} referenced repo paths exist`);

// 5. concise-size guard
const bytes = Buffer.byteLength(raw, 'utf8');
if (bytes > 12 * 1024) fail(`snapshot too large (${bytes} bytes > 12288) — continuity must stay concise`);
else if (bytes > 6 * 1024) warn(`snapshot getting large (${bytes} bytes > 6144) — consider trimming`);

// 6. SR-8 tenant-literal guard (never echo the literal)
const literal = process.env.AEGION_DOMAIN;
if (literal && literal.length > 3) {
  if (text.toLowerCase().includes(literal.toLowerCase())) {
    fail('SR-8 violation: tenant literal present in snapshot (redacted)');
  } else {
    pass('SR-8 tenant-literal scan clean');
  }
}

console.log('');
if (failures > 0) {
  console.log(`RESULT: FAIL — ${failures} failure(s), ${warnings} warning(s)`);
  process.exit(1);
}
if (staleHead) {
  console.log(`RESULT: STALE — structure OK but HEAD moved; refresh the snapshot (${warnings} warning(s))`);
  process.exit(2);
}
console.log(`RESULT: PASS — ${warnings} warning(s)`);
process.exit(0);
