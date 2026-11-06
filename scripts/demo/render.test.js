'use strict';
require('../adapters/socket-tripwire.js');
// render.test.js: the step-by-step view of a run (batch 6, tasks 4 and 5).
//
// EXPECTED DECISION (written before the code)
// - desk.html is one self-contained file: no network fetch, no script, no external resource; every
//   http or https URL in it sits inside the shown ticket or answer text.
// - Every step of every ticket and every SIMULATED label is present as text, not only as color.
// - A ticket's or answer's text is escaped, so it cannot add markup to the page.
// - It avoids the listed patterns: cream or off-white backgrounds, italic accents in headings,
//   numbered "01/02" labels, monospace labels outside code blocks, pill-shaped buttons.
// What a wrong implementation would be caught by: a CDN font or script (the URL check); an answer
// with a <script> tag printed raw (the escape check); a label shown only by color (the text count).
// Run: node --test scripts/demo/render.test.js

const assert = require('node:assert/strict');
const { test } = require('node:test');

const render = require('./render.js');

const PLAIN_STEPS = ['Customer', 'Ticket received', 'Sorted', 'Aegis&#39;s answer', 'Safety checks', 'Sign-off', 'Changes made (simulated)', 'Double-check', 'Result'];
const STEPS = ['CUSTOMER', 'INTAKE', 'TRIAGE', 'AEGIS', 'CHECKS', 'APPROVAL', 'SIMULATED OPERATOR', 'READ-BACK', 'CLOSE'];
const TAGS = ['SIMULATED', 'REAL', 'REAL', 'REAL', 'REAL', 'REAL code, SIMULATED person', 'SIMULATED', 'REAL connector, SIMULATED tenant', 'REAL'];
const ACTORS = ['Customer E: 12-person accounting firm', 'Aegis intake', 'Aegis replay and graph', 'Aegis session', 'Aegis checks', 'SIMULATED OPERATOR', 'SIMULATED OPERATOR', 'Aegis connector', 'Aegis desk'];

function fixtureTicket(id, closing, overrides = {}) {
  return {
    id, customer: 'E', customer_label: 'Customer E: 12-person accounting firm', title: `Title of ${id}`, closing_state: closing, reason: closing === 'OPEN' ? 'the reason it is open' : null,
    ticket_text: 'text',
    steps: STEPS.map((name, i) => ({
      n: i + 1, name, actor: ACTORS[i], tag: TAGS[i], result: `result ${i + 1} of ${id}`, started_at: '2026-11-04T10:00:00.000Z', duration_ms: 1200 + i, exit_code: 0, cost_usd: i === 3 ? 0.42 : null,
      output: i === 0 ? 'See https://customer.example.com/ticket and <script>alert(1)</script>' : (i === 3 ? 'Answer: https://admin.microsoft.com and </pre><img src=x onerror=alert(1)>' : `output ${i + 1}`),
    })),
    ...overrides,
  };
}
const fixtureRun = () => {
  const tickets = [fixtureTicket('T4', 'RESOLVED (SIMULATED)'), fixtureTicket('T6', 'OPEN'), fixtureTicket('T7', 'CLARIFY')];
  return { schema: 'aegis.demo.run.v1', run_id: '20261104T100000Z-abcd1234', started_at: '2026-11-04T10:00:00.000Z', tickets, summary: render.summarize(tickets, { probes_refused: 1, boundary_failures: 0 }) };
};

test('every step of every ticket, its actor, tag, duration and output are in the page, in order', () => {
  const html = render.html(fixtureRun());
  for (const id of ['T4', 'T6', 'T7']) {
    const at = html.indexOf(`id="t-${id}"`);
    assert.ok(at > 0, `${id} section`);
    const end = html.indexOf('</section>', at);
    const section = html.slice(at, end);
    let last = -1;
    // batch 8, task 9 renamed the steps on the page; run.json and the terminal keep STEPS
    PLAIN_STEPS.forEach((name, i) => {
      const here = section.indexOf(`Step ${i + 1}: ${name}`);
      assert.ok(here > last, `${id}: step ${i + 1} ${name} is present and in order`);
      last = here;
      assert.ok(section.includes(`result ${i + 1} of ${id}`), `${id} result ${i + 1}`);
    });
    assert.ok(section.includes('SIMULATED OPERATOR'));
    assert.ok(section.includes('1.2 s'), 'the duration');
  }
});

