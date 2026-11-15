'use strict';
require('../adapters/socket-tripwire.js');
// assumed-setup.test.js: the desk row "assumed setup" (batch 11, task 2).
//
// EXPECTED DECISION (written before senior-rules.js)
// - When no company profile or setup was given and the ticket names no system, the first line under "## Fix" is
//   "Assumed setup: <the systems this answer assumes> (no company profile given)." and it is not counted in the
//   card's 150 words.
// - When a setup was given, the answer does not carry a line that says none was, and it gives no admin path for a
//   system the setup does not list (Microsoft, Google, Okta or Jamf).
// - When the given setup lacks the system the ticket is about, the line is there and names that system.
// The fixtures are about none of the demo's tickets.
// A wrong implementation each test catches: a row that only looks for the words "Assumed setup" anywhere in the
// answer (the line under Details fails); one that asks for the line on every answer (the three setup-given answers
// would fail); one that never reads the setup (the two Microsoft-path answers would pass); a word count that
// counts the line (the 150-word card would fail its own row).
// Run: node --test scripts/demo/assumed-setup.test.js

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { fixCard, answerChecks } = require('./answer.js');
const { assumedSetup } = require('./senior-rules.js');

// A card with the six parts; first: the lines directly under the heading; steps: the three numbered steps.
const answer = ({ first = [], steps, details = 'Nothing else changes.' }) => [
  '## Fix',
  ...first,
  "**What's wrong:** the account cannot finish its first sign-in.",
  '**Do this:**',
  ...steps.map((s, i) => `${i + 1}. ${s}`),
  '**Done when:** the person reaches their inbox.',
  '**Stop if:** the account does not exist; then this is a new-account request.',
  '**Tell the user now:** IT is looking at your sign-in. Please keep your laptop on.',
  '**Tell the user when done:** Please try to sign in again.',
  '',
  '## Details',
  details,
  '',
  '```aegis-desk',
  'Gate: none',
  '```',
].join('\n');

const MICROSOFT_STEPS = ['Open Entra admin center → Users → [UPN] and read the sign-in status.', 'Read the latest entry under Sign-in logs.', 'Ask [FIRST_NAME] to sign in again.'];
const GOOGLE_STEPS = ['Open the Google Admin console → Directory → Users → [UPN] and read the account status.', 'Read the latest login event under Reporting.', 'Ask [FIRST_NAME] to sign in again.'];
const OKTA_STEPS = ['Open the Okta Admin Console → Directory → People → [UPN] and read the status.', 'Read the latest event in the System Log.', 'Ask [FIRST_NAME] to sign in again.'];
const NO_PROFILE = '(no company profile given).';

test('task 2: three answers that must carry the line: no setup given and a ticket that names no system', () => {
  const cases = [
    { ticket: 'A new starter cannot sign in on her first day.', line: `Assumed setup: Microsoft 365 with hybrid Active Directory ${NO_PROFILE}`, steps: MICROSOFT_STEPS },
    { ticket: 'Someone at the front desk says the company apps never showed up on the new laptop.', line: `Assumed setup: Microsoft 365 and Intune ${NO_PROFILE}`, steps: MICROSOFT_STEPS },
    { ticket: 'The shared calendar vanished for two people in accounts this morning.', line: `**Assumed setup:** Microsoft 365 with Exchange Online ${NO_PROFILE}`, steps: MICROSOFT_STEPS },
  ];
  for (const c of cases) {
    const withLine = assumedSetup(answer({ first: [c.line], steps: c.steps }), { setup: null, ticket: c.ticket });
    assert.equal(withLine.verdict, 'pass', `${c.ticket}: ${withLine.detail}`);
    const without = assumedSetup(answer({ steps: c.steps }), { setup: null, ticket: c.ticket });
    assert.equal(without.verdict, 'fail', c.ticket);
    assert.match(without.detail, /Assumed setup/);
  }
});

