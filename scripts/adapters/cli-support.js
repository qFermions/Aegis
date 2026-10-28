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

const { auditSink, defaultAuditDir } = require('../audit/audit-log.js');

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

function recordVerdict(audit, connector, output) {
  if (!audit || !output || typeof output.verified !== 'boolean' || typeof output.command !== 'string' || !/^verify-[a-z0-9-]{1,48}$/.test(output.command)) return output;
  try {
    audit({ kind: 'verify', connector, command: output.command, verified: output.verified, state: AUDITED_STATES.has(output.state) ? output.state : 'INVALID_RESPONSE', change: null });
    return output;
  } catch {
    return { command: output.command, state: 'AUDIT_FAILED', ok: false, verified: false, error: 'the audit trail could not record this read-back, so its verdict is withheld' };
  }
}

module.exports = { cliDeps, recordVerdict };
