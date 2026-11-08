'use strict';
// step-ladder.js: the desk check "lightest step first" (batch 9, task 8c; batch 10, task 1). It reads the
// gates in the answer's closing aegis-desk block and the runbooks that hold them, with the ladder lint's own
// section reader (scripts/lint/ladder-audit.js). It fails in three cases:
//   1. the first gate is heavy (R3, or a reset, wipe, erase, delete or re-register) and its section lists a
//      lighter admin step before it (a lighter SAFETY GATE, or a PREVIEW ONLY marker for a lighter action)
//      that the answer did not advise first (batch 9);
//   2. the block holds a gate of a higher reversibility class (R2 or R3) together with a lighter gate that its
//      runbook names as the rung below it for the same symptom (batch 10): on a "Try first:" or "Lighter step:"
//      line in the heavier gate's section, by gate id or by the phase that holds it, or on a fallback line
//      ("Last resort", "only when the steps above did not ...", "if it still ...") that names the heavier gate
//      after the lighter gate's marker in one section;
//   3. a gate in the block is named, outside the block, on a line that calls it a last resort or a step for
//      when an earlier change did not work, and the block holds another gate: two rungs in one block (batch 10).
// The block lists only the gates to run now; a user check is not an admin change, so "if it still loops"
// after a user check, with its one gate in the block, passes. A row on the page; it never stops a ticket.

const fs = require('node:fs');

const { namedGates, closingGateLines } = require('./catalog.js');
const { sectionEvents, lighterBefore } = require('../lint/ladder-audit.js');

const row = (ok, detail) => ({ check: 'lightest-step-first', verdict: ok ? 'pass' : 'fail', plain: 'The first change is the lightest one the runbook offers, and the block holds one rung', detail });

