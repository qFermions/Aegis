'use strict';
// github-client.js: the read-only GitHub connector (batch G3, task 5a), built on the shared
// contract readonly-contract.js (README.md here).
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). This file reads GitHub through GET
// routes on api.github.com and nothing else. It never adds or removes a member or a
// collaborator, changes a role, branch protection, a ruleset or an organization setting,
// or closes an alert: each of those is a HUMAN-RUN step in a runbook under
// .claude/commands/github-*.md, and a verify-* command below proves it afterwards.
//
// Usage: node scripts/adapters/github-client.js <command> [flags] [--execute]
//   Reads (a dry run that prints the planned request unless --execute is given):
//     org | members [--filter all|2fa_disabled|2fa_insecure] [--role all|admin|member] [--page N]
//     membership --user [GITHUB_USER] | teams [--page N] | team-members --team [TEAM_SLUG] [--page N]
//     outside-collaborators [--page N] | invitations [--page N]
//     collaborators --repo [REPO_NAME] [--affiliation direct|outside|all] [--page N]
//     permission --repo [REPO_NAME] --user [GITHUB_USER]
//     protection --repo [REPO_NAME] --branch [BRANCH_NAME] | rulesets --repo [REPO_NAME]
//     branch-rules --repo [REPO_NAME] --branch [BRANCH_NAME]
//     audit-log [--phrase TEXT] (GitHub Enterprise Cloud) | sso-authorizations (Enterprise Cloud)
//     secret-alerts [--state open|resolved] [--page N] | secret-alert --repo [REPO_NAME] --number [ALERT_NUMBER]
//     dependabot-alerts [--state ...] [--severity ...] [--page N] | dependabot-alert --repo [REPO_NAME] --number [ALERT_NUMBER]
//     issue --repo [REPO_NAME] --number N (the issue and its first 100 comments: the JSON
//       scripts/intake/intake.js imports as a GitHub issue)
//   Read-backs (verified true or false; exit 0 verified, 2 not verified, 4 a dry run):
//     verify-collaborator --repo R --user U --role read|triage|write|maintain|admin
//     verify-collaborator-removed --repo R --user U
//     verify-offboarded --user U
//     verify-team-member --team T --user U [--absent]
//     verify-protection --repo R --branch B [--reviews N] [--enforce-admins] [--no-force-push] [--no-deletions]
//     verify-2fa-required
//     verify-secret-alert --repo R --number N --state resolved [--resolution revoked|false_positive|wont_fix|used_in_tests]
//     verify-dependabot-alert --repo R --number N --state dismissed|fixed [--reason fix_started|inaccurate|no_bandwidth|not_used|tolerable_risk]
//
// Environment: GITHUB_ORG names this deployment's organization ([@Aegion_GITHUB_ORG]),
// exactly as GitHub returns its login; every path is built from it and no command takes an
// organization. GITHUB_TOKEN is a read-only fine-grained token or App installation token
// (scope-manifest.json "github"); a classic token holding any scope but read:* is refused.
// Rate limits (batch G3 close-out, owner decision 3): GitHub answers an exhausted primary
// rate limit with 403 or 429 and x-ratelimit-remaining 0 (vendor fact G-40), and a secondary
// limit with 403 or 429 and a message naming it (G-41). SPEC.rateLimit turns on the
// contract's rate-limit hook, so neither reads as a permission refusal: a wait that fits the
// contract's 30 s cap and retry budget is waited out (one second past x-ratelimit-reset, or
// retry-after seconds), and anything longer ends in the RATE_LIMITED handoff with the UTC time
// to run the read again and the words "a rate limit, not a permission problem". A 403 with
// neither signal is still a permission refusal.

const {
  STATES, RefusedError, TripwireError, defineAdapter, createClient, renderResult, exitCodeFor, parseArgs, redactDeep, dryRunExit,
} = require('./readonly-contract.js');
const { cliDeps, recordVerdict, takeChange, changeRefusal } = require('./cli-support.js');

const API_VERSION = '2022-11-28';
const PER_PAGE = '100';
const MAX_PAGES = 10;

