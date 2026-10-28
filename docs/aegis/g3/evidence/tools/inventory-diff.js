'use strict';
// inventory-diff.js <base>: docs/security/STATE_CHANGE_INVENTORY.json at <base> (git show)
// against the checkout. Prints the examples added (per file and mode), removed, any entry
// whose mode changed, the fields that changed on the rest, and the client boundaries.
// Run from the repository root: node docs/aegis/g3/evidence/tools/inventory-diff.js f185071
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const FILE = 'docs/security/STATE_CHANGE_INVENTORY.json';
const base = process.argv[2];
if (!/^[0-9a-f]{7,40}$/.test(base || '')) { console.error('usage: inventory-diff.js <base commit>'); process.exit(1); }
const before = JSON.parse(execFileSync('git', ['show', `${base}:${FILE}`], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const after = JSON.parse(fs.readFileSync(FILE, 'utf8'));

function compare(list) {
  const id = (e) => `${e.file}:${e.id || e.line}`;
  const a = new Map(before[list].map((e) => [id(e), e]));
  const b = new Map(after[list].map((e) => [id(e), e]));
  const added = [...b.keys()].filter((k) => !a.has(k)).map((k) => b.get(k));
  const removed = [...a.keys()].filter((k) => !b.has(k));
  const modeChanged = [...a.keys()].filter((k) => b.has(k) && a.get(k).mode !== b.get(k).mode)
    .map((k) => `${k}: ${a.get(k).mode} -> ${b.get(k).mode}`);
  const fields = {};
  for (const k of a.keys()) {
    if (!b.has(k)) continue;
    for (const f of new Set([...Object.keys(a.get(k)), ...Object.keys(b.get(k))])) {
      if (JSON.stringify(a.get(k)[f]) !== JSON.stringify(b.get(k)[f])) fields[f] = (fields[f] || 0) + 1;
    }
  }
  console.log(`${list}: ${a.size} at ${base}, ${b.size} now; added ${added.length}, removed ${removed.length}, mode changed ${modeChanged.length}`);
  const byFile = {};
  for (const e of added) byFile[e.file] = { ...(byFile[e.file] || {}), [e.mode]: ((byFile[e.file] || {})[e.mode] || 0) + 1 };
  for (const [file, modes] of Object.entries(byFile)) console.log(`  added in ${file}: ${Object.entries(modes).map(([m, n]) => `${m} ${n}`).join(', ')}`);
  const byMode = {};
  for (const e of added) byMode[e.mode] = (byMode[e.mode] || 0) + 1;
  console.log(`  added by mode: ${JSON.stringify(byMode)}`);
  for (const r of removed) console.log(`  removed: ${r}`);
  for (const m of modeChanged) console.log(`  mode changed: ${m}`);
  console.log(`  entries present at both with another field changed: ${JSON.stringify(fields)}`);
}
compare('examples');
compare('clientBoundaries');
