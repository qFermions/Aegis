'use strict';
// intake.js: one intake for a Linear issue, a GitHub issue, a Slack thread export and an
// email file (batch G3, task 4a). Each becomes one case in the graph engine's INTAKE node
// (scripts/graph/engine.js newState) with its source, provenance external_content and an
// intake record: how it arrived, its origin id, the raw input's SHA-256, the tenant binding
// and how many values were redacted. Every field is data; nothing in it is followed.
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). The intake reads: a file, or one
// Linear GraphQL query through linear-client.js. It writes nothing unless --save is given,
// and then only the case's state.json where graph-cli.js finds it.
//
// Usage: node scripts/intake/intake.js <linear|github|slack|email> --file <path> [--save]
//        node scripts/intake/intake.js linear --issue [ISSUE_ID] [--execute] [--save]
// Exit: 0 ACCEPTED (or a dry run) · 1 OVERSIZED, MALFORMED, EMPTY, BLOCKED or usage ·
//       2 READ_FAILED · 3 TENANT_UNBOUND or TENANT_MISMATCH.
// Formats and environment: scripts/intake/README.md.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const engine = require('../graph/engine.js');
const sanitize = require('../graph/sanitize.js');
const { PHONE_LITERAL, findEmails, replaceEmails } = require('../tier/tier-guard.js');
const { createClient } = require('../adapters/readonly-contract.js');
const { cliDeps } = require('../adapters/cli-support.js');
const { operatorMessage } = require('../adapters/operator-message.js');
const linear = require('../adapters/linear-client.js');

const LIMITS = Object.freeze({
  MAX_RAW_BYTES: 512 * 1024, // the raw file or answer, checked before it is parsed
  MAX_TEXT_CHARS: 20000, // the ticket text the case carries
  MAX_COMMENTS: 50, // comments or replies kept, in order
  MAX_MIME_DEPTH: 5, // nested multipart levels in an email
  MAX_MIME_PARTS: 50, // MIME parts in an email
});

const STATES = Object.freeze({
  ACCEPTED: 'ACCEPTED', OVERSIZED: 'OVERSIZED', MALFORMED: 'MALFORMED', EMPTY: 'EMPTY',
  TENANT_UNBOUND: 'TENANT_UNBOUND', TENANT_MISMATCH: 'TENANT_MISMATCH', BLOCKED: 'BLOCKED',
  READ_FAILED: 'READ_FAILED', DRY_RUN: 'DRY_RUN',
});

const EXIT = Object.freeze({
  ACCEPTED: 0, DRY_RUN: 0, OVERSIZED: 1, MALFORMED: 1, EMPTY: 1, BLOCKED: 1, READ_FAILED: 2, TENANT_UNBOUND: 3, TENANT_MISMATCH: 3,
});

// Per source: the tenant variable, its placeholder, what the item is called, the tenant
// unit, and the shape the variable must have.
const SOURCES = Object.freeze({
  linear: { env: 'LINEAR_ORG', token: '[@Aegion_LINEAR_ORG]', label: 'Linear issue', unit: 'workspace', via: 'export-file', shape: /^[a-z0-9][a-z0-9-]{0,63}$/i },
  github: { env: 'GITHUB_ORG', token: '[@Aegion_GITHUB_ORG]', label: 'GitHub issue', unit: 'organization', via: 'export-file', shape: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/ },
  slack: { env: 'SLACK_TEAM_ID', token: '[@Aegion_SLACK_TEAM_ID]', label: 'Slack thread', unit: 'workspace', via: 'export-file', shape: /^[TE][A-Z0-9]{2,20}$/ },
  email: { env: 'AEGION_DOMAIN', token: '[@Aegion_DOMAIN]', label: 'email', unit: 'domain', via: 'eml-file', shape: /^(?=.{3,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i },
});

const LINEAR_ISSUE_ID = /^(?:[A-Za-z][A-Za-z0-9]{0,9}-[0-9]{1,9}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

class IntakeError extends Error {
  constructor(state, reason) { super(reason); this.state = state; this.reason = reason; }
}
const malformed = (reason) => { throw new IntakeError(STATES.MALFORMED, reason); };

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string';

// ── The record every state returns ───────────────────────────────────────────

const NEXT_STEP = {
  OVERSIZED: 'Nothing was kept. Export a shorter copy (without attachments or long logs), or type the key lines as a ticket, then run the intake again',
  MALFORMED: 'Nothing was kept. Export the item again in the format scripts/intake/README.md names, then run the intake again',
  EMPTY: 'Nothing was kept. Ask the requester what is wrong, or type the ticket',
  BLOCKED: 'Nothing was kept. Ask the sender to remove the credential, and to have it rotated if it was real; then import the item again or type the ticket with placeholders',
};

function failed(state, base, reason, nextStep, extra = {}) {
  return { ...base, state, reason, next_step: nextStep || NEXT_STEP[state], ...extra };
}

function baseRecord(source, via, provenance) {
  const src = SOURCES[source];
  return { schema: 'aegis.intake.v1', state: null, source, tenant: { env: src.env, bound: false }, provenance: { via, ...provenance } };
}

// ── Text clean-up shared by every source ─────────────────────────────────────

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,6});/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : m;
    }
    const v = ENTITIES[e.toLowerCase()];
    return v === undefined ? m : v;
  });
}

