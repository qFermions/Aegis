'use strict';
require('../adapters/socket-tripwire.js');
// answer.test.js: the Fix card and the aegis-desk block (batch 8, tasks 1 and 8).
//
// EXPECTED DECISION (written before answer.js)
// - Task 1: an answer starts with "## Fix" holding, in order, What's wrong, Do this (3 to 5 numbered
//   steps), Done when, Stop if and Tell the user (at most 3 sentences); the card is at most 150 words and
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
  '**Tell the user:** It is done. Reopen Outlook.',
];

test('task 1: each fixture answer opens with the card, has the five parts in order, at most 150 words, no command, no desk-only text, and the aegis-desk block last', () => {
  const ids = catalog();
  for (const kind of KINDS) {
    const text = fixture(kind);
    const c = a.fixCard(text);
    assert.ok(c.present && c.first, `${kind}: the card comes first`);
    assert.deepEqual(c.order, ['wrong', 'doThis', 'doneWhen', 'stopIf', 'tellUser'], `${kind}: the five parts in order`);
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
  assert.deepEqual(rows.map((r) => r.check), ['fix-card-first', 'fix-card-parts', 'fix-card-words', 'no-command', 'customer-facts']);
  assert.deepEqual(rows.map((r) => r.verdict), ['pass', 'pass', 'pass', 'pass', 'pass']);
  for (const r of rows) assert.ok(r.plain && r.detail, r.check);
  const verdicts = (text, profile = '') => Object.fromEntries(a.answerChecks(text, { profile }).map((r) => [r.check, r.verdict]));
  assert.equal(verdicts(`Intro line.\n${good}`)['fix-card-first'], 'fail');
  assert.equal(verdicts('No card at all.\n```aegis-desk\nGate: none\n```')['fix-card-parts'], 'fail');
  assert.equal(verdicts(good.replace('**Tell the user:**', `**Tell the user:** ${'many '.repeat(40)}.`))['fix-card-words'], 'fail');
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
  for (const token of ['[@Aegion]', '[@Aegion_SITE_2]', '[@Aegion_NETPARTNER]', '[@Aegion_JIRA_SPACE]']) assert.ok(a.defaultFactsIn(`Ask ${token}.`, '').includes("the default organization's own sites, vendors and servers"), token);
  assert.equal(a.words('[FIRST_NAME] at [@Aegion_DOMAIN]'), 3);
});
