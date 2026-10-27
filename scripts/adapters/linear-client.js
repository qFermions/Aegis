'use strict';
// linear-client.js: the read-only Linear adapter for lane G2 (docs/aegis/lanes/g2.md,
// Linear section), built on the shared contract readonly-contract.js (README.md here).
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). This file reads Linear through
// seven named GraphQL query documents and nothing else. It never posts a comment,
// changes a state or a label, trashes an issue or suspends a member: each of those is
// a HUMAN-RUN step in a runbook, and a verify-* command below proves it afterwards.
//
// Usage: node scripts/adapters/linear-client.js <command> [flags] [--execute]
//   Offline (no credentials, no network, never --execute):
//     note    --issue [ISSUE_ID] --body-file [NOTE_FILE]
//     digest  --body-file [NOTE_FILE]
//   [NOTE_FILE] is a .md or .txt file under this repo's tasks/ folder or the system
//   temporary folder (os.tmpdir()), outside any .ssh, .aws, .config, .gnupg or .claude
//   folder; any other file, and a body the commit scanner would block, is refused and
//   never printed.
//   Reads (a dry run that prints the planned request unless --execute is given):
//     viewer | issue --issue [ISSUE_ID] | comments --issue [ISSUE_ID] (the first 50 comments)
//     states --team [@Aegion_LINEAR_TEAM] | labels | triage | members
//   Read-backs (also a dry run unless --execute):
//     verify-comment   --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE]
//                      [--author [USER_ID]]   (then only a comment by that Linear user counts)
//     verify-state     --issue [ISSUE_ID] --state "[STATE_NAME]"
//     verify-labels    --issue [ISSUE_ID] --has [LABEL_NAME]
//     verify-trashed   --issue [ISSUE_ID]
//     verify-snoozed   --issue [ISSUE_ID]   (snoozedUntilAt is later than the time of the read)
//     verify-suspended --user [USER_ID]
//
// Environment, read only under --execute and only after the request is allowed:
//   LINEAR_API_KEY  a personal API key, sent as "Authorization: <key>" with no Bearer
//                   prefix (Linear's SDK source, @linear/sdk 99.0.0).
//   LINEAR_ORG      the workspace URL key ([@Aegion_LINEAR_ORG]). Every document also
//                   reads organization { urlKey }; a response from another workspace
//                   returns no data (exit 3).
//
// Exit codes: 0 read or verified; 1 refused, input error or missing credentials;
// 2 the read failed or a verify-* read did not prove the write; 3 another workspace.
//
// Facts the lane could not confirm (vendor pages unreachable, docs/aegis/lanes/g2.md),
// and the safer reading taken here:
//   - issue(id:) is described in the schema as taking "the identifier of the issue",
//     which suggests but does not prove it accepts [ISSUE_ID]. Every verify-* checks
//     that the issue in the response is the issue asked for; any other is not proof.
// Schema fact this file depends on: the root users() query returns disabled or
// suspended users only with includeDisabled: true (its default is false, Linear's
// schema.graphql, Query.users), so AegisMembers sets it; without it a suspended member
// is never listed and verify-suspended could never pass. A member who is still not in
// the list is not proof of suspension.

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  STATES, RefusedError, TripwireError,
  defineAdapter, createClient, renderResult, exitCodeFor, parseArgs, scanUntrusted,
} = require('./readonly-contract.js');

// ── The allow-list: the lane's seven query documents ────────────────────────
// Each ends by reading organization { urlKey } at its root, so every response names
// its workspace and the contract can refuse one from another workspace.
const ORG_TAIL = ' organization { urlKey } }';
const DOCUMENTS = Object.freeze({
  AegisViewer: 'query AegisViewer { viewer { id admin guest owner organization { urlKey } } organization { urlKey } }',
  AegisIssue: 'query AegisIssue($id: String!) { issue(id: $id) { id identifier title priority priorityLabel createdAt archivedAt trashed triagedAt snoozedUntilAt slaType slaStartedAt slaBreachesAt state { name type } labels(first: 100) { nodes { id name } pageInfo { hasNextPage } } assignee { id } team { key } } organization { urlKey } }',
  AegisIssueComments: 'query AegisIssueComments($id: String!, $after: String) { issue(id: $id) { identifier comments(first: 50, after: $after) { nodes { id body createdAt user { id } } pageInfo { hasNextPage endCursor } } } organization { urlKey } }',
  AegisTeamStates: 'query AegisTeamStates($teamKey: String!) { workflowStates(first: 100, filter: { team: { key: { eq: $teamKey } } }) { nodes { id name type position team { key } } pageInfo { hasNextPage } } organization { urlKey } }',
  AegisLabels: 'query AegisLabels { issueLabels(first: 100) { nodes { id name isGroup retiredAt parent { name } team { key } } pageInfo { hasNextPage endCursor } } organization { urlKey } }',
  AegisTriage: 'query AegisTriage { issues(first: 50, filter: { state: { type: { eq: "triage" } } }) { nodes { id identifier title priority createdAt startedTriageAt snoozedUntilAt team { key } state { name type } } pageInfo { hasNextPage endCursor } } organization { urlKey } }',
  AegisMembers: 'query AegisMembers($after: String) { users(first: 100, after: $after, includeArchived: true, includeDisabled: true) { nodes { id active admin guest owner } pageInfo { hasNextPage endCursor } } organization { urlKey } }',
});

