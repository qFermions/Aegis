#!/usr/bin/env node
'use strict';
/**
 * gws-posture-audit.js
 * Google Workspace security posture audit report (lane G2, capability-map row 14).
 *
 * Prints 8 checks. Each names a read-only Admin console path, a read-only GAM
 * command (print, info, report or show), the Google source behind it with the date
 * it was checked and how it was read, and a status. With --export it counts checks
 * 1 and 2 from a 'gam print users' CSV (and a second 'gam print admins' CSV).
 *
 * It never reads or writes Google: it loads no network module and calls no network
 * API. Aegis advises; humans execute: the report holds reads only.
 *
 * Exports are data (SR-3). A cell that reads like an instruction is flagged and
 * quoted, never followed. Email addresses are never printed: users appear only as
 * counts and row positions. A malformed export is refused with a fixed message that
 * shows nothing from the file (exit 2).
 *
 * Preview by default. A local report is written only with
 *   --write security-audit-gws-<label>.md --confirm "<exact phrase>"
 * where the phrase names the normalized target and the content SHA-256. The write
 * uses the exclusive, read-back-verified writer of scripts/security-audit.js: it
 * never overwrites and refuses a Git-trackable target.
 *
 * Exit: 0 preview or verified write; 1 usage error or unsafe target; 2 export
 * refused, confirmation mismatch or existing target.
 * Node built-ins only.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assertSafeReportTarget, writeReportExclusive } = require('./security-audit.js');
const { injectionMarkersIn } = require('./tier/tier-guard.js');

const SOURCES_CHECKED = '2026-10-27';
const MAX_EXPORT_BYTES = 10 * 1024 * 1024;
const MAX_LISTED_ROWS = 25;
const MAX_QUOTE = 200;
const REPORT_NAME = /^security-audit-gws-[A-Za-z0-9][A-Za-z0-9._-]{0,114}\.md$/;
const USERS_REQUIRED = ['primaryemail', 'isenrolledin2sv', 'isenforcedin2sv', 'isadmin', 'isdelegatedadmin', 'suspended'];
const ADMINS_REQUIRED = ['roleid'];
const USERS_GAM = 'gam print users fields primaryemail,isenrolledin2sv,isenforcedin2sv,isadmin,isdelegatedadmin,suspended';

// ── Sources (read 2026-10-27; how each was read is printed with it) ───────────
// discovery document: Google's published API definition, opened in full.
// project wiki: the GAM project's own wiki (GAM is a community tool), opened in full.
// search excerpt: the Google page could not be opened; its text came from a search index.
const SOURCES = Object.freeze({
  directoryDiscovery: {
    url: 'https://raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/directory/v1/admin-api.json',
    how: 'discovery document',
    title: 'Admin SDK Directory API v1 discovery document, published by Google',
  },
  reportsDiscovery: {
    url: 'https://raw.githubusercontent.com/googleapis/google-api-go-client/main/admin/reports/v1/admin-api.json',
    how: 'discovery document',
    title: 'Admin SDK Reports API v1 discovery document, published by Google',
  },
  gamUsers: { url: 'https://raw.githubusercontent.com/wiki/GAM-team/GAM/Users.md', how: 'project wiki', title: 'GAM wiki: Users' },
  gamAdmins: { url: 'https://raw.githubusercontent.com/wiki/GAM-team/GAM/Administrators.md', how: 'project wiki', title: 'GAM wiki: Administrators' },
  gamTokens: { url: 'https://raw.githubusercontent.com/wiki/GAM-team/GAM/Users-Tokens.md', how: 'project wiki', title: 'GAM wiki: Users, Tokens' },
  gamReports: { url: 'https://raw.githubusercontent.com/wiki/GAM-team/GAM/Reports.md', how: 'project wiki', title: 'GAM wiki: Reports' },
  gamDrivePermissions: {
    url: 'https://raw.githubusercontent.com/wiki/GAM-team/GAM/Users-Drive-Permissions.md',
    how: 'project wiki',
    title: 'GAM wiki: Users, Drive Permissions',
  },
  deploy2sv: { url: 'https://support.google.com/a/answer/9176657', how: 'search excerpt', title: 'Deploy 2-Step Verification' },
  userReportsSecurity: { url: 'https://support.google.com/a/answer/6000269', how: 'search excerpt', title: 'User reports: Security' },
  privilegeDefinitions: { url: 'https://support.google.com/a/answer/1219251', how: 'search excerpt', title: 'Administrator privilege definitions' },
  adminBestPractices: {
    url: 'https://knowledge.workspace.google.com/admin/users/security-best-practices-for-administrator-accounts',
    how: 'search excerpt',
    title: 'Security best practices for administrator accounts',
  },
  assignRoles: { url: 'https://support.google.com/a/answer/9807615', how: 'search excerpt', title: 'Assign specific admin roles' },
  lessSecureApps: { url: 'https://support.google.com/a/answer/14114704', how: 'search excerpt', title: 'Transition from less secure apps to OAuth' },
  thirdPartyApps: {
    url: 'https://knowledge.workspace.google.com/admin/apps/control-which-third-party-and-internal-apps-access-google-workspace-data',
    how: 'search excerpt',
    title: 'Control which third-party and internal apps access Google Workspace data',
  },
  externalSharing: {
    url: 'https://knowledge.workspace.google.com/admin/drive/manage-external-sharing-for-your-organization',
    how: 'search excerpt',
    title: 'Manage external sharing for your organization',
  },
  allowlistedDomains: {
    url: 'https://knowledge.workspace.google.com/admin/domains/allow-external-sharing-with-only-trusted-domains',
    how: 'search excerpt',
    title: 'Allow external sharing with only trusted domains',
  },
  driveLogEvents: { url: 'https://support.google.com/a/answer/4579696', how: 'search excerpt', title: 'Drive log events' },
  autoForwarding: { url: 'https://support.google.com/a/answer/14724207', how: 'search excerpt', title: 'Let users automatically forward their own Gmail emails' },
  mobileUniversal: { url: 'https://support.google.com/a/answer/6328676', how: 'search excerpt', title: 'Apply universal settings for mobile devices and endpoints' },
  retention: { url: 'https://support.google.com/a/answer/7061566', how: 'search excerpt', title: 'Data retention and lag times' },
});

// ── The 8 checks ─────────────────────────────────────────────────────────────
// Every Admin console path is a read: open the page, read the value, leave without
// saving. Every GAM command is print, info, report or show.
const CHECKS = Object.freeze([
  {
    id: 1,
    title: '2-Step Verification enforcement and enrollment',
    console: [
      'Security → Authentication → 2-step verification → [OU_PATH] or group: read "Allow users to turn on 2-Step Verification", Enforcement (Off, On or a start date), New user enrollment period and Methods, then leave without saving (the page path is unverified; labels from a search excerpt)',
      'Reporting → User Reports → Security: read the 2-Step Verification enrollment and 2-Step Verification enforcement columns (the data can lag up to 48 hours, search excerpt)',
    ],
    gam: [
      { cmd: USERS_GAM, note: 'one row per user, current state; the CSV this report counts with --export' },
      {
        cmd: 'gam report usage customer parameters accounts:num_users_2sv_enrolled,accounts:num_users_2sv_enforced',
        note: 'tenant totals per day; the parameter names come from a search excerpt',
      },
    ],
    sources: ['deploy2sv', 'userReportsSecurity', 'privilegeDefinitions', 'directoryDiscovery', 'gamUsers'],
    notes: [
      'isEnrolledIn2Sv and isEnforcedIn2Sv are read-only fields on each user that show the current state (discovery document); the User Reports page can lag.',
      'Only a super admin can enforce 2-Step Verification for the whole organization (search excerpt).',
    ],
    exportAnswers: 'answers per-user enrollment and enforcement; cannot answer the enforcement setting itself, the allowed methods or the new-user enrollment period.',
  },
  {
    id: 2,
    title: 'Super admin count and super admin account recovery',
    console: [
      'Account → Admin roles → [ROLE_NAME] → Admins: read who holds each role, the super admin role first (search excerpt)',
      'Security → Authentication → Account recovery → Super admin account recovery: read "Allow super admins to recover their account", then leave without saving (older consoles: Security → Account recovery; search excerpt)',
    ],
    gam: [
      { cmd: 'gam print admins', note: 'one row per role assignment; the second --export this report counts' },
      { cmd: 'gam print adminroles', note: 'role names and ids' },
    ],
    sources: ['adminBestPractices', 'assignRoles', 'directoryDiscovery', 'gamAdmins'],
    notes: [
      'Google recommends more than one super admin, each a separate person with no shared admin account, and a separate non-admin account for daily work (search excerpt).',
      'The super admin recovery default depends on the age and size of the customer account, so read the setting rather than assume it (search excerpt).',
      'isAdmin True means super administrator; isDelegatedAdmin True means a delegated administrator (discovery document).',
      'A role can be assigned to a user, a group or a service account; read all three (search excerpt; discovery document).',
    ],
    exportAnswers: 'counts super admins, super admins not enrolled in 2-Step Verification and delegated admins; cannot answer super admin account recovery.',
  },
  {
    id: 3,
    title: 'Less secure apps and legacy access',
    console: [
      'none: the less secure apps settings were removed from the Admin console on June 15 2024, so there is no setting to read (search excerpt)',
    ],
    gam: [{ cmd: null, note: 'none (there is no setting left to read)' }],
    sources: ['lessSecureApps'],
    notes: [
      'Password-only IMAP, POP, SMTP, CalDAV and CardDAV sign-in is turned off for Workspace accounts (search excerpt).',
      'Sources disagree on the final cutoff date (March 14 2025 in the Google excerpt, May 1 2025 elsewhere). Both dates are past, so this report says only "retired" and does not look for the old toggle.',
    ],
    exportAnswers: null,
  },
  {
    id: 4,
    title: 'Third-party app access',
    console: [
      'Security → Access and data control → API controls → Manage Third-Party App Access: read each app\'s access level (Trusted, Limited or Blocked) and the organizational unit it applies to, then leave without changing access (labels partly from a search excerpt; older consoles call this App access control)',
    ],
    gam: [{ cmd: 'gam all users print tokens', note: 'the OAuth grants each user has made: columns user, clientId, displayText, scopes' }],
    sources: ['thirdPartyApps', 'gamTokens', 'directoryDiscovery'],
    notes: [
      'GAM reads tokens through the admin.directory.user.security scope, which has no read-only form and also allows revoking tokens (discovery document). Aegis does not hold that scope; an administrator runs this read from their own GAM session.',
      'Which admin privilege opens API controls is unclear in the sources (unverified).',
      'The history of OAuth grants and revokes is in the Reports API token log (discovery document).',
    ],
    exportAnswers: null,
  },
  {
    id: 5,
    title: 'External Drive sharing',
    console: [
      'Apps → Google Workspace → Drive and Docs → Sharing settings → Sharing options: read "Sharing outside of [@Aegion]" (Off, On or Allowlisted Domains) for the top organizational unit, each child OU and each configuration group, then leave without saving',
      'Account → Domains → Allowlisted domains: read the list (one list for the whole organization)',
      'Reporting → Audit and investigation → Drive log events → Add a filter → Visibility → Shared externally: read who shared what in the period you choose',
    ],
    gam: [
      { cmd: 'gam report drive user all start -30d', note: 'Drive events for the last 30 days' },
      {
        cmd: 'gam all users print filelist fields id,name,mimetype,basicpermissions pm notrole owner type user notdomain [@Aegion_DOMAIN] em pmfilter oneitemperrow',
        note: 'My Drive files shared with users outside [@Aegion_DOMAIN]',
      },
    ],
    sources: ['externalSharing', 'allowlistedDomains', 'driveLogEvents', 'gamReports', 'gamDrivePermissions'],
    notes: [
      'A configuration group setting overrides the organizational-unit setting, and a change takes up to 24 hours (search excerpt).',
      'A "Shared externally" log entry records a sharing event, not proof that someone outside still has access: the log shows events, not current state (search excerpt).',
      'Sharing with people who have no Google account is a separate visitor sharing setting (search excerpt).',
    ],
    exportAnswers: null,
  },
  {
    id: 6,
    title: 'Gmail automatic forwarding',
    console: [
      'Apps → Google Workspace → Gmail → End User Access → Automatic forwarding: read "Allow users to automatically forward email to another address" for the top organizational unit and each child OU (inherited or overridden), then leave without saving',
    ],
    gam: [{ cmd: 'gam report admin start -30d', note: 'Admin console setting changes in the last 30 days; the event name for this setting is unverified' }],
    sources: ['autoForwarding', 'gamReports', 'reportsDiscovery'],
    notes: [
      'The setting is on by default and needs the Gmail Settings admin privilege (search excerpt).',
      'Whether turning it off stops forwarding that users already set up is unverified, so do not assume existing forwarding stopped.',
      'The sources read for this lane name no GAM read of the setting itself.',
    ],
    exportAnswers: null,
  },
  {
    id: 7,
    title: 'Mobile and endpoint management',
    console: [
      'Devices → Mobile & endpoints → Settings → Universal → Security → Device approvals: read the setting, then leave without saving (needs the Mobile Device Management admin privilege, search excerpt)',
    ],
    gam: [{
      cmd: 'gam report mobile start -30d',
      note: 'device audit events for the last 30 days; GAM report syntax from its wiki, the application name "mobile" from the Reports API discovery document',
    }],
    sources: ['mobileUniversal', 'reportsDiscovery', 'directoryDiscovery', 'gamReports'],
    notes: [
      'The Directory API lists each mobile device with status, deviceCompromisedStatus, encryptionStatus and devicePasswordStatus, and each ChromeOS device with osVersionCompliance and autoUpdateThrough (discovery document).',
    ],
    exportAnswers: null,
  },
  {
    id: 8,
    title: 'Audit log retention',
    console: [
      'Reporting → Audit and investigation → Admin log events (then Login, OAuth, SAML and Drive log events): note the date of the oldest event shown (only the Drive log path was confirmed in an excerpt)',
    ],
    gam: [{ cmd: 'gam report admin start -180d', note: 'the oldest event returned shows how far back Admin log events reach today' }],
    sources: ['retention', 'gamReports', 'reportsDiscovery'],
    canSay: [
      'Admins cannot delete log event data or change how long Google keeps it, so there is no retention setting to audit (search excerpt).',
      'Admin and Drive log events appear in near real time; OAuth events can take up to a few hours (search excerpt).',
      'One Reports API request for Gmail activity covers at most 30 days (discovery document).',
    ],
    cannotSay: [
      'How long each log type is kept: Google\'s retention table was not seen. The GAM wiki says 180 days for activity events and a Google excerpt says user log events reach back up to 6 months; neither is confirmed for every log type. Take the safer reading: save what an investigation needs within 180 days of the event.',
    ],
    exportAnswers: null,
  },
]);

// ── Export reading: data, never instructions ─────────────────────────────────
class ExportRefused extends Error {
  constructor(exportIndex, reason) {
    super(`export ${exportIndex} refused: ${reason}. Nothing from the file is shown.`);
    this.name = 'ExportRefused';
    this.exportIndex = exportIndex;
    this.reason = reason;
  }
}

function readExport(filePath, exportIndex, fileSystem = fs) {
  let stat;
  try {
    stat = fileSystem.statSync(filePath);
  } catch {
    throw new ExportRefused(exportIndex, 'the file could not be opened');
  }
  if (!stat.isFile()) throw new ExportRefused(exportIndex, 'the file is not a regular file');
  if (stat.size > MAX_EXPORT_BYTES) throw new ExportRefused(exportIndex, 'the file is larger than 10 MB');

  let descriptor;
  try {
    descriptor = fileSystem.openSync(filePath, 'r');
  } catch {
    throw new ExportRefused(exportIndex, 'the file could not be opened');
  }
  try {
    if (!fileSystem.fstatSync(descriptor).isFile()) throw new ExportRefused(exportIndex, 'the file is not a regular file');
    const chunks = [];
    const chunk = Buffer.alloc(64 * 1024);
    let total = 0;
    for (;;) {
      const count = fileSystem.readSync(descriptor, chunk, 0, chunk.length, null);
      if (count === 0) break;
      total += count;
      if (total > MAX_EXPORT_BYTES) throw new ExportRefused(exportIndex, 'the file is larger than 10 MB');
      chunks.push(Buffer.from(chunk.subarray(0, count)));
    }
    return decodeExport(Buffer.concat(chunks), exportIndex);
  } catch (error) {
    if (error instanceof ExportRefused) throw error;
    throw new ExportRefused(exportIndex, 'the file could not be read');
  } finally {
    try { fileSystem.closeSync(descriptor); } catch { /* the read result already decides */ }
  }
}