const HTML_START = /^<(?:!doctype\b|html\b|head\b|body\b|div\b|p\b|span\b|table\b|br\b|h[1-6]\b|ul\b|ol\b|section\b|article\b|font\b|center\b|blockquote\b|!--)/i;
function isHtmlOnly(s) {
  const t = s.trim();
  return HTML_START.test(t) && t.endsWith('>') && /<\/?[a-z][a-z0-9]*\b[^>]*>/i.test(t);
}

const DROPPED_BLOCKS = new Set(['script', 'style', 'head', 'template', 'noscript']);
const BLOCK_TAGS = new Set(['p', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'ul', 'ol', 'section', 'article', 'blockquote', 'header', 'footer', 'title', 'br']);
// HTML to the text a reader sees, in one pass (every search moves forward, so a hostile
// body cannot make it slow). Script, style and head blocks are dropped (an unclosed one
// runs to the end, as in a browser); an HTML comment is kept as a quoted data line, so
// text hidden there is scanned like the rest. A "<" that starts no tag stays as text.
function htmlToText(html) {
  const s = String(html);
  const lower = s.toLowerCase();
  const comments = [];
  let out = '';
  let i = 0;
  let gt = -1; // the next ">" after the current "<", kept so a run of "<" is not rescanned
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt === -1) { out += s.slice(i); break; }
    out += s.slice(i, lt);
    if (s.startsWith('<!--', lt)) {
      const close = s.indexOf('-->', lt + 4);
      comments.push(s.slice(lt + 4, close === -1 ? s.length : close));
      out += '\n';
      i = close === -1 ? s.length : close + 3;
      continue;
    }
    if (gt <= lt) gt = s.indexOf('>', lt + 1);
    if (gt === -1) { out += s.slice(lt); break; }
    const m = /^\/?([A-Za-z][A-Za-z0-9]{0,15})/.exec(s.slice(lt + 1, Math.min(gt, lt + 20)));
    if (!m) { out += '<'; i = lt + 1; continue; }
    const name = m[1].toLowerCase();
    if (s[lt + 1] !== '/' && DROPPED_BLOCKS.has(name)) {
      const close = lower.indexOf(`</${name}`, gt + 1);
      const end = close === -1 ? -1 : s.indexOf('>', close);
      out += '\n';
      i = end === -1 ? s.length : end + 1;
      continue;
    }
    if (BLOCK_TAGS.has(name)) out += '\n';
    i = gt + 1;
  }
  const lines = decodeEntities(out).split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim()).filter(Boolean);
  for (const c of comments) {
    const quoted = decodeEntities(c).replace(/\s+/g, ' ').trim();
    if (quoted) lines.push(`HTML comment (hidden in the message, kept as data): ${quoted}`);
  }
  return lines.join('\n');
}

