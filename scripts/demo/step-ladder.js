'use strict';
// step-ladder.js: the desk check "lightest step first" (batch 9, task 8c). It reads the first advised admin
// change, the first Gate line in the answer's closing aegis-desk block, and the runbook section that holds
// that gate, with the ladder lint's own section reader (scripts/lint/ladder-audit.js). It fails when that
// gate is heavy (R3, or a reset, wipe, erase, delete or re-register) and its section lists a lighter admin
// step before it (a lighter SAFETY GATE, or a PREVIEW ONLY marker for a lighter action) that the answer did
// not advise first. A user check is not an admin change. A row on the page; it never stops a ticket.

const fs = require('node:fs');

const { namedGates } = require('./catalog.js');
const { sectionEvents } = require('../lint/ladder-audit.js');

const row = (ok, detail) => ({ check: 'lightest-step-first', verdict: ok ? 'pass' : 'fail', plain: 'The first change is the lightest one the runbook offers', detail });

// gates: the desk's catalog (catalog.js): id to { kind, file, ... }.
function lightestStepFirst(answer, gates) {
  const names = namedGates(answer);
  if (!names.length) return row(true, 'no change advised');
  const first = names[0];
  const entry = gates.get(first);
  if (!entry || entry.kind !== 'gate') return row(true, `the first change, ${first}, is not a SAFETY GATE the runbooks hold`);
  let sections;
  try { sections = sectionEvents(fs.readFileSync(entry.file, 'utf8'), entry.command); } catch { return row(true, `the runbook holding ${first} could not be read`); }
  const section = sections.find((s) => s.events.some((e) => e.id === first && e.kind === 'heavy'));
  if (!section) return row(true, `the first change, ${first}, is not a reset, wipe, erase, delete, re-register or R3 change`);
  const at = section.events.findIndex((e) => e.id === first);
  const lighter = section.events.slice(0, at).filter((e) => e.kind === 'lighter' && e.admin).map((e) => e.id);
  if (!lighter.length) return row(true, `${first} is heavy, and its runbook section lists no lighter admin step before it`);
  return row(false, `the first change is ${first}, a heavy one, while its runbook section "${section.title}" lists ${lighter.join(', ')} first`);
}

module.exports = { lightestStepFirst };
