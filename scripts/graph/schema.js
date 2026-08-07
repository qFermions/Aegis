/**
 * schema.js — Aegis Ticket Graph artifact + state validation
 *
 * Hand-rolled, zero-dependency validators (house convention — see
 * scripts/jira-client.js). Contract: scripts/graph/README.md.
 *
 * Validation is STRICT: unknown top-level keys reject the artifact. This is a
 * security property, not pedantry — it is what makes "an artifact that tries
 * to set humanGate.decision = approved" unrepresentable (threat-model T8).
 */

const LANES = ['identity', 'endpoint', 'exchange', 'collab', 'network', 'voip', 'security', 'automation', 'lifecycle', 'other'];
const R_LEVELS = ['R0', 'R1', 'R2', 'R3'];
const R_ORDER = { R0: 0, R1: 1, R2: 2, R3: 3 };
const NODES = ['ROUTER', 'SPECIALIST', 'BUILDER', 'REVIEWER', 'RISK_FINALIZER', 'HUMAN_GATE', 'EXECUTOR', 'VERIFIER', 'SCRIBE'];
const TERMINAL_STATUSES = ['resolved', 'blocked', 'deadlock', 'rejected', 'aborted'];
const MODES = ['dry-run', 'sim', 'live'];

const ARTIFACT_SCHEMAS = {
  ROUTER: 'router.v1',
  SPECIALIST: 'evidence.v1',
  BUILDER: 'plan.v1',
  REVIEWER: 'review.v1',
  RISK_FINALIZER: 'risk.v1',
  VERIFIER: 'verify.v1',
  SCRIBE: 'scribe.v1',
};

function maxRisk(levels) {
  let max = 'R0';
  for (const l of levels) {
    if (R_ORDER[l] !== undefined && R_ORDER[l] > R_ORDER[max]) max = l;
  }
  return max;
}

// ── low-level checks ─────────────────────────────────────────────────────────

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isString(v) { return typeof v === 'string'; }
function isBool(v) { return typeof v === 'boolean'; }
function isArray(v) { return Array.isArray(v); }

function rejectUnknownKeys(obj, allowed, errors, ctx) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) errors.push(`${ctx}: unknown key "${k}" — artifacts may only carry their own contract fields`);
  }
}

// ── per-artifact validators ──────────────────────────────────────────────────

function validateRouter(a, errors) {
  rejectUnknownKeys(a, ['schema', 'lane', 'reason', 'specialistCommands', 'riskGuess'], errors, 'router.v1');
  if (!LANES.includes(a.lane)) errors.push(`router.v1: lane must be one of ${LANES.join('|')}`);
  if (!isNonEmptyString(a.reason)) errors.push('router.v1: reason required');
  if (!isArray(a.specialistCommands) || a.specialistCommands.some((c) => !isNonEmptyString(c))) errors.push('router.v1: specialistCommands must be an array of command strings (may be empty)');
  if (!R_LEVELS.includes(a.riskGuess)) errors.push('router.v1: riskGuess must be R0-R3');
}

function validateEvidence(a, errors) {
  rejectUnknownKeys(a, ['schema', 'rankedCauses', 'evidence'], errors, 'evidence.v1');
  // Ranked causes where the FIRST check discriminates between hypotheses
  // (repo lesson: diagnose object reality before client symptoms).
  if (!isArray(a.rankedCauses) || a.rankedCauses.length === 0) {
    errors.push('evidence.v1: rankedCauses[] required (>=1)');
  } else {
    a.rankedCauses.forEach((c, i) => {
      const ctx = `evidence.v1 rankedCauses[${i}]`;
      rejectUnknownKeys(c, ['rank', 'cause', 'discriminatedBy'], errors, ctx);
      if (!Number.isInteger(c.rank) || c.rank < 1) errors.push(`${ctx}: rank must be an integer >= 1`);
      if (!isNonEmptyString(c.cause)) errors.push(`${ctx}: cause required`);
      if (!isNonEmptyString(c.discriminatedBy)) errors.push(`${ctx}: discriminatedBy must name the evidence id whose check discriminates this cause`);
    });
  }
  if (!isArray(a.evidence) || a.evidence.length === 0) { errors.push('evidence.v1: evidence[] required (>=1)'); return; }
  a.evidence.forEach((e, i) => {
    const ctx = `evidence.v1 evidence[${i}]`;
    rejectUnknownKeys(e, ['id', 'kind', 'summary', 'command', 'output', 'provenance'], errors, ctx);
    if (!isNonEmptyString(e.id)) errors.push(`${ctx}: id required`);
    if (!['check', 'log', 'config', 'recent-change'].includes(e.kind)) errors.push(`${ctx}: kind must be check|log|config|recent-change`);
    if (!isNonEmptyString(e.summary)) errors.push(`${ctx}: summary required`);
    if (!isString(e.command) || !isString(e.output)) errors.push(`${ctx}: command and output must be strings`);
    if (e.kind === 'check' && !isNonEmptyString(e.command)) errors.push(`${ctx}: kind "check" requires a concrete command/portal path`);
    if (e.provenance !== 'agent_derived') errors.push(`${ctx}: provenance must be "agent_derived" — nodes cannot mint operator_typed input`);
  });
}

