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
    STEPS.forEach((name, i) => {
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
