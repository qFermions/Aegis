'use strict';
require('../adapters/socket-tripwire.js');
// asker-reply.test.js: the reply to the person who asked (batch 11, task 6), its place in an answer and its form check.
//
// EXPECTED DECISION (written before senior-rules.js; the rules are docs/aegis/answer-format.md section 8)
// - The reply sits in one fenced block labeled asker-reply, before the aegis-desk block. For a ticket with nothing
//   to go on, the answer is the one question, and that question is the reply.
// - Form: at most 3 short paragraphs and 150 words; full sentences; addressed to "you"; no headings, lists, bold,
//   portal paths, gate ids, risk classes or bracketed placeholders.
// - It never says a change is done, never announces a change that needs sign-off as decided, never promises a time
//   the ticket or the company setup did not set (the "user message now" logic), never tells the asker to take an
//   admin action, never says Aegis changed anything, and never names a check as run unless the sentence is about
//   what the asker sent.
// Eight own pairs: a reply that passes and one that fails for one reason. None is a demo ticket.
// A wrong implementation each test catches: a check that counts words only (the list, the heading, the bold word
// and the portal path are all under 150 words); one that reads a done claim only at the start of the reply (the
// claim in the third paragraph must fail); one that takes any clock time as a promise (the time the ticket set
// must pass); one that reads the reply out of any fenced block (the aegis-desk block is not the reply).
// Run: node --test scripts/demo/asker-reply.test.js

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { askerReply, replyProblems } = require('./senior-rules.js');

const GOOD_MAIL = [
  'No, your mailbox is not broken: the message you forwarded shows the supplier\'s mail was held by the spam filter on its way in.',
  "I read the bounce text you sent, and it matches a held message. I haven't confirmed yet why the filter held it, so I can't say it will not happen again.",
  'There is nothing you need to do for now. A technician will look at the held message next and will tell you once it is safe to deliver.',
].join('\n\n');
const GOOD_PHONE = [
  'Yes, we can get you back in without your old phone.',
  'From what you wrote, the sign-in app was only on the phone you traded in, which is why the code never arrives. Your idea that the account is locked does not fit: the sign-in page is asking for a code, not refusing you.',
  'Please keep your new phone nearby. Someone from IT will call you on the number we have on file to prove it is you and set up the new phone with you.',
].join('\n\n');
const GOOD_LAPTOP = [
  'Your laptop is being flagged because it missed a required update, not because of anything you did.',
  'I looked at the warning you pasted. I have not confirmed which update is missing.',
  'You can leave the laptop on and plugged in so updates can install. The device team picks this up next and will check it again.',
].join('\n\n');

const problems = (reply, ctx = {}) => replyProblems(reply, { ticket: 'The supplier says their email to me bounced. Is my mailbox broken?', ...ctx });

test('task 6: three whole replies, on mail, sign-in and a laptop, pass the form check', () => {
  for (const reply of [GOOD_MAIL, GOOD_PHONE, GOOD_LAPTOP]) assert.deepEqual(problems(reply), [], reply.slice(0, 40));
});

test('task 6: eight pairs: the reply passes, and the same reply with one fault fails for that fault', () => {
  const pairs = [
    { name: 'a heading', bad: `## Update\n\n${GOOD_MAIL}`, re: /heading/ },
    { name: 'a list', bad: GOOD_MAIL.replace('There is nothing you need to do for now.', '- Wait for our message.\n- Do not resend the mail.'), re: /list/ },
    { name: 'bold text', bad: GOOD_MAIL.replace('not broken', '**not broken**'), re: /bold/ },
    { name: 'a portal path', bad: GOOD_MAIL.replace('A technician will look at the held message next', 'A technician will open Exchange admin center → Mail flow → Message trace next'), re: /portal path/ },
    { name: 'a bracketed placeholder', bad: GOOD_PHONE.replace('Someone from IT', '[ADMIN_NAME] from IT'), re: /placeholder/ },
    { name: 'a risk class', bad: GOOD_LAPTOP.replace('The device team picks this up next', 'This is an R2 change, so the device team picks this up next'), re: /risk class/ },
    { name: 'a done claim', bad: GOOD_MAIL.replace('A technician will look at the held message next and will tell you once it is safe to deliver.', 'We have released the message, so it is in your inbox.'), re: /says a change is done/ },
    { name: 'an admin action for the asker', bad: GOOD_PHONE.replace('Please keep your new phone nearby.', 'Please reset the sign-in methods for your account in the admin console.'), re: /admin action/ },
  ];
  for (const p of pairs) {
    const found = problems(p.bad);
    assert.ok(found.length > 0, `${p.name}: must fail`);
    assert.ok(found.some((f) => p.re.test(f)), `${p.name}: ${found.join('; ')}`);
  }
});

