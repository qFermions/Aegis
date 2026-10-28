#!/usr/bin/env node
'use strict';
// change-record.js: change records for R2 and R3 procedures (batch G3, task 3c).
// README.md beside this file.
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). A change record joins, in the audit
// trail, three things about one R2 or R3 procedure: the procedure Aegis issued (its
// SHA-256), the approval reference the operator supplied (an issue key) for exactly that
// digest, and a verify-* read-back that proved the person's change after the approval. A
// change is reported done only when all three match, in that order, on an intact chain.
// The approval authorizes a person's procedure; it never triggers a write by Aegis: this
// module writes the local audit trail and nothing else.
//
//   node scripts/audit/change-record.js open --command C --gate G --r-class R2|R3 --target [UPN] --read-back CONNECTOR:verify-... --procedure-file FILE
//   node scripts/audit/change-record.js approve --change chg-... --ref IT-123 --procedure-sha256 H
//   node scripts/audit/change-record.js link --change chg-... --verify-seq N
//   node scripts/audit/change-record.js status --change chg-...
// Exit codes: 0 done (status) or recorded; 1 input error or refused; 2 not done, a digest
// that does not match, or a broken trail.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const audit = require('./audit-log.js');

const MAX_PROCEDURE_BYTES = 1024 * 1024;
// The read-back that proves the change, named at open: a connector and its verify-* command
// (okta:verify-factor-reset). The audit entries hold no target value, only placeholders, so
// the kind of read-back is what binds it; which object it read is the operator's link. The
// form is the trail's own (audit-log.js READ_BACK).
const { READ_BACK } = audit;
const kindOf = (e) => `${e.connector}:${e.command}`;

// The read-back must be a verify-* command its connector really has. A connector is named
// as its verify entries name it (cli-support.js recordVerdict, jira-client.js), and its file
// names the command as a key. Read as text, never loaded, so this module opens no network
// module.
const ROOT = path.resolve(__dirname, '..', '..');
const CONNECTOR_FILES = Object.freeze({
  fleet: 'scripts/adapters/fleet-client.js', github: 'scripts/adapters/github-client.js',
  'google-workspace': 'scripts/adapters/gws-client.js', jamf: 'scripts/adapters/jamf-client.js',
  linear: 'scripts/adapters/linear-client.js', msgraph: 'scripts/adapters/msgraph-client.js',
  okta: 'scripts/adapters/okta-client.js', slack: 'scripts/adapters/slack-client.js', jira: 'scripts/jira-client.js',
});
function checkReadBack(readBack) {
  if (!READ_BACK.test(readBack)) throw new InputError('--read-back names the connector and its verify-* command, such as okta:verify-factor-reset');
  const [connector, command] = readBack.split(':');
  if (!Object.prototype.hasOwnProperty.call(CONNECTOR_FILES, connector)) throw new InputError(`--read-back: no connector named ${connector} (one of ${Object.keys(CONNECTOR_FILES).join(', ')})`);
  const source = fs.readFileSync(path.join(ROOT, CONNECTOR_FILES[connector]), 'utf8');
  if (!source.includes(`'${command}':`)) throw new InputError(`--read-back: no such read-back, ${connector} has no ${command} command`);
}

class InputError extends Error {}
class NotDone extends Error {}

// The digest of an issued procedure: CR LF to LF, trailing spaces and tabs removed from
// each line, trailing newlines removed, so a copy saved by another editor still matches.
function procedureDigest(text) {
  const normal = String(text).replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n').replace(/\n+$/, '');
  return crypto.createHash('sha256').update(normal, 'utf8').digest('hex');
}

function readProcedure(file) {
  if (typeof file !== 'string' || !file) throw new InputError('--procedure-file needs the saved procedure text');
  const base = path.basename(file).toLowerCase();
  if (base === '.env' || base.startsWith('.env.') || base.endsWith('.env')) throw new InputError('a .env file is never opened');
  let stat;
  try { stat = fs.statSync(file); } catch { throw new InputError('--procedure-file could not be read'); }
  if (!stat.isFile()) throw new InputError('--procedure-file is not a regular file');
  if (stat.size > MAX_PROCEDURE_BYTES) throw new InputError('--procedure-file is larger than 1 MB');
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) throw new InputError('--procedure-file is empty');
  return text;
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!/^--[a-z][a-z0-9-]*$/.test(token)) throw new InputError(`unexpected argument ${JSON.stringify(token).slice(0, 40)}`);
    const name = token.slice(2);
    if (name in flags) throw new InputError(`--${name} may appear once`);
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new InputError(`--${name} needs a value`);
    flags[name] = argv[i + 1];
    i += 1;
  }
  return flags;
}

