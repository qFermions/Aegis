'use strict';
// exo-client.js: the read-only Exchange Online connector (batch 9, task 4). README.md beside this
// file; owner setup in docs/aegis/owner/exchange-online-readonly.md; vendor facts in
// docs/aegis/batch9/vendor-facts.md ("Exchange Online (task 4)", facts X-01 and on).
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). This file reads Exchange Online through
// PowerShell 7 and the ExchangeOnlineManagement module, signed in app-only with a certificate, and
// runs four read cmdlets and nothing else: Get-MailboxPermission, Get-RecipientPermission,
// Get-Mailbox (its GrantSendOnBehalfTo field only) and Get-QuarantineMessage. It never grants or
// removes a permission, never changes a mailbox and never releases a message: each of those is a
// HUMAN-RUN step in a runbook, and a verify-* command below proves it afterwards.
//
// Usage: node scripts/adapters/exo-client.js <command> [flags] [--execute]
//   Reads (a dry run that prints the planned cmdlet unless --execute is given):
//     mailbox-permissions   --mailbox [SHARED_MAILBOX]   (an address or a GUID; Get-MailboxPermission -Identity)
//     recipient-permissions --mailbox [SHARED_MAILBOX]   (Get-RecipientPermission -Identity)
//     send-on-behalf        --mailbox [SHARED_MAILBOX]   (Get-Mailbox -Identity, GrantSendOnBehalfTo)
//     quarantine-message    --identity <GUID1\GUID2> | --message-id <Message-ID> --recipient [UPN]
//   Read-backs (exit 0 verified, 2 not verified, 4 a dry run, 5 inconclusive):
//     verify-mailbox-permission   --mailbox M --delegate [UPN] [--absent]   (Full Access granted, or gone)
//     verify-recipient-permission --mailbox M --delegate [UPN] [--absent]   (Send As granted, or gone)
//     verify-quarantine-released  --identity <GUID1\GUID2> | --message-id <Message-ID> --recipient [UPN]   (ReleaseStatus RELEASED)
//   Every verify-* takes --change chg-... (cli-support.js), checked before any read.
//
// Environment (names in .env.example; values never printed): EXO_APP_ID (the app registration's
// application ID), EXO_ORGANIZATION (the primary .onmicrosoft.com domain, vendor fact X-04), and
// one certificate: EXO_CERTIFICATE_PATH (a .pfx file, with EXO_CERTIFICATE_PASSWORD when it has
// one) or EXO_CERTIFICATE_THUMBPRINT (Windows only, a certificate in the user store, X-03).
// Exchange Online does not show an app its granted permission or role, so the result carries a
// scope_notice (scope-manifest.json "exo"); grant only Exchange.ManageAsApp and the Global Reader
// role (X-05, X-06).
//
// THE TRANSPORT SEAM (deps.transport; the tests and the desk simulator supply one instead of pwsh)
//   request:  one object { cmdlet, parameters }, already validated by checkRequest: cmdlet is one
//             of the four names in CMDLETS, parameters is a plain object whose keys are exactly one
//             of that cmdlet's fixed parameter sets and whose values are strings matching their
//             patterns.
//   response: { exitCode, stdout, stderr }: exitCode the pwsh exit code (an integer, 0 on success),
//             stdout what the fixed script printed, which is ConvertTo-Json of an array of records
//             (one JSON array, "[]" when the cmdlet returned nothing), stderr PowerShell's error
//             text, never printed or recorded. A transport may instead throw an error whose code is
//             AEGIS_TIMEOUT (TIMEOUT) or AEGIS_RESPONSE_TOO_LARGE (INVALID_RESPONSE); any other
//             error is NETWORK_ERROR, and the network tripwire is rethrown.
// The default transport (makePwshTransport) spawns pwsh with no shell, a timeout and an output cap,
// and throws the tripwire before spawning when AEGIS_NETWORK_TRIPWIRE=1.

const childProcess = require('node:child_process');
const {
  STATES, RefusedError, TripwireError, renderResult, exitCodeFor, parseArgs, redactDeep, dryRunExit, inconclusive, scanUntrusted, MAX_RESPONSE_BYTES,
} = require('./readonly-contract.js');
const { cliDeps, recordVerdict, takeChange, changeRefusal } = require('./cli-support.js');

const PLATFORM = 'exo';
const DEFAULT_TIMEOUT_MS = 180000; // Connect-ExchangeOnline alone can take tens of seconds
const STDERR_CAP_BYTES = 64 * 1024;

