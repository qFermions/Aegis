'use strict';
require('../adapters/socket-tripwire.js');
// answer.test.js: the Fix card and the aegis-desk block (batch 8, tasks 1 and 8).
//
// EXPECTED DECISION (written before answer.js)
// - Task 1: an answer starts with "## Fix" holding, in order, What's wrong, Do this (3 to 5 numbered
//   steps), Done when, Stop if and Tell the user (at most 3 sentences; batch 9 split it into "Tell the user
//   now" and "Tell the user when done", user-messages.test.js); the card is at most 150 words and
//   holds no command and nothing that belongs only to the desk (a gate id the runbooks hold, a Gate line,
//   an R class, a change record); the fenced aegis-desk block closes the answer. Three fixture answers
//   (routine, multi-system, security) pass; the fixtures are about none of the demo's tickets.
// - Task 8: five answer checks, pass or fail each: card first, five parts in order, card at most 150
//   words, no command outside the aegis-desk block, no default-environment fact the customer profile lacks.
// A wrong implementation each test catches: a parser that finds the card anywhere (the "first" case); one
// that checks the labels are present but not their order (the swapped case); a word count that misses a
// long part (the 151-word case); a command scan that also reads the block (the command-inside-the-block
// case); a fact check that ignores the profile (the hybrid case passes only when the profile has it).
// Run: node --test scripts/demo/answer.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const a = require('./answer.js');
const { catalog } = require('./catalog.js');

const FIXTURES = path.join(__dirname, 'fixtures', 'answers');
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, `${name}.txt`), 'utf8');
const KINDS = ['routine', 'multi-system', 'security'];
const card = (lines) => ['## Fix', ...lines].join('\n');
const GOOD_PARTS = [
  "**What's wrong:** the user has no access to the calendar.",
  '**Do this:**',
  '1. Open the admin center.',
  '2. Find the group.',
  '3. Add the user.',
  '**Done when:** the calendar opens.',
  '**Stop if:** the user is already a member.',
  '**Tell the user now:** IT is adding you. Reopen Outlook when we message you.',
  '**Tell the user when done:** You are in the group. Reopen Outlook.',
];

test('task 1: each fixture answer opens with the card, has the five parts in order, at most 150 words, no command, no desk-only text, and the aegis-desk block last', () => {
  const ids = catalog();
  for (const kind of KINDS) {
    const text = fixture(kind);
    const c = a.fixCard(text);
    assert.ok(c.present && c.first, `${kind}: the card comes first`);
    assert.deepEqual(c.order, ['wrong', 'doThis', 'doneWhen', 'stopIf', 'tellNow', 'tellDone'], `${kind}: the six parts in order (batch 9)`);
    assert.deepEqual(a.cardProblems(c), [], kind);
    assert.ok(c.words <= 150, `${kind}: ${c.words} words`);
    assert.equal(a.commandIn(c.text), null, `${kind}: no command in the card`);
    assert.equal(a.deskOnlyIn(c.text, ids), null, `${kind}: no gate id, Gate line, R class or change record in the card`);
    const block = a.deskBlock(text);
    assert.ok(block.present, `${kind}: the aegis-desk block closes the answer`);
    assert.ok(block.lines.some((l) => /^Gate: /.test(l)), `${kind}: the block holds the Gate lines`);
    assert.equal(a.commandIn(block.body), null, `${kind}: no command anywhere outside the block`);
  }
  assert.match(a.fixCard(fixture('multi-system')).text, /see Details/, 'a long ticket says so in one line');
  assert.match(a.fixCard(fixture('security')).text, /full plan is in Details/);
});

