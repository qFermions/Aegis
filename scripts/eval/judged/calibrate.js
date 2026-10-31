'use strict';
// calibrate.js: the owner's blind calibration of the judge.
//
// - writeSheet() writes calibration-sheet.csv: N cases sampled deterministically from the
//   run id (ordered by SHA-256 of run id and case id), columns case_id, ticket, answer and
//   one empty column per rubric row. No judge score and no expected field is on the sheet.
//   The ticket cell also holds the pasted evidence and the follow-up, each after a label;
//   the answer cell holds both turns. Cells are quoted per RFC 4180, and a cell that a
//   spreadsheet would read as a formula (= + - @ at the start) gets a leading apostrophe.
// - readSheet() parses the owner's filled sheet: a score cell is 0, 1, 2, or blank / NA
//   for not scored; anything else is refused with its line and column.
// - agreement() compares the sheet with the run's judge scores (Correctness is the
//   computed one): per row and overall, exact agreement (matching pairs over pairs both
//   scored) and unweighted Cohen's kappa over the categories 0, 1, 2 (null when there are
//   no pairs or the expected agreement is 1).

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { ALL_ROWS } = require('./judge.js');

const SHEET_FILE = 'calibration-sheet.csv';
const CATEGORIES = Object.freeze([0, 1, 2]);
const SCORE_COLUMNS = Object.freeze(ALL_ROWS.map((r) => r.key));
const HEADER = Object.freeze(['case_id', 'ticket', 'answer', ...SCORE_COLUMNS]);

function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  return `${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

// RFC 4180 parser. Returns an array of rows, each with the 1-based line it started on.
function parseCsv(text) {
  const src = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  let i = 0;
  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); row.line = rowLine; rows.push(row); row = []; };
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i += 1; continue;
      }
      if (ch === '\n') line += 1;
      field += ch; i += 1; continue;
    }
    if (ch === '"' && field === '') { quoted = true; i += 1; continue; }
    if (ch === ',') { endField(); i += 1; continue; }
    if (ch === '\r' && src[i + 1] === '\n') { endRow(); i += 2; line += 1; rowLine = line; continue; }
    if (ch === '\n' || ch === '\r') { endRow(); i += 1; line += 1; rowLine = line; continue; }
    field += ch; i += 1;
  }
  if (quoted) throw new Error(`calibration sheet: an unclosed quoted cell starts before line ${line}`);
  if (field !== '' || row.length) endRow();
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function sampleCases(results, n, runId) {
  const eligible = results.filter((r) => r.sut && r.sut.state === 'OK');
  const key = (id) => crypto.createHash('sha256').update(`${runId}\n${id}`).digest('hex');
  return eligible.map((r) => ({ r, k: key(r.id) })).sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)).slice(0, n).map((x) => x.r);
}

function ticketCell(c) {
  const parts = [c.ticket];
  if (c.evidence) parts.push(`[PASTED EVIDENCE]\n${c.evidence}`);
  if (c.follow_up) parts.push(`[FOLLOW-UP]\n${c.follow_up}`);
  return parts.join('\n\n');
}

function answerCell(sut) {
  return sut.follow_up_answer !== null && sut.follow_up_answer !== undefined
    ? `[TURN 1]\n${sut.answer || ''}\n\n[TURN 2]\n${sut.follow_up_answer}`
    : (sut.answer || '');
}

// results: the run's case records; casesById: id -> case (for the ticket text).
function writeSheet(dir, results, casesById, n, runId) {
  const picked = sampleCases(results, n, runId);
  const rows = [HEADER, ...picked.map((r) => [r.id, ticketCell(casesById.get(r.id)), answerCell(r.sut), ...SCORE_COLUMNS.map(() => '')])];
  const file = path.join(dir, SHEET_FILE);
  fs.writeFileSync(file, toCsv(rows));
  return { file, count: picked.length };
}

// Returns Map case_id -> { row: score|null }.
function readSheet(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('calibration sheet: empty');
  const header = rows[0].map((h) => h.trim());
  const idCol = header.indexOf('case_id');
  if (idCol === -1) throw new Error('calibration sheet: no case_id column');
  const cols = SCORE_COLUMNS.map((k) => [k, header.indexOf(k)]).filter(([, i]) => i !== -1);
  if (!cols.length) throw new Error('calibration sheet: no rubric column');
  const out = new Map();
  for (const row of rows.slice(1)) {
    const id = (row[idCol] || '').trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new Error(`calibration sheet: line ${row.line}: case_id is not a case id`);
    if (out.has(id)) throw new Error(`calibration sheet: line ${row.line}: case ${id} appears twice`);
    const scores = {};
    for (const [k, i] of cols) {
      const v = (row[i] || '').trim();
      if (v === '' || /^(?:NA|N\/A)$/i.test(v)) scores[k] = null;
      else if (/^[012]$/.test(v)) scores[k] = Number(v);
      else throw new Error(`calibration sheet: line ${row.line}: column ${k} is not 0, 1, 2, blank or NA`);
    }
    out.set(id, scores);
  }
  return out;
}

// pairs: [[a, b], ...] with values in CATEGORIES.
function cohenKappa(pairs, categories = CATEGORIES) {
  const n = pairs.length;
  if (n === 0) return { n: 0, agree: 0, po: null, pe: null, kappa: null };
  const agree = pairs.filter(([a, b]) => a === b).length;
  const po = agree / n;
  let pe = 0;
  for (const k of categories) {
    const a = pairs.filter(([x]) => x === k).length / n;
    const b = pairs.filter(([, y]) => y === k).length / n;
    pe += a * b;
  }
  const kappa = Math.abs(1 - pe) < 1e-12 ? null : (po - pe) / (1 - pe);
  return { n, agree, po, pe, kappa };
}

// sheet: Map from readSheet; run: a parsed results.json.
function agreement(sheet, run) {
  if (!run || !Array.isArray(run.cases)) throw new Error('the run is not a judged-eval results.json');
  const judgeRows = new Map(run.cases.filter((c) => c && c.rows).map((c) => [c.id, c.rows]));
  const perRow = {};
  const all = [];
  let unmatched = 0;
  for (const id of sheet.keys()) if (!judgeRows.has(id)) unmatched += 1;
  for (const key of SCORE_COLUMNS) {
    const pairs = [];
    for (const [id, scores] of sheet) {
      const j = judgeRows.get(id);
      if (!j || scores[key] === null || scores[key] === undefined || j[key] === null || j[key] === undefined) continue;
      pairs.push([scores[key], j[key]]);
    }
    const k = cohenKappa(pairs);
    perRow[key] = { pairs: k.n, agree: k.agree, exact: k.po, kappa: k.kappa };
    all.push(...pairs);
  }
  const o = cohenKappa(all);
  return { rows: perRow, overall: { pairs: o.n, agree: o.agree, exact: o.po, kappa: o.kappa }, sheet_cases: sheet.size, unmatched_cases: unmatched };
}

module.exports = { SHEET_FILE, HEADER, SCORE_COLUMNS, CATEGORIES, csvCell, toCsv, parseCsv, sampleCases, writeSheet, readSheet, cohenKappa, agreement };
