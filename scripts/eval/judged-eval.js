#!/usr/bin/env node
'use strict';
// judged-eval.js: the model-judged evaluation runner (capability row 26).
//
// Runs each case of a JSONL case file through Aegis headless (the system under test,
// `claude -p` from the repository root with read-only tools), runs deterministic checks
// on the answer, has a separate judge process grade it against the case's expected
// decision, and writes results.json and report.md. Every page is labelled
// "simulated: model-judged on a case file, no real tenant". The terminal shows case ids,
// verdicts and scores only, never case text or answers.
//
// Usage:
//   node scripts/eval/judged-eval.js run --cases <file.jsonl> [--execute]
//        [--web] [--no-tools] [--max-turns N] [--timeout-ms N] [--model <model>] [--judge-model <model>]
//        [--results-dir <dir>] [--baseline <results.json>] [--calibration-sheet N]
//        [--pass-threshold 0..1] [--agreement-threshold -1..1] [--thresholds <file.json>]
//        [--budget-usd N]
//   node scripts/eval/judged-eval.js calibrate --sheet <filled.csv> --run <results.json>
//        [--agreement-threshold -1..1] [--thresholds <file.json>]
//   node scripts/eval/judged-eval.js --help
// --budget-usd N is a limit for the whole run, system under test and judge together (batch 11): before each
// case the run stops if what it has spent plus one more case (the dearest so far, or 1.00 before any cost is
// known) would pass it, and the cases that did not run are INCONCLUSIVE in the results, never a pass.
//
// The case file must live outside the repository (a path inside it, or one whose real
// path is inside it, is refused), in a folder of its own: that folder is denied to the
// system under test, so a folder that holds the repository (the home folder) is refused
// too (batch 11, task 7). To run the DEV set, copy it out first:
//   mkdir -p /tmp/aegis-cases && cp scripts/eval/judged/dev-cases.jsonl /tmp/aegis-cases/
//   node scripts/eval/judged-eval.js run --cases /tmp/aegis-cases/dev-cases.jsonl
// Without --execute the run is a DRY RUN: it prints the plan and a cost estimate and
// starts no process at all.
//
// Exit codes: 0 PASS; 2 FAIL (also any boundary violation); 3 run completed but no
// threshold was given (NO VERDICT); 4 dry run; 1 input error or refused path.
// The runner never edits a repository file; results go to <repo>/.aegis-state/evals/<run-id>/
// (gitignored) unless --results-dir names an ignored or outside directory.

const fs = require('node:fs');
const path = require('node:path');

const cases = require('./judged/cases.js');
const paths = require('./judged/paths.js');
const backends = require('./judged/backends.js');
const checks = require('./judged/checks.js');
const judge = require('./judged/judge.js');
const report = require('./judged/report.js');
const calibrate = require('./judged/calibrate.js');
const thresholds = require('./judged/thresholds.js');
// the privacy step ask-aegis.js runs on --setup, for a case's setup (batch 11, task 1)
const { protect } = require('../ask-aegis.js');
// the desk's own counter of a Fix card's words, read only (batch 11, task 7)
const { fixCard } = require('../demo/answer.js');
// batch 12: the answer mode, the judgment rule rows and the checks of tasks 1, 3 and 6
const expert = require('../demo/expert-rules.js');
// The lane a case belongs to, from its capability (batch 12, task 13); the platform says where, the lane says what kind.
const LANES = Object.freeze({ security: 'security', networking: 'networking', infrastructure: 'infrastructure', 'software-engineering': 'software-engineering', 'it-support': 'helpdesk' });
const laneOf = (c) => LANES[c.capability] || 'other';
// What one case's answer shows of batch 12: its mode (named on the first line, shown by its shape, against the case's
// expected mode), its judgment rule rows, and its tool calls counted by tool.
function batch12Record(c, sut) {
  const answered = typeof sut.answer === 'string';
  const mode = answered ? expert.answerMode(sut.answer, c.ticket) : { named: null, shown: null };
  const counts = {};
  for (const call of Array.isArray(sut.tool_calls) ? sut.tool_calls : []) counts[call.tool] = (counts[call.tool] || 0) + 1;
  return {
    lane: laneOf(c),
    mode: { named: mode.named, shown: mode.shown, expected: c.expected.mode || '', match: c.expected.mode ? mode.named === c.expected.mode : null },
    expert_rows: answered ? expert.expertRows(sut.answer, { ticket: c.ticket, evidence: c.evidence }).map((x) => ({ check: x.check, verdict: x.verdict, detail: x.detail })) : [],
    tool_call_counts: counts,
  };
}

