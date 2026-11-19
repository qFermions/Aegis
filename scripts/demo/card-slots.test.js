'use strict';
require('../adapters/socket-tripwire.js');
// card-slots.test.js: batch 12d, task 3b. The Fix card is built from fixed slots, one per part, each with its own word
// budget (docs/aegis/answer-format.md, section 1 and judgment rule e). Counted the way the desk's word counter counts
// the card (scripts/demo/answer.js, fixCard and words), the six labels and the six budgets sum to 150 or fewer, so a
// card that keeps every slot keeps the cap by construction. The only failing check stays the 150-word one: no row and
// no judged check fails a single slot. Run: node --test scripts/demo/card-slots.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const answer = require('./answer.js');
const expert = require('./expert-rules.js');

const DOC = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'aegis', 'answer-format.md'), 'utf8');
const sectionOf = (n) => DOC.slice(DOC.indexOf(`\n## ${n}.`), DOC.indexOf(`\n## ${n + 1}.`));
// Each fenced markdown card in a piece of the doc.
const cardsIn = (text) => [...text.matchAll(/^````markdown\n([\s\S]*?)\n````$/gm)].map((m) => `${m[1]}\n`).filter((t) => /^## Fix$/m.test(t));

// Every slot within its budget and every step within the step budget; the slots and the labels add up to the desk's count.
function assertKeepsSlots(card, name) {
  const c = answer.fixCard(card);
  assert.ok(c.present, `${name}: has a card`);
  const slots = answer.cardSlots(c);
  for (const s of slots) assert.ok(s.words <= s.budget, `${name}: "${s.label}" has ${s.words} words, budget ${s.budget}`);
  for (const [i, step] of c.steps.entries()) assert.ok(answer.words(step) <= answer.STEP_BUDGET, `${name}: step ${i + 1} has ${answer.words(step)} words, budget ${answer.STEP_BUDGET}`);
  assert.ok(c.steps.length <= 5, `${name}: at most five steps`);
  assert.equal(slots.reduce((n, s) => n + s.words, 0) + answer.CARD_LABEL_WORDS, c.words, `${name}: the slots and the labels add up to the desk's count`);
  assert.ok(c.words <= 150, `${name}: ${c.words} words`);
}

// Wrong implementations: budgets that sum past 150 (the cap would not hold by construction); a "Do this" budget that is
// not five steps at the step budget; a label count that differs from what the desk's counter counts.
test('the six labels and the six slot budgets sum to 149, under the 150-word cap', () => {
  assert.equal(answer.CARD_LABEL_WORDS, 17, 'the labels as the desk counts them');
  assert.equal(answer.CARD_LABEL_WORDS, answer.PARTS.reduce((n, p) => n + answer.words(`**${p.label}:**`), 0));
  assert.deepEqual(answer.PARTS.map((p) => [p.key, p.budget]), [['wrong', 12], ['doThis', 70], ['doneWhen', 16], ['stopIf', 10], ['tellNow', 14], ['tellDone', 10]]);
  assert.equal(answer.PARTS.find((p) => p.key === 'doThis').budget, 5 * answer.STEP_BUDGET, 'Do this is five steps at the step budget');
  const sum = answer.CARD_LABEL_WORDS + answer.PARTS.reduce((n, p) => n + p.budget, 0);
  assert.equal(sum, 149);
  assert.ok(sum <= 150);
});

// Wrong implementation: a doc whose slot table drifts from the budgets the desk and the measuring tool use.
test('section 1 gives each part its slot budget, the same numbers as the code', () => {
  const one = sectionOf(1);
  for (const p of answer.PARTS) {
    const row = one.split('\n').find((l) => l.startsWith(`| **${p.label}:** |`));
    assert.ok(row, `section 1 has a row for ${p.label}`);
    const cells = row.split('|').map((c) => c.trim());
    assert.equal(Number((/\d+/.exec(cells[3]) || [])[0]), p.budget, `${p.label}: the budget in section 1`);
  }
  assert.match(one, new RegExp(`at most ${answer.STEP_BUDGET} words`), 'section 1 names the step budget');
  assert.match(one, /\b149\b/, 'section 1 says what the slots sum to');
});

// Wrong implementations: a slot counter that counts the labels, the step numbers or the arrows (the sum would not match
// the desk's count); an example or fixture written past a slot.
test('the example cards of sections 2 and 6 and the batch 12d fixture keep every slot', () => {
  const examples = [...cardsIn(sectionOf(2)), ...cardsIn(sectionOf(6))];
  assert.equal(examples.length, 2, 'rule e and section 6 each give one card');
  examples.forEach((card, i) => assertKeepsSlots(card, `doc example ${i + 1}`));
  assertKeepsSlots(fs.readFileSync(path.join(__dirname, 'fixtures', 'batch12d', 'fix-card-slots.md'), 'utf8'), 'fix-card-slots.md');
});

// Wrong implementations: a slot made into a failing desk row or judged check (a card over one slot but within 150 words
// must still pass); the 150-word threshold moved (a card of 151 words must still fail).
test('a single slot over its budget fails nothing; a card over 150 words still fails the desk row and the judged check', () => {
  const card = fs.readFileSync(path.join(__dirname, 'fixtures', 'batch12d', 'fix-card-slots.md'), 'utf8');
  const longWrong = card.replace(/^\*\*What's wrong:\*\* .*$/m, "**What's wrong:** the front-desk label printer prints blank labels since its driver update, and the queue still shows each job as printed.");
  const c = answer.fixCard(longWrong);
  assert.ok(answer.cardSlots(c).find((s) => s.key === 'wrong').words > 12, 'the cause line is over its slot');
  assert.ok(c.words <= 150);
  const row = (a) => answer.answerChecks(a).find((r) => r.check === 'fix-card-words');
  const judged = (a) => expert.judgedChecks({ evidence: '' }, { answer: a, tool_calls: [] }).find((r) => r.check === 'fix-card-fits');
  assert.equal(row(longWrong).verdict, 'pass');
  assert.equal(judged(longWrong).verdict, 'pass');
  assert.deepEqual(answer.cardProblems(c), []);
  const over = card.replace(/^\*\*Stop if:\*\* .*$/m, (l) => `${l} ${'word '.repeat(150 - answer.fixCard(card).words + 1).trim()}`);
  assert.equal(answer.fixCard(over).words, 151);
  assert.equal(row(over).verdict, 'fail');
  assert.equal(judged(over).verdict, 'fail');
});
