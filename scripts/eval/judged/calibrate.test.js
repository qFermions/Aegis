'use strict';
require('../../adapters/socket-tripwire.js');
// calibrate.test.js: the owner's blind calibration sheet and the agreement math (row 26, B7).
//
// EXPECTED DECISION (written before the module)
// - The sheet holds N cases sampled deterministically from the run id, columns case_id,
//   ticket, answer and one empty column per rubric row; no judge score, no expected field.
//   Cells are quoted per RFC 4180 and survive a round trip.
// - A filled cell is 0, 1, 2, blank or NA; anything else is refused with line and column.
// - Exact agreement is matching pairs over pairs both scored; Cohen's kappa is unweighted
//   over 0/1/2, null with no pairs or an expected agreement of 1.
// Worked examples, checked by hand:
// - 2x2 table, owner rows by judge columns, [[20, 5], [10, 15]]: n 50; po = (20 + 15) / 50
//   = 0.70; owner marginals 25, 25; judge marginals 30, 20; pe = (25 * 30 + 25 * 20) / 2500
//   = 0.50; kappa = (0.70 - 0.50) / (1 - 0.50) = 0.40.
// - 3x3 table [[10, 2, 0], [3, 8, 1], [0, 2, 4]]: n 30; po = 22 / 30; owner marginals 12,
//   12, 6; judge marginals 13, 12, 5; pe = (12 * 13 + 12 * 12 + 6 * 5) / 900 = 330 / 900;
//   kappa = (660 - 330) / (900 - 330) = 330 / 570 = 11 / 19 (about 0.5789).
// Run: node --test scripts/eval/judged/calibrate.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const calibrate = require('./calibrate.js');

// pairs [owner, judge] from a confusion table (rows owner, columns judge)
function pairsFrom(table) {
  const pairs = [];
  table.forEach((row, a) => row.forEach((n, b) => { for (let i = 0; i < n; i += 1) pairs.push([a, b]); }));
  return pairs;
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('Cohen\'s kappa matches the two worked examples', () => {
  const two = calibrate.cohenKappa(pairsFrom([[20, 5], [10, 15]]));
  assert.equal(two.n, 50);
  assert.equal(two.agree, 35);
  close(two.po, 0.7);
  close(two.pe, 0.5);
  close(two.kappa, 0.4);
  const three = calibrate.cohenKappa(pairsFrom([[10, 2, 0], [3, 8, 1], [0, 2, 4]]));
  close(three.po, 22 / 30);
  close(three.pe, 330 / 900);
  close(three.kappa, 11 / 19);
});

test('kappa is null with no pairs or an expected agreement of 1', () => {
  assert.equal(calibrate.cohenKappa([]).kappa, null);
  const same = calibrate.cohenKappa([[2, 2], [2, 2], [2, 2]]);
  assert.equal(same.po, 1);
  assert.equal(same.kappa, null);
});

test('CSV quoting survives a round trip; a formula-looking cell is defused', () => {
  const rows = [['a,b', 'he said "hi"', 'line1\nline2', '=SUM(A1)', 'plain']];
  const text = calibrate.toCsv(rows);
  assert.equal(text, '"a,b","he said ""hi""","line1\nline2",\'=SUM(A1),plain\r\n');
  assert.deepEqual(calibrate.parseCsv(text).map((r) => [...r]), [['a,b', 'he said "hi"', 'line1\nline2', "'=SUM(A1)", 'plain']]);
});

const results = ['DEV01', 'DEV02', 'DEV03', 'DEV04', 'DEV05'].map((id, i) => ({
  id, sut: { state: i === 4 ? 'TIMEOUT' : 'OK', answer: `answer of ${id}, with "quotes"`, follow_up_answer: i === 1 ? 'turn two' : null },
  rows: { classification: 2, risk: i % 3, correctness: 1, privacy: 2, continuity: null },
}));
const casesById = new Map(results.map((r) => [r.id, { id: r.id, ticket: `ticket of ${r.id}`, evidence: r.id === 'DEV02' ? 'pasted lines' : '', follow_up: r.id === 'DEV02' ? 'still broken' : '', expected: { must: ['EXPECTED-SECRET'] }, judge_notes: 'NOTES-SECRET' }]));

test('the sheet is blind, deterministic from the run id, and samples only cases that ran', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-judged-cal-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const a = calibrate.writeSheet(dir, results, casesById, 3, 'run-1');
  const textA = fs.readFileSync(a.file, 'utf8');
  assert.equal(path.basename(a.file), 'calibration-sheet.csv');
  const again = calibrate.writeSheet(dir, results, casesById, 3, 'run-1');
  assert.equal(fs.readFileSync(again.file, 'utf8'), textA, 'same run id, same sample');
  const rows = calibrate.parseCsv(textA);
  assert.deepEqual([...rows[0]], calibrate.HEADER);
  assert.equal(rows.length, 4);
  assert.ok(rows.slice(1).every((r) => r.slice(3).every((cell) => cell === '')), 'score columns are empty');
  assert.ok(!textA.includes('EXPECTED-SECRET') && !textA.includes('NOTES-SECRET'), 'no expected field');
  assert.ok(!rows.slice(1).some((r) => r[0] === 'DEV05'), 'a timed-out case has no answer to score');
  const all = calibrate.writeSheet(dir, results, casesById, 10, 'run-1');
  assert.equal(all.count, 4);
  const dev02 = calibrate.parseCsv(fs.readFileSync(all.file, 'utf8')).find((r) => r[0] === 'DEV02');
  assert.match(dev02[1], /ticket of DEV02\n\n\[PASTED EVIDENCE\]\npasted lines\n\n\[FOLLOW-UP\]\nstill broken/);
  assert.match(dev02[2], /\[TURN 1\]\nanswer of DEV02, with "quotes"\n\n\[TURN 2\]\nturn two/);
  const ids = (runId) => calibrate.sampleCases(results, 2, runId).map((r) => r.id).join();
  assert.equal(ids('run-1'), ids('run-1'));
});