function validatePlan(a, errors) {
  rejectUnknownKeys(a, ['schema', 'packageId', 'summary', 'steps', 'powershell', 'builderRisk'], errors, 'plan.v1');
  if (!isNonEmptyString(a.packageId)) errors.push('plan.v1: packageId required');
  if (!isNonEmptyString(a.summary)) errors.push('plan.v1: summary required');
  if (!R_LEVELS.includes(a.builderRisk)) errors.push('plan.v1: builderRisk must be R0-R3');
  if (!isString(a.powershell)) errors.push('plan.v1: powershell must be a string (may be empty)');
  if (!isArray(a.steps) || a.steps.length === 0) { errors.push('plan.v1: steps[] required (>=1)'); return; }
  a.steps.forEach((s, i) => {
    const ctx = `plan.v1 steps[${i}]`;
    rejectUnknownKeys(s, ['id', 'action', 'surface', 'target', 'targetCount', 'radius', 'mutating', 'undo', 'verify', 'checkpoint', 'simulate'], errors, ctx);
    if (!isNonEmptyString(s.id)) errors.push(`${ctx}: id required`);
    if (!isNonEmptyString(s.action)) errors.push(`${ctx}: action required`);
    if (!['portal', 'powershell'].includes(s.surface)) errors.push(`${ctx}: surface must be portal|powershell`);
    if (!isString(s.target)) errors.push(`${ctx}: target must be a string (placeholders only)`);
    if (!Number.isInteger(s.targetCount) || s.targetCount < 0) errors.push(`${ctx}: targetCount must be an integer >= 0`);
    if (!R_LEVELS.includes(s.radius)) errors.push(`${ctx}: radius must be R0-R3`);
    if (!isBool(s.mutating)) errors.push(`${ctx}: mutating must be boolean`);
    // Contract resolution 2026-08-05: null is a legal spelling of "not
    // applicable" on NON-mutating steps only (normalized to ""). On mutating
    // steps null/empty stays a hard error — that's the gate, not idiom.
    if (s.mutating === false) {
      if (s.undo === null) s.undo = '';
      if (s.verify === null) s.verify = '';
    }
    if (!isString(s.undo) || !isString(s.verify)) errors.push(`${ctx}: undo and verify must be strings (null allowed only on non-mutating steps)`);
    // The R1 rule, structurally: a mutation you cannot undo or prove is not submittable.
    if (s.mutating === true && !isNonEmptyString(s.undo)) errors.push(`${ctx}: mutating step requires a non-empty undo (state the undo with the change)`);
    if (s.mutating === true && !isNonEmptyString(s.verify)) errors.push(`${ctx}: mutating step requires a non-empty verify (read-back proving new state)`);
    if (s.checkpoint !== null && s.checkpoint !== undefined && !isNonEmptyString(s.checkpoint)) errors.push(`${ctx}: checkpoint must be null or a file path`);
    if (s.simulate !== undefined && s.simulate !== 'fail') errors.push(`${ctx}: simulate may only be "fail" (sim-mode test hook)`);
  });
}

function validateReview(a, errors) {
  rejectUnknownKeys(a, ['schema', 'packageId', 'verdict', 'findings', 'checklist'], errors, 'review.v1');
  if (!isNonEmptyString(a.packageId)) errors.push('review.v1: packageId required — the verdict must bind to the plan it reviewed');
  if (!['PASS', 'FAIL'].includes(a.verdict)) errors.push('review.v1: verdict must be PASS|FAIL');
  // The attested checklist is what makes "PASS without having attacked the
  // plan is invalid" checkable, not just aspirational.
  if (!isArray(a.checklist) || a.checklist.length === 0) {
    errors.push('review.v1: checklist[] required — every fail-closed check attested each round');
  } else {
    a.checklist.forEach((c, i) => {
      const ctx = `review.v1 checklist[${i}]`;
      rejectUnknownKeys(c, ['rule', 'ok'], errors, ctx);
      if (!isNonEmptyString(c.rule)) errors.push(`${ctx}: rule required`);
      if (!isBool(c.ok)) errors.push(`${ctx}: ok must be boolean`);
    });
    if (a.verdict === 'PASS' && a.checklist.some((c) => c && c.ok === false)) {
      errors.push('review.v1: verdict PASS but a checklist rule is attested ok=false');
    }
  }
  if (!isArray(a.findings)) { errors.push('review.v1: findings[] required (may be empty on PASS)'); return; }
  a.findings.forEach((f, i) => {
    const ctx = `review.v1 findings[${i}]`;
    rejectUnknownKeys(f, ['id', 'severity', 'rule', 'evidence', 'requiredFix'], errors, ctx);
    if (!isNonEmptyString(f.id)) errors.push(`${ctx}: id required`);
    if (!['LOW', 'MED', 'HIGH'].includes(f.severity)) errors.push(`${ctx}: severity must be LOW|MED|HIGH`);
    if (!isNonEmptyString(f.rule)) errors.push(`${ctx}: rule required`);
    if (!isNonEmptyString(f.evidence)) errors.push(`${ctx}: evidence required`);
    if (f.requiredFix !== null && !isNonEmptyString(f.requiredFix)) errors.push(`${ctx}: requiredFix must be null or non-empty`);
  });
  if (a.verdict === 'FAIL' && !a.findings.some((f) => isNonEmptyString(f && f.requiredFix))) {
    errors.push('review.v1: FAIL requires at least one finding with a requiredFix — the Builder needs actionable feedback');
  }
}

