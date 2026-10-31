'use strict';
// jamf-client.js: the read-only Jamf Pro adapter for lane G2 (docs/aegis/lanes/g2.md,
// Jamf Pro section), built on the shared contract readonly-contract.js (README.md here).
//
// Aegis advises; humans execute (PRODUCT_CONTRACT.md). This file reads Jamf Pro through
// thirteen GET routes and nothing else. It never sends an MDM command, edits a profile,
// policy or group, creates a patch title or an update plan, or reads a FileVault key, a
// Recovery Lock password or a local admin password: each change is a HUMAN-RUN step in
// a runbook under .claude/commands/, and a verify-* command below proves it afterwards.
//
// Usage: node scripts/adapters/jamf-client.js <command> [flags] [--execute]
//   Reads (a dry run that prints the planned request unless --execute is given):
//     version
//     computer --serial [SERIAL_NUMBER] [--section GENERAL|HARDWARE|OPERATING_SYSTEM|
//              DISK_ENCRYPTION|CONFIGURATION_PROFILES|GROUP_MEMBERSHIPS|APPLICATIONS]
//     computer-detail --id [DEVICE_ID]          commands --management-id [DEVICE_ID]
//     smart-groups --name [SMART_GROUP]         group-members --id N
//     profile --id [PROFILE_ID]                 policy --id [POLICY_ID]
//     history --id N --subset PolicyLogs|Commands
//     patch-titles | patch-report --id N | update-plans | update-plan-events --id [PLAN_UUID]
//   Read-backs (also a dry run unless --execute):
//     verify-command     --management-id [DEVICE_ID] --type [COMMAND_TYPE] --not-before [NOT_BEFORE]
//                        [--profile-identifier [PROFILE_IDENTIFIER]] (required for INSTALL_PROFILE
//                        and REMOVE_PROFILE, so a command for another profile is never proof)
//     verify-profile     --serial [SERIAL_NUMBER] --profile-id [PROFILE_ID]
//                        --profile-identifier [PROFILE_IDENTIFIER] [--absent]
//     verify-group-count --id N --expect N
//     verify-filevault   --serial [SERIAL_NUMBER]
//     verify-policy      --id [POLICY_ID] and at least one of [--trigger T] [--frequency F]
//                        [--enabled true|false] [--no-triggers] (a policy that merely exists
//                        proves no change, so the bare form is refused)
//     verify-checked-in  --serial [SERIAL_NUMBER] --not-before [NOT_BEFORE] (general.lastContactTime
//                        at or after the time; Jamf Pro defines no last MDM check-in field)
//
// Environment, read only after a request is allowed (the host for a dry run too, the
// credentials only under --execute):
//   JAMF_URL            the Jamf Pro server ([@Aegion_JAMF_URL]) as a bare hostname,
//                       no scheme, path or port (the contract refuses anything else).
//   JAMF_CLIENT_ID      an API client whose API role holds read privileges only.
//   JAMF_CLIENT_SECRET  its secret. Both go only into the token exchange,
//                       POST /api/oauth/token, form-encoded grant_type=client_credentials,
//                       client_id and client_secret, never retried. Reads carry the
//                       access token as "Authorization: Bearer <token>" and every read,
//                       Classic API (/JSSResource) reads included, asks for JSON.
//
// Every response has its key-like fields (any key matching
// /recoveryKey|personalRecoveryKey|password|passcode|pin$/i, at any depth) removed
// before it is returned or printed; the output lists the paths it removed. Secret
// values can also sit under keys that do not look like one, so these are withheld
// too, at any depth and on every read:
//   - a configuration profile's payloads (an XML property list that can carry Wi-Fi,
//     802.1X, VPN and directory-bind passwords, certificates and SCEP challenges): the
//     field is removed and only each payload's PayloadType, PayloadIdentifier and
//     PayloadDisplayName are printed, under payloadSummary;
//   - a policy's script parameters (parameter4 to parameter11) and its run_command;
//   - the values of an extension attribute whose name matches
//     /pass|secret|token|key|pin/i, or that carries no name (a "LAPS Password"
//     attribute, for example); its name stays.
// The instruction-text scan runs on what is left.
//
// Exit codes: 0 read or verified; 1 refused, input error or missing credentials;
// 2 the read failed or a verify-* read did not prove the write. Jamf Pro serves one
// tenant per server and is bound by JAMF_URL, so no read returns exit 3. 4 a verify-* dry
// run (nothing was read, so nothing is verified).
//
// Facts the lane could not confirm (vendor pages unreachable, docs/aegis/lanes/g2.md),
// and the safer reading taken here:
//   - The token path. One search excerpt shows /api/v1/oauth/token; the lane allows
//     /api/oauth/token only. The response fields access_token and expires_in are the
//     OAuth 2.0 client-credentials names; an answer without access_token ends the run.
//   - Response field names and shapes (inventory, membership, MDM commands, Classic
//     policy) are not confirmed. Every verify-* reads a named field, and a missing,
//     doubled or unexpected field is reported as not proven, never as proof.
//   - The serial number filter field (hardware.serialNumber) is the one the G1 runbook
//     uses; each Mac read-back first confirms the serial number on the record itself.
//   - MDM command status values are not confirmed: only "Acknowledged" (any case)
//     counts. The sort dateSent:desc uses the syntax the reference shows for asc. The
//     profileIdentifier filter and record field come from a search excerpt of the
//     reference; a profile command counts only when the record itself carries the
//     identifier asked for.
//   - Whether an inventory configurationProfiles[].id is the console profile ID is not
//     confirmed. verify-profile needs one entry whose id and profileIdentifier both
//     match, and --absent needs neither to be listed and every entry to carry both.
//   - The FileVault state and personal key validation fields are found by name (one
//     key ending in FileVault2State or FileVaultState, one key holding RecoveryKey and
//     Valid that is not the institutional key). Neither value is printed unless it is
//     a plain status word, so a key in the wrong field is never shown.
//   - The computer history subset names PolicyLogs and Commands are not confirmed.

const {
  STATES, EXIT, RefusedError, TripwireError,
  defineAdapter, createClient, renderResult, exitCodeFor, parseArgs, scanUntrusted, realCalendarTime, dryRunExit,
} = require('./readonly-contract.js');
const { cliDeps, recordVerdict, takeChange, changeRefusal } = require('./cli-support.js');

