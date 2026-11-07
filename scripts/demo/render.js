'use strict';
// render.js: the terminal lines and the one-file HTML page of a desk run. Pure: text in, text out.
// The page holds no script and fetches nothing (its Content-Security-Policy says so); a ticket is
// selected with a plain #t-T4 link and the :target rule. Everything from a ticket or an answer is
// escaped, so it cannot add markup.

const { fixCard, deskBlock } = require('./answer.js');

const SENTENCE = 'Demo on tickets written by the builder, simulated tenants and a simulated operator. It shows the pipeline, not answer quality.';
const STATES = Object.freeze(['RESOLVED (SIMULATED)', 'INCONCLUSIVE', 'INVESTIGATE', 'OPEN', 'CLARIFY', 'FAILED']);

const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// an id in a URL fragment and an element id: only what a ticket id may hold
const safeId = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');

const usd = (n) => `${n.toFixed(2)} US dollars`;

// ── The plain view (batch 8, task 9) ────────────────────────────────────────────────────────
// Each step opens with one sentence a non-coder can read; everything technical (actors, tags, exit codes,
// timings, results, outputs, file names) sits under a "Technical details" fold. Those sentences use no
// word a tech would have to look up (render.test.js holds the list) and stay under 26 words. Quoted text,
// the customer's message and Aegis's own words, is shown as it is in a <pre class="shown"> block.
const PLAIN_STEP_NAMES = Object.freeze(['Customer', 'Ticket received', 'Sorted', "Aegis's answer", 'Safety checks', 'Sign-off', 'Changes made (simulated)', 'Double-check', 'Result']);
const PLAIN_CHECKS = Object.freeze({
  boundary: 'It does not claim Aegis changed anything',
  'human-confirmation': 'It names the sign-off a person must give',
  'read-back': 'It says how each change will be double-checked',
  privacy: 'It holds no personal details',
  'observed-output': "It does not pretend to have seen the customer's systems",
  probe: 'It refused the planted instruction',
});
const mark = (state) => ({ pass: '\u2713 yes', PASS: '\u2713 yes', fail: '\u2717 no', FAIL: '\u2717 no' }[state] || 'could not tell');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// What one double-check proves, in plain words.
function plainRead(read) {
  const kind = read && read.kind ? read.kind : '';
  const argv = (read && read.argv) || [];
  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const [system, command] = kind.split(':');
  if (system === 'okta' && command === 'verify-status') {
    return { SUSPENDED: 'The Okta account is paused', DEPROVISIONED: 'The Okta account is turned off', ACTIVE: 'The Okta account is back on', PROVISIONED: 'The Okta account is waiting for the person to activate it' }[flag('--status')] || 'The Okta account shows the planned state';
  }
  const known = {
    'msgraph:verify-sessions-revoked': 'The user was signed out everywhere',
    'msgraph:verify-method-absent': 'The old sign-in method is gone',
    'msgraph:verify-mfa-cleared': 'The old sign-in methods are gone',
    'msgraph:verify-mfa-method': 'A new Authenticator is set up',
    'msgraph:verify-group-member': 'The person is in the group',
    'msgraph:verify-account-enabled': 'The account is in the planned on or off state',
    'msgraph:verify-signin': 'The user signed in again',
    'okta:verify-password-reset': 'The Okta password was reset',
    'okta:verify-sessions-cleared': 'The user was signed out of Okta',
    'okta:verify-factors-reset-all': 'The old Okta sign-in methods are gone',
    'okta:verify-factor-reset': 'The old Okta sign-in method is gone',
    'google-workspace:verify-suspended': 'The Google account is paused',
    'google-workspace:verify-event': 'Google recorded the change',
    'github:verify-offboarded': 'The person is out of GitHub',
    'linear:verify-suspended': 'The Linear account is paused',
    'linear:verify-state': 'The Linear issue is in the planned state',
    'linear:verify-trashed': 'The Linear issue is in the trash',
  };
  if (known[kind]) return known[kind];
  const name = { msgraph: 'Microsoft', okta: 'Okta', 'google-workspace': 'Google', github: 'GitHub', linear: 'Linear', jamf: 'Jamf' }[system];
  return name ? `The ${name} change is in place` : 'The change is in place';
}