function validateRisk(a, errors) {
  rejectUnknownKeys(a, ['schema', 'level', 'reason', 'sr2Triggers', 'independentReviewRequired'], errors, 'risk.v1');
  if (!R_LEVELS.includes(a.level)) errors.push('risk.v1: level must be R0-R3');
  if (!isNonEmptyString(a.reason)) errors.push('risk.v1: reason required');
  if (!isArray(a.sr2Triggers) || a.sr2Triggers.some((t) => !isNonEmptyString(t))) errors.push('risk.v1: sr2Triggers must be an array of strings (may be empty)');
  if (!isBool(a.independentReviewRequired)) errors.push('risk.v1: independentReviewRequired must be boolean');
}

function validateVerify(a, errors) {
  rejectUnknownKeys(a, ['schema', 'status', 'results', 'rollbackNote'], errors, 'verify.v1');
  if (!['passed', 'failed'].includes(a.status)) errors.push('verify.v1: status must be passed|failed');
  if (!isArray(a.results) || a.results.length === 0) { errors.push('verify.v1: results[] required (>=1)'); return; }
  a.results.forEach((r, i) => {
    const ctx = `verify.v1 results[${i}]`;
    rejectUnknownKeys(r, ['check', 'command', 'output', 'ok'], errors, ctx);
    if (!isNonEmptyString(r.check)) errors.push(`${ctx}: check required`);
    if (!isString(r.command)) errors.push(`${ctx}: command must be a string`);
    // SR-6 structurally: a verification claim without evidence is not a verification.
    if (!isNonEmptyString(r.output)) errors.push(`${ctx}: output evidence required — bare booleans are not verification`);
    if (!isBool(r.ok)) errors.push(`${ctx}: ok must be boolean`);
  });
  if (a.status === 'failed' && !isNonEmptyString(a.rollbackNote)) errors.push('verify.v1: failed verification requires a rollbackNote');
  if (a.status === 'passed' && a.results.some((r) => r && r.ok === false)) errors.push('verify.v1: status passed but a result has ok=false');
}

function validateScribe(a, errors) {
  rejectUnknownKeys(a, ['schema', 'workup', 'jiraNote'], errors, 'scribe.v1');
  if (!isNonEmptyString(a.workup)) errors.push('scribe.v1: workup required');
  if (!isNonEmptyString(a.jiraNote)) errors.push('scribe.v1: jiraNote required');
  if (isString(a.jiraNote) && a.jiraNote.trim().split(/\s+/).length > 200) errors.push('scribe.v1: jiraNote must be <= 200 words');
}

const VALIDATORS = {
  ROUTER: validateRouter,
  SPECIALIST: validateEvidence,
  BUILDER: validatePlan,
  REVIEWER: validateReview,
  RISK_FINALIZER: validateRisk,
  VERIFIER: validateVerify,
  SCRIBE: validateScribe,
};

/**
 * Validate a node's submitted artifact. Returns { ok, errors[] }.
 */
function validateArtifact(node, artifact) {
  const errors = [];
  if (!VALIDATORS[node]) return { ok: false, errors: [`no artifact expected from node ${node}`] };
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return { ok: false, errors: ['artifact must be a JSON object'] };
  }
  if (artifact.schema !== ARTIFACT_SCHEMAS[node]) {
    errors.push(`artifact schema must be "${ARTIFACT_SCHEMAS[node]}" (got "${artifact.schema}")`);
  }
  VALIDATORS[node](artifact, errors);
  return { ok: errors.length === 0, errors };
}

module.exports = {
  LANES,
  R_LEVELS,
  R_ORDER,
  NODES,
  MODES,
  TERMINAL_STATUSES,
  ARTIFACT_SCHEMAS,
  maxRisk,
  validateArtifact,
};
