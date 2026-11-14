'use strict';
require('../adapters/socket-tripwire.js');
// thinking-rules.test.js: the four thinking rules of batch 11, task 5, as desk rows.
//
// EXPECTED DECISION (written before senior-rules.js; the rules are docs/aegis/answer-format.md section 2)
// a. A new way in before the old way out: on a ticket about a lost or replaced sign-in device, the card's steps
//    hold, in this order, an identity check that names its method, a time-limited way in issued by a named admin
//    role and handed over on a verified channel, the person registering the new method, and the removal of the
//    old method; "Done when" says the new method is present and the old one is gone. A code sent by text, chat or
//    email with no verified channel fails.
// b. Who else, and what left: on a ticket about access someone should not have had, a step closes the path and a
//    later step reads the audit log for who else used it and whether anything was downloaded or shared onward; the
//    card does not say how serious it is.
// c. How wide before why: on a ticket about a service that is down or unreachable, step 1 fixes the scope (two of:
//    one person or everyone, one site or all, this service or others too) and names the vendor's status page; the
//    network and name-resolution path come before account-level causes.
// d. Every change carries its class and its double-check: in a plan with several changes, Details holds one line
//    per change with its class (R1 to R3) and its double-check, or "no gate" and a proof a person can see.
// Each rule: two fixture pairs (an answer that passes, an answer that fails) on two platforms. The fixtures are
// about none of the demo's tickets.
// A wrong implementation each test catches: (a) a row that only looks for the words "temporary" and "remove" in
// any order (the old-way-out-first answer holds both); (b) a row that passes any mention of an audit log (the
// answer that reads the log only for the one person must fail); (c) a row that looks for a status page anywhere
// (the answer that opens it in step 3 must fail); (d) a row that counts "R2" anywhere in the answer (the answer
// with classes and no double-checks must fail).
// Run: node --test scripts/demo/thinking-rules.test.js

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { newWayInFirst, whoElseWhatLeft, howWideBeforeWhy, changeClassAndCheck } = require('./senior-rules.js');

const answer = ({ wrong, steps, doneWhen = 'the person confirms it works.', tellNow = 'IT is working on this. Please wait for our call.', details = ['Nothing else changes.'], gates = ['none'] }) => [
  '## Fix',
  `**What's wrong:** ${wrong}`,
  '**Do this:**',
  ...steps.map((s, i) => `${i + 1}. ${s}`),
  `**Done when:** ${doneWhen}`,
  '**Stop if:** the facts do not match the ticket; then stop and ask.',
  `**Tell the user now:** ${tellNow}`,
  '**Tell the user when done:** Please try again now.',
  '',
  '## Details',
  ...details,
  '',
  '```aegis-desk',
  ...gates.map((g) => `Gate: ${g}`),
  '```',
].join('\n');

// ── a. A new way in before the old way out ──────────────────────────────────────────────────────
const LOST_GOOGLE = '[FIRST_NAME] dropped her phone in a river and the authenticator app was on it. She cannot get past the second step.';
const LOST_OKTA = 'Okta Verify was on my old phone, which I traded in. The new phone has nothing on it and I am locked out.';
const NEW_WAY_DONE = 'the new phone is listed as a sign-in method and the lost phone is no longer listed. Aegis then checks both.';

test('task 5a (Google): a new way in before the old way out passes; the old way out first, with a code by email, fails', () => {
  const good = answer({
    wrong: 'the only second step was on the lost phone.',
    steps: [
      'Call [FIRST_NAME] back on the number in the staff list and confirm it is her.',
      'As a user management admin, open the Google Admin console → Directory → Users → [UPN] → Security and get backup verification codes; read one out on that same call.',
      'Ask [FIRST_NAME] to sign in with the code and set up 2-Step Verification on the new phone.',
      'Remove the lost phone from her 2-Step Verification methods.',
    ],
    doneWhen: NEW_WAY_DONE,
  });
  const pass = newWayInFirst(good, { ticket: LOST_GOOGLE });
  assert.equal(pass.applies, true);
  assert.equal(pass.verdict, 'pass', pass.detail);
  const bad = answer({
    wrong: 'the only second step was on the lost phone.',
    steps: [
      'Remove the lost phone from her 2-Step Verification methods.',
      'As a user management admin, get backup verification codes and email one to her personal address.',
      'Ask [FIRST_NAME] to sign in with the code and set up 2-Step Verification on the new phone.',
    ],
    doneWhen: NEW_WAY_DONE,
  });
  const fail = newWayInFirst(bad, { ticket: LOST_GOOGLE });
  assert.equal(fail.verdict, 'fail');
  assert.match(fail.detail, /identity/);
  assert.match(fail.detail, /before/);
  assert.match(fail.detail, /channel/);
});

