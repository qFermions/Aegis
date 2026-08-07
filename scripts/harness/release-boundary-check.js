#!/usr/bin/env node
'use strict';
// release-boundary-check.js — structural release/sync boundary (ADR-006).
//
// Makes it mechanically difficult for non-Aegis material (separate products,
// venture files, client snapshots, personal scripts, trading/Hermes material)
// or secret-injection patterns to ride into a sync commit or release.
//
// Checks:
//   B1  every forbidden path is untracked (git ls-files finds nothing)
//   B2  every forbidden path present on disk is covered by .gitignore
//   B3  nothing in git status (staged or not) falls under a forbidden prefix
//   B4  private stores (memory/, tasks/graph-runs/) are git-ignored
//   B5  .github/workflows/*.yml contain no `secrets.` reference — the public
//       release gate is pattern-only by design (F1, ADR-006)
//
// Exit 0 = boundary intact. Exit 1 = BLOCK with reasons. Read-only.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// Non-Aegis material. Keep in sync with the "Release/sync boundary" block in
// .gitignore — B2 fails loudly if the two drift. In a tree WITHOUT that block
// (the public release has no private material to deny), B1–B3 run with an
// empty list and the generic checks B4–B6 carry the boundary.
const BOUNDARY_MARKER = 'Release/sync boundary';
const PRIVATE_FORBIDDEN = [
  'AegisGameSwitch',
  'Aegis',
  'identity-lifecycle-factory',
  'tasks/checkpoints/2026-07-12-codex-semahtech',
  'tasks/aegisco-lab',
  'tasks/aegisco-site',
  'tasks/aegisco-deploy-notes.md',
  'scripts/Aegis-GamingPrep.ps1',
  'scripts/Aegis-AdminBundle.ps1',
  'docs/handoff',
  'hermes-escalation-log.md',
];

const PRIVATE_STORES = ['memory', 'tasks/graph-runs'];

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

const giText = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
const FORBIDDEN = giText.includes(BOUNDARY_MARKER) ? PRIVATE_FORBIDDEN : [];

const failures = [];

// B1 — forbidden paths must not be tracked
for (const p of FORBIDDEN) {
  const tracked = git(['ls-files', '--', p]).trim();
  if (tracked) {
    failures.push(`B1 TRACKED: ${p} has tracked files:\n    ${tracked.split('\n').slice(0, 5).join('\n    ')}`);
  }
}

// B2 — forbidden paths on disk must be ignored, and the .gitignore boundary
// block must not drift from this list (checked textually, so a removed
// .gitignore line is caught even while the path is absent from disk).
for (const p of FORBIDDEN) {
  if (!giText.includes('/' + p)) {
    failures.push(`B2 DRIFT: ${p} is in FORBIDDEN but has no /${p} entry in .gitignore`);
  }
  if (!fs.existsSync(path.join(ROOT, p))) continue;
  try {
    git(['check-ignore', '-q', '--', p]);
  } catch {
    failures.push(`B2 NOT IGNORED: ${p} exists on disk but git does not ignore it`);
  }
}

// B3 — nothing in status under a forbidden prefix. Pure deletions are allowed
// (removing forbidden material is the boundary being established); renames are
// checked on BOTH sides so a rename INTO a forbidden path cannot slip through.
const status = git(['status', '--porcelain']).split('\n').filter(Boolean);
for (const line of status) {
  const code = line.slice(0, 2);
  const pureDelete = /^[D ]{2}$/.test(code) && code.includes('D');
  if (pureDelete) continue;
  const rest = line.slice(3).replace(/"/g, '');
  const parts = rest.includes(' -> ') ? rest.split(' -> ') : [rest];
  for (const file of parts) {
    if (FORBIDDEN.some((p) => file === p || file.startsWith(p + '/'))) {
      failures.push(`B3 IN STATUS: ${line.trim()} falls inside the release boundary`);
    }
  }
}

// B4 — private stores stay ignored
for (const p of PRIVATE_STORES) {
  if (!fs.existsSync(path.join(ROOT, p))) continue;
  try {
    git(['check-ignore', '-q', '--', p]);
  } catch {
    failures.push(`B4 PRIVATE STORE EXPOSED: ${p} is not git-ignored`);
  }
}

// B6 — deny-by-default for NEW top-level material: every top-level entry must
// be tracked (an established Aegis area), git-ignored, or explicitly allowed.
// A brand-new venture/client/product directory is none of those → BLOCK until
// the operator classifies it (track it, ignore it, or move it out).
const ALLOWED_TOP = new Set(['.git', '.github', 'EVALUATE.md']);
for (const entry of fs.readdirSync(ROOT)) {
  if (ALLOWED_TOP.has(entry)) continue;
  if (git(['ls-files', '--', entry]).trim()) continue; // established tracked area
  let ignored = true;
  try { git(['check-ignore', '-q', '--', entry]); } catch { ignored = false; }
  if (!ignored) {
    failures.push(`B6 UNCLASSIFIED: top-level "${entry}" is neither tracked, ignored, nor allowlisted — classify it before any sync`);
  }
}

// B5 — workflows must not inject secrets (public CI is pattern-only; F1)
const wfDir = path.join(ROOT, '.github', 'workflows');
if (fs.existsSync(wfDir)) {
  for (const f of fs.readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f))) {
    const body = fs.readFileSync(path.join(wfDir, f), 'utf8');
    if (/\bsecrets\./.test(body)) {
      failures.push(`B5 SECRET INJECTION: .github/workflows/${f} references secrets.* — release CI is pattern-only by design`);
    }
  }
}

if (failures.length) {
  console.error('RELEASE BOUNDARY: BLOCK');
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`RELEASE BOUNDARY: PASS — ${FORBIDDEN.length} boundary paths clean, private stores ignored, workflows secret-free`);
process.exit(0);
