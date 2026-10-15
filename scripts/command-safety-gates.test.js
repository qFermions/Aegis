'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const POWER_SHELL_LANGUAGES = new Set(['powershell', 'pwsh', 'ps1']);
// Console and shell-session transcripts are scanned like shell fences (a prompt-
// prefixed line is a command); they can carry PREVIEW ONLY markers, never a gate.
const SHELL_LANGUAGES = new Set(['bash', 'sh', 'shell', 'zsh', '', 'console', 'shellsession', 'shell-session', 'sh-session', 'bash-session', 'zsh-session', 'terminal']);
// A gated shell region must sit in an explicitly tagged shell fence; an untagged
// fence can carry PREVIEW ONLY markers but never an executable gate.
const SHELL_GATE_LANGUAGES = new Set(['bash', 'sh', 'shell', 'zsh']);
const MUTATION_FENCE_LANGUAGES = new Set([...POWER_SHELL_LANGUAGES, ...SHELL_LANGUAGES]);

const MIXED_STATE_COMMANDS = [
  'ad-connect', 'conditional-access', 'device-wipe', 'distribution-list',
  'email-quarantine', 'email-to-spam', 'email-whitelist', 'group-membership-audit',
  'intune-compliance', 'lan-wan', 'license-audit', 'mailbox-permissions',
  'meraki-site-vpn', 'mfa-issue', 'new-device-setup', 'new-user', 'offboard',
  'onedrive-issue', 'onedrive-restore', 'outlook-issue', 'password-reset',
  'printer-issue', 'security-alert-triage', 'shared-mailbox', 'sharepoint-access',
  'sip-trunk-status', 'teams-issue', 'unite-extension-create',
  'unite-migration-status', 'unite-voicemail-reset', 'vpn-check', 'wifi-issue',
  'onboard', 'shared-mailbox-create', 'meraki-vpn-status', 'ps-error-decode',
  // G1 — Google Workspace / Okta / Jamf / macOS lane
  'gws-new-user', 'gws-offboard', 'gws-password-reset', 'gws-2sv-reset', 'gws-group-membership',
  'gws-ou-move', 'gws-license-assign', 'gws-drive-transfer', 'gws-audit-log', 'gws-chromeos-device',
  'okta-app-assignment', 'okta-mfa-reset', 'okta-user-lifecycle', 'jamf-enroll-mac', 'jamf-lock-erase',
  'mac-new-hire-laptop', 'gws-gmail-delivery', 'mac-troubleshoot', 'zoom-room-issue',
];

const REFERENCE_BOUNDARIES = [
  '.claude/plugins/enterprise-it-ops/skills/it-ops.md',
  'docs/examples.md',
  'docs/plan-mode-templates.md',
  'docs/ticket-examples.md',
  'modules/it_support/troubleshooting.md',
  'modules/it_support/README.md',
  'modules/it_support/workflows.md',
  'modules/security/compliance_checks.md',
  'modules/security/incident_response.md',
  'modules/security/vulnerability_scan.md',
  'modules/systems/health_checks.md',
  'modules/systems/infrastructure.md',
  'modules/systems/network_ops.md',
];

// R1 effects in an explicitly invoked command are inventoried here because they
// intentionally do not require an R3 typed confirmation. Every other executable
// mutation in a PowerShell fence must be owned by a same-fence SAFETY GATE.
const DIRECT_R1_INVENTORY = [
];

function normalizeFile(file) {
  return file.split(path.sep).join('/');
}

function parseFences(file, source) {
  const lines = source.split(/\r?\n/);
  const fences = [];
  const fenceAtLine = new Map();

  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index].match(/^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)?.*$/);
    if (!opening) continue;
    const delimiter = opening[1];
    const language = (opening[2] || '').toLowerCase();
    const closing = new RegExp(`^ {0,3}${delimiter[0]}{${delimiter.length},}\\s*$`);
    let end = index + 1;
    while (end < lines.length && !closing.test(lines[end])) end += 1;
    assert.ok(end < lines.length, `${file}:${index + 1}: unclosed Markdown fence`);

    const fence = {
      id: `${file}#${fences.length}`,
      file,
      language,
      openLine: index + 1,
      startLine: index + 2,
      endLine: end,
      lines: lines.slice(index + 1, end),
    };
    fences.push(fence);
    for (let line = index + 2; line <= end; line += 1) fenceAtLine.set(line, fence);
    index = end;
  }

  return { file, source, lines, fences, fenceAtLine };
}

const trackedMarkdown = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: ROOT })
  .toString('utf8').split('\0').filter((file) => file.toLowerCase().endsWith('.md')))];
const documentFiles = trackedMarkdown.map((file) => path.join(ROOT, file)).sort();
const documents = new Map(documentFiles.map((absolute) => {
  const file = normalizeFile(path.relative(ROOT, absolute));
  return [file, parseFences(file, fs.readFileSync(absolute, 'utf8'))];
}));