// Write mutations refused by name as well (defence in depth beside the contract's
// mutation scanner and byte-equal document check). The first sixteen are the lane's
// list; the rest are further writes in Linear's schema (lane research, schema.graphql).
const expand = (stem, verbs) => verbs.map((verb) => `${stem}${verb}`);
const WRITE_MUTATIONS = Object.freeze([
  'commentCreate', 'commentUpdate', 'commentDelete', 'issueCreate', 'issueUpdate', 'issueBatchUpdate',
  'issueArchive', 'issueDelete', 'issueAddLabel', 'issueRemoveLabel', 'userSuspend', 'userUnsuspend',
  'userChangeRole', 'userRevokeAllSessions', 'organizationUpdate', 'teamDelete',
  'commentResolve', 'commentUnresolve', 'issueBatchCreate', 'issueUnarchive', 'issueShare', 'issueUnshare',
  ...expand('issueLabel', ['Create', 'Update', 'Delete', 'Retire', 'Restore']),
  ...expand('issueRelation', ['Create', 'Update', 'Delete']),
  ...expand('workflowState', ['Create', 'Update', 'Archive']),
  ...expand('triageResponsibility', ['Create', 'Update', 'Delete']),
  ...expand('template', ['Create', 'Update', 'Delete']),
  ...expand('emailIntakeAddress', ['Create', 'Update', 'Rotate', 'Delete']),
  ...expand('attachment', ['Create', 'Update', 'Delete']),
  'teamCreate', 'teamUpdate', ...expand('teamMembership', ['Create', 'Update', 'Delete']),
  'userUpdate', 'userRevokeSession', 'userUnlinkFromIdentityProvider', 'organizationDelete',
  ...expand('organizationInvite', ['Create', 'Update', 'Delete']),
  ...expand('organizationDomain', ['Create', 'Claim', 'Verify', 'Update', 'Delete']),
  ...expand('oauthApplication', ['Create', 'Update', 'Archive', 'RotateSecret', 'RotateWebhookSecret']),
  ...expand('webhook', ['Create', 'Update', 'Delete', 'RotateSecret']),
]);
const WRITE_NAMES = new Set(WRITE_MUTATIONS);

// Build-time check: no document names a write (or any integration* mutation), and
// every document reads organization { urlKey } at its root.
function checkDocuments(documents) {
  for (const [name, doc] of Object.entries(documents)) {
    for (const token of doc.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []) {
      if (WRITE_NAMES.has(token) || /^integration[A-Z]/.test(token)) throw new Error(`document ${name} names the write mutation ${token}; this adapter reads only`);
    }
    if (!doc.endsWith(ORG_TAIL)) throw new Error(`document ${name} must end by reading organization { urlKey } at its root`);
  }
  return true;
}

// The workspace keys a response names. An answer whose data is null and that carries
// GraphQL errors holds no record to bind; it is reported as a failed read below.
function collectTenant(json) {
  if (!json || typeof json !== 'object') throw new Error('no JSON object');
  const data = json.data;
  if (data === null || data === undefined) {
    if (Array.isArray(json.errors) && json.errors.length) return [];
    throw new Error('no data');
  }
  if (typeof data !== 'object' || Array.isArray(data)) throw new Error('data is not an object');
  const keys = [];
  if (!data.organization || typeof data.organization.urlKey !== 'string') throw new Error('organization.urlKey missing');
  keys.push(data.organization.urlKey);
  if (data.viewer !== undefined && data.viewer !== null) {
    const viewerOrg = data.viewer.organization;
    if (!viewerOrg || typeof viewerOrg.urlKey !== 'string') throw new Error('viewer organization.urlKey missing');
    keys.push(viewerOrg.urlKey);
  }
  return keys;
}