// ── Values ───────────────────────────────────────────────────────────────────
const GUID_SRC = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const GUID = new RegExp(`^${GUID_SRC}$`, 'i');
// an address with no quote, no $ and no other character PowerShell treats as syntax
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,8}$/;
const MAILBOX = new RegExp(`^(?:${EMAIL.source.slice(1, -1)}|${GUID_SRC})$`, 'i');
// a quarantined message's Identity, GUID1\GUID2 (vendor fact X-10)
const QUARANTINE_ID = new RegExp(`^${GUID_SRC}\\\\${GUID_SRC}$`, 'i');
// a Message-ID header with its angle brackets (X-11), narrowed to characters that are never syntax
const MESSAGE_ID = /^<[A-Za-z0-9._%+=-]{1,200}@[A-Za-z0-9.-]{1,190}>$/;
// Refused in any value before its pattern is even read, so the refusal names the reason: a
// statement separator, a pipe, a script block, the escape character, a variable or subexpression,
// a line break, or a straight or typographic quote. Every pattern above already excludes them.
const BREAKOUT = /[;|{}`$\r\n\u0000'"‘’‚‛“”„]/;

// The allow-list: each cmdlet with its fixed parameter sets. Nothing else is ever run.
const CMDLETS = Object.freeze({
  // the read-backs add the delegate as a server-side filter, which Exchange resolves in any form
  // (address, alias, display name), so a grant listed under another form of the name is still found
  'Get-MailboxPermission': Object.freeze([Object.freeze({ Identity: MAILBOX }), Object.freeze({ Identity: MAILBOX, User: EMAIL })]),
  'Get-RecipientPermission': Object.freeze([Object.freeze({ Identity: MAILBOX }), Object.freeze({ Identity: MAILBOX, Trustee: EMAIL })]),
  'Get-Mailbox': Object.freeze([Object.freeze({ Identity: MAILBOX })]),
  'Get-QuarantineMessage': Object.freeze([Object.freeze({ Identity: QUARANTINE_ID }), Object.freeze({ MessageId: MESSAGE_ID, RecipientAddress: EMAIL })]),
});

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

// The request the transport may receive, as a frozen copy, or a RefusedError. The CLI builds every
// request from fixed text, so this is the second check of the same rule; the seam keeps it for a
// caller (the desk simulator) that builds requests itself.
function checkRequest(request) {
  if (!isPlain(request)) throw new RefusedError('an Exchange Online request is an object { cmdlet, parameters }');
  const keys = Object.keys(request).sort();
  if (keys.join(',') !== 'cmdlet,parameters') throw new RefusedError('an Exchange Online request holds only cmdlet and parameters');
  const { cmdlet, parameters } = request;
  if (typeof cmdlet !== 'string' || !hasOwn(CMDLETS, cmdlet)) throw new RefusedError('that cmdlet is not one of the four Exchange Online reads Aegis may run');
  if (!isPlain(parameters)) throw new RefusedError(`${cmdlet} takes its parameters as an object of names to values`);
  const names = Object.keys(parameters).sort().join(',');
  const set = CMDLETS[cmdlet].find((s) => Object.keys(s).sort().join(',') === names);
  if (!set) throw new RefusedError(`${cmdlet} runs only with ${CMDLETS[cmdlet].map((s) => Object.keys(s).map((n) => `-${n}`).join(' ')).join(', or ')}`);
  for (const [name, rule] of Object.entries(set)) {
    const value = parameters[name];
    if (typeof value !== 'string') throw new RefusedError(`-${name} must be one text value`);
    if (BREAKOUT.test(value)) throw new RefusedError(`-${name} holds a character that could break out of a PowerShell command, so it is refused before PowerShell starts`);
    if (!rule.test(value)) throw new RefusedError(`-${name} is not an allowed value for ${cmdlet}`);
  }
  return Object.freeze({ cmdlet, parameters: Object.freeze({ ...parameters }) });
}

// ── The fixed PowerShell script ──────────────────────────────────────────────
// Why the values never become script text: pwsh -Command joins every argument after it into one
// command string and parses it, so a value passed that way could become code. Instead the script
// below is fixed text, sent with -EncodedCommand (base64 of its UTF-16LE bytes, the only command
// line argument that carries code), and the request travels as JSON in the child's environment
// variable AEGIS_EXO_REQUEST. The script parses that JSON as data (ConvertFrom-Json), checks the
// cmdlet and parameter names against its own copy of the allow-list, and passes the values by
// splatting (@p), which binds each value to its parameter without parsing it. Both checks in the script
// compare case-sensitively (-ccontains, -cnotcontains), as checkRequest does. Get-RecipientPermission
// runs with the fixed -ResultSize Unlimited, so a long list is not cut at its default 1000 (X-29). The credentials are
// in the child's environment too, so no secret is on the command line or in a process list.
// Connect-ExchangeOnline -CommandName loads only the four read cmdlets into the session (X-07).
const POWERSHELL_SCRIPT = String.raw`$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
$InformationPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'
$allowed = @{
  'Get-MailboxPermission' = @('Identity', 'Identity,User')
  'Get-RecipientPermission' = @('Identity', 'Identity,Trustee')
  'Get-Mailbox' = @('Identity')
  'Get-QuarantineMessage' = @('Identity', 'MessageId,RecipientAddress')
}
$req = ConvertFrom-Json -InputObject $env:AEGIS_EXO_REQUEST -AsHashtable
$cmdlet = [string]$req['cmdlet']
if (-not ($allowed.Keys -ccontains $cmdlet)) { exit 3 }
$p = @{}
foreach ($k in $req['parameters'].Keys) { $p[[string]$k] = [string]$req['parameters'][$k] }
$names = (@($p.Keys) | Sort-Object) -join ','
if ($allowed[$cmdlet] -cnotcontains $names) { exit 3 }
Import-Module ExchangeOnlineManagement
$c = @{ AppId = $env:EXO_APP_ID; Organization = $env:EXO_ORGANIZATION; CommandName = @($allowed.Keys); ShowBanner = $false }
if ($env:EXO_CERTIFICATE_THUMBPRINT) { $c['CertificateThumbprint'] = $env:EXO_CERTIFICATE_THUMBPRINT }
else {
  $c['CertificateFilePath'] = $env:EXO_CERTIFICATE_PATH
  if ($env:EXO_CERTIFICATE_PASSWORD) { $c['CertificatePassword'] = ConvertTo-SecureString -String $env:EXO_CERTIFICATE_PASSWORD -AsPlainText -Force }
}
Connect-ExchangeOnline @c | Out-Null
function Texts($v) { if ($null -eq $v) { return $null } ; return ,@($v | ForEach-Object { "$_" }) }
try {
  $rows = switch ($cmdlet) {
    'Get-MailboxPermission' { Get-MailboxPermission @p | ForEach-Object { [ordered]@{ Identity = "$($_.Identity)"; User = "$($_.User)"; AccessRights = (Texts $_.AccessRights); Deny = $_.Deny; IsInherited = $_.IsInherited } } }
    'Get-RecipientPermission' { Get-RecipientPermission @p -ResultSize Unlimited | ForEach-Object { [ordered]@{ Identity = "$($_.Identity)"; Trustee = "$($_.Trustee)"; AccessControlType = "$($_.AccessControlType)"; AccessRights = (Texts $_.AccessRights); IsInherited = $_.IsInherited } } }
    'Get-Mailbox' { Get-Mailbox @p | ForEach-Object { [ordered]@{ Identity = "$($_.Identity)"; GrantSendOnBehalfTo = (Texts $_.GrantSendOnBehalfTo) } } }
    'Get-QuarantineMessage' { Get-QuarantineMessage @p | ForEach-Object { [ordered]@{ Identity = "$($_.Identity)"; MessageId = "$($_.MessageId)"; RecipientAddress = (Texts $_.RecipientAddress); ReleasedUser = (Texts $_.ReleasedUser); ReleaseStatus = "$($_.ReleaseStatus)"; Type = "$($_.Type)" } } }
  }
  $out = [System.Collections.ArrayList]::new()
  foreach ($row in $rows) { if ($null -ne $row) { [void]$out.Add($row) } }
  ConvertTo-Json -InputObject $out.ToArray() -Depth 4 -Compress -EnumsAsStrings
} finally { Disconnect-ExchangeOnline -Confirm:$false | Out-Null }
`;
const ENCODED_SCRIPT = Buffer.from(POWERSHELL_SCRIPT, 'utf16le').toString('base64');

// The variables the child gets: what pwsh needs to start and find its modules, the connector's own
// credentials, and the request. Nothing else from the parent's environment reaches it.
const CHILD_ENV_NAMES = ['PATH', 'Path', 'HOME', 'USERPROFILE', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'LOCALAPPDATA', 'APPDATA', 'PSModulePath', 'ProgramFiles', 'ProgramData'];
const CREDENTIAL_NAMES = ['EXO_APP_ID', 'EXO_ORGANIZATION', 'EXO_CERTIFICATE_PATH', 'EXO_CERTIFICATE_PASSWORD', 'EXO_CERTIFICATE_THUMBPRINT'];

const coded = (message, code) => Object.assign(new Error(message), { code });

// spawnFn is child_process.spawn in use and a fake in the tests; env holds the credentials.
function makePwshTransport(spawnFn, { env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = MAX_RESPONSE_BYTES } = {}) {
  return function pwshTransport(request) {
    if (process.env.AEGIS_NETWORK_TRIPWIRE === '1') throw new TripwireError();
    const childEnv = {};
    for (const name of CHILD_ENV_NAMES) if (typeof process.env[name] === 'string') childEnv[name] = process.env[name];
    for (const name of CREDENTIAL_NAMES) if (typeof env[name] === 'string' && env[name].length) childEnv[name] = env[name];
    childEnv.AEGIS_EXO_REQUEST = JSON.stringify(request);
    return new Promise((resolve, reject) => {
      let done = false;
      let size = 0;
      const out = [];
      const errText = [];
      let errSize = 0;
      const child = spawnFn('pwsh', ['-NoLogo', '-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-EncodedCommand', ENCODED_SCRIPT], { shell: false, windowsHide: true, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
      const finish = (fn, value) => { if (done) return; done = true; clearTimeout(timer); fn(value); };
      const stop = (error) => { try { child.kill('SIGKILL'); } catch { /* already gone */ } finish(reject, error); };
      const timer = setTimeout(() => stop(coded(`no answer within ${timeoutMs} ms`, 'AEGIS_TIMEOUT')), timeoutMs);
      child.stdout.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) { stop(coded('answer larger than the read limit', 'AEGIS_RESPONSE_TOO_LARGE')); return; }
        out.push(Buffer.from(chunk));
      });
      child.stderr.on('data', (chunk) => { if (errSize < STDERR_CAP_BYTES) { errSize += chunk.length; errText.push(Buffer.from(chunk)); } });
      child.on('error', (error) => finish(reject, error));
      child.on('close', (code) => finish(resolve, { exitCode: Number.isInteger(code) ? code : -1, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(errText).toString('utf8').slice(0, STDERR_CAP_BYTES) }));
    });
  };
}

// ── One call through the seam ────────────────────────────────────────────────
const result = (state, extra = {}) => ({ state, ok: state === STATES.OK, ...extra });

// One connector-call entry per call, as readonly-contract.js records an HTTP request: names, a state
// and numbers, never a value. A sink that throws withholds the answer (AUDIT_FAILED).
function record(audit, operation, r, attempts, startedAt, now) {
  if (!audit) return null;
  try {
    audit({ kind: 'connector-call', connector: PLATFORM, operation, state: r.state, attempts, status: null, request_id: null, handoff: null, duration_ms: Math.max(0, Math.round(now() - startedAt)) });
    return null;
  } catch {
    return result(STATES.AUDIT_FAILED, { attempts, error: 'the audit trail could not record this request, so its answer is withheld' });
  }
}

// Checks the request, calls the transport once (a PowerShell session is not retried: a repeated
// sign-in is slow and adds nothing a person cannot do by running the command again), and reads the
// answer: { state: OK, data } with data the parsed JSON, or a failed state.
async function callExo(request, { transport, audit = null, now = Date.now } = {}) {
  const startedAt = now();
  let checked;
  try {
    checked = checkRequest(request);
  } catch (error) {
    if (!(error instanceof RefusedError)) throw error;
    const r = result(STATES.REFUSED, { attempts: 0, error: error.message });
    return record(audit, 'refused-request', r, 0, startedAt, now) || r;
  }
  if (typeof transport !== 'function') throw new Error('callExo needs a transport');
  let res;
  let r;
  try {
    res = await transport(checked);
  } catch (error) {
    if (error instanceof TripwireError || (error && error.name === 'NetworkTripwireError')) throw new TripwireError();
    if (error && error.code === 'AEGIS_TIMEOUT') r = result(STATES.TIMEOUT, { error: 'PowerShell did not answer in time (it was stopped)' });
    else if (error && error.code === 'AEGIS_RESPONSE_TOO_LARGE') r = result(STATES.INVALID_RESPONSE, { error: 'answer larger than the read limit' });
    else r = result(STATES.NETWORK_ERROR, { error: 'PowerShell could not be started or the session failed (details withheld)' });
  }
  if (!r) {
    if (!res || !Number.isInteger(res.exitCode) || typeof res.stdout !== 'string') r = result(STATES.INVALID_RESPONSE, { error: 'the transport returned no exit code or output' });
    else if (res.exitCode !== 0) r = result(STATES.NETWORK_ERROR, { error: `PowerShell exited with code ${res.exitCode} (its error text is withheld)` });
    // a non-terminating error can leave exit code 0 and a short or empty list: error text means the
    // answer is not trusted (code review of batch 9 task 4, finding 1)
    else if (typeof res.stderr === 'string' && res.stderr.trim()) r = result(STATES.INVALID_RESPONSE, { error: 'PowerShell wrote error text although it exited 0, so its answer is not used (text withheld)' });
    else if (Buffer.byteLength(res.stdout, 'utf8') > MAX_RESPONSE_BYTES) r = result(STATES.INVALID_RESPONSE, { error: 'answer larger than the read limit' });
    else {
      try { r = result(STATES.OK, { data: JSON.parse(res.stdout) }); } catch { r = result(STATES.INVALID_RESPONSE, { error: 'the answer is not JSON (output withheld)', notJson: true }); }
    }
  }
  r.attempts = 1;
  return record(audit, checked.cmdlet, r, 1, startedAt, now) || r;
}

// ── Commands ─────────────────────────────────────────────────────────────────
const RULES = { mailbox: MAILBOX, delegate: EMAIL, identity: QUARANTINE_ID, 'message-id': MESSAGE_ID, recipient: EMAIL };
const VALUE_FLAGS = Object.keys(RULES);
const BOOLEAN_FLAGS = ['execute', 'absent'];
const req = (cmdlet, parameters) => ({ cmdlet, parameters });
const QUARANTINE_FLAGS = ['identity', 'message-id', 'recipient'];
const quarantineRequest = (a) => (a.identity !== undefined
  ? req('Get-QuarantineMessage', { Identity: a.identity })
  : req('Get-QuarantineMessage', { MessageId: a['message-id'], RecipientAddress: a.recipient }));
const target = (a) => (a.identity !== undefined ? { identity: a.identity } : { message_id: a['message-id'], recipient: a.recipient });

const COMMANDS = Object.freeze({
  'mailbox-permissions': { kind: 'read', flags: ['mailbox'], requests: (a) => [req('Get-MailboxPermission', { Identity: a.mailbox })] },
  'recipient-permissions': { kind: 'read', flags: ['mailbox'], requests: (a) => [req('Get-RecipientPermission', { Identity: a.mailbox })] },
  'send-on-behalf': { kind: 'read', flags: ['mailbox'], requests: (a) => [req('Get-Mailbox', { Identity: a.mailbox })] },
  'quarantine-message': { kind: 'read', optional: QUARANTINE_FLAGS, requests: (a) => [quarantineRequest(a)] },
  // Full Access: the delegate as -User, which Exchange resolves (no Sid caveat is documented for it)
  'verify-mailbox-permission': { kind: 'verify', flags: ['mailbox', 'delegate'], booleans: ['absent'], requests: (a) => [req('Get-MailboxPermission', { Identity: a.mailbox, User: a.delegate })], expected: (a) => ({ mailbox: a.mailbox, delegate: a.delegate, full_access: !a.absent }) },
  // Send As: -Trustee resolves the delegate but can miss a principal with several Sids (X-13), so the
  // whole list is read too and both must agree
  'verify-recipient-permission': { kind: 'verify', flags: ['mailbox', 'delegate'], booleans: ['absent'], requests: (a) => [req('Get-RecipientPermission', { Identity: a.mailbox, Trustee: a.delegate }), req('Get-RecipientPermission', { Identity: a.mailbox })], expected: (a) => ({ mailbox: a.mailbox, delegate: a.delegate, send_as: !a.absent }) },
  'verify-quarantine-released': { kind: 'verify', optional: QUARANTINE_FLAGS, requests: (a) => [quarantineRequest(a)], expected: (a) => ({ ...target(a), ReleaseStatus: 'RELEASED' }) },
});

const USAGE = `Usage: node scripts/adapters/exo-client.js <command> [flags] [--execute]
  Commands: ${Object.keys(COMMANDS).join(' | ')}
  Runs only Get-MailboxPermission, Get-RecipientPermission, Get-Mailbox (GrantSendOnBehalfTo) and Get-QuarantineMessage, in pwsh, app-only with a certificate.
  The credentials are read and PowerShell is started only with --execute.
`;

function validate(command, def, args) {
  const allowedBooleans = new Set(['execute', ...(def.booleans || [])]);
  const takes = [...(def.flags || []), ...(def.optional || [])];
  for (const key of Object.keys(args)) {
    if (key === '_command') continue;
    if (BOOLEAN_FLAGS.includes(key) ? !allowedBooleans.has(key) : !takes.includes(key)) throw new RefusedError(`${command} takes no --${key}`);
  }
  for (const f of def.flags || []) if (args[f] === undefined) throw new RefusedError(`${command} needs --${f}`);
  if (def.optional) {
    const byIdentity = args.identity !== undefined;
    const byMessage = args['message-id'] !== undefined || args.recipient !== undefined;
    if (byIdentity === byMessage || (byMessage && (args['message-id'] === undefined || args.recipient === undefined))) throw new RefusedError(`${command} needs --identity, or --message-id with --recipient`);
  }
  for (const f of takes) {
    if (args[f] === undefined) continue;
    if (BREAKOUT.test(args[f])) throw new RefusedError(`--${f} holds a character that could break out of a PowerShell command (; | { } \` $ a quote or a line break), so it is refused before PowerShell starts`);
    if (!RULES[f].test(args[f])) throw new RefusedError(`--${f} is not an allowed value for ${command}${f === 'delegate' ? ' (the delegate\'s address, which the answer names)' : ''}`);
  }
  return { ...args };
}

