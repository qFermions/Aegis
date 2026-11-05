'use strict';
// full-run-evidence.js <out-dir> <run-dir>...: turns task 8's run folders into the saved evidence: one desk page
// with every ticket, each run's own page, every init event, the summary table, and from each session the deny
// and memory lines of its debug log and what it read or was refused. No whole debug log or stream is copied.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const render = require(path.join(repo, 'scripts/demo/render.js'));
const home = os.homedir();
const account = os.userInfo().username;
const clean = (s) => String(s)
  .replaceAll(repo, '<repo>').replaceAll(home, '<home>')
  .replace(/\/(?:private\/)?(?:tmp|var\/folders)\/[^\s"'\]]*/g, '<tmp>')
  .replace(new RegExp(`-Users-${account}-`, 'g'), '-Users-<account>-')
  .replace(new RegExp(`\\b${account}\\b`, 'g'), '<account>')
  .replaceAll('—', '-');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

const [, , out, ...runDirs] = process.argv;
fs.mkdirSync(path.join(out, 'init'), { recursive: true });
const runs = runDirs.map((d) => ({ dir: d, run: JSON.parse(fs.readFileSync(path.join(d, 'run.json'), 'utf8')), files: walk(d) }));
const fileOf = (id, suffix) => runs.flatMap((r) => r.files).find((f) => path.basename(f) === `${id}${suffix}`);

const tickets = runs.flatMap((r) => r.run.tickets).sort((a, b) => a.id.localeCompare(b.id));
const notRun = runs.flatMap((r) => r.run.not_run || []);
const counts = runs.reduce((a, r) => ({
  probes_refused: a.probes_refused + r.run.summary.injection_probes_refused,
  boundary_failures: a.boundary_failures + r.run.summary.boundary_failures,
}), { probes_refused: 0, boundary_failures: 0 });
const summary = render.summarize(tickets, counts);
const merged = { schema: runs[0].run.schema, run_id: runs.map((r) => r.run.run_id).join(' and '), started_at: runs[0].run.started_at, tickets, summary };
if (notRun.length) merged.not_run = notRun;
fs.writeFileSync(path.join(out, 'desk.html'), clean(render.html(merged)));
runs.forEach((r, i) => fs.writeFileSync(path.join(out, `desk-run-${i + 1}.html`), clean(fs.readFileSync(path.join(r.dir, 'desk.html'), 'utf8'))));

const rows = tickets.map((t) => {
  const m = t.steps.find((s) => s.n === 4);
  const stopped = t.steps.find((s) => /^not reached/.test(s.result));
  const at = stopped ? `step ${stopped.n - 1} ${t.steps[stopped.n - 2].name}` : 'step 9 CLOSE';
  const why = t.reason || 'ran every step';
  return `| ${t.id} | ${t.closing_state} | ${at} | ${why.replaceAll('|', '/').replace(/\s+/g, ' ')} | ${m.turns ?? 'none'} | ${(m.duration_ms / 1000).toFixed(1)} | ${typeof m.cost_usd === 'number' ? m.cost_usd.toFixed(2) : 'none'} |`;
});
const table = ['# Full run 1: one row per ticket', '', '| ticket | closing state | step it stopped at | why | turns | seconds | cost in US dollars |', '|---|---|---|---|---|---|---|', ...rows, '',
  `Run totals: ${render.summaryLines(summary).join('; ')}`, ...notRun.map((n) => `Did not run: ${n.id}, because ${n.reason}.`), ''];
fs.writeFileSync(path.join(out, 'summary.md'), clean(table.join('\n')));

const activity = [];
const WORDS = [/did i miss anything/i, /reviewer load/i, /5-question quiz/i, /aegis-private/i];
for (const t of tickets) {
  activity.push(`## ${t.id}`);
  const init = fileOf(t.id, '-init.json');
  if (init) fs.writeFileSync(path.join(out, 'init', `${t.id}-init.json`), clean(fs.readFileSync(init, 'utf8')));
  else activity.push('no init event: no session ran');
  const dbg = fileOf(t.id, '-debug.log');
  if (dbg) for (const l of fs.readFileSync(dbg, 'utf8').split('\n')) if (/deny rule/i.test(l)) activity.push(`debug: ${clean(l).replace(/^\S+\s+/, '').slice(0, 160)}`);
  const stream = fileOf(t.id, '-stream.jsonl');
  if (!stream) { activity.push(''); continue; }
  const text = fs.readFileSync(stream, 'utf8');
  const tools = {};
  const paths = new Set();
  const refused = [];
  for (const line of text.split('\n')) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    for (const c of (e.message && Array.isArray(e.message.content) ? e.message.content : [])) {
      if (c.type === 'tool_use') {
        tools[c.name] = (tools[c.name] || 0) + 1;
        const p = c.input && (c.input.file_path || c.input.path || c.input.pattern);
        if (p) paths.add(`${c.name} ${clean(p)}`);
      }
      if (c.type === 'tool_result' && c.is_error) refused.push(clean(typeof c.content === 'string' ? c.content : JSON.stringify(c.content)).replace(/\s+/g, ' ').slice(0, 200));
    }
  }
  activity.push(`tools: ${JSON.stringify(tools)}`);
  for (const p of paths) activity.push(`  ${p}`);
  activity.push(`refused or failed tool calls: ${refused.length}`);
  for (const r of refused) activity.push(`  ${r}`);
  activity.push(`owner's wording in the session's stream: ${WORDS.map((w) => `${w.source} ${(text.match(new RegExp(w.source, 'gi')) || []).length}`).join(', ')}`, '');
}
fs.writeFileSync(path.join(out, 'session-activity.md'), clean(`# What each session loaded, read and was refused\n\n${activity.join('\n')}\n`));
console.log(rows.join('\n'));
