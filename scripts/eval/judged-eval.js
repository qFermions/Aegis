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
//        [--web] [--max-turns N] [--timeout-ms N] [--judge-model <model>]
//        [--results-dir <dir>] [--baseline <results.json>] [--calibration-sheet N]
//        [--pass-threshold 0..1] [--agreement-threshold -1..1] [--thresholds <file.json>]
//   node scripts/eval/judged-eval.js calibrate --sheet <filled.csv> --run <results.json>
//        [--agreement-threshold -1..1] [--thresholds <file.json>]
//   node scripts/eval/judged-eval.js --help
//
// The case file must live outside the repository (a path inside it, or one whose real
// path is inside it, is refused). To run the DEV set, copy it out first:
//   cp scripts/eval/judged/dev-cases.jsonl /tmp/dev-cases.jsonl
//   node scripts/eval/judged-eval.js run --cases /tmp/dev-cases.jsonl
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

const { EXIT } = thresholds;
const SMOKE_USD_PER_SESSION = 2.5;

const USAGE = `Usage:
  node scripts/eval/judged-eval.js run --cases <file.jsonl> [--execute]
       [--web] [--max-turns N] [--timeout-ms N] [--judge-model <model>]
       [--results-dir <dir>] [--baseline <results.json>] [--calibration-sheet N]
       [--pass-threshold 0..1] [--agreement-threshold -1..1] [--thresholds <file.json>]
  node scripts/eval/judged-eval.js calibrate --sheet <filled.csv> --run <results.json>
       [--agreement-threshold -1..1] [--thresholds <file.json>]

The case file must be outside the repository (copy scripts/eval/judged/dev-cases.jsonl to a
temporary file first). Without --execute, run is a dry run that starts no process.
Exit codes: 0 PASS, 2 FAIL, 3 no threshold given, 4 dry run, 1 input error or refused path.
`;

const SPECS = {
  run: {
    values: ['--cases', '--max-turns', '--timeout-ms', '--judge-model', '--results-dir', '--baseline', '--calibration-sheet', '--pass-threshold', '--agreement-threshold', '--thresholds'],
    flags: ['--execute', '--web'],
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
  const sut = backends.sutArgs({ prompt: '<ticket>', maxTurns: config.max_turns, web: config.web }).join(' ');
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
  out(`system-under-test sessions: ${list.length}, turns: ${runs} (${followUps} follow-up turn(s) resumed in their session)`);
  out(`judge sessions: ${list.length} (up to ${list.length * 2} with one retry each)`);
  out(`cost estimate: about ${(runs * SMOKE_USD_PER_SESSION).toFixed(2)} US dollars for the system under test (${runs} Aegis runs at about ${SMOKE_USD_PER_SESSION.toFixed(2)} US dollars each, the smoke figure in docs/evidence/runtime-smoke.md); judge cost is not in the estimate until measured`);
  out(`system under test: ${preview.sut} (cwd: the repository root; timeout ${config.timeout_ms} ms per process)`);
  out(`judge: ${preview.judge} (cwd: a fresh empty temporary directory)`);
  out(`results: ${config.results_dir_given ? 'the --results-dir given' : '.aegis-state/evals/<run-id>/'} (checked when the run starts)`);
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
    judge_model: opts['--judge-model'] || null,
    results_dir_given: Boolean(opts['--results-dir']),
  };
  if (config.judge_model !== null && !/^[A-Za-z0-9._:\[\]-]{1,100}$/.test(config.judge_model)) throw new InputError('--judge-model is a model name (letters, digits, dot, dash, colon, brackets)');
  const sheetN = intFlag(opts, '--calibration-sheet', 0, 1, 1000);
  const real = paths.refuseInsideRepo(opts['--cases'], 'the case file', { repoRoot });
  const list = cases.readCaseFile(real).cases;
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
  for (const c of list) {
    const sut = await backends.runSut(c, { ...backend, repoRoot, maxTurns: config.max_turns, web: config.web });
    const det = sut.state === 'OK' ? checks.runChecks(c, sut) : [];
    const jr = sut.state === 'OK' ? await judge.judgeCase(c, sut, { ...backend, repoRoot, judgeModel: config.judge_model, random: deps.random }) : null;
    const v = judge.caseVerdict(c, sut, det, jr);
    const r = {
      id: c.id, platform: c.platform, capability: c.capability, scenario: c.scenario, class: c.class, probe: c.probe,
      change_class: c.expected.change_class, escalate: c.expected.escalate,
      sut, checks: det, judge: jr, rows: v.rows, total: v.total, max: v.max, verdict: v.verdict, reasons: v.reasons,
    };
    results.push(r);
    io.out(report.terminalLine(r));
  }
  const summary = report.summarize(results, { baseline });
  const uniq = (xs) => [...new Set(xs.filter(Boolean))];
  const payload = {
    run_id: runId, started, finished: new Date().toISOString(),
    config: { max_turns: config.max_turns, timeout_ms: config.timeout_ms, web: config.web, judge_model: config.judge_model },
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
