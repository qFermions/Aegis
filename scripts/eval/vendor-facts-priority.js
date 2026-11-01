#!/usr/bin/env node
'use strict';
// vendor-facts-priority.js: orders the unconfirmed vendor facts by the risk of the runbook gates
// that rest on them, so the owner checks the facts behind R3 gates first (readiness row 11,
// docs/aegis/production-readiness.md). Reads local files only; no network, no credential.
//
//   node scripts/eval/vendor-facts-priority.js            writes docs/aegis/owner/vendor-facts-priority.md
//   node scripts/eval/vendor-facts-priority.js --check    exit 0 when that file equals a fresh run, 1 when not
//
// What counts as an unconfirmed fact (the two lists the owner works from):
//   - docs/aegis/g3/vendor-facts-to-check.md: every row of its table. The page lists only facts
//     the vendor's own documentation did not confirm. The ID cell holds one fact id (S-09), several
//     (G-34, G-35), or a label (A10 note); a row is one fact with all its ids. Its page to check
//     against is the first URL on the id's own line in docs/aegis/g3/vendor-facts.md ("same URL"
//     means the nearest fact line above it that names one); a line with no URL says so.
//   - docs/aegis/g2/vendor-facts-to-check.md: every row of each platform table ("## Fleet (37
//     lines)" and so on, up to "## How this list was made"). Each row is a runbook or adapter line
//     that rests on a search excerpt or a vendor repository read, not on the live vendor page, so
//     each is unconfirmed. The list gives no fact id, so its id is the place it names, file:line,
//     with #k when one line holds several rows. Its page to check against is the row's breadcrumb,
//     command or API path cell (for a Sources line, the source before the colon).
//
// How a fact is tied to a gate:
//   - A gate's section starts at its marker (the HTML comment form of a portal gate, or the
//     comment form inside a bash or PowerShell fence) and runs to the line before the next gate
//     marker or the next Markdown heading outside a code fence, or to the end of the runbook.
//   - A G3 fact rests on a gate when one of its ids is cited inside that gate's section.
//   - A G2 fact rests on a gate when its line lies inside that gate's section. The G2 list was made
//     at the G2 branch head and its line numbers have moved since, so the line is found again by
//     its text: the list's own extraction (the Python in the G2 page) is run here on the current
//     runbook, and the row is the current line whose extracted cell equals the listed cell, nearest
//     the listed line number. A row whose text no longer appears is reported as not found and
//     rests on no gate; a row in a script, not a runbook, rests on no gate.
//   - A gate's R class is the highest of R0 to R3 named on its Reversibility line ("R1 to R3 by
//     script content" is R3), the safer reading for an order of work.
//   - A fact's class is the highest class among its gates. Facts behind an R3 gate come first,
//     then R2, then the rest (behind R1 or R0 gates only, then facts no gate rests on). Inside a
//     group the G3 facts come first in their page's order, then the G2 rows in theirs.
//
// The output quotes no gate or preview marker as written: like the G2 list, it rewrites them as
// "(gate ... in the runbook)", so this page adds no region to the state-change inventory.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT = 'docs/aegis/owner/vendor-facts-priority.md';
const COMMAND = 'node scripts/eval/vendor-facts-priority.js';
const DEFAULTS = Object.freeze({
  root: ROOT,
  g2: 'docs/aegis/g2/vendor-facts-to-check.md',
  g3: 'docs/aegis/g3/vendor-facts-to-check.md',
  facts: 'docs/aegis/g3/vendor-facts.md',
  runbookDir: '.claude/commands',
  runbookExt: '.md',
});