// The credentials, or the names of the ones missing; the formats a sign-in needs are checked too.
function credentialProblem(env) {
  const set = (n) => typeof env[n] === 'string' && env[n].length > 0;
  const missing = ['EXO_APP_ID', 'EXO_ORGANIZATION'].filter((n) => !set(n));
  if (!set('EXO_CERTIFICATE_PATH') && !set('EXO_CERTIFICATE_THUMBPRINT')) missing.push('EXO_CERTIFICATE_PATH or EXO_CERTIFICATE_THUMBPRINT');
  if (missing.length) return result(STATES.NO_CREDENTIALS, { error: `missing credential environment variable(s): ${missing.join(', ')}` });
  if (set('EXO_CERTIFICATE_PATH') && set('EXO_CERTIFICATE_THUMBPRINT')) return result(STATES.REFUSED, { error: 'set EXO_CERTIFICATE_PATH or EXO_CERTIFICATE_THUMBPRINT, not both' });
  if (!GUID.test(env.EXO_APP_ID)) return result(STATES.REFUSED, { error: 'EXO_APP_ID must be the application ID (a GUID)' });
  if (!/^[A-Za-z0-9-]{1,63}\.onmicrosoft\.com$/.test(env.EXO_ORGANIZATION)) return result(STATES.REFUSED, { error: 'EXO_ORGANIZATION must be the primary .onmicrosoft.com domain' });
  if (set('EXO_CERTIFICATE_THUMBPRINT') && !/^[0-9A-Fa-f]{40}$/.test(env.EXO_CERTIFICATE_THUMBPRINT)) return result(STATES.REFUSED, { error: 'EXO_CERTIFICATE_THUMBPRINT must be 40 hex characters' });
  return null;
}

