'use strict';
// operator-message.js: the two-part message every connector and CLI prints on a failure
// (batch G3, task 6a). Pure: no fs, no console, no network.
//
// operator: a plain message in three parts: what happened, what was not done, the next step.
// admin:    one detail line: platform, operation, state, HTTP status, attempts, request id,
//           handoff state.
// Both are built from fixed text and the result's own fields (state names, numbers, a
// request id the contract has already checked). Nothing from a response body, an error's
// stack or a credential is ever placed in either.

const NAMES = Object.freeze({
  fleet: 'Fleet', jamf: 'Jamf Pro', slack: 'Slack', linear: 'Linear', gws: 'Google Workspace', 'google-workspace': 'Google Workspace', jira: 'Jira',
  github: 'GitHub', okta: 'Okta', msgraph: 'Microsoft Graph',
});

const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const safe = (value) => (typeof value === 'string' && SAFE_TOKEN.test(value) ? value : null);

function platformName(platform) {
  return NAMES[platform] || 'The vendor';
}

// what happened, for each state; status-specific wording for HTTP errors
function whatHappened(res, who) {
  switch (res.state) {
    case 'REFUSED': return `Aegis refused this request before reading any credential or contacting ${who}`;
    case 'NO_CREDENTIALS': return `The ${who} credential is not set in this shell`;
    case 'TIMEOUT': return `${who} did not answer in time`;
    case 'NETWORK_ERROR': return `The connection to ${who} failed`;
    case 'TENANT_MISMATCH': return `${who} returned a record that belongs to another tenant than this deployment's`;
    case 'INVALID_RESPONSE': return `${who} answered with something Aegis could not read as the expected data`;
    case 'SCOPE_REFUSED': return `The ${who} credential holds write permissions beyond the read-only scope manifest`;
    case 'AUDIT_FAILED': return 'The audit trail could not record this read';
    case 'INCONCLUSIVE': return `${who} answered, but the answer proves nothing either way about the change (INCONCLUSIVE, exit 5)`;
    case 'HTTP_ERROR': {
      const s = res.status;
      if (s === 401) return `${who} rejected the credential (HTTP 401)`;
      if (s === 403) return `${who} refused the read (HTTP 403): the credential lacks a read permission or the item is restricted`;
      if (s === 404) return `${who} found nothing at that address (HTTP 404)`;
      if (s === 429) return `${who} is limiting how fast Aegis may read (HTTP 429)`;
      if (Number.isInteger(s) && s >= 500) return `${who} had a server error (HTTP ${s})`;
      if (Number.isInteger(s) && s >= 300 && s < 400) return `${who} answered with a redirect (HTTP ${s}), which Aegis never follows`;
      return `${who} answered HTTP ${Number.isInteger(s) ? s : 'with an error'}`;
    }
    case 'OK': return res.verified === false ? 'The read-back did not prove the change' : `${who} answered`;
    default: return `The read from ${who} did not complete`;
  }
}

function notDone(res) {
  if (res.state === 'OK' && res.verified === false) return 'The change is not proven, so it is not reported done';
  if (res.state === 'TENANT_MISMATCH') return 'Nothing was returned or kept, and nothing was changed';
  if (res.state === 'AUDIT_FAILED') return 'Its answer was withheld, and nothing was changed';
  if (res.state === 'SCOPE_REFUSED') return 'Aegis did not use the credential, nothing was read and nothing was changed';
  if (res.state === 'INCONCLUSIVE') return 'The change is neither proven nor disproven: it is not reported done, and a counted change lists this read as uncounted, not as a failed object';
  return 'Nothing was read and nothing was changed';
}

function nextStep(res, who) {
  if (res.handoff && typeof res.handoff.next_step === 'string') return res.handoff.next_step;
  switch (res.state) {
    case 'REFUSED': return 'Check the command and its flags against the runbook, then run it again';
    case 'NO_CREDENTIALS': return `Export the ${who} read-only credential named in scripts/adapters/README.md from your secret manager, then run the read again`;
    case 'TIMEOUT':
    case 'NETWORK_ERROR': return `Check ${who}'s status page and your network, then run the read again in a few minutes`;
    case 'TENANT_MISMATCH': return 'Stop: check that the credential and the tenant variable belong to the same tenant, and do not work this case from that data';
    case 'INVALID_RESPONSE': return `Run the read again; if it repeats, read the same item in the ${who} console`;
    case 'SCOPE_REFUSED': return 'Ask the credential owner for a read-only credential with exactly the scopes in docs/aegis/g3/scope-manifest.md, then run the read again';
    case 'AUDIT_FAILED': return 'Run node scripts/audit/audit-log.js verify, fix the trail, then run the read again';
    case 'INCONCLUSIVE': return `Read the reason in the result and check the item in the ${who} console; reading again returns the same answer until the reason changes`;
    case 'OK': return 'Read the reason in the result, check the change in the console, and run the read-back again after the person finishes';
    case 'HTTP_ERROR': {
      const s = res.status;
      if (s === 401) return 'Check that the credential is current and is the read-only one in the scope manifest, then run the read again';
      if (s === 403) return 'Compare the credential with the scope manifest and ask its owner for the missing read permission; never add a write permission';
      if (s === 404) return 'Check the ID or name in the command, then run the read again';
      if (s === 429) return 'Wait a few minutes, then run the read again';
      if (Number.isInteger(s) && s >= 500) return `Check ${who}'s status page, then run the read again in a few minutes`;
      return `Read the same item in the ${who} console, or run the read again`;
    }
    default: return 'Run the read again; if it repeats, hand the ticket to a person with console access';
  }
}

