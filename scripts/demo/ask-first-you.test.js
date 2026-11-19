'use strict';
require('../adapters/socket-tripwire.js');
// ask-first-you.test.js: batch 12d, task 4b, the owner's decision (checks.md, row T13). The reply to the person who
// asked must be addressed to "you" (scripts/demo/senior-rules.js, replyProblems); an Ask first reply is the one
// question (answer-format section 8), which often asks about the thing without the word. A reply that is one question
// as section 7 defines it (one question mark, at most 60 words, no card, no steps), read by the existing ask-first
// reader (askFirstProblems), passes that one rule. Every other rule of the reply still applies to it, and every other
// reply still needs "you". Run: node --test scripts/demo/ask-first-you.test.js

const assert = require('node:assert/strict');
const test = require('node:test');

const { replyProblems, askerReply } = require('./senior-rules.js');

const NOT_YOU = 'it is not addressed to "you"';
const QUESTION = 'What exactly does the scanner screen show when a scan stops, and since when?';

// The old false fail. Wrong implementation: the "you" rule applied to a one-question reply (today's behaviour).
test('a one-question Ask first reply without the word "you" passes the reply check', () => {
  assert.deepEqual(replyProblems(QUESTION, { ticket: 'The scanner is broken.' }), []);
  const answer = `Mode: Ask first\n${QUESTION}\n\n\`\`\`aegis-desk\nGate: none\n\`\`\`\n`;
  const reply = askerReply(answer, 'The scanner is broken.');
  assert.equal(reply.from, 'ask-first');
  assert.deepEqual(replyProblems(reply.text, { ticket: 'The scanner is broken.' }), [], 'the reply the desk takes from an Ask first answer');
});

// What must still fail. Wrong implementations: the "you" rule dropped for every reply (the statement and the long reply
// below must fail it); a waiver for any text with a question mark (two questions, or one question past 60 words, must
// still fail it); a waiver that also hides the reply's other rules (bold, a placeholder, a portal path must still fail).
test('a reply that is not one question still needs "you"; a one-question reply still fails every other rule', () => {
  const notOne = [
    ['a statement', 'The scanner needs a technician to look at its log before anything else changes.'],
    ['two questions', 'What does the scanner screen show? Since when does it happen?'],
    ['one question past 60 words', `${'The scanner has stopped in the middle of a scan several times this week, and the team at the front has been scanning on the other floor while it waits for a technician to look at it. '.repeat(2)}What exactly does its screen show when a scan stops?`],
  ];
  for (const [name, text] of notOne) assert.ok(replyProblems(text).includes(NOT_YOU), `${name}: ${replyProblems(text).join('; ')}`);
  const otherRules = [
    ['bold', 'What exactly does the scanner screen show when a **scan** stops?', 'it has bold text'],
    ['placeholder', 'What exactly does the screen on [DEVICE_NAME] show when a scan stops?', 'it has a bracketed placeholder'],
    ['portal path', 'What does Admin center → Devices → Scanners show for it?', 'it has a portal path'],
  ];
  for (const [name, text, problem] of otherRules) {
    const problems = replyProblems(text);
    assert.ok(problems.includes(problem), `${name}: ${problems.join('; ')}`);
    assert.ok(!problems.includes(NOT_YOU), `${name}: one question, so the "you" rule is not the reason`);
  }
});