test('task 5a (Okta): the same order passes; a code sent by chat with no verified channel fails, and so does a missing role or a thin "Done when"', () => {
  const steps = [
    'Confirm it is [FIRST_NAME] on a video call, with their manager confirming in the IT channel.',
    'As a help desk administrator, issue a temporary access code for [UPN] in the Okta Admin Console and tell it to them on that same video call.',
    'Ask [FIRST_NAME] to sign in with the code and enroll Okta Verify on the new phone.',
    'Remove the old phone\'s Okta Verify enrollment.',
  ];
  const good = answer({ wrong: 'Okta Verify lived only on the traded-in phone.', steps, doneWhen: 'Okta Verify on the new phone is listed and the old enrollment is gone. Aegis then checks both.' });
  const pass = newWayInFirst(good, { ticket: LOST_OKTA });
  assert.equal(pass.verdict, 'pass', pass.detail);

  const byChat = answer({ wrong: 'Okta Verify lived only on the traded-in phone.', steps: [steps[0], 'As a help desk administrator, issue a temporary access code for [UPN] and send it by Slack message.', steps[2], steps[3]], doneWhen: 'Okta Verify on the new phone is listed and the old enrollment is gone.' });
  const chat = newWayInFirst(byChat, { ticket: LOST_OKTA });
  assert.equal(chat.verdict, 'fail');
  assert.match(chat.detail, /channel/);

  const noRole = answer({ wrong: 'Okta Verify lived only on the traded-in phone.', steps: [steps[0], 'Issue a temporary access code for [UPN] and tell it to them on that same video call.', steps[2], steps[3]], doneWhen: 'Okta Verify on the new phone is listed and the old enrollment is gone.' });
  assert.match(newWayInFirst(noRole, { ticket: LOST_OKTA }).detail, /admin role/);

  const thin = answer({ wrong: 'Okta Verify lived only on the traded-in phone.', steps, doneWhen: '[FIRST_NAME] can sign in.' });
  const t = newWayInFirst(thin, { ticket: LOST_OKTA });
  assert.equal(t.verdict, 'fail');
  assert.match(t.detail, /Done when/);
});

test('task 5a: the row does not apply to a ticket that is not about a lost or replaced sign-in device', () => {
  const row = newWayInFirst(answer({ wrong: 'the mailbox is full.', steps: ['Read the mailbox size.', 'Ask the user to empty Deleted Items.', 'Send a test message.'] }), { ticket: 'My mailbox is full and new mail bounces.' });
  assert.equal(row.applies, false);
  assert.equal(row.verdict, 'pass');
});

// ── b. Who else, and what left ──────────────────────────────────────────────────────────────────
const OPEN_LINK = 'A folder of client contracts was shared with anyone who has the link, and a former contractor says they could still open it last week.';
const WRONG_SITE = 'Someone in sales could read the salary file on the HR site. They should not have access to that site.';

