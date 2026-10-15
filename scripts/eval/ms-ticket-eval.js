#!/usr/bin/env node
'use strict';
// ms-ticket-eval.js — Microsoft ticket usability evaluation, deterministic half.
//
// For each sanitized ticket in ms-tickets.json this proves, without a model:
//   floor      the tier guard floors consequential tickets to the Tier-3/R-ladder
//              path and leaves routine ones clean (expectFloor / expectTriggers)
//   route      every command the ticket routes to exists and passes the GUI-first
//              structure lint (exact breadcrumbs, PowerShell collapsed + commented,
//              one checklist, one Jira note, fresh portal paths, no dangling refs)
//   replay     a first occurrence is a replay MISS routed to the adaptive path
//   pairs      the "dangerous pairs" (similar words, different required resolution)
//              never share an exact key, never share a shape key, and floor apart
//              — so the zero-model fast path cannot serve the wrong procedure
//
// What it does NOT prove — the model-judged half, run inside Claude Code with the
// rubric in scripts/eval/README.md: useful first action, depth sized to the class
// (QUICK_FIX / DIAGNOSTIC / PROCEDURE / REFERENCE), continuity after "still no",
// and human-executes framing in the rendered answer.
//
// Run: node scripts/eval/ms-ticket-eval.js [--json]      exit 0 pass · 1 fail

const fs = require('fs');
const path = require('path');

// The checks themselves live in ticket-eval-core.js, shared with the Google
// Workspace / Okta / Jamf evaluator (gws-ticket-eval.js) so both lanes run
// exactly the same logic.
const core = require('./ticket-eval-core.js');

const CORPUS = JSON.parse(fs.readFileSync(path.join(__dirname, 'ms-tickets.json'), 'utf8'));

function evaluate(corpus = CORPUS) {
  return core.evaluate(corpus);
}

module.exports = { evaluate };

if (require.main === module) core.main(CORPUS, 'Microsoft ticket eval');
