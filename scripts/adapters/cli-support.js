'use strict';
// cli-support.js: what every connector CLI shares beyond the contract (batch G3).
//
// cliDeps: the dependencies a CLI hands to createClient. A person running a CLI gets the
// audit sink (scripts/audit/audit-log.js), so every connector call and verify-* verdict is
// recorded. A test that injects a transport gets no sink unless it passes one, so the test
// suite never writes the operator's real audit trail.
//
// recordVerdict: records a verify-* verdict as one verify entry. A sink that fails turns
// the verdict into AUDIT_FAILED: a read-back that is not on record is not reported. A verdict
// link can accept (run with --change, verified) shows its entry's seq as audit_seq, the number
// change-record.js link takes; any other shows none, since link would refuse it.
//
// takeChange and changeRefusal (batch G3 close-out, owner decision 1): every verify-* command
// takes --change chg-... . takeChange removes the flag from argv before the connector's own
// parser runs, so each connector keeps its flag rules; changeRefusal then checks, before any
// read, dry or live, that the trail the verdict will be written to holds that change, opened
// for this connector and command and approved (change-record.js bindRefusal). The verdict is
// recorded under the change id; a run without --change records change null, which
// change-record.js link refuses.

// CHANGE_ID and VERIFY_COMMAND are the trail's own forms, so a run is checked with exactly the
// rule its verify entry is written under (readonly-contract.js isVerifyCommand matches it too).
const { auditSink, defaultAuditDir, CHANGE_ID, VERIFY_COMMAND, RUN_ID, RUN_IDS, recordsRunId, passFlags, readBackFor } = require('../audit/audit-log.js');
const { bindRefusal } = require('../audit/change-record.js');

const AUDITED_STATES = new Set(['OK', 'REFUSED', 'NO_CREDENTIALS', 'HTTP_ERROR', 'TIMEOUT', 'NETWORK_ERROR', 'TENANT_MISMATCH',
  'INVALID_RESPONSE', 'SCOPE_REFUSED', 'AUDIT_FAILED', 'INCONCLUSIVE']);

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
// error when the flag is repeated, has no value, or is written --change=chg-... (code review
// round 1, finding 6).
function takeChange(argv) {
  const list = Array.isArray(argv) ? argv.map(String) : [];
  const rest = [];
  const values = [];
  let joined = false;
  for (let i = 0; i < list.length; i += 1) {
    // --change=chg-... is taken out too, so the refusal names the flag's real form
    if (list[i].startsWith('--change=')) { joined = true; continue; }
    if (list[i] !== '--change') { rest.push(list[i]); continue; }
    const value = i + 1 < list.length && !list[i + 1].startsWith('--') ? list[i + 1] : null;
    values.push(value);
    if (value !== null) i += 1;
  }
  if (joined) return { argv: rest, error: '--change takes the change id as the next argument: --change chg-... (not --change=chg-...)' };
  if (values.length > 1) return { argv: rest, error: '--change may appear once' };
  if (values.length === 1 && values[0] === null) return { argv: rest, error: '--change needs the change id that node scripts/audit/change-record.js open printed' };
  return { argv: rest, change: values.length ? values[0] : undefined };
}

// The refusal of --change on a command that is not a read-back (an offline command among them).
const NOT_A_READ_BACK = '--change binds a verify-* read-back to its change record; this command is not a read-back';

// Why this run may not go on under --change, or null when it may (no --change, or a change
// opened for connector:command and approved, in the trail the verdict will be written to).
// bound is takeChange's result; the checks run in one order for every CLI: not a read-back
// first, then a malformed flag, then the id's form, then the trail (code review round 2,
// finding 7).
function changeRefusal(connector, command, bound, audit) {
  // fail closed on a wrong call (a change id string, nothing): never read it as "no --change"
  if (!bound || typeof bound !== 'object' || Array.isArray(bound)) return 'the --change check was not given takeChange\'s result, so the read-back is refused';
  const { change, error } = bound;
  if (change === undefined && !error) return null;
  if (typeof command !== 'string' || !VERIFY_COMMAND.test(command)) return NOT_A_READ_BACK;
  if (error) return error;
  if (typeof change !== 'string' || !CHANGE_ID.test(change)) return '--change must be the change id that node scripts/audit/change-record.js open printed (chg- and 12 lower-case hex characters)';
  const log = audit && audit.log;
  if (!log || typeof log.entries !== 'function' || typeof log.verify !== 'function') return '--change needs the audit trail the read-back is recorded in, and none is open for this run';
  try {
    // the read-back with the flags it would run with that change what its pass means, so a read
    // in another form is refused before any read (batch G3 close-out 3, owner decision H1)
    return bindRefusal(log, change, readBackFor(`${connector}:${command}`, bound.argv));
  } catch {
    return 'the audit trail could not be read, so the change could not be checked';
  }
}

// The state a verify entry records: one the trail accepts, else INVALID_RESPONSE. The Jira
// client uses it too, so every connector maps a state the same way (code review round 3,
// finding 6).
const verdictState = (state) => (AUDITED_STATES.has(state) ? state : 'INVALID_RESPONSE');

// Read-backs that take a job id (batch G3 close-out 2, owner decision 2), the trail's own table
// and form (audit-log.js RUN_IDS, RUN_ID): connector:command to the flag that holds it. The id
// is recorded as the verify entry's run, so a counted batch change (change-record.js) counts
// each run once. Only a job id belongs here, never a user, email, device name or serial: the run
// is recorded only when it has the trail's form (a UUID, Fleet's documented execution id form)
// and the vendor's answer named that same id (observedId), else null.
// RUN_ID_FLAGS is the name the adapters' agreement test reads; it is the trail's table itself.
const RUN_ID_FLAGS = RUN_IDS;
const runIdOf = (connector, command, args, observedId) => {
  const key = `${connector}:${command}`;
  const flag = recordsRunId(key) ? RUN_IDS[key] : null;
  const id = flag && args ? args[flag] : null;
  // a UUID is one id in either case, so the match ignores case and the run is recorded in lower
  // case, so one execution typed two ways counts once (code review round 3, finding 2)
  return typeof id === 'string' && RUN_ID.test(id) && typeof observedId === 'string' && observedId.toLowerCase() === id.toLowerCase() ? id.toLowerCase() : null;
};

// argv: the run's arguments without --change (takeChange's argv), from which the flags that
// change what the pass means are recorded (batch G3 close-out 3, owner decision H1). Without it a
// read-back that has such flags records none, which the trail refuses, so its verdict is withheld.
function recordVerdict(audit, connector, output, change, run = null, argv = null) {
  if (!audit || !output || typeof output.verified !== 'boolean' || typeof output.command !== 'string' || !VERIFY_COMMAND.test(output.command)) return output;
  try {
    const written = audit({ kind: 'verify', connector, command: output.command, verified: output.verified, state: verdictState(output.state), change: typeof change === 'string' ? change : null, run: typeof run === 'string' ? run : null, flags: Array.isArray(argv) ? passFlags(`${connector}:${output.command}`, argv) : null });
    const linkable = typeof change === 'string' && output.verified === true && written && Number.isInteger(written.seq);
    return linkable ? { ...output, audit_seq: written.seq } : output;
  } catch {
    return { command: output.command, state: 'AUDIT_FAILED', ok: false, verified: false, error: 'the audit trail could not record this read-back, so its verdict is withheld' };
  }
}

module.exports = { cliDeps, recordVerdict, takeChange, changeRefusal, verdictState, runIdOf, RUN_ID_FLAGS, NOT_A_READ_BACK };