test('task 2: the line counts only directly under the heading, with the systems and the words that no profile was given', () => {
  const ticket = 'A new starter cannot sign in on her first day.';
  const underDetails = answer({ steps: MICROSOFT_STEPS, details: `Assumed setup: Microsoft 365 ${NO_PROFILE}` });
  assert.equal(assumedSetup(underDetails, { setup: null, ticket }).verdict, 'fail', 'a line under Details is not the line');
  const afterParts = answer({ steps: MICROSOFT_STEPS }).replace('**Do this:**', `Assumed setup: Microsoft 365 ${NO_PROFILE}\n**Do this:**`);
  assert.equal(assumedSetup(afterParts, { setup: null, ticket }).verdict, 'fail', 'a line after "What\'s wrong" is not directly under the heading');
  const noSystems = answer({ first: [`Assumed setup: ${NO_PROFILE}`], steps: MICROSOFT_STEPS });
  assert.equal(assumedSetup(noSystems, { setup: null, ticket }).verdict, 'fail', 'the line names the systems');
  const noReason = answer({ first: ['Assumed setup: Microsoft 365.'], steps: MICROSOFT_STEPS });
  assert.equal(assumedSetup(noReason, { setup: null, ticket }).verdict, 'fail', 'the line says no company profile was given');
});

test('task 2: three answers that must not carry the line: a setup was given', () => {
  const cases = [
    { setup: 'Google Workspace for mail and files, Okta for sign-in, Jamf Pro for the Macs.', steps: OKTA_STEPS },
    { setup: 'Microsoft 365 Business Standard, Entra ID, Intune for the laptops.', steps: MICROSOFT_STEPS },
    { setup: 'Okta is the identity provider. Slack and Google Workspace sit behind it.', steps: GOOGLE_STEPS },
  ];
  const ticket = 'A new starter cannot sign in on her first day.';
  for (const c of cases) {
    const clean = assumedSetup(answer({ steps: c.steps }), { setup: c.setup, ticket });
    assert.equal(clean.verdict, 'pass', `${c.setup}: ${clean.detail}`);
    const carried = assumedSetup(answer({ first: [`Assumed setup: Microsoft 365 ${NO_PROFILE}`], steps: c.steps }), { setup: c.setup, ticket });
    assert.equal(carried.verdict, 'fail', c.setup);
    assert.match(carried.detail, /was given/);
  }
});

test('task 2: with a Google or Okta setup given, a Microsoft admin path in the answer fails the row', () => {
  const ticket = 'A new starter cannot sign in on her first day.';
  const google = assumedSetup(answer({ steps: MICROSOFT_STEPS }), { setup: 'Google Workspace only; the laptops are Chromebooks.', ticket });
  assert.equal(google.verdict, 'fail');
  assert.match(google.detail, /Microsoft/);
  const okta = assumedSetup(answer({ steps: ['Open the Okta Admin Console → Directory → People → [UPN].', 'Then open Microsoft 365 admin center → Users → Active users → [UPN] and read the licence.', 'Ask [FIRST_NAME] to sign in again.'] }), { setup: 'Okta for sign-in, Slack, Jamf Pro.', ticket });
  assert.equal(okta.verdict, 'fail');
  assert.match(okta.detail, /Microsoft/);
  // the same paths with a setup that lists the system pass
  assert.equal(assumedSetup(answer({ steps: MICROSOFT_STEPS }), { setup: 'Microsoft 365 and Okta.', ticket }).verdict, 'pass');
  // a path named only inside the aegis-desk block is the desk's, not the tech's
  const inBlock = answer({ steps: OKTA_STEPS }).replace('Gate: none', 'Gate: none\nNote: not the Entra admin center → Users path');
  assert.equal(assumedSetup(inBlock, { setup: 'Okta for sign-in, Slack, Jamf Pro.', ticket }).verdict, 'pass');
});