// Slack's own markup: <@U..> mentions, <#C..|name> channels, <mailto:..|..> and
// <url|label> links, <!here>; then the three entities Slack escapes.
function slackToText(s, counts) {
  const out = s.replace(/<([^<>\n]{1,500})>/g, (m, inner) => {
    if (/^@[UW][A-Z0-9]{2,20}(?:\|[^>]*)?$/.test(inner)) { counts.mentions += 1; return '[USER_ID]'; }
    if (/^#C[A-Z0-9]{2,20}\|/.test(inner)) return `#${inner.slice(inner.indexOf('|') + 1)}`;
    if (/^#C[A-Z0-9]{2,20}$/.test(inner)) return '[CHANNEL_ID]';
    if (/^!(?:here|channel|everyone)\b/.test(inner)) return `@${inner.slice(1).split('|')[0]}`;
    if (/^!subteam\^/.test(inner)) return inner.includes('|') ? inner.slice(inner.indexOf('|') + 1) : '@group';
    if (/^mailto:/i.test(inner)) return inner.slice(7).split('|')[0];
    if (/^(?:https?|ftp):\/\//i.test(inner)) {
      const [url, label] = inner.split('|');
      return label && label !== url ? `${label} (${url})` : url;
    }
    return m;
  });
  return decodeEntities(out);
}

// One part of the ticket (a title, a body, a comment) as plain text.
function partText(raw, source, counts, flags) {
  let s = isText(raw) ? raw : '';
  if (source === 'slack') s = slackToText(s, counts);
  if (isHtmlOnly(s)) { s = htmlToText(s); flags.html = true; }
  return s.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function render({ title, body, comments }) {
  const head = [title, body].filter((x) => x).join('\n\n');
  const tail = comments.filter((x) => x).map((c, i) => `Comment ${i + 1}: ${c}`).join('\n');
  return [head, tail].filter((x) => x).join('\n\n');
}

// Emails and the tenant's own values first (so the credential scan still sees a
// credential whole), then, after the scan, phone numbers and GitHub @mentions.
const PLACEHOLDER_EMAIL = '[USER@DOMAIN.COM]';
function redactEmails(text, counts) {
  return text.split(PLACEHOLDER_EMAIL).map((piece) => replaceEmails(piece, () => { counts.emails += 1; return PLACEHOLDER_EMAIL; })).join(PLACEHOLDER_EMAIL);
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function redactTenant(text, source, value, counts) {
  if (!value) return text;
  const src = SOURCES[source];
  const v = escapeRe(value);
  const patterns = {
    email: new RegExp(`(?<![A-Za-z0-9-])${v}(?![A-Za-z0-9-])`, 'gi'),
    linear: new RegExp(`(linear\\.app/)${v}(?![A-Za-z0-9-])`, 'gi'),
    github: new RegExp(`(github\\.com/|api\\.github\\.com/repos/|api\\.github\\.com/orgs/)${v}(?![A-Za-z0-9-])`, 'gi'),
    slack: new RegExp(`(?<![A-Za-z0-9])${v}(?![A-Za-z0-9])`, 'g'),
  };
  return text.replace(patterns[source], (m, prefix) => { counts.tenant_values += 1; return `${typeof prefix === 'string' ? prefix : ''}${src.token}`; });
}
function redactPhones(text, counts) {
  const pattern = new RegExp(PHONE_LITERAL.source, 'g');
  return text.replace(pattern, () => { counts.phones += 1; return '[PHONE_NUMBER]'; });
}
function redactGithubMentions(text, counts) {
  return text.replace(/(^|[^A-Za-z0-9_.@/[\]`-])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))(?:\/[A-Za-z0-9._-]{1,100})?(?![A-Za-z0-9-])/g, (m, before) => {
    counts.mentions += 1;
    return `${before}[GITHUB_USER]`;
  });
}

// ── Sources ──────────────────────────────────────────────────────────────────

function parseJson(raw, label) {
  try { return JSON.parse(raw.replace(/^\uFEFF/, '')); } catch { return malformed(`The ${label} export is not valid JSON`); }
}
const commentBodies = (list) => (Array.isArray(list) ? list : []).slice(0, LIMITS.MAX_COMMENTS).map((c) => (isObject(c) && isText(c.body) ? c.body : ''));

function fromLinearJson(raw) {
  const j = parseJson(raw, 'Linear');
  const data = isObject(j) && isObject(j.data) ? j.data : j;
  if (!isObject(data) || !isObject(data.issue)) malformed('The Linear export has no issue object (expected the AegisIssueIntake answer: data.issue and data.organization)');
  const issue = data.issue;
  if (!isText(issue.title) || !isText(issue.identifier) || !LINEAR_ISSUE_ID.test(issue.identifier)) malformed('The Linear issue has no title or no valid identifier');
  if (issue.description !== undefined && issue.description !== null && !isText(issue.description)) malformed('The Linear issue description is not text');
  const nodes = isObject(issue.comments) ? issue.comments.nodes : [];
  if (nodes !== undefined && !Array.isArray(nodes)) malformed('The Linear issue comments are not a list');
  const org = isObject(data.organization) && isText(data.organization.urlKey) ? data.organization.urlKey : null;
  return { title: issue.title, body: issue.description || '', comments: commentBodies(nodes), origin: issue.identifier, evidence: org === null ? null : [org], compare: 'ci' };
}

const GH_REPO_API = /^https:\/\/api\.github\.com\/repos\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/;
const GH_ISSUE_HTML = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})\/(?:issues|pull)\/[0-9]{1,9}$/;
function fromGithubJson(raw) {
  const j = parseJson(raw, 'GitHub');
  const issue = isObject(j) && isObject(j.issue) ? j.issue : j;
  if (!isObject(issue) || !Number.isInteger(issue.number) || issue.number < 1 || !isText(issue.title)) malformed('The GitHub export has no issue with a number and a title (expected the REST issue object, alone or as {issue, comments})');
  if (issue.body !== undefined && issue.body !== null && !isText(issue.body)) malformed('The GitHub issue body is not text');
  if (j.comments !== undefined && !Array.isArray(j.comments)) malformed('The GitHub comments are not a list');
  const owners = [];
  let repo = null;
  for (const [field, re] of [['repository_url', GH_REPO_API], ['html_url', GH_ISSUE_HTML]]) {
    if (issue[field] === undefined || issue[field] === null) continue;
    const m = isText(issue[field]) ? issue[field].match(re) : null;
    if (!m) malformed(`The GitHub issue ${field} is not a github.com issue address`);
    owners.push(m[1]);
    repo = repo || m[2];
  }
  return { title: issue.title, body: issue.body || '', comments: commentBodies(j.comments), origin: repo ? `${repo}#${issue.number}` : `issue#${issue.number}`, evidence: owners.length ? owners : null, compare: 'ci' };
}

function slackBlocksText(blocks) {
  const out = [];
  const walk = (node) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!isObject(node)) return;
    if (node.type === 'text' && isText(node.text)) out.push(node.text);
    if (Array.isArray(node.elements)) node.elements.forEach(walk);
  };
  walk(blocks);
  return out.join('');
}
function fromSlackJson(raw) {
  const j = parseJson(raw, 'Slack');
  const messages = Array.isArray(j) ? j : isObject(j) ? j.messages : undefined;
  if (!Array.isArray(messages) || !messages.length || !messages.every(isObject)) malformed('The Slack export has no list of messages (expected conversations.replies output or a channel export day file)');
  const ts = (m) => (isText(m.ts) && /^[0-9]{1,12}\.[0-9]{1,8}$/.test(m.ts) ? Number(m.ts) : NaN);
  if (messages.some((m) => Number.isNaN(ts(m)))) malformed('A Slack message has no valid ts');
  const ordered = [...messages].sort((a, b) => ts(a) - ts(b));
  const root = ordered.find((m) => m.thread_ts === m.ts) || ordered[0];
  const team = [root.team, root.user_team, root.source_team].find((t) => isText(t)) || null;
  const textOf = (m) => (isText(m.text) && m.text.trim() ? m.text : slackBlocksText(m.blocks));
  const replies = ordered.filter((m) => m !== root).slice(0, LIMITS.MAX_COMMENTS);
  const external = replies.filter((m) => isText(m.team) && team !== null && m.team !== team).length;
  return { title: '', body: textOf(root), comments: replies.map(textOf), origin: root.thread_ts || root.ts, evidence: team === null ? null : [team], compare: 'exact', external };
}

// ── Email (.eml): RFC 5322 headers, MIME parts, transfer encodings, charsets ──

function splitHeadersBody(raw) {
  const m = raw.match(/\r?\n\r?\n/);
  if (!m) return null;
  return { head: raw.slice(0, m.index), body: raw.slice(m.index + m[0].length) };
}
function parseHeaders(head) {
  const lines = head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).filter((l) => l.length);
  const headers = {};
  for (const line of lines) {
    const m = line.match(/^([!-9;-~]{1,76}):[ \t]*(.*)$/);
    if (!m) return null;
    const name = m[1].toLowerCase();
    (headers[name] = headers[name] || []).push(m[2]);
  }
  return headers;
}
const firstHeader = (h, name) => (h[name] ? h[name][0] : undefined);
function headerParams(value) {
  const [type, ...rest] = String(value || '').split(';');
  const params = {};
  for (const p of rest) {
    const m = p.match(/^\s*([A-Za-z0-9_.*-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s;]*))/);
    if (m) params[m[1].toLowerCase()] = m[2] !== undefined ? m[2].replace(/\\(.)/g, '$1') : m[3];
  }
  return { value: type.trim().toLowerCase(), params };
}
function decoderFor(charset) {
  try { return new TextDecoder(charset || 'utf-8'); } catch { return new TextDecoder('utf-8'); }
}
function qpBytes(s, toBytes) {
  const text = s.replace(/=\r?\n/g, '');
  const chunks = [];
  let last = 0;
  for (const m of text.matchAll(/=([0-9A-Fa-f]{2})/g)) {
    if (m.index > last) chunks.push(toBytes(text.slice(last, m.index)));
    chunks.push(Buffer.from([parseInt(m[1], 16)]));
    last = m.index + 3;
  }
  if (last < text.length) chunks.push(toBytes(text.slice(last)));
  return Buffer.concat(chunks);
}
function decodeBody(body, encoding, charset, toBytes) {
  const enc = String(encoding || '7bit').trim().toLowerCase();
  let bytes;
  if (enc === 'base64') {
    const compact = body.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) malformed('An email part says base64 but is not');
    bytes = Buffer.from(compact, 'base64');
  } else if (enc === 'quoted-printable') {
    bytes = qpBytes(body, toBytes);
  } else if (['7bit', '8bit', 'binary'].includes(enc)) {
    bytes = toBytes(body);
  } else {
    malformed('An email part uses an unknown transfer encoding');
  }
  return decoderFor(charset).decode(bytes);
}
// RFC 2047 encoded words in a header (Subject).
function decodeWords(value, toBytes) {
  return String(value || '').replace(/(=\?[^?\s]{1,40}\?[BbQq]\?[^?\s]*\?=)\s+(?==\?)/g, '$1').replace(/=\?([^?\s]{1,40})\?([BbQq])\?([^?\s]*)\?=/g, (m, charset, kind, text) => {
    try {
      const bytes = kind.toUpperCase() === 'B' ? Buffer.from(text, 'base64') : qpBytes(text.replace(/_/g, ' '), toBytes);
      return decoderFor(charset).decode(bytes);
    } catch { return m; }
  });
}
function mimeLeaves(headers, body, depth, acc, toBytes) {
  if (acc.count++ > LIMITS.MAX_MIME_PARTS) malformed(`The email has more than ${LIMITS.MAX_MIME_PARTS} MIME parts`);
  const type = headerParams(firstHeader(headers, 'content-type') || 'text/plain; charset=us-ascii');
  const disposition = headerParams(firstHeader(headers, 'content-disposition') || '');
  if (type.value.startsWith('multipart/')) {
    if (depth >= LIMITS.MAX_MIME_DEPTH) malformed(`The email nests MIME parts deeper than ${LIMITS.MAX_MIME_DEPTH} levels`);
    const boundary = type.params.boundary;
    if (!boundary || boundary.length > 200) malformed('A multipart email part has no boundary');
    const lines = body.split(/\r?\n/);
    const open = `--${boundary}`;
    const parts = [];
    let current = null;
    for (const line of lines) {
      const bare = line.trimEnd();
      if (bare === open || bare === `${open}--`) {
        if (current) parts.push(current.join('\n'));
        current = bare === open ? [] : null;
        if (bare !== open) break;
      } else if (current) current.push(line);
    }
    if (!parts.length) malformed('A multipart email part has no parts');
    for (const part of parts) {
      const split = part.startsWith('\n') ? { head: '', body: part.slice(1) } : splitHeadersBody(part) || { head: part, body: '' };
      const ph = split.head ? parseHeaders(split.head) : {};
      if (!ph) malformed('An email part has a malformed header');
      mimeLeaves(ph, split.body, depth + 1, acc, toBytes);
    }
    return acc;
  }
  const attachment = disposition.value === 'attachment' || Boolean(type.params.name || disposition.params.filename);
  acc.leaves.push({ type: type.value, attachment, body, encoding: firstHeader(headers, 'content-transfer-encoding'), charset: type.params.charset });
  return acc;
}
function fromEmail(raw, { binary = false } = {}) {
  const toBytes = (s) => Buffer.from(s, binary ? 'latin1' : 'utf8');
  const split = splitHeadersBody(raw);
  if (!split) malformed('The email has no blank line between its headers and its body');
  const headers = parseHeaders(split.head);
  if (!headers) malformed('The email does not start with header lines');
  if (!firstHeader(headers, 'from')) malformed('The email has no From header');
  const acc = mimeLeaves(headers, split.body, 0, { leaves: [], count: 0 }, toBytes);
  const texts = acc.leaves.filter((l) => !l.attachment && (l.type === 'text/plain' || l.type === 'text/html'));
  const chosen = texts.find((l) => l.type === 'text/plain') || texts.find((l) => l.type === 'text/html') || null;
  let body = chosen ? decodeBody(chosen.body, chosen.encoding, chosen.charset, toBytes) : '';
  const html = Boolean(chosen && chosen.type === 'text/html');
  if (html) body = htmlToText(body);
  const recipients = [];
  for (const name of ['to', 'cc', 'delivered-to', 'x-original-to']) {
    for (const v of headers[name] || []) for (const m of findEmails(v)) recipients.push(m.slice(m.lastIndexOf('@') + 1).toLowerCase());
  }
  const messageId = firstHeader(headers, 'message-id');
  return {
    title: decodeWords(firstHeader(headers, 'subject'), toBytes),
    body,
    comments: [],
    origin: `msgid-${sha256(messageId ? messageId.trim() : raw).slice(0, 16)}`,
    evidence: recipients.length ? recipients : null,
    compare: 'domain',
    htmlPart: html,
    attachments: acc.leaves.filter((l) => l.attachment || (l.type !== 'text/plain' && l.type !== 'text/html')).length,
  };
}

const PARSERS = { linear: fromLinearJson, github: fromGithubJson, slack: fromSlackJson, email: fromEmail };

// ── The tenant ───────────────────────────────────────────────────────────────

function tenantVerdict(source, evidence, value, compare) {
  if (evidence === null) return 'none';
  const v = value.toLowerCase();
  if (compare === 'exact') return evidence.every((e) => e === value) ? 'ours' : 'other';
  if (compare === 'domain') return evidence.some((d) => d === v || d.endsWith(`.${v}`)) ? 'ours' : 'other';
  return evidence.every((e) => e.toLowerCase() === v) ? 'ours' : 'other';
}

// ── The intake ───────────────────────────────────────────────────────────────

// raw: the item as text (a JSON export or an .eml file). opts.binary: the text holds the
// file's bytes one per character (latin1), as fromFile reads an .eml file.
function fromText(source, raw, { env = process.env, now = Date.now, via, binary = false, rawBytes } = {}) {
  const src = SOURCES[source];
  if (!src) throw new Error(`unknown source ${String(source).slice(0, 40)}: linear, github, slack or email`);
  const bytes = rawBytes || Buffer.from(String(raw), binary ? 'latin1' : 'utf8');
  const provenance = { raw_sha256: sha256(bytes), raw_bytes: bytes.length, received_at: new Date(now()).toISOString() };
  const base = baseRecord(source, via || src.via, provenance);
  const label = src.label;
  if (bytes.length > LIMITS.MAX_RAW_BYTES) {
    return failed(STATES.OVERSIZED, base, `The ${label} is ${bytes.length} bytes, over the ${LIMITS.MAX_RAW_BYTES} byte intake limit, so it was not read`);
  }
  const value = env && isText(env[src.env]) ? env[src.env].trim() : '';
  if (!value || !src.shape.test(value)) {
    return failed(STATES.TENANT_UNBOUND, base, `${src.env} is ${value ? 'not a valid value' : 'not set'}, so Aegis cannot check that this ${label} belongs to this deployment's ${src.unit}`,
      `Nothing was kept. Set ${src.env} to this deployment's ${src.unit} (scripts/intake/README.md), then run the intake again`);
  }
  let item;
  try {
    item = PARSERS[source](String(raw), { binary });
  } catch (error) {
    if (error instanceof IntakeError) return failed(error.state, base, error.reason);
    throw error;
  }
  base.provenance.origin = item.origin;
  const verdict = tenantVerdict(source, item.evidence, value, item.compare);
  if (verdict === 'none') {
    return failed(STATES.TENANT_UNBOUND, base, `The ${label} does not name its ${src.unit}, so Aegis cannot check that it belongs to this deployment`,
      `Nothing was kept. Export the ${label} again with its ${src.unit} included (scripts/intake/README.md), then run the intake again`);
  }
  if (verdict === 'other') {
    return failed(STATES.TENANT_MISMATCH, base, `This ${label} belongs to another ${src.unit} than ${src.env} names`,
      `Nothing was kept. Stop: check that the export comes from this deployment's own ${src.unit}, and do not work this case from it`);
  }
  base.tenant.bound = true;

  const counts = { emails: 0, phones: 0, mentions: 0, tenant_values: 0 };
  const flags = { html: Boolean(item.htmlPart) };
  const parts = {
    title: partText(item.title, source === 'slack' ? 'slack' : 'plain', counts, { html: false }),
    body: partText(item.body, source, counts, flags),
    comments: item.comments.map((c) => partText(c, source, counts, { html: false })),
  };
  let text = render(parts);
  if (!text) return failed(STATES.EMPTY, base, `The ${label} has no title or text to work from`);
  const tooLong = (t) => failed(STATES.OVERSIZED, base, `The ticket text is ${t.length} characters, over the ${LIMITS.MAX_TEXT_CHARS} character limit`);
  if (text.length > LIMITS.MAX_TEXT_CHARS) return tooLong(text);
  text = redactTenant(redactEmails(text, counts), source, value, counts);
  const scan = sanitize.scanText(text);
  if (scan.blocks.length) {
    return failed(STATES.BLOCKED, base, `The ${label} holds a value Aegis never keeps (${[...new Set(scan.blocks.map((b) => b.label))].join('; ')})`);
  }
  text = redactPhones(text, counts);
  if (source === 'github') text = redactGithubMentions(text, counts);
  if (text.length > LIMITS.MAX_TEXT_CHARS) return tooLong(text);
  const record = {
    source, via: base.provenance.via, origin: item.origin, raw_sha256: provenance.raw_sha256, received_at: provenance.received_at,
    tenant: { env: src.env, bound: true }, html_only: flags.html, redactions: { ...counts },
  };
  let state;
  try {
    state = engine.newState({ ticketText: text, source, mode: 'dry-run', intake: record });
  } catch (error) {
    if (error instanceof engine.GraphError && error.code === 3) return failed(STATES.BLOCKED, base, `The ${label} holds a value Aegis never keeps (${(error.details || []).map((d) => String(d).replace(/ \(line \d+\)$/, '')).join('; ')})`);
    if (error instanceof engine.GraphError) return failed(STATES.MALFORMED, base, `The graph engine refused the case: ${error.message}`);
    throw error;
  }
  return {
    ...base,
    state: STATES.ACCEPTED,
    html_only: flags.html,
    redactions: { ...counts },
    injection_flags: state.ticket.injectionFlags.length,
    ...(source === 'email' ? { attachments_ignored: item.attachments } : {}),
    ...(source === 'slack' ? { external_messages: item.external } : {}),
    case: state,
  };
}

function fromFile(source, file, opts = {}) {
  const src = SOURCES[source];
  if (!src) throw new Error(`unknown source ${String(source).slice(0, 40)}: linear, github, slack or email`);
  const size = fs.statSync(file).size;
  if (size > LIMITS.MAX_RAW_BYTES) {
    const base = baseRecord(source, src.via, { raw_bytes: size, received_at: new Date((opts.now || Date.now)()).toISOString() });
    return failed(STATES.OVERSIZED, base, `The ${src.label} file is ${size} bytes, over the ${LIMITS.MAX_RAW_BYTES} byte intake limit, so it was not read`);
  }
  const bytes = fs.readFileSync(file);
  const binary = source === 'email';
  return fromText(source, bytes.toString(binary ? 'latin1' : 'utf8'), { ...opts, binary, rawBytes: bytes });
}

// A Linear issue read live: one POST of AegisIssueIntake through linear-client.js's spec
// on the shared contract (which also binds the answer to LINEAR_ORG).
async function fromLinear(issueId, { env = process.env, now = Date.now, deps = {} } = {}) {
  const src = SOURCES.linear;
  const base = baseRecord('linear', 'linear-client', { received_at: new Date(now()).toISOString() });
  if (!isText(issueId) || !LINEAR_ISSUE_ID.test(issueId)) return failed(STATES.MALFORMED, base, 'The Linear issue ID is not an identifier such as [ISSUE_ID] or an issue UUID; nothing was sent');
  const value = isText(env.LINEAR_ORG) ? env.LINEAR_ORG.trim() : '';
  if (!value || !src.shape.test(value)) {
    return failed(STATES.TENANT_UNBOUND, base, `LINEAR_ORG is ${value ? 'not a valid value' : 'not set'}, so Aegis cannot check that the issue belongs to this deployment's workspace; nothing was sent`,
      'Nothing was kept. Set LINEAR_ORG to this deployment\'s workspace (scripts/intake/README.md), then run the intake again');
  }
  const client = createClient(linear.SPEC, { env, ...cliDeps(deps, env) });
  const res = await client.graphql('AegisIssueIntake', { id: issueId });
  if (res.state === 'TENANT_MISMATCH') {
    return failed(STATES.TENANT_MISMATCH, base, 'This Linear issue belongs to another workspace than LINEAR_ORG names',
      'Nothing was kept. Stop: check that the Linear key and LINEAR_ORG belong to this deployment, and do not work this case from it');
  }
  if (res.state !== 'OK') {
    const m = operatorMessage(res, { platform: 'linear', operation: 'AegisIssueIntake' });
    return failed(STATES.READ_FAILED, base, m.operator, res.handoff && res.handoff.next_step ? `${res.handoff.next_step}` : 'Nothing was kept. Run the intake again; if it repeats, export the issue and import the file',
      { operator_message: m.operator, admin_detail: m.admin, read_state: res.state });
  }
  const answer = res.data;
  const issue = isObject(answer) && isObject(answer.data) ? answer.data.issue : null;
  if (!isObject(issue)) {
    return failed(STATES.READ_FAILED, base, 'Linear returned no issue for that ID (it may not exist, or the key cannot see it)', 'Nothing was kept. Check the issue ID, then run the intake again');
  }
  return fromText('linear', JSON.stringify(answer), { env, now, via: 'linear-client' });
}

// ── CLI ──────────────────────────────────────────────────────────────────────

// graph-cli.js's own runs folder (AEGIS_GRAPH_RUNS_DIR or tasks/graph-runs, gitignored)
const runsDir = (env) => (env && env.AEGIS_GRAPH_RUNS_DIR) || path.join(__dirname, '..', '..', 'tasks', 'graph-runs');
const USAGE = 'usage: node scripts/intake/intake.js <linear|github|slack|email> --file <path> [--save]\n       node scripts/intake/intake.js linear --issue [ISSUE_ID] [--execute] [--save]\n';

function parseCli(argv) {
  const [source, ...rest] = argv;
  const args = { source, file: null, issue: null, execute: false, save: false };
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i];
    if (t === '--execute') args.execute = true;
    else if (t === '--save') args.save = true;
    else if ((t === '--file' || t === '--issue') && i + 1 < rest.length) { args[t.slice(2)] = rest[i + 1]; i += 1; }
    else return null;
  }
  if (!SOURCES[source]) return null;
  if (Boolean(args.file) === Boolean(args.issue)) return null;
  if (args.issue && source !== 'linear') return null;
  if (args.execute && !args.issue) return null;
  return args;
}