test('task 1: each break of the format is caught', () => {
  const ids = catalog();
  const later = `## Verdict\nIt is the calendar.\n\n${card(GOOD_PARTS)}`;
  assert.equal(a.fixCard(later).first, false, 'a card after another section is not first');
  const swapped = card([GOOD_PARTS[0], ...GOOD_PARTS.slice(5, 7), ...GOOD_PARTS.slice(1, 5), GOOD_PARTS[7]]);
  assert.ok(a.cardProblems(a.fixCard(swapped)).some((p) => /out of order/.test(p)));
  assert.ok(a.cardProblems(a.fixCard(card(GOOD_PARTS.filter((l) => !/Stop if/.test(l))))).some((p) => /no Stop if/.test(p)));
  assert.ok(a.cardProblems(a.fixCard(card(GOOD_PARTS.filter((l) => !/^3\./.test(l))))).some((p) => /2 numbered steps/.test(p)));
  const sixSteps = card([...GOOD_PARTS.slice(0, 5), '4. a', '5. b', '6. c', ...GOOD_PARTS.slice(5)]);
  assert.ok(a.cardProblems(a.fixCard(sixSteps)).some((p) => /6 numbered steps/.test(p)));
  const chatty = card([...GOOD_PARTS.slice(0, 7), '**Tell the user:** One. Two. Three. Four.']);
  assert.ok(a.cardProblems(a.fixCard(chatty)).some((p) => /4 sentences/.test(p)));
  const long = card([...GOOD_PARTS.slice(0, 7), `**Tell the user:** ${'word '.repeat(140)}.`]);
  assert.ok(a.fixCard(long).words > 150, `${a.fixCard(long).words} words`);
  assert.equal(a.commandIn(card([...GOOD_PARTS, 'Then run `node scripts/adapters/msgraph-client.js verify-mfa-method --execute`.'])), 'node scripts/adapters/msgraph-client.js');
  assert.ok(a.commandIn('npm test'), 'a package tool');
  assert.equal(a.commandIn('Run Get-Mailbox in PowerShell, for reference only.'), null, 'a PowerShell cmdlet is not a script command');
  assert.equal(a.deskOnlyIn(card([...GOOD_PARTS, 'Use [mfa-session-revoke-portal].']), ids), 'mfa-session-revoke-portal', 'a real gate id');
  assert.equal(a.deskOnlyIn('step-by-step and re-register', ids), null, 'a hyphenated word that is no gate');
  assert.ok(a.deskOnlyIn('This is an R2 change.', ids));
  assert.ok(a.deskOnlyIn('Open a change record first.', ids));
  const trailing = `${fixture('routine')}\nOne more line after the block.`;
  assert.equal(a.deskBlock(trailing).present, false, 'a block that does not close the answer is no block');
  assert.equal(a.deskBlock(`${card(GOOD_PARTS)}\n\n\`\`\`bash\nGate: x-y\n\`\`\``).present, false, 'another fence is no block');
});

test('task 8: the five answer checks, in page order, pass on a good answer and each fails on its own break', () => {
  const good = fixture('routine');
  const rows = a.answerChecks(good, { profile: 'Platform stack: Microsoft 365' });
  // batch 9, task 2 added the sixth row, user-message-now (its own cases are in user-messages.test.js)
  assert.deepEqual(rows.map((r) => r.check), ['fix-card-first', 'fix-card-parts', 'fix-card-words', 'no-command', 'customer-facts', 'user-message-now']);
  assert.deepEqual(rows.map((r) => r.verdict), ['pass', 'pass', 'pass', 'pass', 'pass', 'pass']);
  for (const r of rows) assert.ok(r.plain && r.detail, r.check);
  const verdicts = (text, profile = '') => Object.fromEntries(a.answerChecks(text, { profile }).map((r) => [r.check, r.verdict]));
  assert.equal(verdicts(`Intro line.\n${good}`)['fix-card-first'], 'fail');
  assert.equal(verdicts('No card at all.\n```aegis-desk\nGate: none\n```')['fix-card-parts'], 'fail');
  assert.equal(verdicts(good.replace('**Tell the user now:**', `**Tell the user now:** ${'many '.repeat(40)}.`))['fix-card-words'], 'fail');
  assert.equal(verdicts(good.replace('## Details', '## Details\nRun `node scripts/audit/change-record.js open` first.'))['no-command'], 'fail');
  assert.equal(verdicts(good.replace('Gate: example-group-add-portal', 'Gate: example-group-add-portal\nnode scripts/audit/change-record.js open'))['no-command'], 'pass', 'a command inside the aegis-desk block is the desk\'s');
  const hybrid = good.replace('## Details', '## Details\nForce a sync with Entra Connect after the change.');
  assert.equal(verdicts(hybrid, 'Platform stack: Microsoft 365')['customer-facts'], 'fail', 'a default fact this customer does not have');
  assert.equal(verdicts(hybrid, 'Platform stack: Microsoft 365, hybrid Active Directory')['customer-facts'], 'pass', 'the profile has it');
  assert.equal(verdicts(good.replace('## Details', '## Details\nThe SMS fallback still works.'), 'MFA: Microsoft Authenticator only')['customer-facts'], 'fail');
  assert.equal(verdicts(good.replace('## Details', '## Details\nCall [@Aegion_NETPARTNER].'))['customer-facts'], 'fail', 'the default organization\'s vendor');
  assert.equal(verdicts(good.replace('## Details', '## Details\nThe user is at [@Aegion_DOMAIN].'))['customer-facts'], 'pass', 'the domain placeholder is every customer\'s');
});