const SPEC = defineAdapter({
  platform: 'linear',
  host: { fixed: 'api.linear.app' },
  credentials: ['LINEAR_API_KEY'],
  auth: (creds) => ({ Authorization: creds.LINEAR_API_KEY }),
  routes: {},
  graphql: { path: '/graphql', documents: DOCUMENTS },
  tenant: { env: 'LINEAR_ORG', collect: collectTenant },
});
checkDocuments(SPEC.graphql.documents);

// ── The ticket note and its digest ───────────────────────────────────────────
const NOTE_MAX_BYTES = 64 * 1024; // Aegis's own cap for a ticket note, not a Linear limit
const NOT_BEFORE_MARGIN_MS = 10 * 60 * 1000; // allows for a clock difference
// A note file is read only when all four hold, for the path given and for the file it
// resolves to: (1) its name ends in .md or .txt (an allow-list: a private key, an AWS
// credentials file or a JSON key file has another name, so it is never read as a note);
// (2) no folder on the way is one that holds keys or tool settings; (3) the file it
// resolves to sits under a note root: this repo's tasks/ folder or the system temporary
// folder; (4) no line of the body is one the commit scanner would block (next function).
// Rule 3 is the one that keeps a path taken from ticket text (a passwords.txt on the
// Desktop, a copied .env saved as .md) out of the transcript: (1), (2) and (4) cannot
// tell a password written in plain words from note text, so only where the file lives
// can. A file someone puts under a note root is printed in full; keep only notes there.
const NOTE_FILE_NAME = /^[^/\\]+\.(?:md|txt)$/i;
const REFUSED_NOTE_FOLDERS = new Set(['.ssh', '.aws', '.config', '.gnupg', '.claude']);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const defaultNoteRoots = () => [path.join(REPO_ROOT, 'tasks'), os.tmpdir()];

// The commit scanner (scripts/pre-commit-check.js, canonical) exports safeDisplayPath,
// which returns "[REDACTED_FILE_PATH]" for any string that carries one of its BLOCK
// patterns: a credential or secret format (private key block, GitHub, Slack, Google or
// Okta token, JWT, Authorization header), a real email address, a phone number, a
// privileged host path or a control character. A note line it would redact is never
// printed. Loaded only for note and digest, so the read commands never load it.
function blockedNoteLine(body) {
  const { safeDisplayPath } = require('../pre-commit-check.js');
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const probe = lines[i].replace(/\t/g, ' '); // a tab is layout, not a secret
    if (safeDisplayPath(probe, []) !== probe) return i + 1;
  }
  return 0;
}

function refusedNotePath(file, how) {
  if (!NOTE_FILE_NAME.test(path.basename(file))) return `--body-file ${how} a file that is not .md or .txt; a ticket note is a plain text file`;
  const folders = path.resolve(file).split(/[/\\]+/).slice(0, -1);
  if (folders.some((name) => REFUSED_NOTE_FOLDERS.has(name.toLowerCase()))) return `--body-file ${how} a file inside a key or settings folder (.ssh, .aws, .config, .gnupg or .claude); a ticket note does not live there`;
  return null;
}

// True when the resolved file sits below one of the note roots (each root resolved too,
// so a link to the temporary folder, as on macOS, still counts). A root that does not
// exist holds nothing.
function underNoteRoot(realFile, roots) {
  return roots.some((root) => {
    let base;
    try { base = fs.realpathSync(root); } catch { return false; }
    const rel = path.relative(base, realFile);
    return rel !== '' && !path.isAbsolute(rel) && rel.split(/[/\\]+/)[0] !== '..';
  });
}

// CRLF to LF, trailing spaces removed from each line, trailing newlines removed.
function normaliseBody(text) {
  return String(text).replace(/\r\n/g, '\n').split('\n').map((line) => line.replace(/ +$/, '')).join('\n').replace(/\n+$/, '');
}

function noteDigest(text) {
  return crypto.createHash('sha256').update(normaliseBody(text), 'utf8').digest('hex');
}

