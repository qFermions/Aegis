#!/usr/bin/env node
'use strict';
// card-words.js <results.json | folder>...: batch 12d, task 3c. For each saved answer that holds a Fix card, prints the
// card's words by the desk's own counter (scripts/demo/answer.js, fixCard) and each slot's words against its budget
// (cardSlots, STEP_BUDGET), then the median and the count over 150. No model is called and nothing is written.
// A judged results.json is read case by case (sut.answer); a folder is read for every file named answer.txt or
// <name>-answer.txt under it. Self-check: where a results.json case records fix_card_words, the count printed here must
// equal it, and the run exits 1 when one does not.
const fs = require('node:fs');
const path = require('node:path');
const { fixCard, cardSlots, words, STEP_BUDGET } = require('../../../../../../scripts/demo/answer.js');

const SHORT = { wrong: 'cause', doThis: 'steps', doneWhen: 'done', stopIf: 'stop', tellNow: 'now', tellDone: 'when-done' };

function answersOf(input) {
  if (fs.statSync(input).isDirectory()) {
    return fs.readdirSync(input, { recursive: true }).map(String).filter((f) => /(?:^|[/-])answer\.txt$/.test(f)).sort()
      .map((f) => ({ name: f, answer: fs.readFileSync(path.join(input, f), 'utf8'), recorded: null }));
  }
  const cases = JSON.parse(fs.readFileSync(input, 'utf8')).cases || [];
  return cases.map((c) => ({ name: c.id, answer: (c.sut && c.sut.answer) || '', recorded: Number.isFinite(c.fix_card_words) ? c.fix_card_words : null }));
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length === 0 ? null : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

let mismatches = 0;
for (const input of process.argv.slice(2)) {
  const items = answersOf(input);
  console.log(`== ${path.basename(path.dirname(path.resolve(input)))}/${path.basename(input)}: ${items.length} answers`);
  console.log('answer | card words | slots: words/budget (* over) | steps over 14 | words in no slot');
  const counts = [];
  for (const { name, answer, recorded } of items) {
    const card = fixCard(answer);
    if (!card.present) continue;
    counts.push(card.words);
    const slots = cardSlots(card);
    const slotText = slots.map((s) => `${SHORT[s.key]} ${s.words}/${s.budget}${s.words > s.budget ? '*' : ''}`).join(', ');
    const longSteps = card.steps.map(words).filter((n) => n > STEP_BUDGET).length;
    // the card's count minus the slots and the labels it has: words outside every part (a line after a blank one)
    const loose = card.words - slots.reduce((n, s) => n + s.words, 0) - slots.filter((s) => card.order.includes(s.key)).reduce((n, s) => n + words(`${s.label}:`), 0);
    const check = recorded !== null && recorded !== card.words ? ` MISMATCH: results.json says ${recorded}` : '';
    if (check) mismatches += 1;
    console.log(`${name} | ${card.words}${card.words > 150 ? ' (over 150)' : ''} | ${slotText} | ${longSteps} of ${card.steps.length} | ${loose}${check}`);
  }
  console.log(`cards: ${counts.length} of ${items.length} answers; median ${median(counts) ?? 'n/a'} words; over 150: ${counts.filter((n) => n > 150).length}; slots over budget: ${items.map((i) => fixCard(i.answer)).filter((c) => c.present && cardSlots(c).some((s) => s.words > s.budget)).length} cards\n`);
}
if (mismatches) { console.log(`self-check: ${mismatches} card count(s) differ from results.json`); process.exit(1); }
console.log('self-check: every count matches the fix_card_words a results.json recorded');