test('the INVESTIGATE step rule: steps that only look pass, a step that changes something does not', () => {
  const t5 = fs.readFileSync(path.join(__dirname, 'fixtures', 'full-run-1', 'T5-answer.txt'), 'utf8');
  const looks = a.onlyLooks(t5);
  assert.ok(looks.steps.length >= 3, `T5 lists its steps: ${looks.steps.join(' | ')}`);
  assert.equal(looks.looks, true, `no step changes anything: ${looks.change}`);
  const change = card([...GOOD_PARTS.slice(0, 2), '1. Open Defender, Quarantine.', '2. Release the held message to [UPN].', '3. Read the trace.', ...GOOD_PARTS.slice(5)]);
  assert.equal(a.onlyLooks(change).looks, false);
  assert.match(a.onlyLooks(change).change, /Release/);
  assert.equal(a.onlyLooks('Nothing to change here.').looks, false, 'no step at all is not an investigation');
  for (const word of ['reset', 'Removed', 'adding', 'turn off', 'deleting']) assert.ok(a.CHANGE_WORD.test(`1. ${word} it`), word);
  for (const word of ['address', 'settings', 'readd', 'presets']) assert.equal(a.CHANGE_WORD.test(word), false, word);
});

// Code review 1, findings 6, 7 and 10. Wrong implementations they catch: a card parser that ends "Do this"
// at the blank line before its list (0 steps); a fact check that treats every [@Aegion_*] token as the
// default organization's (the runbooks use [@Aegion_GITHUB_ORG] for any customer); a word count that
// splits [FIRST_NAME] into two words.
test('a blank line inside "Do this" keeps its steps; only the default block\'s tokens are its facts; a placeholder is one word', () => {
  const spaced = card([GOOD_PARTS[0], GOOD_PARTS[1], '', '1. Open the admin center.', '', '2. Find the group.', '', '3. Add the user.', '', ...GOOD_PARTS.slice(5)]);
  const c = a.fixCard(spaced);
  assert.equal(c.steps.length, 3);
  assert.deepEqual(a.cardProblems(c), []);
  assert.equal(a.onlyLooks(`${spaced}\n\n## Details\n1. Reset the password for [UPN].`).steps.length, 3, 'the card\'s steps, not the Details list');
  assert.deepEqual(a.defaultFactsIn('Open github.com/orgs/[@Aegion_GITHUB_ORG] and [@Aegion_OKTA_ORG_URL].', ''), []);
  // code review 2, findings 4 and 7: the default organization's own tokens are the dictionary's, and the Jira
  // tokens belong to the Jira fact alone
  for (const token of ['[@Aegion]', '[@Aegion_SITE_2]', '[@Aegion_NETPARTNER]', '[@Aegion_REMOTE_ACCESS]', '[@Aegion_VOIP_URL]', '[@Aegion_SITE_COUNT]']) assert.ok(a.defaultFactsIn(`Ask ${token}.`, '').includes("the default organization's own sites, vendors and servers"), token);
  assert.deepEqual(a.defaultFactsIn('File it in [@Aegion_JIRA_SPACE] at [@Aegion_JIRA_URL].', 'We use Jira Service Management.'), []);
  assert.deepEqual(a.defaultFactsIn('File it in [@Aegion_JIRA_SPACE].', ''), ['Jira Service Management']);
  assert.equal(a.words('[FIRST_NAME] at [@Aegion_DOMAIN]'), 3);
});

// Security review 2: a step that runs onto a second line must not hide the steps after it, or a change
// answer reads as look-only. A wrong implementation it catches: ending "Do this" at the wrapped line.
test('a wrapped or bulleted line inside a step keeps the later steps, so a change is still seen', () => {
  const wrapped = card([GOOD_PARTS[0], GOOD_PARTS[1], '1. Open Entra admin center and find the user', '   under Users, All users.', '   - check the sign-in logs too', '2. Delete the user account.', '3. Reset the password.', ...GOOD_PARTS.slice(5)]);
  const c = a.fixCard(wrapped);
  assert.equal(c.steps.length, 3);
  assert.match(c.steps[0], /under Users, All users\. check the sign-in logs too$/);
  const look = a.onlyLooks(wrapped);
  assert.equal(look.looks, false);
  assert.match(look.change, /Delete/);
});