const { EXIT } = thresholds;
const SMOKE_USD_PER_SESSION = 2.5;

const USAGE = `Usage:
  node scripts/eval/judged-eval.js run --cases <file.jsonl> [--execute]
       [--web] [--no-tools] [--max-turns N] [--timeout-ms N] [--model <model>] [--judge-model <model>]
       [--results-dir <dir>] [--baseline <results.json>] [--calibration-sheet N]
       [--pass-threshold 0..1] [--agreement-threshold -1..1] [--thresholds <file.json>]
       [--budget-usd N]
  node scripts/eval/judged-eval.js calibrate --sheet <filled.csv> --run <results.json>
       [--agreement-threshold -1..1] [--thresholds <file.json>]

The case file must be outside the repository, in a folder of its own (copy
scripts/eval/judged/dev-cases.jsonl into a new temporary folder first): that folder is denied to
the system under test. Without --execute, run is a dry run that starts no process.
--model and --judge-model name the two sessions' models, claude-opus-5-5 unless given; a case whose
session reports another model is INCONCLUSIVE.
Exit codes: 0 PASS, 2 FAIL, 3 no threshold given, 4 dry run, 1 input error or refused path.
`;

const SPECS = {
  run: {
    values: ['--cases', '--max-turns', '--timeout-ms', '--model', '--judge-model', '--results-dir', '--baseline', '--calibration-sheet', '--pass-threshold', '--agreement-threshold', '--thresholds', '--budget-usd'],
    flags: ['--execute', '--web', '--no-tools'],
  },
  calibrate: {
    values: ['--sheet', '--run', '--agreement-threshold', '--thresholds'],
    flags: [],
  },
};

class InputError extends Error {}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') return { command: 'help' };
  const spec = SPECS[command];
  if (!spec) throw new InputError('the first argument is run or calibrate (see --help)');
  const opts = {};
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--help' || a === '-h') return { command: 'help' };
    if (spec.flags.includes(a)) { opts[a] = true; continue; }
    if (spec.values.includes(a)) {
      if (i + 1 >= rest.length || rest[i + 1].startsWith('--')) throw new InputError(`${a} needs a value`);
      if (Object.prototype.hasOwnProperty.call(opts, a)) throw new InputError(`${a} is given twice`);
      opts[a] = rest[i + 1];
      i += 1;
      continue;
    }
    throw new InputError(`unknown argument${/^--[a-z-]{1,40}$/.test(a) ? ` ${a}` : ''} (see --help)`);
  }
  return { command, opts };
}

function intFlag(opts, name, def, lo, hi) {
  if (opts[name] === undefined) return def;
  if (!/^\d+$/.test(opts[name])) throw new InputError(`${name} must be a whole number from ${lo} to ${hi}`);
  const n = Number(opts[name]);
  if (n < lo || n > hi) throw new InputError(`${name} must be a whole number from ${lo} to ${hi}`);
  return n;
}

function commandPreview(config) {
  const sut = backends.sutArgs({ prompt: '<ticket>', maxTurns: config.max_turns, web: config.web, caseDirs: config.case_dirs, model: config.model, tools: config.tools, auditFile: '<results>/<case>-tool-audit.jsonl', typedFile: '<results>/<case>-typed.txt' }).join(' ');
  const jud = backends.judgeArgs({ prompt: '<judge prompt>', model: config.judge_model }).map((a) => (a === '' ? '""' : a)).join(' ');
  return { sut: `claude ${sut}`, judge: `claude ${jud}` };
}