test('task 5b (Google): close the path, then read the audit log for who else and what left; no severity before that read', () => {
  const good = answer({
    wrong: "the folder's link let anyone who had it open the contracts.",
    steps: [
      "Open the folder's sharing settings in Drive and read who has access and what the link allows.",
      'Change the link to Restricted, so only named people can open it.',
      'Open the Google Admin console → Reporting → Audit and investigation → Drive log events for that folder: read who else opened it while the link was open, and whether anything was downloaded or shared onward.',
    ],
  });
  const pass = whoElseWhatLeft(good, { ticket: OPEN_LINK });
  assert.equal(pass.applies, true);
  assert.equal(pass.verdict, 'pass', pass.detail);
  const bad = answer({
    wrong: "the folder's link was open to anyone, but no data was leaked.",
    steps: [
      "Open the folder's sharing settings in Drive and read who has access.",
      'Change the link to Restricted, so only named people can open it.',
      'Tell the account manager the link is closed.',
    ],
  });
  const fail = whoElseWhatLeft(bad, { ticket: OPEN_LINK });
  assert.equal(fail.verdict, 'fail');
  assert.match(fail.detail, /audit log/);
  assert.match(fail.detail, /how serious/);
});

test('task 5b (Microsoft): the same rule on a SharePoint site; a log read for the one person only fails', () => {
  const good = answer({
    wrong: 'the sales group is a member of the HR site.',
    steps: [
      'Open SharePoint admin center → Active sites → the HR site → Membership and find how [UPN] got in.',
      "Remove the sales group from the site's Members.",
      "In the Microsoft Purview portal → Audit, search the site's file activity since the group was added: who else opened the files, and whether anyone downloaded or shared them.",
    ],
  });
  const pass = whoElseWhatLeft(good, { ticket: WRONG_SITE });
  assert.equal(pass.verdict, 'pass', pass.detail);
  const onlyOne = answer({
    wrong: 'the sales group is a member of the HR site.',
    steps: [
      'Open SharePoint admin center → Active sites → the HR site → Membership and find how [UPN] got in.',
      "Remove the sales group from the site's Members.",
      'In the Microsoft Purview portal → Audit, confirm [UPN] opened the salary file.',
    ],
  });
  const fail = whoElseWhatLeft(onlyOne, { ticket: WRONG_SITE });
  assert.equal(fail.verdict, 'fail');
  assert.match(fail.detail, /who else/);
  // the log read before the path is closed is not the read the rule asks for
  const before = answer({
    wrong: 'the sales group is a member of the HR site.',
    steps: [
      "In the Microsoft Purview portal → Audit, search the site's file activity: who else opened the files, and whether anyone downloaded or shared them.",
      'Open SharePoint admin center → Active sites → the HR site → Membership and find how [UPN] got in.',
      "Remove the sales group from the site's Members.",
    ],
  });
  assert.equal(whoElseWhatLeft(before, { ticket: WRONG_SITE }).verdict, 'fail');
  assert.equal(whoElseWhatLeft(good, { ticket: 'Please add me to the sales site.' }).applies, false);
});

// ── c. How wide before why ──────────────────────────────────────────────────────────────────────
const GMAIL_DOWN = 'Gmail will not load for anyone in the office this morning.';
const SHAREPOINT_DOWN = 'Nobody can reach SharePoint. Pages time out.';

test('task 5c (Google): step 1 fixes the scope with the status page, then the network before the account', () => {
  const good = answer({
    wrong: 'Gmail is not loading, and it is not yet known how widely.',
    steps: [
      'Ask whether it fails for one person or everyone, at one site or all, and whether other websites load; open the Google Workspace Status Dashboard.',
      'With no incident listed, check the office network: try another network and look up mail.google.com by name.',
      "Only then read the account's status in the Google Admin console.",
    ],
  });
  const pass = howWideBeforeWhy(good, { ticket: GMAIL_DOWN });
  assert.equal(pass.applies, true);
  assert.equal(pass.verdict, 'pass', pass.detail);
  const bad = answer({
    wrong: 'the account may be suspended.',
    steps: [
      'Open the Google Admin console → Directory → Users → [UPN] and check the account is not suspended.',
      'Ask the user to change their password.',
      'Open the Google Workspace Status Dashboard.',
    ],
  });
  const fail = howWideBeforeWhy(bad, { ticket: GMAIL_DOWN });
  assert.equal(fail.verdict, 'fail');
  assert.match(fail.detail, /step 1/);
});