function saveCase(state, dir) {
  const runDir = path.join(dir, state.runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx' });
}

async function run(argv, env = process.env, deps = {}) {
  const out = deps.out || ((s) => process.stdout.write(s));
  const err = deps.err || ((s) => process.stderr.write(s));
  const args = parseCli(argv);
  if (!args) { err(USAGE); return 1; }
  let record;
  if (args.issue && !args.execute) {
    const client = createClient(linear.SPEC, { env, transport: async () => { throw new Error('dry run'); } });
    const plan = client.planGraphql('AegisIssueIntake', { id: args.issue });
    if (!LINEAR_ISSUE_ID.test(args.issue) || plan.state !== 'OK') { err(`${JSON.stringify({ state: STATES.MALFORMED, reason: 'The Linear issue ID is not an identifier such as [ISSUE_ID] or an issue UUID' }, null, 2)}\n`); return 1; }
    out(`${JSON.stringify({ state: STATES.DRY_RUN, source: 'linear', planned: plan, note: 'dry run: nothing read or sent; add --execute to read the issue' }, null, 2)}\n`);
    return 0;
  }
  if (args.issue) {
    record = await fromLinear(args.issue, { env, deps });
  } else {
    if (!fs.existsSync(args.file) || !fs.statSync(args.file).isFile()) { err(`${JSON.stringify({ state: STATES.MALFORMED, reason: 'The file does not exist or is not a file' }, null, 2)}\n`); return 1; }
    record = fromFile(args.source, args.file, { env });
  }
  if (record.state === STATES.ACCEPTED && args.save) saveCase(record.case, runsDir(env));
  const code = EXIT[record.state] === undefined ? 1 : EXIT[record.state];
  (code === 0 ? out : err)(`${JSON.stringify(record, null, 2)}\n`);
  return code;
}

if (require.main === module) {
  run(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => {
    process.stderr.write(`intake: ${e && e.message ? e.message : 'failed'}\n`);
    process.exitCode = 1;
  });
}

module.exports = { fromText, fromFile, fromLinear, run, htmlToText, isHtmlOnly, LIMITS, STATES, SOURCES, EXIT };