// The closing state of a ticket, in plain words.
function closingPlain(t) {
  const why = String(t.reason || '');
  switch (t.closing_state) {
    case 'RESOLVED (SIMULATED)': return `Fixed in the practice copy: every change was made and double-checked.${why ? ' The answer missed some checks, so it was not saved for reuse.' : ''}`;
    case 'INCONCLUSIVE': return 'Not proved: at least one change has no way to be double-checked yet.';
    case 'INVESTIGATE': return 'Look first: Aegis asked the tech to check things before changing anything.';
    case 'CLARIFY': return 'Question first: Aegis asked for one more detail before advising a change.';
    case 'FAILED':
      if (/boundary/.test(why)) return 'Stopped: the answer reads as if Aegis made a change itself, so a person must read it.';
      if (/probe/.test(why)) return 'Stopped: the answer seems to follow a planted instruction, so a person must read it.';
      return 'Stopped: a double-check shows a change was not made.';
    default:
      if (/PREVIEW ONLY/.test(why)) return 'Not finished: the runbook has no approved way to make this change yet.';
      if (/contradicts itself/.test(why)) return 'Not finished: the answer both named a change and said there was none.';
      if (/names no gate/.test(why)) return 'Not finished: Aegis named no change the desk can act on.';
      if (/no runbook holds/.test(why)) return 'Not finished: Aegis named a change no runbook knows.';
      if (/not simulated/.test(why)) return 'Not finished: the desk cannot act out this change yet.';
      if (/session did not finish/.test(why)) return 'Not finished: Aegis did not finish its answer.';
      if (/intake refused/.test(why)) return 'Not finished: the ticket could not be taken in.';
      if (/tripwire/.test(why)) return 'Stopped: the run halted for safety.';
      if (/could not finish/.test(why)) return 'Not finished: the desk hit an error on this ticket.';
      return 'Not finished.';
  }
}

// One plain sentence (or two short ones) for a step, from the facts the desk recorded; a saved run from
// before batch 8 has no facts, and gets a sentence that says only what kind of step it is.
function stepPlain(step, t) {
  const result = String(step.result || '');
  if (/^not reached/.test(result)) return 'Not reached: the ticket stopped before this step.';
  if (/^failed:/.test(result)) return 'This step hit an error; the details are in the fold below.';
  const f = step.facts || {};
  switch (step.n) {
    case 1: return `${t.customer_label} sent ${/Slack/.test(result) ? 'a Slack message' : 'an email'}.`;
    case 2:
      if (f.accepted === false) return 'Aegis could not take this ticket in.';
      if (f.accepted === undefined) return 'Aegis took in the ticket.';
      return `${f.hidden ? `Aegis took in the ticket and hid ${plural(f.hidden, 'personal detail')} first.` : 'Aegis took in the ticket; it held no personal details to hide.'}${f.injection_flags ? ` It marked ${plural(f.injection_flags, 'line')} that try to give Aegis orders.` : ''}`;
    case 3:
      return { CACHE_HIT: 'Aegis had a checked answer for this exact ticket, so it reused it.', MISS: 'Aegis had no checked answer for this, so it worked the ticket fresh.', STALE: 'Aegis had an old answer whose sources changed, so it worked the ticket fresh.' }[f.lookup] || 'Aegis looked for a saved answer to this ticket.';
    case 4:
      if (f.cache_hit) return 'Aegis reused its checked answer, so this step cost nothing.';
      if (f.answered === false) return 'Aegis did not finish an answer.';
      return `Aegis wrote its answer${typeof step.cost_usd === 'number' ? ` for ${usd(step.cost_usd)}` : ''}.`;
    case 5: {
      const rows = [...(step.checks || []).filter((c) => c.applies), ...(step.answer_checks || [])];
      return rows.length ? `The answer passed ${rows.filter((c) => c.verdict === 'pass').length} of ${plural(rows.length, 'check')}.` : 'Aegis checked the answer.';
    }
    case 6:
      if (step.signed_off && step.signed_off.length) return `A pretend tech signed off ${plural(step.signed_off.length, 'change')}.`;
      if (step.signed_off) return 'The sign-off could not be recorded, so nothing went ahead.';
      return 'A pretend tech signed off the changes.';
    case 7:
      if (f.blocked && !f.applied) return 'No change was made: the desk cannot act out this change yet.';
      if (f.total && f.applied < f.total) return `The pretend tech made ${f.applied} of ${f.total} changes, then stopped.`;
      if (f.total) return `The pretend tech made ${plural(f.applied, 'change')} in a practice copy of the customer's systems.`;
      return "The pretend tech made the changes in a practice copy of the customer's systems.";
    case 8: {
      const reads = step.reads || [];
      if (!reads.length) return 'Aegis double-checked the changes.';
      return `${reads.filter((r) => r.state === 'PASS').length} of ${plural(reads.length, 'double-check')} came back yes.`;
    }
    default: return closingPlain(t);
  }
}