// ── Read-backs ───────────────────────────────────────────────────────────────
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const unproven = (observed, reason) => ({ inconclusive: true, verified: false, observed, reason });
const sameAddress = (x, y) => typeof x === 'string' && x.trim().toLowerCase() === y.toLowerCase();
const SELF = /^NT AUTHORITY\\SELF$/i;
// AccessRights as lower-case tokens ("FullAccess", ["FullAccess","ReadPermission"], "{SendAs}"), or
// null when it is not text
function rightsOf(value) {
  const list = typeof value === 'string' ? [value] : Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : null;
  return list ? list.flatMap((v) => v.split(/[\s,{}]+/)).filter(Boolean).map((v) => v.toLowerCase()) : null;
}
const NOT_A_LIST = 'the answer is not a list of records, so this is not proof either way';
const NOT_JSON = 'the answer is not JSON, so this is not proof either way';

// The permission read-backs (Full Access on Get-MailboxPermission, Send As on Get-RecipientPermission).
// entriesOf checks every entry's fields and that the answer covers one mailbox only: a non-existent
// Identity can return every object (vendor facts X-10, X-14).
function entriesOf(data, { right, who, deny }) {
  if (!Array.isArray(data)) return { problem: NOT_A_LIST };
  for (const r of data) {
    if (!isObject(r) || typeof r.Identity !== 'string' || typeof r[who] !== 'string' || typeof r.IsInherited !== 'boolean' || rightsOf(r.AccessRights) === null || deny(r) === null) {
      return { problem: `a permission entry is missing Identity, ${who}, AccessRights, IsInherited or its allow or deny field, so this is not proof either way` };
    }
  }
  if (new Set(data.map((r) => r.Identity.toLowerCase())).size > 1) return { problem: 'the answer covers more than one mailbox, so this is not proof either way' };
  return { all: data, withRight: data.filter((r) => rightsOf(r.AccessRights).includes(right)) };
}

