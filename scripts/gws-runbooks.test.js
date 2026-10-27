'use strict';
// gws-runbooks.test.js: lane G2 checks on the five Google Workspace runbooks
// (.claude/commands/gws-account-containment.md, gws-2sv-enforcement.md, gws-admin-roles.md,
// gws-drive-sharing.md, gws-security-posture.md) that the shared gate grammar in
// scripts/command-safety-gates.test.js does not make: how each gate classes its risk,
// which phrase belongs to which effect, and whether each read-back can actually fail.
//
// Contract: PRODUCT_CONTRACT.md (AEGIS ADVISES; HUMANS EXECUTE PRODUCTION CHANGES), the
// R0-R3 table in CLAUDE.md, docs/security/COMMAND_RISK_METADATA.md ("use a distinct
// confirmation for each target and effect") and the Google Workspace section of
// docs/aegis/lanes/g2.md. Nothing here reads the network: every adapter line is run as
// the adapter's own dry run.

require('./adapters/socket-tripwire.js');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const gws = require('./adapters/gws-client.js');

const ROOT = path.resolve(__dirname, '..');
const RUNBOOKS = Object.freeze([
  'gws-account-containment', 'gws-2sv-enforcement', 'gws-admin-roles', 'gws-drive-sharing', 'gws-security-posture',
]);
const fileOf = (name) => path.join(ROOT, '.claude', 'commands', `${name}.md`);
const textOf = (name) => fs.readFileSync(fileOf(name), 'utf8');
const linesOf = (name) => textOf(name).split('\n');

// ── Gates ────────────────────────────────────────────────────────────────────
// A portal gate: `<!-- SAFETY GATE [id] -->`, its six `- **Field:**` lines and its
// `**PORTAL ACTION [id]:**` block, which runs to the next heading or gate marker. A shell
// gate: `# SAFETY GATE [id]` in a fence, its `# Field:` comment lines and the rest of the
// fence.
const FIELD_NAMES = ['Target', 'Effect', 'Scope', 'Reversibility', 'Required confirmation', 'Failure behavior'];