function printPlan(out, list, config) {
  const followUps = list.filter((c) => c.follow_up !== '').length;
  const runs = list.length + followUps;
  const preview = commandPreview(config);
  out(`judged-eval: DRY RUN (nothing was started; add --execute to run it)`);
  out(`label: ${report.LABEL}`);
  out(`cases: ${list.length} (${list.map((c) => c.id).join(', ')})`);
  out(`setup: ${list.filter((c) => c.setup !== '').length} of ${list.length} case(s) carry a setup (what the company runs, given to the system under test as data)`);
  out(`system-under-test sessions: ${list.length}, turns: ${runs} (${followUps} follow-up turn(s) resumed in their session)`);
  out(`judge sessions: ${list.length} (up to ${list.length * 2} with one retry each)`);
  out(`cost estimate: about ${(runs * SMOKE_USD_PER_SESSION).toFixed(2)} US dollars for the system under test (${runs} Aegis runs at about ${SMOKE_USD_PER_SESSION.toFixed(2)} US dollars each, the smoke figure in docs/evidence/runtime-smoke.md); judge cost is not in the estimate until measured`);
  out(`system under test: ${preview.sut} (cwd: the repository root; timeout ${config.timeout_ms} ms per process)`);
  out(`judge: ${preview.judge} (cwd: a fresh empty temporary directory)`);
  out(`case folder: denied to the system under test, as given and as resolved (${backends.readDenyRules(null, config.case_dirs).length - backends.readDenyRules().length} read rule(s), the last in the --settings above; the results folder is added when the run starts)`);
  out(`results: ${config.results_dir_given ? 'the --results-dir given' : '.aegis-state/evals/<run-id>/'} (checked when the run starts)`);
  if (config.budget_usd !== null) out(`limit: ${config.budget_usd.toFixed(2)} US dollars for the whole run; it stops before a case that could pass it`);
}

// What one more case is taken to cost before the run's limit is checked: the dearest case so far in this run, or
// this much before any case has reported a cost. shortcut: one fixed first guess, so a first case dearer than it can
// pass a very tight limit by that case's own cost; upgrade to a per-session cap if a run ever does.
const FIRST_CASE_GUESS_USD = 1;

// The record of a case the run did not start because its limit would be passed: INCONCLUSIVE, never a pass.
function notRunRecord(c, reason) {
  const sut = { state: 'NOT_RUN', reason, answer: null, follow_up_answer: null, num_turns: null, duration_ms: 0, cost_usd: null, model: null, session_id: null, turns: [], tool_calls: [], outside_reads: [] };
  return {
    id: c.id, platform: c.platform, capability: c.capability, scenario: c.scenario, class: c.class, probe: c.probe,
    setup_given: c.setup !== '', fix_card_words: null,
    change_class: c.expected.change_class, escalate: c.expected.escalate,
    sut, checks: [], judge: null, rows: null, total: null, max: null, verdict: 'INCONCLUSIVE', reasons: [reason], off_model: false,
    ...batch12Record(c, sut),
    tool_server: backends.toolServerRecord(null),
  };
}

// A case's setup goes through the privacy step ask-aegis.js runs on --setup: an email address or a phone
// number becomes a placeholder, and a credential or a tenant literal refuses the run, named by case id and
// label only, never the value (batch 11, task 1).
function protectSetups(list) {
  const refused = [];
  const out = list.map((c) => {
    if (c.setup === '') return c;
    const p = protect(c.setup);
    if (p.blocked) { refused.push(`the setup of case ${c.id} holds a value Aegis never keeps (${p.blocked.join('; ')})`); return c; }
    return { ...c, setup: p.text };
  });
  if (refused.length) throw new InputError(`${refused.join('; ')}. Nothing was started: take the value out of the case file and run again.`);
  return out;
}

function loadBaseline(file) {
  if (!file) return null;
  try { return report.readBaseline(file); } catch (e) { throw new InputError(e.message); }
}

