'use strict';
// verify-flags.js: every flag of every verify-* command, declared in one block per connector
// (batch G4, task A3; D10 on PR #9: --not-before was not recorded).
//
// Each flag a verify-* command takes is one of two kinds:
// - a pass flag, with its rule: it changes what the read's pass proves (--absent flips it,
//   --not-before bounds it in time, --expect-sha256 names the text it must find, --type and
//   --method name what must be there). The audit trail records it with every verify entry, a change
//   record names its read-back with it, and a read-back counts for a change only with the same
//   ones (scripts/audit/audit-log.js PASS_FLAGS, built from this file). A rule is SWITCH, TIME (an
//   ISO 8601 time with a zone or epoch milliseconds, recorded in UTC; named bare at open, and never
//   earlier than the change's approval), or a pattern that admits only a closed set, a number or a
//   digest, never free text.
// - not a pass flag, with its reason: it names the object the read checks (which object was read is
//   object-level binding, parked by the owner), or it is free text the trail does not record.
// scripts/adapters/verify-flags.test.js reads each connector's own command table and fails when a
// command takes a flag declared in neither way, or a declaration names a flag no command takes.
// Pure data: this file loads no other module, so the audit trail can read it without loading a
// connector.

const SWITCH = 'switch';
const TIME = 'time';
const DIGEST = /^[0-9a-f]{64}$/;
const BOOL = /^(?:true|false)$/;
const not = (reason) => Object.freeze({ reason });

const OBJECT = not('names the object the read checks; which object was read is object-level binding, parked by the owner (decision 3 on PR #7)');
const RUN = not('names the job run the read checks; it is recorded as the verify entry\'s run id (audit-log.js RUN_IDS), which a counted change counts once');
const FREE = not('free text the operator chooses; the trail records no free text, so a read with another value is not told apart (an owner decision: record a digest of the value)');
const FACTOR = not('names which enrolled factor the read checks, as PR #9 classed it; making it a pass flag changes how four Okta gates name their read-back (an owner decision, with a recommendation in the batch G4 report)');
const VERSION = not('the issue status version the preflight printed: which state of this one issue the read compares against, object-level binding, parked by the owner');