function decodeExport(buffer, exportIndex) {
  if (buffer.includes(0)) throw new ExportRefused(exportIndex, 'the file is not UTF-8 text');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new ExportRefused(exportIndex, 'the file is not UTF-8 text');
  }
}

// RFC 4180 CSV, strict: a quote may open a field or be doubled inside a quoted
// field, nothing else. Rows are numbered as a spreadsheet shows them (header = 1).
function parseCsv(text, exportIndex = 1) {
  const misplaced = () => new ExportRefused(exportIndex, 'a quote is unbalanced or misplaced');
  const records = [];
  let cells = [];
  let field = '';
  let quoted = false;
  let inQuotes = false;
  let closed = false;
  let rowNumber = 0;
  const endField = () => {
    cells.push(field);
    field = '';
    quoted = false;
    closed = false;
  };
  const endRecord = () => {
    endField();
    rowNumber += 1;
    records.push({ row: rowNumber, cells });
    cells = [];
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
          closed = true;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === ',') {
      endField();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      endRecord();
    } else if (closed) {
      throw misplaced();
    } else if (ch === '"') {
      if (field.length > 0 || quoted) throw misplaced();
      quoted = true;
      inQuotes = true;
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw misplaced();
  if (field.length > 0 || cells.length > 0 || quoted) endRecord();
  return records;
}

function isBlankRecord(record) {
  return record.cells.length === 1 && record.cells[0].trim() === '';
}

function columnLabel(cell, index) {
  const name = String(cell).replace(/^﻿/, '').trim();
  return /^[A-Za-z0-9_.:-]{1,40}$/.test(name) ? name : `column ${index + 1}`;
}

// A quote fit for a report: control and format characters become spaces, an address
// becomes [USER@DOMAIN.COM], a run of 7 or more digits becomes [PHONE_NUMBER], and
// quote, backtick, angle-bracket, pipe and backslash characters are neutralized.
function quoteForReport(text) {
  let quote = String(text).replace(/[\p{Cc}\p{Cf}]/gu, ' ');
  quote = quote.replace(/[^\s@"'<>()[\]{},;:]+@[^\s@"'<>()[\]{},;:]+/g, '[USER@DOMAIN.COM]');
  quote = quote.replace(/\+?\d[\d\s().-]{5,}\d/g, (run) => ((run.match(/\d/g) || []).length >= 7 ? '[PHONE_NUMBER]' : run));
  quote = quote.replace(/["`<>|\\]/g, "'").replace(/\s+/g, ' ').trim();
  return quote.length > MAX_QUOTE ? `${quote.slice(0, MAX_QUOTE)}...` : quote;
}

// Printable ASCII with no space cannot hold an injection marker in any folded form
// (every marker needs a space between words), so only other cells are scanned.
const CELL_WITHOUT_WORDS = /^[\x21-\x7E]*$/;

function flagInstructions(exportIndex, header, data) {
  const labels = header.cells.map(columnLabel);
  const flags = [];
  const scan = (cell, row, columnIndex) => {
    if (CELL_WITHOUT_WORDS.test(cell)) return;
    const markers = injectionMarkersIn(cell);
    if (markers.length > 0) {
      flags.push({ exportIndex, row, column: labels[columnIndex] || `column ${columnIndex + 1}`, markers, quote: quoteForReport(cell) });
    }
  };
  header.cells.forEach((cell, index) => scan(cell, header.row, index));
  for (const record of data) record.cells.forEach((cell, index) => scan(cell, record.row, index));
  return flags;
}

function readTable(text, exportIndex, required) {
  const records = parseCsv(String(text).replace(/^﻿/, ''), exportIndex).filter((record) => !isBlankRecord(record));
  if (records.length === 0) throw new ExportRefused(exportIndex, 'the file has no header row');
  const [header, ...data] = records;
  const names = header.cells.map((cell) => cell.replace(/^﻿/, '').trim().toLowerCase());
  const missing = required.filter((name) => !names.includes(name));
  if (missing.length > 0) {
    throw new ExportRefused(exportIndex, `the header is missing required columns: ${missing.join(', ')}`);
  }
  if (required.some((name) => names.indexOf(name) !== names.lastIndexOf(name))) {
    throw new ExportRefused(exportIndex, 'the header repeats a required column');
  }
  for (const record of data) {
    if (record.cells.length !== names.length) {
      throw new ExportRefused(exportIndex, `row ${record.row} has ${record.cells.length} cells but the header has ${names.length}`);
    }
  }
  const columns = {};
  names.forEach((name, index) => {
    if (!(name in columns)) columns[name] = index;
  });
  return { columns, data, flags: flagInstructions(exportIndex, header, data) };
}

function readBool(value) {
  const text = String(value === undefined ? '' : value).trim().toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return null;
}

// Checks 1 and 2 from 'gam print users'. Suspended users are left out; a row whose
// suspended value is not readable counts as active (the safer reading).
function analyzeUsersExport(text, exportIndex = 1) {
  const table = readTable(text, exportIndex, USERS_REQUIRED);
  if (table.data.length === 0) return { kind: 'users', state: 'empty', counts: null, rows: null, flags: table.flags };
  const col = table.columns;
  const counts = {
    rows: 0, suspended: 0, active: 0, notEnrolled: 0, notEnforced: 0, enforcedNotEnrolled: 0, unreadable2sv: 0,
    unreadableSuspended: 0, superAdmins: 0, superAdminsNotEnrolled: 0, delegatedAdmins: 0, unreadableAdmin: 0,
  };
  const rows = {
    notEnrolled: [], notEnforced: [], enforcedNotEnrolled: [], unreadable2sv: [], unreadableSuspended: [],
    superAdminsNotEnrolled: [], unreadableAdmin: [],
  };
  const count = (key, row) => {
    counts[key] += 1;
    if (rows[key]) rows[key].push(row);
  };
  for (const { cells, row } of table.data) {
    counts.rows += 1;
    const suspended = readBool(cells[col.suspended]);
    if (suspended === true) {
      counts.suspended += 1;
      continue;
    }
    if (suspended === null) count('unreadableSuspended', row);
    counts.active += 1;
    const enrolled = readBool(cells[col.isenrolledin2sv]);
    const enforced = readBool(cells[col.isenforcedin2sv]);
    const superAdmin = readBool(cells[col.isadmin]);
    const delegated = readBool(cells[col.isdelegatedadmin]);
    if (enrolled === false) count('notEnrolled', row);
    if (enforced === false) count('notEnforced', row);
    if (enforced === true && enrolled === false) count('enforcedNotEnrolled', row);
    if (enrolled === null || enforced === null) count('unreadable2sv', row);
    if (superAdmin === true) {
      counts.superAdmins += 1;
      if (enrolled === false) count('superAdminsNotEnrolled', row);
    }
    if (delegated === true) counts.delegatedAdmins += 1;
    if (superAdmin === null || delegated === null) count('unreadableAdmin', row);
  }
  return { kind: 'users', state: 'ok', counts, rows, flags: table.flags };
}

// Check 2 from 'gam print admins'. Only roleId is required; the GAM header names
// beyond roleId, scopeType and orgUnitId are unverified, so the others are optional.
function analyzeAdminsExport(text, exportIndex = 2) {
  const table = readTable(text, exportIndex, ADMINS_REQUIRED);
  if (table.data.length === 0) return { kind: 'admins', state: 'empty', counts: null, flags: table.flags };
  const col = table.columns;
  const roles = new Set();
  const assignees = new Set();
  const scope = 'scopetype' in col ? { CUSTOMER: 0, ORG_UNIT: 0, other: 0 } : null;
  const assigneeType = 'assigneetype' in col ? { user: 0, group: 0, other: 0 } : null;
  for (const { cells } of table.data) {
    const roleId = cells[col.roleid].trim();
    if (roleId) roles.add(roleId);
    if ('assignedto' in col && cells[col.assignedto].trim()) assignees.add(cells[col.assignedto].trim());
    if (scope) {
      const value = cells[col.scopetype].trim().toUpperCase();
      scope[value === 'CUSTOMER' || value === 'ORG_UNIT' ? value : 'other'] += 1;
    }
    if (assigneeType) {
      const value = cells[col.assigneetype].trim().toLowerCase();
      assigneeType[value === 'user' || value === 'group' ? value : 'other'] += 1;
    }
  }
  return {
    kind: 'admins',
    state: 'ok',
    counts: {
      rows: table.data.length,
      distinctRoles: roles.size,
      distinctAssignees: 'assignedto' in col ? assignees.size : null,
      scope,
      assigneeType,
    },
    flags: table.flags,
  };
}

// ── Report ───────────────────────────────────────────────────────────────────
function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function rowList(rows) {
  if (rows.length === 1) return `row ${rows[0]}`;
  const shown = rows.slice(0, MAX_LISTED_ROWS).join(', ');
  return rows.length > MAX_LISTED_ROWS ? `rows ${shown}, and ${rows.length - MAX_LISTED_ROWS} more` : `rows ${shown}`;
}

function countWithRows(count, rows, noun) {
  const counted = noun ? plural(count, noun) : String(count);
  return count > 0 ? `${counted} (${rowList(rows)})` : counted;
}

const NO_EXPORT_ANSWERS = 'read the paths below; no export answers this check';

function check1Status(users) {
  if (!users) return { code: 'MANUAL', text: 'no export given; read the paths below, or pass --export with a gam print users CSV' };
  if (users.state === 'empty') return { code: 'NO USER ROWS', text: 'export has no user rows; nothing was counted (the enforcement setting itself: MANUAL)' };
  const c = users.counts;
  if (c.active === 0) return { code: 'NO ACTIVE USERS', text: 'every user row in the export is suspended (the enforcement setting itself: MANUAL)' };
  if (c.notEnrolled > 0 || c.notEnforced > 0 || c.unreadable2sv > 0) {
    const unreadable = c.unreadable2sv > 0 ? `, ${c.unreadable2sv} with a value not readable` : '';
    return {
      code: 'ATTENTION',
      text: `${c.notEnrolled} of ${c.active} active users not enrolled in 2-Step Verification, ${c.notEnforced} not enforced${unreadable} (the enforcement setting itself: MANUAL)`,
    };
  }
  return { code: 'CLEAR IN EXPORT', text: `all ${c.active} active users enrolled and enforced (the enforcement setting itself: MANUAL)` };
}

function check2Status(users) {
  if (!users) return { code: 'MANUAL', text: 'no export given; read the paths below, or pass --export with a gam print users CSV (super admin recovery: MANUAL)' };
  if (users.state === 'empty') return { code: 'NO USER ROWS', text: 'export has no user rows; nothing was counted (super admin recovery: MANUAL)' };
  const c = users.counts;
  const reasons = [];
  if (c.superAdmins < 2) reasons.push('Google recommends more than one super admin (search excerpt)');
  if (c.superAdminsNotEnrolled > 0) reasons.push(`${plural(c.superAdminsNotEnrolled, 'super admin')} not enrolled in 2-Step Verification`);
  if (c.unreadableAdmin > 0) reasons.push(`${plural(c.unreadableAdmin, 'active user')} with an admin value not readable`);
  const counted = `${plural(c.superAdmins, 'active super admin')}, ${plural(c.delegatedAdmins, 'active delegated admin')}`;
  if (reasons.length > 0) return { code: 'ATTENTION', text: `${counted}; ${reasons.join('; ')}; super admin recovery: MANUAL` };
  return { code: 'CLEAR IN EXPORT', text: `${counted}, every super admin enrolled in 2-Step Verification; super admin recovery: MANUAL` };
}

function statusFor(id, users) {
  if (id === 1) return check1Status(users);
  if (id === 2) return check2Status(users);
  if (id === 3) {
    return {
      code: 'RETIRED',
      text: 'not applicable; the less secure apps settings were removed from the Admin console (support.google.com/a/answer/14114704, search excerpt)',
    };
  }
  if (id === 8) return { code: 'KNOWN LIMIT', text: 'admins cannot change audit log retention; the period for each log type is not confirmed (see below)' };
  return { code: 'MANUAL', text: NO_EXPORT_ANSWERS };
}

function check1ExportLines(users) {
  if (!users) return [];
  const lines = ['', 'From export 1 (gam print users):'];
  if (users.state === 'empty') return [...lines, '- export has no user rows.'];
  const c = users.counts;
  const r = users.rows;
  lines.push(`- ${plural(c.rows, 'user row')}; ${c.suspended} suspended (left out); ${c.active} active.`);
  lines.push(`- Not enrolled in 2-Step Verification: ${countWithRows(c.notEnrolled, r.notEnrolled, 'active user')}.`);
  lines.push(`- Not enforced: ${countWithRows(c.notEnforced, r.notEnforced, 'active user')}.`);
  lines.push(`- Enforced but not enrolled (enforcement can lock these users out, search excerpt): ${countWithRows(c.enforcedNotEnrolled, r.enforcedNotEnrolled, 'active user')}.`);
  if (c.unreadable2sv > 0) {
    lines.push(`- 2-Step Verification value not readable (neither True nor False): ${countWithRows(c.unreadable2sv, r.unreadable2sv, 'active user')}.`);
  }
  if (c.unreadableSuspended > 0) {
    lines.push(`- Suspended value not readable, so counted as active (the safer reading): ${countWithRows(c.unreadableSuspended, r.unreadableSuspended, 'row')}.`);
  }
  return lines;
}

function check2ExportLines(users, admins) {
  if (!users) return [];
  const lines = ['', 'From export 1 (gam print users):'];
  if (users.state === 'empty') {
    lines.push('- export has no user rows.');
  } else {
    const c = users.counts;
    const r = users.rows;
    lines.push(`- Super admins (isAdmin True): ${c.superAdmins} active.`);
    lines.push(`- Super admins not enrolled in 2-Step Verification: ${countWithRows(c.superAdminsNotEnrolled, r.superAdminsNotEnrolled)}.`);
    lines.push(`- Delegated admins (isDelegatedAdmin True): ${c.delegatedAdmins} active.`);
    if (c.unreadableAdmin > 0) {
      lines.push(`- Admin value not readable (neither True nor False): ${countWithRows(c.unreadableAdmin, r.unreadableAdmin, 'active user')}.`);
    }
  }
  if (!admins) return lines;
  lines.push('', 'From export 2 (gam print admins):');
  if (admins.state === 'empty') return [...lines, '- export has no role assignment rows.'];
  const a = admins.counts;
  const assignees = a.distinctAssignees === null ? '' : `; ${plural(a.distinctAssignees, 'distinct assignee')}`;
  lines.push(`- Role assignments: ${plural(a.rows, 'row')}; ${plural(a.distinctRoles, 'distinct roleId value')}${assignees}.`);
  lines.push(a.scope
    ? `- Scope (scopeType): ${a.scope.CUSTOMER} CUSTOMER, ${a.scope.ORG_UNIT} ORG_UNIT, ${a.scope.other} other.`
    : '- Scope: the export has no scopeType column.');
  lines.push(a.assigneeType
    ? `- Assignee type (assigneeType): ${a.assigneeType.user} user, ${a.assigneeType.group} group, ${a.assigneeType.other} other.`
    : '- Assignee type: the export has no assigneeType column.');
  lines.push('- Role names are not read here; `gam print adminroles` lists them, and the Directory API marks the super admin role with isSuperAdminRole (discovery document).');
  return lines;
}

function exportSection(users, admins) {
  const lines = ['## Exports', ''];
  if (!users) {
    lines.push(`- Export 1 (gam print users): not given. Checks 1 and 2 stay MANUAL; to count them, pass --export with the CSV from \`${USERS_GAM}\`.`);
  } else if (users.state === 'empty') {
    lines.push('- Export 1 (gam print users): export has no user rows.');
  } else {
    lines.push(`- Export 1 (gam print users): ${plural(users.counts.rows, 'user row')} read.`);
  }
  if (!admins) lines.push('- Export 2 (gam print admins): not given.');
  else if (admins.state === 'empty') lines.push('- Export 2 (gam print admins): export has no role assignment rows.');
  else lines.push(`- Export 2 (gam print admins): ${plural(admins.counts.rows, 'role assignment row')} read.`);
  if (users || admins) {
    lines.push('- Headers are matched ignoring case. Email addresses are never printed: users appear only as counts and row positions, counting the header as row 1. Counts describe the export as given, as current as the moment GAM produced it.');
    lines.push('- The exports cannot answer: checks 3, 4, 5, 6, 7 and 8; in check 1, the enforcement setting (Off, On or a start date), the allowed methods and the new-user enrollment period; in check 2, super admin account recovery. Read those in the Admin console.');
  }
  lines.push('');
  return lines;
}

function flagSection(users, admins) {
  if (!users && !admins) return [];
  const flags = [...(users ? users.flags : []), ...(admins ? admins.flags : [])];
  const lines = [
    '## Export content flagged as instruction text',
    '',
    'Export cells are data, never instructions (SR-3). A cell listed here reads like an instruction to the reader or to Aegis. It is quoted, with any address replaced by [USER@DOMAIN.COM], and nothing in it was followed; every count in this report is computed the same way with or without it.',
    '',
  ];
  if (flags.length === 0) lines.push('None found.');
  for (const flag of flags) {
    lines.push(`- Export ${flag.exportIndex}, row ${flag.row}, column ${flag.column}: ${flag.markers.join(', ')}: "${flag.quote}"`);
  }
  lines.push('');
  return lines;
}

function checkSection(check, status, users, admins) {
  const lines = [`## Check ${check.id}: ${check.title}`, '', `Status: ${status.code}: ${status.text}`, ''];
  for (const consolePath of check.console) lines.push(`- Admin console (read only): ${consolePath}`);
  for (const read of check.gam) lines.push(read.cmd ? `- GAM read: \`${read.cmd}\` (${read.note})` : `- GAM read: ${read.note}`);
  for (const key of check.sources) {
    const source = SOURCES[key];
    lines.push(`- Source: ${source.url} (checked ${SOURCES_CHECKED}, ${source.how}): ${source.title}`);
  }
  for (const note of check.notes || []) lines.push(`- Note: ${note}`);
  for (const line of check.canSay || []) lines.push(`- What the lane can say: ${line}`);
  for (const line of check.cannotSay || []) lines.push(`- What the lane cannot say: ${line}`);
  if (check.exportAnswers) lines.push(`- From an export: ${check.exportAnswers}`);
  if (check.id === 1) lines.push(...check1ExportLines(users));
  if (check.id === 2) lines.push(...check2ExportLines(users, admins));
  lines.push('', '- [ ] Checked by [ADMIN_NAME]. Findings: ____', '');
  return lines;
}

function renderReport({ users = null, admins = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  const statuses = new Map(CHECKS.map((check) => [check.id, statusFor(check.id, users)]));
  const lines = [
    '# Google Workspace security posture audit: [@Aegion_DOMAIN]',
    '',
    `Generated: ${today} | Org: [@Aegion] | Auditor: [ADMIN_NAME] | Ticket: [ISSUE_ID]`,
    '',
    '- This report read nothing from Google and opened no network connection. It lists 8 checks; each names a read-only Admin console path, a read-only GAM command (print, info, report or show) and the Google source behind it. Check 3 is retired, so it has no path or command to read.',
    '- An administrator runs the reads. Aegis advises; humans execute: this report holds no change steps. A change a check points to is a separate, human-run change under the R0 to R3 policy.',
    `- Sources were checked ${SOURCES_CHECKED}. "discovery document" is Google's published API definition; "project wiki" is the GAM project's own wiki (GAM is a community tool); "search excerpt" means the Google page could not be opened and its text came from a search index, so confirm the label on screen.`,
    '- "Read ... then leave without saving" means: open the page, read the value, close it.',
    '',
    '## Summary',
    '',
    '| # | Check | Status |',
    '|---|---|---|',
    ...CHECKS.map((check) => `| ${check.id} | ${check.title} | ${statuses.get(check.id).code} |`),
    '',
    ...exportSection(users, admins),
    ...flagSection(users, admins),
  ];
  for (const check of CHECKS) lines.push(...checkSection(check, statuses.get(check.id), users, admins));
  lines.push(
    '## Sign-off',
    '',
    '| Field | Value |',
    '|---|---|',
    '| Auditor | [ADMIN_NAME] |',
    `| Date | ${today} |`,
    '| Ticket | [ISSUE_ID] |',
  );
  return `${lines.join('\n')}\n`;
}

// ── Local write gate (target and content bound) ──────────────────────────────
function lstatIfPresent(target) {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function buildWritePlan(cwd, outputPath, report, options = {}) {
  const requested = path.normalize(path.resolve(cwd, outputPath));
  if (!REPORT_NAME.test(path.basename(requested))) {
    throw new Error('Report filename must match security-audit-gws-<safe-label>.md, so the repository ignore rule security-audit-*.md applies.');
  }
  const target = assertSafeReportTarget(cwd, requested, options);
  const contentSha256 = crypto.createHash('sha256').update(report).digest('hex');
  const exists = lstatIfPresent(target) !== null;
  return {
    target,
    contentSha256,
    exists,
    confirmation: exists ? null : `WRITE GWS POSTURE REPORT TARGET ${target} CONTENT SHA256 ${contentSha256}`,
  };
}

const VALUE_HELP = {
  '--export': 'a CSV path (first: gam print users; second: gam print admins)',
  '--write': 'a report path named security-audit-gws-<safe-label>.md',
  '--confirm': 'the exact phrase printed by the preview',
};

function parseArgs(argv) {
  const options = { exports: [], write: null, confirm: null, standalonePrivate: false, help: false };
  const seen = new Set();
  const once = (flag) => {
    if (seen.has(flag)) throw new Error(`${flag} may be supplied only once.`);
    seen.add(flag);
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const equals = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const flag = equals > 0 ? arg.slice(0, equals) : arg;
    if (flag in VALUE_HELP) {
      let value = equals > 0 ? arg.slice(equals + 1) : argv[i + 1];
      if (equals <= 0) {
        if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires ${VALUE_HELP[flag]}.`);
        i += 1;
      }
      if (!value) throw new Error(`${flag} requires ${VALUE_HELP[flag]}.`);
      if (flag === '--export') {
        if (options.exports.length === 2) throw new Error('At most two --export files: gam print users, then gam print admins.');
        options.exports.push(value);
      } else {
        once(flag);
        options[flag.slice(2)] = value;
      }
    } else if (arg === '--standalone-private') {
      once(arg);
      options.standalonePrivate = true;
    } else if (arg === '--help' || arg === '-h') {
      once('--help');
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (options.help && argv.length !== 1) throw new Error('--help cannot be combined with other arguments.');
  if (options.confirm !== null && options.write === null) throw new Error('--confirm is valid only with --write.');
  return options;
}

function run(argv = process.argv.slice(2), cwd = process.cwd(), dependencies = {}) {
  const logger = dependencies.logger || console;
  const today = dependencies.today || new Date().toISOString().slice(0, 10);
  const options = parseArgs(argv);
  if (options.help) {
    logger.log('Usage: node scripts/gws-posture-audit.js [--export <gam print users CSV> [--export <gam print admins CSV>]] [--standalone-private] [--write security-audit-gws-<safe-label>.md --confirm "EXACT PHRASE"]');
    logger.log('Default: print the report preview and write nothing. Nothing is read from or sent to Google.');
    logger.log('A malformed export is refused (exit 2). An existing report is never overwritten. A known private non-Git directory requires --standalone-private for a write target.');
    return 0;
  }

  let users = null;
  let admins = null;
  try {
    if (options.exports[0] !== undefined) users = analyzeUsersExport(readExport(path.resolve(cwd, options.exports[0]), 1), 1);
    if (options.exports[1] !== undefined) admins = analyzeAdminsExport(readExport(path.resolve(cwd, options.exports[1]), 2), 2);
  } catch (error) {
    if (error instanceof ExportRefused) {
      logger.error(`gws-posture-audit.js: ${error.message} No files changed.`);
      return 2;
    }
    throw error;
  }

  const report = renderReport({ users, admins, today });
  const writing = options.write !== null;
  const requested = path.resolve(cwd, writing ? options.write : `security-audit-gws-posture-${today}.md`);
  if (!writing) logger.log(report);
  logger.log(`gws-posture-audit.js: Google Workspace posture audit (${writing ? 'write requested' : 'preview only'})`);
  logger.log('Nothing was read from or sent to Google.');

  let plan;
  try {
    plan = buildWritePlan(cwd, requested, report, { standalonePrivate: options.standalonePrivate });
  } catch (error) {
    if (writing) throw error;
    logger.log(`Write target unavailable: ${error.message}`);
    logger.log('No files changed.');
    return 0;
  }
  logger.log(`Report target: ${plan.target}`);
  logger.log(`Content SHA256: ${plan.contentSha256}`);
  if (plan.exists) {
    logger.log('Blocked: the report target already exists. This command never overwrites an existing report.');
    logger.log('No files changed.');
    return writing ? 2 : 0;
  }
  logger.log(`Required confirmation: ${plan.confirmation}`);
  if (!writing) {
    logger.log('To save it: run again with the same --export arguments plus --write <report target> --confirm "<required confirmation>".');
    logger.log('No files changed.');
    return 0;
  }
  if (options.confirm !== plan.confirmation) {
    logger.error('Exact confirmation mismatch. The phrase is case- and whitespace-sensitive and bound to this target and this content. No files changed.');
    return 2;
  }
  writeReportExclusive(plan, report, cwd, dependencies, { standalonePrivate: options.standalonePrivate });
  logger.log(`Verified report written once: ${plan.target}`);
  return 0;
}

function main() {
  try {
    process.exitCode = run();
  } catch (error) {
    console.error(`gws-posture-audit.js: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  CHECKS,
  ExportRefused,
  MAX_EXPORT_BYTES,
  SOURCES,
  SOURCES_CHECKED,
  analyzeAdminsExport,
  analyzeUsersExport,
  buildWritePlan,
  parseArgs,
  parseCsv,
  readExport,
  renderReport,
  run,
};