// ── Patterns ─────────────────────────────────────────────────────────────────
const ORG = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;
const BRANCH = /^(?!.*\.\.)(?!.*\/\/)(?!.*\/$)[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/;
const TEAM = /^[a-z0-9][a-z0-9_-]{0,99}$/;
const NUMBER = /^[1-9][0-9]{0,8}$/;
const PAGE = /^(?:[1-9]|[1-9][0-9]{1,2})$/;
const PHRASE = /^[A-Za-z0-9 :._@\/-]{1,200}$/;

const ROUTES = Object.freeze({
  org: { method: 'GET', path: '/orgs/:org', params: { org: ORG } },
  members: { method: 'GET', path: '/orgs/:org/members', params: { org: ORG }, fixedQuery: { per_page: PER_PAGE }, query: { filter: /^(?:all|2fa_disabled|2fa_insecure)$/, role: /^(?:all|admin|member)$/, page: PAGE } },
  membership: { method: 'GET', path: '/orgs/:org/memberships/:user', params: { org: ORG, user: LOGIN } },
  teams: { method: 'GET', path: '/orgs/:org/teams', params: { org: ORG }, fixedQuery: { per_page: PER_PAGE }, query: { page: PAGE } },
  teamMembers: { method: 'GET', path: '/orgs/:org/teams/:team/members', params: { org: ORG, team: TEAM }, fixedQuery: { per_page: PER_PAGE }, query: { page: PAGE } },
  outsideCollaborators: { method: 'GET', path: '/orgs/:org/outside_collaborators', params: { org: ORG }, fixedQuery: { per_page: PER_PAGE }, query: { page: PAGE } },
  invitations: { method: 'GET', path: '/orgs/:org/invitations', params: { org: ORG }, fixedQuery: { per_page: PER_PAGE }, query: { page: PAGE } },
  collaborators: { method: 'GET', path: '/repos/:org/:repo/collaborators', params: { org: ORG, repo: REPO }, fixedQuery: { per_page: PER_PAGE }, query: { affiliation: /^(?:direct|outside|all)$/, page: PAGE } },
  permission: { method: 'GET', path: '/repos/:org/:repo/collaborators/:user/permission', params: { org: ORG, repo: REPO, user: LOGIN } },
  protection: { method: 'GET', path: '/repos/:org/:repo/branches/:branch/protection', params: { org: ORG, repo: REPO, branch: BRANCH } },
  rulesets: { method: 'GET', path: '/repos/:org/:repo/rulesets', params: { org: ORG, repo: REPO }, fixedQuery: { includes_parents: 'true' } },
  branchRules: { method: 'GET', path: '/repos/:org/:repo/rules/branches/:branch', params: { org: ORG, repo: REPO, branch: BRANCH } },
  auditLog: { method: 'GET', path: '/orgs/:org/audit-log', params: { org: ORG }, fixedQuery: { per_page: PER_PAGE }, query: { phrase: PHRASE } },
  ssoAuthorizations: { method: 'GET', path: '/orgs/:org/credential-authorizations', params: { org: ORG }, fixedQuery: { per_page: PER_PAGE } },
  orgSecretAlerts: { method: 'GET', path: '/orgs/:org/secret-scanning/alerts', params: { org: ORG }, fixedQuery: { per_page: PER_PAGE }, query: { state: /^(?:open|resolved)$/, page: PAGE } },
  secretAlert: { method: 'GET', path: '/repos/:org/:repo/secret-scanning/alerts/:number', params: { org: ORG, repo: REPO, number: NUMBER } },
  orgDependabotAlerts: { method: 'GET', path: '/orgs/:org/dependabot/alerts', params: { org: ORG }, fixedQuery: { per_page: PER_PAGE }, query: { state: /^(?:open|dismissed|fixed|auto_dismissed)$/, severity: /^(?:low|medium|high|critical)$/, page: PAGE } },
  dependabotAlert: { method: 'GET', path: '/repos/:org/:repo/dependabot/alerts/:number', params: { org: ORG, repo: REPO, number: NUMBER } },
  issue: { method: 'GET', path: '/repos/:org/:repo/issues/:number', params: { org: ORG, repo: REPO, number: NUMBER } },
  issueComments: { method: 'GET', path: '/repos/:org/:repo/issues/:number/comments', params: { org: ORG, repo: REPO, number: NUMBER }, fixedQuery: { per_page: PER_PAGE } },
});

// ── Tenant: the organizations a response names ────────────────────────────────
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ORG_API = /^https:\/\/api\.github\.com\/orgs\/([^/]+)\//;
const REPO_API = /^https:\/\/api\.github\.com\/repos\/([^/]+)\//;
const TEAM_HTML = /^https:\/\/github\.com\/orgs\/([^/]+)\/teams\//;
function orgsNamedBy(item) {
  const found = [];
  if (!isObject(item)) return found;
  const m = (re, v) => { const r = typeof v === 'string' ? re.exec(v) : null; if (r) found.push(r[1]); };
  if (isObject(item.organization) && typeof item.organization.login === 'string') found.push(item.organization.login);
  if (isObject(item.repository) && isObject(item.repository.owner) && typeof item.repository.owner.login === 'string') found.push(item.repository.owner.login);
  if (typeof item.repos_url === 'string' && typeof item.login === 'string' && ORG_API.test(item.repos_url)) found.push(item.login);
  m(TEAM_HTML, item.html_url);
  m(REPO_API, item.url);
  m(REPO_API, item.repository_url ? `${item.repository_url}/` : undefined);
  if (item.source_type === 'Repository' && typeof item.source === 'string') found.push(item.source.split('/')[0]);
  if (item.source_type === 'Organization' && typeof item.source === 'string') found.push(item.source);
  return found;
}
function collectTenant(json) {
  if (Array.isArray(json)) return json.slice(0, 1000).flatMap(orgsNamedBy);
  return orgsNamedBy(json);
}

// ── Scopes: a classic token's X-OAuth-Scopes must hold read:* scopes only ─────
const READ_SCOPE = /^read:[a-z_]+$/;
const scopeList = (header) => {
  if (typeof header !== 'string') return null;
  const list = header.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : null;
};

const SPEC = defineAdapter({
  platform: 'github',
  host: { fixed: 'api.github.com' },
  credentials: ['GITHUB_TOKEN'],
  auth: (creds) => ({
    Authorization: `Bearer ${creds.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'aegis-readonly-connector',
  }),
  routes: ROUTES,
  tenant: { env: 'GITHUB_ORG', collect: collectTenant },
  // batch G3: GitHub returns a classic token's scopes in X-OAuth-Scopes (vendor fact G-31);
  // fine-grained and App tokens do not, so they get the not-exposed notice
  scopes: { manifest: 'github', kind: 'header', vendor: 'GitHub', header: 'x-oauth-scopes', granted: scopeList, allowed: (s) => READ_SCOPE.test(s) },
  // batch G3 close-out: GitHub's rate-limit signals (vendor facts G-40, G-41)
  rateLimit: { statuses: [403, 429], remainingHeader: 'x-ratelimit-remaining', resetHeader: 'x-ratelimit-reset', secondaryMessage: /secondary rate limit/i, messageField: 'message' },
});

// ── Commands ─────────────────────────────────────────────────────────────────
const ROLES = /^(?:read|triage|write|maintain|admin)$/;
const RULES = {
  user: LOGIN, repo: REPO, branch: BRANCH, team: TEAM, number: NUMBER, page: PAGE, phrase: PHRASE,
  filter: /^(?:all|2fa_disabled|2fa_insecure)$/, role: /^(?:all|admin|member)$/, affiliation: /^(?:direct|outside|all)$/,
  'secret-state': /^(?:open|resolved)$/, 'dependabot-state': /^(?:open|dismissed|fixed|auto_dismissed)$/, severity: /^(?:low|medium|high|critical)$/,
  reviews: /^[0-6]$/,
};
const VALUE_FLAGS = ['user', 'repo', 'branch', 'team', 'number', 'page', 'phrase', 'filter', 'role', 'affiliation', 'state', 'severity', 'reviews', 'resolution', 'reason'];
const BOOLEAN_FLAGS = ['execute', 'absent', 'enforce-admins', 'no-force-push', 'no-deletions'];

const step = (route, params = {}, query = {}) => ({ route, params, query });
const pick = (a, keys) => Object.fromEntries(keys.filter((k) => a[k] !== undefined).map((k) => [k, a[k]]));

const COMMANDS = Object.freeze({
  org: { kind: 'read', flags: [], steps: () => [step('org')] },
  members: { kind: 'read', flags: [], optional: ['filter', 'role', 'page'], steps: (a) => [step('members', {}, pick(a, ['filter', 'role', 'page']))] },
  membership: { kind: 'read', flags: ['user'], steps: (a) => [step('membership', { user: a.user })] },
  teams: { kind: 'read', flags: [], optional: ['page'], steps: (a) => [step('teams', {}, pick(a, ['page']))] },
  'team-members': { kind: 'read', flags: ['team'], optional: ['page'], steps: (a) => [step('teamMembers', { team: a.team }, pick(a, ['page']))] },
  'outside-collaborators': { kind: 'read', flags: [], optional: ['page'], steps: (a) => [step('outsideCollaborators', {}, pick(a, ['page']))] },
  invitations: { kind: 'read', flags: [], optional: ['page'], steps: (a) => [step('invitations', {}, pick(a, ['page']))] },
  collaborators: { kind: 'read', flags: ['repo'], optional: ['affiliation', 'page'], steps: (a) => [step('collaborators', { repo: a.repo }, pick(a, ['affiliation', 'page']))] },
  permission: { kind: 'read', flags: ['repo', 'user'], steps: (a) => [step('permission', { repo: a.repo, user: a.user })] },
  protection: { kind: 'read', flags: ['repo', 'branch'], steps: (a) => [step('protection', { repo: a.repo, branch: a.branch })] },
  rulesets: { kind: 'read', flags: ['repo'], steps: (a) => [step('rulesets', { repo: a.repo })] },
  'branch-rules': { kind: 'read', flags: ['repo', 'branch'], steps: (a) => [step('branchRules', { repo: a.repo, branch: a.branch })] },
  'audit-log': { kind: 'read', flags: [], optional: ['phrase'], steps: (a) => [step('auditLog', {}, pick(a, ['phrase']))] },
  'sso-authorizations': { kind: 'read', flags: [], steps: () => [step('ssoAuthorizations')] },
  'secret-alerts': { kind: 'read', flags: [], optional: ['state', 'page'], stateRule: 'secret-state', steps: (a) => [step('orgSecretAlerts', {}, pick(a, ['state', 'page']))] },
  'secret-alert': { kind: 'read', flags: ['repo', 'number'], steps: (a) => [step('secretAlert', { repo: a.repo, number: a.number })] },
  'dependabot-alerts': { kind: 'read', flags: [], optional: ['state', 'severity', 'page'], stateRule: 'dependabot-state', steps: (a) => [step('orgDependabotAlerts', {}, pick(a, ['state', 'severity', 'page']))] },
  'dependabot-alert': { kind: 'read', flags: ['repo', 'number'], steps: (a) => [step('dependabotAlert', { repo: a.repo, number: a.number })] },
  issue: { kind: 'issue', flags: ['repo', 'number'], steps: (a) => [step('issue', { repo: a.repo, number: a.number }), step('issueComments', { repo: a.repo, number: a.number })] },
  'verify-collaborator': { kind: 'verify', flags: ['repo', 'user', 'role'], roleRule: ROLES, steps: (a) => [step('permission', { repo: a.repo, user: a.user })], expected: (a) => ({ repo: a.repo, user: a.user, role_name: a.role }) },
  'verify-collaborator-removed': { kind: 'verify', flags: ['repo', 'user'], steps: (a) => [step('collaborators', { repo: a.repo }, { affiliation: 'direct' })], expected: (a) => ({ repo: a.repo, user: a.user, direct_collaborator: false }) },
  'verify-offboarded': { kind: 'verify', flags: ['user'], steps: (a) => [step('org'), step('membership', { user: a.user }), step('invitations'), step('outsideCollaborators')], expected: (a) => ({ user: a.user, member: false, pending_invitation: false, outside_collaborator: false }) },
  'verify-team-member': { kind: 'verify', flags: ['team', 'user'], booleans: ['absent'], steps: (a) => [step('teamMembers', { team: a.team })], expected: (a) => ({ team: a.team, user: a.user, member: !a.absent }) },
  'verify-protection': { kind: 'verify', flags: ['repo', 'branch'], optional: ['reviews'], booleans: ['enforce-admins', 'no-force-push', 'no-deletions'], steps: (a) => [step('protection', { repo: a.repo, branch: a.branch })],
    expected: (a) => ({ repo: a.repo, branch: a.branch, protected: true, ...(a.reviews !== undefined ? { required_approving_review_count_at_least: Number(a.reviews) } : {}), ...(a['enforce-admins'] ? { enforce_admins: true } : {}), ...(a['no-force-push'] ? { allow_force_pushes: false } : {}), ...(a['no-deletions'] ? { allow_deletions: false } : {}) }) },
  'verify-2fa-required': { kind: 'verify', flags: [], steps: () => [step('org')], expected: () => ({ two_factor_requirement_enabled: true }) },
  'verify-secret-alert': { kind: 'verify', flags: ['repo', 'number', 'state'], optional: ['resolution'], stateRule: /^resolved$/, resolutionRule: /^(?:revoked|false_positive|wont_fix|used_in_tests)$/, steps: (a) => [step('secretAlert', { repo: a.repo, number: a.number })], expected: (a) => ({ repo: a.repo, number: a.number, state: a.state, ...(a.resolution ? { resolution: a.resolution } : {}) }) },
  'verify-dependabot-alert': { kind: 'verify', flags: ['repo', 'number', 'state'], optional: ['reason'], stateRule: /^(?:dismissed|fixed)$/, reasonRule: /^(?:fix_started|inaccurate|no_bandwidth|not_used|tolerable_risk)$/, steps: (a) => [step('dependabotAlert', { repo: a.repo, number: a.number })], expected: (a) => ({ repo: a.repo, number: a.number, state: a.state, ...(a.reason ? { dismissed_reason: a.reason } : {}) }) },
});

const USAGE = `Usage: node scripts/adapters/github-client.js <command> [flags] [--execute]
  Commands: ${Object.keys(COMMANDS).join(' | ')}
  The organization comes from GITHUB_ORG; GITHUB_TOKEN is read only with --execute.
`;

function validate(command, def, args) {
  const allowedValues = new Set([...(def.flags || []), ...(def.optional || [])]);
  const allowedBooleans = new Set(['execute', ...(def.booleans || [])]);
  for (const key of Object.keys(args)) {
    if (key === '_command') continue;
    if (BOOLEAN_FLAGS.includes(key) ? !allowedBooleans.has(key) : !allowedValues.has(key)) throw new RefusedError(`${command} takes no --${key}`);
  }
  for (const f of def.flags || []) if (args[f] === undefined) throw new RefusedError(`${command} needs --${f}`);
  const a = { ...args };
  for (const key of Object.keys(a)) {
    if (key === '_command' || BOOLEAN_FLAGS.includes(key)) continue;
    let rule = RULES[key];
    if (key === 'state') rule = def.stateRule instanceof RegExp ? def.stateRule : RULES[def.stateRule];
    if (key === 'role' && def.roleRule) rule = def.roleRule;
    if (key === 'resolution') rule = def.resolutionRule;
    if (key === 'reason') rule = def.reasonRule;
    if (!rule || typeof a[key] !== 'string' || !rule.test(a[key])) throw new RefusedError(`--${key} is not an allowed value for ${command}`);
  }
  return a;
}

// ── Read-backs ───────────────────────────────────────────────────────────────
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const loginsOf = (list) => (Array.isArray(list) ? list.filter(isObject).map((u) => u.login).filter((l) => typeof l === 'string') : []);

// Every page of a list read, while pages are full, up to MAX_PAGES. Returns the records
// and whether the list may go on past the last page read.
async function readPages(client, s) {
  const records = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const query = page === 1 ? s.query : { ...s.query, page: String(page) };
    const res = await client.get(s.route, s.params, query);
    if (!res.ok) return { failed: res };
    const items = Array.isArray(res.data) ? res.data : [];
    records.push(...items);
    if (items.length < Number(PER_PAGE)) return { records, more: false, flags: res.flags || [] };
  }
  return { records, more: true, flags: [] };
}

const NOT_PROOF = `the list is longer than ${MAX_PAGES} pages of ${PER_PAGE}, so this is not proof either way; check in the GitHub UI`;

// steps: the command's reads with the organization from GITHUB_ORG already bound
async function judge(command, a, client, steps) {
  const one = async (s) => client.get(s.route, s.params, s.query);
  switch (command) {
    case 'verify-collaborator': {
      const res = await one(steps[0]);
      if (!res.ok) return { failed: res };
      const role = isObject(res.data) ? res.data.role_name : undefined;
      return role === a.role ? { verified: true, observed: { role_name: role } } : { verified: false, observed: { role_name: role === undefined ? null : role }, reason: `the role on ${a.repo} is ${role === undefined ? 'not shown' : role}, not ${a.role}` };
    }
    case 'verify-collaborator-removed': {
      const r = await readPages(client, steps[0]);
      if (r.failed) return { failed: r.failed };
      const present = loginsOf(r.records).some((l) => same(l, a.user));
      if (present) return { verified: false, observed: { direct_collaborator: true }, reason: `${a.user} is still a direct collaborator on ${a.repo}` };
      if (r.more) return { verified: false, observed: { records_read: r.records.length }, reason: NOT_PROOF };
      return { verified: true, observed: { direct_collaborator: false, records_read: r.records.length } };
    }
    case 'verify-offboarded': {
      const org = await one(steps[0]);
      if (!org.ok) return { failed: org };
      const membership = await one(steps[1]);
      if (membership.ok) return { verified: false, observed: { member: true, state: isObject(membership.data) ? membership.data.state : null }, reason: `${a.user} is still in the organization (membership ${isObject(membership.data) ? membership.data.state : 'present'})` };
      if (!(membership.state === STATES.HTTP_ERROR && membership.status === 404)) return { failed: membership };
      const inv = await readPages(client, steps[2]);
      if (inv.failed) return { failed: inv.failed };
      if (loginsOf(inv.records).some((l) => same(l, a.user))) return { verified: false, observed: { member: false, pending_invitation: true }, reason: `${a.user} has a pending invitation to the organization` };
      const outside = await readPages(client, steps[3]);
      if (outside.failed) return { failed: outside.failed };
      if (loginsOf(outside.records).some((l) => same(l, a.user))) return { verified: false, observed: { member: false, pending_invitation: false, outside_collaborator: true }, reason: `${a.user} is now an outside collaborator, so they still reach repositories` };
      if (inv.more || outside.more) return { verified: false, observed: { member: false }, reason: NOT_PROOF };
      return { verified: true, observed: { member: false, pending_invitation: false, outside_collaborator: false } };
    }
    case 'verify-team-member': {
      const r = await readPages(client, steps[0]);
      if (r.failed) return { failed: r.failed };
      const present = loginsOf(r.records).some((l) => same(l, a.user));
      // absence on a list longer than the pages read proves nothing, either way
      if (!present && r.more) return { verified: false, observed: { member: false }, reason: NOT_PROOF };
      if (present === !a.absent) return { verified: true, observed: { member: present } };
      return { verified: false, observed: { member: present }, reason: present ? `${a.user} is still in ${a.team}` : `${a.user} is not in ${a.team}` };
    }
    case 'verify-protection': {
      const res = await one(steps[0]);
      if (!res.ok) {
        if (res.state === STATES.HTTP_ERROR && res.status === 404) return { verified: false, observed: { protected: false }, reason: `${a.branch} on ${a.repo} has no classic branch protection, or the credential cannot read it (rulesets: run rulesets)` };
        return { failed: res };
      }
      const d = isObject(res.data) ? res.data : {};
      const reviews = isObject(d.required_pull_request_reviews) ? d.required_pull_request_reviews.required_approving_review_count : undefined;
      const enabled = (o) => (isObject(o) ? o.enabled === true : null);
      const observed = { protected: true, required_approving_review_count: reviews === undefined ? null : reviews, enforce_admins: enabled(d.enforce_admins), allow_force_pushes: enabled(d.allow_force_pushes), allow_deletions: enabled(d.allow_deletions) };
      const misses = [];
      if (a.reviews !== undefined && !(Number.isInteger(reviews) && reviews >= Number(a.reviews))) misses.push(`required reviews ${reviews === undefined ? 'off' : reviews}, expected at least ${a.reviews}`);
      if (a['enforce-admins'] && observed.enforce_admins !== true) misses.push('admins are not included');
      if (a['no-force-push'] && observed.allow_force_pushes !== false) misses.push('force pushes are allowed');
      if (a['no-deletions'] && observed.allow_deletions !== false) misses.push('deletions are allowed');
      return misses.length ? { verified: false, observed, reason: misses.join('; ') } : { verified: true, observed };
    }
    case 'verify-2fa-required': {
      const res = await one(steps[0]);
      if (!res.ok) return { failed: res };
      const v = isObject(res.data) ? res.data.two_factor_requirement_enabled : undefined;
      if (v === true) return { verified: true, observed: { two_factor_requirement_enabled: true } };
      if (v === undefined) return { verified: false, observed: { two_factor_requirement_enabled: null }, reason: 'the answer does not show the 2FA requirement: only an organization owner\'s credential can see it (vendor fact G-14)' };
      return { verified: false, observed: { two_factor_requirement_enabled: v }, reason: 'the organization does not require two-factor authentication' };
    }
    case 'verify-secret-alert':
    case 'verify-dependabot-alert': {
      const res = await one(steps[0]);
      if (!res.ok) return { failed: res };
      const d = isObject(res.data) ? res.data : {};
      const field = command === 'verify-secret-alert' ? 'resolution' : 'dismissed_reason';
      const want = command === 'verify-secret-alert' ? a.resolution : a.reason;
      const observed = { state: d.state === undefined ? null : d.state, [field]: d[field] === undefined ? null : d[field] };
      if (d.state !== a.state) return { verified: false, observed, reason: `the alert is ${d.state === undefined ? 'in no stated state' : d.state}, not ${a.state}` };
      if (want && d[field] !== want) return { verified: false, observed, reason: `the ${field} is ${d[field] === undefined ? 'not shown' : d[field]}, not ${want}` };
      return { verified: true, observed };
    }
    default:
      throw new RefusedError('unknown read-back');
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function plan(client, steps) {
  const planned = steps.map((s) => client.plan(s.route, s.params, s.query));
  const refused = planned.find((p) => p.state !== STATES.OK);
  if (refused) throw new RefusedError(refused.error || 'request refused');
  return planned.map((p) => ({ method: p.method, host: p.host, path: p.path }));
}

async function run(argv, env = process.env, deps = {}) {
  const out = deps.out || ((s) => process.stdout.write(s));
  const err = deps.err || ((s) => process.stderr.write(s));
  const secrets = () => [env.GITHUB_TOKEN].filter((v) => typeof v === 'string' && v.length > 0);
  // batch G3 close-out (owner decision 1): --change binds a verify-* read-back to its change
  // record; it is taken out of argv here and checked below, before any read
  const bound = takeChange(argv);
  try {
    const args = parseArgs(bound.argv, { values: VALUE_FLAGS, booleans: BOOLEAN_FLAGS });
    const command = args._command;
    if (command === 'help' || command === '--help') { out(USAGE); return 0; }
    if (typeof command !== 'string' || !Object.prototype.hasOwnProperty.call(COMMANDS, command)) {
      err(USAGE);
      throw new RefusedError(command === undefined ? 'no command given' : 'unknown command; no command writes to GitHub');
    }
    const def = COMMANDS[command];
    const a = validate(command, def, args);
    const org = typeof env.GITHUB_ORG === 'string' ? env.GITHUB_ORG.trim() : '';
    if (!ORG.test(org)) throw new RefusedError('GITHUB_ORG must name this deployment\'s organization (its login) before any read');
    const steps = def.steps(a).map((s) => ({ ...s, params: { org, ...s.params } }));
    const cli = cliDeps(deps, env);
    const refusal = bound.error || changeRefusal('github', command, bound.change, cli.audit);
    if (refusal) throw new RefusedError(refusal);

    if (args.execute !== true) {
      const dryClient = createClient(SPEC, { env: { GITHUB_ORG: org }, transport: async () => { throw new Error('dry run'); } });
      const planned = plan(dryClient, steps);
      const shown = { state: STATES.OK, ok: true, command, ...planned[0], ...(planned.length > 1 ? { then: planned.slice(1) } : {}) };
      if (def.kind === 'verify') shown.expected = def.expected(a);
      shown.note = 'dry run: no credentials read, no network';
      shown.next = 'Add --execute to perform this read.';
      out(renderResult(shown, { platform: 'github' }));
      return dryRunExit(command, err);
    }

    const client = createClient(SPEC, { env, ...cli });
    let res;
    if (def.kind === 'read') {
      const r = await client.get(steps[0].route, steps[0].params, steps[0].query);
      res = r.ok ? { state: STATES.OK, ok: true, command, status: r.status, attempts: r.attempts, data: r.data, ...(r.scope_notice ? { scope_notice: r.scope_notice } : {}), ...(r.flags && r.flags.length ? { flags: r.flags } : {}) }
        : { command, ...r };
    } else if (def.kind === 'issue') {
      const issue = await client.get(steps[0].route, steps[0].params, steps[0].query);
      const comments = issue.ok ? await client.get(steps[1].route, steps[1].params, steps[1].query) : null;
      if (!issue.ok) res = { command, ...issue };
      else if (!comments.ok) res = { command, ...comments };
      else res = { state: STATES.OK, ok: true, command, data: { issue: issue.data, comments: Array.isArray(comments.data) ? comments.data : [] }, ...(issue.scope_notice ? { scope_notice: issue.scope_notice } : {}) };
    } else {
      const judged = await judge(command, a, client, steps);
      if (judged.failed) res = { command, ...judged.failed };
      else {
        const verdict = { state: STATES.OK, ok: true, command, verified: judged.verified === true, expected: def.expected(a), observed: judged.observed };
        if (!verdict.verified) verdict.reason = judged.reason;
        res = recordVerdict(cli.audit, 'github', verdict, bound.change);
      }
    }
    const shown = redactDeep(res, secrets());
    const code = exitCodeFor(shown);
    (code === 1 ? err : out)(renderResult(shown, { secrets: secrets(), platform: 'github', operation: command }));
    return code;
  } catch (error) {
    if (error instanceof TripwireError || (error && error.name === 'NetworkTripwireError')) throw error;
    if (error instanceof RefusedError) {
      err(renderResult({ state: STATES.REFUSED, ok: false, error: error.message }, { secrets: secrets(), platform: 'github' }));
      return 1;
    }
    err(renderResult({ state: STATES.INVALID_RESPONSE, ok: false, error: 'unexpected adapter error (details withheld)' }, { platform: 'github' }));
    return 2;
  }
}

if (require.main === module) {
  run(process.argv.slice(2), process.env).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(error && error.name === 'NetworkTripwireError' ? 'Network tripwire fired\n' : 'github-client: unexpected error (details withheld)\n');
    process.exitCode = 2;
  });
}

module.exports = { SPEC, ROUTES, COMMANDS, run, collectTenant, MAX_PAGES };