const VERIFY_FLAGS = Object.freeze({
  fleet: Object.freeze({
    'verify-lock': { id: OBJECT },
    'verify-unlock': { id: OBJECT },
    'verify-wipe': { id: OBJECT },
    'verify-script': { 'execution-id': RUN },
    'verify-mdm-off': { id: OBJECT },
    'verify-checked-in': { id: OBJECT, 'not-before': TIME },
    'verify-deleted': { identifier: OBJECT, 'not-before': TIME },
  }),
  github: Object.freeze({
    // github-client.js ROLES, the alert commands' stateRule, resolutionRule and reasonRule, and its reviews rule
    'verify-collaborator': { repo: OBJECT, user: OBJECT, role: /^(?:read|triage|write|maintain|admin)$/ },
    'verify-collaborator-removed': { repo: OBJECT, user: OBJECT },
    'verify-offboarded': { user: OBJECT },
    'verify-team-member': { team: OBJECT, user: OBJECT, absent: SWITCH },
    'verify-protection': { repo: OBJECT, branch: OBJECT, reviews: /^[0-6]$/, 'enforce-admins': SWITCH, 'no-force-push': SWITCH, 'no-deletions': SWITCH },
    'verify-2fa-required': {},
    'verify-secret-alert': { repo: OBJECT, number: OBJECT, state: /^resolved$/, resolution: /^(?:revoked|false_positive|wont_fix|used_in_tests)$/ },
    'verify-dependabot-alert': { repo: OBJECT, number: OBJECT, state: /^(?:dismissed|fixed)$/, reason: /^(?:fix_started|inaccurate|no_bandwidth|not_used|tolerable_risk)$/ },
  }),
  'google-workspace': Object.freeze({
    'verify-suspended': { user: OBJECT },
    'verify-2sv-enforced': { user: OBJECT },
    'verify-2sv-not-enforced': { user: OBJECT },
    'verify-ou': { user: OBJECT, ou: FREE },
    'verify-admin-role-removed': { user: OBJECT, 'role-id': OBJECT },
    // gws-client.js APPS and EVENT_NAME
    'verify-event': { app: /^(?:admin|login|drive|token|saml|user_accounts)$/, event: /^[A-Za-z][A-Za-z0-9_]{0,99}$/, user: OBJECT, 'not-before': TIME, target: OBJECT },
  }),
  jamf: Object.freeze({
    // jamf-client.js COMMAND_TYPE and COUNT
    'verify-command': { 'management-id': OBJECT, type: /^[A-Z][A-Z0-9_]{1,63}$/, 'not-before': TIME, 'profile-identifier': OBJECT },
    'verify-profile': { serial: OBJECT, 'profile-id': OBJECT, 'profile-identifier': OBJECT, absent: SWITCH },
    'verify-group-count': { id: OBJECT, expect: /^(?:0|[1-9][0-9]{0,6})$/ },
    'verify-filevault': { serial: OBJECT },
    'verify-checked-in': { serial: OBJECT, 'not-before': TIME },
    'verify-policy': { id: OBJECT, trigger: FREE, frequency: FREE, enabled: BOOL, 'no-triggers': SWITCH },
  }),
  linear: Object.freeze({
    'verify-comment': { issue: OBJECT, 'expect-sha256': DIGEST, 'not-before': TIME, author: OBJECT },
    'verify-state': { issue: OBJECT, state: FREE },
    'verify-labels': { issue: OBJECT, has: FREE },
    'verify-trashed': { issue: OBJECT },
    'verify-snoozed': { issue: OBJECT },
    'verify-suspended': { user: OBJECT },
  }),
  msgraph: Object.freeze({
    'verify-password-changed': { user: OBJECT, 'not-before': TIME },
    'verify-account-enabled': { user: OBJECT, enabled: BOOL },
    // msgraph-client.js METHODS: which kind of method must be registered
    'verify-mfa-method': { user: OBJECT, method: /^(?:microsoftAuthenticator|phone|fido2|softwareOath|windowsHelloForBusiness|email|temporaryAccessPass)$/ },
    'verify-mfa-cleared': { user: OBJECT },
    'verify-signin': { user: OBJECT, 'not-before': TIME },
    'verify-device-synced': { device: OBJECT, 'not-before': TIME },
    'verify-group-member': { group: OBJECT, user: OBJECT, absent: SWITCH },
    'verify-sessions-revoked': { user: OBJECT, 'not-before': TIME },
    'verify-method-absent': { user: OBJECT, 'method-id': OBJECT },
  }),
  okta: Object.freeze({
    // okta-client.js STATUSES
    'verify-status': { user: OBJECT, status: /^(?:ACTIVE|DEPROVISIONED|LOCKED_OUT|PASSWORD_EXPIRED|PROVISIONED|RECOVERY|STAGED|SUSPENDED)$/ },
    'verify-factor-reset': { user: OBJECT, 'factor-type': FACTOR },
    'verify-factors-reset-all': { user: OBJECT },
    'verify-sessions-cleared': { user: OBJECT, 'not-before': TIME },
    'verify-password-reset': { user: OBJECT, 'not-before': TIME },
    'verify-group-member': { group: OBJECT, user: OBJECT, absent: SWITCH },
    'verify-app-assigned': { app: OBJECT, user: OBJECT, absent: SWITCH },
  }),
  slack: Object.freeze({
    'verify-deactivated': { user: OBJECT },
    'verify-reactivated': { user: OBJECT },
    'verify-guest': { user: OBJECT, type: /^(?:single|multi)$/ },
    'verify-archived': { channel: OBJECT },
    // the digest of the text the read must find
    'verify-posted': { channel: OBJECT, 'expect-sha256': DIGEST, 'not-before': TIME },
    'verify-app-approved': { 'app-id': OBJECT },
    'verify-app-restricted': { 'app-id': OBJECT },
  }),
  jira: Object.freeze({
    'verify-create': { issue: OBJECT, 'expect-sha256': DIGEST, 'not-before': TIME },
    'verify-comment': { issue: OBJECT, 'comment-id': OBJECT, 'expect-sha256': DIGEST, 'not-before': TIME },
    'verify-transition': { issue: OBJECT, 'issue-id': OBJECT, 'from-version': VERSION, 'to-status': FREE },
  }),
});

const isPassRule = (rule) => rule === SWITCH || rule === TIME || rule instanceof RegExp;

// connector:command to its pass flags and their rules, the table the audit trail reads
const PASS_FLAGS = (() => {
  const out = {};
  for (const [connector, commands] of Object.entries(VERIFY_FLAGS)) {
    for (const [command, flags] of Object.entries(commands)) {
      const pass = Object.entries(flags).filter(([, rule]) => isPassRule(rule));
      if (pass.length) out[`${connector}:${command}`] = Object.freeze(Object.fromEntries(pass));
    }
  }
  return Object.freeze(out);
})();

// What the declarations and the connectors' own tables disagree on, as sorted lines (none when they
// agree). taken: connector to command to the flags its table takes.
function undeclared(declared, taken) {
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  const found = [];
  for (const connector of Object.keys(declared)) if (!has(taken, connector)) found.push(`${connector}: declared, not a connector`);
  for (const [connector, commands] of Object.entries(taken)) {
    if (!has(declared, connector)) { found.push(`${connector}: a connector, not declared`); continue; }
    for (const command of Object.keys(declared[connector])) if (!has(commands, command)) found.push(`${connector} ${command}: declared, not a command`);
    for (const [command, flags] of Object.entries(commands)) {
      if (!has(declared[connector], command)) { found.push(`${connector} ${command}: a command, not declared`); continue; }
      const mine = declared[connector][command];
      for (const flag of flags) if (!has(mine, flag)) found.push(`${connector} ${command} --${flag}: taken, not declared`);
      for (const flag of Object.keys(mine)) if (!flags.includes(flag)) found.push(`${connector} ${command} --${flag}: declared, not taken`);
    }
  }
  return found.sort();
}

module.exports = { VERIFY_FLAGS, PASS_FLAGS, SWITCH, TIME, DIGEST, BOOL, isPassRule, undeclared };