test('task 2: a setup that lacks the system the ticket is about: the line names the missing system', () => {
  const setup = 'Google Workspace and Okta. The laptops are Macs.';
  const ticket = 'Intune shows my laptop as not compliant since the update.';
  const steps = ['Open Intune admin center → Devices → All devices → [DEVICE_NAME] and read Device compliance.', 'Ask [FIRST_NAME] to sync the device from the Company Portal app.', 'Read the compliance state again.'];
  const said = assumedSetup(answer({ first: ['Assumed setup: Microsoft Intune (the setup given does not list Intune).'], steps }), { setup, ticket });
  assert.equal(said.verdict, 'pass', said.detail);
  const silent = assumedSetup(answer({ steps }), { setup, ticket });
  assert.equal(silent.verdict, 'fail');
  assert.match(silent.detail, /Microsoft/);
  const wrongSystem = assumedSetup(answer({ first: ['Assumed setup: Jamf Pro (the setup given does not list Jamf).'], steps }), { setup, ticket });
  assert.equal(wrongSystem.verdict, 'fail', 'the line must name the system the ticket is about');
});

test('task 2: no setup given and a ticket that names its system: the line is not required', () => {
  const row = assumedSetup(answer({ steps: OKTA_STEPS }), { setup: null, ticket: 'Okta keeps telling [FIRST_NAME] the account is locked.' });
  assert.equal(row.verdict, 'pass', row.detail);
});

test('task 2: the line is not counted in the card\'s words, and the card still reads its six parts', () => {
  const body = answer({ steps: MICROSOFT_STEPS });
  const lined = answer({ first: [`Assumed setup: Microsoft 365 with hybrid Active Directory and Intune ${NO_PROFILE}`], steps: MICROSOFT_STEPS });
  const plain = fixCard(body);
  const card = fixCard(lined);
  assert.equal(card.words, plain.words, 'the same count with and without the line');
  assert.match(card.assumed, /^Assumed setup: Microsoft 365/);
  assert.equal(plain.assumed, null);
  assert.deepEqual(card.order, ['wrong', 'doThis', 'doneWhen', 'stopIf', 'tellNow', 'tellDone']);
  assert.equal(card.steps.length, 3);
  // the existing six rows read the lined answer as they read the plain one (the profile has the facts the line names,
  // so the customer-facts row, which reads the whole answer, has nothing to say about either)
  const profile = 'Microsoft 365, hybrid Active Directory synced by Entra Connect, Intune.';
  assert.deepEqual(answerChecks(lined, { profile, ticket: '' }).map((r) => r.verdict), ['pass', 'pass', 'pass', 'pass', 'pass', 'pass']);
  assert.deepEqual(answerChecks(body, { profile, ticket: '' }).map((r) => r.verdict), ['pass', 'pass', 'pass', 'pass', 'pass', 'pass']);
});

// Code review round 1, finding 4: a setup that says what the company does NOT run ("No Microsoft 365 and no Active
// Directory") was read as listing it, because the row searched the setup for the name. Wrong implementation it
// catches: a plain name search of the setup. A setup that does list the system still passes the same answer.
test('code review 1: a system the setup says the company does not run is not listed by it', () => {
  const ticket = 'A new starter cannot sign in on her first day.';
  const setup = 'Google Workspace Business Standard for mail, calendar and files. Chromebooks, managed in the Google Admin console. No Microsoft 365 and no Active Directory.';
  const walked = assumedSetup(answer({ steps: MICROSOFT_STEPS }), { setup, ticket });
  assert.equal(walked.verdict, 'fail', walked.detail);
  assert.match(walked.detail, /Microsoft admin path/);
  assert.equal(assumedSetup(answer({ steps: GOOGLE_STEPS }), { setup, ticket }).verdict, 'pass');
  for (const not of ['Okta for sign-in; not Microsoft.', 'Okta, without Microsoft 365.', 'Okta and Slack, never Microsoft 365.']) {
    assert.equal(assumedSetup(answer({ steps: MICROSOFT_STEPS }), { setup: not, ticket }).verdict, 'fail', not);
  }
  // a Microsoft ticket under that setup: the line must say Microsoft is missing
  const msTicket = assumedSetup(answer({ steps: GOOGLE_STEPS }), { setup, ticket: 'Outlook will not open for the new starter.' });
  assert.equal(msTicket.verdict, 'fail');
  assert.match(msTicket.detail, /Microsoft, which the setup given does not list/);
  assert.equal(assumedSetup(answer({ steps: MICROSOFT_STEPS }), { setup: 'Microsoft 365, but no Intune.', ticket }).verdict, 'pass', 'a negation of another product leaves Microsoft listed');
});

