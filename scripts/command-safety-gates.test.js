'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const POWER_SHELL_LANGUAGES = new Set(['powershell', 'pwsh', 'ps1']);
const SHELL_LANGUAGES = new Set(['bash', 'sh', 'shell', 'zsh', '']);
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
];

const REFERENCE_BOUNDARIES = [
  '.claude/plugins/enterprise-it-ops/skills/it-ops.md',
  '.claude/skills/agent-handoff/SKILL.md',
  '.claude/skills/hermes-bridge-powershell/SKILL.md',
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
      assert.ok(fence && POWER_SHELL_LANGUAGES.has(fence.language),
        `${document.file}:${lineNumber}: PowerShell gate is not in a PowerShell fence`);
      markers.push({ id: match[1], mode: 'gated', kind: 'powershell', file: document.file, line: lineNumber, fenceId: fence.id });
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

function stripExecutableComment(line) {
  let single = false;
  let double = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '`') { index += 1; continue; }
    if (char === "'" && !double) { single = !single; continue; }
    if (char === '"' && !single) { double = !double; continue; }
    if (char === '#' && !single && !double) return line.slice(0, index);
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
  if (POWER_SHELL_LANGUAGES.has(language) && /(?:^|[;|{}=:])\s*&\s*\$bridge\s+-Action\s+Render\b/i.test(statement)) {
    hits.push('hermes-render');
  }
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
    const boundary = '(?:^|[;|{}=:&])\\s*';
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
  }
  return hits;
}