function readNote(file, roots) {
  if (typeof file !== 'string' || !file || /[\u0000-\u001f\u007f]/.test(file)) throw new RefusedError('--body-file must be a file path');
  const named = refusedNotePath(file, 'names');
  if (named) throw new RefusedError(named);
  let text;
  try {
    // A link is judged by the file it points to as well, so a note.md that links to a
    // key file, into a key folder, or out of the note roots is refused before a byte of
    // it is read.
    const real = fs.realpathSync(file);
    const target = refusedNotePath(real, 'points to');
    if (target) throw new RefusedError(target);
    if (!underNoteRoot(real, roots)) {
      throw new RefusedError('--body-file is outside this repo\'s tasks/ folder and the system temporary folder; save the note in one of them and run note again (a path taken from a ticket is never read)');
    }
    const stat = fs.statSync(file);
    if (!stat.isFile()) throw new RefusedError('--body-file is not a regular file');
    if (stat.size > NOTE_MAX_BYTES) throw new RefusedError(`--body-file is larger than ${NOTE_MAX_BYTES} bytes; a ticket note is shorter`);
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error instanceof RefusedError) throw error;
    throw new RefusedError('--body-file could not be read');
  }
  if (text.includes('\u0000')) throw new RefusedError('--body-file is not a text file');
  const body = normaliseBody(text);
  if (!body.trim()) throw new RefusedError('the note is empty');
  const line = blockedNoteLine(body);
  if (line) throw new RefusedError(`line ${line} of the note matches a pattern the commit scanner blocks (a secret, a credential, a real email address, a phone number or a privileged host path); the note is not printed. Remove it and say where the secret is kept instead`);
  return body;
}

function noteText(issue, body, digest, notBefore) {
  const lines = [
    'PREVIEW ONLY: Aegis does not post this note. A human posts it in Linear (Aegis advises; humans execute).',
    `Issue: ${issue}`,
    '----- note body: paste exactly the text between these two lines -----',
    body,
    '----- end of note body -----',
    `Note SHA-256: ${digest}`,
    '  (over the body with CRLF turned to LF, trailing spaces removed from each line and trailing newlines removed)',
    `Not before: ${notBefore}`,
    '  (10 minutes before this preview, to allow for a clock difference; the read-back counts only comments created at or after it)',
    '',
    'HUMAN-RUN posting steps (you post the note yourself; Aegis never writes to Linear):',
    `  1. In Linear, open issue ${issue}.`,
    '  2. Click the comment box at the bottom of the issue ("Leave a comment...") and paste the note body above, unedited.',
    '  3. Post it with the Comment button (or Cmd/Ctrl+Enter). A comment is not saved as a draft, so post it before leaving the page.',
    '  The labels above are read from Linear\'s search-indexed help page (linear.app/docs/comment-on-issues); confirm them on screen.',
    '  On an issue that came in through Asks or email intake, the comment may also reach the requester and cannot be called back.',
    '',
    'Read-back, after posting (it reads the comments; it posts nothing):',
    `  node scripts/adapters/linear-client.js verify-comment --issue ${issue} --expect-sha256 ${digest} --not-before ${notBefore} --execute`,
  ];
  for (const flag of scanUntrusted(body, '$.note')) {
    lines.push(`WARNING: the note carries instruction-like text [${flag.markers.join(', ')}] ${flag.quote}. Review it before posting; Aegis did not act on it.`);
  }
  return `${lines.join('\n')}\n`;
}

// ── Commands ─────────────────────────────────────────────────────────────────
const ISSUE_ID = /^[A-Za-z][A-Za-z0-9_]{0,15}-[1-9][0-9]{0,8}$/;
const TEAM_KEY = /^[A-Za-z][A-Za-z0-9_]{0,15}$/;
const USER_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
// A DateTime value is read as a time only in ISO 8601 form, with a Z or a numeric offset.
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const CURSOR = /^[A-Za-z0-9_=+/:.-]{1,256}$/;
const MAX_PAGES = 20;
const MAX_LISTED = 20;

const VALUE_FLAGS = ['issue', 'body-file', 'team', 'expect-sha256', 'not-before', 'state', 'has', 'user', 'author'];

const COMMANDS = Object.freeze({
  viewer: { kind: 'read', document: 'AegisViewer', flags: [], variables: () => ({}) },
  issue: { kind: 'read', document: 'AegisIssue', flags: ['issue'], variables: (a) => ({ id: a.issue }) },
  comments: { kind: 'read', document: 'AegisIssueComments', flags: ['issue'], variables: (a) => ({ id: a.issue }) },
  states: { kind: 'read', document: 'AegisTeamStates', flags: ['team'], variables: (a) => ({ teamKey: a.team }) },
  labels: { kind: 'read', document: 'AegisLabels', flags: [], variables: () => ({}) },
  triage: { kind: 'read', document: 'AegisTriage', flags: [], variables: () => ({}) },
  members: { kind: 'read', document: 'AegisMembers', flags: [], variables: () => ({}) },
  'verify-comment': { kind: 'verify', document: 'AegisIssueComments', flags: ['issue', 'expect-sha256', 'not-before'], optional: ['author'], variables: (a) => ({ id: a.issue }),
    expected: (a) => ({ issue: a.issue, sha256: a.sha256, notBefore: a.notBefore, ...(a.author ? { author: a.author } : {}) }) },
  'verify-state': { kind: 'verify', document: 'AegisIssue', flags: ['issue', 'state'], variables: (a) => ({ id: a.issue }), expected: (a) => ({ issue: a.issue, state: a.state }) },
  'verify-labels': { kind: 'verify', document: 'AegisIssue', flags: ['issue', 'has'], variables: (a) => ({ id: a.issue }), expected: (a) => ({ issue: a.issue, label: a.label }) },
  'verify-trashed': { kind: 'verify', document: 'AegisIssue', flags: ['issue'], variables: (a) => ({ id: a.issue }), expected: (a) => ({ issue: a.issue, trashed: true }) },
  'verify-snoozed': { kind: 'verify', document: 'AegisIssue', flags: ['issue'], variables: (a) => ({ id: a.issue }), expected: (a) => ({ issue: a.issue, snoozedUntilAt: 'later than readAt, the time of the read' }) },
  'verify-suspended': { kind: 'verify', document: 'AegisMembers', flags: ['user'], variables: () => ({}), expected: (a) => ({ user: a.user, active: false }) },
  note: { kind: 'offline', flags: ['issue', 'body-file'] },
  digest: { kind: 'offline', flags: ['body-file'] },
});