function adminLine(res, platform, operation) {
  const parts = [
    `platform=${safe(platform) || '-'}`,
    `operation=${safe(operation) || '-'}`,
    `state=${safe(res.state) || '-'}`,
    `status=${Number.isInteger(res.status) ? res.status : '-'}`,
    `attempts=${Number.isInteger(res.attempts) ? res.attempts : '-'}`,
    `request_id=${safe(res.request_id) || '-'}`,
    `handoff=${res.handoff && safe(res.handoff.state) ? res.handoff.state : '-'}`,
  ];
  return parts.join(' ');
}

// The two parts for a failed result (any state but OK, or a read-back that did not verify).
function operatorMessage(res, { platform, operation } = {}) {
  const who = platformName(platform);
  const happened = res.handoff && typeof res.handoff.what_failed === 'string' ? res.handoff.what_failed : whatHappened(res, who);
  return {
    operator: `${happened}. ${notDone(res)}. ${nextStep(res, who)}.`,
    admin: adminLine(res, platform, operation),
  };
}

function isFailure(res) {
  return Boolean(res) && typeof res === 'object' && (res.state !== 'OK' || res.verified === false);
}

// The rate-limit handoff (batch G3 close-out, owner decision 3): said plainly to be a rate
// limit, not a permission problem, with the UTC time after which the read may run again when
// the vendor gave a usable one. rateLimit is the contract's { limit: { kind, header }, retryAt,
// reset }; the header is the opted-in spec's own remaining-requests header.
// A response header name as a spec may declare one (readonly-contract.js checks specs with it).
const HEADER_NAME = /^[a-z][a-z0-9-]{1,60}$/;
function rateLimitedHandoff(res, who, rateLimit) {
  const r = rateLimit || {};
  const l = r.limit && typeof r.limit === 'object' ? r.limit : {};
  const limit = l.kind === 'secondary' ? 'secondary' : 'primary';
  const header = typeof l.header === 'string' && HEADER_NAME.test(l.header) ? l.header : 'the remaining-requests header';
  const retryAt = Number.isFinite(r.retryAt) ? new Date(r.retryAt).toISOString() : null;
  const status = Number.isInteger(res.status) ? res.status : 'error';
  const kind = limit === 'secondary'
    ? `its secondary rate limit (too many requests in a short time, HTTP ${status})`
    : `its primary rate limit (the credential's request allowance for the current window is used up, HTTP ${status} with ${header} 0)`;
  let when;
  if (retryAt) when = `run the read again after ${retryAt} (UTC)`;
  else if (r.reset === 'past') when = `the reset time ${who} gave has already passed on this machine's clock, so check the clock, wait a few minutes and run the read again`;
  else when = `${who} gave no readable reset time, so wait for its rate-limit window to reset (its status page or console shows the limit), then run the read again`;
  return {
    state: 'RATE_LIMITED',
    limit,
    retry_at: retryAt,
    what_failed: `${who} refused the read under ${kind}: this is a rate limit, not a permission problem`,
    not_done: 'Nothing was read and nothing was changed',
    next_step: `Do not widen the token or ask for more permissions; ${when}`,
  };
}

// The handoff an exhausted read ends in: the named state and its plain words.
function handoffFor(state, res, { platform, retryAfterSeconds, budgetMs, rateLimit } = {}) {
  const who = platformName(platform);
  if (state === 'RATE_LIMITED') return rateLimitedHandoff(res, who, rateLimit);
  const happened = whatHappened(res, who);
  if (state === 'RETRY_AFTER_TOO_LONG') {
    return {
      state,
      retry_after_seconds: retryAfterSeconds,
      what_failed: `${happened}, and asked Aegis to wait ${retryAfterSeconds} seconds, longer than the 30 seconds Aegis waits`,
      not_done: 'Nothing was read and nothing was changed',
      next_step: `Run the read again after ${retryAfterSeconds} seconds have passed`,
    };
  }
  if (state === 'RETRY_BUDGET_SPENT') {
    return {
      state,
      what_failed: `${happened}, and the retries used up the ${Math.round(budgetMs / 1000)} second retry budget for one read`,
      not_done: 'Nothing was read and nothing was changed',
      next_step: `Check ${who}'s status page, then run the read again in a few minutes; if it keeps failing, hand the ticket to a person with console access`,
    };
  }
  return {
    state: 'RETRIES_EXHAUSTED',
    what_failed: `${happened} on all ${res.attempts} tries`,
    not_done: 'Nothing was read and nothing was changed',
    next_step: `Check ${who}'s status page, then run the read again in a few minutes; if it keeps failing, hand the ticket to a person with console access`,
  };
}

module.exports = { operatorMessage, handoffFor, isFailure, platformName, NAMES, HEADER_NAME };