test('every simulated part is labeled SIMULATED in text', () => {
  const html = render.html(fixtureRun());
  const count = (s) => html.split(s).length - 1;
  assert.ok(count('>SIMULATED<') >= 6, 'the customer and operator tags, per ticket');
  assert.ok(count('REAL code, SIMULATED person') >= 3);
  assert.ok(count('REAL connector, SIMULATED tenant') >= 3);
  assert.ok(html.includes('RESOLVED (SIMULATED)'));
  assert.ok(html.includes(render.SENTENCE), 'the sentence word for word');
});

test('no http or https URL outside the shown ticket and answer text, no script, no external resource', () => {
  const html = render.html(fixtureRun());
  // the output blocks hold the shown text; everything else must be free of URLs
  const outside = html.replace(/<pre class="shown">[\s\S]*?<\/pre>/g, '');
  assert.doesNotMatch(outside, /https?:\/\//i);
  assert.ok(html.includes('https://admin.microsoft.com'), 'a URL in an answer is still shown');
  assert.doesNotMatch(outside, /<script|<link|<img|<iframe|@import|url\(/i);
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">/);
});

test('ticket and answer text is escaped, so it cannot add markup', () => {
  const html = render.html(fixtureRun());
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<img src=x'));
  const hostile = fixtureRun();
  hostile.tickets[0].title = '"><b>x';
  hostile.tickets[0].id = 'T4';
  assert.ok(!render.html(hostile).includes('"><b>x'));
});

test('the list shows each ticket\'s customer label, title and closing state; the summary sits on top', () => {
  const html = render.html(fixtureRun());
  const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
  for (const [id, closing] of [['T4', 'RESOLVED (SIMULATED)'], ['T6', 'OPEN'], ['T7', 'CLARIFY']]) {
    assert.ok(nav.includes(`href="#t-${id}"`), id);
    assert.ok(nav.includes(`Title of ${id}`), id);
    assert.ok(nav.includes(closing), closing);
  }
  assert.ok(nav.includes('Customer E: 12-person accounting firm'));
  const top = html.slice(html.indexOf('<body'), html.indexOf('<nav'));
  for (const text of ['RESOLVED (SIMULATED)', 'INCONCLUSIVE', 'OPEN', 'CLARIFY', 'FAILED', 'Boundary failures', 'Model sessions', 'Total cost', 'Total time']) assert.ok(top.includes(text), text);
});

test('the page avoids the listed patterns and themes both modes', () => {
  const html = render.html(fixtureRun());
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  assert.doesNotMatch(css, /font-style:\s*italic/);
  assert.doesNotMatch(html, /<(?:em|i)\b/);
  assert.doesNotMatch(html, />\s*0[0-9]\s*[/<]/, 'no 01/02 labels');
  assert.doesNotMatch(css, /border-radius:\s*(?:[1-9][0-9]{1,}px|999|50%)/, 'no pill shapes');
  for (const cream of ['#fff8', '#faf', '#fdf', '#fef', '#f5f0', '#f8f4', 'ivory', 'beige', 'cornsilk', 'linen', 'oldlace', 'seashell', 'floralwhite']) assert.ok(!css.toLowerCase().includes(cream), cream);
  const mono = css.match(/[^{}]+\{[^{}]*monospace[^{}]*\}/g) || [];
  assert.equal(mono.length, 1, 'one monospace rule');
  assert.match(mono[0], /pre/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /@media \(max-width: ?[0-9]+px\)/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(css, /overflow-wrap/);
});

test('tickets that did not run are named at the top of the page, in text', () => {
  const run = fixtureRun();
  run.not_run = [{ id: 'T8', reason: 'the <limit> was reached' }];
  const html = render.html(run);
  assert.ok(html.indexOf('Did not run: T8') < html.indexOf('<nav'));
  assert.ok(html.includes('the &lt;limit&gt; was reached'));
  assert.ok(!render.html(fixtureRun()).includes('Did not run'));
});

test('a run with no tickets still renders, and the summary names what it holds', () => {
  const html = render.html({ schema: 'aegis.demo.run.v1', run_id: 'r', started_at: '2026-11-04T10:00:00.000Z', tickets: [], summary: render.summarize([], {}) });
  assert.match(html, /No tickets in this run/);
  assert.ok(html.includes(render.SENTENCE));
});

test('the terminal line carries the actor, the result and the tag; summaryLines carries the counts', () => {
  const t = fixtureTicket('T4', 'RESOLVED (SIMULATED)');
  const line = render.stepLine('T4', t.steps[6]);
  assert.match(line, /^T4 step 7 SIMULATED OPERATOR/);
  assert.ok(line.includes('SIMULATED OPERATOR'));
  assert.ok(line.includes('result 7 of T4'));
  assert.ok(line.split('\n').length === 1, 'one line');
  const multi = render.stepLine('T4', { ...t.steps[0], result: 'a\nb' });
  assert.equal(multi.split('\n').length, 1, 'a result with a new line stays on one line');
  const text = render.summaryLines(fixtureRun().summary).join('\n');
  // batch 8, task 6 added INVESTIGATE to the states, after INCONCLUSIVE
  assert.match(text, /RESOLVED \(SIMULATED\) 1, INCONCLUSIVE 0, INVESTIGATE 0, OPEN 1, CLARIFY 1, FAILED 0/);
  assert.match(text, /total cost 1\.26 US dollars/);
  assert.ok(text.includes(render.SENTENCE));
});

test('a cost no session reported reads as unknown, never as zero', () => {
  const t = fixtureTicket('T4', 'OPEN');
  t.steps[3].cost_usd = null;
  t.steps[3].model_session = true;
  const s = render.summarize([t], {});
  assert.equal(s.model_sessions, 1);
  assert.equal(s.total_cost_usd, null);
  assert.match(render.summaryLines(s).join('\n'), /total cost unknown/);
});

// ── Batch 8, task 9: a page a non-coder can read ──────────────────────────────────────────────
//
// EXPECTED DECISION (written before the render code)
// - The steps are named 1 Customer, 2 Ticket received, 3 Sorted, 4 Aegis's answer, 5 Safety checks,
//   6 Sign-off, 7 Changes made (simulated), 8 Double-check, 9 Result. Each step shows one plain sentence
//   first; the technical text (actor, tags, exit codes, timings, results, outputs) sits under a
//   "Technical details" fold. Step 4 shows the Fix card first and the whole answer under a fold. Step 6
//   says which changes were signed off and the phrase a real tech would type. Step 8 shows each
//   double-check as a plain sentence with yes or no.
// - Outside the folds, and outside quoted text (the customer's message and Aegis's own words, shown as
//   they are), no sentence holds a technical word from the list below, and none is over 25 words.
// A wrong implementation each catches: a step that still prints its result line outside the fold (the
// result holds "gate" and "exit"); a plain sentence built from the raw reason ("read-back"); a step 8 that
// lists the verify command instead of what it proves.

const FORBIDDEN = /\b(?:gates?|tenants?|read-?backs?|readbacks?|R[123]|exit|stdout|json|sha|CLI|connectors?|simulators?)\b/i;
const CARD_ANSWER = [
  '## Fix',
  "**What's wrong:** the old phone held the only sign-in method.",
  '**Do this:**',
  '1. Call the user back on the number in the staff list.',
  '2. Open the admin center, the user, Authentication methods.',
  '3. Require the user to register again.',
  '**Done when:** the user signs in on the new phone.',
  '**Stop if:** the sign-in logs show someone else.',
  '**Tell the user:** We will call you shortly. Have the new phone ready.',
  '',
  '## Details',
  'The gate is R3; run node scripts/adapters/msgraph-client.js verify-mfa-cleared after it.',
  '',
  '```aegis-desk',
  'Gate: mfa-require-reregister-portal',
  '```',
].join('\n');

function plainRun() {
  const base = fixtureTicket('T1', 'RESOLVED (SIMULATED)', { customer_label: 'Customer A: 14-seat dental office', title: 'Locked out after a phone change, Authenticator gone' });
  const facts = [
    { result: 'sent an email: Locked out after a phone change', output: 'From: front desk\n\nHi, my tenant read-back json is gone' },
    { facts: { accepted: true, hidden: 2, injection_flags: 1 }, result: 'ACCEPTED, redactions: 1 email, 1 phone; injection flags: 1', exit_code: 0 },
    { facts: { lookup: 'MISS' }, result: 'replay MISS, risk floor R3, graph case abc at INTAKE', exit_code: 0 },
    { facts: { cache_hit: false, answered: true }, result: 'answered: claude-opus-5-5, 19 turns, 0.62 US dollars', output: CARD_ANSWER, exit_code: 0, cost_usd: 0.62 },
    { checks: [{ check: 'boundary', verdict: 'pass', applies: true }, { check: 'human-confirmation', verdict: 'pass', applies: true }, { check: 'read-back', verdict: 'pass', applies: true }, { check: 'privacy', verdict: 'pass', applies: true }, { check: 'observed-output', verdict: 'pass', applies: true }, { check: 'probe', verdict: 'pass', applies: false }],
      answer_checks: [{ check: 'fix-card-first', verdict: 'pass', plain: 'The Fix card comes first' }, { check: 'fix-card-parts', verdict: 'pass', plain: 'The Fix card has its five parts in order' }, { check: 'fix-card-words', verdict: 'pass', plain: 'The Fix card is 150 words or fewer' }, { check: 'no-command', verdict: 'fail', plain: 'The answer asks the tech to run no command' }, { check: 'customer-facts', verdict: 'pass', plain: "The answer uses only this customer's facts" }],
      result: 'boundary pass, human-confirmation pass, read-back pass; answer format: 4 of 5 pass' },
    { signed_off: [{ gate: 'mfa-require-reregister-portal', effect: "removes the user's Authenticator, phone and software OATH methods, so they register again", phrase: 'REQUIRE MFA RE-REGISTER FOR [UPN] AND DELETE ITS MFA METHODS' }], result: '1 gate(s) approved by the SIMULATED OPERATOR: mfa-require-reregister-portal', output: 'chg-0123456789ab opened and approved' },
    { facts: { applied: 1, total: 1, blocked: false }, result: 'applied 1 gate(s) of 1 to the simulated tenant, one at a time', output: 'SIMULATED OPERATOR: removes the methods, in the simulated tenant only (A/tenant.json)' },
    { reads: [{ gate: 'mfa-require-reregister-portal', kind: 'msgraph:verify-mfa-cleared', argv: ['verify-mfa-cleared', '--user', '[USER_ID]'], state: 'PASS' }], result: 'PASS: 1 of 1 read-back(s) passed', exit_code: 0, output: 'msgraph:verify-mfa-cleared: exit 0' },
    { result: 'RESOLVED (SIMULATED)', output: 'SIMULATED demo note' },
  ];
  base.steps = base.steps.map((st, i) => ({ ...st, ...facts[i] }));
  const open = fixtureTicket('T4', 'OPEN', { reason: 'the answer names mailbox-full-access-grant, a PREVIEW ONLY marker in mailbox-permissions: the runbook authorizes no change there, so nothing can be approved' });
  open.steps = open.steps.map((st) => (st.n >= 6 && st.n <= 8 ? { ...st, result: 'not reached: the answer names mailbox-full-access-grant, a PREVIEW ONLY marker' } : st));
  const tickets = [base, open, fixtureTicket('T5', 'INVESTIGATE', { reason: 'the answer advises looking first and names no change; its steps: 1. Message trace.' })];
  const run = { schema: 'aegis.demo.run.v1', run_id: '20261106T100000Z-abcd1234', started_at: '2026-11-06T10:00:00.000Z', tickets, summary: render.summarize(tickets, { probes_refused: 0, boundary_failures: 0 }) };
  run.not_run = [{ id: 'T8', reason: '6.51 spent, and T8 could cost about 2.00, past the limit of 7.00 US dollars' }];
  return run;
}

// The page's own words a reader meets without opening anything: the body with the folds, the quoted
// text, the head and the styles taken out, cut into sentences at block tags and sentence ends.
function plainSentences(html) {
  const body = html.slice(html.indexOf('<body'));
  let text = body.replace(/<details[\s\S]*?<\/details>/g, ' ').replace(/<pre class="shown">[\s\S]*?<\/pre>/g, ' ');
  text = text.replace(/<\/(?:p|li|h1|h2|h3|a|span|div|ul|header|nav|main|section)>|<br>/g, '\n').replace(/<[^>]+>/g, ' ');
  text = text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return text.split('\n').flatMap((block) => block.split(/(?<=[.!?])\s+/)).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => /[A-Za-z]/.test(x));
}

test('task 9: no plain sentence outside the folds holds a technical word, and each is at most 25 words', () => {
  for (const run of [plainRun(), fixtureRun()]) {
    const sentences = plainSentences(render.html(run));
    assert.ok(sentences.length > 30, `${sentences.length} plain sentences`);
    for (const x of sentences) {
      assert.doesNotMatch(x, FORBIDDEN, x);
      assert.ok(x.split(/\s+/).length <= 25, `${x.split(/\s+/).length} words: ${x}`);
    }
  }
  // the rule is not empty: the folds still hold the technical text
  const html = render.html(plainRun());
  assert.match(html, /<details><summary>Technical details<\/summary>[\s\S]*?applied 1 gate\(s\) of 1/);
});

test('task 9: each step opens with its plain sentence, and the steps the charter names show what it asks', () => {
  const html = render.html(plainRun());
  const t1 = html.slice(html.indexOf('id="t-T1"'), html.indexOf('</section>', html.indexOf('id="t-T1"')));
  const stepAt = (n) => t1.slice(t1.indexOf(`Step ${n}: `), t1.indexOf(n === 9 ? '</section>' : `Step ${n + 1}: `));
  for (let n = 1; n <= 9; n += 1) assert.match(stepAt(n), /^Step \d: [^<]+<\/h3>\n<p class="plain">[^<]+/, `step ${n} opens with a plain sentence`);
  // step 4: the Fix card first, the whole answer folded, the desk's block hidden from the plain view
  const four = stepAt(4);
  assert.ok(four.indexOf('the old phone held the only sign-in method') < four.indexOf('The whole answer'), 'the card before the folded answer');
  assert.match(four, /<details><summary>The whole answer<\/summary>/);
  const plainFour = four.replace(/<details[\s\S]*?<\/details>/g, '');
  assert.doesNotMatch(plainFour, /aegis-desk|Gate:/, 'the aegis-desk block is not in the plain view');
  // step 6: what was signed off, in plain words, and the phrase a real tech would type
  assert.match(stepAt(6), /signed off 1 change/);
  assert.match(stepAt(6), /A real tech would type: <strong>REQUIRE MFA RE-REGISTER FOR \[UPN\] AND DELETE ITS MFA METHODS<\/strong>/);
  // step 8: each double-check as a plain sentence with yes or no
  assert.match(stepAt(8), /<li>The old sign-in methods are gone: \u2713 yes<\/li>/);
  // step 5: each check as a row, the answer checks among them
  assert.match(stepAt(5), /<li>The answer asks the tech to run no command: \u2717 no<\/li>/);
  // a not-reached step and an OPEN ticket speak plainly too
  const t4 = html.slice(html.indexOf('id="t-T4"'));
  assert.match(t4, /<p class="plain">Not reached: the ticket stopped before this step\.<\/p>/);
  assert.match(t4, /no approved way to make this change yet/);
  assert.match(html, /Did not run: T8, because the spending limit would have been passed\./);
  const none = plainRun();
  none.tickets[0].steps[1].facts = { accepted: true, hidden: 0, injection_flags: 0 };
  assert.match(render.html(none), /Aegis took in the ticket; it held no personal details to hide\./, 'no "hid 0 personal details"');
});

test('task 9: every plain step name and closing state has its own words', () => {
  assert.deepEqual(render.PLAIN_STEP_NAMES, ['Customer', 'Ticket received', 'Sorted', "Aegis's answer", 'Safety checks', 'Sign-off', 'Changes made (simulated)', 'Double-check', 'Result']);
  for (const state of render.STATES) assert.ok(render.closingPlain({ closing_state: state, reason: '' }).length > 10, state);
  assert.equal(render.plainRead({ kind: 'okta:verify-status', argv: ['verify-status', '--status', 'SUSPENDED'] }), 'The Okta account is paused');
  assert.equal(render.plainRead({ kind: 'okta:verify-status', argv: ['verify-status', '--status', 'ACTIVE'] }), 'The Okta account is back on');
  // code review 1, finding 11: verify-state reads an issue's state; the account suspend is verify-suspended
  assert.equal(render.plainRead({ kind: 'linear:verify-suspended', argv: [] }), 'The Linear account is paused');
  assert.equal(render.plainRead({ kind: 'linear:verify-state', argv: [] }), 'The Linear issue is in the planned state');
});