const USAGE = [
  'Usage: node scripts/adapters/linear-client.js <command> [flags] [--execute]',
  '  Offline:   note --issue [ISSUE_ID] --body-file [NOTE_FILE] | digest --body-file [NOTE_FILE]',
  '  Reads:     viewer | issue --issue [ISSUE_ID] | comments --issue [ISSUE_ID] | states --team [@Aegion_LINEAR_TEAM] | labels | triage | members',
  '  Verify:    verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --not-before [NOT_BEFORE] [--author [USER_ID]]',
  '             verify-state --issue [ISSUE_ID] --state "[STATE_NAME]" | verify-labels --issue [ISSUE_ID] --has [LABEL_NAME]',
  '             verify-trashed --issue [ISSUE_ID] | verify-snoozed --issue [ISSUE_ID] | verify-suspended --user [USER_ID]',
  'Reads and read-backs are a dry run unless the bare --execute flag is given. No command writes to Linear.',
  '',
].join('\n');

function plainName(value, flag) {
  if (typeof value !== 'string' || !value.trim() || value.length > 80 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new RefusedError(`--${flag} must be a name of 1 to 80 printable characters`);
  }
  return value;
}

// Every flag is checked before a client exists, so bad input reads and sends nothing.
function validate(command, def, args) {
  for (const key of Object.keys(args)) {
    if (key === '_command' || key === 'execute') continue;
    if (!def.flags.includes(key) && !(def.optional || []).includes(key)) throw new RefusedError(`--${key} does not apply to ${command}`);
  }
  for (const flag of def.flags) if (args[flag] === undefined) throw new RefusedError(`${command} needs --${flag}`);
  if (def.kind === 'offline' && args.execute) {
    throw new RefusedError(`${command} is offline and never posts: Aegis does not write to Linear. Run it without --execute and post the note yourself with the HUMAN-RUN steps it prints`);
  }
  const a = {};
  if (args.issue !== undefined) {
    if (!ISSUE_ID.test(args.issue)) throw new RefusedError('--issue must be a Linear issue identifier: a team key, a hyphen and a number, such as [@Aegion_LINEAR_TEAM]-123');
    a.issue = args.issue;
  }
  if (args.team !== undefined) {
    if (!TEAM_KEY.test(args.team)) throw new RefusedError('--team must be a Linear team key (letters and digits, starting with a letter)');
    a.team = args.team;
  }
  if (args.user !== undefined) {
    if (!USER_ID.test(args.user)) throw new RefusedError('--user must be a Linear user ID');
    a.user = args.user;
  }
  if (args.author !== undefined) {
    if (!USER_ID.test(args.author)) throw new RefusedError('--author must be a Linear user ID (the viewer read prints yours)');
    a.author = args.author;
  }
  if (args['expect-sha256'] !== undefined) {
    if (!SHA256_HEX.test(args['expect-sha256'])) throw new RefusedError('--expect-sha256 must be the 64-character lower-case hex digest that note printed');
    a.sha256 = args['expect-sha256'];
  }
  if (args['not-before'] !== undefined) {
    if (!ISO_UTC.test(args['not-before']) || !Number.isFinite(Date.parse(args['not-before']))) {
      throw new RefusedError('--not-before must be the ISO 8601 UTC time that note printed, such as 2026-01-31T09:30:00.000Z');
    }
    a.notBefore = args['not-before'];
  }
  if (args.state !== undefined) a.state = plainName(args.state, 'state');
  if (args.has !== undefined) a.label = plainName(args.has, 'has');
  if (args['body-file'] !== undefined) a.bodyFile = args['body-file'];
  return a;
}

