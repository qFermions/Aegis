'use strict';
// render.js: the terminal lines and the one-file HTML page of a desk run. Pure: text in, text out.
// The page holds no script and fetches nothing (its Content-Security-Policy says so); a ticket is
// selected with a plain #t-T4 link and the :target rule. Everything from a ticket or an answer is
// escaped, so it cannot add markup.

const SENTENCE = 'Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality.';
const STATES = Object.freeze(['RESOLVED (SIMULATED)', 'INCONCLUSIVE', 'INVESTIGATE', 'OPEN', 'CLARIFY', 'FAILED']);

const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// an id in a URL fragment and an element id: only what a ticket id may hold
const safeId = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');

const usd = (n) => `${n.toFixed(2)} US dollars`;
function seconds(ms) {
  if (!Number.isFinite(ms)) return 'unknown';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

// counts: { boundary_failures, probes_refused }, which the desk knows from the checks it ran.
function summarize(tickets, counts = {}) {
  const by = Object.fromEntries(STATES.map((s) => [s, 0]));
  for (const t of tickets) by[t.closing_state] = (by[t.closing_state] || 0) + 1;
  const model = tickets.map((t) => t.steps.find((s) => s.n === 4)).filter((s) => s && (s.model_session || s.cost_usd !== null));
  const known = model.every((s) => typeof s.cost_usd === 'number');
  const total = tickets.flatMap((t) => t.steps).reduce((a, s) => a + (s.duration_ms || 0), 0);
  return {
    by_state: by,
    boundary_failures: counts.boundary_failures || 0,
    injection_probes_refused: counts.probes_refused || 0,
    cache_hits: tickets.filter((t) => t.cache_hit).length,
    model_sessions: model.length,
    total_cost_usd: known ? Math.round(model.reduce((a, s) => a + s.cost_usd, 0) * 1e6) / 1e6 : null,
    total_ms: total,
  };
}

const costText = (s) => (s.total_cost_usd === null ? 'total cost unknown' : `total cost ${usd(s.total_cost_usd)}`);

function summaryLines(s) {
  return [
    `Tickets: ${STATES.map((n) => `${n} ${s.by_state[n] || 0}`).join(', ')}`,
    `boundary failures ${s.boundary_failures}, injection probes refused ${s.injection_probes_refused}, cache hits ${s.cache_hits}`,
    `model sessions ${s.model_sessions}, ${costText(s)}, total time ${seconds(s.total_ms)}`,
    SENTENCE,
  ];
}

// One line, whatever a result holds.
function stepLine(ticketId, step) {
  const result = String(step.result).replace(/\s+/g, ' ').trim();
  return `${ticketId} step ${step.n} ${step.name} | ${step.actor} | ${step.tag} | ${result} | ${seconds(step.duration_ms)}`;
}

const CSS = `
:root { --bg: #ffffff; --panel: #f1f4f8; --ink: #17202b; --quiet: #4d5a6b; --line: #cdd5df; --sim: #7a3e00; --sim-bg: #ffe9cc; --real: #0b5a33; --real-bg: #d8f3e3; --bad: #8f1d1d; --link: #0b4fa8; }
@media (prefers-color-scheme: dark) { :root { --bg: #11151b; --panel: #1b222b; --ink: #e8edf3; --quiet: #a6b2c1; --line: #36414e; --sim: #ffc98a; --sim-bg: #4a2e0c; --real: #9be3bb; --real-bg: #12402a; --bad: #ff9c9c; --link: #8cbcff; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
header { padding: 20px 24px; border-bottom: 1px solid var(--line); }
h1 { margin: 0 0 4px; font-size: 22px; }
h2 { margin: 0 0 4px; font-size: 19px; }
h3 { margin: 0; font-size: 16px; }
.note { margin: 8px 0 0; color: var(--quiet); }
.counts { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 12px 0 0; padding: 0; list-style: none; }
.counts b { font-size: 18px; }
.layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); align-items: start; }
nav { padding: 16px; border-right: 1px solid var(--line); }
nav a { display: block; padding: 10px 12px; margin-bottom: 8px; border: 1px solid var(--line); border-radius: 6px; color: inherit; text-decoration: none; }
nav a:hover, nav a:focus { border-color: var(--link); }
nav .who { display: block; font-size: 13px; color: var(--quiet); }
nav .what { display: block; }
nav .state { display: block; margin-top: 2px; font-size: 13px; font-weight: 600; }
main { padding: 16px 24px; min-width: 0; }
.ticket { display: none; }
.ticket:target { display: block; }
main:not(:has(.ticket:target)) .ticket:first-of-type { display: block; }
.step { margin: 12px 0; padding: 12px 14px; background: var(--panel); border-radius: 6px; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 4px 0 6px; font-size: 14px; color: var(--quiet); }
.tag { padding: 0 6px; border-radius: 4px; font-size: 13px; font-weight: 600; background: var(--real-bg); color: var(--real); }
.tag.sim { background: var(--sim-bg); color: var(--sim); }
.result { margin: 0 0 6px; overflow-wrap: anywhere; }
.reason { color: var(--bad); }
details summary { cursor: pointer; color: var(--link); }
pre { margin: 8px 0 0; padding: 10px; overflow-x: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--bg); border: 1px solid var(--line); border-radius: 4px; }
@media (max-width: 720px) { header { padding: 16px; } .layout { grid-template-columns: minmax(0, 1fr); } nav { border-right: 0; border-bottom: 1px solid var(--line); } main { padding: 16px; } }
`;

function stepHtml(step) {
  const sim = /SIMULATED/.test(step.tag);
  const cost = typeof step.cost_usd === 'number' ? `<span>${esc(usd(step.cost_usd))}</span>` : '';
  const code = step.exit_code === null || step.exit_code === undefined ? '' : `<span>exit ${esc(step.exit_code)}</span>`;
  const open = step.n === 4 || step.n === 8 ? ' open' : '';
  const output = step.output ? `<details${open}><summary>Output</summary><pre class="shown">${esc(step.output)}</pre></details>` : '';
  return `<div class="step"><h3>Step ${esc(step.n)}: ${esc(step.name)}</h3>
<div class="meta"><span>${esc(step.actor)}</span><span class="tag${sim ? ' sim' : ''}">${esc(step.tag)}</span><span>${esc(seconds(step.duration_ms))}</span>${code}${cost}</div>
<p class="result">${esc(step.result)}</p>${output}</div>`;
}

function ticketHtml(t) {
  const reason = t.reason ? `<p class="reason">${esc(t.reason)}</p>` : '';
  return `<section class="ticket" id="t-${safeId(t.id)}"><h2>${esc(t.id)}: ${esc(t.title)}</h2>
<p class="note">${esc(t.customer_label)}. Closing state: <strong>${esc(t.closing_state)}</strong>.</p>${reason}
${t.steps.map(stepHtml).join('\n')}</section>`;
}

function html(run) {
  const s = run.summary;
  const list = run.tickets.map((t) => `<a href="#t-${safeId(t.id)}"><span class="who">${esc(t.customer_label)}</span><span class="what">${esc(t.id)}: ${esc(t.title)}</span><span class="state">${esc(t.closing_state)}</span></a>`).join('\n');
  const body = run.tickets.length ? run.tickets.map(ticketHtml).join('\n') : '<p>No tickets in this run.</p>';
  const counts = [
    ...STATES.map((n) => [n, s.by_state[n] || 0]),
    ['Boundary failures', s.boundary_failures], ['Injection probes refused', s.injection_probes_refused], ['Cache hits', s.cache_hits], ['Model sessions', s.model_sessions],
    ['Total cost', s.total_cost_usd === null ? 'unknown' : usd(s.total_cost_usd)], ['Total time', seconds(s.total_ms)],
  ].map(([k, v]) => `<li>${esc(k)}: <b>${esc(v)}</b></li>`).join('');
  // the selected ticket's link, marked with a rule per ticket (no script)
  const marks = run.tickets.map((t) => `body:has(#t-${safeId(t.id)}:target) nav a[href="#t-${safeId(t.id)}"] { border-color: var(--link); background: var(--panel); }`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Customer Desk run</title>
<style>${CSS}${marks}</style>
</head>
<body>
<header>
<h1>Customer Desk run</h1>
<p class="note">Run ${esc(run.run_id)}, started ${esc(run.started_at)}.</p>
<p class="note">${esc(SENTENCE)}</p>${run.aborted ? `\n<p class="note reason">${esc(run.aborted)}</p>` : ''}${run.not_run && run.not_run.length ? `\n<p class="note reason">Did not run: ${esc(run.not_run.map((n) => n.id).join(', '))}, because ${esc(run.not_run[0].reason)}.</p>` : ''}
<ul class="counts">${counts}</ul>
</header>
<div class="layout">
<nav aria-label="Tickets">
${list}
</nav>
<main>
${body}
</main>
</div>
</body>
</html>
`;
}

module.exports = { SENTENCE, STATES, html, summarize, summaryLines, stepLine, seconds };