// The answer filtered on the delegate (-User or -Trustee): every entry is the delegate's, inherited or
// direct, named by whatever form Exchange prints. An entry for SELF or for another address means the
// filter did not apply, so nothing in it is judged.
function filteredGrant(a, data, spec) {
  const e = entriesOf(data, spec);
  if (e.problem) return e;
  const stray = e.all.filter((r) => SELF.test(r[spec.who].trim()) || (EMAIL.test(r[spec.who].trim()) && !sameAddress(r[spec.who], a.delegate)));
  if (stray.length) return { problem: 'the answer filtered on the delegate names another principal, so the filter did not apply and this is not proof either way' };
  if (e.withRight.some((r) => spec.deny(r) === true)) return { problem: `a Deny ${spec.label} entry names the delegate, which this read-back does not judge; check it in the Exchange admin center` };
  return { granted: e.withRight.length > 0, count: e.withRight.length };
}

// The whole list (Send As only): the delegate matched by address, and any allowed entry, inherited or
// direct, that names a principal by a name that is not an address may be the delegate's.
function listedGrant(a, data, spec) {
  const e = entriesOf(data, spec);
  if (e.problem) return e;
  const mine = e.withRight.filter((r) => sameAddress(r[spec.who], a.delegate));
  if (mine.some((r) => spec.deny(r) === true)) return { problem: `a Deny ${spec.label} entry names the delegate, which this read-back does not judge; check it in the Exchange admin center` };
  const unnamed = e.withRight.filter((r) => spec.deny(r) === false && !EMAIL.test(r[spec.who].trim()) && !SELF.test(r[spec.who].trim()));
  return { granted: mine.length > 0, unnamed: unnamed.length, count: e.withRight.length };
}