// ── Reads ────────────────────────────────────────────────────────────────────
// A 200 answer may still carry GraphQL errors. Its data is then not used, and only
// the short error type codes are printed (the messages are vendor text, withheld).
function graphqlFailure(res) {
  const json = res.data;
  const errors = json ? json.errors : undefined;
  const hasErrors = errors !== undefined && errors !== null && !(Array.isArray(errors) && errors.length === 0);
  if (!hasErrors) {
    if (!json || !json.data || typeof json.data !== 'object') return { state: STATES.INVALID_RESPONSE, ok: false, status: res.status, attempts: res.attempts, error: 'the response holds no data object' };
    return null;
  }
  const list = Array.isArray(errors) ? errors : [errors];
  const types = [...new Set(list.map((e) => {
    const type = e && e.extensions && e.extensions.type;
    return typeof type === 'string' && /^[a-z][a-z ]{0,39}$/.test(type) ? type : 'unlisted';
  }))];
  return {
    state: STATES.INVALID_RESPONSE, ok: false, status: res.status, attempts: res.attempts,
    error: `the GraphQL response carries ${list.length} error(s); no data is used (messages withheld)`,
    graphqlErrorTypes: types,
  };
}

async function readOnce(client, command, document, variables) {
  const res = await client.graphql(document, variables);
  if (!res.ok) return { command, ...res };
  const failure = graphqlFailure(res);
  if (failure) return { command, ...failure };
  const out = { state: STATES.OK, ok: true, command, status: res.status, attempts: res.attempts, data: res.data.data };
  if (res.flags && res.flags.length) out.flags = res.flags;
  return out;
}

function verdict(command, verified, expected, observed, reason, flags) {
  const out = { state: STATES.OK, ok: true, command, verified, expected, observed };
  if (!verified) out.reason = reason;
  if (flags && flags.length) out.flags = flags;
  return out;
}

const sameIssue = (node, issue) => typeof node.identifier === 'string' && node.identifier.toUpperCase() === issue.toUpperCase();
const orNull = (value) => (value === undefined ? null : value);

// One AegisIssue read, then a check of the issue it returned against the one asked for.
async function issueVerify(client, command, a, judge) {
  const expected = COMMANDS[command].expected(a);
  const res = await readOnce(client, command, 'AegisIssue', { id: a.issue });
  if (!res.ok) return res;
  const node = res.data.issue;
  if (!node || typeof node !== 'object') return verdict(command, false, expected, { issue: null }, 'the response holds no issue', res.flags);
  const { verified, observed, reason } = judge(node);
  const seen = { issue: orNull(node.identifier), ...observed };
  if (!sameIssue(node, a.issue)) return verdict(command, false, expected, seen, 'the issue in the response is not the issue asked for', res.flags);
  return verdict(command, verified, expected, seen, reason, res.flags);
}

// Read a connection page by page (at most MAX_PAGES), stopping when visit() says so.
async function paged(client, command, document, baseVariables, visit) {
  const flags = [];
  let after = null;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await readOnce(client, command, document, after ? { ...baseVariables, after } : { ...baseVariables });
    if (!res.ok) return { failed: res };
    for (const f of res.flags || []) flags.push({ ...f, path: `page ${page} ${f.path}` });
    const step = visit(res.data, page);
    if (step.done) return { flags, ...step };
    const info = step.pageInfo || {};
    if (info.hasNextPage !== true) return { flags, done: false, reason: step.lastReason };
    if (typeof info.endCursor !== 'string' || !CURSOR.test(info.endCursor)) return { flags, done: false, reason: 'the response gave no usable cursor for the next page' };
    after = info.endCursor;
  }
  return { flags, done: false, reason: `stopped after ${MAX_PAGES} pages without proof` };
}