function need(flags, names) {
  for (const key of Object.keys(flags)) if (!names.includes(key)) throw new InputError(`unknown flag --${key.slice(0, 40)}`);
  for (const name of names) if (flags[name] === undefined) throw new InputError(`--${name} is required`);
}

// Everything the trail says about one change, read from an intact chain only.
function changeView(log, change) {
  const check = log.verify();
  const view = { change, done: false, chain: check.ok ? 'intact' : 'broken', procedure: null, approval: null, readBack: null, missing: [] };
  if (!check.ok) {
    view.missing.push(`the audit trail is broken at line ${check.firstBroken.line} (${check.firstBroken.reason}); run node scripts/audit/audit-log.js verify`);
    return view;
  }
  const entries = log.entries();
  const bySeq = new Map(entries.map((e) => [e.seq, e]));
  const procedure = entries.find((e) => e.kind === 'procedure' && e.change === change);
  if (!procedure) {
    view.missing.push('no procedure was issued under this change id');
    return view;
  }
  view.procedure = { seq: procedure.seq, command: procedure.command, gate: procedure.gate, r_class: procedure.r_class, target: procedure.target, read_back: procedure.read_back, procedure_sha256: procedure.procedure_sha256 };
  const approvals = entries.filter((e) => e.kind === 'approval' && e.change === change && e.seq > procedure.seq);
  const approval = approvals.find((e) => e.procedure_sha256 === procedure.procedure_sha256);
  if (approval) view.approval = { seq: approval.seq, ref: approval.ref, matches: true };
  else if (approvals.length) {
    view.approval = { seq: approvals[0].seq, ref: approvals[0].ref, matches: false };
    view.missing.push('the approved digest does not match the procedure Aegis issued, so the approval does not cover it');
  } else view.missing.push('no approval reference was recorded for this change');
  // one verify-* result proves one change: the first link of a read-back owns it
  const owner = new Map();
  for (const e of entries) if (e.kind === 'change-link' && !owner.has(e.verify_seq)) owner.set(e.verify_seq, e.change);
  const links = entries.filter((e) => e.kind === 'change-link' && e.change === change);
  const taken = links.filter((l) => owner.get(l.verify_seq) !== change);
  const linked = links.filter((l) => owner.get(l.verify_seq) === change).map((l) => bySeq.get(l.verify_seq)).filter((e) => e && e.kind === 'verify');
  const readBacks = linked.filter((e) => kindOf(e) === procedure.read_back);
  const proving = readBacks.find((e) => e.verified === true && approval && e.seq > approval.seq);
  if (proving) view.readBack = { seq: proving.seq, connector: proving.connector, command: proving.command, verified: true };
  else if (!readBacks.length && !linked.length && taken.length) view.missing.push(`the linked read-back already proves ${owner.get(taken[0].verify_seq)}; one read-back proves one change`);
  else if (!readBacks.length && linked.length) view.missing.push(`the linked read-back is not the one this change names (${procedure.read_back})`);
  else if (!readBacks.length) view.missing.push(`no ${procedure.read_back} read-back is linked to this change`);
  else if (!readBacks.some((e) => e.verified === true)) view.missing.push('the linked read-back did not verify the change');
  else if (approval) view.missing.push('the linked read-back ran before the approval, so it does not prove the approved change');
  // with no matching approval, the missing approval above is the reason; no read-back reason
  view.done = view.missing.length === 0;
  return view;
}