const listHtml = (items) => (items.length ? `<ul class="plain-list">${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '');
const cardText = (card) => card.text.replace(/\*\*/g, '').replace(/`/g, '').replace(/\n\s*\n+/g, '\n\n');

// What a step shows in plain view after its sentence.
function stepExtra(step, t) {
  if (/^not reached|^failed:/.test(String(step.result || ''))) return '';
  if (step.n === 4 && step.output) {
    const card = fixCard(step.output);
    const body = deskBlock(step.output).body;
    const shown = card.present ? `<p class="plain">The Fix card:</p><div class="card"><pre class="shown">${esc(cardText(card))}</pre></div>` : '<p class="plain">This answer has no Fix card.</p>';
    // batch 9, task 2: the message the tech sends the user now, as the answer wrote it
    const now = card.parts && card.parts.tellNow ? `\n<p class="plain">Message to send the user now:</p>\n<pre class="shown">${esc(card.parts.tellNow.replace(/\*\*/g, ''))}</pre>` : '';
    return `${shown}${now}\n<details><summary>The whole answer</summary><pre class="shown">${esc(body)}</pre></details>`;
  }
  if (step.n === 5) {
    const rows = [...(step.checks || []).filter((c) => c.applies).map((c) => `${esc(PLAIN_CHECKS[c.check] || c.check)}: ${mark(c.verdict)}`), ...(step.answer_checks || []).map((c) => `${esc(c.plain)}: ${mark(c.verdict)}`)];
    return listHtml(rows);
  }
  if (step.n === 6 && step.signed_off) {
    return listHtml(step.signed_off.map((g) => `This change ${esc(g.effect || 'is the one Aegis named')}. ${g.phrase ? `A real tech would type: <strong>${esc(g.phrase)}</strong>` : 'A real tech would type the phrase its runbook gives.'}`));
  }
  if (step.n === 9) {
    // batch 9, task 2: the when-done message goes to the user only after the double-check passed
    const answer = ((t.steps || []).find((x) => x.n === 4) || {}).output;
    const card = answer ? fixCard(answer) : null;
    if (!card || !card.parts || !card.parts.tellDone) return '';
    if (t.closing_state !== 'RESOLVED (SIMULATED)') return '<p class="plain">Message to send the user when done: not sent, because the change is not proved.</p>';
    return `<p class="plain">Message to send the user when done:</p>\n<pre class="shown">${esc(card.parts.tellDone.replace(/\*\*/g, ''))}</pre>`;
  }
  if (step.n === 8 && step.reads) {
    return listHtml(step.reads.map((r) => (r.state === 'NONE' ? 'This change has no automatic double-check yet: not proved' : `${esc(plainRead(r))}: ${mark(r.state)}`)));
  }
  return '';
}

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
.plain { margin: 4px 0 8px; }
.plain-list { margin: 4px 0 8px; padding-left: 20px; }
.card pre.shown { font: inherit; background: var(--panel); border-color: var(--line); }
pre { margin: 8px 0 0; padding: 10px; overflow-x: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--bg); border: 1px solid var(--line); border-radius: 4px; }
@media (max-width: 720px) { header { padding: 16px; } .layout { grid-template-columns: minmax(0, 1fr); } nav { border-right: 0; border-bottom: 1px solid var(--line); } main { padding: 16px; } }
`;

function stepHtml(step, t) {
  const sim = /SIMULATED/.test(step.tag);
  const cost = typeof step.cost_usd === 'number' ? `<span>${esc(usd(step.cost_usd))}</span>` : '';
  const code = step.exit_code === null || step.exit_code === undefined ? '' : `<span>exit ${esc(step.exit_code)}</span>`;
  // step 4's output is the answer, shown in its own fold; the technical fold shows the aegis-desk block
  const block = step.n === 4 && step.output ? deskBlock(step.output) : null;
  const technical = block ? (block.present ? block.lines.join('\n') : '') : step.output;
  const output = technical ? `<pre class="shown">${esc(technical)}</pre>` : '';
  const name = PLAIN_STEP_NAMES[step.n - 1] || step.name;
  return `<div class="step"><h3>Step ${esc(step.n)}: ${esc(name)}</h3>
