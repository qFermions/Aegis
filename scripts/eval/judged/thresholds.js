'use strict';
// thresholds.js: the pass threshold and the agreement threshold of the judged eval, and
// the verdict printed against them.
//
// - pass_rate (0..1) is compared with the run's pass rate over judged cases; kappa (-1..1)
//   with the calibration's overall Cohen's kappa.
// - They come from flags (--pass-threshold, --agreement-threshold) or a JSON file
//   (--thresholds <file>) that must live outside the repository (its real path is
//   checked) and holds only the keys pass_rate and kappa. A flag wins over the file.
// - Without a threshold the verdict is never PASS: NO VERDICT (exit 3), except that a run
//   with a boundary violation is FAIL whatever was given.
// Nothing here writes any file.

const fs = require('node:fs');

const { refuseInsideRepo } = require('./paths.js');

const EXIT = Object.freeze({ PASS: 0, INPUT: 1, FAIL: 2, NO_VERDICT: 3, DRY_RUN: 4 });
const RANGES = Object.freeze({ pass_rate: [0, 1], kappa: [-1, 1] });
const NO_THRESHOLD = 'NO VERDICT: no threshold was given';

class ThresholdError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ThresholdError';
  }
}

function checkValue(key, value, label) {
  const [lo, hi] = RANGES[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < lo || value > hi) throw new ThresholdError(`${label} must be a number from ${lo} to ${hi}`);
  return value;
}

function parseFlag(key, text, label) {
  if (text === undefined || text === null) return null;
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(String(text))) throw new ThresholdError(`${label} must be a number from ${RANGES[key][0]} to ${RANGES[key][1]}`);
  return checkValue(key, Number(text), label);
}

function readThresholdsFile(file, { repoRoot } = {}) {
  const real = refuseInsideRepo(file, 'the thresholds file', { repoRoot });
  let data;
  try { data = JSON.parse(fs.readFileSync(real, 'utf8')); } catch { throw new ThresholdError('the thresholds file is not valid JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ThresholdError('the thresholds file must hold a JSON object');
  for (const k of Object.keys(data)) if (!Object.prototype.hasOwnProperty.call(RANGES, k)) throw new ThresholdError(`the thresholds file has an unknown key${/^[A-Za-z0-9_]{1,40}$/.test(k) ? ` ${k}` : ''} (allowed: pass_rate, kappa)`);
  const out = {};
  for (const k of Object.keys(RANGES)) out[k] = data[k] === undefined ? null : checkValue(k, data[k], `thresholds file ${k}`);
  return out;
}

// flags: { passThreshold, agreementThreshold, thresholdsFile } (strings or undefined).
function resolveThresholds(flags, { repoRoot } = {}) {
  const fromFile = flags.thresholdsFile ? readThresholdsFile(flags.thresholdsFile, { repoRoot }) : { pass_rate: null, kappa: null };
  const pass = parseFlag('pass_rate', flags.passThreshold, '--pass-threshold');
  const kappa = parseFlag('kappa', flags.agreementThreshold, '--agreement-threshold');
  return { pass_rate: pass !== null ? pass : fromFile.pass_rate, kappa: kappa !== null ? kappa : fromFile.kappa };
}

// The run verdict. summary: report.summarize() output.
function runVerdict(summary, thresholds) {
  const reasons = [];
  const bv = summary.measures.boundary_violations.count;
  if (bv > 0) reasons.push(`${bv} boundary violation(s)`);
  if (thresholds.pass_rate === null) {
    return reasons.length ? { verdict: 'FAIL', line: `FAIL: ${reasons.join('; ')}`, code: EXIT.FAIL } : { verdict: 'NO VERDICT', line: NO_THRESHOLD, code: EXIT.NO_VERDICT };
  }
  const rate = summary.measures.pass_rate.rate;
  if (rate === null) reasons.push('no judged case');
  else if (rate < thresholds.pass_rate) reasons.push(`pass rate ${rate.toFixed(3)} under the threshold ${thresholds.pass_rate}`);
  if (summary.inconclusive > 0) reasons.push(`${summary.inconclusive} inconclusive case(s): an inconclusive case never counts as a pass`);
  if (reasons.length) return { verdict: 'FAIL', line: `FAIL: ${reasons.join('; ')}`, code: EXIT.FAIL };
  return { verdict: 'PASS', line: `PASS: pass rate ${rate.toFixed(3)} at or over the threshold ${thresholds.pass_rate}; no boundary violation`, code: EXIT.PASS };
}

// The calibration verdict. agreement: calibrate.agreement() output.
function agreementVerdict(agreement, thresholds) {
  if (thresholds.kappa === null) return { verdict: 'NO VERDICT', line: NO_THRESHOLD, code: EXIT.NO_VERDICT };
  const k = agreement.overall.kappa;
  if (k === null) return { verdict: 'FAIL', line: 'FAIL: kappa cannot be computed (no scored pairs, or expected agreement 1)', code: EXIT.FAIL };
  if (k < thresholds.kappa) return { verdict: 'FAIL', line: `FAIL: kappa ${k.toFixed(3)} under the threshold ${thresholds.kappa}`, code: EXIT.FAIL };
  return { verdict: 'PASS', line: `PASS: kappa ${k.toFixed(3)} at or over the threshold ${thresholds.kappa}`, code: EXIT.PASS };
}

module.exports = { EXIT, RANGES, NO_THRESHOLD, ThresholdError, parseFlag, readThresholdsFile, resolveThresholds, runVerdict, agreementVerdict };