// Code review 2, finding 1: a step's second line that is not indented must not end "Do this" either.
test('an unindented wrapped line inside a step keeps the later steps', () => {
  const wrapped = card([GOOD_PARTS[0], GOOD_PARTS[1], '1. Open the Entra admin center and find the user', 'under Users, All users.', '2. Delete the user account.', '3. Reset the password.', ...GOOD_PARTS.slice(5)]);
  assert.equal(a.fixCard(wrapped).steps.length, 3);
  assert.equal(a.onlyLooks(wrapped).looks, false);
});

// Security review 3: a change word before the first step, on the "Do this" line itself, or in a numbered
// line filed under another part must still count. A wrong implementation it catches: scanning only steps.
test('a change hidden before the first step, on the label line, or after a stray label still counts', () => {
  const before = card([GOOD_PARTS[0], GOOD_PARTS[1], "- Reset the user's MFA methods in Entra.", '1. Open the admin center.', '2. Read the sign-in logs.', '3. Look at the user page.', ...GOOD_PARTS.slice(5)]);
  assert.equal(a.onlyLooks(before).looks, false);
  const label = card([GOOD_PARTS[0], '**Do this:** reset the MFA, then check:', '1. Open the admin center.', '2. Read the sign-in logs.', '3. Look at the user page.', ...GOOD_PARTS.slice(5)]);
  assert.equal(a.onlyLooks(label).looks, false);
  const stray = card([GOOD_PARTS[0], GOOD_PARTS[1], '1. Open the admin center.', '2. Read the sign-in logs.', '**Tell the user:** We are on it.', '3. Reset the MFA methods.', ...GOOD_PARTS.slice(5, 7)]);
  assert.equal(a.onlyLooks(stray).looks, false);
  assert.equal(a.onlyLooks(card([...GOOD_PARTS.slice(0, 2), '1. Open the admin center.', '2. Read the sign-in logs.', '3. Look at the user page.', ...GOOD_PARTS.slice(5)])).looks, true, 'a card that only looks still does');
});

// Code review 3, findings 3 and 4. Wrong implementations they catch: counting an indented sub-item as a
// step (a 4-step card read as 7); missing the bold-number form "**1.** Open" (a good card read as 0 steps).
test('an indented numbered sub-item is part of its step, and a bold number starts a step', () => {
  const nested = card([GOOD_PARTS[0], GOOD_PARTS[1], '1. Open the admin center.', '   1. Click Users.', '   2. Click All users.', '2. Find the group.', '3. Read its members.', '4. Read the owner.', ...GOOD_PARTS.slice(5)]);
  assert.equal(a.fixCard(nested).steps.length, 4);
  assert.match(a.fixCard(nested).steps[0], /Click Users\. 2\. Click All users\.$/);
  const bold = card([GOOD_PARTS[0], GOOD_PARTS[1], '**1.** Open the admin center.', '**2.** Find the user.', '**3.** Read the user.', ...GOOD_PARTS.slice(5)]);
  assert.equal(a.fixCard(bold).steps.length, 3);
  assert.deepEqual(a.cardProblems(a.fixCard(bold)), []);
});

// Code review 3, findings 10 and 11: the default organization's tokens come from the placeholder dictionary,
// so a token added there is known here. A wrong implementation it catches: a hand-copied list, which would
// miss the fixture's new site token.
test('the default organization\'s tokens are read from the dictionary, without the connection tokens', (t) => {
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-dict-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'dict.md');
  // the invented tokens are built at run time, as customers.test.js builds its addresses, so the repository's
  // rule that every org token in a tracked file is a dictionary token holds for this file
  const tok = (name) => `[@Aegion_${name}]`;
  fs.writeFileSync(file, ['# dict', '## Org tokens', '| Token | Description |', '|---|---|', '| `[@Aegion]` | name |', `| \`${tok('SITE_9')}\` | a new site |`, `| \`${tok('OKTA_NEW')}\` | an Okta host |`, '| `[@Aegion_JIRA_URL]` | Jira |', '## Generic tokens', `| \`${tok('NOT_ORG')}\` | elsewhere |`, ''].join('\n'));
  assert.deepEqual(a.defaultOrgTokens(file), ['[@Aegion]', tok('SITE_9')]);
  const real = a.defaultOrgTokens();
  for (const tok of ['[@Aegion_SIZE]', '[@Aegion_REMOTE_ACCESS]', '[@Aegion_VOIP_URL]']) assert.ok(real.includes(tok), tok);
  for (const tok of ['[@Aegion_DOMAIN]', '[@Aegion_GITHUB_ORG]', '[@Aegion_OKTA_ORG_URL]', '[@Aegion_JIRA_SPACE]']) assert.ok(!real.includes(tok), tok);
});