// ── The allow-list: the lane spec's Jamf Pro reads ───────────────────────────
const SECTIONS = Object.freeze(['GENERAL', 'HARDWARE', 'OPERATING_SYSTEM', 'DISK_ENCRYPTION', 'CONFIGURATION_PROFILES', 'GROUP_MEMBERSHIPS', 'APPLICATIONS']);
const SECTION = new RegExp(`^(?:${SECTIONS.join('|')})$`);
const NUMERIC_ID = /^[1-9][0-9]{0,9}$/;
const SERIAL = /^[A-Za-z0-9]{4,40}$/;
const MANAGEMENT_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;
const UUID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
const COMMAND_TYPE = /^[A-Z][A-Z0-9_]{1,63}$/;
const PROFILE_COMMAND = /PROFILE$/;
// A profile's PayloadIdentifier: reverse-DNS names and UUIDs; no quote or separator, so
// it can sit inside the MDM command filter as one quoted value.
const PROFILE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const GROUP_NAME = /^[A-Za-z0-9 _.()&'+*:-]{1,100}$/;
const SUBSET = /^(?:PolicyLogs|Commands)$/;
const PAGE_SIZE = 100;

const ROUTES = {
  version: { method: 'GET', path: '/api/v1/jamf-pro-version' },
  inventory: {
    method: 'GET', path: '/api/v1/computers-inventory',
    query: { section: SECTION, filter: /^hardware\.serialNumber=="[A-Za-z0-9]{4,40}"$/ },
  },
  inventoryDetail: { method: 'GET', path: '/api/v1/computers-inventory-detail/:id', params: { id: NUMERIC_ID } },
  mdmCommands: {
    method: 'GET', path: '/api/v2/mdm/commands',
    fixedQuery: { sort: 'dateSent:desc', 'page-size': String(PAGE_SIZE) },
    query: { filter: /^clientManagementId=="[A-Za-z0-9][A-Za-z0-9-]{0,63}"(?:;command==[A-Z][A-Z0-9_]{1,63})?(?:;profileIdentifier=="[A-Za-z0-9][A-Za-z0-9._-]{0,254}")?$/, page: /^(?:0|[1-9][0-9]?)$/ },
  },
  smartGroups: { method: 'GET', path: '/api/v2/computer-groups/smart-groups', query: { filter: /^name=="[A-Za-z0-9 _.()&'+*:-]{1,100}"$/ } },
  smartGroupMembership: { method: 'GET', path: '/api/v2/computer-groups/smart-group-membership/:id', params: { id: NUMERIC_ID } },
  osxConfigurationProfile: { method: 'GET', path: '/JSSResource/osxconfigurationprofiles/id/:id', params: { id: NUMERIC_ID } },
  policy: { method: 'GET', path: '/JSSResource/policies/id/:id', params: { id: NUMERIC_ID } },
  computerHistory: { method: 'GET', path: '/JSSResource/computerhistory/id/:id/subset/:subset', params: { id: NUMERIC_ID, subset: SUBSET } },
  patchTitles: { method: 'GET', path: '/api/v2/patch-software-title-configurations' },
  patchReport: { method: 'GET', path: '/api/v2/patch-software-title-configurations/:id/patch-report', params: { id: NUMERIC_ID } },
  updatePlans: { method: 'GET', path: '/api/v1/managed-software-updates/plans' },
  updatePlanEvents: { method: 'GET', path: '/api/v1/managed-software-updates/plans/:id/events', params: { id: UUID } },
};

// Defence in depth beside the exact allow-list: no route may even name a secret or an
// authentication path (the FileVault key, Recovery Lock and LAPS reads, Basic auth).
const SECRET_PATH = /filevault|recovery|password|passcode|local-admin|\/auth\b|oauth/i;
function checkRoutes(routes) {
  for (const [name, route] of Object.entries(routes)) {
    if (SECRET_PATH.test(route.path)) throw new Error(`route ${name} names a secret or an authentication path; this adapter never reads one`);
  }
  return true;
}

const SPEC = defineAdapter({
  platform: 'jamf',
  host: { env: 'JAMF_URL' },
  credentials: ['JAMF_CLIENT_ID', 'JAMF_CLIENT_SECRET'],
  auth: (creds, token) => ({ Authorization: `Bearer ${token}` }),
  routes: ROUTES,
  tokenExchange: {
    path: '/api/oauth/token',
    fields: ['grant_type', 'client_id', 'client_secret'],
    build: (creds) => ({ grant_type: 'client_credentials', client_id: creds.JAMF_CLIENT_ID, client_secret: creds.JAMF_CLIENT_SECRET }),
    parse: (json) => ({ token: json && json.access_token, expiresInSeconds: json && json.expires_in }),
  },
  // batch G3: the token response's scope lists API role IDs (api-role:7), not privileges, so
  // Jamf Pro does not expose whether the client is read-only (developer.jamf.com, read
  // 2026-10-28); the first result says so
  scopes: { manifest: 'jamf', kind: 'none', vendor: 'Jamf Pro' },
});
checkRoutes(SPEC.routes);

// ── Key-like fields and other secret-bearing values ──────────────────────────
const KEY_LIKE = /recoveryKey|personalRecoveryKey|password|passcode|pin$/i;
const SCRIPT_PARAMETER = /^parameter\d+$/i;
const RUN_COMMAND = /^run_command$/i;
const PAYLOADS = /^payloads$/i;
const EXTENSION_ATTRIBUTES = /^extension_?attributes$/i;
const SECRET_ATTRIBUTE_NAME = /pass|secret|token|key|pin/i;
const MAX_LISTED = 50;

function step(at, key) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${at}.${key}` : `${at}[${JSON.stringify(key)}]`;
}

// A copy of value without its secret-bearing fields, at any depth: every key matching
// KEY_LIKE, every script parameter and run_command, every payloads field (summarised
// into payloads, see summarisePayloads) and the values of a secret-named extension
// attribute. removed collects the JSON paths that were dropped.
function stripKeyLike(value, at = '$', removed = [], payloads = []) {
  if (Array.isArray(value)) return value.map((item, i) => stripKeyLike(item, `${at}[${i}]`, removed, payloads));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      const where = step(at, key);
      if (KEY_LIKE.test(key) || SCRIPT_PARAMETER.test(key) || RUN_COMMAND.test(key)) { removed.push(where); continue; }
      if (PAYLOADS.test(key)) { removed.push(where); payloads.push(summarisePayloads(value[key], where)); continue; }
      if (EXTENSION_ATTRIBUTES.test(key) && Array.isArray(value[key])) {
        out[key] = value[key].map((item, i) => withholdAttribute(item, `${where}[${i}]`, removed, payloads));
        continue;
      }
      out[key] = stripKeyLike(value[key], where, removed, payloads);
    }
    return out;
  }
  return value;
}

// One extension attribute: its values are withheld when its name looks like a secret,
// or when it carries no name to judge by.
function withholdAttribute(item, at, removed, payloads) {
  const clean = stripKeyLike(item, at, removed, payloads);
  if (!clean || typeof clean !== 'object' || Array.isArray(clean)) return clean;
  if (typeof clean.name === 'string' && !SECRET_ATTRIBUTE_NAME.test(clean.name)) return clean;
  const out = {};
  for (const key of Object.keys(clean)) {
    if (/^values?$/i.test(key)) { removed.push(step(at, key)); continue; }
    out[key] = clean[key];
  }
  return out;
}

// A configuration profile's payloads field is an XML property list. Only three names
// per dictionary are kept: PayloadType, PayloadIdentifier and PayloadDisplayName. Every
// other value (a password, a certificate, a challenge) is never read into the output.
// The outermost dictionary is the profile itself; the inner ones are its payloads.
const PAYLOAD_NAMES = Object.freeze(['PayloadType', 'PayloadIdentifier', 'PayloadDisplayName']);
const PLAIN_NAME = /^[^\u0000-\u001f<>]{1,200}$/;
function decodeXmlText(text) {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function summarisePayloads(value, field) {
  const summary = { field, profile: null, payloads: [] };
  if (typeof value !== 'string') {
    summary.note = 'the payloads field is not a property list string; nothing from it is shown';
    return summary;
  }
  const stack = [];
  const token = /<(\/?)dict\s*>|<key>([^<]*)<\/key>\s*<string>([^<]*)<\/string>/g;
  let match;
  while ((match = token.exec(value)) !== null) {
    if (match[2] === undefined) {
      if (match[1] === '') { stack.push({}); continue; }
      const depth = stack.length;
      const names = stack.pop();
      if (!names || !Object.keys(names).length) continue;
      if (depth === 1) summary.profile = names;
      else if (summary.payloads.length < MAX_LISTED) summary.payloads.push(names);
      continue;
    }
    const key = match[2].trim();
    if (!stack.length || !PAYLOAD_NAMES.includes(key)) continue;
    const text = decodeXmlText(match[3]).trim();
    stack[stack.length - 1][key] = PLAIN_NAME.test(text) ? text : '(withheld: not a plain name)';
  }
  if (!summary.profile && !summary.payloads.length) summary.note = 'no PayloadType, PayloadIdentifier or PayloadDisplayName was found; read the payloads on screen';
  return summary;
}

// ── Commands ─────────────────────────────────────────────────────────────────
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const COUNT = /^(?:0|[1-9][0-9]{0,6})$/;
const TRIGGER = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,63}$/;
const FREQUENCY = /^[A-Za-z][A-Za-z ]{0,47}$/;
const MAX_PAGES = 10;
const MAX_SUMMARIES = 20;

const serialFilter = (serial) => `hardware.serialNumber=="${serial}"`;
const commandFilter = (managementId, type, identifier) => `clientManagementId=="${managementId}"${type ? `;command==${type}` : ''}${identifier ? `;profileIdentifier=="${identifier}"` : ''}`;
const inventoryQuery = (serial, section) => ({ section, filter: serialFilter(serial) });

const VALUE_FLAGS = ['serial', 'section', 'id', 'management-id', 'name', 'subset', 'type', 'not-before', 'profile-id', 'profile-identifier', 'expect', 'trigger', 'frequency', 'enabled'];
const BOOLEAN_FLAGS = ['execute', 'absent', 'no-triggers'];

// Each command names its required flags, its optional flags and the request(s) it makes.
const COMMANDS = Object.freeze({
  version: { kind: 'read', flags: [], request: () => ['version', {}, {}] },
  computer: { kind: 'read', flags: ['serial'], optional: ['section'], request: (a) => ['inventory', {}, inventoryQuery(a.serial, a.section || 'GENERAL')] },
  'computer-detail': { kind: 'read', flags: ['id'], request: (a) => ['inventoryDetail', { id: a.id }, {}] },
  commands: { kind: 'read', flags: ['management-id'], request: (a) => ['mdmCommands', {}, { filter: commandFilter(a.managementId), page: '0' }] },
  'smart-groups': { kind: 'read', flags: ['name'], request: (a) => ['smartGroups', {}, { filter: `name=="${a.name}"` }] },
  'group-members': { kind: 'read', flags: ['id'], request: (a) => ['smartGroupMembership', { id: a.id }, {}] },
  profile: { kind: 'read', flags: ['id'], request: (a) => ['osxConfigurationProfile', { id: a.id }, {}] },
  policy: { kind: 'read', flags: ['id'], request: (a) => ['policy', { id: a.id }, {}] },
  history: { kind: 'read', flags: ['id', 'subset'], request: (a) => ['computerHistory', { id: a.id, subset: a.subset }, {}] },
  'patch-titles': { kind: 'read', flags: [], request: () => ['patchTitles', {}, {}] },
  'patch-report': { kind: 'read', flags: ['id'], request: (a) => ['patchReport', { id: a.id }, {}] },
  'update-plans': { kind: 'read', flags: [], request: () => ['updatePlans', {}, {}] },
  'update-plan-events': { kind: 'read', flags: ['id'], idShape: 'uuid', request: (a) => ['updatePlanEvents', { id: a.id }, {}] },
  'verify-command': {
    kind: 'verify', flags: ['management-id', 'type', 'not-before'], optional: ['profile-identifier'],
    plans: (a) => [['mdmCommands', {}, { filter: commandFilter(a.managementId, a.type, a.profileIdentifier), page: '0' }]],
    pages: `then page 1, 2 and so on, up to ${MAX_PAGES} pages, while a page is full and no acknowledged command is found`,
    expected: (a) => ({ managementId: a.managementId, commandType: a.type, profileIdentifier: a.profileIdentifier || null, status: 'Acknowledged', notBefore: a.notBefore }),
  },
  'verify-profile': {
    kind: 'verify', flags: ['serial', 'profile-id', 'profile-identifier'], optional: ['absent'],
    plans: (a) => [['inventory', {}, inventoryQuery(a.serial, 'HARDWARE')], ['inventory', {}, inventoryQuery(a.serial, 'CONFIGURATION_PROFILES')]],
    expected: (a) => ({ serial: a.serial, profileId: a.profileId, profileIdentifier: a.profileIdentifier, listed: !a.absent }),
  },
  'verify-group-count': {
    kind: 'verify', flags: ['id', 'expect'],
    plans: (a) => [['smartGroupMembership', { id: a.id }, {}]],
    expected: (a) => ({ groupId: a.id, members: a.expect }),
  },
  'verify-filevault': {
    kind: 'verify', flags: ['serial'],
    plans: (a) => [['inventory', {}, inventoryQuery(a.serial, 'HARDWARE')], ['inventory', {}, inventoryQuery(a.serial, 'DISK_ENCRYPTION')]],
    expected: (a) => ({ serial: a.serial, fileVaultState: 'ENCRYPTED', keyValidation: 'VALID' }),
  },
  // batch G3 (task 5d): Jamf Pro defines no "last MDM check-in" field (vendor fact J-07);
  // general.lastContactTime is the closest, and the output names it
  'verify-checked-in': {
    kind: 'verify', flags: ['serial', 'not-before'],
    plans: (a) => [['inventory', {}, inventoryQuery(a.serial, 'HARDWARE')], ['inventory', {}, inventoryQuery(a.serial, 'GENERAL')]],
    expected: (a) => ({ serial: a.serial, lastContactTime: `at or after ${a.notBefore}`, field: 'general.lastContactTime (Jamf Pro defines no last MDM check-in field)' }),
  },
  'verify-policy': {
    kind: 'verify', flags: ['id'], optional: ['trigger', 'frequency', 'enabled', 'no-triggers'],
    plans: (a) => [['policy', { id: a.id }, {}]],
    expected: (a) => ({ policyId: a.id, trigger: a.trigger || null, frequency: a.frequency || null, enabled: a.enabled === undefined ? null : a.enabled, noTriggers: a.noTriggers }),
  },
});

const USAGE = [
  'Usage: node scripts/adapters/jamf-client.js <command> [flags] [--execute]',
  '  Reads:  version | computer --serial [SERIAL_NUMBER] [--section SECTION] | computer-detail --id [DEVICE_ID]',
  '          commands --management-id [DEVICE_ID] | smart-groups --name [SMART_GROUP] | group-members --id N',
  '          profile --id [PROFILE_ID] | policy --id [POLICY_ID] | history --id N --subset PolicyLogs|Commands',
  '          patch-titles | patch-report --id N | update-plans | update-plan-events --id [PLAN_UUID]',
  `          SECTION is one of ${SECTIONS.join(', ')} (default GENERAL)`,
  '  Verify: verify-command --management-id [DEVICE_ID] --type [COMMAND_TYPE] --not-before [NOT_BEFORE]',
  '            [--profile-identifier [PROFILE_IDENTIFIER]] (required with INSTALL_PROFILE and REMOVE_PROFILE)',
  '          verify-profile --serial [SERIAL_NUMBER] --profile-id [PROFILE_ID] --profile-identifier [PROFILE_IDENTIFIER] [--absent]',
  '          verify-group-count --id N --expect N | verify-filevault --serial [SERIAL_NUMBER]',
  '          verify-policy --id [POLICY_ID] with one or more of --trigger T, --frequency F, --enabled true|false, --no-triggers',
  '          verify-checked-in --serial [SERIAL_NUMBER] --not-before [NOT_BEFORE]',
  'Every command is a dry run unless the bare --execute flag is given. No command writes to Jamf Pro.',
  '',
].join('\n');

function need(value, pattern, message) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new RefusedError(message);
  return value;
}

// Every flag is checked before a client exists, so bad input reads and sends nothing.
function validate(command, def, args) {
  const allowed = new Set([...def.flags, ...(def.optional || [])]);
  for (const key of Object.keys(args)) {
    if (key === '_command' || key === 'execute') continue;
    if (!allowed.has(key)) throw new RefusedError(`--${key} does not apply to ${command}`);
  }
  for (const flag of def.flags) if (args[flag] === undefined) throw new RefusedError(`${command} needs --${flag}`);
  const a = {};
  if (args.serial !== undefined) a.serial = need(args.serial, SERIAL, '--serial must be a hardware serial number: 4 to 40 letters and digits');
  if (args.section !== undefined) a.section = need(args.section, SECTION, `--section must be one of ${SECTIONS.join(', ')}`);
  if (args.id !== undefined) {
    a.id = def.idShape === 'uuid'
      ? need(args.id, UUID, '--id must be a managed software update plan UUID')
      : need(args.id, NUMERIC_ID, '--id must be a Jamf Pro ID: a whole number from 1');
  }
  if (args['management-id'] !== undefined) a.managementId = need(args['management-id'], MANAGEMENT_ID, '--management-id must be the Mac\'s management ID (letters, digits and hyphens)');
  if (args.name !== undefined) {
    a.name = need(args.name, GROUP_NAME, '--name must be a group name of 1 to 100 letters, digits, spaces and _ . ( ) & \' + * : - (no quotes, commas or semicolons)');
    if (!/[A-Za-z0-9]/.test(a.name)) throw new RefusedError('--name must hold at least one letter or digit');
  }
  if (args.subset !== undefined) a.subset = need(args.subset, SUBSET, '--subset must be PolicyLogs or Commands');
  if (args.type !== undefined) a.type = need(args.type, COMMAND_TYPE, '--type must be an MDM command type in capitals, such as INSTALL_PROFILE');
  if (args['not-before'] !== undefined) {
    a.notBefore = need(args['not-before'], ISO_UTC, '--not-before must be an ISO 8601 UTC time, such as 2026-01-31T09:30:00Z');
    if (!realCalendarTime(a.notBefore)) throw new RefusedError('--not-before is not a real date and time');
  }
  if (args['profile-id'] !== undefined) a.profileId = need(args['profile-id'], NUMERIC_ID, '--profile-id must be a Jamf Pro configuration profile ID: a whole number from 1');
  if (args['profile-identifier'] !== undefined) a.profileIdentifier = need(args['profile-identifier'], PROFILE_IDENTIFIER, '--profile-identifier must be the profile\'s PayloadIdentifier: letters, digits, dots, hyphens and underscores, up to 255');
  if (command === 'verify-command') {
    if (PROFILE_COMMAND.test(a.type) && !a.profileIdentifier) throw new RefusedError(`verify-command --type ${a.type} needs --profile-identifier: an acknowledged command for another profile is not proof`);
    if (!PROFILE_COMMAND.test(a.type) && a.profileIdentifier) throw new RefusedError('--profile-identifier applies only to a profile command type, such as INSTALL_PROFILE or REMOVE_PROFILE');
  }
  if (args.expect !== undefined) a.expect = Number(need(args.expect, COUNT, '--expect must be a whole number from 0'));
  if (args.trigger !== undefined) a.trigger = need(args.trigger, TRIGGER, '--trigger must be a trigger or custom event name of 1 to 64 letters, digits, spaces and _ . -');
  if (args.frequency !== undefined) a.frequency = need(args.frequency, FREQUENCY, '--frequency must be the execution frequency as Jamf Pro writes it, such as "Once per computer"');
  if (args.enabled !== undefined) a.enabled = need(args.enabled, /^(?:true|false)$/, '--enabled must be true or false') === 'true';
  a.absent = args.absent === true;
  a.noTriggers = args['no-triggers'] === true;
  if (command === 'verify-policy') {
    if (!a.trigger && !a.frequency && a.enabled === undefined && !a.noTriggers) {
      throw new RefusedError('verify-policy needs --trigger, --frequency, --enabled or --no-triggers: a policy that only exists proves no change');
    }
    if (a.noTriggers && a.trigger) throw new RefusedError('--no-triggers and --trigger contradict each other');
  }
  return a;
}

// ── Reads ────────────────────────────────────────────────────────────────────
// One allowed read. The contract has already redacted credentials and the token; here
// key-like fields are stripped and the instruction-text scan is run again on the rest.
async function read(client, routeName, params, query) {
  const res = await client.get(routeName, params, query);
  if (!res.ok) return { ok: false, failure: res };
  const removed = [];
  const payloads = [];
  const data = stripKeyLike(res.data, '$', removed, payloads);
  const flags = scanUntrusted(data);
  if (payloads.length) scanUntrusted(payloads, '$payloadSummary', flags);
  return { ok: true, status: res.status, attempts: res.attempts, raw: res.data, data, removed, payloads, flags };
}

function readOutput(command, r) {
  const out = { state: STATES.OK, ok: true, command, status: r.status, attempts: r.attempts, data: r.data };
  if (r.payloads.length) out.payloadSummary = r.payloads;
  if (r.removed.length) {
    out.strippedFields = r.removed.length;
    out.stripped = r.removed.slice(0, MAX_LISTED);
  }
  if (r.flags.length) out.flags = r.flags;
  return out;
}

function failed(command, r) {
  return { command, ...r.failure };
}

function verdict(command, verified, expected, observed, reason, flags, extra = {}) {
  const out = { state: STATES.OK, ok: true, command, verified, expected, observed, ...extra };
  if (!verified) out.reason = reason;
  if (flags && flags.length) out.flags = flags;
  return out;
}

function invalid(command, r, error) {
  return { state: STATES.INVALID_RESPONSE, ok: false, command, status: r.status, attempts: r.attempts, error };
}

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// A record id as a string: a non-empty string, or a finite number; anything else is null.
function idOf(v) {
  if (typeof v === 'string' && v) return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}
const orNull = (v) => (v === undefined ? null : v);

// ── Mac read-backs: confirm the serial number, then read one section ─────────
// Step 1 reads the HARDWARE section by serial number and needs exactly one record
// whose own hardware.serialNumber is the one asked for. Step 2 reads the wanted
// section by the same filter and needs that same record id.
async function readMac(client, command, serial, section, observed, flags) {
  const first = await read(client, 'inventory', {}, inventoryQuery(serial, 'HARDWARE'));
  if (!first.ok) return { failure: failed(command, first) };
  flags.push(...first.flags.map((f) => ({ ...f, path: `HARDWARE read ${f.path}` })));
  const list = isObject(first.raw) && Array.isArray(first.raw.results) ? first.raw.results : null;
  if (!list) return { failure: invalid(command, first, 'the inventory response holds no results list') };
  if (list.length !== 1) return { reason: `the serial number filter returned ${list.length} computer record(s); exactly one is proof` };
  const rec = isObject(list[0]) ? list[0] : {};
  const seen = isObject(rec.hardware) && typeof rec.hardware.serialNumber === 'string' ? rec.hardware.serialNumber : null;
  observed.serial = seen;
  if (!seen || seen.toUpperCase() !== serial.toUpperCase()) return { reason: 'the record in the response is not the Mac asked for (its hardware.serialNumber differs or is missing)' };
  const id = idOf(rec.id);
  if (!id) return { reason: 'the record carries no computer id' };
  observed.computerId = id;

  const second = await read(client, 'inventory', {}, inventoryQuery(serial, section));
  if (!second.ok) return { failure: failed(command, second) };
  flags.push(...second.flags.map((f) => ({ ...f, path: `${section} read ${f.path}` })));
  const list2 = isObject(second.raw) && Array.isArray(second.raw.results) ? second.raw.results : null;
  if (!list2) return { failure: invalid(command, second, 'the inventory response holds no results list') };
  if (list2.length !== 1 || !isObject(list2[0]) || idOf(list2[0].id) !== id) {
    return { reason: `the ${section} read did not return the same single computer record` };
  }
  return { record: list2[0] };
}

async function verifyProfile(client, a) {
  const command = 'verify-profile';
  const expected = COMMANDS[command].expected(a);
  const observed = { serial: null, computerId: null, listed: null, idListed: null, identifierListed: null, profiles: [], entriesWithoutId: null, entriesWithoutIdentifier: null };
  const flags = [];
  const mac = await readMac(client, command, a.serial, 'CONFIGURATION_PROFILES', observed, flags);
  if (mac.failure) return mac.failure;
  if (mac.reason) return verdict(command, false, expected, observed, mac.reason, flags);
  const list = mac.record.configurationProfiles;
  if (!Array.isArray(list)) return verdict(command, false, expected, observed, 'the record holds no configurationProfiles list', flags);
  // Whether the inventory's configurationProfiles[].id is the console profile ID is not
  // confirmed, so an entry is this profile only when its id and its profileIdentifier
  // both match; either one still listed means the profile is not provably gone.
  const entries = list.map((p) => ({
    id: isObject(p) ? idOf(p.id) : null,
    profileIdentifier: isObject(p) && typeof p.profileIdentifier === 'string' && p.profileIdentifier ? p.profileIdentifier : null,
    displayName: isObject(p) && typeof p.displayName === 'string' ? p.displayName : null,
  }));
  observed.entriesWithoutId = entries.filter((e) => e.id === null).length;
  observed.entriesWithoutIdentifier = entries.filter((e) => e.profileIdentifier === null).length;
  observed.profiles = entries.slice(0, MAX_LISTED * 2);
  observed.idListed = entries.some((e) => e.id === a.profileId);
  observed.identifierListed = entries.some((e) => e.profileIdentifier === a.profileIdentifier);
  observed.listed = entries.some((e) => e.id === a.profileId && e.profileIdentifier === a.profileIdentifier);
  if (!a.absent) {
    let reason = 'the Mac lists no profile with this id and this profile identifier';
    if (observed.identifierListed && !observed.listed) reason = 'an entry carries this profile identifier under another id (whether the inventory id is the console profile ID is not confirmed); check the Mac\'s record on screen';
    else if (observed.idListed && !observed.listed) reason = 'an entry carries this id but not this profile identifier, so it may be another profile';
    return verdict(command, observed.listed, expected, observed, reason, flags);
  }
  if (observed.idListed || observed.identifierListed) return verdict(command, false, expected, observed, 'the Mac still lists the profile (an entry carries its id or its profile identifier)', flags);
  if (observed.entriesWithoutId > 0) {
    return verdict(command, false, expected, observed, `${observed.entriesWithoutId} listed profile(s) carry no id, so absence is not proven; check the Mac's record on screen`, flags);
  }
  if (!entries.length || observed.entriesWithoutIdentifier > 0) {
    const counted = entries.length ? `${observed.entriesWithoutIdentifier} of ${entries.length} listed profile(s) carry no profileIdentifier` : 'the list is empty, so no entry carries a profileIdentifier';
    return verdict(command, false, expected, observed, `${counted}; absence is proven only by a list whose every entry carries one. Check the Mac's record on screen`, flags);
  }
  return verdict(command, true, expected, observed, null, flags);
}