async function runCommand(opts, io, deps) {
  const repoRoot = deps.repoRoot || paths.REPO_ROOT;
  if (!opts['--cases']) throw new InputError('--cases <file.jsonl> is required');
  const th = thresholds.resolveThresholds({ passThreshold: opts['--pass-threshold'], agreementThreshold: opts['--agreement-threshold'], thresholdsFile: opts['--thresholds'] }, { repoRoot });
  const config = {
    max_turns: intFlag(opts, '--max-turns', backends.DEFAULT_MAX_TURNS, 1, 200),
    timeout_ms: intFlag(opts, '--timeout-ms', backends.DEFAULT_TIMEOUT_MS, 1, 3600000),
    web: Boolean(opts['--web']),
    // the read-only tool server (batch 12, task 5): on unless --no-tools
    tools: !opts['--no-tools'],
    // both pinned (batch 11 resumed): a session never takes the settings file's default model
    model: opts['--model'] === undefined ? backends.PINNED_MODEL : opts['--model'],
    judge_model: opts['--judge-model'] === undefined ? backends.PINNED_MODEL : opts['--judge-model'],
    results_dir_given: Boolean(opts['--results-dir']),
    budget_usd: null,
  };
  if (opts['--budget-usd'] !== undefined) {
    if (!/^\d+(?:\.\d+)?$/.test(opts['--budget-usd']) || !(Number(opts['--budget-usd']) > 0)) throw new InputError('--budget-usd takes a limit in US dollars above zero, such as 9.50');
    config.budget_usd = Number(opts['--budget-usd']);
  }
  for (const [flag, value] of [['--model', config.model], ['--judge-model', config.judge_model]]) {
    if (!backends.isModelName(value)) throw new InputError(`${flag} is a model name (letters, digits, dot, dash, colon, brackets)`);
    // each case is checked against the model its session reports, which is the full id, so an alias such as "opus"
    // would make every case off-model (code review 1, finding 3)
    if (!/\d/.test(value)) throw new InputError(`${flag} takes a full model id, such as claude-opus-5-5: each case is checked against the model its session reports`);
  }
  const sheetN = intFlag(opts, '--calibration-sheet', 0, 1, 1000);
  const real = paths.refuseInsideRepo(opts['--cases'], 'the case file', { repoRoot });
  // the folders the case file is read from, denied to every system-under-test turn; refused when one holds the repository
  config.case_dirs = paths.caseFolders(opts['--cases'], real, { repoRoot });
  const list = protectSetups(cases.readCaseFile(real).cases);
  const baseline = loadBaseline(opts['--baseline']);

  if (!opts['--execute']) {
    printPlan(io.out, list, config);
    return EXIT.DRY_RUN;
  }

  const runId = (deps.newRunId || paths.newRunId)();
  const dir = paths.checkResultsDir(opts['--results-dir'] || paths.defaultResultsDir(runId, repoRoot), { repoRoot, git: deps.git });
  fs.mkdirSync(dir, { recursive: true });
  paths.checkResultsDir(dir, { repoRoot, git: deps.git });

  const env = backends.scrubEnv(deps.env || process.env, backends.readExampleNames(repoRoot));
  const backend = { command: (deps.backend && deps.backend.command) || 'claude', prefixArgs: (deps.backend && deps.backend.prefixArgs) || [], spawn: deps.spawn, env, timeoutMs: config.timeout_ms, graceMs: deps.graceMs };
  const started = new Date().toISOString();
  io.out(`judged-eval: run ${runId}, ${list.length} case(s); ${report.LABEL}`);
  const results = [];
  // what the run has spent (both backends) and its dearest case, for the --budget-usd guard
  let spent = 0;
  let dearest = 0;
  let notRun = 0;
  // a session that stopped with no cost reported: what the run spent is unknown, so no limit can be held after it
  let costUnknown = false;
  // the first case on another model than the pin: no later case would count, so none starts (code review 2, finding 12)
  let offModel = null;
  for (const c of list) {
    // a results folder used before: this case's audit and typed files of the earlier run go before anything is decided,
    // so a case the run does not start leaves none behind (code review 2 of batch 12d, finding 5)
    for (const name of ['tool-audit.jsonl', 'typed.txt']) { try { fs.rmSync(path.join(dir, `${c.id}-${name}`), { force: true }); } catch { /* left as it is */ } }
    if (offModel) {
      const r = notRunRecord(c, `not run: ${offModel} was not measured on the pinned model (its session ran on another model or did not say which), so no later case would count`);
      results.push(r);
      notRun += 1;
      io.out(report.terminalLine(r));
      continue;
    }
    if (config.budget_usd !== null && (costUnknown || spent + (dearest > 0 ? dearest : FIRST_CASE_GUESS_USD) > config.budget_usd + 1e-9)) {
      const r = notRunRecord(c, costUnknown
        ? `not run: a session before this case stopped with no cost reported, so what the run spent is unknown and its limit of ${config.budget_usd.toFixed(2)} US dollars cannot be held`
        : `not run: the run's limit of ${config.budget_usd.toFixed(2)} US dollars would be passed (${spent.toFixed(2)} spent, one more case taken to cost ${(dearest > 0 ? dearest : FIRST_CASE_GUESS_USD).toFixed(2)})`);
      results.push(r);
      notRun += 1;
      io.out(report.terminalLine(r));
      continue;
    }
    // each case's tool calls are audited to a file of its own in the results folder (batch 12, task 5), and what the
    // person typed (the case's setup, ticket, evidence and follow-up) goes to the server in a typed file there (batch 12d)
    const sut = await backends.runSut(c, { ...backend, repoRoot, maxTurns: config.max_turns, web: config.web, runRoot: dir, caseDirs: config.case_dirs, model: config.model, tools: config.tools, auditFile: path.join(dir, `${c.id}-tool-audit.jsonl`), typedFile: path.join(dir, `${c.id}-typed.txt`) });
    // the Fix card's words by the desk's own counter; null when the answer has no card. A measure, never a pass or fail.
    const card = typeof sut.answer === 'string' ? fixCard(sut.answer) : null;
    // the batch 12 checks (fix-card-fits, claims-match-calls, fetched-citations) count like any check: one that fails fails the case
    const det = sut.state === 'OK' ? [...checks.runChecks(c, sut), ...expert.judgedChecks(c, sut)] : [];
    const jr = sut.state === 'OK' ? await judge.judgeCase(c, sut, { ...backend, repoRoot, judgeModel: config.judge_model, random: deps.random }) : null;
    const v = judge.caseVerdict(c, sut, det, jr, { sut: config.model, judge: config.judge_model });
    const r = {
      id: c.id, platform: c.platform, capability: c.capability, scenario: c.scenario, class: c.class, probe: c.probe,
      setup_given: c.setup !== '', fix_card_words: card && card.present ? card.words : null,
      change_class: c.expected.change_class, escalate: c.expected.escalate,
      sut, checks: det, judge: jr, rows: v.rows, total: v.total, max: v.max, verdict: v.verdict, reasons: v.reasons, off_model: Boolean(v.off_model),
      ...batch12Record(c, sut),
      // the tool server's calls allowed and refused, and each refused one with its reason, from the case's audit (batch 12d)
      tool_server: backends.toolServerRecord(path.join(dir, `${c.id}-tool-audit.jsonl`)),
    };
    results.push(r);
    io.out(report.terminalLine(r));
    if (r.off_model) offModel = c.id;
    // each turn's known cost counts, and a session that ran and reported none makes the run's spending unknown
    // (code review 1, finding 2): a timeout, an output-cap kill, or a session that started (it reported its model)
    const turns = Array.isArray(sut.turns) && sut.turns.length ? sut.turns : [sut];
    if (turns.some(backends.ranUnpriced) || backends.ranUnpriced(jr)) costUnknown = true;
    const caseCost = turns.reduce((a, x) => a + (typeof x.cost_usd === 'number' ? x.cost_usd : 0), 0) + (jr && typeof jr.cost_usd === 'number' ? jr.cost_usd : 0);
    spent += caseCost;
    dearest = Math.max(dearest, caseCost);
  }
  const limitText = config.budget_usd === null ? '' : `the run's limit of ${config.budget_usd.toFixed(2)} US dollars`;
  const notRunWhy = offModel ? `${offModel} was not measured on the pinned model (its session ran on another model or did not say which), so no later case would count` : (costUnknown ? `a session stopped with no cost reported, so ${limitText} cannot be held` : `${limitText} would have been passed`);
  if (notRun) io.out(`${notRun} case(s) did not run: ${notRunWhy}; each is INCONCLUSIVE in the results`);
  const summary = report.summarize(results, { baseline });
  const uniq = (xs) => [...new Set(xs.filter(Boolean))];
  const payload = {
    run_id: runId, started, finished: new Date().toISOString(),
    config: { max_turns: config.max_turns, timeout_ms: config.timeout_ms, web: config.web, tools: config.tools, model: config.model, judge_model: config.judge_model, budget_usd: config.budget_usd },
    spent_usd: spent,
    sut_models: uniq(results.map((r) => r.sut && r.sut.model)),
    judge_models: uniq(results.map((r) => r.judge && r.judge.model)),
    summary, cases: results,
  };
  const verdict = thresholds.runVerdict(summary, th);
  payload.verdict = { verdict: verdict.verdict, line: verdict.line, thresholds: th };
  const written = report.writeReport(dir, payload);
  if (sheetN > 0) {
    const sheet = calibrate.writeSheet(dir, results, new Map(list.map((c) => [c.id, c])), sheetN, runId);
    io.out(`calibration sheet: ${sheet.count} case(s) in ${sheet.file}`);
  }
  const m = summary.measures;
  const f = (x) => `${x.numerator}/${x.denominator}`;
  io.out(`pass ${f(m.pass_rate)} judged, correctness ${f(m.correctness)}, procedure ${f(m.procedure_validity)}, verification ${f(m.verification_quality)}, escalation ${f(m.appropriate_escalation)}, boundary violations ${m.boundary_violations.count}, inconclusive ${summary.inconclusive}`);
  io.out(`results: ${written.json}`);
  io.out(`report: ${written.markdown}`);
  io.out(verdict.line);
  return verdict.code;
}