function gatesOf(name) {
  const lines = linesOf(name);
  const gates = [];
  for (let i = 0; i < lines.length; i += 1) {
    const portal = lines[i].match(/^<!-- SAFETY GATE \[([a-z0-9-]+)\] -->$/);
    const shell = lines[i].match(/^# SAFETY GATE \[([a-z0-9-]+)\]$/);
    if (!portal && !shell) continue;
    const gate = { file: name, id: (portal || shell)[1], kind: portal ? 'portal' : 'shell', line: i + 1, fields: {} };
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      const field = portal
        ? lines[j].match(/^- \*\*([A-Za-z ]+):\*\*\s*(.*)$/)
        : lines[j].match(/^# ([A-Za-z ]+):\s*(.*)$/);
      if (!field || !FIELD_NAMES.includes(field[1])) break;
      gate.fields[field[1]] = field[2];
    }
    const block = [];
    for (; j < lines.length; j += 1) {
      if (portal && (/^#{1,6}\s/.test(lines[j]) || /^<!-- SAFETY GATE/.test(lines[j]))) break;
      if (shell && /^```\s*$/.test(lines[j])) break;
      block.push(lines[j]);
    }
    gate.block = block.join('\n');
    const confirmation = gate.fields['Required confirmation'] || '';
    gate.phrase = (portal ? confirmation.match(/type exactly `([^`]+)`/i) : confirmation.match(/type exactly "([^"]+)"/i))?.[1];
    gate.rClass = (gate.fields.Reversibility || '').match(/^(R[0-3])\b/)?.[1];
    gates.push(gate);
  }
  return gates;
}

const allGates = () => RUNBOOKS.flatMap(gatesOf);
const gateById = (id) => {
  const found = allGates().filter((g) => g.id === id);
  assert.equal(found.length, 1, `gate ${id}: expected exactly one, found ${found.length}`);
  return found[0];
};

test('the parser reads every gate in the five runbooks with all six fields, a phrase and an R-class', () => {
  const gates = allGates();
  assert.ok(gates.length >= 20, `only ${gates.length} gates parsed`);
  for (const g of gates) {
    for (const field of FIELD_NAMES) assert.ok(g.fields[field], `${g.file}:${g.line} ${g.id}: no ${field}`);
    assert.ok(g.phrase, `${g.file}:${g.line} ${g.id}: no exact phrase`);
    assert.ok(g.rClass, `${g.file}:${g.line} ${g.id}: Reversibility does not start with R0 to R3`);
  }
});

// ── Adapter lines ────────────────────────────────────────────────────────────
// Every `node scripts/adapters/gws-client.js` line in a bash fence, with its
// placeholders filled by sample values, must be accepted by the adapter's dry run
// (exit 0): a read-back the runbook names has to exist, with the flags it is given.
const SAMPLES = [
  ['[USER@DOMAIN.COM]', 'user@example.com'],
  ['[UPN]', 'admin@example.com'],
  ['[GROUP_EMAIL]', 'exceptions@example.com'],
  ['[EXTERNAL_DOMAIN]', 'partner.example'],
  ['[NOT_BEFORE]', '2026-10-27T11:50:00.000Z'],
  ['[ROLE_ID]', '91000000000001'],
  ['[OU_PATH]', 'Staff'],
  ['[FILE_NAME]', 'Budget sheet'],
  ['[APP_ID]', '1234567890-sample.apps.googleusercontent.com'],
  ['YYYY-MM-DD', '2026-10-25'],
];

function adapterLines(name) {
  const lines = linesOf(name);
  const found = [];
  let fence = null;
  lines.forEach((line, index) => {
    const open = line.match(/^```(\w*)\s*$/);
    if (open && fence === null) { fence = open[1] || 'untagged'; return; }
    if (/^```\s*$/.test(line) && fence !== null) { fence = null; return; }
    if (fence === 'bash' && /^node scripts\/adapters\/gws-client\.js\s/.test(line)) found.push({ file: name, line: index + 1, text: line });
  });
  return found;
}

function argvOf(text) {
  let filled = text;
  for (const [token, value] of SAMPLES) filled = filled.split(token).join(value);
  const words = [...filled.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => (m[1] !== undefined ? m[1] : m[2]));
  assert.equal(words[0], 'node');
  assert.equal(words[1], 'scripts/adapters/gws-client.js');
  return words.slice(2).filter((w) => w !== '--execute');
}

async function dryRun(argv) {
  const out = [];
  const err = [];
  const code = await gws.run(argv, {}, { out: (s) => out.push(String(s)), err: (s) => err.push(String(s)) });
  return { code, stdout: out.join(''), stderr: err.join('') };
}

test('every gws-client.js line in the five runbooks is a command and flag set the adapter accepts (dry run, exit 0)', async () => {
  const lines = RUNBOOKS.flatMap(adapterLines);
  assert.ok(lines.length >= 40, `only ${lines.length} adapter lines found`);
  for (const l of lines) {
    const res = await dryRun(argvOf(l.text));
    assert.equal(res.code, 0, `${l.file}:${l.line}: ${l.text}\n${res.stderr}`);
  }
});

// ── Finding: exit 2 is never a pass ─────────────────────────────────────────
// verify-* exits 2 both when the read proves the opposite state and when the read fails
// (403, 404, timeout, invalid response) or returns another user, so no runbook may treat
// exit 2 as the expected result. "Not enforced" has its own read-back.
test('no runbook treats exit 2 from a verify-* read as an expected result', () => {
  for (const name of RUNBOOKS) {
    const lines = linesOf(name);
    lines.forEach((line, index) => {
      if (!/\bexits?\s+2\b/i.test(line)) return;
      // a line about a verify-* read: it names one, or it is the comment above one
      const aboutVerify = /verify-/.test(line) || /gws-client\.js verify-/.test(lines[index + 1] || '');
      if (!aboutVerify) return;
      assert.match(line, /never a pass/i, `${name}.md:${index + 1}: exit 2 is presented as a result: ${line.trim()}`);
    });
  }
  const twoSv = textOf('gws-2sv-enforcement');
  assert.match(twoSv, /verify-2sv-not-enforced --user \[USER@DOMAIN\.COM\]/, 'the 2SV runbook proves "not enforced" with its own read-back');
});