// FileVault fields are found by name, at most three objects deep, never inside a list.
function findFields(value, test, at, out, depth = 0) {
  if (!isObject(value) || depth > 3) return out;
  for (const key of Object.keys(value)) {
    const where = at ? `${at}.${key}` : key;
    if (typeof value[key] === 'string' && test(key)) out.push({ field: where, value: value[key] });
    else if (isObject(value[key])) findFields(value[key], test, where, out, depth + 1);
  }
  return out;
}
const isStateKey = (key) => /FileVault2?State$/i.test(key);
const isValidationKey = (key) => /RecoveryKey/i.test(key) && /Valid/i.test(key) && !/institutional/i.test(key);
const statusWord = (value) => (/^[A-Za-z_ ]{1,40}$/.test(value) ? value : '(withheld: not a status word)');

async function verifyFileVault(client, a) {
  const command = 'verify-filevault';
  const expected = COMMANDS[command].expected(a);
  const observed = { serial: null, computerId: null, fileVaultState: null, fileVaultStateField: null, keyValidation: null, keyValidationField: null };
  const flags = [];
  const mac = await readMac(client, command, a.serial, 'DISK_ENCRYPTION', observed, flags);
  if (mac.failure) return mac.failure;
  if (mac.reason) return verdict(command, false, expected, observed, mac.reason, flags);
  const de = mac.record.diskEncryption;
  if (!isObject(de)) return verdict(command, false, expected, observed, 'the record holds no diskEncryption section', flags);
  const states = findFields(de, isStateKey, 'diskEncryption', []);
  const validations = findFields(de, isValidationKey, 'diskEncryption', []);
  if (states.length === 1) Object.assign(observed, { fileVaultState: statusWord(states[0].value), fileVaultStateField: states[0].field });
  if (validations.length === 1) Object.assign(observed, { keyValidation: statusWord(validations[0].value), keyValidationField: validations[0].field });
  if (states.length !== 1) return verdict(command, false, expected, observed, `found ${states.length} FileVault state field(s); exactly one is proof (field names are not confirmed, check Disk Encryption on screen)`, flags);
  if (validations.length !== 1) return verdict(command, false, expected, observed, `found ${validations.length} personal recovery key validation field(s); exactly one is proof (check Personal Recovery Key Validation on screen)`, flags);
  const enabled = /^encrypted$/i.test(states[0].value);
  const valid = /^valid$/i.test(validations[0].value);
  const reason = !enabled ? 'FileVault is not reported as ENCRYPTED' : 'the personal recovery key is not reported as VALID (it is escrowed at an inventory update)';
  return verdict(command, enabled && valid, expected, observed, reason, flags);
}