function main(argv = process.argv.slice(2), env = process.env, io = {}) {
  const out = io.out || ((s) => process.stdout.write(s));
  const err = io.err || ((s) => process.stderr.write(s));
  const [command, ...rest] = argv;
  const log = audit.openAuditLog({ dir: audit.defaultAuditDir(env) });
  try {
    const flags = parseFlags(rest);
    if (command === 'open') {
      need(flags, ['command', 'gate', 'r-class', 'target', 'read-back', 'procedure-file']);
      if (flags['r-class'] !== 'R2' && flags['r-class'] !== 'R3') throw new InputError('a change record is for an R2 or R3 procedure; R0 and R1 need none');
      checkReadBack(flags['read-back']);
      const digest = procedureDigest(readProcedure(flags['procedure-file']));
      const change = `chg-${crypto.createHash('sha256').update(`${flags.gate}\n${digest}\n${Date.now()}\n${crypto.randomBytes(8).toString('hex')}`).digest('hex').slice(0, 12)}`;
      const r = log.append({ kind: 'procedure', command: flags.command, gate: flags.gate, r_class: flags['r-class'], target: flags.target, read_back: flags['read-back'], procedure_sha256: digest, change });
      out(`${JSON.stringify({ ok: true, change, procedure_sha256: digest, audit_seq: r.seq, next: [
        'A person approves this exact procedure in the ticket; record the reference with: approve --change <id> --ref <ISSUE-KEY> --procedure-sha256 <digest>',
        'A person runs the procedure (Aegis does not)',
        `Run the ${flags['read-back']} read-back, then: link --change <id> --verify-seq <its audit seq>; status --change <id> reports done only when all three match`,
      ] }, null, 2)}\n`);
      return 0;
    }
    if (command === 'approve') {
      need(flags, ['change', 'ref', 'procedure-sha256']);
      const view = changeView(log, flags.change);
      if (view.chain !== 'intact') throw new NotDone(view.missing[0]);
      if (!view.procedure) throw new NotDone('no procedure was issued under this change id');
      if (flags['procedure-sha256'] !== view.procedure.procedure_sha256) {
        throw new NotDone('the approved digest does not match the procedure Aegis issued; nothing was recorded. Approve the issued procedure, or open a new change for the new text');
      }
      const r = log.append({ kind: 'approval', ref: flags.ref, gate: view.procedure.gate, procedure_sha256: flags['procedure-sha256'], change: flags.change });
      out(`${JSON.stringify({ ok: true, change: flags.change, ref: flags.ref, audit_seq: r.seq, note: 'The approval authorizes a person\'s procedure. Aegis makes no change: a person runs it, then the verify-* read-back proves it.' }, null, 2)}\n`);
      return 0;
    }
    if (command === 'link') {
      need(flags, ['change', 'verify-seq']);
      if (!/^[1-9][0-9]{0,15}$/.test(flags['verify-seq'])) throw new InputError('--verify-seq is the audit seq of a verify-* result');
      const seq = Number(flags['verify-seq']);
      const view = changeView(log, flags.change);
      if (view.chain !== 'intact') throw new NotDone(view.missing[0]);
      if (!view.procedure) throw new NotDone('no procedure was issued under this change id');
      const target = log.entries().find((e) => e.seq === seq);
      if (!target || target.kind !== 'verify') throw new NotDone('only a verify-* result can be linked; that audit seq is not one');
      const earlier = log.entries().find((e) => e.kind === 'change-link' && e.verify_seq === seq);
      if (earlier && earlier.change !== flags.change) throw new NotDone(`that read-back already proves ${earlier.change}; one read-back proves one change. Nothing was recorded`);
      if (kindOf(target) !== view.procedure.read_back) throw new NotDone(`that read-back is ${kindOf(target)}; this change is proved only by ${view.procedure.read_back}. Nothing was recorded`);
      const r = log.append({ kind: 'change-link', change: flags.change, verify_seq: seq });
      out(`${JSON.stringify({ ok: true, change: flags.change, verify_seq: seq, audit_seq: r.seq }, null, 2)}\n`);
      return 0;
    }
    if (command === 'status') {
      need(flags, ['change']);
      const view = changeView(log, flags.change);
      out(`${JSON.stringify(view, null, 2)}\n`);
      return view.done ? 0 : 2;
    }
    throw new InputError('usage: change-record.js open | approve | link | status (see the header of this file)');
  } catch (error) {
    if (error instanceof InputError || error instanceof audit.AuditRefused) { err(`change-record: ${error.message}\n`); return 1; }
    if (error instanceof NotDone || error instanceof audit.AuditBroken) { err(`change-record: ${error.message}\n`); return 2; }
    err('change-record: the audit trail could not be read or written (details withheld)\n');
    return 2;
  }
}

module.exports = { procedureDigest, changeView, main };

if (require.main === module) process.exitCode = main();