// answers: the filtered answer, then (Send As) the whole list. Known limit: a grant to a group the
// delegate belongs to is not read as the delegate's.
function judgePermission(a, answers, spec) {
  const filtered = filteredGrant(a, answers[0], spec);
  if (filtered.problem) return unproven({ delegate_entries: null }, filtered.problem);
  const listed = answers.length > 1 ? listedGrant(a, answers[1], spec) : null;
  if (listed && listed.problem) return unproven({ delegate_entries: filtered.count }, listed.problem);
  const observed = { delegate_entries: filtered.count, ...(listed ? { listed_entries: listed.count } : {}) };
  const granted = filtered.granted || Boolean(listed && listed.granted);
  if (granted) return a.absent ? { verified: false, observed, reason: `the delegate still has ${spec.label}` } : { verified: true, observed };
  if (listed && listed.unnamed) return unproven({ ...observed, unnamed_entries: listed.unnamed }, `${listed.unnamed} ${spec.label} entr${listed.unnamed === 1 ? 'y names' : 'ies name'} a principal by a name that is not an address, which may be the delegate, so this is not proof either way`);
  return a.absent ? { verified: true, observed } : { verified: false, observed, reason: `no ${spec.label} entry names the delegate` };
}

// ReleaseStatus values (vendor fact X-09), compared in upper case: the output prints RELEASED
const RELEASE_STATUSES = ['APPROVED', 'DENIED', 'ERROR', 'NOTRELEASED', 'PREPARINGTORELEASE', 'RELEASED', 'REQUESTED'];
function judgeQuarantine(a, data) {
  if (!Array.isArray(data)) return unproven({ records: null }, NOT_A_LIST);
  const records = data.filter(isObject);
  const candidates = a.identity !== undefined
    ? records.filter((r) => typeof r.Identity === 'string' && r.Identity.toLowerCase() === a.identity.toLowerCase())
    : records.filter((r) => r.MessageId === a['message-id'] && (rightsOf(r.RecipientAddress) || []).includes(a.recipient.toLowerCase()));
  if (candidates.length !== 1) {
    const why = candidates.length === 0
      ? 'no quarantined message in the answer matches (a summary read covers the last 16 days by default), so this is not proof either way'
      : `${candidates.length} quarantined messages match, so this read cannot judge one of them`;
    return unproven({ records: data.length, candidates: candidates.length }, why);
  }
  const status = typeof candidates[0].ReleaseStatus === 'string' ? candidates[0].ReleaseStatus.trim().toUpperCase() : '';
  if (!RELEASE_STATUSES.includes(status)) return unproven({ records: data.length, ReleaseStatus: null }, 'ReleaseStatus is missing or not a value this read knows, so this is not proof either way');
  if (status !== 'RELEASED') return { verified: false, observed: { ReleaseStatus: status }, reason: `ReleaseStatus is ${status}, not RELEASED` };
  // a message to several recipients may be released to some of them only, and ReleaseStatus is the
  // message's (code review of batch 9 task 4, finding 3): then the recipients the read asks about (the
  // one given, or all of them) must be listed in ReleasedUser (vendor fact X-28)
  const recipients = rightsOf(candidates[0].RecipientAddress) || [];
  if (recipients.length <= 1) return { verified: true, observed: { ReleaseStatus: status, recipients: recipients.length } };
  const released = rightsOf(candidates[0].ReleasedUser);
  if (!released) return unproven({ ReleaseStatus: status, recipients: recipients.length, ReleasedUser: null }, `the message has ${recipients.length} recipients and the answer does not say which were released (no ReleasedUser), so this is not proof either way`);
  const need = a.identity !== undefined ? recipients : [a.recipient.toLowerCase()];
  const missing = need.filter((x) => !released.includes(x)).length;
  return missing
    ? { verified: false, observed: { ReleaseStatus: status, recipients: recipients.length, not_released: missing }, reason: `ReleaseStatus is RELEASED, but ${missing} of the recipients asked about ${missing === 1 ? 'is' : 'are'} not in ReleasedUser` }
    : { verified: true, observed: { ReleaseStatus: status, recipients: recipients.length } };
}