// Final security review: indenting a numbered change step two spaces or a tab must not hide it from the
// change scan, with or without a card. A wrong implementation it catches: scanning with the card's narrow
// step pattern.
test('an indented numbered change line is still scanned, with or without a card', () => {
  const noCard = "1. Open the Entra sign-in logs for [UPN].\n   2. Reset the user's MFA methods.\n\t3. Disable the account.";
  assert.equal(a.onlyLooks(noCard).looks, false);
  const stray = card([GOOD_PARTS[0], GOOD_PARTS[1], '1. Open the logs.', '2. Read the user page.', '**Tell the user:** We are on it.', '  3. Reset the MFA methods.', ...GOOD_PARTS.slice(5, 7)]);
  assert.equal(a.onlyLooks(stray).looks, false);
});

// Security review 5: the forms a step can take, and the rest of a card, cannot hide a change. Wrong
// implementations it catches: a scan of plain numbered lines only; a scan blind to a no-break space, a
// full-width digit or a zero-width space; a card scan that skips Details' list lines or "Done when".
test('a change in any step form, in odd characters, in another card part or in a Details list is still seen', () => {
  const look = '1. Open the Entra sign-in logs for [UPN].';
  const plainCard = card([GOOD_PARTS[0], GOOD_PARTS[1], '1. Open the logs.', '2. Read the user page.', '3. Read the device list.', '**Done when:** the logs show it.', ...GOOD_PARTS.slice(6)]);
  assert.equal(a.onlyLooks(plainCard).looks, true, 'a card that only looks still does');
  for (const hidden of ['(2) Reset MFA.', '2. Reset MFA.', '  2. Reset MFA.', '> 2. Reset MFA.', '- 2. Reset MFA.', '2.Reset MFA.', '２. Reset MFA.', '2. Re​set MFA.']) {
    assert.equal(a.onlyLooks(`${look}\n${hidden}`).looks, false, JSON.stringify(hidden));
  }
  // batch 9, task 9 changed this on purpose: with a card, a Details line mentions a change, it does not ask
  // for one (batch 8's T5 Details said "a release or an allow entry needs..."), so Details is not read; the
  // card's own lines still are, and with no card every numbered line still is. INVESTIGATE approves and
  // applies nothing, so a Details mention can only label a ticket, never change a tenant.
  assert.equal(a.onlyLooks(`${plainCard}\n\n## Details\n1. Reset the MFA methods.`).looks, true, 'a numbered Details line is a mention');
  assert.equal(a.onlyLooks(`${plainCard}\n\n## Details\n- Remove the old phone.`).looks, true, 'a bulleted Details line is a mention');
  assert.equal(a.onlyLooks(`${look}\n\n## Details\n1. Reset the MFA methods.`).looks, false, 'with no card, every numbered line is still read');
  assert.equal(a.onlyLooks(plainCard.replace('the logs show it', 'you have reset the MFA methods')).looks, false, 'a change in Done when');
});

// Batch 9, beyond the task: batch 8's T1 failed "customer facts" on "No SMS fallback added (per customer
// profile)", a sentence that says the opposite (full-run-2/causes.md). A wrong implementation it catches: a
// fact check that matches a mention whether or not a negation opens its clause, and one that drops the
// fact everywhere once any negation is on the line.
test('a default fact a negation opens its clause with is not the answer using that fact', () => {
  const t1 = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'aegis', 'demo', 'evidence', 'full-run-2', 'answers', 'T1-answer.txt'), 'utf8');
  assert.deepEqual(a.defaultFactsIn(t1, 'MFA: Microsoft Authenticator only'), []);
  assert.deepEqual(a.defaultFactsIn('No SMS fallback added.', ''), []);
  assert.deepEqual(a.defaultFactsIn('Do not use the SMS fallback; it is off.', ''), []);
  assert.deepEqual(a.defaultFactsIn('Not the phone: the SMS fallback still works.', ''), ['SMS as the MFA fallback'], 'the negation is in another clause');
  assert.deepEqual(a.defaultFactsIn('The SMS fallback still works.', ''), ['SMS as the MFA fallback']);
});

