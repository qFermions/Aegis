'use strict';
require('../adapters/socket-tripwire.js');
// card-rows-narrow.test.js: batch 12d, task 4a, the owner's decision (checks.md, row DESK). The desk's card rows of
// batches 8 and 9 (fix-card-first, fix-card-parts, fix-card-words in scripts/demo/answer.js) read an answer that has a
// Fix card. They do not apply to an answer whose mode line names Ask first, Engineer answer or Incident answer and that
// has no card: such a row is left off the page, as the desk leaves off every answer row that does not apply
// (scripts/demo/senior-rules.js, expert-rules.js), so it is neither a fail nor a pass it did not earn. Nothing else is
// narrowed. Run: node --test scripts/demo/card-rows-narrow.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { answerChecks } = require('./answer.js');

const CARD_ROWS = ['fix-card-first', 'fix-card-parts', 'fix-card-words'];
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', 'batch12d', name), 'utf8');
const rowsOf = (a) => Object.fromEntries(answerChecks(a).map((r) => [r.check, r]));
const DESK = '\n```aegis-desk\nGate: none\n```\n';
const ASK_FIRST = `Mode: Ask first\nWhat exactly does the screen say when the scan stops, and since when?\n${DESK}`;
const longCard = (mode) => `${mode}\n## Fix\n**What's wrong:** the scanner stops.\n**Do this:**\n1. Read the scanner's log.\n2. Restart the scan service.\n3. Scan a test page.\n**Done when:** a page scans.\n**Stop if:** the log shows a hardware fault.\n**Tell the user now:** IT is looking at the scanner. ${'More words here. '.repeat(40)}\n**Tell the user when done:** The scanner works.\n${DESK}`;

// The old false fail. Wrong implementations: the rows kept and failed (today's behaviour); the rows kept and passed
// with no card (a pass the answer did not earn); the other answer rows dropped too (narrower than the owner allowed).
test('an Ask first, Engineer or Incident answer with no card gets no card rows, and keeps the other rows', () => {
  for (const [name, a] of [['engineer', fixture('engineer-closing-block.md')], ['incident', fixture('incident-closing-block.md')], ['ask first', ASK_FIRST], ['bold mode line', fixture('engineer-closing-block.md').replace('Mode: Engineer answer', '**Mode:** Engineer answer')]]) {
    const rows = rowsOf(a);
    for (const check of CARD_ROWS) assert.equal(rows[check], undefined, `${name}: ${check} does not apply and is left off`);
    for (const check of ['no-command', 'customer-facts', 'user-message-now']) assert.ok(rows[check], `${name}: ${check} is still shown`);
  }
});

// What must still fail. Wrong implementations: narrowing on "no card" alone (a Fix card answer, or one with no mode
// line, that lost its card must still fail all three rows); narrowing on the mode alone (an Engineer answer that does
// carry a card over 150 words must still fail fix-card-words); a mode line that is not the first line honoured.
test('a Fix card answer or an unnamed answer with no card, and any card over 150 words, still fail', () => {
  for (const [name, a] of [['Mode: Fix card, no card', `Mode: Fix card\nCheck the cable first.\n${DESK}`], ['no mode line, no card', `Check the cable first.\n${DESK}`], ['mode line not first', `Check the cable first.\nMode: Engineer answer\n${DESK}`]]) {
    const rows = rowsOf(a);
    for (const check of CARD_ROWS) assert.equal(rows[check] && rows[check].verdict, 'fail', `${name}: ${check}`);
  }
  for (const mode of ['Mode: Fix card', 'Mode: Engineer answer', '']) {
    assert.equal(rowsOf(longCard(mode))['fix-card-words'].verdict, 'fail', `${mode || 'no mode line'}: a card over 150 words`);
  }
});