async function verifyCheckedIn(client, a) {
  const command = 'verify-checked-in';
  const expected = COMMANDS[command].expected(a);
  const observed = { serial: null, computerId: null, lastContactTime: null, reportDate: null, mdmCapable: null };
  const flags = [];
  const mac = await readMac(client, command, a.serial, 'GENERAL', observed, flags);
  if (mac.failure) return mac.failure;
  if (mac.reason) return verdict(command, false, expected, observed, mac.reason, flags);
  const g = mac.record.general;
  if (!isObject(g)) return verdict(command, false, expected, observed, 'the record holds no general section', flags);
  const time = (v) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null);
  Object.assign(observed, { lastContactTime: time(g.lastContactTime), reportDate: time(g.reportDate), mdmCapable: isObject(g.mdmCapable) && typeof g.mdmCapable.capable === 'boolean' ? g.mdmCapable.capable : null });
  if (!observed.lastContactTime) return verdict(command, false, expected, observed, 'the record shows no lastContactTime', flags);
  const ok = Date.parse(observed.lastContactTime) >= Date.parse(a.notBefore);
  return verdict(command, ok, expected, observed, `the last contact is not at or after ${a.notBefore}; ask the person to open the Mac and run a check-in, then read again`, flags);
}

async function verifyCommand(client, a) {
  const command = 'verify-command';
  const expected = COMMANDS[command].expected(a);
  const notBefore = Date.parse(a.notBefore);
  const observed = { managementId: a.managementId, commandType: a.type, profileIdentifier: a.profileIdentifier || null, pagesRead: 0, commandsRead: 0, match: null, sameTypeSinceNotBefore: [], otherProfileCommands: 0 };
  const flags = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const r = await read(client, 'mdmCommands', {}, { filter: commandFilter(a.managementId, a.type, a.profileIdentifier), page: String(page) });
    if (!r.ok) return failed(command, r);
    flags.push(...r.flags.map((f) => ({ ...f, path: `page ${page} ${f.path}` })));
    const list = isObject(r.raw) && Array.isArray(r.raw.results) ? r.raw.results : null;
    if (!list) return invalid(command, r, 'the MDM command response holds no results list');
    observed.pagesRead = page + 1;
    for (const c of list) {
      if (!isObject(c)) continue;
      observed.commandsRead += 1;
      const sameMac = typeof c.clientManagementId === 'string' && c.clientManagementId.toLowerCase() === a.managementId.toLowerCase();
      if (!sameMac || c.command !== a.type) continue;
      // A profile command for another profile (or one that names none) is never proof,
      // even when the server ignores the profileIdentifier part of the filter.
      if (a.profileIdentifier && c.profileIdentifier !== a.profileIdentifier) { observed.otherProfileCommands += 1; continue; }
      const sent = typeof c.dateSent === 'string' ? Date.parse(c.dateSent) : NaN;
      if (!Number.isFinite(sent) || sent < notBefore) continue;
      const summary = { uuid: orNull(c.uuid), command: c.command, profileIdentifier: orNull(c.profileIdentifier), status: orNull(c.status), dateSent: c.dateSent, dateCompleted: orNull(c.dateCompleted) };
      if (typeof c.status === 'string' && /^acknowledged$/i.test(c.status)) {
        observed.match = summary;
        return verdict(command, true, expected, observed, null, flags);
      }
      if (observed.sameTypeSinceNotBefore.length < MAX_SUMMARIES) observed.sameTypeSinceNotBefore.push(summary);
    }
    if (list.length < PAGE_SIZE) {
      const forProfile = a.profileIdentifier ? ` for profile ${a.profileIdentifier}` : '';
      return verdict(command, false, expected, observed, `no ${a.type} command${forProfile} for this Mac sent at or after ${a.notBefore} reads Acknowledged`, flags);
    }
  }
  return verdict(command, false, expected, observed, `stopped after ${MAX_PAGES} pages without proof`, flags);
}