const PERMISSIONS = {
  'verify-mailbox-permission': { right: 'fullaccess', who: 'User', label: 'Full Access', deny: (r) => (typeof r.Deny === 'boolean' ? r.Deny : null) },
  'verify-recipient-permission': { right: 'sendas', who: 'Trustee', label: 'Send As', deny: (r) => (r.AccessControlType === 'Allow' ? false : r.AccessControlType === 'Deny' ? true : null) },
};
// answers: the parsed answer of each of the command's requests, in order
function judge(command, a, answers) {
  if (PERMISSIONS[command]) return judgePermission(a, answers, PERMISSIONS[command]);
  if (command === 'verify-quarantine-released') return judgeQuarantine(a, answers[0]);
  throw new RefusedError('unknown read-back');
}

const SCOPE_NOTICE = 'Exchange Online does not show an app its granted permission or role, so Aegis could not check that this credential is read-only; grant only Exchange.ManageAsApp and the Global Reader role (docs/aegis/owner/exchange-online-readonly.md, scripts/adapters/scope-manifest.json "exo")';

// ── CLI ──────────────────────────────────────────────────────────────────────
async function run(argv, env = process.env, deps = {}) {
  const out = deps.out || ((s) => process.stdout.write(s));
  const err = deps.err || ((s) => process.stderr.write(s));
  const now = deps.now || Date.now;
  const secrets = () => ['EXO_APP_ID', 'EXO_CERTIFICATE_PATH', 'EXO_CERTIFICATE_PASSWORD', 'EXO_CERTIFICATE_THUMBPRINT'].map((n) => env[n]).filter((v) => typeof v === 'string' && v.length >= 4);
  // --change binds a verify-* read-back to its change record (cli-support.js), checked before any read
  const bound = takeChange(argv);
  try {
    const args = parseArgs(bound.argv, { values: VALUE_FLAGS, booleans: BOOLEAN_FLAGS });
    const command = args._command;
    if (command === 'help' || command === '--help') { out(USAGE); return 0; }
    if (typeof command !== 'string' || !hasOwn(COMMANDS, command)) {
      err(USAGE);
      throw new RefusedError(command === undefined ? 'no command given' : 'unknown command; no command changes Exchange Online');
    }
    const def = COMMANDS[command];
    const a = validate(command, def, args);
    const requests = def.requests(a).map(checkRequest);
    const request = requests[0];
    const cli = cliDeps(deps, env);
    const refusal = changeRefusal(PLATFORM, command, bound, cli.audit);
    if (refusal) throw new RefusedError(refusal);

    if (args.execute !== true) {
      const shown = { state: STATES.OK, ok: true, command, cmdlet: request.cmdlet, parameters: request.parameters };
      if (requests.length > 1) shown.then = requests.slice(1);
      if (def.kind === 'verify') shown.expected = def.expected(a);
      shown.auth = 'with --execute: pwsh -EncodedCommand of a fixed script, Connect-ExchangeOnline app-only with the certificate (-AppId, -Organization, -CertificateFilePath or -CertificateThumbprint) and -CommandName limited to the four read cmdlets';
      shown.note = 'dry run: no credentials read, no PowerShell started';
      shown.next = 'Add --execute to perform this read.';
      out(renderResult(shown, { platform: PLATFORM }));
      return dryRunExit(command, err);
    }

    const problem = credentialProblem(env);
    let res;
    if (problem) {
      res = record(cli.audit, request.cmdlet, problem, 0, now(), now) || { command, ...problem, attempts: 0 };
    } else {
      const transport = cli.transport || makePwshTransport(childProcess.spawn, { env, timeoutMs: deps.timeoutMs || DEFAULT_TIMEOUT_MS });
      // each request in turn; the first that fails ends the read
      let r;
      const answers = [];
      for (const each of requests) {
        r = await callExo(each, { transport, audit: cli.audit, now });
        if (r.state !== STATES.OK) break;
        answers.push(r.data);
      }
      const flags = r.state === STATES.OK ? scanUntrusted(answers.length === 1 ? answers[0] : answers) : [];
      if (def.kind === 'verify' && (r.state === STATES.OK || r.notJson)) {
        const judged = r.notJson ? unproven({ entries: null }, NOT_JSON) : judge(command, a, answers);
        let verdict = { state: STATES.OK, ok: true, command, verified: judged.verified === true, expected: def.expected(a), observed: judged.observed, scope_notice: SCOPE_NOTICE, ...(flags.length ? { flags } : {}) };
        if (judged.inconclusive) verdict = inconclusive(verdict, judged.reason);
        else if (!verdict.verified) verdict.reason = judged.reason;
        res = recordVerdict(cli.audit, PLATFORM, verdict, bound.change, null, bound.argv);
      } else if (r.state === STATES.OK) {
        res = { state: STATES.OK, ok: true, command, cmdlet: request.cmdlet, attempts: r.attempts, data: r.data, scope_notice: SCOPE_NOTICE, ...(flags.length ? { flags } : {}) };
      } else {
        const { notJson: _n, data: _d, ...failed } = r;
        res = { command, ...failed };
      }
    }
    const shown = redactDeep(res, secrets());
    const code = exitCodeFor(shown);
    (code === 1 ? err : out)(renderResult(shown, { secrets: secrets(), platform: PLATFORM, operation: command }));
    return code;
  } catch (error) {
    if (error instanceof TripwireError || (error && error.name === 'NetworkTripwireError')) throw error;
    if (error instanceof RefusedError) {
      err(renderResult({ state: STATES.REFUSED, ok: false, error: error.message }, { secrets: secrets(), platform: PLATFORM }));
      return 1;
    }
    err(renderResult({ state: STATES.INVALID_RESPONSE, ok: false, error: 'unexpected adapter error (details withheld)' }, { platform: PLATFORM }));
    return 2;
  }
}

if (require.main === module) {
  run(process.argv.slice(2), process.env).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(error && error.name === 'NetworkTripwireError' ? 'Network tripwire fired\n' : 'exo-client: unexpected error (details withheld)\n');
    process.exitCode = 2;
  });
}

const SCOPES = Object.freeze({ manifest: 'exo', kind: 'none', vendor: 'Exchange Online' });

module.exports = { run, COMMANDS, CMDLETS, checkRequest, callExo, makePwshTransport, POWERSHELL_SCRIPT, SCOPES, SCOPE_NOTICE, USAGE };