// Code review round 2, findings 1, 2, 3 and 8 (one class: how the row reads a negation). Wrong implementations they
// catch: a negation that stops at "or" or does not know "neither", "don't use" or "is not used" (Microsoft would read
// as listed); one that strips any clause after "not" (a not-for-profit on Microsoft 365, or "not local admins on
// Intune-managed laptops", would lose Microsoft); and an Assumed setup line that says the system is absent but still
// excuses its admin path.
test('code review 2: a negation takes out only the systems it governs, in the setup and in the Assumed setup line', () => {
  const ticket = 'A new starter cannot sign in on her first day.';
  for (const setup of ['Google Workspace. No Microsoft 365 or Active Directory.', 'Google Workspace; neither Microsoft 365 nor Entra.', 'Google Workspace, not Microsoft 365 or Intune.', "Google Workspace only; we don't use Microsoft 365.", 'Google Workspace. Microsoft 365 is not used here.', 'Google Workspace. We dropped Microsoft 365 last year.']) {
    assert.equal(assumedSetup(answer({ steps: MICROSOFT_STEPS }), { setup, ticket }).verdict, 'fail', setup);
  }
  for (const setup of ['A not-for-profit on Microsoft 365 Business Premium.', 'Hybrid AD. Staff are not local admins on Intune-managed laptops.', 'Microsoft 365, but no Intune.']) {
    assert.equal(assumedSetup(answer({ steps: MICROSOFT_STEPS }), { setup, ticket }).verdict, 'pass', setup);
  }
  const setup = 'Google Workspace for mail and files. No Microsoft 365.';
  for (const line of ['Assumed setup: Google Workspace, not Microsoft.', 'Assumed setup: Google Workspace; the setup lacks Microsoft 365.']) {
    const r = assumedSetup(answer({ first: [line], steps: MICROSOFT_STEPS }), { setup, ticket });
    assert.equal(r.verdict, 'fail', line);
    assert.match(r.detail, /Microsoft admin path/);
  }
});

// Code review round 3, findings 1, 2 and 12 (one class: what a negation takes out). Round 2 ran a negation past commas
// and stripped any "X is not used" clause, so a cloud-only Microsoft shop ("We don't have Active Directory, just Entra
// ID and Intune") lost Microsoft; and a curly apostrophe hid "don't". A negation now goes past a comma only while the
// list goes on with bare system names; "is not used" takes out its clause only when a system is its subject; curly
// apostrophes read as straight. Wrong implementations they catch: each of those three.
test('code review 3: a negation stops at a comma unless its list goes on; "is not used" needs a system as its subject; curly apostrophes count', () => {
  const outlook = 'Outlook will not open for the new starter.';
  for (const setup of ["We don't have Active Directory, just Entra ID and Intune.", 'No VPN, Microsoft 365 for mail and Teams.', 'Google Workspace, no Okta, Microsoft 365 for Teams calls.', 'Intune manages laptops and personal phones are not used for work.']) {
    const r = assumedSetup(answer({ steps: MICROSOFT_STEPS }), { setup, ticket: outlook });
    assert.equal(r.verdict, 'pass', `${setup}: ${r.detail}`);
  }
  const ticket = 'A new starter cannot sign in on her first day.';
  for (const setup of ['Google Workspace only; we don’t use Microsoft 365.', 'Google Workspace. No Microsoft 365, Intune or Entra.']) {
    assert.equal(assumedSetup(answer({ steps: MICROSOFT_STEPS }), { setup, ticket }).verdict, 'fail', setup);
  }
});