async function verifyGroupCount(client, a) {
  const command = 'verify-group-count';
  const expected = COMMANDS[command].expected(a);
  const observed = { groupId: a.id, members: null, listField: null, totalCount: null };
  const r = await read(client, 'smartGroupMembership', { id: a.id }, {});
  if (!r.ok) return failed(command, r);
  const json = r.raw;
  // The membership shape is not confirmed: exactly one member list must be present.
  const candidates = [];
  if (Array.isArray(json)) candidates.push(['(the response)', json]);
  else if (isObject(json)) for (const key of ['members', 'results', 'computers']) if (Array.isArray(json[key])) candidates.push([key, json[key]]);
  if (candidates.length !== 1) {
    return verdict(command, false, expected, observed, `found ${candidates.length} member list(s) in the response; exactly one is proof (the response shape is not confirmed)`, r.flags);
  }
  const [field, list] = candidates[0];
  Object.assign(observed, { members: list.length, listField: field });
  if (isObject(json) && json.totalCount !== undefined) observed.totalCount = json.totalCount;
  if (observed.totalCount !== null && observed.totalCount !== list.length) {
    return verdict(command, false, expected, observed, `the response is paged (totalCount ${observed.totalCount}, ${list.length} listed); a partial list is not a count`, r.flags);
  }
  return verdict(command, list.length === a.expect, expected, observed, `the group has ${list.length} member(s), not ${a.expect}`, r.flags);
}