test('task 5c (Microsoft): a status page with no scope in step 1 fails, and so does an account cause before the network', () => {
  const steps = [
    'Find out how wide it is: one person or everyone, one site or all sites, only SharePoint or other internet services too; open Microsoft 365 admin center → Health → Service health.',
    'With no incident listed, test the network path: another network, and name resolution for the SharePoint address.',
    'Read the Entra sign-in logs for [UPN] for a blocked sign-in.',
  ];
  const good = answer({ wrong: 'SharePoint pages time out, and it is not yet known how widely.', steps });
  const pass = howWideBeforeWhy(good, { ticket: SHAREPOINT_DOWN });
  assert.equal(pass.verdict, 'pass', pass.detail);
  const noScope = answer({ wrong: 'SharePoint pages time out.', steps: ['Open Microsoft 365 admin center → Health → Service health.', steps[1], steps[2]] });
  const a = howWideBeforeWhy(noScope, { ticket: SHAREPOINT_DOWN });
  assert.equal(a.verdict, 'fail');
  assert.match(a.detail, /scope/);
  // the scope in step 1 and the status page only in a later step: "together with" means both in step 1
  const lateStatus = answer({ wrong: 'SharePoint pages time out.', steps: ['Find out how wide it is: one person or everyone, one site or all sites, only SharePoint or other internet services too.', steps[1], 'Open Microsoft 365 admin center → Health → Service health.'] });
  const late = howWideBeforeWhy(lateStatus, { ticket: SHAREPOINT_DOWN });
  assert.equal(late.verdict, 'fail');
  assert.match(late.detail, /status page/);
  const accountFirst = answer({ wrong: 'SharePoint pages time out.', steps: [steps[0], 'Read the Entra sign-in logs for [UPN] and check the licence is assigned.', steps[1]] });
  const b = howWideBeforeWhy(accountFirst, { ticket: SHAREPOINT_DOWN });
  assert.equal(b.verdict, 'fail');
  assert.match(b.detail, /network/);
  assert.equal(howWideBeforeWhy(good, { ticket: 'Please add [UPN] to the finance site.' }).applies, false);
});

// ── d. Every change carries its class and its double-check ──────────────────────────────────────
test('task 5d (Microsoft): a plan with several changes lists each with its class and double-check, or no gate and a proof', () => {
  const steps = [
    'Open Entra admin center → Users → [UPN] and read the account state.',
    'Disable the account: Entra admin center → Users → [UPN] → Edit properties → Account enabled off.',
    'Remove the licence under Licenses and apps.',
    'Collect the laptop and badge from [MANAGER_NAME].',
  ];
  const good = answer({
    wrong: 'the contractor leaves today and still has every access.',
    steps,
    details: [
      'Changes in this plan:',
      "- Step 2 (disable the account): R3. Double-check: Aegis reads the account's enabled state.",
      '- Step 3 (remove the licence): R3. Double-check: Aegis reads the licence list.',
      '- Step 4 (collect the laptop): no gate. Proof: the laptop is on the IT shelf with its asset tag checked.',
    ],
    gates: ['example-account-disable-portal', 'example-licence-remove-portal'],
  });
  const pass = changeClassAndCheck(good, {});
  assert.equal(pass.applies, true);
  assert.equal(pass.verdict, 'pass', pass.detail);
  const noChecks = answer({
    wrong: 'the contractor leaves today and still has every access.',
    steps,
    details: ['Step 2 is R3 and step 3 is R3. Both need sign-off.'],
    gates: ['example-account-disable-portal', 'example-licence-remove-portal'],
  });
  const fail = changeClassAndCheck(noChecks, {});
  assert.equal(fail.verdict, 'fail');
  assert.match(fail.detail, /0 of 2/);
});