// ── Batch 10, task 2: a change word counts only as the step's verb ─────────────────────────────────────
// EXPECTED DECISION (written before the code)
// - In a step, a change word counts only as its verb: the first word of the step or of a sentence in it,
//   or the word right after a leading "please", "then", "ask <someone> to", a leading condition ("If it
//   still loops:", "If none of that fits,") or a short label ("Last resort:"), and the word after "then".
// - Nouns ("a macOS update", "the install log") do not count, and neither do the words of a user check the
//   tech only relays: after "Ask the user to <verb>", the rest of that step is the user's words.
// - A negated verb ("Don't wait for the user, reset the password") hands the step to the clause after it.
// - "Done when" is not a step: it keeps the batch 9 reading, so a change it names still counts (security
//   review 5's case stays).
const EVIDENCE = path.join(__dirname, '..', '..', 'docs', 'aegis', 'demo', 'evidence');
const saved = (run, id) => fs.readFileSync(path.join(EVIDENCE, run, 'answers', `${id}-answer.txt`), 'utf8');
const steps = (...s) => card([GOOD_PARTS[0], GOOD_PARTS[1], ...s.map((x, i) => `${i + 1}. ${x}`), ...GOOD_PARTS.slice(5)]);

test('batch 10, task 2: the T7m and T7 answers of full runs 4 and 5 only look ("a macOS update", "a large update" are nouns)', () => {
  // catches: the batch 9 rule, which counted "update" and "install" anywhere in a step (both closed OPEN)
  for (const [run, id] of [['full-run-4', 'T7m'], ['full-run-5', 'T7']]) {
    const r = a.onlyLooks(saved(run, id));
    assert.equal(r.looks, true, `${run} ${id}: change found: ${r.change}`);
  }
});

test('batch 10, task 2: "Restart the Mac" and "Update the profile" as admin steps still count', () => {
  // catches: a rule that drops update and restart from the change words instead of reading the verb
  for (const step of ['Restart the Mac.', 'Update the profile in Jamf Pro.']) {
    const r = a.onlyLooks(steps('Open Jamf Pro and read the Mac\'s record.', step, 'Read the log again.'));
    assert.equal(r.looks, false, step);
    assert.match(r.change, /^(?:Restart|Update)$/);
  }
});

test('batch 10, task 2, pair 1: "Read the install log" is a look; "Install the printer driver" is a change', () => {
  // catches: a noun after a look verb still read as a change
  assert.equal(a.onlyLooks(steps('Read the install log on the print server for errors.', 'Check the queue.', 'Look at the driver version.')).looks, true);
  assert.equal(a.onlyLooks(steps('Read the install log on the print server for errors.', 'Install the printer driver from the vendor page.', 'Look at the queue.')).looks, false);
});

test('batch 10, task 2, pair 2: a reset named as a noun is a look; the verb after "then", "please" or a leading condition is a change', () => {
  // catches: a rule that reads only the first word of the step and misses "then reset" or "If it fails: reset"
  assert.equal(a.onlyLooks(steps('Open the audit log and find the last password reset for [UPN].', 'Note its time in the ticket.', 'Compare it with the failed sign-ins.')).looks, true);
  for (const s of ['Open the user page, then reset the password.', 'Please reset the password from the user page.', 'If the sign-ins keep failing: reset the password.', 'If none of that helps, reset the password.', 'Last resort: reset the password.']) {
    const r = a.onlyLooks(steps('Open the audit log.', s, 'Read the sign-ins.'));
    assert.equal(r.looks, false, s);
    assert.match(r.change, /^reset$/i, s);
  }
});

test('batch 10, task 2, pair 3: words inside a user check the tech relays do not count; the asked verb itself and a second sentence of the tech\'s own do', () => {
  // catches: the batch 9 rule, which read "restart" inside a relayed user check as the tech's change
  const relayed = steps('Read the sync client\'s error in the device record.', 'Ask the user to quit the sync app and reopen it. If it still fails, restart the laptop and try once more.', 'Write the app version in the ticket.');
  assert.equal(a.onlyLooks(relayed).looks, true, a.onlyLooks(relayed).change);
  assert.equal(a.onlyLooks(steps('Read the error.', 'Ask the user to restart the laptop.', 'Read the error again.')).looks, false, 'the asked verb is the step\'s verb');
  assert.equal(a.onlyLooks(steps('Open the device record. Remove the old certificate.', 'Read the error.', 'Read it again.')).looks, false, 'a second sentence of the tech\'s own');
});