// Scope as counts: a list becomes its length, a yes/no stays, a nested object one level
// down is summarised the same way.
function summariseScope(scope, depth = 0) {
  if (!isObject(scope)) return null;
  const out = {};
  for (const [key, value] of Object.entries(scope)) {
    if (Array.isArray(value)) out[key] = value.length;
    else if (typeof value === 'boolean') out[key] = value;
    else if (isObject(value) && depth === 0) out[key] = summariseScope(value, 1);
  }
  return out;
}

const triggerKey = (name) => `trigger_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

async function verifyPolicy(client, a) {
  const command = 'verify-policy';
  const expected = COMMANDS[command].expected(a);
  const observed = { policyId: null, enabled: null, frequency: null, triggers: {}, scope: null };
  const r = await read(client, 'policy', { id: a.id }, {});
  if (!r.ok) return failed(command, r);
  const policy = isObject(r.data) && isObject(r.data.policy) ? r.data.policy : null;
  if (!policy) return verdict(command, false, expected, observed, 'the response holds no policy', r.flags);
  const general = isObject(policy.general) ? policy.general : {};
  observed.policyId = idOf(general.id);
  observed.enabled = typeof general.enabled === 'boolean' ? general.enabled : null;
  observed.frequency = typeof general.frequency === 'string' ? general.frequency : null;
  for (const [key, value] of Object.entries(general)) {
    if (/^trigger/i.test(key) && (typeof value === 'string' || typeof value === 'boolean')) observed.triggers[key] = value;
  }
  observed.scope = summariseScope(policy.scope);
  if (observed.policyId === null) return verdict(command, false, expected, observed, `the response carries no general.id, so it cannot be tied to policy ${a.id}`, r.flags);
  if (observed.policyId !== a.id) return verdict(command, false, expected, observed, 'the policy in the response is not the policy asked for', r.flags);
  const reasons = [];
  if (a.trigger) {
    const want = triggerKey(a.trigger);
    const hit = Object.entries(observed.triggers).some(([key, value]) => (typeof value === 'string' && value === a.trigger) || (value === true && key.toLowerCase() === want));
    if (!hit) reasons.push(`no trigger field reads ${a.trigger} (a trigger field holding that text, or ${want} set to true)`);
  }
  if (a.frequency && observed.frequency !== a.frequency) reasons.push(`the frequency is not "${a.frequency}" (names match exactly)`);
  if (a.enabled !== undefined && observed.enabled !== a.enabled) {
    reasons.push(observed.enabled === null ? 'the policy carries no general.enabled yes/no value' : `the policy is ${observed.enabled ? 'enabled' : 'disabled'}, not ${a.enabled ? 'enabled' : 'disabled'}`);
  }
  if (a.noTriggers) reasons.push(...noTriggerReasons(general));
  return verdict(command, reasons.length === 0, expected, observed, reasons.join('; '), r.flags);
}

// "No trigger ticked" (a Self Service-only policy): every trigger_ yes/no field is false
// and trigger_other, the custom event, is present and empty. A missing field is not
// proof, because a ticked trigger turns a Self Service item into an automatic install.
function noTriggerReasons(general) {
  const fields = Object.entries(general).filter(([key]) => /^trigger_/i.test(key));
  const reasons = [];
  if (!fields.some(([, value]) => typeof value === 'boolean')) reasons.push('the policy carries no trigger_ yes/no fields, so "no trigger ticked" is not proven');
  const other = fields.find(([key]) => key.toLowerCase() === 'trigger_other');
  if (!other || typeof other[1] !== 'string') reasons.push('the policy carries no trigger_other text, so a custom event trigger cannot be ruled out');
  const unreadable = fields.filter(([, value]) => typeof value !== 'boolean' && typeof value !== 'string').map(([key]) => key);
  if (unreadable.length) reasons.push(`trigger field(s) ${unreadable.join(', ')} hold neither yes/no nor text`);
  const ticked = fields.filter(([, value]) => value === true || (typeof value === 'string' && value.trim() !== '')).map(([key]) => key);
  if (ticked.length) reasons.push(`trigger(s) ticked: ${ticked.join(', ')}`);
  return reasons;
}

const VERIFY = Object.freeze({
  'verify-command': verifyCommand,
  'verify-profile': verifyProfile,
  'verify-group-count': verifyGroupCount,
  'verify-filevault': verifyFileVault,
  'verify-policy': verifyPolicy,
  'verify-checked-in': verifyCheckedIn,
});

// ── CLI ──────────────────────────────────────────────────────────────────────
function dryRun(client, command, def, a) {
  if (def.kind === 'read') {
    const plan = client.plan(...def.request(a));
    if (!plan.ok) return { res: { command, ...plan } };
    return { res: { ...plan, command, next: 'Add --execute to perform this read.' } };
  }
  const requests = [];
  for (const args of def.plans(a)) {
    const plan = client.plan(...args);
    if (!plan.ok) return { res: { command, ...plan } };
    requests.push({ method: plan.method, host: plan.host, path: plan.path });
  }
  const res = { state: STATES.OK, ok: true, command, requests, note: 'dry run: no credentials read, no network', expected: def.expected(a) };
  if (def.pages) res.pages = def.pages;
  res.next = 'Add --execute to perform this read-back.';
  return { res };
}

async function run(argv, env = process.env, deps = {}) {
  const out = deps.out || ((s) => process.stdout.write(s));
  const err = deps.err || ((s) => process.stderr.write(s));
  // batch G3 close-out (owner decision 1): --change binds a verify-* read-back to its change
  // record; it is taken out of argv here and checked below, before any read
  const bound = takeChange(argv);
  try {
    const args = parseArgs(bound.argv, { values: VALUE_FLAGS, booleans: BOOLEAN_FLAGS });
    const command = args._command;
    if (command === 'help' || command === '--help' || command === '-h') { out(USAGE); return 0; }
    if (typeof command !== 'string' || !Object.prototype.hasOwnProperty.call(COMMANDS, command)) {
      err(USAGE);
      throw new RefusedError(command === undefined ? 'no command given' : 'unknown command; no command writes to Jamf Pro');
    }
    const def = COMMANDS[command];
    const a = validate(command, def, args);

    // The client only ever sees this view of the environment. It remembers the
    // credentials the contract read, so printed output is redacted with them too; this
    // file never reads a credential itself.
    const seen = [];
    const envView = new Proxy(env, {
      get(target, name) {
        const value = Reflect.get(target, name);
        if ((name === 'JAMF_CLIENT_ID' || name === 'JAMF_CLIENT_SECRET') && typeof value === 'string' && value && !seen.includes(value)) seen.push(value);
        return value;
      },
    });
    // batch G3: the audit sink (and the test seams) come from cliDeps
    const cli = cliDeps(deps, env);
    const refusal = changeRefusal('jamf', command, bound, cli.audit);
    if (refusal) throw new RefusedError(refusal);
    const client = createClient(SPEC, { env: envView, ...cli });

    if (args.execute !== true) {
      const { res } = dryRun(client, command, def, a);
      const code = exitCodeFor(res);
      (code === 1 ? err : out)(renderResult(res, { platform: 'jamf' }));
      return code === EXIT.OK ? dryRunExit(command, err) : code;
    }

    let res;
    if (def.kind === 'read') {
      const r = await read(client, ...def.request(a));
      res = r.ok ? readOutput(command, r) : failed(command, r);
    } else {
      res = recordVerdict(cli.audit, 'jamf', await VERIFY[command](client, a), bound.change, null, bound.argv);
    }
    const code = exitCodeFor(res);
    (code === 1 ? err : out)(renderResult(res, { secrets: seen, platform: 'jamf' }));
    return code;
  } catch (error) {
    if (error instanceof TripwireError || (error && error.name === 'NetworkTripwireError')) throw error;
    if (error instanceof RefusedError) {
      err(renderResult({ state: STATES.REFUSED, ok: false, error: error.message }, { platform: 'jamf' }));
      return 1;
    }
    err(renderResult({ state: STATES.INVALID_RESPONSE, ok: false, error: 'unexpected adapter error (details withheld)' }, { platform: 'jamf' }));
    return 2;
  }
}

if (require.main === module) {
  run(process.argv.slice(2), process.env).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(error && error.name === 'NetworkTripwireError' ? 'Network tripwire fired\n' : 'jamf-client: unexpected error (details withheld)\n');
    process.exitCode = 2;
  });
}

module.exports = { SPEC, run, KEY_LIKE, SECRET_PATH, stripKeyLike, checkRoutes, COMMANDS };