function discoverMarkers(document) {
  const markers = [];
  document.lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const fence = document.fenceAtLine.get(lineNumber);
    let match;

    if ((match = line.match(/^\s*#\s*SAFETY GATE \[([a-z0-9-]+)\]\s*$/i))) {
      const shellGate = Boolean(fence && SHELL_GATE_LANGUAGES.has(fence.language));
      assert.ok(fence && (POWER_SHELL_LANGUAGES.has(fence.language) || shellGate),
        `${document.file}:${lineNumber}: code gate is not in a PowerShell fence or an explicitly tagged bash/sh/shell/zsh fence`);
      markers.push({ id: match[1], mode: 'gated', kind: shellGate ? 'shell' : 'powershell', file: document.file, line: lineNumber, fenceId: fence.id });
      return;
    }
    if ((match = line.match(/^\s*#\s*PREVIEW ONLY \[([a-z0-9-]+)\]/i))) {
      assert.ok(fence && MUTATION_FENCE_LANGUAGES.has(fence.language),
        `${document.file}:${lineNumber}: code preview is not in a recognized PowerShell/shell fence`);
      const kind = POWER_SHELL_LANGUAGES.has(fence.language) ? 'powershell' : 'shell';
      markers.push({ id: match[1], mode: 'preview', kind, file: document.file, line: lineNumber, fenceId: fence.id });
      return;
    }
    if ((match = line.match(/^\s*<!--\s*SAFETY GATE \[([a-z0-9-]+)\]\s*-->\s*$/i))) {
      assert.ok(!fence, `${document.file}:${lineNumber}: portal gate is inside a code fence`);
      markers.push({ id: match[1], mode: 'gated', kind: 'portal', file: document.file, line: lineNumber });
      return;
    }
    if (!fence && (match = line.match(/\*\*PREVIEW ONLY \[([a-z0-9-]+)\]:\*\*/i))) {
      markers.push({ id: match[1], mode: 'preview', kind: 'portal', file: document.file, line: lineNumber });
    }
  });
  return markers;
}

const markers = [...documents.values()].flatMap(discoverMarkers);
const markerByFence = new Map();
for (const marker of markers.filter((item) => item.kind !== 'portal')) {
  if (!markerByFence.has(marker.fenceId)) markerByFence.set(marker.fenceId, []);
  markerByFence.get(marker.fenceId).push(marker);
}
for (const list of markerByFence.values()) list.sort((a, b) => a.line - b.line);

const NON_PERSISTENT = new Set([
  'Clear-Host', 'New-Guid', 'New-Object', 'New-TimeSpan', 'Remove-Module',
  'Remove-PSSession', 'Remove-Variable', 'Set-Alias', 'Set-Location',
  'Set-StrictMode', 'Set-Variable', 'Start-Sleep',
]);
const MUTATING_VERB = /^(?:Add|Clear|Delete|Disable|Enable|Export|Grant|Install|Move|New|Out|Publish|Register|Release|Remove|Rename|Reset|Restart|Restore|Revoke|Set|Start|Stop|Submit|Uninstall|Unlock|Unregister|Update)-/i;
const COMMAND_AT_BOUNDARY = /(?:^|[;|{}=:])\s*&?\s*([A-Za-z]+-[A-Za-z0-9*]+)\b/g;

function stripExecutableComment(line, shell = false) {
  let single = false;
  let double = false;
  let escaped = -1;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    // PowerShell escapes with a backtick, bash with a backslash (outside single
    // quotes): `echo \ #;cmd` runs cmd, the escaped space glues `#` to its word.
    if (shell ? char === '\\' && !single : char === '`') { index += 1; escaped = index; continue; }
    if (char === "'" && !double) { single = !single; continue; }
    if (char === '"' && !single) { double = !double; continue; }
    // bash and PowerShell start a comment only at a word boundary: `true#;cmd`
    // runs cmd, so a glued `#` must not hide the rest of the line. In bash the
    // boundary is whitespace or a metacharacter (; & | ( ) < >) — `{` and `}` are
    // ordinary word characters (`${#var}`, `{#;cmd` run cmd); PowerShell also
    // opens a comment after `{` or `}`.
    if (char === '#' && !single && !double && (index === 0 || (index - 1 !== escaped && (shell ? /[\s;&|()<>]/ : /[\s;&|(){}<>]/).test(line[index - 1])))) return line.slice(0, index);
  }
  return line;
}

function isMutation(command, statement) {
  if (NON_PERSISTENT.has(command)) return false;
  if (/-WhatIf(?=\s|$)(?!\s*:\s*\$false)/i.test(statement)) return false;
  if (/^Invoke-(?:Mg.*(?:Assign|Delete|Retire|Revoke|Reset|Rotate|Update|Wipe)|ADSync|GPUpdate)/i.test(command)) return true;
  if (/^Invoke-(?:RestMethod|WebRequest)$/i.test(command) &&
      /(?:-OutFile\b|-Method\s+(?:Delete|Patch|Post|Put)\b)/i.test(statement)) return true;
  return MUTATING_VERB.test(command);
}

// ── G1 shell sinks: Google Workspace (gam, gcloud), HTTP APIs (Okta, Jamf Pro),
// the jamf binary, and macOS administration tools. Each invocation is decided
// on its own; explicit read-only forms stay live diagnostics, and an
// invocation whose verb is not on a read-only list counts as a mutation
// (fail-closed). Command names match case-insensitively because the default
// macOS filesystem resolves them that way.
// Wrappers that run the following word as the command are transparent: sudo with
// any options (including -u user / --user=user), command, env and inline VAR=value
// assignments, nohup, time, nice, caffeinate, exec, script and xargs. The tool may
// sit behind a quoted or variable path ("$HOME/bin/gam7/gam"), be quoted or
// backslash-escaped ('gam', \gam), carry a Windows .exe suffix, or run into an
// expansion (gam${IFS}delete); a
// wrapper may be called by its path (/usr/bin/sudo, "/usr/bin/env"); arch is one too.
const CLI_WRAPPER_PATH = String.raw`"?(?:[\w.~-]*\/)*`;
const CLI_WRAPPER = String.raw`(?:(?:${CLI_WRAPPER_PATH}sudo"?(?:\s+(?:--(?:[\w-]+(?:=[^\s;|&]+)?)?|-[A-Za-z]+(?:\s+(?!-)[^\s;|&]+)?))*|${CLI_WRAPPER_PATH}doas"?(?:\s+-[A-Za-z]+(?:\s+(?!-)[^\s;|&]+)?)*|${CLI_WRAPPER_PATH}timeout"?(?:\s+-[^\s;|&]+(?:\s+(?!-)[^\s;|&]+)?)*\s+\d+(?:\.\d+)?[smhd]?|${CLI_WRAPPER_PATH}command"?(?:\s+-[pvV]+)?|${CLI_WRAPPER_PATH}env"?(?:\s+-[iu0]+(?:\s+(?!-)[^\s;|&]+)?)*|${CLI_WRAPPER_PATH}nohup"?|${CLI_WRAPPER_PATH}time"?(?:\s+-p)?|${CLI_WRAPPER_PATH}nice"?(?:\s+-n\s*-?\d+|\s+-\d+)?|${CLI_WRAPPER_PATH}caffeinate"?(?:\s+-[a-zA-Z]+(?:\s+\d+)?)*|${CLI_WRAPPER_PATH}exec"?(?:\s+-[acl]+(?:\s+(?!-)[^\s;|&]+)?)?|${CLI_WRAPPER_PATH}script"?(?:\s+-[a-zA-Z]+)*(?:\s+(?!-)[^\s;|&]+)?|${CLI_WRAPPER_PATH}xargs"?(?:\s+-[^\s;|&]+(?:\s+(?!-)[^\s;|&]+)?)*|${CLI_WRAPPER_PATH}arch"?(?:\s+-\w+)*|[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|[^\s;|&"']*))\s+)*`;
// A command starts at the line start, after a separator, inside $(…) or a
// backtick, after a shell keyword that introduces a command (do, then, else,
// elif, if, while, until), or after a `!` negation.
// A line copied with its interactive prompt still runs the command after it: `$ `,
// `% `, `❯ `, `user@host:~$ `, the macOS zsh default `user@host ~ % `,
// `[user@host ~]$ `, `bash-5.2$ `, `sh-3.2# `, a `(venv) ` prefix, `PS C:\> `, `C:\…> `,
// the pre-Catalina macOS bash `host:~ user$ ` and the oh-my-zsh `➜  ~ `.
const SHELL_PROMPT = String.raw`^\s*(?:\([^)\s]+\)\s+)?(?:[$%❯]|➜(?:\s+\S+)?|[\w.-]+:\S*\s+[\w.-]+\$|[\w.-]+@[\w.-]+(?::\S*|\s+[^\s$#%]+)?\s?[$#%]|[\w.-]*\d[\w.-]*[$#%]|\[[^\]]+\][$#%]|PS\s[^>]*>|[A-Za-z]:\\[^>]*>)(?=\s)`;
const CLI_COMMAND_START = String.raw`(?:^|${SHELL_PROMPT}|[;|{}=:&(\x60]|\$\(|\b(?:do|then|else|elif|if|while|until)(?=\s)|!(?=\s))`;
const CLI_BOUNDARY = String.raw`${CLI_COMMAND_START}\s*${CLI_WRAPPER}[\\"']?(?:[\w.~$\{\}-]*\/)*`;
const cliInvocations = (statement, name) => [...statement.matchAll(new RegExp(`${CLI_BOUNDARY}(?:${name})(?:\\.exe)?["']?(?=\\s|$|\\$)([^;|&]*)`, 'gi'))]
  .map((match) => match[1].trim());
// Indirect execution hides the command from every per-tool rule, so it is a sink
// in its own right (fail-closed): an interpreter one-liner (python/perl/ruby/node/
// expect/php with -c, -e or --eval), a scheduled run (at with a time, batch, crontab
// other than -l), a root shell (sudo -s, -i, --shell, --login), ssh with a remote
// command, any shell interpreter
// or osascript in command position (`| bash`, `bash <(…)`, `/bin/sh -c`), `su … -c`,
// `env -S`, `find … -exec`, eval, and a substitution or variable in command
// position (`$(which gam) …`, a backtick, `${GAM:-gam} …`, `"$GAM" …`, `"$@"`). An
// assignment-shaped `$name = value` line (another language's syntax) is not one.
const INDIRECT_EXEC = new RegExp(String.raw`(?:^|${SHELL_PROMPT}|[;|{}&(\x60]|\$\(|\b(?:do|then|else|elif|if|while|until)(?=\s)|!(?=\s))\s*${CLI_WRAPPER}(?:(?:[\w.~-]*\/)*(?:python[23]?(?:\.\d+)?|perl|ruby|node|expect|php)(?=\s)[^;|&]*?\s(?:-[A-Za-z]*[ceE](?=[\s"']|$)|--eval\b)|at\s+(?:-[A-Za-z]+|now|noon|midnight|teatime|today|tomorrow|\d)|batch(?=\s*(?:$|[;|&)]|-[A-Za-z]))|(?:[\w.~-]*\/)*crontab(?!\s+-l\b)(?=\s|$)|(?:[\w.~-]*\/)*sudo"?(?:\s+(?:-[A-Za-z]+|--[\w-]+(?:=[^\s;|&]+)?)(?:\s+(?!-)[^\s;|&]+)?)*?\s+(?:-[A-Za-z]*[si][A-Za-z]*|--(?:shell|login))(?=\s|$)|ssh(?:\s+-[A-Za-z]+(?:\s+(?!-)[^\s;|&]+)?)*\s+(?!-)[^\s;|&]+\s+\S|(?:[\w.~-]*\/)*(?:bash|sh|zsh|dash|ksh|fish|osascript)(?=[\s;|&)]|$)|su\b[^;|&]*\s-c\b|env(?:\s+-[^\s;|&]+)*\s+(?:-S|--split-string)\b|find\b[^;|&]*\s-(?:exec|execdir|ok|okdir)\b|eval\s|\$\(|\x60|"?\$\{[^}]*\}"?(?=\s+[^=\s]|\s*$)|"?\$(?:[A-Za-z_]\w*|[@*#?0-9])"?(?=\s+[^=\s]|\s*[;|&]|\s*$))`, 'i');
const cliTokens = (args) => args.split(/\s+/).map((token) => token.replace(/^["']+|["']+$/g, '')).filter(Boolean);
function firstListedVerb(tokens, readOnly, mutating) {
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (readOnly.has(lower)) return 'read';
    if (mutating.has(lower)) return 'write';
  }
  return 'unknown';
}
const GAM_READ_ONLY = new Set(['print', 'info', 'report', 'show', 'whatis', 'version', 'help', 'checkconn']);
const GAM_MUTATING = new Set(['create', 'update', 'delete', 'undelete', 'suspend', 'unsuspend', 'transfer', 'move', 'add',
  'remove', 'revoke', 'wipe', 'deprovision', 'action', 'signout', 'turnoff2sv', 'issuecommand', 'clear', 'sync', 'rename',
  'redirect', 'sendemail', 'replace', 'modify', 'copy', 'trash', 'untrash', 'purge', 'empty']);
const GCLOUD_READ_ONLY = new Set(['list', 'describe', 'get-iam-policy', 'get-value', 'info', 'version', 'help', 'search', 'read']);
const GCLOUD_MUTATING = new Set(['create', 'update', 'delete', 'set', 'add-iam-policy-binding', 'remove-iam-policy-binding',
  'set-iam-policy', 'enable', 'disable', 'undelete', 'deploy', 'import', 'patch', 'reset', 'unset', 'add', 'remove', 'login',
  'revoke', 'activate-service-account']);
// Any explicit method that is not GET, HEAD, OPTIONS or TRACE is a write (fail-closed,
// as for unlisted gam and gcloud verbs: PURGE, MOVE, COPY, LOCK … change state), and a
// method taken from an expansion ($METHOD, ${METHOD}, $(…)) can be any verb.
const HTTP_METHOD_WRITE = String.raw`(?:(?!(?:GET|HEAD|OPTIONS|TRACE|get|head|options|trace)\b)[A-Za-z]+\b|\$[\w{(])`;
const HTTP_WRITE_LONG = new RegExp(String.raw`(?:^|\s)(?:-X\s*|--request[\s=]+)["']?${HTTP_METHOD_WRITE}|(?:^|\s)--(?:data(?:-raw|-binary|-urlencode|-ascii)?|json|form|upload-file|post-data|post-file|body-data|body-file|config)\b|(?:^|\s)--method[\s=]+["']?${HTTP_METHOD_WRITE}|X-(?:HTTP-)?Method(?:-Override)?\s*:\s*${HTTP_METHOD_WRITE}`, 'i');
// -K reads a config file that can set the method or a body: fail-closed. A short
// option's value may be glued to it (`-dname=value`, `-d$BODY`), and curl sends a
// method in any case (`-sXpost`).
const HTTP_WRITE_SHORT = new RegExp(String.raw`(?:^|\s)-[A-Za-z]*(?:[dFTK]|X\s*["']?${HTTP_METHOD_WRITE})`);
// An unquoted `$VAR` / `${…}` / `$(…)` argument can expand into any option,
// including a write method or a body, so it is a write (fail-closed). Expansions
// inside quotes ("…${OKTA_API_TOKEN}") stay single arguments and are fine.
function unquotedExpansionArgument(args) {
  let single = false;
  let double = false;
  for (let index = 0; index < args.length; index += 1) {
    const char = args[index];
    if (char === '\\') { index += 1; continue; }
    if (char === "'" && !double) { single = !single; continue; }
    if (char === '"' && !single) { double = !double; continue; }
    if (char === '$' && !single && !double && (index === 0 || /\s/.test(args[index - 1]))) return true;
  }
  return false;
}
const JAMF_READ_ONLY = new Set(['help', 'version', 'about', 'checkjssconnection', 'listusers', 'getcomputername']);
const FDESETUP_READ_ONLY = new Set(['status', 'list', 'isactive', 'haspersonalrecoverykey', 'hasinstitutionalrecoverykey',
  'usingrecoverykey', 'showdeferralinfo', 'supportsauthrestart', 'version', 'help']);
const DISKUTIL_READ_ONLY = new Set(['list', 'info', 'information', 'activity', 'listfilesystems', 'verifyvolume', 'verifydisk', 'help']);
const DISKUTIL_APFS_READ_ONLY = new Set(['list', 'listcryptousers', 'listsnapshots', 'listvolumegroups', 'listusers']);
const DEFAULTS_READ_ONLY = new Set(['read', 'read-type', 'domains', 'find', 'help']);
const LAUNCHCTL_READ_ONLY = new Set(['list', 'print', 'print-cache', 'print-disabled', 'blame', 'help', 'version', 'procinfo',
  'hostinfo', 'examine', 'dumpstate', 'managerpid', 'manageruid', 'managername', 'getenv', 'error', 'variant']);

const G1_CLI_SINKS = [
  ['gam-write', 'gam', (args) => firstListedVerb(cliTokens(args), GAM_READ_ONLY, GAM_MUTATING) !== 'read'],
  ['gcloud-write', 'gcloud', (args) => firstListedVerb(cliTokens(args).filter((token) => !token.startsWith('-')), GCLOUD_READ_ONLY, GCLOUD_MUTATING) !== 'read'],
  ['http-write', 'curl|wget', (args) => HTTP_WRITE_LONG.test(` ${args}`) || HTTP_WRITE_SHORT.test(` ${args}`) || unquotedExpansionArgument(args)],
  ['http-write', 'https?', (args) => {
    const tokens = cliTokens(args);
    const positional = tokens.filter((token) => !token.startsWith('-'));
    // a method-shaped first positional other than GET, HEAD or OPTIONS (HTTPie's syntax)
    if (/^[A-Za-z]+$/.test(positional[0] || '') && !/^(?:GET|HEAD|OPTIONS)$/i.test(positional[0])) return true;
    if (HTTP_WRITE_LONG.test(` ${args}`) || /(?:^|\s)(?:-f|--raw)(?=[\s=]|$)/.test(` ${args}`)) return true;
    return positional.slice(1).some((token) => /^[^=\s:]+(?::=|=(?!=)|@)/.test(token));
  }],
  ['jamf-write', 'jamf', (args) => !JAMF_READ_ONLY.has((cliTokens(args)[0] || '').toLowerCase())],
  ['profiles-write', 'profiles', (args) => {
    const tokens = cliTokens(args);
    if (tokens.some((token) => /^(?:install|remove|renew|sync)$/i.test(token) || /^-[IRD]$/.test(token))) return true;
    return !/^(?:show|list|status|validate|version|help|-P|-L|-C|-H)$/.test(tokens[0] || '');
  }],
  ['dscl-write', 'dscl', (args) => /(?:^|\s)-(?:create|delete|append|change|passwd|merge|mcx(?:set|delete|import|edit))\w*\b/i.test(` ${args}`) ||
    !/(?:^|\s)-(?:read|readall|list|search|readpl|readpli)\b/i.test(` ${args}`)],
  ['fdesetup-write', 'fdesetup', (args) => !FDESETUP_READ_ONLY.has((cliTokens(args)[0] || '').toLowerCase())],
  ['diskutil-write', 'diskutil', (args) => {
    const tokens = cliTokens(args).map((token) => token.toLowerCase());
    if (tokens[0] === 'apfs') return !DISKUTIL_APFS_READ_ONLY.has(tokens[1] || '');
    return !DISKUTIL_READ_ONLY.has(tokens[0] || '');
  }],
  ['softwareupdate-write', 'softwareupdate', (args) => /(?:^|\s)(?:-i\w*|--install\S*|-d|--download|--fetch-full-installer|--schedule|--reset-ignored|--ignore|--background)\b/.test(` ${args}`) ||
    !/(?:^|\s)(?:-l|--list|--history|--list-full-installers|--help|-h)\b/.test(` ${args}`)],
  ['networksetup-write', 'networksetup', (args) => cliTokens(args).filter((token) => token.startsWith('-'))
    .some((token) => !/^-(?:get|list|print|version|help|show)/i.test(token)) || !cliTokens(args).some((token) => token.startsWith('-'))],
  ['systemsetup-write', 'systemsetup', (args) => cliTokens(args).filter((token) => token.startsWith('-'))
    .some((token) => !/^-(?:get|list|print|help|version)/i.test(token)) || !cliTokens(args).some((token) => token.startsWith('-'))],
  ['defaults-write', 'defaults', (args) => {
    const tokens = cliTokens(args).filter((token, index, all) => !/^-(?:currentHost|host)$/i.test(token) && !/^-host$/i.test(all[index - 1] || ''));
    return !DEFAULTS_READ_ONLY.has((tokens[0] || '').toLowerCase());
  }],
  ['launchctl-write', 'launchctl', (args) => !LAUNCHCTL_READ_ONLY.has((cliTokens(args)[0] || '').toLowerCase())],
  ['kickstart-write', 'kickstart', () => true],
];

function g1CliHits(statement) {
  const hits = [];
  for (const [label, name, isWrite] of G1_CLI_SINKS) {
    if (cliInvocations(statement, name).some((args) => isWrite(args))) hits.push(label);
  }
  if (INDIRECT_EXEC.test(statement)) hits.push('indirect-exec');
  return [...new Set(hits)];
}

function commandsIn(statement, language) {
  const hits = [];
  COMMAND_AT_BOUNDARY.lastIndex = 0;
  const commandMatches = [];
  let match;
  while ((match = COMMAND_AT_BOUNDARY.exec(statement))) {
    commandMatches.push({ command: match[1], index: match.index });
  }
  commandMatches.forEach((item, index) => {
    const end = commandMatches[index + 1]?.index ?? statement.length;
    const commandStatement = statement.slice(item.index, end);
    if (isMutation(item.command, commandStatement)) hits.push(item.command);
  });
  if (/(?:^|[;|{}=:])\s*scp\s+/i.test(statement)) hits.push('scp');
  if (/(?:^|[;|{}=:])\s*repadmin\s+\/syncall\b/i.test(statement)) hits.push('repadmin');
  if (/(?:^|[;|{}=:])\s*gpupdate\s+\/force\b/i.test(statement)) hits.push('gpupdate');
  if (POWER_SHELL_LANGUAGES.has(language)) {
    const dotNetFilePatterns = [
      [/\[IO\.FileStream\]::new\([^\r\n]*\[IO\.FileMode\]::CreateNew/i, 'dotnet-file-create'],
      [/\$checkpointStream\.Write\s*\(/i, 'dotnet-file-write'],
      [/\$checkpointStream\.Flush\s*\(\s*\$true\s*\)/i, 'dotnet-file-flush'],
      [/\[IO\.File\]::Move\s*\(/i, 'dotnet-file-move'],
      [/\[IO\.File\]::Delete\s*\(/i, 'dotnet-file-delete'],
    ];
    for (const [pattern, label] of dotNetFilePatterns) {
      if (pattern.test(statement)) hits.push(label);
    }
  }
  if (SHELL_LANGUAGES.has(language)) {
    // a wrapper (sudo, env, xargs, time, …) in front of a native sink hides nothing
    const boundary = `(?:^|${SHELL_PROMPT}|[;|{}=:&])\\s*${CLI_WRAPPER}`;
    const nativePatterns = [
      [new RegExp(`${boundary}git\\s+(?:add|branch|checkout|clean|clone|commit|fetch|init|merge|mv|push|rebase|reset|restore|rm|switch|tag)\\b`, 'i'), 'git-write'],
      [new RegExp(`${boundary}scp\\s+`, 'i'), 'scp'],
      [new RegExp(`${boundary}rsync\\s+`, 'i'), 'rsync'],
      [new RegExp(`${boundary}(?:cp|install|mkdir|mv|rm|tee|touch)\\s+`, 'i'), 'file-write'],
      [new RegExp(`${boundary}(?:chmod|chown)\\s+`, 'i'), 'metadata-write'],
      [new RegExp(`${boundary}(?:apt(?:-get)?|brew|dnf|npm|pip(?:3)?|pnpm|winget|yum)\\s+(?:add|ci|install|remove|uninstall|update|upgrade)\\b`, 'i'), 'package-write'],
      [/(?:^|\s)>{1,2}\s*(?:[./~$]|["'][^"']+["']|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b)/i, 'redirect-write'],
    ];
    for (const [pattern, label] of nativePatterns) {
      if (pattern.test(statement)) hits.push(label);
    }
    hits.push(...g1CliHits(statement));
  }
  return hits;
}

function mutationHits(document) {
  const executable = [];
  const preview = [];
  for (const fence of document.fences.filter((item) => MUTATION_FENCE_LANGUAGES.has(item.language))) {
    const shell = SHELL_LANGUAGES.has(fence.language);
    for (let offset = 0; offset < fence.lines.length; offset += 1) {
      const line = fence.startLine + offset;
      const rawLine = fence.lines[offset];
      const comment = rawLine.match(/^\s*#\s?(.*)$/);
      let statement = comment ? comment[1] : stripExecutableComment(rawLine, shell);
      // A shell line ending in a backslash continues on the next line: the logical
      // command is judged as one statement and attributed to its first line.
      while (shell && !comment && /\\\s*$/.test(statement) && offset + 1 < fence.lines.length) {
        offset += 1;
        statement = `${statement.replace(/\\\s*$/, ' ')}${stripExecutableComment(fence.lines[offset], shell)}`;
      }
      for (const command of commandsIn(statement, fence.language)) {
        (comment ? preview : executable).push({ file: document.file, fenceId: fence.id, line, command, statement: statement.trim() });
      }
    }
  }
  return { executable, preview };
}

const allHits = [...documents.values()].map(mutationHits);
const executableHits = allHits.flatMap((item) => item.executable);
const previewHits = allHits.flatMap((item) => item.preview);

function nearestMarker(hit) {
  const candidates = (markerByFence.get(hit.fenceId) || []).filter((marker) => marker.line <= hit.line);
  return candidates.at(-1);
}

function directR1Owners(hit) {
  return DIRECT_R1_INVENTORY.filter((entry) => entry.file === hit.file && entry.command === hit.command);
}

function classifyImpact(command, text) {
  const value = `${command} ${text}`.toLowerCase();
  const categories = new Set();
  const dotNetLocalFile = /^dotnet-file-/.test(command);
  const local = dotNetLocalFile || /start-process|new-item|set-content|export-csv|out-file|install-module|scp|rsync|git-write|file-write|metadata-write|package-write|redirect-write|gpupdate/.test(value);
  if (local) categories.add('reversible state change');
  if (dotNetLocalFile) categories.add('local filesystem write');
  if (!dotNetLocalFile && (/\b(?:add|assign|block|change|clear|convert|create|deactivate|delete|disable|enable|export|factory-reset|grant|install|invalidate|isolate|move|purge|quarantine|reclaim|release|remove|rename|replace|repadmin|reset|restart|restore|retire|revoke|set|soft-delete|start|stop|submit|update|wipe|write)\b/.test(value) || MUTATING_VERB.test(command))) {
    categories.add('external-system mutation');
  }
  if (!dotNetLocalFile && /password|credential|authentication|session|revoke/.test(value)) categories.add('credential-related');
  if (!dotNetLocalFile && /user|account|group|member|identity|license|session|authentication/.test(value)) categories.add('identity-related');
  if (!dotNetLocalFile && /permission|member|grant|role|access/.test(value)) categories.add('permission-related');
  if (!dotNetLocalFile && /remove|delete|clear|wipe|purge/.test(value)) {
    categories.add('destructive');
    categories.add('data-removal related');
  }
  if (!dotNetLocalFile && /security|conditionalaccess|compliance|block|isolate|quarantine|mfa|session/.test(value)) categories.add('security-sensitive');
  // G1 sinks: remote admin APIs vs on-device macOS administration, plus the
  // destructive and security vocabulary those ecosystems use.
  if (G1_REMOTE_SINKS.has(command)) categories.add('external-system mutation');
  if (G1_DEVICE_SINKS.has(command)) categories.add('device configuration change');
  if (G1_REMOTE_SINKS.has(command) || G1_DEVICE_SINKS.has(command)) {
    if (/erase|powerwash|deprovision|wipe|unmanage|removeframework|undelete/.test(value)) {
      categories.add('destructive');
      categories.add('data-removal related');
    }
    if (/fdesetup|filevault|2sv|factor|session|token|lock|passw|signout|suspend|deactivat/.test(value)) categories.add('security-sensitive');
    if (/user|group|member|license|licence|admin|role|account|dscl/.test(value)) categories.add('identity-related');
  }
  return [...categories];
}
const G1_REMOTE_SINKS = new Set(['gam-write', 'gcloud-write', 'http-write', 'jamf-write', 'indirect-exec']);
const G1_DEVICE_SINKS = new Set(['profiles-write', 'dscl-write', 'fdesetup-write', 'diskutil-write', 'softwareupdate-write',
  'networksetup-write', 'systemsetup-write', 'defaults-write', 'launchctl-write', 'kickstart-write']);

const EFFECT_FAMILIES = [
  [/^(?:invalidate|revoke)(?:s|d|ing)?\b/i, /\bREVOKE\b/],
  [/^(?:replace|reset)(?:s|d|ting)?\b/i, /\b(?:RESET|RESTORE|REPLACE)\b/],
  [/^(?:factory-reset|wipe|erase|reimage)(?:s|d|ing)?\b/i, /\b(?:WIPE|REIMAGE)\b/],
  [/^(?:delete|clear)(?:s|d|ing)?\b/i, /\b(?:DELETE|PURGE|CLEAR|WIPE)\b/],
  [/^remove(?:s|d|ing)?\b/i, /\b(?:REMOVE|RECLAIM|RETIRE)\b/],
  [/^grant(?:s|ed|ing)?\b/i, /\bGRANT\b/],
  [/^assign(?:s|ed|ing)?\b/i, /\bASSIGN\b/],
  [/^(?:create|add)(?:s|d|ed|ing)?\b/i, /\b(?:CREATE|ADD|BLOCK|INSTALL|WRITE)\b/],
  [/^(?:allow|permit)(?:s|ted|ting|ed|ing)?\b/i, /\bALLOW\b/],
  [/^enable(?:s|d|ing)?\b/i, /\bENABLE\b/],
  [/^(?:disable|block|deactivate)(?:s|d|ed|ing)?\b/i, /\b(?:DISABLE|BLOCK|DEACTIVATE)\b/],
  [/^(?:release|deliver)(?:s|d|ed|ing)?\b/i, /\bRELEASE\b/],
  [/^(?:quarantine|move)(?:s|d|ing)?\b/i, /\b(?:QUARANTINE|MOVE)\b/],
  [/^convert(?:s|ed|ing)?\b/i, /\bCONVERT\b/],
  [/^reclaim(?:s|ed|ing)?\b/i, /\bRECLAIM\b/],
  [/^restore(?:s|d|ing)?\b/i, /\b(?:RESTORE|UNBLOCK)\b/],
  [/^change(?:s|d|ing)?\b/i, /\b(?:CHANGE|ENABLE|DISABLE|RENAME|SET)\b/],
  [/^coordinate(?:s|d|ing)?\b/i, /\b(?:COORDINATE|REVOKE)\b/],
  [/^request(?:s|ed|ing)?\b/i, /\bSEND\b/],
  [/^isolate(?:s|d|ing)?\b/i, /\bISOLATE\b/],
  [/^(?:write|export)(?:s|d|ed|ing|ten)?\b/i, /\b(?:WRITE|EXPORT)\b/],
  [/^install(?:s|ed|ing)?\b/i, /\bINSTALL\b/],
  [/^(?:submit|report)(?:s|ted|ting|ed|ing)?\b/i, /\b(?:SUBMIT|REPORT)\b/],
  [/^transfer(?:s|red|ring)?\b/i, /\bTRANSFER\b/],
  [/^stop(?:s|ped|ping)?\b/i, /\bSTOP\b/],
  // G1 — Google Workspace, Okta, Jamf and macOS action families
  [/^suspend(?:s|ed|ing)?\b/i, /\bSUSPEND\b/],
  [/^(?:unsuspend|reactivate|reinstate)(?:s|d|ed|ing)?\b/i, /\b(?:UNSUSPEND|REACTIVATE|RESTORE)\b/],
  [/^undelete(?:s|d|ing)?\b/i, /\b(?:UNDELETE|RESTORE)\b/],
  [/^powerwash(?:es|ed|ing)?\b/i, /\bPOWERWASH\b/],
  [/^deprovision(?:s|ed|ing)?\b/i, /\bDEPROVISION\b/],
  [/^lock(?:s|ed|ing)?\b/i, /\bLOCK\b/],
  [/^unlock(?:s|ed|ing)?\b/i, /\bUNLOCK\b/],
  [/^unassign(?:s|ed|ing)?\b/i, /\b(?:UNASSIGN|REMOVE)\b/],
  [/^activate(?:s|d|ing)?\b/i, /\b(?:ACTIVATE|ENABLE)\b/],
  [/^enroll(?:s|ed|ing)?\b/i, /\bENROLL\b/],
  [/^(?:unenroll|unmanage)(?:s|d|ed|ing)?\b/i, /\b(?:UNENROLL|UNMANAGE|REMOVE)\b/],
  [/^(?:sign|log)\s+out\b/i, /\b(?:SIGN OUT|REVOKE)\b/],
  [/^promote(?:s|d|ing)?\b/i, /\b(?:GRANT|ASSIGN|PROMOTE)\b/],
  [/^restart(?:s|ed|ing)?\b/i, /\bRESTART\b/],
];

function assertEffectCorrespondence(effect, expected, context) {
  const clauses = effect.split(/\s*(?:;|,\s*(?:and\s+)?|\band\b)\s*/i)
    .map((clause) => clause.replace(/^(?:only|exactly|permanently|automatically)\s+/i, '').trim())
    .filter(Boolean);
  const applicable = clauses.map((clause) => EFFECT_FAMILIES.find(([effectPattern]) => effectPattern.test(clause)))
    .filter(Boolean);
  assert.ok(applicable.length > 0, `${context}: Effect is not mapped to a known action family`);
  const missing = applicable.filter(([, confirmationPattern]) => !confirmationPattern.test(expected));
  assert.deepEqual(missing, [], `${context}: exact confirmation omits one or more Effect action families (${effect})`);
}

function extractTargetBindings(target) {
  return [...target.matchAll(/\[[A-Za-z0-9_@.,-]+\]|\$[A-Za-z][A-Za-z0-9]*/g)].map((match) => match[0]);
}

function sourceRegion(document, startLine, endLine) {
  return document.lines.slice(startLine - 1, endLine).join('\n');
}

function nextMarkerLine(marker) {
  if (marker.kind !== 'portal') {
    const list = markerByFence.get(marker.fenceId) || [];
    return list.find((item) => item.line > marker.line)?.line || documents.get(marker.file).fences.find((fence) => fence.id === marker.fenceId).endLine + 1;
  }
  const document = documents.get(marker.file);
  const nextMarker = markers
    .filter((item) => item.file === marker.file && item.kind === 'portal' && item.line > marker.line)
    .sort((a, b) => a.line - b.line)[0]?.line || document.lines.length + 1;
  let structuralBoundary = document.lines.length + 1;
  for (let line = marker.line + 1; line <= document.lines.length; line += 1) {
    if (/^\s*(?:#{1,6}\s+|---\s*$)/.test(document.lines[line - 1])) {
      structuralBoundary = line;
      break;
    }
  }
  return Math.min(nextMarker, structuralBoundary);
}

function portalMutationCandidates(document) {
  const candidates = [];
  const action = '(?:Add|Allow|Assign|Block|Calendar|Clear|Convert|Coordinate|Create|Deactivate|Delete|Disable|Enable|Fix|Grant|Install|Isolate|Log|Move|Purge|Reclaim|Reimage|Release|Remove|Rename|Replace|Require|Reset|Restore|Restrict|Retire|Revoke|Run|Schedule|Send|Set|Start|Stop|Submit|Transfer|Uncheck|Update|Wipe|Activate|Deprovision|Enroll|Erase|Lock|Powerwash|Reactivate|Suspend|Unassign|Undelete|Unenroll|Unlock|Unmanage|Unsuspend)';
  const actionBody = action.slice(3, -1);
  const arrowMutation = new RegExp(`→\\s*(?:\\*{0,2}|\`)?(${actionBody})\\b`, 'i');
  const imperativeMutation = new RegExp(`^\\s*(?:>\\s*)?(?:\\d+[.)]|[-*])\\s+(?:\\*\\*[^*]+:\\*\\*\\s*)?(?:Click|Select|Choose)\\s+(?:\\*{0,2}|\`)?(${actionBody})\\b`, 'i');
  const navigationListMutation = new RegExp(`^\\s*[-*]\\s+(${actionBody})(?:\\s*\\/\\s*(?:${actionBody}))+\\s*:.*→`, 'i');
  const navigationLabelMutation = new RegExp(`^\\s*[-*]\\s+(${actionBody})[^:]*:.*→`, 'i');
  const portalCue = /\b(?:Entra|Intune|EAC|Defender|Exchange|SharePoint|Teams|Zoom|Adobe|Meraki|admin portal|Recipients|Devices|Users|Groups|Policies|Settings)\b/i;
  // G1 lane cue (Google Admin console, Okta, Jamf, Apple Business Manager, macOS,
  // Fleet, Zoom Rooms). Lines carrying it also get the arrow rule, so a breadcrumb
  // that ends in an action (`… → **Suspend user**`) is a mutation candidate.
  // Case-sensitive on purpose: these are product names ("fleet-wide" is not Fleet).
  // "Apple Business" is the product's current name (formerly Apple Business Manager).
  const g1PortalCue = /\b(?:admin\.google\.com|Admin console|Google Workspace|Okta|Jamf|Apple Business(?: Manager)?|System Settings|Self Service|Fleet(?!-)|Zoom Rooms|ChromeOS|Chromebook)\b/;
  const listItem = /^\s*(?:>\s*)?(?:\d+[.)]|[-*])\s+/;
  // The G1 click grammar also knows ChromeOS's "Re-enable selected devices". It is kept out
  // of the global vocabulary so the Microsoft runbooks' candidates do not change.
  const g1ArrowMutation = new RegExp(`(?:→\\s*|\\b(?:Click|Select|Choose|Tap)\\s+)(?:\\*{0,2}|\`)?(${actionBody}|Re-enable)\\b`, 'i');
  // Inside a G1 lane document (the 19 runbooks and the two G1 knowledge docs) the click
  // grammar applies to any portal-cued list item, so a control named without the product
  // ("At the top, click **Disable selected devices**") is still a candidate.
  const g1LaneDocument = /^\.claude\/commands\/(?:gws|okta|jamf|mac)-[\w-]+\.md$|^\.claude\/commands\/zoom-room-issue\.md$|^docs\/(?:portal-nav-google-2026|gws-reversibility)\.md$/.test(document.file);
  const navReference = document.file === 'docs/portal-nav-2026.md' || document.file === 'docs/portal-nav-google-2026.md';
  const frontmatterEnd = document.lines[0] === '---' ? document.lines.indexOf('---', 1) : -1;
  document.lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (document.fenceAtLine.has(lineNumber)) return;
    if (frontmatterEnd > 0 && index <= frontmatterEnd) return;
    if (/^\s*\|/.test(line)) return;
    if (/^\s*(?:<!--\s*SAFETY GATE|>\s*\*\*PREVIEW ONLY|[-*]\s+\*\*(?:Target|Effect|Scope|Reversibility|Required confirmation|Failure behavior|Undo))/.test(line)) return;
    const inPortalRegion = markers.some((marker) => marker.kind === 'portal' && marker.file === document.file &&
      marker.line < lineNumber && lineNumber < nextMarkerLine(marker));
    const cue = portalCue.test(line) || g1PortalCue.test(line);
    const match = line.match(navigationListMutation) ||
      ((cue || navReference) ? line.match(navigationLabelMutation) : null) ||
      ((cue || inPortalRegion || g1LaneDocument) ? line.match(imperativeMutation) : null) ||
      (portalCue.test(line) && /^\\s*(?:>\\s*)?(?:\\d+[.)]|[-*])\\s+/.test(line) ? line.match(arrowMutation) : null) ||
      ((g1PortalCue.test(line) || (g1LaneDocument && portalCue.test(line))) && listItem.test(line) ? line.match(g1ArrowMutation) : null);
    if (match) {
      const actionWord = match[1];
      candidates.push({ file: document.file, line: lineNumber, statement: line.trim(), actionWord });
    }
  });
  return candidates;
}

const PORTAL_CONFIRMATION_BY_ACTION = new Map([
  ['add', /\b(?:ADD|CREATE|GRANT|ASSIGN|BLOCK)\b/], ['allow', /\b(?:ALLOW|ENABLE)\b/],
  ['assign', /\b(?:ASSIGN|GRANT)\b/], ['block', /\b(?:BLOCK|DISABLE)\b/],
  ['calendar', /\b(?:CALENDAR|SCHEDULE)\b/], ['clear', /\b(?:CLEAR|DELETE|PURGE)\b/],
  ['convert', /\bCONVERT\b/], ['coordinate', /\b(?:COORDINATE|SEND)\b/],
  ['create', /\b(?:CREATE|ADD|INSTALL)\b/], ['deactivate', /\b(?:DEACTIVATE|DISABLE)\b/],
  ['delete', /\b(?:DELETE|PURGE|WIPE)\b/], ['disable', /\b(?:DISABLE|BLOCK|DEACTIVATE)\b/],
  ['enable', /\b(?:ENABLE|ALLOW)\b/], ['fix', /\b(?:FIX|REMEDIATE|CHANGE)\b/],
  ['grant', /\b(?:GRANT|ADD|ASSIGN)\b/], ['install', /\bINSTALL\b/],
  ['isolate', /\bISOLATE\b/], ['log', /\b(?:LOG|DOCUMENT|UPDATE)\b/],
  ['move', /\b(?:MOVE|QUARANTINE)\b/], ['purge', /\b(?:PURGE|DELETE)\b/],
  ['reclaim', /\b(?:RECLAIM|REMOVE)\b/], ['reimage', /\b(?:REIMAGE|WIPE)\b/],
  ['release', /\bRELEASE\b/], ['remove', /\b(?:REMOVE|DELETE|RECLAIM|RETIRE)\b/],
  ['rename', /\bRENAME\b/], ['replace', /\b(?:REPLACE|RESET)\b/],
  ['require', /\b(?:REQUIRE|ENABLE)\b/], ['reset', /\bRESET\b/],
  ['restore', /\b(?:RESTORE|UNBLOCK)\b/], ['restrict', /\b(?:RESTRICT|BLOCK|DISABLE)\b/],
  ['retire', /\bRETIRE\b/], ['revoke', /\bREVOKE\b/],
  ['run', /\b(?:RUN|START|EXECUTE)\b/], ['schedule', /\b(?:SCHEDULE|CALENDAR)\b/],
  ['send', /\b(?:SEND|SUBMIT)\b/], ['set', /\b(?:SET|CHANGE|ENABLE|DISABLE|RESET|RESTORE)\b/],
  ['start', /\b(?:START|RUN)\b/], ['stop', /\b(?:STOP|DISABLE)\b/],
  ['submit', /\b(?:SUBMIT|REPORT|SEND)\b/], ['transfer', /\b(?:TRANSFER|GRANT|ASSIGN)\b/],
  ['uncheck', /\b(?:UNCHECK|DISABLE)\b/], ['update', /\b(?:UPDATE|CHANGE|SET)\b/],
  ['wipe', /\bWIPE\b/],
  // G1 — Google Workspace, Okta, Jamf and macOS actions
  ['activate', /\b(?:ACTIVATE|REACTIVATE|ENABLE)\b/], ['deprovision', /\bDEPROVISION\b/],
  ['enroll', /\bENROLL\b/], ['erase', /\b(?:ERASE|WIPE)\b/],
  ['lock', /\bLOCK\b/], ['powerwash', /\bPOWERWASH\b/],
  ['reactivate', /\b(?:REACTIVATE|RESTORE|UNSUSPEND)\b/], ['suspend', /\bSUSPEND\b/],
  ['unassign', /\b(?:UNASSIGN|REMOVE)\b/], ['undelete', /\b(?:UNDELETE|RESTORE)\b/],
  ['unenroll', /\b(?:UNENROLL|REMOVE)\b/], ['unlock', /\bUNLOCK\b/],
  ['unmanage', /\bUNMANAGE\b/], ['unsuspend', /\b(?:UNSUSPEND|RESTORE|REACTIVATE)\b/],
  ['re-enable', /\b(?:RE-ENABLE|ENABLE|REACTIVATE)\b/],
]);

const portalCandidates = [...documents.values()].flatMap(portalMutationCandidates);

function portalOwner(candidate) {
  return markers
    .filter((marker) => marker.kind === 'portal' && marker.file === candidate.file && marker.line < candidate.line && candidate.line < nextMarkerLine(marker))
    .sort((a, b) => a.line - b.line)
    .at(-1);
}

const CLIENT_BOUNDARIES = Object.freeze([
  {
    id: 'init-memory-force-replace', file: 'scripts/init-memory.js', testFile: 'scripts/init-memory.test.js',
    interface: 'local filesystem', mode: 'gated', evidenceGroup: 'memory',
    effect: 'Checkpoint and replace the six-file memory target set.',
    authorization: 'Separate --force preview and exact normalized-directory, file-count, effect, and full plan SHA-256 phrase.',
    impactCategories: ['data-removal related', 'destructive', 'local filesystem write', 'reversible state change'],
  },
  {
    id: 'init-memory-initial-create', file: 'scripts/init-memory.js', testFile: 'scripts/init-memory.test.js',
    interface: 'local filesystem', mode: 'gated', evidenceGroup: 'memory',
    effect: 'Create one previously absent six-file memory target set.',
    authorization: 'Exact normalized-directory, file-count, effect, and full plan SHA-256 phrase.',
    impactCategories: ['local filesystem write', 'reversible state change'],
  },
  {
    id: 'jira-comment-internal-api-write', file: 'scripts/jira-client.js', testFile: 'scripts/jira-client.test.js',
    interface: 'Jira Service Management API', mode: 'gated', evidenceGroup: 'jira',
    effect: 'Post one internal comment to one normalized issue key.',
    authorization: 'Exact site, issue, INTERNAL visibility, and full payload SHA-256 phrase before credentials/network.',
    impactCategories: ['external-system mutation'],
  },
  {
    id: 'jira-comment-public-api-write', file: 'scripts/jira-client.js', testFile: 'scripts/jira-client.test.js',
    interface: 'Jira Service Management API', mode: 'gated', evidenceGroup: 'jira',
    effect: 'Post one reporter-visible public comment to one normalized issue key.',
    authorization: 'Exact site, issue, PUBLIC visibility, and full payload SHA-256 phrase before credentials/network.',
    impactCategories: ['external-system mutation', 'information disclosure'],
  },
  {
    id: 'jira-create-api-write', file: 'scripts/jira-client.js', testFile: 'scripts/jira-client.test.js',
    interface: 'Jira Service Management API', mode: 'gated', evidenceGroup: 'jira',
    effect: 'Create one service request in one service desk and request type.',
    authorization: 'Exact site, desk, request type, and full payload SHA-256 phrase before credentials/network.',
    impactCategories: ['external-system mutation'],
  },
  {
    id: 'jira-transition-api-write', file: 'scripts/jira-client.js', testFile: 'scripts/jira-client.test.js',
    interface: 'Jira Service Management API', mode: 'gated', evidenceGroup: 'jira',
    effect: 'Apply one transition to one issue after a repeated live preflight.',
    authorization: 'Exact issue key/immutable ID, current-state hash, transition ID/hash phrase; drift causes zero POST.',
    impactCategories: ['external-system mutation'],
  },
  {
    id: 'security-audit-report-create', file: 'scripts/security-audit.js', testFile: 'scripts/security-audit.test.js',
    interface: 'local filesystem', mode: 'gated', evidenceGroup: 'security-audit',
    effect: 'Create one previously absent Markdown audit report.',
    authorization: 'Exact normalized target and full content SHA-256 phrase.',
    impactCategories: ['local filesystem write', 'reversible state change'],
  },
].map((entry) => Object.freeze({ ...entry, impactCategories: Object.freeze(entry.impactCategories) })));

const CLIENT_EVIDENCE = Object.freeze({
  jira: {
    sourceFile: 'scripts/jira-client.js', testFile: 'scripts/jira-client.test.js',
    sourcePatterns: [
      /function buildCreateConfirmation/, /function buildCommentConfirmation/, /function buildTransitionConfirmation/,
      /async function cmdCreate/, /async function cmdComment/, /async function cmdTransition/, /EXIT_PARTIAL_UNKNOWN/,
      /function verifyCreatedRequestReadBack/, /function verifyCommentReadBack/,
    ],
    testPatterns: [
      /create dry run and missing\/wrong confirmations use zero credentials and zero network/,
      /create receipt\/read-back failure or mismatch is partial\/unknown and is never retried/,
      /comment missing\/wrong confirmation is inert for both INTERNAL and PUBLIC modes/,
      /comment receipt\/read-back failure or mismatch is partial\/unknown and is never retried/,
      /state drift between repeated preflights invalidates an otherwise exact phrase and makes zero POSTs/,
      /POST transport ambiguity and read-back failure both report partial\/unknown without retry/,
    ],
  },
  memory: {
    sourceFile: 'scripts/init-memory.js', testFile: 'scripts/init-memory.test.js',
    sourcePatterns: [
      /EXECUTE MEMORY \$\{effect\.toUpperCase\(\)\} IN \$\{normalizedDir\} FOR \$\{targets\.length\} FILES PLAN SHA256/,
      /function createVerifiedBackup/, /function writeFilesAtomically/, /Verified readback failed/,
    ],
    testPatterns: [
      /the exact initial-create phrase installs the target set once/,
      /force replacement requires its own exact plan and creates a verified checkpoint/,
      /an injected install failure rolls back installed targets and reports partial state/,
      /force execution detects drift after backup and never installs over the changed target/,
    ],
  },
  'security-audit': {
    sourceFile: 'scripts/security-audit.js', testFile: 'scripts/security-audit.test.js',
    sourcePatterns: [
      /WRITE SECURITY AUDIT TARGET \$\{target\} CONTENT SHA256 \$\{contentSha256\}/,
      /function writeReportExclusive/, /Report SHA256 readback verification failed/, /never overwrites an existing report/,
      /function assertGitIgnoredWhenInRepository/, /refusing a Git-trackable audit artifact/,
    ],
    testPatterns: [
      /missing, generic, wrong-case, and whitespace-modified confirmations cause zero writes/,
      /the exact target\/content phrase creates one verified report and never overwrites it/,
      /content drift invalidates an otherwise exact target confirmation before any write/,
      /a target created after temp preparation wins the race and is never clobbered/,
      /a Git worktree rejects trackable report targets and accepts only ignored safe names/,
    ],
  },
});

function discoveredStateChangeExamples() {
  return markers.map((marker) => {
    let commands;
    const categories = new Set();
    if (marker.kind === 'portal') {
      const owned = portalCandidates.filter((candidate) => portalOwner(candidate) === marker);
      commands = owned.map((candidate) => `portal:${candidate.actionWord.toLowerCase()}`);
      for (const candidate of owned) {
        for (const category of classifyImpact(candidate.actionWord, candidate.statement)) categories.add(category);
      }
      const region = sourceRegion(documents.get(marker.file), marker.line, nextMarkerLine(marker) - 1);
      for (const category of classifyImpact('portal-action', region)) categories.add(category);
    } else {
      const sourceHits = marker.mode === 'gated' ? executableHits : previewHits;
      const owned = sourceHits.filter((hit) => hit.fenceId === marker.fenceId && nearestMarker(hit) === marker);
      commands = owned.map((hit) => hit.command);
      for (const hit of owned) {
        for (const category of classifyImpact(hit.command, hit.statement)) categories.add(category);
      }
    }
    const counts = new Map();
    for (const command of commands) counts.set(command, (counts.get(command) || 0) + 1);
    const sinks = [...counts].map(([sink, count]) => ({ sink, count }))
      .sort((left, right) => left.sink.localeCompare(right.sink));
    return {
      id: marker.id,
      file: marker.file,
      kind: marker.kind,
      mode: marker.mode,
      sinks,
      impactCategories: [...categories].sort(),
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function currentStateChangeInventory() {
  return {
    schemaVersion: 1,
    executionClassification: {
      gated: 'State-changing or disclosure-capable; exact authorization is required before the documented sink.',
      preview: 'Read-only as authored; mutation vocabulary is inert and describes a separately prohibited or review-routed effect.',
    },
    scope: {
      discoveredMarkdown: 'Tracked and nonignored untracked Markdown safety/preview markers plus recognized PowerShell, shell/native (including gam, gcloud, HTTP-API, jamf, and macOS administration tools, with plain-text shell gates), and portal mutation grammar.',
      clientBoundaries: 'State-changing or disclosure-capable Jira, memory, and security-audit implementations outside Markdown fence discovery.',
      limitation: 'Novel syntax and prose still require semantic review and grammar extension.',
    },
    directR1: DIRECT_R1_INVENTORY,
    examples: discoveredStateChangeExamples(),
    clientBoundaries: [...CLIENT_BOUNDARIES].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

if (process.env.AEGIS_PRINT_STATE_CHANGE_INVENTORY === '1') {
  const rendered = `${JSON.stringify(currentStateChangeInventory(), null, 2)}\n`;
  if (process.env.AEGIS_STATE_CHANGE_INVENTORY_LENGTH === '1') {
    process.stdout.write(String(rendered.length));
  } else if (process.env.AEGIS_STATE_CHANGE_INVENTORY_CHUNK === '1') {
    const offset = Number.parseInt(process.env.AEGIS_STATE_CHANGE_INVENTORY_OFFSET || '0', 10);
    const length = Number.parseInt(process.env.AEGIS_STATE_CHANGE_INVENTORY_CHUNK_LENGTH || '4096', 10);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 1) process.exit(2);
    process.stdout.write(Buffer.from(rendered.slice(offset, offset + length), 'utf8').toString('base64'));
  } else {
    process.stdout.write(rendered);
  }
  process.exit(0);
}

const STATE_CHANGE_INVENTORY_PATH = path.join(ROOT, 'docs', 'security', 'STATE_CHANGE_INVENTORY.json');
const STATE_CHANGE_INVENTORY = JSON.parse(fs.readFileSync(STATE_CHANGE_INVENTORY_PATH, 'utf8'));

function exactGateModel(expected, submitted) {
  return typeof submitted === 'string' && submitted === expected;
}

const POWER_SHELL_ENGINES = (process.platform === 'win32' ? ['pwsh.exe', 'powershell.exe'] : ['pwsh'])
  .filter((engine) => spawnSync(engine, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.Major'], {
    encoding: 'utf8', windowsHide: true,
  }).status === 0);

const GATE_FIXTURES = Object.freeze({
  'install-graph-conditional-access': ["$moduleName = 'Microsoft.Graph'", "$moduleVersionText = '2.30.0'", "$repositoryName = 'PSGallery'"],
  'device-full-wipe': ["$deviceName = 'DEVICE-FIXTURE'", "$d = [pscustomobject]@{ Id = 'device-id-fixture'; DeviceName = 'DEVICE-FIXTURE' }"],
  'install-exchange-quarantine': ["$moduleName = 'ExchangeOnlineManagement'", "$moduleVersionText = '3.7.0'", "$repositoryName = 'PSGallery'"],
  'quarantine-release-all': ["$messageIdentity = 'message-id-fixture'", "$recipients = @('one@example.com','two@example.com')", "$recipientSetHash = ('a' * 64)"],
  'quarantine-release-one': ["$messageIdentity = 'message-id-fixture'", "$recipient = 'one@example.com'"],
  'quarantine-permanent-delete': ["$messageIdentity = 'message-id-fixture'"],
  'install-exchange-spam': ["$moduleName = 'ExchangeOnlineManagement'", "$moduleVersionText = '3.7.0'", "$repositoryName = 'PSGallery'"],
  'restricted-entity-unblock': [],
  'install-exchange-whitelist': ["$moduleName = 'ExchangeOnlineManagement'", "$moduleVersionText = '3.7.0'", "$repositoryName = 'PSGallery'"],
  'mailbox-permission-remove': [],
  'mfa-session-revoke': ["$sessionUser = [pscustomobject]@{ UserPrincipalName = 'user@example.com'; Id = 'user-id-fixture' }"],
  'password-cloud-reset': ["$user = [pscustomobject]@{ UserPrincipalName = 'user@example.com'; Id = 'user-id-fixture' }"],
  'password-session-revoke': ["$sessionUser = [pscustomobject]@{ UserPrincipalName = 'user@example.com'; Id = 'user-id-fixture' }"],
  'print-queue-delete': ["$queueFileCount = 2", "$queueSetHash = ('b' * 64)"],
  'security-account-block': ["$user = [pscustomobject]@{ UserPrincipalName = 'user@example.com'; Id = 'user-id-fixture' }"],
  'security-synced-ad-disable': ["$adUser = [pscustomobject]@{ UserPrincipalName = 'user@example.com'; ObjectGuid = 'ad-guid-fixture' }"],
  'security-synced-cloud-gap-block': ["$cloudUser = [pscustomobject]@{ UserPrincipalName = 'user@example.com'; Id = 'user-id-fixture' }"],
  'security-session-revoke': ["$sessionUser = [pscustomobject]@{ UserPrincipalName = 'user@example.com'; Id = 'user-id-fixture' }"],
  'sharepoint-access-revoke': [],
  'install-teams-module': ["$moduleName = 'MicrosoftTeams'", "$moduleVersionText = '6.8.0'", "$repositoryName = 'PSGallery'"],
  'automation-bulk-license-checkpoint-write': ["$checkpointId = 'checkpoint-fixture'", '$expectedCount = 2', "$resolvedUserSetHash = ('c' * 64)"],
  'automation-bulk-license': ["$licenseSkuId = 'sku-id-fixture'", '$expectedCount = 2', "$resolvedUserSetHash = ('c' * 64)", "$checkpointId = 'checkpoint-fixture'", "$checkpointContentHash = ('1' * 64)"],
  'automation-token-revoke': ["$sessionUser = [pscustomobject]@{ UserPrincipalName = 'user@example.com'; Id = 'user-id-fixture' }"],
  'automation-compliance-checkpoint-write': ["$checkpointId = 'checkpoint-fixture'", "$policy = [pscustomobject]@{ Id = 'policy-id-fixture' }", "$group = [pscustomobject]@{ Id = 'group-id-fixture'; DisplayName = 'GROUP-FIXTURE' }", "$preAssignmentSetHash = ('d' * 64)"],
  'automation-compliance-assignment': ["$policy = [pscustomobject]@{ Id = 'policy-id-fixture' }", "$group = [pscustomobject]@{ Id = 'group-id-fixture'; DisplayName = 'GROUP-FIXTURE' }", "$preAssignmentSetHash = ('d' * 64)", "$checkpointId = 'checkpoint-fixture'", "$checkpointContentHash = ('1' * 64)", "$resultRecordId = 'result-fixture'"],
  'rollback-license-checkpoint-write': ["$checkpointId = 'checkpoint-fixture'", "$resolvedUser = [pscustomobject]@{ UserPrincipalName = 'user@example.com'; Id = 'user-id-fixture' }"],
  'rollback-group-checkpoint-write': ["$checkpointId = 'checkpoint-fixture'"],
  'rollback-group-change': ["$checkpointId = 'checkpoint-fixture'"],
  'rollback-bulk-usage-checkpoint-write': ["$checkpointId = 'checkpoint-fixture'", '$expectedCount = 2', "$usageTargetSetHash = ('e' * 64)"],
  'rollback-bulk-usage-location': ['$expectedCount = 2', "$usageTargetSetHash = ('e' * 64)", "$checkpointId = 'checkpoint-fixture'"],
  'rollback-policy-checkpoint-write': ["$checkpointId = 'checkpoint-fixture'"],
  'safety-whatif-disable': [],
  'safety-bulk-disable-checkpoint-write': ["$checkpointId = 'checkpoint-fixture'", '$expectedCount = 2', "$disableTargetSetHash = ('f' * 64)"],
  'safety-bulk-disable': ['$expectedCount = 2', "$disableTargetSetHash = ('f' * 64)", "$checkpointId = 'checkpoint-fixture'"],
  'safety-group-checkpoint-write': ["$checkpointId = 'checkpoint-fixture'"],
  'safety-delete-user-checkpoint-write': ["$checkpointId = 'checkpoint-fixture'", "$targetUser = [pscustomobject]@{ UserPrincipalName = 'user@example.com'; Id = 'user-id-fixture' }", "$checkpointContentHash = ('1' * 64)"],
  'safety-delete-user': ["$targetUpn = 'user@example.com'", "$targetUser = [pscustomobject]@{ UserPrincipalName = 'user@example.com'; Id = 'user-id-fixture' }", "$checkpointId = 'checkpoint-fixture'", "$checkpointContentHash = ('1' * 64)"],
});

function runPowerShell(engine, script, context, timeout = 20000) {
  const wrapper = "$encoded = [Console]::In.ReadToEnd(); $source = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded)); & ([ScriptBlock]::Create($source))";
  const result = spawnSync(engine, ['-NoProfile', '-NonInteractive', '-Command', wrapper], {
    input: Buffer.from(script, 'utf8').toString('base64'), encoding: 'utf8', windowsHide: true, timeout,
  });
  const detail = result.error ? result.error.message : String(result.stderr || result.stdout || '').trim();
  assert.equal(result.status, 0, `${context}: ${engine} failed: ${detail}`);
  return result.stdout.trim();
}

function analyzePowerShellGate(fence, marker, regionEndLine, owned, context) {
  assert.ok(POWER_SHELL_ENGINES.length > 0, `${context}: PowerShell is required for AST validation`);
  const payload = {
    source: fence.lines.join('\n'),
    markerLine: marker.line - fence.startLine + 1,
    endLine: regionEndLine - fence.startLine + 1,
    sinks: owned.map((hit) => ({ line: hit.line - fence.startLine + 1, command: hit.command })),
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const script = String.raw`
$ErrorActionPreference = 'Stop'
$payloadJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payloadBase64}'))
$payload = $payloadJson | ConvertFrom-Json
$tokens = $null
$parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput([string]$payload.source, [ref]$tokens, [ref]$parseErrors)
$problems = [System.Collections.Generic.List[string]]::new()
foreach ($parseError in @($parseErrors)) { $problems.Add("parse error: $($parseError.Message)") }
function In-Region($node) { $node.Extent.StartLineNumber -ge [int]$payload.markerLine -and $node.Extent.StartLineNumber -le [int]$payload.endLine }
function Variable-Name($assignment) {
    $left = $assignment.Left.Extent.Text.Trim()
    if ($left -match '^\$([A-Za-z][A-Za-z0-9]*)$') { return $Matches[1] }
    return $null
}
function Has-Ancestor($node, $candidate) {
    $parent = $node.Parent
    while ($null -ne $parent) {
        if ([object]::ReferenceEquals($parent, $candidate)) { return $true }
        $parent = $parent.Parent
    }
    return $false
}
$allAssignments = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.AssignmentStatementAst] }, $true) | Where-Object { In-Region $_ })
$requiredAssignments = @($allAssignments | Where-Object { (Variable-Name $_) -ceq 'requiredConfirmation' })
$confirmationAssignments = @($allAssignments | Where-Object { (Variable-Name $_) -ceq 'confirmation' })
if ($requiredAssignments.Count -ne 1) { $problems.Add('requiredConfirmation must have exactly one direct assignment in the owned region') }
if ($confirmationAssignments.Count -ne 1) { $problems.Add('confirmation must have exactly one direct assignment in the owned region') }
$requiredText = if ($requiredAssignments.Count -eq 1) { $requiredAssignments[0].Extent.Text.Trim() } else { '' }
$confirmationText = if ($confirmationAssignments.Count -eq 1) { $confirmationAssignments[0].Extent.Text.Trim() } else { '' }
$expectedTemplate = ''
if ($requiredText -notmatch '^\$requiredConfirmation\s*=\s*"([^"\r\n]+)"$') { $problems.Add('requiredConfirmation must be one explicit double-quoted template') } else { $expectedTemplate = $Matches[1] }
if ($confirmationText -notmatch '^\$confirmation\s*=\s*Read-Host(?:\s+"[^"\r\n]*")?$') { $problems.Add('confirmation must be one direct Read-Host assignment with no pipeline or suffix') }
$regionLines = ([string]$payload.source -split [char]10)
$regionText = ($regionLines[([int]$payload.markerLine - 1)..([int]$payload.endLine - 1)] -join [char]10)
$fenceText = [string]$payload.source
if ($fenceText -match '(?im)^\s*(?:Set-Variable\b[^\r\n]*(?:confirmation|requiredConfirmation)|function\s+Read-Host\b|(?:Set|New)-Alias\b[^\r\n]*Read-Host)' -or $regionText -match '(?i)\$\{(?:confirmation|requiredConfirmation)\}') { $problems.Add('gate variables or Read-Host are overridden indirectly') }
$traps = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.TrapStatementAst] }, $true))
if ($traps.Count -ne 0) { $problems.Add('trap is forbidden anywhere in the owning fence') }
$gateIfs = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.IfStatementAst] }, $true) | Where-Object {
    (In-Region $_) -and $_.Clauses.Count -eq 1 -and (($_.Clauses[0].Item1.Extent.Text -replace '\s','').Trim('(',')') -ceq '$confirmation-ceq$requiredConfirmation')
})
if ($gateIfs.Count -ne 1) { $problems.Add('owned region must contain exactly one positive case-sensitive confirmation branch') }
$gateIf = if ($gateIfs.Count -eq 1) { $gateIfs[0] } else { $null }
$conditionText = ''
$elseThrowText = ''
if ($null -ne $gateIf) {
    $conditionText = $gateIf.Clauses[0].Item1.Extent.Text
    $trueBlock = $gateIf.Clauses[0].Item2
    $elseBlock = $gateIf.ElseClause
    if ($null -eq $elseBlock) { $problems.Add('positive confirmation branch requires a direct else throw') }
    else {
        $directThrows = @($elseBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.ThrowStatementAst] })
        if ($elseBlock.Statements.Count -ne 1 -or $directThrows.Count -ne 1) { $problems.Add('else branch must contain exactly one direct throw') }
        else { $elseThrowText = $directThrows[0].Extent.Text }
    }
    if ($requiredAssignments.Count -eq 1 -and -not [object]::ReferenceEquals($requiredAssignments[0].Parent, $gateIf.Parent)) { $problems.Add('requiredConfirmation assignment and gate must share one statement block') }
    if ($confirmationAssignments.Count -eq 1 -and -not [object]::ReferenceEquals($confirmationAssignments[0].Parent, $gateIf.Parent)) { $problems.Add('Read-Host assignment and gate must share one statement block') }
    $ancestor = $gateIf.Parent
    while ($null -ne $ancestor) {
        if ($ancestor -is [Management.Automation.Language.IfStatementAst]) {
            foreach ($clause in $ancestor.Clauses) {
                if ((($clause.Item1.Extent.Text -replace '\s','').Trim('(',')')) -ceq '$false') { $problems.Add('gate is nested in a constant-false branch') }
            }
        }
        $ancestor = $ancestor.Parent
    }
    foreach ($sink in @($payload.sinks)) {
        $syntheticPattern = switch ([string]$sink.command) {
            'dotnet-file-create' { '(?i)\[IO\.FileStream\]::new\([^\r\n]*\[IO\.FileMode\]::CreateNew' }
            'dotnet-file-write' { '(?i)\$checkpointStream\.Write\s*\(' }
            'dotnet-file-flush' { '(?i)\$checkpointStream\.Flush\s*\(\s*\$true\s*\)' }
            'dotnet-file-move' { '(?i)\[IO\.File\]::Move\s*\(' }
            'dotnet-file-delete' { '(?i)\[IO\.File\]::Delete\s*\(' }
            default { $null }
        }
        if ($null -ne $syntheticPattern) {
            $matches = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.InvokeMemberExpressionAst] }, $true) | Where-Object {
                $_.Extent.StartLineNumber -eq [int]$sink.line -and $_.Extent.Text -match $syntheticPattern
            })
        } else {
            $matches = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.CommandAst] }, $true) | Where-Object {
                if ($_.Extent.StartLineNumber -ne [int]$sink.line) { return $false }
                return $_.GetCommandName() -ceq [string]$sink.command
            })
        }
        if ($matches.Count -ne 1) { $problems.Add("sink $($sink.command) at line $($sink.line) did not map to exactly one CommandAst") }
        elseif (-not (Has-Ancestor $matches[0] $trueBlock)) { $problems.Add("sink $($sink.command) at line $($sink.line) is not dominated by the positive confirmation branch") }
    }
}
[pscustomobject]@{
    Problems = @($problems)
    RequiredText = $requiredText
    ConfirmationText = $confirmationText
    ExpectedTemplate = $expectedTemplate
    ConditionText = $conditionText
    ElseThrowText = $elseThrowText
} | ConvertTo-Json -Depth 5 -Compress
`;
  const output = runPowerShell(POWER_SHELL_ENGINES[0], script, `${context} AST analysis`);
  const analysis = JSON.parse(output);
  assert.deepEqual(analysis.Problems || [], [], `${context}: ${JSON.stringify(analysis.Problems)}`);
  return analysis;
}

function executeSourceGateHarness(analysis, context, engine) {
  const fixtures = GATE_FIXTURES[context];
  assert.ok(fixtures, `${context}: missing explicit runtime fixture`);
  const script = [
    "$ErrorActionPreference = 'Stop'",
    'function Invoke-AuthoredGate {',
    '  param([AllowNull()][object]$Submitted, [bool]$UseExpected)',
    ...fixtures.map((line) => `  ${line}`),
    '  $script:SubmittedGateValue = $Submitted',
    '  $script:UseExpectedGateValue = $UseExpected',
    '  $script:ReadHostCalls = 0',
    '  $script:MockedSinkReached = $false',
    '  function Read-Host {',
    '    param([Parameter(ValueFromRemainingArguments = $true)]$Ignored)',
    '    $script:ReadHostCalls += 1',
    "    if ($script:UseExpectedGateValue) { return [string](Get-Variable -Name requiredConfirmation -Scope 1 -ValueOnly -ErrorAction Stop) }",
    '    return $script:SubmittedGateValue',
    '  }',
    `  ${analysis.RequiredText}`,
    `  ${analysis.ConfirmationText}`,
    `  if (${analysis.ConditionText}) { $script:MockedSinkReached = $true } else { ${analysis.ElseThrowText} }`,
    '  [pscustomobject]@{ Expected = $requiredConfirmation; Reached = $script:MockedSinkReached; ReadHostCalls = $script:ReadHostCalls }',
    '}',
    '$approved = Invoke-AuthoredGate -Submitted $null -UseExpected $true',
    "if (-not $approved.Reached -or $approved.ReadHostCalls -ne 1) { throw 'Exact input did not traverse the authored gate exactly once.' }",
    '$expected = [string]$approved.Expected',
    "if ([string]::IsNullOrWhiteSpace($expected)) { throw 'Expanded confirmation was empty.' }",
    "$rejected = @($null, '', 'yes', 'YES', 'arbitrary wrong value', (' ' + $expected), ($expected + ' '), $expected.ToLowerInvariant())",
    'foreach ($submitted in $rejected) {',
    '  if ($submitted -ceq $expected) { continue }',
    '  $script:MockedSinkReached = $false',
    '  $script:ReadHostCalls = 0',
    '  try { $null = Invoke-AuthoredGate -Submitted $submitted -UseExpected $false } catch {}',
    "  if ($script:MockedSinkReached -or $script:ReadHostCalls -ne 1) { throw 'Rejected input bypassed the authored gate or skipped/duplicated Read-Host.' }",
    '}',
    `Write-Output 'SOURCE_GATE_HARNESS_OK ${context}'`,
  ].join('\n');
  const output = runPowerShell(engine, script, `${context} runtime harness`);
  assert.match(output, new RegExp(`SOURCE_GATE_HARNESS_OK ${context.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
}

// ── Shell gate analyzer (G1) — plain-text grammar, no pwsh ────────────────────
// The shell form of an action-local gate, in an explicitly tagged bash/sh/shell/
// zsh fence, is fixed and auditable:
//
//   # SAFETY GATE [id]
//   # Target: …  # Effect: …  # Scope: …  # Reversibility: …
//   # Required confirmation: type exactly `PHRASE`
//   # Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.
//   required_confirmation="PHRASE"
//   IFS= read -r confirmation
//   if [ "$confirmation" = "$required_confirmation" ]; then
//     <owned sinks only>
//   else
//     echo "…" >&2          (optional, stderr only)
//     exit <non-zero>
//   fi
//
// `IFS=` keeps leading/trailing whitespace so a padded phrase never matches;
// `=` inside `[ ]` is an exact, case-sensitive string compare. The analyzer
// rejects anything that could overwrite, shadow, fold, or route around that
// comparison, and the harness proves the exact phrase reaches the mocked sink
// once while every rejected input stops with a non-zero exit.
const SHELL_GATE_FIELDS = ['Target', 'Effect', 'Scope', 'Reversibility', 'Required confirmation', 'Failure behavior'];
// Shell gate text is written to stay inert in a shell that does not treat `#` as a
// comment (stock interactive zsh without interactive_comments): no backticks, `$`,
// `;`, `|`, `&`, `<`, `>`, parentheses, backslash, apostrophe or `!` in a gated
// fence's comments, so the phrase is double-quoted and the failure sentence has none.
const SHELL_FAILURE_BEHAVIOR = 'Empty, declined, "yes", or any other response means stop, and no change is made.';
const SHELL_REQUIRED_LINE = /^\s*required_confirmation="([^"$`\\]+)"\s*$/;
// The read sits inside the comparison's condition, so the shell parses the whole
// if … fi before reading: a line-by-line paste (or a script fed on stdin) can never
// hand the next pasted line to `read` and then run the sink outside the gate.
const SHELL_GATE_IF_LINE = /^\s*if IFS= read -r confirmation && \[ "\$confirmation" = "\$required_confirmation" \]; then\s*$/;
const SHELL_GATE_IF_CANONICAL = 'if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then';
const SHELL_COMMENT_UNSAFE = /[`$;|&<>()\\'!]/;
const SHELL_ELSE_NOTICE_LINE = /^\s*(?:echo|printf)\s[^;&|`$()<>]*>&2\s*$/;
// 1–255 only: bash takes an exit status modulo 256, so `exit 256` succeeds.
const SHELL_ELSE_EXIT_LINE = /^\s*exit (?:[1-9][0-9]?|1[0-9]{2}|2[0-4][0-9]|25[0-5])\s*$/;
// The only statement allowed between the template and the comparison: a plain
// prompt that may show the template.
const SHELL_PROMPT_LINE = /^\s*(?:printf '%s\\n'|echo) "(?:[^"$`\\]|\$required_confirmation\b)*"(?:\s*>&2)?\s*$/;
// Statements that can shadow `read`, `[` or the shell for every later gate pasted into
// the same shell. They are judged in any command position the detector knows (line
// start, after ; & | ( ) { } ! = :, a backtick, $(, do/then/else/elif/if/while/until)
// and behind any wrapper (command, env, time, nohup, sudo, …) or a leading backslash —
// `{ alias '['=true; }` and `if :; then alias …; fi` are as live as a bare `alias`.
// Shell command positions only (a case label's `)` included; `=` and `:` are not
// command starts in a shell).
const SHELL_COMMAND_POSITION = String.raw`(?:${SHELL_PROMPT}|^|[;&|(){}\x60]|\$\(|\b(?:do|then|else|elif|if|while|until)(?=\s)|!(?=\s))\s*${CLI_WRAPPER}\\?`;
// Quoting does not change the word bash runs: `'alias'`, `"alias"`, `$"alias"`
// (locale), `$'\x61lias'` / `$'\141lias'` / `$'\u0061lias'` (ANSI-C escapes), `al\ias`
// and `r''eadonly` all run the builtin, and a brace expansion runs its first
// alternative as the command (`a{lias,}`, `re{adonly,}`). Every gate rule is also
// tried on a copy with ANSI-C escapes decoded, quotes and backslashes removed, and
// brace expansions reduced to their first alternative. A word produced by any other
// expansion (a variable, a substitution) in command position is an indirect-execution
// sink of its own.
const decodeAnsiC = (body) => body.replace(/\\(x[0-9A-Fa-f]{1,2}|u[0-9A-Fa-f]{1,4}|U[0-9A-Fa-f]{1,8}|[0-7]{1,3}|[\s\S])/g, (match, escape) => {
  if (/^[xuU]/.test(escape)) return String.fromCodePoint(parseInt(escape.slice(1), 16));
  if (/^[0-7]/.test(escape)) return String.fromCharCode(parseInt(escape, 8));
  return escape;
});
const unquotedShellWords = (statement) => statement
  .replace(/\$'((?:[^'\\]|\\[\s\S])*)'/g, (match, body) => decodeAnsiC(body))
  .replace(/\$"/g, '"')
  .replace(/["'\\]/g, '');
const firstBraceAlternative = (statement) => statement
  .replace(/(^|[^$])\{([^{}\s,]*)(?:,[^{}\s]*)+\}/g, '$1$2')
  .replace(/(^|[^$])\{(-?\w+)\.\.-?\w+(?:\.\.-?\d+)?\}/g, '$1$2');
const shellReadings = (statement) => {
  const unquoted = unquotedShellWords(statement);
  return [...new Set([statement, unquoted, firstBraceAlternative(unquoted)])];
};
const shadows = ([pattern], statement) => shellReadings(statement).some((reading) => pattern.test(reading));
const SHELL_SHADOWING = [
  [new RegExp(String.raw`${SHELL_COMMAND_POSITION}(?:alias|unalias|eval|trap|declare|typeset|readonly|unset|exec|source|builtin|enable|shopt|setopt)\b`), 'alias, eval, trap, declare, unset, exec, source, builtin or shell options are forbidden in a gated fence'],
  [new RegExp(String.raw`${SHELL_COMMAND_POSITION}\.\s+\S`), 'dot-sourcing is forbidden in a gated fence'],
  // any function name, including `[` (`[ () { return 0; }` shadows the test builtin)
  [new RegExp(String.raw`${SHELL_COMMAND_POSITION}(?:function\s+[^\s;&|()]+|[^\s;&|(){}]+\s*\(\s*\))\s*(?:\{|\(|$)`), 'function definitions are forbidden in a gated fence (they can shadow read/[ or hide sinks)'],
  [new RegExp(String.raw`(?:^|[;&|(){}\s])(?:export\s+)?(?:PROMPT_COMMAND|PS0|precmd_functions|preexec_functions)\+?=|${SHELL_COMMAND_POSITION}(?:bind|bindkey|zle|disable)\b`), 'prompt hooks, key bindings and builtin switches are forbidden'],
];
const SHELL_FORBIDDEN = [
  ...SHELL_SHADOWING,
  [/\$\{\s*(?:required_)?confirmation\b/, 'parameter expansion of a gate variable is forbidden (it can fold case or substitute values)'],
  [/(?:^|[;&|\s(])(?:export\s+|local\s+)?confirmation\+?=/, 'confirmation may only be assigned by the single IFS= read -r line'],
  // Other ways to assign a variable (WARDEN review): printf -v, mapfile/readarray,
  // getopts, let, coproc, wait -p, loop variables, array elements, indirect expansion.
  [/(?:^|[;&|(\s])(?:printf\s+-v|mapfile|readarray|getopts|let|coproc)\b/, 'printf -v, mapfile, readarray, getopts, let and coproc are forbidden in a gated fence (they assign variables)'],
  [/(?:^|[;&|(\s])wait\s+-p\b/, 'wait -p is forbidden in a gated fence (it assigns a variable)'],
  [/(?:^|[;&|(\s])(?:for|select|while|until)\s+(?:required_)?confirmation\b/, 'a gate variable may not be a loop variable'],
  [/\b(?:required_)?confirmation\s*\[/, 'a gate variable may not be indexed or assigned as an array'],
  [/\$\{!/, 'indirect parameter expansion is forbidden in a gated fence'],
];

function shellCodeOf(line) {
  return /^\s*#/.test(line) ? '' : stripExecutableComment(line, true).trim();
}

function shellBlockDelta(code) {
  let delta = 0;
  for (const raw of code.split(/;;|;|&&|\|\|/)) {
    const segment = raw.trim();
    if (!segment) continue;
    const word = segment.split(/\s+/)[0];
    if (/^(?:if|case|for|while|until|select)$/.test(word)) delta += 1;
    else if (/^(?:fi|esac|done)$/.test(word)) delta -= 1;
    else if (word === '{' || (/^\((?!\()/.test(segment))) delta += 1;
    else if (word === '}' || segment === ')') delta -= 1;
  }
  return delta;
}

function analyzeShellGate(fence, marker, regionEndLine, owned) {
  const problems = [];
  const lines = fence.lines;
  const markerIndex = marker.line - fence.startLine;
  const endIndex = regionEndLine - fence.startLine;
  const code = lines.map(shellCodeOf);
  const inRegion = (index) => index > markerIndex && index <= endIndex;

  const fields = {};
  for (let index = markerIndex + 1; index <= endIndex; index += 1) {
    const field = lines[index].match(/^\s*#\s*(Target|Effect|Scope|Reversibility|Required confirmation|Failure behavior):\s*(.+?)\s*$/);
    if (!field) continue;
    if (fields[field[1]] !== undefined) problems.push(`duplicate ${field[1]} field`);
    fields[field[1]] = field[2];
  }
  for (const name of SHELL_GATE_FIELDS) if (!fields[name]) problems.push(`missing ${name} field`);
  const expected = (fields['Required confirmation'] || '').match(/type exactly "([^"]+)"/i)?.[1] || '';
  if (fields['Required confirmation'] && !expected) problems.push('Required confirmation must say: type exactly "PHRASE"');

  // Comments must stay inert where `#` is not a comment, and no executable line may
  // carry a trailing comment (it would become arguments, or an env-prefixed command).
  lines.forEach((rawLine, index) => {
    if (/^\s*#/.test(rawLine)) {
      const text = rawLine.replace(/^\s*#/, '');
      if (SHELL_COMMENT_UNSAFE.test(text) || (text.match(/"/g) || []).length % 2) {
        problems.push(`line ${index + 1}: a comment in a gated fence may not contain backticks, $, ;, |, &, <, >, parentheses, a backslash, an apostrophe, ! or an unbalanced double quote`);
      }
    } else if (code[index] && code[index] !== rawLine.trim()) {
      problems.push(`line ${index + 1}: no executable line in a gated fence may carry a trailing comment (put it on its own line above)`);
    }
  });
  if (fields['Failure behavior'] && fields['Failure behavior'] !== SHELL_FAILURE_BEHAVIOR) problems.push(`Failure behavior must read exactly: ${SHELL_FAILURE_BEHAVIOR}`);

  code.forEach((statement, index) => {
    if (!statement) return;
    for (const row of SHELL_FORBIDDEN) {
      if (shadows(row, statement)) problems.push(`line ${index + 1}: ${row[1]}`);
    }
  });

  const requiredAssignments = code.map((statement, index) => ({ statement, index }))
    .filter(({ statement }) => /(?:^|[;&|\s(])(?:export\s+|local\s+)?required_confirmation\+?=/.test(statement));
  const reads = code.map((statement, index) => ({ statement, index })).filter(({ statement }) => /(?:^|[;&|(\s])read\b/.test(statement));
  const gateIfs = code.map((statement, index) => ({ statement, index })).filter(({ statement }) => /\$confirmation\b|\$required_confirmation\b/.test(statement) && /(?:^|[;&|\s])(?:if|elif|while|until|\[\[?|test)\b/.test(statement));

  let requiredLiteral = '';
  if (requiredAssignments.length !== 1 || !inRegion(requiredAssignments[0].index)) problems.push('required_confirmation must have exactly one assignment, inside the gate region');
  else {
    const literal = code[requiredAssignments[0].index].match(SHELL_REQUIRED_LINE);
    if (!literal) problems.push('required_confirmation must be one double-quoted literal with no expansion ($, backtick, backslash)');
    else requiredLiteral = literal[1];
  }
  if (requiredLiteral && expected && requiredLiteral !== expected) problems.push(`required_confirmation literal does not equal the Required confirmation phrase (${requiredLiteral} ≠ ${expected})`);
  if (gateIfs.length !== 1 || !inRegion(gateIfs[0].index) || !SHELL_GATE_IF_LINE.test(code[gateIfs[0].index])) problems.push(`the region must contain exactly one comparison, the canonical \`${SHELL_GATE_IF_CANONICAL}\``);
  if (reads.length !== 1 || gateIfs.length !== 1 || reads[0].index !== gateIfs[0].index) problems.push('the fence must contain exactly one read, inside the canonical comparison');

  const gateIndex = gateIfs.length === 1 && SHELL_GATE_IF_LINE.test(code[gateIfs[0].index]) ? gateIfs[0].index : -1;
  // Between the marker and the template only the comment header may sit; between the
  // template and the comparison only plain prompt lines. Any other statement could
  // pre-satisfy or rewrite the comparison. The harness executes the fence's own lines
  // from its first line up to the comparison.
  const requiredIndex = requiredAssignments.length === 1 ? requiredAssignments[0].index : -1;
  const preCompareLines = [];
  for (let index = 0; index < markerIndex; index += 1) {
    if (code[index]) problems.push(`line ${index + 1}: only comments may precede the SAFETY GATE marker in a gated fence`);
  }
  if (requiredIndex > markerIndex) {
    for (let index = markerIndex + 1; index < requiredIndex; index += 1) {
      if (code[index]) problems.push(`line ${index + 1}: only the comment header may sit between the SAFETY GATE marker and required_confirmation`);
    }
  }
  if (requiredIndex >= 0 && gateIndex > requiredIndex) {
    for (let index = 0; index < gateIndex; index += 1) preCompareLines.push(lines[index]);
    for (let index = requiredIndex + 1; index < gateIndex; index += 1) {
      if (!code[index]) continue;
      if (!SHELL_PROMPT_LINE.test(code[index])) {
        problems.push(`line ${index + 1}: between required_confirmation and the comparison only a plain printf/echo prompt may appear`);
      }
    }
  }
  let elseIndex = -1;
  let fiIndex = -1;
  const elseBody = [];
  if (gateIndex >= 0) {
    if (requiredAssignments.length === 1 && !(requiredAssignments[0].index < gateIndex)) {
      problems.push('order must be: required_confirmation assignment, then the comparison');
    }
    let depth = 0;
    for (let index = 0; index < gateIndex; index += 1) depth += shellBlockDelta(code[index]);
    if (depth !== 0) problems.push('the gate comparison is nested inside another block (dead or conditional guard)');
    depth = 0;
    for (let index = gateIndex + 1; index < lines.length; index += 1) {
      const statement = code[index];
      if (!statement) continue;
      if (depth === 0 && /^(?:elif)\b/.test(statement)) problems.push('elif branches are forbidden in a gate');
      if (depth === 0 && statement === 'else') { if (elseIndex < 0) elseIndex = index; else problems.push('more than one else'); continue; }
      depth += shellBlockDelta(statement);
      if (depth < 0) { fiIndex = index; break; }
    }
    if (elseIndex < 0) problems.push('the comparison needs a direct else branch');
    if (fiIndex < 0) problems.push('the comparison is never closed with fi');
    if (fiIndex >= 0 && code[fiIndex] !== 'fi') problems.push('the gate must close with a bare fi');
    if (fiIndex >= 0 && fiIndex > endIndex) problems.push('the gate block extends past the gate region');
    if (elseIndex >= 0 && fiIndex > elseIndex) {
      const statements = [];
      for (let index = elseIndex + 1; index < fiIndex; index += 1) if (code[index]) { statements.push(code[index]); elseBody.push(code[index]); }
      const exits = statements.filter((statement) => SHELL_ELSE_EXIT_LINE.test(statement));
      if (exits.length !== 1 || !SHELL_ELSE_EXIT_LINE.test(statements.at(-1) || '')) problems.push('the else branch must end with exactly one `exit <non-zero>`');
      if (statements.some((statement) => !SHELL_ELSE_EXIT_LINE.test(statement) && !SHELL_ELSE_NOTICE_LINE.test(statement))) {
        problems.push('the else branch may only print a notice to stderr and exit non-zero');
      }
    }
  }
  for (const sink of owned) {
    const index = sink.line - fence.startLine;
    if (!(gateIndex >= 0 && elseIndex > gateIndex && index > gateIndex && index < elseIndex)) {
      problems.push(`sink ${sink.command} at line ${sink.line} is not dominated by the positive confirmation branch`);
    }
  }
  return { problems: [...new Set(problems)], fields, expected, requiredLiteral, elseBody, preCompareLines };
}

const SHELL_ENGINES = ['bash'].filter((engine) => {
  const probe = spawnSync(engine, ['-c', 'printf ok'], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  return probe.status === 0 && probe.stdout === 'ok';
});

function assertShellGateFailClosed(analysis, context) {
  assert.deepEqual(analysis.problems, [], `${context}: ${analysis.problems.join(' | ')}`);
  const expected = analysis.expected;
  assert.ok(expected && expected === analysis.requiredLiteral, `${context}: source literal and Required confirmation phrase differ`);
  // Plain-text model of the canonical comparison: exact string equality.
  for (const rejected of [undefined, '', 'yes', 'YES', 'arbitrary wrong value', ` ${expected}`, `${expected} `, expected.toLowerCase(), `${expected}\\`]) {
    if (rejected !== expected) assert.equal(exactGateModel(expected, rejected), false);
  }
  assert.equal(exactGateModel(expected, expected), true);
  // Real execution where a POSIX shell exists (always on Linux/macOS CI).
  if (process.platform !== 'win32') assert.ok(SHELL_ENGINES.length > 0, `${context}: bash is required to execute the shell gate harness`);
  // The fence's own lines from its first line up to the comparison run verbatim; the
  // positive branch is replaced by one mocked line, the else body is the fence's own.
  // Nothing that reaches a sink is ever executed. Three ways an operator may run it:
  // as a script (normal), pasted into a shell that does not treat `#` as a comment
  // (literal: every comment line's `#` becomes a plain word, as in stock interactive
  // zsh), and pasted line by line or fed on stdin (piped: the read shares the input
  // with the script, and a read-back line follows the gate).
  assert.ok(Array.isArray(analysis.preCompareLines) && analysis.preCompareLines.length > 0, `${context}: no source lines to execute`);
  const gateScript = (lines) => [
    ...lines,
    SHELL_GATE_IF_CANONICAL,
    "  printf '%s\\n' MOCKED_SINK_REACHED",
    'else',
    ...analysis.elseBody.map((statement) => `  ${statement}`),
    'fi',
  ].join('\n');
  const normal = gateScript(analysis.preCompareLines);
  const literal = gateScript(analysis.preCompareLines.map((line) => line.replace(/^(\s*)#/, "$1'#'")));
  const rejectedInputs = [undefined, '', 'yes', 'YES', 'arbitrary wrong value', ` ${expected}`, `${expected} `, expected.toLowerCase(), `${expected}\\`];
  for (const engine of SHELL_ENGINES) {
    for (const [mode, script] of [['normal', normal], ['literal-#', literal]]) {
      const run = (input) => spawnSync(engine, ['-c', script], { input, encoding: 'utf8', windowsHide: true, timeout: 10000 });
      const approved = run(`${expected}\n`);
      assert.equal(approved.status, 0, `${context} (${mode}): exact phrase did not traverse the gate (${approved.stderr})`);
      assert.match(approved.stdout, /MOCKED_SINK_REACHED/, `${context} (${mode}): exact phrase did not reach the mocked sink`);
      for (const rejected of rejectedInputs) {
        if (rejected === expected) continue;
        const result = run(rejected === undefined ? '' : `${rejected}\n`);
        assert.notEqual(result.status, 0, `${context} (${mode}): rejected input ${JSON.stringify(rejected)} exited zero`);
        assert.doesNotMatch(result.stdout || '', /MOCKED_SINK_REACHED/, `${context} (${mode}): rejected input ${JSON.stringify(rejected)} reached the sink`);
      }
    }
    for (const script of [normal, literal]) {
      const piped = spawnSync(engine, ['-s'], { input: `${script}\nprintf '%s\\n' READ_BACK_PLACEHOLDER\n`, encoding: 'utf8', windowsHide: true, timeout: 10000 });
      assert.notEqual(piped.status, 0, `${context} (piped): a line-by-line paste must stop at the gate`);
      assert.doesNotMatch(piped.stdout || '', /MOCKED_SINK_REACHED/, `${context} (piped): a pasted line was taken as the confirmation and the sink ran`);
    }
  }
}

test('all Markdown fences are balanced and files end with a newline', () => {
  for (const document of documents.values()) {
    assert.ok(document.source.endsWith('\n'), `${document.file}: missing final newline`);
  }
});

test('every discovered safety/preview marker ID is globally unique', () => {
  const seen = new Map();
  for (const marker of markers) {
    assert.ok(!seen.has(marker.id), `${marker.file}:${marker.line}: duplicate marker ${marker.id}; first at ${seen.get(marker.id)}`);
    seen.set(marker.id, `${marker.file}:${marker.line}`);
  }
});

test('checked-in state-change inventory exactly matches discovery and client boundaries', () => {
  assert.deepEqual(STATE_CHANGE_INVENTORY, currentStateChangeInventory());
  for (const entry of STATE_CHANGE_INVENTORY.examples) {
    assert.ok(STATE_CHANGE_INVENTORY.executionClassification[entry.mode], `${entry.id}: missing execution classification`);
    if (entry.mode === 'gated') assert.ok(entry.impactCategories.length > 0, `${entry.id}: gated example has no impact classification`);
  }
  for (const entry of STATE_CHANGE_INVENTORY.clientBoundaries) {
    assert.ok(entry.impactCategories.length > 0, `${entry.id}: client boundary has no impact classification`);
  }
  const categories = new Set([...STATE_CHANGE_INVENTORY.examples, ...STATE_CHANGE_INVENTORY.clientBoundaries]
    .flatMap((entry) => entry.impactCategories));
  for (const required of [
    'reversible state change', 'destructive', 'security-sensitive', 'credential-related',
    'permission-related', 'identity-related', 'data-removal related', 'external-system mutation',
  ]) assert.ok(categories.has(required), `inventory is missing required impact class: ${required}`);
  assert.match(STATE_CHANGE_INVENTORY.executionClassification.preview, /^Read-only\b/);
});

test('every non-Markdown client boundary retains implementation and adversarial-test evidence', () => {
  const groups = new Set(CLIENT_BOUNDARIES.map((entry) => entry.evidenceGroup));
  assert.deepEqual([...groups].sort(), Object.keys(CLIENT_EVIDENCE).sort());
  for (const [name, evidence] of Object.entries(CLIENT_EVIDENCE)) {
    const source = fs.readFileSync(path.join(ROOT, evidence.sourceFile), 'utf8');
    const testSource = fs.readFileSync(path.join(ROOT, evidence.testFile), 'utf8');
    for (const pattern of evidence.sourcePatterns) assert.match(source, pattern, `${name}: missing implementation evidence ${pattern}`);
    for (const pattern of evidence.testPatterns) assert.match(testSource, pattern, `${name}: missing adversarial-test evidence ${pattern}`);
    for (const boundary of CLIENT_BOUNDARIES.filter((entry) => entry.evidenceGroup === name)) {
      assert.equal(boundary.file, evidence.sourceFile, `${boundary.id}: source evidence mismatch`);
      assert.equal(boundary.testFile, evidence.testFile, `${boundary.id}: test evidence mismatch`);
    }
  }
});

test('every executable mutation has exactly one same-fence owner', () => {
  const failures = [];
  for (const hit of executableHits) {
    const marker = nearestMarker(hit);
    const gateOwners = marker && marker.mode === 'gated' ? [marker] : [];
    const owners = [...gateOwners, ...directR1Owners(hit)];
    if (owners.length !== 1) failures.push(`${hit.file}:${hit.line}: ${hit.command} has ${owners.length} owners (${hit.statement})`);
    if (classifyImpact(hit.command, hit.statement).length === 0) failures.push(`${hit.file}:${hit.line}: mutation is unclassified`);
  }
  assert.deepEqual(failures, []);
});

test('every commented mutation is owned by the nearest PREVIEW ONLY marker', () => {
  const failures = [];
  for (const hit of previewHits) {
    const marker = nearestMarker(hit);
    if (!marker) failures.push(`${hit.file}:${hit.line}: commented ${hit.command} has no local marker`);
    else if (marker.mode !== 'preview') failures.push(`${hit.file}:${hit.line}: commented ${hit.command} is not owned by PREVIEW ONLY`);
    if (classifyImpact(hit.command, hit.statement).length === 0) failures.push(`${hit.file}:${hit.line}: preview is unclassified`);
  }
  assert.deepEqual(failures, []);
});

test('every discovered manual portal mutation has one action-local gate or preview owner', () => {
  const failures = [];
  for (const candidate of portalCandidates) {
    const owner = portalOwner(candidate);
    if (!owner) failures.push(`${candidate.file}:${candidate.line}: unowned manual mutation candidate (${candidate.statement})`);
    else if (owner.mode === 'gated') {
      const region = sourceRegion(documents.get(owner.file), owner.line, nextMarkerLine(owner) - 1);
      const expected = region.match(/Required confirmation:\*\*[^\n]*type exactly `([^`]+)`/i)?.[1] || '';
      const actionPattern = PORTAL_CONFIRMATION_BY_ACTION.get(candidate.actionWord.toLowerCase());
      if (!actionPattern || !actionPattern.test(expected)) {
        failures.push(`${candidate.file}:${candidate.line}: ${candidate.actionWord} does not correspond to gate ${owner.id} (${expected})`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

for (const marker of markers.filter((item) => item.kind === 'powershell' && item.mode === 'gated')) {
  test(`${marker.id}: actual source gate is AST-dominated, explicit, and fail-closed`, () => {
    const document = documents.get(marker.file);
    const fence = document.fences.find((item) => item.id === marker.fenceId);
    const owned = executableHits.filter((hit) => hit.fenceId === marker.fenceId && nearestMarker(hit) === marker);
    assert.ok(owned.length > 0, `${marker.file}:${marker.line}: gate owns no executable mutation`);
    const regionEndLine = nextMarkerLine(marker) - 1;
    const gateSource = sourceRegion(document, marker.line, regionEndLine);
    for (const field of ['Target:', 'Effect:', 'Scope:', 'Reversibility:']) {
      assert.match(gateSource, new RegExp(`# ${field.replace(':', '\\:')}`, 'i'), `${marker.id}: missing ${field}`);
    }
    const analysis = analyzePowerShellGate(fence, marker, regionEndLine, owned, marker.id);
    const expected = analysis.ExpectedTemplate;

    const target = gateSource.match(/^\s*# Target:\s*([^\n]+)/im)?.[1] || '';
    for (const binding of extractTargetBindings(target)) {
      assert.ok(expected.includes(binding), `${marker.id}: exact confirmation does not bind target token ${binding}`);
    }
    const effect = gateSource.match(/^\s*# Effect:\s*([^\n]+)/im)?.[1] || '';
    assertEffectCorrespondence(effect, expected, marker.id);
    for (const engine of POWER_SHELL_ENGINES) executeSourceGateHarness(analysis, marker.id, engine);
  });
}

for (const marker of markers.filter((item) => item.kind !== 'portal' && item.mode === 'preview')) {
  test(`${marker.id}: preview region contains no executable mutation`, () => {
    const end = nextMarkerLine(marker);
    const commented = previewHits.filter((hit) => hit.fenceId === marker.fenceId && hit.line >= marker.line && hit.line < end);
    const live = executableHits.filter((hit) => hit.fenceId === marker.fenceId && hit.line >= marker.line && hit.line < end);
    assert.ok(commented.length > 0, `${marker.file}:${marker.line}: preview marker owns no mutation vocabulary`);
    assert.equal(live.length, 0, `${marker.file}:${marker.line}: preview region contains a live mutation`);
  });
}

for (const marker of markers.filter((item) => item.kind === 'portal' && item.mode === 'gated')) {
  test(`${marker.id}: portal gate is action-local and fail-closed`, () => {
    const document = documents.get(marker.file);
    const region = sourceRegion(document, marker.line, nextMarkerLine(marker) - 1);
    for (const field of ['Target', 'Effect', 'Scope', 'Reversibility', 'Required confirmation', 'Failure behavior']) {
      assert.match(region, new RegExp(`\\*\\*${field}:?\\*\\*`, 'i'), `${marker.id}: missing ${field}`);
    }
    assert.match(region, new RegExp(`\\*\\*PORTAL ACTION \\[${marker.id}\\]:\\*\\*`));
    const expected = region.match(/Required confirmation:\*\*[^\n]*type exactly `([^`]+)`/i)?.[1];
    assert.ok(expected, `${marker.id}: missing exact portal confirmation`);
    assert.match(region, /Empty, declined, `yes`, or any other response means stop; no change is made\./);
    for (const rejected of [undefined, '', 'yes', 'YES', ` ${expected}`, `${expected} `, expected.toLowerCase()]) {
      if (rejected !== expected) assert.equal(exactGateModel(expected, rejected), false);
    }
    assert.equal(exactGateModel(expected, expected), true);
    assert.ok(classifyImpact('portal-action', region).length > 0);

    const target = region.match(/\*\*Target:\*\*\s*([^\n]+)/i)?.[1] || '';
    for (const binding of extractTargetBindings(target)) {
      assert.ok(expected.includes(binding), `${marker.id}: exact confirmation does not bind target token ${binding}`);
    }

    const effect = region.match(/\*\*Effect:\*\*\s*([^\n]+)/i)?.[1] || '';
    assertEffectCorrespondence(effect, expected, marker.id);
  });
}

test('PowerShell AST analyzer rejects bypass-shaped control flow', () => {
  function fixture(source, sinkLine, context) {
    const lines = source.split('\n');
    const fence = { startLine: 1, lines };
    const marker = { line: lines.findIndex((line) => /SAFETY GATE/.test(line)) + 1 };
    const owned = [{ line: sinkLine, command: 'Remove-Item' }];
    return () => analyzePowerShellGate(fence, marker, lines.length, owned, context);
  }
  const valid = [
    '# SAFETY GATE [fixture]', '# Target: [ITEM]', '# Effect: deletes one item', '# Scope: one', '# Reversibility: none',
    '$requiredConfirmation = "DELETE [ITEM]"', '$confirmation = Read-Host "confirm"',
    'if ($confirmation -ceq $requiredConfirmation) {', '  Remove-Item x', '} else {', '  throw "No change."', '}',
  ].join('\n');
  assert.doesNotThrow(fixture(valid, 9, 'valid-fixture'));
  const cases = [
    ['overwrite-fixture', valid.replace('if ($confirmation', '$confirmation = $requiredConfirmation\nif ($confirmation'), 10],
    ['case-insensitive-fixture', valid.replace('-ceq', '-eq'), 9],
    ['sink-after-gate-fixture', valid.replace('  Remove-Item x', '  Write-Host safe').concat('\nRemove-Item x'), 13],
    ['read-host-pipeline-fixture', valid.replace('$confirmation = Read-Host "confirm"', '$confirmation = Read-Host "confirm" | ForEach-Object { $_ }'), 9],
    ['confirmation-expression-fixture', valid.replace('$requiredConfirmation = "DELETE [ITEM]"', '$requiredConfirmation = "DELETE [ITEM]" + $suffix'), 9],
    ['trap-before-fixture', `trap { continue }\n${valid}`, 10],
    ['trap-after-fixture', `${valid}\ntrap { continue }`, 9],
    ['outer-dead-fixture', `if ($false) {\n${valid.split('\n').map((line) => `  ${line}`).join('\n')}\n}`, 10],
    ['set-variable-fixture', valid.replace('if ($confirmation', "Set-Variable -Name confirmation -Value $requiredConfirmation\nif ($confirmation"), 10],
    ['read-host-override-fixture', `function Read-Host { 'DELETE [ITEM]' }\n${valid}`, 10],
  ];
  for (const [context, source, sinkLine] of cases) assert.throws(fixture(source, sinkLine, context), context);
});

test('effect and target assertions reject omitted composite families and bindings', () => {
  assert.throws(() => assertEffectCorrespondence('remove access and write a checkpoint', 'REMOVE ACCESS', 'composite-fixture'));
  assert.deepEqual(extractTargetBindings('[UPN], $userId, and $checkpointId'), ['[UPN]', '$userId', '$checkpointId']);
  const expected = 'REMOVE ACCESS FOR [UPN] ID $userId';
  assert.equal(extractTargetBindings('[UPN], $userId, and $checkpointId').every((binding) => expected.includes(binding)), false);
});

test('WhatIf exemption is command-local and cannot hide a later mutation', () => {
  assert.deepEqual(commandsIn('Remove-First -WhatIf; Remove-Second', 'powershell'), ['Remove-Second']);
  assert.deepEqual(commandsIn('Remove-First -WhatIf; Remove-Second -WhatIf', 'powershell'), []);
  assert.deepEqual(commandsIn('Remove-First -WhatIf:$false', 'powershell'), ['Remove-First']);
});

test('printer cleanup reports immutable completed, failed, and not-attempted sets when removal and restart fail', () => {
  const marker = markers.find((item) => item.id === 'print-queue-delete');
  const gateSource = sourceRegion(documents.get(marker.file), marker.line, nextMarkerLine(marker) - 1);
  const script = String.raw`
$ErrorActionPreference = 'Stop'
$records = @(
  [pscustomobject]@{ Name = 'one.spl'; Length = 1; SHA256 = ('1' * 64) },
  [pscustomobject]@{ Name = 'two.spl'; Length = 2; SHA256 = ('2' * 64) },
  [pscustomobject]@{ Name = 'three.spl'; Length = 3; SHA256 = ('3' * 64) }
)
$queueManifest = [pscustomobject]@{ Records = $records; SHA256 = ('a' * 64) }
$queueFileCount = $records.Count
$queueSetHash = $queueManifest.SHA256
$queuePath = [IO.Path]::Combine([IO.Path]::GetTempPath(), 'fixture', 'PRINTERS')
$script:RemoveCalls = 0
function Read-Host { return [string](Get-Variable -Name requiredConfirmation -Scope 1 -ValueOnly -ErrorAction Stop) }
function Get-LocalPrintQueueManifest { param([string]$LiteralQueuePath) return $queueManifest }
function Stop-Service { [CmdletBinding()] param([string]$Name, [switch]$Force) }
function Get-Service { [CmdletBinding()] param([string]$Name) return [pscustomobject]@{ Status = 'Stopped' } }
function Start-Service { [CmdletBinding()] param([string]$Name) throw 'restart-fixture' }
function Remove-Item {
  [CmdletBinding()] param([string]$LiteralPath, [switch]$Force)
  $script:RemoveCalls += 1
  if ($script:RemoveCalls -eq 2) { throw 'remove-fixture' }
}
function Test-Path {
  [CmdletBinding()] param([string]$LiteralPath, [object]$PathType)
  return [IO.Path]::GetFileName($LiteralPath) -eq 'two.spl'
}
$message = ''
try {
${gateSource}
} catch { $message = $_.Exception.Message }
[pscustomobject]@{ Message = $message; RemoveCalls = $script:RemoveCalls } | ConvertTo-Json -Compress
`;
  const result = JSON.parse(runPowerShell(POWER_SHELL_ENGINES[0], script, 'printer partial-state harness'));
  assert.equal(result.RemoveCalls, 2);
  assert.match(result.Message, /UNKNOWN\/PARTIAL STATE/);
  assert.match(result.Message, /immutable set SHA256 a{64}/);
  assert.match(result.Message, /one\.spl[\s\S]*removal verified by absence read-back/);
  assert.match(result.Message, /two\.spl[\s\S]*FAILED; still present/);
  assert.match(result.Message, /Not-attempted targets: \[three\.spl/i);
  assert.match(result.Message, /LOCAL SERVICE Spooler[\s\S]*restart-fixture/);
});

test('group rollback distinguishes verified recovery, unresolved recovery, and successful forward state', () => {
  const marker = markers.find((item) => item.id === 'rollback-group-change');
  const gateSource = sourceRegion(documents.get(marker.file), marker.line, nextMarkerLine(marker) - 1);
  for (const scenario of ['double-failure', 'verified-rollback', 'success']) {
    const script = String.raw`
$ErrorActionPreference = 'Stop'
$checkpointId = 'checkpoint-fixture'
$scenario = '${scenario}'
$script:GetCalls = 0
$script:RemoveCalls = 0
function Read-Host { return [string](Get-Variable -Name requiredConfirmation -Scope 1 -ValueOnly -ErrorAction Stop) }
function New-MgGroupMember { [CmdletBinding()] param([string]$GroupId, [string]$DirectoryObjectId) }
function Get-MgGroupMember {
  [CmdletBinding()] param([string]$GroupId, [switch]$All)
  $script:GetCalls += 1
  if ($scenario -eq 'success' -and $script:GetCalls -eq 1) { return [pscustomobject]@{ Id = '[USER_ID]' } }
  if ($scenario -eq 'double-failure' -and $script:GetCalls -gt 1) { throw 'rollback-readback-fixture' }
  return @()
}
function Remove-MgGroupMemberByRef {
  [CmdletBinding()] param([string]$GroupId, [string]$DirectoryObjectId)
  $script:RemoveCalls += 1
  if ($scenario -eq 'double-failure') { throw 'rollback-remove-fixture' }
}
$message = ''
try {
${gateSource}
} catch { $message = $_.Exception.Message }
[pscustomobject]@{ Scenario = $scenario; Message = $message; RemoveCalls = $script:RemoveCalls } | ConvertTo-Json -Compress
`;
    const output = runPowerShell(POWER_SHELL_ENGINES[0], script, `group rollback ${scenario} harness`);
    const result = JSON.parse(output.split(/\r?\n/).at(-1));
    if (scenario === 'double-failure') {
      assert.equal(result.RemoveCalls, 1);
      assert.match(result.Message, /UNKNOWN\/PARTIAL STATE/);
      assert.match(result.Message, /USER ID \[USER_ID\][\s\S]*GROUP ID \[GROUP_ID\]/);
      assert.match(result.Message, /rollback-remove-fixture/);
      assert.match(result.Message, /rollback-readback-fixture/);
    } else if (scenario === 'verified-rollback') {
      assert.equal(result.RemoveCalls, 1);
      assert.match(result.Message, /rollback completed/);
      assert.doesNotMatch(result.Message, /UNKNOWN\/PARTIAL STATE/);
    } else {
      assert.equal(result.RemoveCalls, 0);
      assert.equal(result.Message, '');
    }
  }
});

test('checkpointed Graph mutations bind and revalidate the exact checkpoint before the first remote sink', () => {
  for (const specification of [
    {
      id: 'automation-bulk-license',
      sink: 'Set-MgUserLicense',
      confirmation: /USING CHECKPOINT \$checkpointId CONTENT SHA256 \$checkpointContentHash/,
      identity: /CheckpointId[\s\S]*TargetSetSHA256[\s\S]*LicenseSkuId[\s\S]*Users/
    },
    {
      id: 'automation-compliance-assignment',
      sink: 'New-MgDeviceManagementDeviceCompliancePolicyAssignment',
      confirmation: /USING CHECKPOINT \$checkpointId CONTENT SHA256 \$checkpointContentHash/,
      identity: /CheckpointId[\s\S]*PolicyId[\s\S]*GroupId[\s\S]*PreAssignmentSetSHA256/
    }
  ]) {
    const marker = markers.find((item) => item.id === specification.id);
    const region = sourceRegion(documents.get(marker.file), marker.line, nextMarkerLine(marker) - 1);
    const positiveGate = region.indexOf('if ($confirmation -ceq $requiredConfirmation)');
    const read = region.indexOf('[IO.File]::ReadAllBytes($resolvedCheckpoint)');
    const hashCheck = region.indexOf('$approvedCheckpointHash -cne $checkpointContentHash');
    const parse = region.indexOf('ConvertFrom-Json -InputObject ($checkpointEncoding.GetString($approvedCheckpointBytes))');
    const sink = region.indexOf(specification.sink);

    assert.match(region, specification.confirmation, `${specification.id}: confirmation omits checkpoint content hash`);
    assert.ok(positiveGate >= 0 && read > positiveGate && hashCheck > read && parse > hashCheck && sink > parse,
      `${specification.id}: checkpoint read/hash/parse is not inside the positive branch before the remote sink`);
    assert.match(region.slice(read, sink), specification.identity, `${specification.id}: checkpoint immutable identity/scope is not revalidated`);
    assert.match(region.slice(read, sink), /Checkpoint revalidation failed immediately before the Graph mutation\. No (?:license was assigned|assignment was created)\./,
      `${specification.id}: revalidation failure does not stop with an explicit zero-mutation state`);
  }

  const complianceMarker = markers.find((item) => item.id === 'automation-compliance-assignment');
  const compliance = sourceRegion(documents.get(complianceMarker.file), complianceMarker.line, nextMarkerLine(complianceMarker) - 1);
  const receipt = compliance.indexOf('$verifiedCreatedAssignmentId = [string]$createdAssignments[0].Id');
  const resultWrite = compliance.indexOf('$resultRecord = [ordered]@');
  const knownState = compliance.indexOf('Remote state: VERIFIED CHANGED');
  assert.ok(receipt >= 0 && resultWrite > receipt && knownState > resultWrite, 'verified assignment ID is not preserved through result persistence failures');
  assert.match(compliance, /rollback must use that exact assignment ID through a separate reviewed action/);
  assert.match(compliance, /CreatedAssignmentId = \$verifiedCreatedAssignmentId/);
});

test('actual checkpoint revalidation rejects drift or deletion and result failure preserves a proven assignment ID', () => {
  const document = documents.get('modules/automation/powershell/examples.md');
  const specifications = [
    {
      id: 'automation-bulk-license',
      endToken: '\n\n        $currentUsers',
      setup: String.raw`
$checkpointId = 'bulk-checkpoint-fixture'
$resolvedUserSetHash = ('c' * 64)
$licenseSkuId = 'sku-fixture'
$expectedCount = 1
$checkpointObject = [ordered]@{ CheckpointId = $checkpointId; TargetSetSHA256 = $resolvedUserSetHash; LicenseSkuId = $licenseSkuId; Users = @([pscustomobject]@{ Id = 'user-id-fixture'; UserPrincipalName = 'user@example.com' }) }
`
    },
    {
      id: 'automation-compliance-assignment',
      endToken: '\n\n        $currentAssignments',
      setup: String.raw`
$checkpointId = 'compliance-checkpoint-fixture'
$policy = [pscustomobject]@{ Id = 'policy-id-fixture' }
$group = [pscustomobject]@{ Id = 'group-id-fixture'; DisplayName = 'GROUP-FIXTURE' }
$preAssignmentSetHash = ('d' * 64)
$checkpointObject = [ordered]@{ CheckpointId = $checkpointId; PolicyId = $policy.Id; GroupId = $group.Id; PreAssignmentSetSHA256 = $preAssignmentSetHash; PreAssignments = @() }
`
    }
  ];

  for (const specification of specifications) {
    const marker = markers.find((item) => item.id === specification.id);
    const region = sourceRegion(document, marker.line, nextMarkerLine(marker) - 1);
    const start = region.indexOf('        try {\n            $approvedCheckpointBytes');
    const end = region.indexOf(specification.endToken, start);
    assert.ok(start >= 0 && end > start, `${specification.id}: could not extract actual checkpoint revalidation block`);
    const revalidation = region.slice(start, end);

    for (const scenario of ['valid', 'drift', 'deleted']) {
      const script = String.raw`
$ErrorActionPreference = 'Stop'
$scenario = '${scenario}'
$checkpointEncoding = [Text.UTF8Encoding]::new($false, $true)
${specification.setup}
$checkpointBytes = $checkpointEncoding.GetBytes((ConvertTo-Json -InputObject $checkpointObject -Depth 10))
$checkpointContentHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($checkpointBytes)).Replace('-', '').ToLowerInvariant()
$resolvedCheckpoint = Join-Path ([IO.Path]::GetTempPath()) ("aegis-checkpoint-test-$([Guid]::NewGuid().ToString('N')).json")
[IO.File]::WriteAllBytes($resolvedCheckpoint, $checkpointBytes)
if ($scenario -eq 'drift') { [IO.File]::WriteAllText($resolvedCheckpoint, '{}', [Text.UTF8Encoding]::new($false)) }
if ($scenario -eq 'deleted') { [IO.File]::Delete($resolvedCheckpoint) }
$passed = $false
$message = ''
try {
${revalidation}
    $passed = $true
} catch { $message = $_.Exception.Message }
if ([IO.File]::Exists($resolvedCheckpoint)) { [IO.File]::Delete($resolvedCheckpoint) }
[pscustomobject]@{ Scenario = $scenario; Passed = $passed; Message = $message } | ConvertTo-Json -Compress
`;
      const result = JSON.parse(runPowerShell(POWER_SHELL_ENGINES[0], script, `${specification.id} checkpoint ${scenario} harness`).split(/\r?\n/).at(-1));
      if (scenario === 'valid') {
        assert.equal(result.Passed, true, `${specification.id}: valid checkpoint was rejected: ${result.Message}`);
      } else {
        assert.equal(result.Passed, false, `${specification.id}: ${scenario} checkpoint passed revalidation`);
        assert.match(result.Message, /Checkpoint revalidation failed immediately before the Graph mutation/);
      }
    }
  }

  const complianceMarker = markers.find((item) => item.id === 'automation-compliance-assignment');
  const compliance = sourceRegion(document, complianceMarker.line, nextMarkerLine(complianceMarker) - 1);
  const branchStart = compliance.indexOf('            if (-not [string]::IsNullOrWhiteSpace([string]$verifiedCreatedAssignmentId))');
  const genericThrow = compliance.indexOf('            throw "Assignment processing stopped. The policy assignment is UNKNOWN/POSSIBLY CHANGED', branchStart);
  const branchEnd = compliance.indexOf('\n', genericThrow);
  assert.ok(branchStart >= 0 && genericThrow > branchStart && branchEnd > genericThrow, 'could not extract compliance result-failure reporting branch');
  const reportingBranch = compliance.slice(branchStart, branchEnd);
  const reportScript = String.raw`
$verifiedCreatedAssignmentId = 'created-assignment-fixture'
$policy = [pscustomobject]@{ Id = 'policy-id-fixture' }
$group = [pscustomobject]@{ Id = 'group-id-fixture' }
$checkpointId = 'checkpoint-fixture'
$resultRecordPath = 'result-fixture.json'
$message = ''
try {
    try { throw 'result-persistence-fixture' } catch {
${reportingBranch}
    }
} catch { $message = $_.Exception.Message }
[pscustomobject]@{ Message = $message } | ConvertTo-Json -Compress
`;
  const report = JSON.parse(runPowerShell(POWER_SHELL_ENGINES[0], reportScript, 'compliance known-result failure harness').split(/\r?\n/).at(-1));
  assert.match(report.Message, /created-assignment-fixture/);
  assert.match(report.Message, /Remote state: VERIFIED CHANGED/);
  assert.match(report.Message, /rollback must use that exact assignment ID/);
  assert.doesNotMatch(report.Message, /UNKNOWN\/POSSIBLY CHANGED/);
});

test('every PORTAL ACTION maps one-to-one to a discovered portal safety marker', () => {
  const gateKeys = markers.filter((item) => item.kind === 'portal' && item.mode === 'gated').map((item) => `${item.file}#${item.id}`).sort();
  const actionKeys = [];
  for (const document of documents.values()) {
    for (const match of document.source.matchAll(/\*\*PORTAL ACTION \[([a-z0-9-]+)\]:\*\*/gi)) actionKeys.push(`${document.file}#${match[1]}`);
  }
  assert.deepEqual(actionKeys.sort(), gateKeys);
});

test('manual PREVIEW ONLY regions cannot masquerade as gated portal actions', () => {
  for (const marker of markers.filter((item) => item.kind === 'portal' && item.mode === 'preview')) {
    const document = documents.get(marker.file);
    const region = sourceRegion(document, marker.line, nextMarkerLine(marker) - 1);
    assert.doesNotMatch(region, /\*\*PORTAL ACTION \[/i, `${marker.file}:${marker.line}: preview contains an executable portal label`);
    assert.match(region, /planning|preview|not authorized|cannot|does not authorize|must not|do not (?:execute|perform|run|change|submit|apply|install|delete|remove|use)/i,
      `${marker.file}:${marker.line}: preview region does not state a non-executing boundary`);
  }
});

test('direct R1 inventory is exact and remains operator-only', () => {
  const actual = [];
  for (const hit of executableHits.filter((item) => !nearestMarker(item))) {
    const existing = actual.find((entry) => entry.file === hit.file && entry.command === hit.command);
    if (existing) existing.count += 1;
    else actual.push({ file: hit.file, command: hit.command, count: 1 });
  }
  actual.sort((left, right) => `${left.file}\0${left.command}`.localeCompare(`${right.file}\0${right.command}`));
  assert.deepEqual(actual, [...DIRECT_R1_INVENTORY].sort((left, right) => `${left.file}\0${left.command}`.localeCompare(`${right.file}\0${right.command}`)));
  for (const entry of DIRECT_R1_INVENTORY) {
    const matches = executableHits.filter((hit) => hit.file === entry.file && hit.command === entry.command && !nearestMarker(hit));
    assert.equal(matches.length, entry.count, `${entry.file}: unexpected ${entry.command} count`);
    const source = documents.get(entry.file).source;
    assert.match(source, /^disable-model-invocation:\s*true\s*$/m);
    assert.match(source, /Risk level:[^\n]*R1/i);
    assert.match(source, /Invocation:[^\n]*operator-only/i);
  }
});

test('mixed-state commands and aliases remain operator-only with an execution boundary', () => {
  for (const name of MIXED_STATE_COMMANDS) {
    const file = `.claude/commands/${name}.md`;
    const source = documents.get(file)?.source;
    assert.ok(source, `${file}: missing from inventory`);
    assert.match(source, /^---\s*\n[\s\S]*?^disable-model-invocation:\s*true\s*$[\s\S]*?^---\s*$/m, `${file}: missing operator-only frontmatter`);
    assert.match(source, /Execution boundary/i, `${file}: missing execution boundary`);
  }
});

test('reference surfaces state a non-executing boundary', () => {
  for (const file of REFERENCE_BOUNDARIES) {
    const source = documents.get(file)?.source;
    assert.ok(source, `${file}: missing reference surface`);
    assert.match(source, /Execution boundary/i, `${file}: missing execution boundary`);
    assert.match(source, /planning|reference|does not authorize|must not be executed|cannot execute/i, `${file}: boundary is not non-executing`);
  }
});

test('safe read-only diagnostics remain live and available', () => {
  const mailbox = documents.get('.claude/commands/mailbox-permissions.md').source;
  assert.match(mailbox, /^Get-MailboxPermission\b/m);
  assert.match(mailbox, /^Get-RecipientPermission\b/m);
  const mfa = documents.get('.claude/commands/mfa-issue.md').source;
  assert.match(mfa, /^Get-MgUserAuthenticationMethod\b/m);
  const quarantine = documents.get('.claude/commands/email-quarantine.md').source;
  assert.match(quarantine, /^Get-QuarantineMessage\b/m);
});

test('provider lookups escape OData literals and bind mutations to exact returned names and immutable IDs', () => {
  const device = documents.get('.claude/commands/device-wipe.md').source;
  assert.match(device, /\$escapedDeviceName = \$deviceName\.Replace\("'", "''"\)/);
  assert.match(device, /-Filter "deviceName eq '\$escapedDeviceName'"/);
  assert.doesNotMatch(device, /-Filter "deviceName eq '\$deviceName'"/);
  assert.match(device, /\[string\]\$d\.DeviceName -cne \$deviceName/);
  assert.match(device, /FULL WIPE \$\(\$d\.DeviceName\) WITH ID \$\(\$d\.Id\)/);
  assert.match(device, /\$actionReadBack\.Id -cne \[string\]\$d\.Id[\s\S]*\$actionReadBack\.DeviceName -cne \[string\]\$d\.DeviceName/);

  const compliance = documents.get('modules/automation/powershell/examples.md').source;
  const resolutionStart = compliance.indexOf('$escapedGroupName =');
  assert.ok(resolutionStart >= 0, 'compliance example is missing escaped group resolution');
  const groupResolution = compliance.slice(resolutionStart, resolutionStart + 1400);
  assert.match(groupResolution, /\$escapedGroupName = \$groupName\.Replace\("'", "''"\)/);
  assert.match(groupResolution, /-Filter "displayName eq '\$escapedGroupName'"/);
  assert.doesNotMatch(groupResolution, /-Filter "displayName eq '\$groupName'"/);
  assert.match(groupResolution, /\[string\]\$group\.DisplayName -cne \$groupName/);
  assert.match(compliance, /GROUP \$\(\$group\.DisplayName\) ID \$\(\$group\.Id\) PRESTATE/);
  assert.match(compliance, /TO GROUP \$\(\$group\.DisplayName\) ID \$\(\$group\.Id\) FROM PRESTATE/);
});

test('completion-note templates require cited read-backs or an explicit partial-state open note', () => {
  for (const file of [
    '.claude/commands/new-user.md',
    '.claude/commands/new-device-setup.md',
    '.claude/commands/unite-extension-create.md',
    '.claude/commands/unite-voicemail-reset.md',
  ]) {
    const source = documents.get(file).source;
    assert.match(source, /only after[\s\S]{0,300}(?:read-back|verified|passes)/i, `${file}: completion is not read-back conditional`);
    assert.match(source, /Partial state — keep open/i, `${file}: missing incomplete-state alternative`);
    assert.match(source, /pending[\s\S]{0,100}fail/i, `${file}: partial note omits pending/failed work`);
  }
});

test('inventory includes the named audit hot spots', () => {
  const ids = new Set(markers.map((marker) => marker.id));
  for (const id of [
    'mailbox-permission-remove', 'mfa-method-delete-portal', 'mfa-session-revoke',
    'password-cloud-reset', 'password-session-revoke', 'print-queue-delete',
    'quarantine-release-all', 'quarantine-release-one', 'device-full-wipe',
    'rollback-bulk-usage-location', 'security-account-block', 'security-session-revoke',
  ]) assert.ok(ids.has(id), `missing required hot-spot inventory item: ${id}`);
});

// ── G1: Google Workspace / Okta / Jamf / macOS shell sinks ────────────────────
// The shell-fence detector must see every gam, gcloud, HTTP-API, jamf and macOS
// administration mutation, leave read-only diagnostics live, and require a
// same-fence `# SAFETY GATE [id]` whose plain-text confirmation grammar is
// explicit and fail-closed (no pwsh involved).

const G1_SHELL_MUTATIONS = [
  ['gam create user "[USER@DOMAIN.COM]" firstname "[FIRST_NAME]" lastname "[LAST_NAME]" password random', 'gam-write'],
  ['gam update user "[USER@DOMAIN.COM]" suspended on', 'gam-write'],
  ['gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['gam undelete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['gam suspend user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['gam unsuspend user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['gam user "[USER@DOMAIN.COM]" transfer drive "[MANAGER_UPN]"', 'gam-write'],
  ['gam user "[USER@DOMAIN.COM]" move drivefile "[FILE_ID]" parentid root', 'gam-write'],
  ['gam user "[USER@DOMAIN.COM]" add license "[LICENSE_TYPE]"', 'gam-write'],
  ['gam user "[USER@DOMAIN.COM]" remove license "[LICENSE_TYPE]"', 'gam-write'],
  ['gam user "[USER@DOMAIN.COM]" revoke tokens', 'gam-write'],
  ['gam user "[USER@DOMAIN.COM]" wipe', 'gam-write'],
  ['gam user "[USER@DOMAIN.COM]" deprovision', 'gam-write'],
  ['gam update cros "[DEVICE_ID]" action disable', 'gam-write'],
  ['gam cros "[DEVICE_ID]" action deprovision_retiring_device', 'gam-write'],
  ['gam issuecommand cros "[DEVICE_ID]" command remote_powerwash doit', 'gam-write'],
  ['gam user "[USER@DOMAIN.COM]" signout', 'gam-write'],
  ['sudo ~/bin/gam7/gam update group "[GROUP_EMAIL]" add member "[USER@DOMAIN.COM]"', 'gam-write'],
  ['gam print users query "isSuspended=True" | gam update user "[USER@DOMAIN.COM]" suspended off', 'gam-write'],
  ['result=$(gam delete user "[USER@DOMAIN.COM]")', 'gam-write'],
  ['gcloud iam service-accounts keys create key.json --iam-account="fixture"', 'gcloud-write'],
  ['gcloud projects add-iam-policy-binding fixture-project --member="user:fixture" --role="roles/viewer"', 'gcloud-write'],
  ['gcloud projects remove-iam-policy-binding fixture-project --member="user:fixture" --role="roles/viewer"', 'gcloud-write'],
  ['gcloud config set project fixture-project', 'gcloud-write'],
  ['gcloud iam service-accounts delete fixture', 'gcloud-write'],
  ['gcloud iam service-accounts update fixture --display-name="fixture"', 'gcloud-write'],
  ['curl -sS -X POST "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/deactivate" -H "Authorization: SSWS ${OKTA_API_TOKEN}"', 'http-write'],
  ['curl -sS -X DELETE "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/sessions"', 'http-write'],
  ['curl -sS --request PUT "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['curl -sSX PATCH "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['curl -sS --data "{}" "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['curl -sS -d @body.json "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['curl -sS --json "{}" "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['wget --method=POST "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['wget --post-data="x" "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['http POST "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/reset_password"', 'http-write'],
  ['https DELETE "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/sessions"', 'http-write'],
  ['https "https://[@Aegion_JAMF_URL]/api/v1/fixture" name=value', 'http-write'],
  ['sudo jamf policy', 'jamf-write'],
  ['sudo jamf recon', 'jamf-write'],
  ['sudo jamf manage', 'jamf-write'],
  ['sudo jamf removeFramework', 'jamf-write'],
  ['sudo /usr/local/bin/jamf enroll -prompt', 'jamf-write'],
  ['sudo profiles renew -type enrollment', 'profiles-write'],
  ['sudo profiles install -path fixture.mobileconfig', 'profiles-write'],
  ['sudo profiles remove -identifier fixture.profile', 'profiles-write'],
  ['sudo profiles -I -F fixture.mobileconfig', 'profiles-write'],
  ['sudo profiles -R -p fixture.profile', 'profiles-write'],
  ['sudo dscl . -create /Users/fixture', 'dscl-write'],
  ['sudo dscl . -delete /Users/fixture', 'dscl-write'],
  ['sudo dscl . -append /Groups/admin GroupMembership fixture', 'dscl-write'],
  ['sudo dscl . -change /Users/fixture RealName old new', 'dscl-write'],
  ['sudo dscl . -passwd /Users/fixture', 'dscl-write'],
  ['sudo fdesetup enable', 'fdesetup-write'],
  ['sudo fdesetup disable', 'fdesetup-write'],
  ['sudo fdesetup add -usertoadd fixture', 'fdesetup-write'],
  ['sudo fdesetup remove -user fixture', 'fdesetup-write'],
  ['sudo fdesetup changerecovery -personal', 'fdesetup-write'],
  ['diskutil eraseDisk APFS Fixture disk9', 'diskutil-write'],
  ['diskutil eraseVolume APFS Fixture disk9s1', 'diskutil-write'],
  ['diskutil apfs deleteVolume disk9s9', 'diskutil-write'],
  ['diskutil partitionDisk disk9 GPT APFS Fixture 100%', 'diskutil-write'],
  ['sudo softwareupdate -i -a', 'softwareupdate-write'],
  ['sudo softwareupdate --install --all --restart', 'softwareupdate-write'],
  ['sudo networksetup -setairportnetwork en0 fixture-ssid', 'networksetup-write'],
  ['sudo networksetup -setdnsservers Wi-Fi Empty', 'networksetup-write'],
  ['sudo systemsetup -setremotelogin on', 'systemsetup-write'],
  ['defaults write com.apple.fixture Key -bool true', 'defaults-write'],
  ['sudo launchctl load -w /Library/LaunchDaemons/fixture.plist', 'launchctl-write'],
  ['sudo launchctl unload /Library/LaunchDaemons/fixture.plist', 'launchctl-write'],
  ['sudo launchctl bootstrap system /Library/LaunchDaemons/fixture.plist', 'launchctl-write'],
  ['sudo launchctl bootout system/fixture', 'launchctl-write'],
  ['sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart -activate -configure -access -on', 'kickstart-write'],
  // Wrapper and indirect forms (WARDEN review, 2026-10-15)
  ['sudo -u admin gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['sudo --user=admin gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['sudo -E gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['command gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['env GAMCFGDIR=/tmp/fixture gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['GAMCFGDIR=/tmp/fixture gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['nohup gam delete user "[USER@DOMAIN.COM]" &', 'gam-write'],
  ['time gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['nice -n 10 gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['caffeinate -i gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['exec gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['script -q /dev/null gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['xargs -n 1 gam delete user < fixture-users.txt', 'gam-write'],
  ['"$HOME/bin/gam7/gam" delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['sudo -u admin /usr/local/bin/jamf removeFramework', 'jamf-write'],
  ['$GAM delete user "[USER@DOMAIN.COM]"', 'indirect-exec'],
  ['GAM=/usr/local/bin/gam; "$GAM" suspend user "[USER@DOMAIN.COM]"', 'indirect-exec'],
  ['"${GAM}" suspend user "[USER@DOMAIN.COM]"', 'indirect-exec'],
  ["ssh [DEVICE_NAME] 'sudo jamf removeFramework'", 'indirect-exec'],
  ['ssh -t [DEVICE_NAME] sudo jamf removeFramework', 'indirect-exec'],
  ["bash -c 'gam delete user [USER@DOMAIN.COM]'", 'indirect-exec'],
  ["zsh -c 'sudo jamf removeFramework'", 'indirect-exec'],
  [`osascript -e 'do shell script "sudo jamf removeFramework" with administrator privileges'`, 'indirect-exec'],
  ['eval "gam delete user [USER@DOMAIN.COM]"', 'indirect-exec'],
  [`http --raw '{}' "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/suspend"`, 'http-write'],
  ['curl -sS -H "X-HTTP-Method-Override: DELETE" "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"', 'http-write'],
  ['curl --config /tmp/fixture-request.cfg', 'http-write'],
  ['curl -sK /tmp/fixture-request.cfg', 'http-write'],
  // Second fresh-context review (WARDEN pass 2, 2026-10-15)
  ['sudo -- gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['timeout 30 gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['doas gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['for u in [USER@DOMAIN.COM]; do gam delete user "$u"; done', 'gam-write'],
  ['if true; then gam delete user "[USER@DOMAIN.COM]"; fi', 'gam-write'],
  ['while true; do sudo jamf removeFramework; break; done', 'jamf-write'],
  ['! gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ["/bin/sh -c 'gam delete user [USER@DOMAIN.COM]'", 'indirect-exec'],
  ['/bin/bash -c "sudo jamf removeFramework"', 'indirect-exec'],
  [`/usr/bin/osascript -e 'do shell script "sudo jamf removeFramework"'`, 'indirect-exec'],
  ['$(which gam) delete user "[USER@DOMAIN.COM]"', 'indirect-exec'],
  ['$(command -v gam) delete user "[USER@DOMAIN.COM]"', 'indirect-exec'],
  ['`which gam` delete user "[USER@DOMAIN.COM]"', 'indirect-exec'],
  ['${GAM:-gam} delete user "[USER@DOMAIN.COM]"', 'indirect-exec'],
  ['curl -sS "https://[@Aegion_JAMF_URL]/fixture.sh" | sudo bash', 'indirect-exec'],
  ['curl -sS "https://[@Aegion_JAMF_URL]/fixture.sh" | sh', 'indirect-exec'],
  ["echo 'gam delete user [USER@DOMAIN.COM]' | bash", 'indirect-exec'],
  ['bash <(curl -sS "https://[@Aegion_JAMF_URL]/fixture.sh")', 'indirect-exec'],
  ['su admin -c "gam delete user [USER@DOMAIN.COM]"', 'indirect-exec'],
  ["sudo su - -c 'jamf removeFramework'", 'indirect-exec'],
  ['find /tmp/fixture -name "*.txt" -exec gam delete user {} \;', 'indirect-exec'],
  ['env -S "gam delete user [USER@DOMAIN.COM]"', 'indirect-exec'],
  ['set -- gam delete user "[USER@DOMAIN.COM]"; "$@"', 'indirect-exec'],
  ['METHOD=DELETE; curl -sS -X "$METHOD" "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"', 'http-write'],
  ['curl -sS --request "$METHOD" "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"', 'http-write'],
  ['curl $CURL_ARGS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"', 'http-write'],
  // Third fresh-context review (WARDEN pass 3, N-3): the braces form the runbooks use
  ['curl -sS -X "${METHOD}" "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"', 'http-write'],
  ['curl -sS --request="${METHOD}" "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"', 'http-write'],
  ['curl -sS -X"${METHOD}" "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"', 'http-write'],
  ['curl -sSX "${METHOD}" "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"', 'http-write'],
  ['curl -sS -X "$(printf DELETE)" "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"', 'http-write'],
  ['wget -q --method="${METHOD}" "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  // N-4: a wrapper called by its path is still a wrapper
  ['/usr/bin/sudo gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['/usr/bin/env gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['/usr/bin/nohup gam delete user "[USER@DOMAIN.COM]" &', 'gam-write'],
  ['/usr/bin/sudo /usr/local/bin/jamf removeFramework', 'jamf-write'],
  ['/usr/bin/timeout 30 gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['"/usr/bin/sudo" -u admin /usr/local/bin/jamf removeFramework', 'jamf-write'],
  // N-6: interpreter one-liners, scheduled runs, root shells, arch, quoted or escaped names
  [`python3 -c "import subprocess; subprocess.run(['gam', 'delete', 'user', '[USER@DOMAIN.COM]'])"`, 'indirect-exec'],
  [`/usr/bin/python3 -c 'print(1)'`, 'indirect-exec'],
  [`perl -e 'system("gam delete user [USER@DOMAIN.COM]")'`, 'indirect-exec'],
  [`ruby -e 'system("sudo jamf removeFramework")'`, 'indirect-exec'],
  [`node -e 'require("child_process").execSync("gam delete user [USER@DOMAIN.COM]")'`, 'indirect-exec'],
  [`expect -c 'spawn gam delete user [USER@DOMAIN.COM]; interact'`, 'indirect-exec'],
  [`echo 'gam delete user [USER@DOMAIN.COM]' | at now`, 'indirect-exec'],
  ['crontab /tmp/fixture-cron', 'indirect-exec'],
  ['sudo -s', 'indirect-exec'],
  ['sudo -i jamf removeFramework', 'indirect-exec'],
  ['sudo --login', 'indirect-exec'],
  ['arch -arm64 gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['/usr/bin/arch -x86_64 /usr/local/bin/jamf removeFramework', 'jamf-write'],
  [`'gam' delete user "[USER@DOMAIN.COM]"`, 'gam-write'],
  ['\\gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['gam${IFS}delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  // WARDEN pass 4, P4-4: a line copied with its shell prompt is still a command
  ['$ gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['% sudo jamf removeFramework', 'jamf-write'],
  ['❯ gam update user "[USER@DOMAIN.COM]" suspended on', 'gam-write'],
  ['admin@host:~$ gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['[admin@host ~]$ sudo jamf removeFramework', 'jamf-write'],
  ['$ curl -sS "https://[@Aegion_JAMF_URL]/fixture.sh" | bash', 'indirect-exec'],
  // WARDEN pass 5, P5-2: the macOS default zsh prompt, versioned shells, a venv prefix, Windows prompts
  ['admin@MacBook-Pro ~ % sudo jamf removeFramework', 'jamf-write'],
  ['bash-5.2$ gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['sh-3.2# sudo jamf removeFramework', 'jamf-write'],
  ['(venv) $ gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['PS C:\\> gam.exe delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['C:\\Users\\admin> gam.exe delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  // WARDEN pass 6, P6-2: the pre-Catalina macOS bash default and the oh-my-zsh arrow
  ['MacBook-Pro:~ admin$ gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['➜  ~ sudo jamf removeFramework', 'jamf-write'],
  ['➜ gam delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  // P6-3: the shell lane's native sinks behind a wrapper (the normal macOS form)
  ['sudo rm -rf /tmp/fixture', 'file-write'],
  ['echo "[@Aegion_DOMAIN] fixture" | sudo tee -a /etc/hosts', 'file-write'],
  ['sudo -u admin mv /tmp/fixture-a /tmp/fixture-b', 'file-write'],
  ['sudo chmod 600 /tmp/fixture', 'metadata-write'],
  ['sudo brew install fixture', 'package-write'],
  ['xargs rm < /tmp/fixture-list', 'file-write'],
  // P5-3: any explicit method that is not GET, HEAD, OPTIONS or TRACE (fail-closed, as for gam and gcloud verbs)
  ['curl -sS -X PURGE "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['curl -sS --request MOVE "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['curl -sXLOCK "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['wget -q --method=COPY "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['curl -sS -H "X-HTTP-Method-Override: PURGE" "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['http PURGE "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  ['https MOVE "https://[@Aegion_JAMF_URL]/api/v1/fixture"', 'http-write'],
  // P4-5: a Windows-style .exe name and curl values glued to their short option
  ['gam.exe delete user "[USER@DOMAIN.COM]"', 'gam-write'],
  ['curl.exe -X DELETE "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"', 'http-write'],
  ['curl -sS -d$BODY "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/suspend"', 'http-write'],
  ['curl -sS -dname=value "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"', 'http-write'],
  ['curl -sXpost "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/suspend"', 'http-write'],
  ['curl -sS -Xdelete "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"', 'http-write'],
];

const G1_SHELL_READ_ONLY = [
  'gam info user "[USER@DOMAIN.COM]"',
  'sudo -u admin gam info user "[USER@DOMAIN.COM]"',
  'required_confirmation="SEND JAMF CHECK-IN REQUEST FROM [DEVICE_NAME]"',
  '$variable = "value"',
  'for u in [USER@DOMAIN.COM]; do gam info user "$u"; done',
  'if gam info user "[USER@DOMAIN.COM]"; then echo found; fi',
  '#!/bin/sh',
  'env GAMCFGDIR=/tmp/fixture gam print users',
  '"$HOME/bin/gam7/gam" info user "[USER@DOMAIN.COM]"',
  'gam print users query "isSuspended=True" fields primaryemail,suspended',
  'gam report admin event DELETE_USER',
  'gam user "[USER@DOMAIN.COM]" show tokens',
  'gam whatis "[USER@DOMAIN.COM]"',
  'gam print groups member "[USER@DOMAIN.COM]"',
  'gam info cros "[DEVICE_ID]"',
  'gcloud projects describe fixture-project',
  'gcloud iam service-accounts list',
  'curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"',
  'curl -sS -X GET "https://[@Aegion_JAMF_URL]/api/v1/fixture"',
  'http GET "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" Authorization:"SSWS ${OKTA_API_TOKEN}"',
  'sudo jamf version',
  'jamf checkJSSConnection',
  'profiles show -type enrollment',
  'sudo profiles list',
  'profiles status -type enrollment',
  'dscl . -read /Users/fixture',
  'dscl . -list /Users',
  'fdesetup status',
  'sudo fdesetup list',
  'diskutil list',
  'diskutil info disk0',
  'diskutil apfs list',
  'softwareupdate -l',
  'softwareupdate --history',
  'networksetup -getairportnetwork en0',
  'networksetup -listallhardwareports',
  'sudo systemsetup -getremotelogin',
  'defaults read com.apple.fixture',
  'launchctl list',
  'launchctl print system/fixture',
  'system_profiler SPHardwareDataType',
  'log show --last 1h --style compact',
  'ping -c 4 [@Aegion_DOMAIN]',
  'dig +short [@Aegion_DOMAIN]',
  'curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}" | python3 -m json.tool',
  'node scripts/lint/command-structure.js',
  'crontab -l',
  'arch',
  'At <script or command>:<line number>',
  '$ gam info user "[USER@DOMAIN.COM]"',
  'gam.exe info user "[USER@DOMAIN.COM]"',
  'curl -sSfL "https://[@Aegion_JAMF_URL]/api/v1/fixture" -H "Authorization: Bearer ${JAMF_TOKEN}"',
  'curl -sS -o /tmp/fixture.json -w "%{http_code}" "https://[@Aegion_JAMF_URL]/api/v1/fixture"',
  'curl -sS -X HEAD "https://[@Aegion_JAMF_URL]/api/v1/fixture"',
  'curl -sS --request OPTIONS "https://[@Aegion_JAMF_URL]/api/v1/fixture"',
  'http HEAD "https://[@Aegion_JAMF_URL]/api/v1/fixture"',
];

test('G1 detector: every gam, gcloud, HTTP-API, jamf and macOS administration mutation in a shell fence is a sink', () => {
  const missed = [];
  for (const [line, label] of G1_SHELL_MUTATIONS) {
    for (const language of ['bash', 'zsh', 'sh', 'shell', '']) {
      const hits = commandsIn(line, language);
      if (!hits.includes(label)) missed.push(`${language || '(untagged)'}: ${line} → [${hits.join(', ')}]`);
    }
  }
  assert.deepEqual(missed, []);
});

test('G1 detector: read-only diagnostics stay live and are not sinks', () => {
  const flagged = [];
  for (const line of G1_SHELL_READ_ONLY) {
    const hits = commandsIn(line, 'bash');
    if (hits.length) flagged.push(`${line} → [${hits.join(', ')}]`);
  }
  assert.deepEqual(flagged, []);
});

// Gate variables belong to their gated fence. An operator pastes fences into one
// shell, so a sibling fence that sets or declares them (`readonly confirmation=…`)
// could pre-satisfy a gate: in a document with a gated shell fence, no other shell
// fence may name them at all.
function gateVariablesOutsideGates(document, gatedFenceIds) {
  if (!gatedFenceIds.size) return [];
  const problems = [];
  for (const fence of document.fences.filter((item) => SHELL_LANGUAGES.has(item.language) && !gatedFenceIds.has(item.id))) {
    fence.lines.forEach((rawLine, offset) => {
      if (shellReadings(shellCodeOf(rawLine)).some((reading) => /\b(?:required_)?confirmation\b/.test(reading))) {
        problems.push(`${document.file}:${fence.startLine + offset}: gate variables (confirmation, required_confirmation) may only appear inside a gated shell fence`);
      }
    });
  }
  return problems;
}

// The same paste can shadow the comparison without naming a gate variable: a
// sibling shell fence that defines a function (`[ () { return 0; }`), sets an
// alias, disables a builtin, sources a file, or hooks the prompt or a key binding
// runs before the gate in the operator's shell. In a document with a gated shell
// fence, every other shell fence is held to the gated fence's shadowing rows
// (SHELL_SHADOWING); a gated fence's own lines, after fi included, already are.
const SHELL_SIBLING_FORBIDDEN = SHELL_SHADOWING;
function gateShadowingOutsideGates(document, gatedFenceIds) {
  if (!gatedFenceIds.size) return [];
  const problems = [];
  for (const fence of document.fences.filter((item) => SHELL_LANGUAGES.has(item.language) && !gatedFenceIds.has(item.id))) {
    fence.lines.forEach((rawLine, offset) => {
      // As bash reads it, and as a shell that does not treat `#` as a comment reads
      // it (a comment line or a trailing comment is then code).
      const readings = [shellCodeOf(rawLine), rawLine.trim()].filter(Boolean);
      for (const row of SHELL_SIBLING_FORBIDDEN) {
        if (readings.some((statement) => shadows(row, statement))) {
          problems.push(`${document.file}:${fence.startLine + offset}: a shell fence beside a gated fence may not shadow or redefine read, [ or the shell (${row[1]})`);
        }
      }
    });
  }
  return problems;
}

function evaluateGateDocument(file, source) {
  const document = parseFences(file, source);
  const found = discoverMarkers(document);
  const { executable, preview } = mutationHits(document);
  const byFence = new Map();
  for (const marker of found.filter((item) => item.kind !== 'portal')) {
    if (!byFence.has(marker.fenceId)) byFence.set(marker.fenceId, []);
    byFence.get(marker.fenceId).push(marker);
  }
  for (const list of byFence.values()) list.sort((a, b) => a.line - b.line);
  const nearest = (hit) => (byFence.get(hit.fenceId) || []).filter((marker) => marker.line <= hit.line).at(-1);
  const failures = [];
  for (const hit of executable) {
    const owner = nearest(hit);
    if (!owner || owner.mode !== 'gated') failures.push(`${hit.file}:${hit.line}: ${hit.command} has 0 owners (${hit.statement})`);
  }
  for (const hit of preview) {
    const owner = nearest(hit);
    if (!owner || owner.mode !== 'preview') failures.push(`${hit.file}:${hit.line}: commented ${hit.command} is not owned by PREVIEW ONLY`);
  }
  const analyses = [];
  const gatedShellFences = new Set(found.filter((item) => item.kind === 'shell' && item.mode === 'gated').map((item) => item.fenceId));
  failures.push(...gateVariablesOutsideGates(document, gatedShellFences));
  failures.push(...gateShadowingOutsideGates(document, gatedShellFences));
  for (const marker of found.filter((item) => item.kind === 'shell' && item.mode === 'gated')) {
    const fence = document.fences.find((item) => item.id === marker.fenceId);
    const regionEndLine = ((byFence.get(marker.fenceId) || []).find((item) => item.line > marker.line)?.line || fence.endLine + 1) - 1;
    const owned = executable.filter((hit) => hit.fenceId === marker.fenceId && nearest(hit) === marker);
    if (!owned.length) failures.push(`${marker.id}: gate owns no executable mutation`);
    const analysis = analyzeShellGate(fence, marker, regionEndLine, owned);
    for (const problem of analysis.problems) failures.push(`${marker.id}: ${problem}`);
    analyses.push({ marker, analysis });
  }
  return { failures, executable, markers: found, analyses };
}

const G1_FIXTURE_DIR = path.join(ROOT, 'scripts', 'fixtures', 'command-safety-gates');

test('G1 fixtures: a GAM fence with no marker fails; the same fence with a correct marker passes', () => {
  const read = (name) => fs.readFileSync(path.join(G1_FIXTURE_DIR, name), 'utf8');
  const ungated = evaluateGateDocument('fixture/gam-fence-no-marker.md', read('gam-fence-no-marker.md.txt'));
  assert.ok(ungated.executable.some((hit) => hit.command === 'gam-write'), 'the detector must see the gam update line');
  assert.ok(ungated.failures.some((failure) => /gam-write has 0 owners/.test(failure)), ungated.failures.join(' | '));

  const gated = evaluateGateDocument('fixture/gam-fence-gated.md', read('gam-fence-gated.md.txt'));
  assert.equal(gated.executable.filter((hit) => hit.command === 'gam-write').length, 1, 'exactly one sink, owned by the gate');
  assert.deepEqual(gated.failures, []);
  assert.equal(gated.analyses.length, 1);
  assertShellGateFailClosed(gated.analyses[0].analysis, 'fixture-gws-user-suspend');
});

test('G1 shell gate analyzer rejects bypass-shaped control flow', () => {
  const header = [
    '# SAFETY GATE [fixture-shell]',
    '# Target: [USER@DOMAIN.COM]',
    '# Effect: suspend one Google Workspace user account',
    '# Scope: one user',
    '# Reversibility: R1 — reversible by the separate unsuspend procedure',
    '# Required confirmation: type exactly "SUSPEND GOOGLE USER [USER@DOMAIN.COM]"',
    `# Failure behavior: ${SHELL_FAILURE_BEHAVIOR}`,
  ];
  const sink = '  gam update user "[USER@DOMAIN.COM]" suspended on';
  const body = [
    'required_confirmation="SUSPEND GOOGLE USER [USER@DOMAIN.COM]"',
    '# reads one line exactly as typed and runs the change only on an exact, case-sensitive match',
    SHELL_GATE_IF_CANONICAL,
    '  # suspends the account',
    sink,
    'else',
    '  echo "Confirmation did not match. No change was made." >&2',
    '  exit 1',
    'fi',
  ];
  const fenceOf = (lines) => ['```bash', ...lines, '```', ''].join('\n');
  const verdict = (lines) => evaluateGateDocument('fixture/shell-bypass.md', fenceOf(lines)).failures;
  assert.deepEqual(verdict([...header, ...body]), [], 'the canonical gate must pass');
  const replace = (from, to) => [...header, ...body].map((line) => (line === from ? to : line));
  const ifWith = (condition) => replace(SHELL_GATE_IF_CANONICAL, `if ${condition}; then`);
  // inserts lines between the template and the comparison
  const beforeCompare = (...inserted) => [...header, body[0], ...inserted, ...body.slice(1)];
  const cases = [
    ['no-exit-in-else', replace('  exit 1', '  :')],
    ['exit-zero-in-else', replace('  exit 1', '  exit 0')],
    ['whitespace-trimming-read', ifWith('read -r confirmation && [ "$confirmation" = "$required_confirmation" ]')],
    ['confirmation-overwrite', beforeCompare('confirmation="$required_confirmation"')],
    ['sink-after-fi', [...header, body[0], body[1], body[2], '  :', ...body.slice(5), sink.trim()]],
    ['sink-before-gate', [...header, sink.trim(), ...body]],
    ['dead-wrapper', [...header, 'if false; then', ...body, 'fi']],
    ['read-function-override', ['read() { confirmation="SUSPEND GOOGLE USER [USER@DOMAIN.COM]"; }', ...header, ...body]],
    ['alias-override', ["alias read='true'", ...header, ...body]],
    ['trap', ["trap 'true' ERR", ...header, ...body]],
    ['eval', replace(sink, '  eval "gam update user [USER@DOMAIN.COM] suspended on"')],
    ['template-mismatch', replace(body[0], 'required_confirmation="yes"')],
    ['case-folded-compare', ifWith('IFS= read -r confirmation && [ "${confirmation^^}" = "$required_confirmation" ]')],
    ['or-true', ifWith('IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ] || true')],
    ['negated-compare', ifWith('IFS= read -r confirmation && [ "$confirmation" != "$required_confirmation" ]')],
    ['read-or-compare', ifWith('IFS= read -r confirmation || [ "$confirmation" = "$required_confirmation" ]')],
    ['elif-branch', [...header, ...body.slice(0, 5), 'elif true; then', '  :', ...body.slice(5)]],
    ['mutation-in-else', replace('  echo "Confirmation did not match. No change was made." >&2', sink)],
    ['missing-failure-behavior', [...header.slice(0, 6), ...body]],
    ['missing-required-confirmation-field', [...header.slice(0, 5), header[6], ...body]],
    ['second-read', beforeCompare('IFS= read -r confirmation')],
    ['expansion-in-template', replace(body[0], 'required_confirmation="SUSPEND GOOGLE USER $(whoami)"')],
    // Post-read overwrites (WARDEN review, 2026-10-15): each pre-satisfies the comparison.
    ...[
      ['printf-v-overwrite', `printf -v confirmation '%s' "$required_confirmation"`],
      ['printf-v-required-overwrite', `printf -v required_confirmation '%s' "$confirmation"`],
      ['mapfile-overwrite', 'mapfile -t confirmation <<< "$required_confirmation"'],
      ['readarray-overwrite', 'readarray -t confirmation <<< "$required_confirmation"'],
      ['for-loop-overwrite', 'for confirmation in "$required_confirmation"; do :; done'],
      ['for-loop-required-overwrite', 'for required_confirmation in "$confirmation"; do :; done'],
      ['array-element-overwrite', 'confirmation[0]="$required_confirmation"'],
      ['prompt-with-printf-v', `printf -v confirmation '%s\\n' "$required_confirmation"`],
      ['unrelated-statement-before-compare', 'cd /tmp'],
    ].map(([name, inserted]) => [name, beforeCompare(inserted)]),
    ['statement-between-marker-and-template', [...header, 'IFS=x', ...body]],
    // A `#` glued to a word is not a comment in bash (WARDEN pass 2): these hid
    // statements that pre-satisfy the comparison before the marker or the read.
    ['pre-marker-readonly-glued-hash', ['true#;readonly confirmation="SUSPEND GOOGLE USER [USER@DOMAIN.COM]"', ...header, ...body]],
    ['pre-marker-exec-stdin-glued-hash', [`true#;exec 0< <(printf '%s\\n' "SUSPEND GOOGLE USER [USER@DOMAIN.COM]")`, ...header, ...body]],
    ['pre-marker-statement', ['echo preparing', ...header, ...body]],
    ['glued-hash-in-prompt', beforeCompare(`printf '%s\\n' "Type exactly"#;confirmation="$required_confirmation"`)],
    // WARDEN pass 3: a standalone read takes the next pasted line (non-bracketed paste,
    // bash -s), and a trailing or punctuated comment turns into code where `#` is a
    // plain word (interactive zsh without interactive_comments).
    ['standalone-read-old-form', [...header, body[0], 'IFS= read -r confirmation', 'if [ "$confirmation" = "$required_confirmation" ]; then', ...body.slice(3)]],
    ['trailing-comment-on-template', replace(body[0], `${body[0]}   # the exact phrase to type`)],
    ['trailing-comment-on-compare', replace(SHELL_GATE_IF_CANONICAL, `${SHELL_GATE_IF_CANONICAL}   # exact match only`)],
    ['trailing-comment-on-sink', replace(sink, `${sink}   # suspends the account`)],
    ['trailing-comment-on-exit', replace('  exit 1', '  exit 1   # stops')],
    ...[
      ['apostrophe-in-comment', "# the admin's exact phrase"],
      ['backtick-in-comment', '# type `SUSPEND GOOGLE USER [USER@DOMAIN.COM]`'],
      ['semicolon-in-comment', '# stops; exit 0'],
      ['parenthesis-in-comment', '# one user (data kept)'],
      ['dollar-in-comment', '# shows $required_confirmation'],
      ['pipe-in-comment', '# compares | exact'],
      ['ampersand-in-comment', '# read & compare'],
      ['redirect-in-comment', '# writes > the log'],
      ['backslash-in-comment', '# continues \\'],
      ['bang-in-comment', '# careful!'],
      ['unbalanced-quote-in-comment', '# type exactly "SUSPEND GOOGLE USER'],
    ].map(([name, comment]) => [name, beforeCompare(comment)]),
    ['old-backtick-required-field', replace(header[5], '# Required confirmation: type exactly `SUSPEND GOOGLE USER [USER@DOMAIN.COM]`')],
    ['old-failure-sentence', replace(header[6], '# Failure behavior: Empty, declined, `yes`, or any other response means stop; no change is made.')],
    ['unsafe-comment-after-fi', [...header, ...body, '# done; exit 0']],
    // WARDEN pass 4: a gated fence's own lines after fi may not shadow the next gate,
    // and an exit status of 256 or more wraps to 0
    ['shadow-after-fi-brace', [...header, ...body, `{ alias '['=true; }`]],
    ['shadow-after-fi-keyword', [...header, ...body, 'if :; then [ () { return 0; }; fi']],
    ['shadow-after-fi-wrapper', [...header, ...body, 'command declare -r confirmation=x']],
    ['hook-after-fi', [...header, ...body, `{ PROMPT_COMMAND='true'; }`]],
    // WARDEN pass 5: quoted or escaped names and a case label after fi
    ['quoted-alias-after-fi', [...header, ...body, `'alias' '['=true`]],
    ['escaped-readonly-after-fi', [...header, ...body, 'read\\only required_confirmation=']],
    ['case-label-after-fi', [...header, ...body, `case x in x) alias '['=true;; esac`]],
    // WARDEN pass 6
    ['locale-quoted-readonly-after-fi', [...header, ...body, `$"readonly" required_confirm""ation=""`]],
    ['brace-expanded-alias-after-fi', [...header, ...body, `a{lias,} '['=true`]],
    ['ansi-c-escaped-alias-after-fi', [...header, ...body, `$'\\x61lias' '['=true`]],
    ['exit-256-in-else', replace('  exit 1', '  exit 256')],
    ['exit-512-in-else', replace('  exit 1', '  exit 512')],
  ];
  const accepted = [];
  for (const [name, lines] of cases) {
    let failures;
    try { failures = verdict(lines); } catch (error) { failures = [String(error.message)]; }
    if (!failures.length) accepted.push(name);
  }
  assert.deepEqual(accepted, [], 'every bypass-shaped fixture must be rejected');
  // The canonical stdout prompt and plain comments stay allowed.
  const prompted = beforeCompare('# shows the phrase to type', `printf '%s\\n' "Type exactly: $required_confirmation"`);
  assert.deepEqual(verdict(prompted), [], 'a printf prompt between the template and the comparison must pass');
});

test('G1 shell gate harness executes the fence\'s own lines up to the comparison', () => {
  const source = fs.readFileSync(path.join(G1_FIXTURE_DIR, 'gam-fence-gated.md.txt'), 'utf8');
  const gated = evaluateGateDocument('fixture/gam-fence-gated.md', source);
  assert.deepEqual(gated.failures, []);
  const { analysis } = gated.analyses[0];
  const fenceLines = source.split('```bash\n')[1].split('\n');
  assert.ok(Array.isArray(analysis.preCompareLines) && analysis.preCompareLines.length >= 2, 'the analysis must carry the fence\'s own pre-comparison lines');
  assert.equal(analysis.preCompareLines[0], fenceLines[0], 'the harness starts at the fence\'s first line');
  assert.deepEqual(analysis.preCompareLines, fenceLines.slice(0, analysis.preCompareLines.length));
  assert.ok(analysis.preCompareLines.some((line) => /^\s*required_confirmation="/.test(line)));
  assert.equal(fenceLines[analysis.preCompareLines.length], SHELL_GATE_IF_CANONICAL, 'the lines stop at the comparison');
  assertShellGateFailClosed(analysis, 'fixture-harness-canonical');
  // Lines the grammar would reject, smuggled straight into the harness, must make it
  // fail: the harness runs the source lines, not a re-synthesized canonical script.
  if (SHELL_ENGINES.length > 0) {
    const smuggle = (...extra) => ({ ...analysis, problems: [], preCompareLines: [...analysis.preCompareLines, ...extra] });
    // a pre-comparison overwrite is now moot (the read inside the condition runs last),
    // but a shadowed read still pre-satisfies the comparison
    assert.throws(() => assertShellGateFailClosed(smuggle('read() { confirmation="$required_confirmation"; }'), 'fixture-harness-smuggled'), /\(normal\).*(?:reached the sink|exited zero)/);
    // a standalone read eats the typed phrase, so the comparison never sees it
    assert.throws(() => assertShellGateFailClosed(smuggle('IFS= read -r confirmation'), 'fixture-harness-standalone-read'), /\(normal\): exact phrase did not traverse the gate/);
    // only the literal-# run sees a comment that turns into code where # is a plain word
    assert.throws(() => assertShellGateFailClosed(smuggle('# note; read() { confirmation="$required_confirmation"; }'), 'fixture-harness-literal-comment'), /\(literal-#\): rejected input .* (?:reached the sink|exited zero)/);
  }
});

for (const marker of markers.filter((item) => item.kind === 'shell' && item.mode === 'gated')) {
  test(`${marker.id}: shell gate is explicit, dominates its sinks, and is fail-closed`, () => {
    const document = documents.get(marker.file);
    const fence = document.fences.find((item) => item.id === marker.fenceId);
    const owned = executableHits.filter((hit) => hit.fenceId === marker.fenceId && nearestMarker(hit) === marker);
    assert.ok(owned.length > 0, `${marker.file}:${marker.line}: gate owns no executable mutation`);
    const analysis = analyzeShellGate(fence, marker, nextMarkerLine(marker) - 1, owned);
    assert.deepEqual(analysis.problems, [], `${marker.id}: ${analysis.problems.join(' | ')}`);
    for (const binding of extractTargetBindings(analysis.fields.Target || '')) {
      assert.ok(analysis.expected.includes(binding), `${marker.id}: exact confirmation does not bind target token ${binding}`);
    }
    assertEffectCorrespondence(analysis.fields.Effect || '', analysis.expected, marker.id);
    assertShellGateFailClosed(analysis, marker.id);
  });
}

test('G1 statements: a glued # is not a comment, continued lines are one statement, gate variables stay in their gated fence', () => {
  const fence = (lines, language = 'bash') => ['```' + language, ...lines, '```', ''].join('\n');
  const failuresOf = (source) => evaluateGateDocument('fixture/g1-statements.md', source).failures.join(' | ');
  // a glued `#` hides nothing (bash and PowerShell only start a comment at a word boundary)
  assert.match(failuresOf(fence(['true#;gam delete user "[USER@DOMAIN.COM]"'])), /gam-write has 0 owners/);
  assert.match(failuresOf(fence(['x=1#;sudo /usr/local/bin/jamf removeFramework'])), /jamf-write has 0 owners/);
  assert.match(failuresOf(fence(['Write-Host a#;Remove-MgUser -UserId "[UPN]"'], 'powershell')), /Remove-MgUser has 0 owners/);
  assert.equal(failuresOf(fence(['gam info user "[USER@DOMAIN.COM]"   # a real comment: gam delete user is only mentioned'])), '');
  // bash starts a comment only after whitespace or ; & | ( ) < > — never after { or }
  // (WARDEN pass 3, N-2): `${#var}`, `{#` and `}#` hide nothing in a shell fence
  assert.match(failuresOf(fence(['[ ${#serial} -eq 12 ] && sudo jamf recon'])), /jamf-write has 0 owners/);
  assert.match(failuresOf(fence(['echo ${#x}; gam delete user "[USER@DOMAIN.COM]"'])), /gam-write has 0 owners/);
  assert.match(failuresOf(fence(['{#;gam delete user "[USER@DOMAIN.COM]"'])), /gam-write has 0 owners/);
  assert.match(failuresOf(fence(['echo done}#;gam delete user "[USER@DOMAIN.COM]"'])), /gam-write has 0 owners/);
  assert.match(failuresOf(fence(['echo \\ #;gam delete user "[USER@DOMAIN.COM]"'])), /gam-write has 0 owners/);
  assert.match(failuresOf(fence(['echo `#`;gam delete user "[USER@DOMAIN.COM]"'])), /gam-write has 0 owners/);
  assert.equal(failuresOf(fence(['gam info user "[USER@DOMAIN.COM]";# gam delete user is only mentioned'])), '');
  assert.equal(stripExecutableComment('echo ${#x};gam delete', true), 'echo ${#x};gam delete');
  assert.equal(stripExecutableComment('true;# note', true), 'true;');
  // PowerShell keeps its own rule: `{#` opens a comment inside a script block
  assert.equal(stripExecutableComment('Get-MgUser {# Remove-MgUser'), 'Get-MgUser {');
  // a console or shell-session fence is scanned like a shell fence and can never host a gate (WARDEN pass 4, P4-4)
  for (const language of ['console', 'shellsession', 'shell-session', 'sh-session', 'terminal']) {
    assert.match(failuresOf(fence(['$ gam delete user "[USER@DOMAIN.COM]"'], language)), /gam-write has 0 owners/, language);
    assert.equal(failuresOf(fence(['$ gam info user "[USER@DOMAIN.COM]"', 'primaryEmail: [USER@DOMAIN.COM]'], language)), '', language);
  }
  // a backslash-continued write is one statement
  assert.match(failuresOf(fence(['curl -sS -H "Authorization: SSWS ${OKTA_API_TOKEN}" \\', '  -X DELETE "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/sessions"'])), /http-write has 0 owners/);
  assert.match(failuresOf(fence(['http \\', '  DELETE "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/sessions"'])), /http-write has 0 owners/);
  // gate variables set in a sibling fence would pre-satisfy the gate once both are pasted into one shell
  const gated = fs.readFileSync(path.join(G1_FIXTURE_DIR, 'gam-fence-gated.md.txt'), 'utf8');
  assert.equal(failuresOf(gated), '');
  assert.match(failuresOf(fence(['readonly confirmation="SUSPEND GOOGLE USER [USER@DOMAIN.COM]"']) + gated), /gate variables/);
  // a sibling fence that shadows `[` or `read`, or hooks the prompt, opens the gate
  // without naming a gate variable (WARDEN pass 3, N-5)
  for (const shadow of [`alias '['=true`, '[ () { return 0; }', 'function read { :; }', 'read() { :; }', 'enable -n read',
    "PROMPT_COMMAND='confirmation=x'", `bind -x '"\\C-m": true'`, 'source ./fixture-helpers.sh', 'unset -f gam']) {
    assert.match(failuresOf(fence([shadow]) + gated), /shadow|redefine|hook/, shadow);
  }
  // the same shapes behind a brace group, a keyword, a wrapper or a backslash (WARDEN pass 4, P4-1)
  for (const shadow of ['c=required_confirm; { readonly "${c}ation="; }', '{ [ () { return 0; }; }', `{ alias '['=true; }`,
    `if :; then alias '['=true; fi`, `command alias '['=true`, `\\alias '['=true`, `time alias '['=true`, `! alias '['=true`,
    `for x in 1; do alias '['=true; done`, `env alias '['=true`, 'command declare -f', '{ . ./fixture-helpers.sh; }',
    `if :; then PROMPT_COMMAND='confirmation=x'; fi`, `{ bind -x '"\\C-m": true'; }`,
    // WARDEN pass 5, P5-1: a quoted or escaped name, a case label, and a comment or
    // trailing comment that turns into code where `#` is a plain word
    `'alias' '['=true`, `"alias" '['=true`, `$'alias' '['=true`, `al\\ias '['=true`, `r''eadonly required_confirmation=`,
    `case x in x) alias '['=true;; esac`, `# note; alias '['=true`, `gam info user "[USER@DOMAIN.COM]"   # ; alias '['=true`,
    // WARDEN pass 6, P6-1: locale and ANSI-C quoting, escapes, brace expansion, quote-split variable names
    `$"readonly" required_confirm""ation=""`, `$'\\x61lias' '['=true`, `$'\\141lias' '['=true`, `$"alias" '['=true`,
    `a{lias,} '['=true`, `re{adonly,} x=`, `$"declare" -n confirm""ation=required_confirm""ation`, `$"typeset" -n x=y`,
    `# note; $"readonly" x=`, `$"builtin" alias '['=true`, `$'\\u0061lias' '['=true`]) {
    assert.match(failuresOf(fence([shadow]) + gated), /shadow|redefine|hook/, shadow);
  }
  // a gate variable named with a split or quoted spelling is still a gate variable
  for (const named of [`required_confirm""ation=x`, `$"confirmation"=x`, `confirm{ation,}=x`]) {
    assert.match(failuresOf(fence([named]) + gated), /gate variables/, named);
  }
  assert.equal(failuresOf(fence(['gam info user "[USER@DOMAIN.COM]"']) + gated), '');
});

test('every document with a gated shell fence keeps its gate variables inside gated fences', () => {
  const problems = [];
  for (const document of documents.values()) {
    const gatedFences = new Set(markers.filter((marker) => marker.file === document.file && marker.kind === 'shell' && marker.mode === 'gated').map((marker) => marker.fenceId));
    problems.push(...gateVariablesOutsideGates(document, gatedFences));
  }
  assert.deepEqual(problems, []);
});

test('no shell fence beside a gated shell fence shadows read, [ or the shell', () => {
  const problems = [];
  for (const document of documents.values()) {
    const gatedFences = new Set(markers.filter((marker) => marker.file === document.file && marker.kind === 'shell' && marker.mode === 'gated').map((marker) => marker.fenceId));
    problems.push(...gateShadowingOutsideGates(document, gatedFences));
  }
  assert.deepEqual(problems, []);
});

test('G1 portal grammar: Google, Okta and Jamf breadcrumbs that end in an action are mutation candidates', () => {
  const source = [
    '# fixture',
    '',
    '1. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → **Suspend user**',
    '2. Admin console → Devices → Chrome → Devices → `[DEVICE_ID]` → **Deprovision**',
    '3. Okta Admin Console → Directory → People → `[UPN]` → More Actions → **Deactivate**',
    '4. Jamf Pro → Computers → Search Inventory → `[SERIAL_NUMBER]` → Management → **Lock Computer**',
    '5. Jamf Pro → Computers → `[SERIAL_NUMBER]` → Management → Click **Erase Computer**',
    '6. Admin console → Apps → Google Workspace → Drive and Docs → **Transfer ownership**',
    '- Click **Powerwash** in the Chromebook device panel.',
    '- Unsuspend user: Admin console → Directory → Users → `[USER@DOMAIN.COM]` → Reactivate',
    '7. Admin console → Directory → Users → `[USER@DOMAIN.COM]` → read the status banner',
    '- OS updates fleet-wide via intune.microsoft.com → Devices → run updates',
    '',
  ].join('\n');
  const candidates = portalMutationCandidates(parseFences('fixture/g1-portal.md', source));
  const byLine = Object.fromEntries(candidates.map((candidate) => [candidate.line, candidate.actionWord.toLowerCase()]));
  assert.deepEqual(byLine, { 3: 'suspend', 4: 'deprovision', 5: 'deactivate', 6: 'lock', 7: 'erase', 8: 'transfer', 9: 'powerwash', 10: 'unsuspend' });
  for (const action of ['suspend', 'deprovision', 'deactivate', 'lock', 'erase', 'transfer', 'powerwash', 'unsuspend']) {
    assert.ok(PORTAL_CONFIRMATION_BY_ACTION.has(action), `${action} needs a confirmation family`);
  }
  assert.doesNotThrow(() => assertEffectCorrespondence('suspend one user; powerwash one Chromebook', 'SUSPEND [USER@DOMAIN.COM] AND POWERWASH [DEVICE_ID]', 'g1-effect-fixture'));
  assert.throws(() => assertEffectCorrespondence('deprovision one Chromebook', 'DISABLE [DEVICE_ID]', 'g1-effect-mismatch'));
  assert.doesNotThrow(() => assertEffectCorrespondence('restart the Zoom Rooms app on one room device', 'RESTART ZOOM ROOMS APP IN [DEVICE_NAME]', 'g1-restart-fixture'));
  assert.throws(() => assertEffectCorrespondence('restart the room computer', 'REBOOT [DEVICE_NAME]', 'g1-restart-mismatch'));
});

test('G1 portal grammar: the current Apple Business name and the selected-devices controls in G1 runbooks are candidates; Microsoft files keep their grammar', () => {
  const lines = [
    '# fixture',
    '',
    '1. Apple Business → Inventory → select `[SERIAL_NUMBER]` → **Release from Organization**',
    '2. At the top, click **Re-enable selected devices**, then click **Enable** to confirm.',
    '3. At the top, click **Disable selected devices** → choose **Disable with lock screen** → click **Disable**.',
    '4. At the top, read the status column in the devices list.',
    '',
  ];
  const source = lines.join('\n');
  const actionsByLine = (file) => Object.fromEntries(portalMutationCandidates(parseFences(file, source))
    .map((candidate) => [candidate.line, candidate.actionWord.toLowerCase()]));
  // A G1 runbook: the lane's own click grammar applies to any portal-cued list item.
  assert.deepEqual(actionsByLine('.claude/commands/gws-fixture.md'), { 3: 'release', 4: 're-enable', 5: 'disable' });
  // A Microsoft runbook: only the product-name cue is global; its click grammar is unchanged.
  assert.deepEqual(actionsByLine('.claude/commands/ms-fixture.md'), { 3: 'release' });
  assert.ok(PORTAL_CONFIRMATION_BY_ACTION.has('re-enable'), 're-enable needs a confirmation family');
  // A bare imperative step with no cue at all: a candidate in a G1 runbook, not in a Microsoft one.
  const bare = ['# fixture', '', '3. Click **Delete user** and confirm.', ''].join('\n');
  const bareActions = (file) => portalMutationCandidates(parseFences(file, bare)).map((candidate) => candidate.actionWord.toLowerCase());
  assert.deepEqual(bareActions('.claude/commands/okta-fixture.md'), ['delete']);
  assert.deepEqual(bareActions('.claude/commands/ms-fixture.md'), []);
  assert.match('RE-ENABLE CHROMEBOOK [DEVICE_ID]', PORTAL_CONFIRMATION_BY_ACTION.get('re-enable'));
});
