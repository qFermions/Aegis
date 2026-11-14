'use strict';
require('../adapters/socket-tripwire.js');
// ask-first.test.js: ask first when there is nothing to go on (batch 11, task 4).
//
// EXPECTED DECISION (written before senior-rules.js)
// - A ticket that names a thing and gives no symptom, no error text, no who and no since-when gets one question
//   and nothing else: no Fix card, no numbered steps, no Details, at most 60 words, one question mark. The one
//   question may ask what happens, for whom and since when together.
// - Every other ticket gets a Fix card (Rule 8: assume the most common scenario and answer).
// - The desk reads an ask-first answer (no Fix card, a question, no gate) as its CLARIFY state.
// The twenty phrasings are this batch's own; none is a demo ticket.
// A wrong implementation each test catches: a row that passes any answer with a question mark (the card answer to
// a bare ticket holds one in its user message and must fail); a bare-ticket reader that keys on length alone (the
// short tickets with a symptom must get a card); a form check that counts words in the aegis-desk block (the
// answer that closes with "Gate: none" must still pass); a reader that takes "not working" for a symptom (five
// of the bare tickets say it).
// Run: node --test scripts/demo/ask-first.test.js

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { bareTicket, askFirst, isAskFirst } = require('./senior-rules.js');

const BARE = [
  'The printer is broken.',
  'Teams not working',
  'Outlook problem',
  'wifi issue pls fix',
  'Laptop is acting up.',
  'Help with the scanner',
  'Something is wrong with SharePoint.',
  'Phone system broken again',
  "VPN doesn't work",
  'Need help with email asap',
];
const WITH_SOMETHING = [
  'The second-floor printer prints blank pages since this morning.',
  "Teams says 'We couldn't sign you in' with error CAA20002 on my laptop.",
  'Outlook keeps asking [FIRST_NAME] for a password after the update yesterday.',
  'Nobody at the warehouse site can join the wifi since the power cut.',
  'My laptop shuts down when I unplug the charger.',
  'The scanner sends scans to the wrong folder for everyone in accounts.',
  'SharePoint shows access denied to the whole finance team on the budget library.',
  'Callers hear a busy tone on the main line since 9 am.',
  'VPN drops every ten minutes for two remote staff.',
  'I stopped receiving email from one supplier last week.',
];

const QUESTION = 'What exactly happens when you use it, who is affected, and since when?';
const CARD = [
  '## Fix',
  "**What's wrong:** the device has lost its connection to the print server.",
  '**Do this:**',
  '1. Open the print server and read the queue for the device.',
  '2. Ask the user to print a test page.',
  '3. Read the queue again.',
  '**Done when:** the test page prints.',
  '**Stop if:** the queue is empty; then the job never left the laptop.',
  '**Tell the user now:** IT is looking at it. Can you send one test page?',
  '**Tell the user when done:** Please try to print again.',
  '',
  '## Details',
  'Nothing changes.',
  '',
  '```aegis-desk',
  'Gate: none',
  '```',
].join('\n');

test('task 4: ten tickets with nothing to go on read as bare, and ten that name a symptom, an error, a who or a since-when do not', () => {
  for (const t of BARE) assert.equal(bareTicket(t), true, t);
  for (const t of WITH_SOMETHING) assert.equal(bareTicket(t), false, t);
});

test('task 4: a bare ticket must get the one question: the question passes the row and a Fix card fails it', () => {
  for (const t of BARE) {
    const asked = askFirst(QUESTION, { ticket: t });
    assert.equal(asked.verdict, 'pass', `${t}: ${asked.detail}`);
    const carded = askFirst(CARD, { ticket: t });
    assert.equal(carded.verdict, 'fail', t);
    assert.match(carded.detail, /one question/);
  }
});

test('task 4: a ticket that names a symptom must get a Fix card: the card passes the row and a lone question fails it', () => {
  for (const t of WITH_SOMETHING) {
    const carded = askFirst(CARD, { ticket: t });
    assert.equal(carded.verdict, 'pass', `${t}: ${carded.detail}`);
    const asked = askFirst(QUESTION, { ticket: t });
    assert.equal(asked.verdict, 'fail', t);
    assert.match(asked.detail, /Fix card/);
  }
});

test('task 4: the form of an ask-first answer: one question mark, no "## Fix", no numbered steps, at most 60 words', () => {
  const t = BARE[0];
  assert.equal(isAskFirst(QUESTION), true);
  assert.equal(isAskFirst(CARD), false, 'an answer with a Fix card is not an ask-first answer');
  assert.equal(isAskFirst('Thanks, noted.'), false, 'an answer that asks nothing is not an ask-first answer');
  const two = askFirst('What happens when you print? And since when?', { ticket: t });
  assert.equal(two.verdict, 'fail');
  assert.match(two.detail, /2 question marks/);
  const steps = askFirst('What happens when you print?\n1. Restart the printer.\n2. Print a test page.', { ticket: t });
  assert.equal(steps.verdict, 'fail');
  assert.match(steps.detail, /numbered step/);
  const long = askFirst(`${Array.from({ length: 61 }, () => 'word').join(' ')} and what happens when you print?`, { ticket: t });
  assert.equal(long.verdict, 'fail');
  assert.match(long.detail, /words/);
  const details = askFirst('What happens when you print?\n\n## Details\nThe queue is on the print server.', { ticket: t });
  assert.equal(details.verdict, 'fail');
  assert.match(details.detail, /heading/);
  // the desk asks every session for the closing block: "Gate: none" there is not part of the question
  const withBlock = askFirst(`${QUESTION}\n\n\`\`\`aegis-desk\nGate: none\n\`\`\``, { ticket: t });
  assert.equal(withBlock.verdict, 'pass', withBlock.detail);
  // a question the answer only quotes from the ticket is not the answer's question
  assert.equal(isAskFirst('> Can someone fix the printer?\n\nNoted.'), false);
});

// A ticket that does not say what the thing is has even less to go on, whatever else it says: the judged
// runner's own DEV06 case ("It stopped working again this morning. Can you fix it?", class CLARIFY) gives a
// since-when and still cannot be answered. A wrong implementation it catches: a reader for which any since-when
// or "stopped working" makes a ticket answerable.
test('task 4: a ticket that does not say what the thing is also gets the one question; one that quotes an error or names a system does not', () => {
  for (const t of ['It stopped working again this morning. Can you fix it?', 'This is broken for me', 'Something went wrong yesterday, please help', 'Everything is slow today']) assert.equal(bareTicket(t), true, t);
  for (const t of ['It says "disk full" when I save.', 'It keeps asking for my password in Outlook.', 'This printer prints blank pages since this morning.', 'It shows error 0x80070005 on my laptop.']) assert.equal(bareTicket(t), false, t);
  const asked = askFirst(QUESTION, { ticket: 'It stopped working again this morning. Can you fix it?' });
  assert.equal(asked.verdict, 'pass', asked.detail);
});