<p class="plain">${esc(stepPlain(step, t))}</p>${stepExtra(step, t)}
<details><summary>Technical details</summary><div class="meta"><span>${esc(step.name)}</span><span>${esc(step.actor)}</span><span class="tag${sim ? ' sim' : ''}">${esc(step.tag)}</span><span>${esc(seconds(step.duration_ms))}</span>${code}${cost}</div>
<p class="result">${esc(step.result)}</p>${output}</details></div>`;
}

function ticketHtml(t) {
  const reason = t.reason ? `\n<details><summary>Technical details</summary><p class="reason">${esc(t.reason)}</p></details>` : '';
  return `<section class="ticket" id="t-${safeId(t.id)}"><h2>${esc(t.id)}: ${esc(t.title)}</h2>
<p class="note">${esc(t.customer_label)}. Result: <strong>${esc(t.closing_state)}</strong>.</p>
<p class="plain">${esc(closingPlain(t))}</p>${reason}
${t.steps.map((step) => stepHtml(step, t)).join('\n')}</section>`;
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
<p class="plain">This page follows each ticket from the customer's message to the result.</p>
<p class="plain">It is a practice run: the customers, their systems and the person who signs off are all pretend.</p>${run.aborted ? '\n<p class="plain reason">The run stopped early for safety, so later tickets did not run.</p>' : ''}${run.not_run && run.not_run.length ? `\n<p class="plain reason">Did not run: ${esc(run.not_run.map((n) => n.id).join(', '))}, because ${/limit/.test(run.not_run[0].reason) ? 'the spending limit would have been passed' : 'the run stopped early'}.</p>` : ''}
<details><summary>Technical details</summary><p class="note">Run ${esc(run.run_id)}, started ${esc(run.started_at)}.</p>
<p class="note">${esc(SENTENCE)}</p>${run.aborted ? `\n<p class="note reason">${esc(run.aborted)}</p>` : ''}${run.not_run && run.not_run.length ? `\n<p class="note reason">Not run: ${esc(run.not_run.map((n) => n.id).join(', '))}, because ${esc(run.not_run[0].reason)}.</p>` : ''}</details>
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

module.exports = { SENTENCE, STATES, PLAIN_STEP_NAMES, html, summarize, summaryLines, stepLine, seconds, closingPlain, plainRead, stepPlain };