test('task 5d (Google): one change short of its double-check fails; a single change does not need the list', () => {
  const steps = [
    'Create the account: Google Admin console → Directory → Users → Add new user.',
    'Add [UPN] to the staff group.',
    'Assign the Workspace licence.',
  ];
  const details = [
    'Changes in this plan:',
    '- Step 1 (create the account): R1. Double-check: Aegis reads the new account.',
    '- Step 2 (add to the group): R1. Double-check: Aegis reads the group members.',
    '- Step 3 (assign the licence): R1. Double-check: Aegis reads the licence.',
  ];
  const good = answer({ wrong: 'the new starter has no account yet.', steps, details, gates: ['example-user-create-portal', 'example-group-add-portal', 'example-licence-assign-portal'] });
  assert.equal(changeClassAndCheck(good, {}).verdict, 'pass');
  const short = answer({ wrong: 'the new starter has no account yet.', steps, details: [details[0], details[1], '- Step 2 (add to the group): R1.', details[3]], gates: ['example-user-create-portal', 'example-group-add-portal', 'example-licence-assign-portal'] });
  const fail = changeClassAndCheck(short, {});
  assert.equal(fail.verdict, 'fail');
  assert.match(fail.detail, /2 of 3/);
  const single = answer({ wrong: 'the user is not in the group.', steps: ['Open the group.', 'Read its members.', 'Add [UPN] to the staff group.'], gates: ['example-group-add-portal'] });
  assert.equal(changeClassAndCheck(single, {}).applies, false);
});

// Every runbook line that cites a section 2 rule by name names a rule section 2 holds (fresh-context review of the
// Microsoft lane, finding 3: about 35 runbook lines cite "answer-format section 2" for these rules). Wrong
// implementations it catches: a runbook that cites a rule under a name section 2 does not use (a typo, or a rule
// renamed in one place only), and a matcher that accepts part of a title (the near-miss below must not match).
test('every rule a runbook cites by name from answer-format section 2 is a rule title there', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..', '..');
  const doc = fs.readFileSync(path.join(root, 'docs', 'aegis', 'answer-format.md'), 'utf8');
  const section2 = doc.slice(doc.indexOf('## 2.'), doc.indexOf('\n## 3.'));
  const titles = new Set([...section2.matchAll(/^\*\*([^*]+?)\.\*\*/gm)].map((m) => m[1]));
  assert.ok(titles.has('Who else, and what left'), 'the reader finds the titles');
  assert.ok(!titles.has('Who else and what left'), 'a near-miss is not a title');
  const dir = path.join(root, '.claude', 'commands');
  const cited = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/answer-format section 2, "([^"]+)"/g)) cited.push([f, m[1]]);
  }
  assert.ok(cited.length >= 30, `the runbooks cite section 2 rules by name (${cited.length})`);
  assert.deepEqual(cited.filter(([, name]) => !titles.has(name)), [], 'a cited name that is not a section 2 rule title');
});

// Code review round 1, finding 6: the lost-device trigger read "left", "new" and a plain "sign in" as a lost or
// replaced sign-in device, so "I left my phone at home today and cannot sign in" asked for a step that deletes a method
// that still works. The rule is about the device that holds a sign-in method, so the ticket must name that method.
// Wrong implementation it catches: a trigger on a device word, a change word and any sign-in word.
test('code review 1: the new-way-in rule applies when the ticket names the sign-in method on a lost or replaced device, not to a phone left at home', () => {
  const { lostSignInDevice } = require('./senior-rules.js');
  for (const not of ['I left my phone at home today and cannot sign in.', 'Setting up Outlook on my new phone, it keeps asking me to sign in.', 'Can you reset my password? I am locked out on my old laptop.']) {
    assert.equal(lostSignInDevice(not), false, not);
  }
  for (const yes of ['[FIRST_NAME] left her phone on the train yesterday. Microsoft Authenticator was on it.', 'My phone was swapped under warranty and Okta Verify did not come across to the new one.', 'Locked out after a phone change, Authenticator gone.', 'I lost my phone and the 2-step codes were on it.', 'My YubiKey snapped, so I cannot use my security key.']) {
    assert.equal(lostSignInDevice(yes), true, yes);
  }
});
