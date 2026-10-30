'use strict';
// cli-support.js: what every connector CLI shares beyond the contract (batch G3).
//
// cliDeps: the dependencies a CLI hands to createClient. A person running a CLI gets the
// audit sink (scripts/audit/audit-log.js), so every connector call and verify-* verdict is
// recorded. A test that injects a transport gets no sink unless it passes one, so the test
// suite never writes the operator's real audit trail.
//
// recordVerdict: records a verify-* verdict as one verify entry. A sink that fails turns
// the verdict into AUDIT_FAILED: a read-back that is not on record is not reported.
//
// takeChange and changeRefusal (batch G3 close-out, owner decision 1): every verify-* command
// takes --change chg-... . takeChange removes the flag from argv before the connector's own
// parser runs, so each connector keeps its flag rules; changeRefusal then checks, before any
// read, dry or live, that the trail the verdict will be written to holds that change, opened
// for this connector and command and approved (change-record.js bindRefusal). The verdict is
// recorded under the change id; a run without --change records change null, which
// change-record.js link refuses.

const { auditSink, defaultAuditDir } = require('../audit/audit-log.js');
const { bindRefusal } = require('../audit/change-record.js');

const CHANGE_ID = /^chg-[0-9a-f]{12}$/;
const VERIFY_COMMAND = /^verify-[a-z0-9-]{1,48}$/;

const AUDITED_STATES = new Set(['OK', 'REFUSED', 'NO_CREDENTIALS', 'HTTP_ERROR', 'TIMEOUT', 'NETWORK_ERROR', 'TENANT_MISMATCH',
  'INVALID_RESPONSE', 'SCOPE_REFUSED', 'AUDIT_FAILED']);

function cliDeps(deps = {}, env = process.env) {
  const injected = typeof deps.transport === 'function';
  let audit = null;
  if (deps.audit !== undefined) audit = typeof deps.audit === 'function' ? deps.audit : null;
  else if (!injected) audit = auditSink({ AEGIS_AUDIT_DIR: defaultAuditDir(env && env.AEGIS_AUDIT_DIR ? env : process.env) });
  return {
    transport: deps.transport,
    sleep: deps.sleep,
    now: deps.now,
    random: deps.random,
    timeoutMs: deps.timeoutMs,
    maxRetries: deps.maxRetries,
    retryBudgetMs: deps.retryBudgetMs,
    audit,
    // the scope preflight: on for a person running a CLI, off for a test transport unless asked
    scopePreflight: deps.scopePreflight !== undefined ? deps.scopePreflight === true : !injected,
  };
}

// argv without its --change pair, and the change id (undefined when the flag is absent), or
// error when the flag is repeated or has no value.
function takeChange(argv) {
  const list = Array.isArray(argv) ? argv.map(String) : [];
  const rest = [];
  const values = [];
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] !== '--change') { rest.push(list[i]); continue; }
    const value = i + 1 < list.length && !list[i + 1].startsWith('--') ? list[i + 1] : null;
    values.push(value);
    if (value !== null) i += 1;
  }
  if (values.length > 1) return { argv: rest, error: '--change may appear once' };
  if (values.length === 1 && values[0] === null) return { argv: rest, error: '--change needs the change id that node scripts/audit/change-record.js open printed' };
  return { argv: rest, change: values.length ? values[0] : undefined };
}

// Why this run may not go on under --change, or null when it may (no --change, or a change
// opened for connector:command and approved, in the trail the verdict will be written to).
function changeRefusal(connector, command, change, audit) {
  if (change === undefined) return null;
  if (typeof command !== 'string' || !VERIFY_COMMAND.test(command)) return '--change binds a verify-* read-back to its change record; this command is not a read-back';
  if (typeof change !== 'string' || !CHANGE_ID.test(change)) return '--change must be the change id that node scripts/audit/change-record.js open printed (chg- and 12 lower-case hex characters)';
  const log = audit && audit.log;
  if (!log || typeof log.entries !== 'function' || typeof log.verify !== 'function') return '--change needs the audit trail the read-back is recorded in, and none is open for this run';
  try {
    return bindRefusal(log, change, `${connector}:${command}`);
  } catch {
    return 'the audit trail could not be read, so the change could not be checked';
  }
}

function recordVerdict(audit, connector, output, change) {
  if (!audit || !output || typeof output.verified !== 'boolean' || typeof output.command !== 'string' || !VERIFY_COMMAND.test(output.command)) return output;
  try {
    audit({ kind: 'verify', connector, command: output.command, verified: output.verified, state: AUDITED_STATES.has(output.state) ? output.state : 'INVALID_RESPONSE', change: typeof change === 'string' ? change : null });
    return output;
  } catch {
    return { command: output.command, state: 'AUDIT_FAILED', ok: false, verified: false, error: 'the audit trail could not record this read-back, so its verdict is withheld' };
  }
}

module.exports = { cliDeps, recordVerdict, takeChange, changeRefusal };