async function verifyComment(client, a) {
  const command = 'verify-comment';
  const expected = COMMANDS[command].expected(a);
  const notBeforeMs = Date.parse(a.notBefore);
  const observed = { issue: null, pagesRead: 0, commentsRead: 0, match: null, commentsSinceNotBefore: [] };
  const walk = await paged(client, command, 'AegisIssueComments', { id: a.issue }, (data, page) => {
    observed.pagesRead = page;
    const issue = data.issue;
    if (!issue || typeof issue !== 'object') return { done: true, verified: false, reason: 'the response holds no issue' };
    observed.issue = orNull(issue.identifier);
    if (!sameIssue(issue, a.issue)) return { done: true, verified: false, reason: 'the issue in the response is not the issue asked for' };
    const conn = issue.comments || {};
    for (const c of Array.isArray(conn.nodes) ? conn.nodes : []) {
      if (!c || typeof c !== 'object') continue;
      observed.commentsRead += 1;
      const created = typeof c.createdAt === 'string' ? Date.parse(c.createdAt) : NaN;
      if (!Number.isFinite(created) || created < notBeforeMs) continue;
      const summary = { id: orNull(c.id), createdAt: c.createdAt, userId: c.user && c.user.id !== undefined ? c.user.id : null, sha256: typeof c.body === 'string' ? noteDigest(c.body) : null };
      // With --author, a comment by anyone else, or by no user (Comment.user is null
      // for comments created by integrations or bots, schema), is listed but is never
      // proof, even with the right text.
      if (summary.sha256 === a.sha256 && (!a.author || summary.userId === a.author)) {
        observed.match = summary;
        return { done: true, verified: true };
      }
      if (observed.commentsSinceNotBefore.length < MAX_LISTED) observed.commentsSinceNotBefore.push(summary);
    }
    const by = a.author ? ` by ${a.author}` : '';
    return { done: false, pageInfo: conn.pageInfo, lastReason: `no comment created at or after ${a.notBefore}${by} has the expected SHA-256` };
  });
  if (walk.failed) return walk.failed;
  return verdict(command, walk.verified === true, expected, observed, walk.reason, walk.flags);
}

async function verifySuspended(client, a) {
  const command = 'verify-suspended';
  const expected = COMMANDS[command].expected(a);
  const observed = { user: a.user, found: false, active: null, admin: null, guest: null, owner: null, pagesRead: 0, membersRead: 0 };
  const walk = await paged(client, command, 'AegisMembers', {}, (data, page) => {
    observed.pagesRead = page;
    const conn = data.users || {};
    for (const n of Array.isArray(conn.nodes) ? conn.nodes : []) {
      if (!n || typeof n !== 'object') continue;
      observed.membersRead += 1;
      if (n.id !== a.user) continue;
      Object.assign(observed, { found: true, active: orNull(n.active), admin: orNull(n.admin), guest: orNull(n.guest), owner: orNull(n.owner) });
      if (n.active === false) return { done: true, verified: true };
      return { done: true, verified: false, reason: n.active === true ? 'the member is active' : 'the read gave no active value for the member' };
    }
    return {
      done: false, pageInfo: conn.pageInfo,
      lastReason: `the user is not among the ${observed.membersRead} member record(s) read; a member missing from the list is not proof of suspension`,
    };
  });
  if (walk.failed) return walk.failed;
  return verdict(command, walk.verified === true, expected, observed, walk.reason, walk.flags);
}

const VERIFY = {
  'verify-comment': verifyComment,
  'verify-suspended': verifySuspended,
  'verify-state': (client, a) => issueVerify(client, 'verify-state', a, (n) => {
    const state = n.state && typeof n.state === 'object' ? { name: orNull(n.state.name), type: orNull(n.state.type) } : null;
    const verified = !!state && state.name === a.state;
    return { verified, observed: { state }, reason: 'the issue is not in the expected state (names match exactly)' };
  }),
  'verify-labels': (client, a) => issueVerify(client, 'verify-labels', a, (n) => {
    const conn = n.labels && typeof n.labels === 'object' ? n.labels : {};
    const labels = (Array.isArray(conn.nodes) ? conn.nodes : []).map((l) => (l && typeof l.name === 'string' ? l.name : null)).filter((name) => name !== null);
    const more = !!(conn.pageInfo && conn.pageInfo.hasNextPage === true);
    const verified = labels.includes(a.label);
    return {
      verified, observed: { labels, moreLabelPages: more },
      reason: more ? 'the label is not among the first 100 labels and the issue has more; check it on screen' : 'the issue does not carry the label (names match exactly)',
    };
  }),
  'verify-trashed': (client, a) => issueVerify(client, 'verify-trashed', a, (n) => ({
    verified: n.trashed === true,
    observed: { trashed: orNull(n.trashed), archivedAt: orNull(n.archivedAt) },
    reason: 'the issue is not in the trash',
  })),
  // A snooze is proved by Issue.snoozedUntilAt ("the time until an issue will be snoozed
  // in Triage view", schema) being later than the moment of the read. The person then
  // compares the printed value with the [DATE_TIME] typed in the gate phrase.
  'verify-snoozed': (client, a, now) => issueVerify(client, 'verify-snoozed', a, (n) => {
    const readAtMs = Math.floor(now());
    const until = typeof n.snoozedUntilAt === 'string' && ISO_DATE_TIME.test(n.snoozedUntilAt) ? Date.parse(n.snoozedUntilAt) : NaN;
    const state = n.state && typeof n.state === 'object' ? { name: orNull(n.state.name), type: orNull(n.state.type) } : null;
    return {
      verified: Number.isFinite(until) && until > readAtMs,
      observed: { snoozedUntilAt: orNull(n.snoozedUntilAt), readAt: new Date(readAtMs).toISOString(), state },
      reason: n.snoozedUntilAt === null || n.snoozedUntilAt === undefined ? 'the issue is not snoozed (snoozedUntilAt is empty)' : 'snoozedUntilAt is not a time later than the read',
    };
  }),
};