const RANK = Object.freeze({ R0: 0, R1: 1, R2: 2, R3: 3 });
// A gate and its scripted or console twin are one rung: the same id without its -portal, -api, -cli or -script end.
const stem = (id) => id.replace(/-(?:portal|api|cli|script|ps)$/, '');
// A line that holds a step for when an earlier one did not work.
const FALLBACK = /\blast resort\b|\bonly (?:if|when)\b[^.]*?\b(?:not|didn['\u2019]t|doesn['\u2019]t|fails?|failed)\b|\bif (?:it|that|this|they|the [a-z]+(?: [a-z]+)?) (?:still|keeps?|continues?|persists?)\b|\bif (?:that|this|it|step \d+) (?:fails?|failed|did not|didn['\u2019]t|does not|doesn['\u2019]t)\b|\bif\b[^.:]{0,60}?\b(?:did not|didn['\u2019]t|does not|doesn['\u2019]t) (?:work|help|fix|stop|clear|solve)\b|\botherwise\b/i;
const TRY_LINE = /\*\*(?:Try first|Lighter step)\b[^*]*:\*\*/i;
const ID_MENTION = /(?:\[|`)([a-z0-9]+(?:-[a-z0-9]+)+)(?:\]|`)/g;
const ANY_ID = /(?<![A-Za-z0-9-])[a-z0-9]+(?:-[a-z0-9]+)+(?![A-Za-z0-9-])/g;
const HEADING = /^#{1,6}\s+\S/;
const MARK = /SAFETY GATE \[([a-z0-9][a-z0-9-]*)\]/;

// The rungs one runbook ties together, as "lighter stem>heavier stem" pairs, from its own ladder lines only:
// a section's order alone does not make two gates rungs, since a checklist (an offboarding, "revoke the
// sessions, then remove the method") lists steps that all run now. shortcut: a ladder line read here names
// its rung by gate id or by "Phase X"; a rung named only in words ("lock the Mac first") pairs nothing.
function runbookPairs(text, gates) {
  const sections = [];
  let cur = { title: '', items: [] };
  let fenced = false;
  for (const l of String(text).split('\n')) {
    if (/^\s*```/.test(l)) { fenced = !fenced; continue; }
    const mark = MARK.exec(l);
    if (!fenced && !mark && HEADING.test(l)) { sections.push(cur); cur = { title: l.replace(/^#+\s+/, '').trim(), items: [] }; continue; }
    if (mark) { cur.items.push({ kind: 'gate', id: mark[1] }); continue; }
    if (fenced) continue;
    const ids = [...l.matchAll(ID_MENTION)].map((m) => m[1]).filter((id) => gates.has(id));
    if (TRY_LINE.test(l)) cur.items.push({ kind: 'try', ids, phases: [...l.matchAll(/\bPhase ([A-Z0-9])\b/g)].map((m) => m[1]) });
    else if (FALLBACK.test(l) && ids.length) cur.items.push({ kind: 'fallback', ids });
  }
  sections.push(cur);
  const phaseGates = (p) => sections.filter((s) => new RegExp(`^Phase ${p}\\b`).test(s.title)).flatMap((s) => s.items.filter((x) => x.kind === 'gate').map((x) => x.id));
  const pairs = new Set();
  for (const s of sections) {
    s.items.forEach((item, k) => {
      if (item.kind === 'try') {
        const lighter = [...item.ids, ...item.phases.flatMap(phaseGates)];
        for (const h of s.items.slice(k + 1).filter((x) => x.kind === 'gate')) for (const l of lighter) pairs.add(`${stem(l)}>${stem(h.id)}`);
      }
      if (item.kind === 'fallback') {
        for (const l of s.items.slice(0, k).filter((x) => x.kind === 'gate')) for (const h of item.ids) pairs.add(`${stem(l.id)}>${stem(h)}`);
      }
    });
  }
  return pairs;
}

// Case 2: the first two gates of the block that the runbook names as a lighter rung and the heavier one above it.
function twoClasses(names, gates) {
  const pairsOf = new Map();
  for (const h of names) {
    const H = gates.get(h);
    if (!H || H.kind !== 'gate' || !['R2', 'R3'].includes(H.rClass)) continue;
    if (!pairsOf.has(H.file)) {
      let text = '';
      try { text = fs.readFileSync(H.file, 'utf8'); } catch { /* an unreadable runbook pairs nothing */ }
      pairsOf.set(H.file, runbookPairs(text, gates));
    }
    for (const l of names) {
      const L = gates.get(l);
      if (l === h || !L || L.kind !== 'gate' || L.file !== H.file || !(RANK[L.rClass] < RANK[H.rClass])) continue;
      if (pairsOf.get(H.file).has(`${stem(l)}>${stem(h)}`)) return { lighter: l, heavier: h, L, H };
    }
  }
  return null;
}

// Case 3: a gate in the block that a line outside the block names as a later step, while the block holds another.
function laterRung(answer, names) {
  const body = closingGateLines(answer).body.split(/\r?\n/);
  for (const g of names) {
    if (!names.some((o) => stem(o) !== stem(g))) continue;
    const line = body.find((l) => FALLBACK.test(l) && [...l.matchAll(ANY_ID)].some((m) => stem(m[0]) === stem(g)));
    if (line) return { gate: g, line: line.trim() };
  }
  return null;
}

// Case 1 (batch 9): { ok, detail } for the first gate of the block.
function firstGateCheck(first, gates) {
  const entry = gates.get(first);
  if (!entry || entry.kind !== 'gate') return { ok: true, detail: `the first change, ${first}, is not a SAFETY GATE the runbooks hold` };
  let sections;
  try { sections = sectionEvents(fs.readFileSync(entry.file, 'utf8'), entry.command); } catch { return { ok: true, detail: `the runbook holding ${first} could not be read` }; }
  const section = sections.find((s) => s.events.some((e) => e.id === first && e.kind === 'heavy'));
  if (!section) return { ok: true, detail: `the first change, ${first}, is not a reset, wipe, erase, delete, re-register or R3 change` };
  const at = section.events.findIndex((e) => e.id === first);
  const lighter = lighterBefore(section, at).filter((e) => e.admin).map((e) => e.id);
  if (!lighter.length) return { ok: true, detail: `${first} is heavy, and its runbook section lists no lighter admin step before it` };
  return { ok: false, detail: `the first change is ${first}, a heavy one, while its runbook section "${section.title}" lists ${lighter.join(', ')} first` };
}

// gates: the desk's catalog (catalog.js): id to { kind, file, rClass, ... }.
function lightestStepFirst(answer, gates) {
  const names = namedGates(answer);
  if (!names.length) return row(true, 'no change advised');
  const first = firstGateCheck(names[0], gates);
  if (!first.ok) return row(false, first.detail);
  const pair = twoClasses(names, gates);
  if (pair) return row(false, `the block holds ${pair.heavier} (${pair.H.rClass}) and ${pair.lighter} (${pair.L.rClass}), which ${pair.H.command} names as the lighter rung for the same symptom: the block lists only ${pair.lighter} now, and ${pair.heavier} is named in Details with its condition`);
  const later = laterRung(answer, names);
  if (later) return row(false, `the block holds ${later.gate} with another gate, while the answer names it as a later step ("${later.line}"): a later rung stays out of the block`);
  return row(true, first.detail);
}

module.exports = { lightestStepFirst, runbookPairs, FALLBACK };