const FACT_ID = /^[A-Z]-\d{2}$/;
const GATE_MARKER = /^\s*(?:<!--\s*SAFETY GATE \[([a-z0-9-]+)\]\s*-->|#\s*SAFETY GATE \[([a-z0-9-]+)\])\s*$/i;
const FENCE = /^\s*(```|~~~)/;
const HEADING = /^#{1,6}\s/;
const REVERSIBILITY = /Reversibility:/;
const CLASS_ORDER = ['R3', 'R2', 'R1', 'R0'];
const RANK = { R3: 3, R2: 2, R1: 1, R0: 0 };

const readText = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const codePoints = (s, n) => Array.from(s).slice(0, n).join('');
const escapeCell = (s) => s.replace(/(?<!\\)\|/g, '\\|');

// The G2 list's neutral(): a gate or preview marker copied into a page would read as a new region.
function neutral(t) {
  let s = t.replace(/\*\*PREVIEW ONLY \[([\w-]+)\]:\*\*/g, '(preview region $1 in the runbook):');
  s = s.replace(/PREVIEW ONLY \[([\w-]+)\]/g, '(preview region $1 in the runbook)');
  s = s.replace(/SAFETY GATE \[([\w-]+)\]/g, '(gate $1 in the runbook)');
  return s.replace(/^>\s*/, '');
}
// What this page adds on top: a portal action label and the long dash are rewritten too.
const clean = (t) => neutral(t).replace(/PORTAL ACTION \[([\w-]+)\]/g, '(portal action $1 in the runbook)').replace(/\u2014/g, '--');

// ── The G3 list ─────────────────────────────────────────────────────────────
function parseG3(text) {
  const facts = [];
  let inTable = false;
  for (const line of text.split('\n')) {
    if (/^\| ID \|/.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (/^\|---/.test(line)) continue;
    if (!line.startsWith('|')) { if (facts.length) break; continue; }
    const cells = splitRow(line);
    if (cells.length < 4) continue;
    const ids = cells[0].split(/,\s*/).map((s) => s.trim()).filter((s) => FACT_ID.test(s));
    facts.push({ source: 'g3', id: cells[0], ids, fact: cells[1], meanwhile: cells[2], where: cells[3] });
  }
  return facts;
}

// A table row's cells, keeping an escaped pipe inside a cell.
function splitRow(line) {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cur = '';
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] === '\\' && inner[i + 1] === '|') { cur += '\\|'; i += 1; continue; }
    if (inner[i] === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += inner[i];
  }
  cells.push(cur.trim());
  return cells;
}

// The page to check each G3 id against: the first URL on its line in vendor-facts.md.
function factPages(text) {
  const pages = new Map();
  let last = null;
  for (const line of text.split('\n')) {
    if (/^#{1,3}\s/.test(line)) last = null;
    const m = /^- ([A-Z]-\d{2})\.\s/.exec(line);
    if (!m) continue;
    const url = /\|\s*(https?:\/\/[^\s|]+)/.exec(line);
    if (url) last = url[1];
    const same = /\|\s*same URL\s*\|/.test(line);
    pages.set(m[1], url ? url[1] : (same ? last : null));
  }
  return pages;
}

// ── The G2 list ─────────────────────────────────────────────────────────────
const G2_ROW = /^\| `([^`]+):(\d+)` \| (search excerpt and vendor repository|search excerpt|vendor repository) \| (.*) \|$/;

function parseG2(text) {
  const rows = [];
  let platform = null;
  for (const line of text.split('\n')) {
    const h = /^## (.+?) \(\d+ lines\)$/.exec(line);
    if (h) { platform = h[1]; continue; }
    if (/^## /.test(line)) { platform = null; continue; }
    if (!platform) continue;
    const m = G2_ROW.exec(line);
    if (!m) continue;
    rows.push({ source: 'g2', platform, file: m[1], line: Number(m[2]), how: m[3], cell: m[4] });
  }
  const seen = new Map();
  const total = new Map();
  for (const r of rows) total.set(`${r.file}:${r.line}`, (total.get(`${r.file}:${r.line}`) || 0) + 1);
  for (const r of rows) {
    const key = `${r.file}:${r.line}`;
    const k = (seen.get(key) || 0) + 1;
    seen.set(key, k);
    r.id = `${path.basename(r.file)}:${r.line}${total.get(key) > 1 ? `#${k}` : ''}`;
  }
  return rows;
}

// The G2 page's own extraction (its Python, line for line), run on a current file: the cells each
// line yields, so a listed row can be found again after its line number moved.
const MARK = /search excerpt|vendor repo(?:sitory)?|raw\.githubusercontent\.com/i;
const W = String.raw`[\p{L}\p{N}_&/ -]`;
const CRUMB = new RegExp(String.raw`((?:[A-Z]${W}{1,40} → ){1,8}${W}{1,60})`, 'gu');
function extractCells(text) {
  const out = [];
  text.split('\n').forEach((line, index) => {
    const n = index + 1;
    if (!MARK.test(line)) return;
    if (line.trimStart().startsWith('**Sources') || line.includes(' · ')) {
      const body = line.trim().replace(/^\s*\*\*Sources[^*]*\*\*:?\s*/, '');
      for (const entry of body.split(' · ').map((e) => e.trim()).filter(Boolean)) {
        if (!MARK.test(entry) && !entry.includes('raw.githubusercontent')) continue;
        const m = /^(\S+)\s*\((.*)\)\.?\s*(.*)$/.exec(entry);
        const src = m ? m[1] : codePoints(entry, 80);
        let facts = m ? m[2] : entry;
        facts = facts.replace(/^(?:vendor repo(?:sitory)?|search excerpt)[,:]?\s*/i, '');
        out.push({ line: n, src, facts, cell: neutral(codePoints(`${src}: ${facts}`, 300)).replace(/\|/g, '\\|').replace(/\u2014/g, '--'), sources: true });
      }
      return;
    }
    const ticks = [...line.matchAll(/`([^`]{3,120})`/g)].map((x) => x[1]).filter((x) => !x.startsWith('node scripts/') && x !== '--execute');
    const crumbs = [...line.matchAll(CRUMB)].map((x) => x[1]);
    const joined = codePoints([...new Set([...crumbs, ...ticks])].join('; '), 300);
    out.push({ line: n, cell: neutral(joined || codePoints(line.trim(), 200)).replace(/\|/g, '\\|').replace(/\u2014/g, '--'), sources: false });
  });
  return out;
}

function locateG2(row, runbookText) {
  const hits = extractCells(runbookText).filter((c) => c.cell === row.cell);
  if (!hits.length) return null;
  hits.sort((a, b) => Math.abs(a.line - row.line) - Math.abs(b.line - row.line) || a.line - b.line);
  return hits[0];
}

// ── Runbook gates ───────────────────────────────────────────────────────────
function parseGates(runbook, text) {
  const lines = text.split('\n');
  const gates = [];
  let fence = null;
  let open = null;
  const close = (end) => { if (open) { open.end = end; gates.push(open); open = null; } };
  lines.forEach((line, index) => {
    const n = index + 1;
    const marker = GATE_MARKER.exec(line);
    if (marker) {
      close(n - 1);
      open = { id: marker[1] || marker[2], runbook, start: n, end: lines.length, rclass: null };
    } else if (!fence && HEADING.test(line)) {
      close(n - 1);
    }
    const f = FENCE.exec(line);
    if (f) fence = fence === null ? f[1] : (fence === f[1] ? null : fence);
    if (open && open.rclass === null && REVERSIBILITY.test(line)) {
      const found = [...line.matchAll(/\bR([0-3])\b/g)].map((x) => Number(x[1]));
      if (found.length) open.rclass = `R${Math.max(...found)}`;
    }
  });
  close(lines.length);
  for (const g of gates) g.text = lines.slice(g.start - 1, g.end).join('\n');
  return gates;
}

const cites = (text, id) => new RegExp(`(?<![A-Za-z0-9-])${id}(?![0-9])`).test(text);

// ── Build and render ────────────────────────────────────────────────────────
function build(options = {}) {
  const o = { ...DEFAULTS, ...options };
  const at = (rel) => path.join(o.root, rel);
  const g3 = parseG3(readText(at(o.g3)));
  const pages = factPages(readText(at(o.facts)));
  const g2 = parseG2(readText(at(o.g2)));
  const runbooks = fs.readdirSync(at(o.runbookDir)).filter((f) => f.endsWith(o.runbookExt)).sort()
    .map((f) => path.posix.join(o.runbookDir.split(path.sep).join('/'), f));
  const texts = new Map(runbooks.map((rel) => [rel, readText(at(rel))]));
  const gates = runbooks.flatMap((rel) => parseGates(path.basename(rel), texts.get(rel)));

  const facts = [];
  g3.forEach((f, order) => {
    const ids = f.ids;
    const on = ids.length ? gates.filter((g) => ids.some((id) => cites(g.text, id))) : [];
    const page = ids.map((id) => pages.get(id)).find(Boolean) || null;
    facts.push({
      source: 'g3', order, id: f.id, short: clean(f.fact), gates: on,
      check: page || 'vendor console: the fact line names no page', where: clean(f.where),
    });
  });
  g2.forEach((r, order) => {
    const isRunbook = texts.has(r.file);
    const hit = isRunbook ? locateG2(r, texts.get(r.file)) : null;
    let on = [];
    let status;
    if (!isRunbook) status = 'in a script, not a runbook';
    else if (!hit) status = 'line not found in the current runbook';
    else {
      status = `now line ${hit.line}`;
      on = gates.filter((g) => g.runbook === path.basename(r.file) && g.start <= hit.line && hit.line <= g.end);
    }
    let short;
    let check = r.cell;
    if (hit && hit.sources) { short = hit.facts; check = hit.src; } else if (hit) {
      short = texts.get(r.file).split('\n')[hit.line - 1].trim();
    } else short = r.cell;
    short = clean(short).replace(/\s+/g, ' ');
    if (Array.from(short).length > 160) short = `${codePoints(short, 157)}...`;
    facts.push({ source: 'g2', order, id: r.id, platform: r.platform, how: r.how, status, short, gates: on, check: clean(check) });
  });

  for (const f of facts) {
    f.gates.sort((a, b) => (RANK[b.rclass] ?? -1) - (RANK[a.rclass] ?? -1) || a.runbook.localeCompare(b.runbook) || a.start - b.start);
    const top = f.gates.reduce((best, g) => Math.max(best, RANK[g.rclass] ?? -1), -1);
    f.group = top === 3 ? 'R3' : top === 2 ? 'R2' : f.gates.length ? 'low' : 'none';
  }
  const groupRank = { R3: 0, R2: 1, low: 2, none: 3 };
  facts.sort((a, b) => groupRank[a.group] - groupRank[b.group] || (a.source === b.source ? 0 : a.source === 'g3' ? -1 : 1) || a.order - b.order);
  return { facts, gates: gates.length, runbooks: runbooks.length, options: o };
}

function render(result) {
  const { facts, options: o } = result;
  const count = (g) => facts.filter((f) => f.group === g).length;
  const g2 = facts.filter((f) => f.source === 'g2');
  const notFound = g2.filter((f) => f.status.startsWith('line not found')).length;
  const inScript = g2.filter((f) => f.status.startsWith('in a script')).length;
  const gateCell = (f) => (f.gates.length ? f.gates.map((g) => `${g.id} (${g.runbook}, ${g.rclass || 'no class'})`).join('; ') : 'none');
  const row = (f) => (f.source === 'g3'
    ? `| ${escapeCell(f.id)} | G3 list, matters in ${escapeCell(f.where)} | ${escapeCell(f.short)} | ${gateCell(f)} | ${escapeCell(f.check)} |`
    : `| ${escapeCell(f.id)} | G2 list, ${f.platform}, ${f.status} | ${escapeCell(f.short)} | ${gateCell(f)} | ${escapeCell(f.check)} |`);
  const table = (list) => (list.length
    ? ['| Fact | From | The fact in short | Gates that rest on it (runbook, class) | Check it against |', '|---|---|---|---|---|', ...list.map(row)]
    : ['None.']);
  const lines = [
    '# Vendor facts to check first (readiness row 11)',
    '',
    `Generated by \`${COMMAND}\` from \`${o.g3}\`, \`${o.g2}\`, \`${o.facts}\` and the ${result.runbooks} runbooks in \`${o.runbookDir}/\` (${result.gates} gates). Do not edit it by hand: change a source and run the command again. \`${COMMAND} --check\` exits 1 when this page differs from a fresh run.`,
    '',
    'Each row is a vendor fact that the vendor\'s own documentation did not confirm, with the runbook gates that rest on it. Check the facts behind R3 gates first, then R2, then the rest, against the page in the last column or the vendor console, and correct the runbook or connector when the vendor says otherwise. The rules (what counts as unconfirmed, how a fact is tied to a gate, how a gate\'s class is read) are in the script\'s header.',
    '',
    `Counts: ${facts.length} facts. ${count('R3')} behind an R3 gate, ${count('R2')} behind an R2 gate and none higher, ${count('low')} behind R1 or R0 gates only, ${count('none')} that no gate rests on. Of the ${g2.length} G2 rows, ${inScript} are in a script rather than a runbook and ${notFound} are no longer found in their runbook${notFound ? ' (their text changed since the G2 list was made; regenerate that list to place them)' : ''}.`,
    '',
    `## 1. Facts behind an R3 gate (${count('R3')})`,
    '',
    ...table(facts.filter((f) => f.group === 'R3')),
    '',
    `## 2. Facts behind an R2 gate (${count('R2')})`,
    '',
    ...table(facts.filter((f) => f.group === 'R2')),
    '',
    `## 3. Facts behind R1 or R0 gates only (${count('low')})`,
    '',
    ...table(facts.filter((f) => f.group === 'low')),
    '',
    `## 4. Facts no gate rests on (${count('none')})`,
    '',
    'These still matter where the G3 list says (a connector, a preflight, the contract) or on the runbook line named; they come last because no human-run change waits on them.',
    '',
    ...table(facts.filter((f) => f.group === 'none')),
    '',
  ];
  return lines.join('\n');
}

function generate(options = {}) { return render(build(options)); }

// options: the input paths (DEFAULTS) and output, the page to write or check, relative to root;
// the tests pass fixture paths here.
function main(argv, options = {}, out = (s) => process.stdout.write(s)) {
  const check = argv.includes('--check');
  const unknown = argv.filter((a) => a !== '--check');
  if (unknown.length) { process.stderr.write(`Usage: ${COMMAND} [--check]\n`); return 1; }
  const o = { ...DEFAULTS, output: OUTPUT, ...options };
  const fresh = generate(o);
  const target = path.resolve(o.root, o.output);
  if (check) {
    let current = null;
    try { current = readText(target); } catch { current = null; }
    if (current === fresh) { out(`${o.output} is current.\n`); return 0; }
    out(`${o.output} differs from a fresh run. Run: ${COMMAND}\n`);
    return 1;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fresh);
  out(`Wrote ${o.output}.\n`);
  return 0;
}

module.exports = { parseG3, parseG2, factPages, extractCells, locateG2, parseGates, build, render, generate, main, neutral, splitRow, OUTPUT, DEFAULTS };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