// ── CLI ──────────────────────────────────────────────────────────────────────
function offline(command, a, now, out, roots) {
  const body = readNote(a.bodyFile, roots);
  const digest = noteDigest(body);
  if (command === 'digest') {
    out(renderResult({ state: STATES.OK, ok: true, command, sha256: digest, normalisation: 'CRLF to LF, trailing spaces removed from each line, trailing newlines removed' }));
    return 0;
  }
  const notBefore = new Date(Math.max(0, Math.floor(now()) - NOT_BEFORE_MARGIN_MS)).toISOString();
  out(noteText(a.issue, body, digest, notBefore));
  return 0;
}

async function run(argv, env = process.env, deps = {}) {
  const out = deps.out || ((s) => process.stdout.write(s));
  const err = deps.err || ((s) => process.stderr.write(s));
  const now = deps.now || Date.now;
  try {
    const args = parseArgs(Array.isArray(argv) ? argv : [], { values: VALUE_FLAGS });
    const command = args._command;
    if (command === 'help' || command === '--help' || command === '-h') { out(USAGE); return 0; }
    if (typeof command !== 'string' || !Object.prototype.hasOwnProperty.call(COMMANDS, command)) {
      err(USAGE);
      throw new RefusedError(command === undefined ? 'no command given' : 'unknown command; no command writes to Linear');
    }
    const def = COMMANDS[command];
    const a = validate(command, def, args);
    // deps.noteRoots exists for the tests; the CLI always uses this repo's tasks/ folder
    // and the system temporary folder.
    if (def.kind === 'offline') return offline(command, a, now, out, Array.isArray(deps.noteRoots) ? deps.noteRoots : defaultNoteRoots());

    // The client only ever sees this view of the environment. It remembers the key
    // the contract read, so the printed output is redacted with it too; this file
    // never reads the key itself.
    const seen = [];
    const envView = new Proxy(env, {
      get(target, name) {
        const value = Reflect.get(target, name);
        if (name === 'LINEAR_API_KEY' && typeof value === 'string' && value && !seen.includes(value)) seen.push(value);
        return value;
      },
    });
    const client = createClient(SPEC, { env: envView, transport: deps.transport, sleep: deps.sleep, now: deps.now, timeoutMs: deps.timeoutMs, maxRetries: deps.maxRetries });
    const variables = def.variables(a);

    if (args.execute !== true) {
      const plan = client.planGraphql(def.document, variables);
      if (!plan.ok) { err(renderResult({ command, ...plan })); return exitCodeFor(plan); }
      const shown = { ...plan, command, query: SPEC.graphql.documents[def.document] };
      if (def.kind === 'verify') {
        shown.expected = def.expected(a);
        if (command === 'verify-comment' || command === 'verify-suspended') shown.pages = `up to ${MAX_PAGES}, each the same document with the after cursor`;
      }
      shown.next = 'Add --execute to perform this read.';
      out(renderResult(shown));
      return 0;
    }

    const res = def.kind === 'read' ? await readOnce(client, command, def.document, variables) : await VERIFY[command](client, a, now);
    const code = exitCodeFor(res);
    (code === 1 ? err : out)(renderResult(res, { secrets: seen }));
    return code;
  } catch (error) {
    if (error instanceof TripwireError || (error && error.name === 'NetworkTripwireError')) throw error;
    if (error instanceof RefusedError) {
      err(renderResult({ state: STATES.REFUSED, ok: false, error: error.message }));
      return 1;
    }
    err(renderResult({ state: STATES.INVALID_RESPONSE, ok: false, error: 'unexpected adapter error (details withheld)' }));
    return 2;
  }
}

if (require.main === module) {
  run(process.argv.slice(2), process.env).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(error && error.name === 'NetworkTripwireError' ? 'Network tripwire fired\n' : 'linear-client: unexpected error (details withheld)\n');
    process.exitCode = 2;
  });
}

module.exports = { SPEC, run, WRITE_MUTATIONS, checkDocuments, normaliseBody, noteDigest, defaultNoteRoots };