function mutationHits(document) {
  const executable = [];
  const preview = [];
  for (const fence of document.fences.filter((item) => MUTATION_FENCE_LANGUAGES.has(item.language))) {
    fence.lines.forEach((rawLine, offset) => {
      const line = fence.startLine + offset;
      const comment = rawLine.match(/^\s*#\s?(.*)$/);
      const statement = comment ? comment[1] : stripExecutableComment(rawLine);
      for (const command of commandsIn(statement, fence.language)) {
        (comment ? preview : executable).push({ file: document.file, fenceId: fence.id, line, command, statement: statement.trim() });
      }
    });
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
  if (/hermes-render/.test(value)) {
    categories.add('remote write');
    categories.add('external-system mutation');
  }
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
  return [...categories];
}

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
  const action = '(?:Add|Allow|Assign|Block|Calendar|Clear|Convert|Coordinate|Create|Deactivate|Delete|Disable|Enable|Fix|Grant|Install|Isolate|Log|Move|Purge|Reclaim|Reimage|Release|Remove|Rename|Replace|Require|Reset|Restore|Restrict|Retire|Revoke|Run|Schedule|Send|Set|Start|Stop|Submit|Transfer|Uncheck|Update|Wipe)';
  const actionBody = action.slice(3, -1);
  const arrowMutation = new RegExp(`→\\s*(?:\\*{0,2}|\`)?(${actionBody})\\b`, 'i');
  const imperativeMutation = new RegExp(`^\\s*(?:>\\s*)?(?:\\d+[.)]|[-*])\\s+(?:\\*\\*[^*]+:\\*\\*\\s*)?(?:Click|Select|Choose)\\s+(?:\\*{0,2}|\`)?(${actionBody})\\b`, 'i');
  const navigationListMutation = new RegExp(`^\\s*[-*]\\s+(${actionBody})(?:\\s*\\/\\s*(?:${actionBody}))+\\s*:.*→`, 'i');
  const navigationLabelMutation = new RegExp(`^\\s*[-*]\\s+(${actionBody})[^:]*:.*→`, 'i');
  const portalCue = /\b(?:Entra|Intune|EAC|Defender|Exchange|SharePoint|Teams|Zoom|Adobe|Meraki|admin portal|Recipients|Devices|Users|Groups|Policies|Settings)\b/i;
  const frontmatterEnd = document.lines[0] === '---' ? document.lines.indexOf('---', 1) : -1;
  document.lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (document.fenceAtLine.has(lineNumber)) return;
    if (frontmatterEnd > 0 && index <= frontmatterEnd) return;
    if (/^\s*\|/.test(line)) return;
    if (/^\s*(?:<!--\s*SAFETY GATE|>\s*\*\*PREVIEW ONLY|[-*]\s+\*\*(?:Target|Effect|Scope|Reversibility|Required confirmation|Failure behavior|Undo))/.test(line)) return;
    const inPortalRegion = markers.some((marker) => marker.kind === 'portal' && marker.file === document.file &&
      marker.line < lineNumber && lineNumber < nextMarkerLine(marker));
    const match = line.match(navigationListMutation) ||
      ((portalCue.test(line) || document.file === 'docs/portal-nav-2026.md') ? line.match(navigationLabelMutation) : null) ||
      ((portalCue.test(line) || inPortalRegion) ? line.match(imperativeMutation) : null) ||
      (portalCue.test(line) && /^\\s*(?:>\\s*)?(?:\\d+[.)]|[-*])\\s+/.test(line) ? line.match(arrowMutation) : null);
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
    id: 'hermes-ask-ssh-disclosure', file: 'scripts/hermes-bridge.ps1', testFile: 'scripts/hermes-bridge.test.js',
    interface: 'ssh', mode: 'gated', evidenceGroup: 'hermes',
    effect: 'Send one bounded advisory query to one validated private target and disclose its response locally.',
    authorization: 'Exact query SHA-256 plus target-digest phrase before credentials or SSH.',
    impactCategories: ['information disclosure', 'remote access'],
  },
  {
    id: 'hermes-dashboard-remote-write', file: 'scripts/hermes-bridge.ps1', testFile: 'scripts/hermes-bridge.test.js',
    interface: 'ssh', mode: 'gated', evidenceGroup: 'hermes',
    effect: 'Create one previously absent remote dashboard artifact.',
    authorization: 'Exact date plus resolved action SHA-256 phrase; structured input and no-clobber remote wrapper.',
    impactCategories: ['external-system mutation', 'remote write', 'reversible state change'],
  },
  {
    id: 'hermes-war-room-copy-local-write', file: 'scripts/hermes-bridge.ps1', testFile: 'scripts/hermes-bridge.test.js',
    interface: 'scp', mode: 'gated', evidenceGroup: 'hermes',
    effect: 'Create one GUID-named local HTML copy from one stable selected remote artifact.',
    authorization: 'Exact local destination, source digest, full remote content SHA-256, and byte-count phrase.',
    impactCategories: ['local filesystem write', 'remote access', 'reversible state change'],
  },
  {
    id: 'hermes-war-room-open-file', file: 'scripts/hermes-bridge.ps1', testFile: 'scripts/hermes-bridge.test.js',
    interface: 'native process', mode: 'gated', evidenceGroup: 'hermes',
    effect: 'Launch one default browser for a locally verified HTML file.',
    authorization: 'Exact local destination plus verified download SHA-256 phrase after size/content read-back.',
    impactCategories: ['local process launch', 'reversible state change'],
  },
  {
    id: 'hermes-war-room-open-url', file: 'scripts/hermes-bridge.ps1', testFile: 'scripts/hermes-bridge.test.js',
    interface: 'native process', mode: 'gated', evidenceGroup: 'hermes',
    effect: 'Launch one default browser for one allowlisted HTTPS or loopback HTTP URL.',
    authorization: 'Exact validated absolute URL phrase.',
    impactCategories: ['local process launch', 'reversible state change'],
  },
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
  hermes: {
    sourceFile: 'scripts/hermes-bridge.ps1', testFile: 'scripts/hermes-bridge.test.js',
    sourcePatterns: [
      /SEND READ-ONLY HERMES QUERY SHA256/, /CREATE WAR ROOM DASHBOARD \{0\} ACTION SHA256/,
      /request-sha256/, /os\.O_WRONLY \| os\.O_CREAT \| os\.O_EXCL \| os\.O_NOFOLLOW/,
      /CREATE WAR ROOM COPY \{0\} SOURCE SHA256 \{1\} CONTENT SHA256 \{2\} SIZE \{3\}/,
      /Downloaded War Room SHA-256 did not match/, /Start-Process -FilePath \$destination/,
    ],
    testPatterns: [
      /query remote command is constant and query bytes are stdin payload data/,
      /render and selector wrappers use structured stdin, argv execution, and atomic no-clobber checks/,
      /copy is content-bound, GUID-based, collision checked twice, and open follows exact verification/,
      /inert copy\/open model never opens after decline, transfer failure, or content mismatch/,
    ],
  },
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
      discoveredMarkdown: 'Tracked and nonignored untracked Markdown safety/preview markers plus recognized PowerShell, shell/native, and portal mutation grammar.',
      clientBoundaries: 'State-changing or disclosure-capable Jira, memory, security-audit, and Hermes implementations outside Markdown fence discovery.',
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
  'dashboard-render-artifact': ["$date = '2026-07-13'", "$expectedName = 'war_room_20260713.html'", "$targetLabel = '[HERMES_HOST]'"],
  'war-room-open-url': ["$validatedUrl = 'https://example.com/'"],
  'war-room-copy': ["$destination = 'C:\\Temp\\a.html'", "$sourceHash = ('a' * 64)", "$remoteContentHash = ('b' * 64)", '$remoteSize = 123'],
  'war-room-open-file': ["$destination = 'C:\\Temp\\a.html'", "$downloadHash = ('b' * 64)"],
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
                if ([string]$sink.command -ceq 'hermes-render') {
                    return $_.Extent.Text -match '(?i)^\s*&\s*\$bridge\s+-Action\s+Render\b'
                }
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