test('batch 10, task 2: the batch 9 cases still hold (a negated verb hands over, "Done when" still counts)', () => {
  // catches: a verb rule that stops at "Don't wait" or that skips the Done when line
  assert.equal(a.onlyLooks(steps('Open the log.', "Don't wait for the user, reset the password.", 'Read it.')).looks, false);
  assert.equal(a.onlyLooks(steps('Open the log.', 'Do not unlock the account yet; read the log first.', 'Read it.')).looks, true);
  assert.equal(a.onlyLooks(card([GOOD_PARTS[0], GOOD_PARTS[1], '1. Open the logs.', '2. Read the user page.', '3. Read the device list.', '**Done when:** you have reset the MFA methods.', ...GOOD_PARTS.slice(6)])).looks, false);
});

// Batch 10, task 2, found in the saved answers (t2-saved-answers.txt): full run 3's T4m says "Under Read and
// manage (Full Access), add [UPN]." and full run 5's T4 "If [UPN] is already listed, only add the missing
// right."; the first version of the verb rule read "Under" and "only" as the verbs. Wrong implementation it
// catches: a rule that skips a leading place phrase or an adverb as if it were the step's verb.
test('batch 10, task 2, pair 4: a verb after a leading place phrase or "only" counts; a look after one is still a look', () => {
  for (const s of ['Under Read and manage (Full Access), add [UPN].', 'If [UPN] is already listed, only add the missing right.', 'In the user page, just reset the password.']) {
    const r = a.onlyLooks(steps('Open the admin center.', s, 'Read the list.'));
    assert.equal(r.looks, false, s);
  }
  for (const s of ['In Jamf Pro → Computers → Management History, look for a macOS update pushed today.', 'On the router\'s admin page, find the device using the most bandwidth.']) {
    assert.equal(a.onlyLooks(steps('Open the admin center.', s, 'Read the list.')).looks, true, s);
  }
});

// Evidence review 1 (batch 10): two steps whose verb the rule missed. "Open the user page and reset the password"
// read as a look, since a verb after "and" was read only after a negation; and after "Ask the user to <verb>" the
// whole rest of the step was the user's, so a sentence of the tech's own after it ("Reset the MFA in Okta.") read as
// a look. A verb after "and" counts when an object follows it (the, a, their, it, a [PLACEHOLDER]), so a noun after
// "and" ("the install and update history") still does not; after a relayed ask, only a sentence that opens with a
// condition or "then" goes on relaying. Wrong implementations it catches: every word after "and" read as a verb (the
// T7 noun case again); a relayed ask that swallows the rest of the step.
test('evidence review 1 (batch 10): a verb after "and", and a sentence of the tech\'s own after a relayed ask, count', () => {
  for (const s of ['Open the user page and reset the password.', 'Ask the user to sign out of the app. Reset the MFA in Okta.', 'Find the device and wipe it.']) assert.equal(a.onlyLooks(steps('Open the log.', s, 'Read it.')).looks, false, s);
  for (const s of ['Read the sign-in log and note the time.', 'Check the install and update history for the Mac.', 'Ask the user to quit the app. Then restart the laptop and try again.', 'Ask the user to quit the app. If it still fails, restart the laptop.']) {
    const r = a.onlyLooks(steps('Open the log.', s, 'Read it.'));
    assert.equal(r.looks, true, `${s}: ${r.change}`);
  }
});