test('readSheet takes 0, 1, 2, blank and NA, and refuses anything else with line and column', () => {
  const header = calibrate.HEADER.join(',');
  const row = (id, risk) => [id, 'ticket', '"multi\nline answer"', ...calibrate.SCORE_COLUMNS.map((k) => (k === 'risk' ? risk : k === 'privacy' ? 'NA' : ''))].join(',');
  const sheet = calibrate.readSheet(`${header}\r\n${row('DEV01', '2')}\r\n${row('DEV02', '0')}\r\n`);
  assert.deepEqual([sheet.get('DEV01').risk, sheet.get('DEV02').risk, sheet.get('DEV01').privacy, sheet.get('DEV01').classification], [2, 0, null, null]);
  assert.throws(() => calibrate.readSheet(`${header}\n${row('DEV01', '3')}\n`), /line 2: column risk is not 0, 1, 2, blank or NA/);
  assert.throws(() => calibrate.readSheet(`${header}\n${row('DEV01', '1')}\n${row('DEV02', 'x')}\n`), /line 4: column risk/, 'the line counts the quoted newline');
  assert.throws(() => calibrate.readSheet(`${header}\n${row('DEV01', '1')}\n${row('DEV01', '1')}\n`), /appears twice/);
  assert.throws(() => calibrate.readSheet('ticket,answer\n'), /no case_id column/);
});

test('agreement per row and overall, with counts, against the run\'s judge rows', () => {
  const sheet = new Map([
    ['DEV01', { classification: 2, risk: 0, correctness: 1, privacy: null }],
    ['DEV02', { classification: 1, risk: 1, correctness: 1, privacy: 2 }],
    ['DEV03', { classification: 2, risk: 2, correctness: null, privacy: 2 }],
    ['NOPE', { classification: 2 }],
  ]);
  const a = calibrate.agreement(sheet, { cases: results });
  // judge: classification 2,2,2; risk 0,1,2; correctness 1,1,1; privacy 2,2,2
  assert.deepEqual([a.rows.classification.agree, a.rows.classification.pairs], [2, 3]);
  assert.deepEqual([a.rows.risk.agree, a.rows.risk.pairs], [3, 3]);
  assert.equal(a.rows.risk.kappa, 1);
  assert.deepEqual([a.rows.correctness.agree, a.rows.correctness.pairs, a.rows.correctness.kappa], [2, 2, null]);
  assert.deepEqual([a.rows.privacy.agree, a.rows.privacy.pairs], [2, 2]);
  assert.deepEqual([a.rows.continuity.pairs, a.rows.continuity.exact], [0, null]);
  assert.deepEqual([a.overall.agree, a.overall.pairs], [9, 10]);
  assert.equal(a.unmatched_cases, 1);
});