test('task 6: length, paragraphs, voice and whole sentences', () => {
  const long = `${GOOD_MAIL} ${Array.from({ length: 80 }, () => 'really').join(' ')} soon.`;
  assert.ok(problems(long).some((f) => /words/.test(f)));
  const four = `${GOOD_MAIL}\n\nThank you for your patience.`;
  assert.ok(problems(four).some((f) => /paragraphs/.test(f)));
  const notYou = 'The mailbox is fine. The message was held by the spam filter. A technician will look at it next.';
  assert.ok(problems(notYou).some((f) => /"you"/.test(f)));
  const fragment = GOOD_LAPTOP.replace('The device team picks this up next and will check it again.', 'Next: device team');
  assert.ok(problems(fragment).some((f) => /full sentence/.test(f)));
  assert.ok(problems('').some((f) => /empty/.test(f)));
});

test('task 6: a time only when the ticket or the setup sets it; a check only when it is about what the asker sent', () => {
  const timed = GOOD_LAPTOP.replace('will check it again.', 'will check it again before 9.');
  assert.ok(problems(timed).some((f) => /time/.test(f)), 'a time nobody set is a promise');
  assert.deepEqual(replyProblems(timed, { ticket: 'My laptop shows a compliance warning and I present before 9.' }), [], 'the ticket set that time');
  assert.deepEqual(replyProblems(timed.replace('before 9', 'within 4 hours'), { ticket: 'My laptop shows a compliance warning.', setup: 'Tickets are answered within 4 hours.' }), [], 'the company setup set that time');
  const invented = GOOD_LAPTOP.replace('I looked at the warning you pasted.', 'I checked the device in the admin console.');
  assert.ok(problems(invented).some((f) => /did not run|not run/.test(f)), 'a check Aegis did not run');
  const aegis = GOOD_MAIL.replace('A technician will look at the held message next', 'Aegis released the message and a technician will look at it next');
  assert.ok(problems(aegis).length > 0, 'Aegis never changes anything');
  const decided = GOOD_PHONE.replace('set up the new phone with you.', 'set up the new phone with you. We will wipe the old phone.');
  assert.ok(problems(decided).some((f) => /decided/.test(f)));
});

test('task 6: the reply is read from the asker-reply block before the aegis-desk block, or is the one question of an ask-first answer', () => {
  const answer = [
    '## Fix',
    "**What's wrong:** the message was held by the spam filter.",
    '**Do this:**',
    '1. Read the quarantine.',
    '2. Read the message headers.',
    '3. Release the one message.',
    '**Done when:** the message is in the inbox.',
    '**Stop if:** the message is not in quarantine.',
    '**Tell the user now:** IT is looking at the held message.',
    '**Tell the user when done:** The message is in your inbox.',
    '',
    '## Details',
    'One release.',
    '',
    '```asker-reply',
    GOOD_MAIL,
    '```',
    '',
    '```aegis-desk',
    'Gate: example-quarantine-release-portal',
    '```',
  ].join('\n');
  const found = askerReply(answer);
  assert.equal(found.present, true);
  assert.equal(found.text, GOOD_MAIL);
  assert.equal(askerReply(answer.replace('```asker-reply', '```text')).present, false, 'another block is not the reply');
  assert.equal(askerReply(answer.replace(/```asker-reply[\s\S]*?```\n\n/, '')).present, false, 'the aegis-desk block is not the reply');
  const question = 'What exactly happens when you use the scanner, who is affected, and since when?';
  const asked = askerReply(question);
  assert.equal(asked.present, true);
  assert.equal(asked.text, question);
  assert.deepEqual(replyProblems(question, { ticket: 'The scanner is broken.' }), []);
});