function calibrateCommand(opts, io, deps) {
  const repoRoot = deps.repoRoot || paths.REPO_ROOT;
  if (!opts['--sheet'] || !opts['--run']) throw new InputError('calibrate needs --sheet <filled.csv> and --run <results.json>');
  const th = thresholds.resolveThresholds({ agreementThreshold: opts['--agreement-threshold'], thresholdsFile: opts['--thresholds'] }, { repoRoot });
  let run;
  try { run = JSON.parse(fs.readFileSync(opts['--run'], 'utf8')); } catch { throw new InputError('--run is not a readable results.json'); }
  let sheet;
  try { sheet = calibrate.readSheet(fs.readFileSync(opts['--sheet'], 'utf8')); } catch (e) { throw new InputError(e.code ? '--sheet cannot be read' : e.message); }
  const a = calibrate.agreement(sheet, run);
  const fmt = (x) => (x === null ? 'n/a' : x.toFixed(3));
  io.out(`judged-eval calibration: ${a.sheet_cases} case(s) on the sheet${a.unmatched_cases ? `, ${a.unmatched_cases} not in the run` : ''}; ${report.LABEL}`);
  for (const [key, r] of Object.entries(a.rows)) io.out(`${key}: agreement ${r.agree}/${r.pairs} (${fmt(r.exact)}), kappa ${fmt(r.kappa)}`);
  io.out(`overall: agreement ${a.overall.agree}/${a.overall.pairs} (${fmt(a.overall.exact)}), kappa ${fmt(a.overall.kappa)}`);
  const v = thresholds.agreementVerdict(a, th);
  io.out(v.line);
  return v.code;
}

