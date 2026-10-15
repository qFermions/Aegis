#!/usr/bin/env node
'use strict';
// gws-ticket-eval.js — Google Workspace / Okta / Jamf / macOS ticket usability
// evaluation, deterministic half.
//
// Same checks as the Microsoft evaluator, by construction: both call
// ticket-eval-core.js. For each sanitized ticket in gws-tickets.json this proves,
// without a model:
//   floor      the tier guard floors consequential Google/Okta/Jamf work (delete,
//              suspend, transfer, deprovision, powerwash, 2-Step Verification off,
//              admin-role grant, Okta deactivate, Jamf lock/wipe/unmanage, …) and
//              leaves routine tickets clean
//   route      every command the ticket routes to exists and passes the GUI-first
//              structure lint (Admin console / Okta / Jamf / System Settings
//              breadcrumbs, CLI collapsed + commented + HUMAN-RUN, one checklist,
//              one Jira note, fresh vendor paths)
//   replay     a first occurrence is a replay MISS routed to the adaptive path
//   pairs      Google-shaped dangerous pairs never share an exact or shape key and
//              floor apart where doctrine requires it
//
// The model-judged half (first action, depth, continuity, human-executes framing)
// is the rubric in scripts/eval/README.md.
//
// Run: node scripts/eval/gws-ticket-eval.js [--json]      exit 0 pass · 1 fail

const fs = require('fs');
const path = require('path');
const core = require('./ticket-eval-core.js');

const CORPUS = JSON.parse(fs.readFileSync(path.join(__dirname, 'gws-tickets.json'), 'utf8'));

function evaluate(corpus = CORPUS) {
  return core.evaluate(corpus);
}

module.exports = { evaluate, CORPUS };

if (require.main === module) core.main(CORPUS, 'Google Workspace / Okta / Jamf ticket eval');