// Code review round 1 (batch 10), finding class A: shapes in which a step asks for a change that the verb rule read
// as a look: an emoji or WARNING prefix (CLAUDE.md rule 5 asks for one before a destructive step), single-star
// italics, a verb after a comma, a button the step clicks, a portal path that ends on a change button (Aegis leads
// with the portal), a numbered label ("Step 4 (last resort):") and a change in a bullet under a step. Wrong
// implementations it catches: the verb read only at the very start of a clause; a portal path's last button
// ignored; a bullet joined onto its step mid-sentence. The look cases guard each new reading against a noun.
test('code review 1, class A (batch 10): a change behind a prefix, after a comma, on a button or in a sub-bullet is still seen', () => {
  for (const s of ['⚠️ WARNING: Erase the Mac.', '*Reset* the password.', 'Open the device record, wipe it.', 'Click **Wipe Computer** on the record.', 'Select the user and choose Delete.',
    'Admin console → Directory → Users → [USER@DOMAIN.COM] → Reset password, with "Ask the user to change their password" ticked.', 'Step 4 (last resort): wipe the Mac.']) {
    assert.equal(a.onlyLooks(steps('Open the log.', s, 'Read it.')).looks, false, s);
  }
  for (const s of ['Open Intune → Devices → Update rings and read the ring the device is in.', 'Read the sign-in log, note the time.', 'Click the user and read the Devices tab.', 'In Jamf Pro → Computers → Management History, look for a macOS update pushed today.']) {
    const r = a.onlyLooks(steps('Open the log.', s, 'Read it.'));
    assert.equal(r.looks, true, `${s}: ${r.change}`);
  }
  const bullet = card([GOOD_PARTS[0], GOOD_PARTS[1], '1. Open the Mac record in Jamf Pro', '   - Erase the Mac from its record', '2. Read the log.', '3. Read it again.', ...GOOD_PARTS.slice(5)]);
  assert.equal(a.onlyLooks(bullet).looks, false, 'a change in a bullet under a step');
  const relayedBullet = card([GOOD_PARTS[0], GOOD_PARTS[1], '1. Ask the user to quit the app', '   - if it still fails, restart the laptop', '2. Read the log.', '3. Read it again.', ...GOOD_PARTS.slice(5)]);
  assert.equal(a.onlyLooks(relayedBullet).looks, true, 'a bullet that goes on with the relayed user check');
});

// Code review round 2 (batch 10), class A2: edges of round 1's verb readers. Steps written "1.Verb" with no space
// read as looks in a card; the new readers ran inside a negated clause ("Do not click Reset password"); a
// [PLACEHOLDER] object never matched; portal menu names read as buttons ("Add filters", "Update rings", "Deleted
// users"); and the shared reader removed only five invisible characters, so "Re<soft hyphen>set" hid the verb. Wrong
// implementations it catches: each of those five readings.
test('code review 2, class A2 (batch 10): no-space steps, negations, placeholder objects, menu names and invisible characters', () => {
  const noSpace = card([GOOD_PARTS[0], GOOD_PARTS[1], '1.Open the log.', '2.Reset the password.', '3.Read it.', ...GOOD_PARTS.slice(5)]);
  assert.equal(a.onlyLooks(noSpace).looks, false, 'a "2.Reset" step in a card');
  for (const s of ['Open the device page, wipe [DEVICE_NAME] from the list.', "Find the user and reset [USER@DOMAIN.COM]'s password.", 'Re­set the password.', 'Wi⁡pe the Mac.']) {
    assert.equal(a.onlyLooks(steps('Open the log.', s, 'Read it.')).looks, false, JSON.stringify(s));
  }
  for (const s of ['Do not click Reset password until the user confirms.', 'Never select Delete on the user page.', "Don't go to Intune → Devices → Wipe.", 'Click Add filters and choose User.', 'In Intune, select Update rings for Windows and read the ring.', 'Open Entra → Users → Deleted users, and look for the account.', 'Open Intune → Devices → Update rings, find the device ring.']) {
    const r = a.onlyLooks(steps('Open the log.', s, 'Read it.'));
    assert.equal(r.looks, true, `${s}: ${r.change}`);
  }
});

// Code review round 3 (batch 10), class A3: round 2's plural-noun rule dropped real buttons ("Revoke sessions",
// "Remove members", "Remove access"); the readers saw only the text after a leading "In ...," so the path's last stop
// was gone; a negated clause ended by a dash kept the change after it hidden; and a dropdown value ("Select
// Disabled") stopped counting. Wrong implementations it catches: an any-plural menu rule; readers on the lead-stripped
// rest; no dash in the clause break; plain stems only after "select".
test('code review 3, class A3 (batch 10): real buttons, paths after a lead, a dash after a negation and dropdown values count', () => {
  for (const s of ['In the Entra admin center, go to Users → [UPN] → Overview → Revoke sessions.', 'Click Remove members on the group.', 'Open the app → Remove access.', 'In Intune → Devices → [DEVICE_NAME] → Wipe, keep the enrollment state unchecked.', "Don't wait — click Reset password.", 'No need to wait - click Wipe.', 'Select Disabled under Account status.']) {
    assert.equal(a.onlyLooks(steps('Open the log.', s, 'Read it.')).looks, false, s);
  }
  for (const s of ['Click Add filters and choose User.', 'Open Intune → Devices → Update rings, find the device ring.']) assert.equal(a.onlyLooks(steps('Open the log.', s, 'Read it.')).looks, true, s);
});