// argv without node and script; io { out, err }; deps for tests: { spawn, git, env, backend, repoRoot, random, newRunId, graceMs }.
async function main(argv, io = {}, deps = {}) {
  const out = io.out || ((s) => process.stdout.write(`${s}\n`));
  const err = io.err || ((s) => process.stderr.write(`${s}\n`));
  try {
    const parsed = parseArgs(argv);
    if (parsed.command === 'help') { out(USAGE.trimEnd()); return 0; }
    if (parsed.command === 'run') return await runCommand(parsed.opts, { out, err }, deps);
    return calibrateCommand(parsed.opts, { out, err }, deps);
  } catch (e) {
    if (e instanceof InputError || e instanceof paths.PathRefused || e instanceof cases.CaseFileError || e instanceof thresholds.ThresholdError) {
      err(`judged-eval: ${e.message}`);
      return EXIT.INPUT;
    }
    if (e && e.code && /^E[A-Z]+$/.test(e.code)) { err(`judged-eval: a file could not be read or written (${e.code})`); return EXIT.INPUT; }
    throw e;
  }
}

module.exports = { main, parseArgs, USAGE, SMOKE_USD_PER_SESSION };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => {
    process.stderr.write(`judged-eval: unexpected error (${e && e.name ? e.name : 'error'})\n`);
    process.exitCode = 1;
  });
}
