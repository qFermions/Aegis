'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const SCANNER = path.resolve(__dirname, 'pre-commit-check.js');
const { decodeTextContent, safeDisplayPath } = require('./pre-commit-check');

function makeTempDir(t, prefix = 'aegis-scanner-') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(function () {
    fs.rmSync(directory, { force: true, recursive: true });
  });
  return directory;
}

function runGit(cwd, args, input) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    input,
    windowsHide: true,
  });
  assert.equal(result.status, 0, 'temporary Git fixture setup failed');
  return result;
}

function makeRepo(t) {
  const repo = makeTempDir(t);
  runGit(repo, ['init', '-q']);
  return repo;
}

function writeFile(repo, relativePath, content) {
  const target = path.join(repo, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function stageAll(repo) {
  runGit(repo, ['add', '-A', '--']);
}

function commitAll(repo) {
  stageAll(repo);
  runGit(repo, [
    '-c', 'user.name=Scanner Test',
    '-c', `user.email=${['scanner', 'example.invalid'].join('@')}`,
    'commit', '-qm', 'fixture',
  ]);
}

function scannerEnvironment(overrides = {}) {
  const env = { ...process.env };
  delete env.AEGION_DOMAIN;
  delete env.AEGION_ORG_NAME;
  return { ...env, ...overrides };
}

function runScanner(cwd, args = [], env = scannerEnvironment()) {
  return spawnSync(process.execPath, [SCANNER, ...args], {
    cwd,
    encoding: 'utf8',
    env,
    windowsHide: true,
  });
}

function combinedOutput(result) {
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function assertExit(result, expected) {
  assert.equal(result.status, expected, `expected scanner exit ${expected}; received ${result.status}`);
  assert.equal(result.signal, null, 'scanner was terminated by a signal');
}

function assertRedacted(output, forbiddenValues) {
  for (const value of forbiddenValues) {
    assert.equal(output.includes(value), false, 'scanner output exposed a forbidden value');
  }
}

function syntheticSecret(fill = 'A') {
  return 'ghp_' + fill.repeat(30);
}

test('blocks a staged synthetic secret without printing the value or source line', function (t) {
  const repo = makeRepo(t);
  const secret = syntheticSecret();
  const fileName = 'private-marker.md';
  const sourceMarker = 'trailing-source-marker';
  const sourceLine = `credential=${secret} ${sourceMarker}`;
  writeFile(repo, fileName, `${sourceLine}\n`);
  stageAll(repo);

  const first = runScanner(repo);
  const second = runScanner(repo);
  const output = combinedOutput(first);
  assertExit(first, 1);
  assertExit(second, 1);
  assert.equal(combinedOutput(second), output, 'scanner output changed for identical input');
  assert.match(output, /File: private-marker\.md/);
  assert.match(output, /Guidance:/);
  assertRedacted(output, [secret, sourceLine, sourceMarker, repo]);
});

test('handles spaces, brackets, quotes, Unicode, and a leading dash in staged filenames', function (t) {
  const repo = makeRepo(t);
  const secret = syntheticSecret('B');
  const fileNames = [
    'space name.md',
    'brackets [metadata].md',
    "quote'name.md",
    'caf\u00e9-\u96ea.md',
    '-leading.md',
  ];

  for (const [index, fileName] of fileNames.entries()) {
    writeFile(repo, fileName, `credential=${secret} marker-${index}\n`);
  }
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.equal((output.match(/^  File: /gm) || []).length, fileNames.length);
  for (const fileName of fileNames) assert.equal(output.includes(fileName), true);
  assertRedacted(output, [secret, repo]);
});

test('redacts every C0 and DEL control character from displayed paths', function () {
  for (const codePoint of [...Array(32).keys(), 0x7f]) {
    const unsafePath = `safe-${String.fromCharCode(codePoint)}-spoof.md`;
    assert.equal(safeDisplayPath(unsafePath, []), '[REDACTED_FILE_PATH]');
  }
  assert.equal(safeDisplayPath('safe-visible-path.md', []), 'safe-visible-path.md');
});

test('detects binary content from bytes rather than the filename suffix', function () {
  assert.equal(decodeTextContent(Buffer.from([0x89, 0x50, 0x00, 0x47])), null);
  assert.equal(decodeTextContent(Buffer.from([0xc3, 0x28])), null);
  assert.equal(decodeTextContent(Buffer.from('plain text', 'utf8')), 'plain text');
});

test('fails closed when NUL or invalid UTF-8 bytes precede credential-shaped text', function (t) {
  const repo = makeRepo(t);
  const secret = syntheticSecret('Q');
  const fixtures = [
    ['nul-prefixed.txt', Buffer.concat([Buffer.from([0x00]), Buffer.from(secret, 'utf8')])],
    ['invalid-utf8.txt', Buffer.concat([Buffer.from([0xff]), Buffer.from(secret, 'utf8')])],
  ];
  for (const [file, bytes] of fixtures) {
    const target = path.join(repo, file);
    fs.writeFileSync(target, bytes);
  }
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.equal((output.match(/Binary, NUL-containing, or invalid UTF-8 content/g) || []).length, fixtures.length);
  assertRedacted(output, [secret, repo]);
});

test('scans text content even when the filename has a binary-looking suffix', function (t) {
  const repo = makeRepo(t);
  const secret = syntheticSecret('P');
  writeFile(repo, 'misleading.png', `credential=${secret}\n`);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.match(output, /File: misleading\.png/);
  assert.match(output, /GitHub token/);
  assertRedacted(output, [secret, repo]);
});

test('force-staged backups and snapshots receive the same PII scan as other text', function (t) {
  const repo = makeRepo(t);
  const email = ['operator', 'private-business.biz'].join('@');
  const files = ['ignored.bak', 'CLAUDE.md.snapshot'];
  writeFile(repo, '.gitignore', '*.bak\n*.snapshot\n');
  for (const file of files) writeFile(repo, file, `contact=${email}\n`);
  runGit(repo, ['add', '--', '.gitignore']);
  runGit(repo, ['add', '-f', '--', ...files]);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.equal((output.match(/Real email address detected/g) || []).length, files.length);
  for (const file of files) assert.equal(output.includes(file), true);
  assertRedacted(output, [email, repo]);
});

test('uses argument-array Git execution and NUL-delimited filename lists', function () {
  const source = fs.readFileSync(SCANNER, 'utf8');
  assert.match(source, /execFileSync\('git', args,/);
  assert.match(source, /\['diff'[\s\S]*?'-z'[\s\S]*?'--diff-filter=ACMRT'[\s\S]*?'--'\]/);
  assert.match(source, /\['ls-files', '-co', '--exclude-standard', '-z', '--'\]/);
  assert.match(source, /split\('\\0'\)/);
  assert.doesNotMatch(source, /\bexecSync\b/);
});

test('the scanner integration test source is itself scanner-clean', function (t) {
  const repo = makeRepo(t);
  writeFile(repo, 'pre-commit-check.test.js', fs.readFileSync(__filename, 'utf8'));
  stageAll(repo);

  const result = runScanner(repo);
  assertExit(result, 0);
  assert.match(combinedOutput(result), /Clean/);
});

test('does not let bracket metadata hide a real email address', function (t) {
  const repo = makeRepo(t);
  const email = ['operator', 'dept.company.test'].join('@');
  const sourceLine = `[owner: platform] contact=${email}`;
  const fileName = 'bracket-contact.md';
  writeFile(repo, fileName, `${sourceLine}\n`);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.match(output, /Real email address detected/);
  assert.match(output, /File: bracket-contact\.md/);
  assertRedacted(output, [email, sourceLine, repo]);
});

test('blocks an email address on a subdomain', function (t) {
  const repo = makeRepo(t);
  const email = ['user', 'sub.example.org'].join('@');
  writeFile(repo, 'subdomain.md', `contact=${email}\n`);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.match(output, /File: subdomain\.md/);
  assertRedacted(output, [email, repo]);
});

test('only exempts the exact canonical email placeholder', function (t) {
  const repo = makeRepo(t);
  const nearMiss = '[USER' + '@OTHER.COM]';
  writeFile(repo, 'near-miss.md', `${nearMiss}\n`);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.match(output, /File: near-miss\.md/);
  assertRedacted(output, [nearMiss, repo]);
});

test('allows canonical placeholders', function (t) {
  const repo = makeRepo(t);
  writeFile(repo, 'placeholders.md', [
    'Owner: [USER@DOMAIN.COM]',
    'Callback: [PHONE_NUMBER]',
    'Tenant: [@Aegion_DOMAIN]',
    'Ticket: [JIRA-###]',
    'Device: [DEVICE_NAME]',
    '',
  ].join('\n'));
  stageAll(repo);

  const result = runScanner(repo);
  assertExit(result, 0);
  assert.match(combinedOutput(result), /Clean/);
});

test('allows precise operational metadata email patterns', function (t) {
  const repo = makeRepo(t);
  writeFile(repo, 'metadata.md', [
    'remote = git@github.com:qFermions/Aegis.git',
    'automation = noreply@github.com',
    'example = user@example.org',
    '',
  ].join('\n'));
  stageAll(repo);

  const result = runScanner(repo);
  assertExit(result, 0);
  assert.match(combinedOutput(result), /Clean/);
});

test('blocks registered-looking domains that are not IANA example domains', function (t) {
  const repo = makeRepo(t);
  const first = ['admin', ['example-corp', 'org'].join('.')].join('@');
  const second = ['support', ['vendor-example', 'com'].join('.')].join('@');
  writeFile(repo, 'registered-domains.md', `first=${first}\nsecond=${second}\n`);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.match(output, /File: registered-domains\.md/);
  assert.match(output, /Real email address detected/);
  assertRedacted(output, [first, second, repo]);
});

test('blocks operational accounts, hosts, and privileged paths without printing them', function (t) {
  const repo = makeRepo(t);
  const privilegedPath = ['', 'root', 'War Room', 'dashboard.html'].join('/');
  const privilegedTarget = ['root', ['vps', 'company', 'test'].join('.')].join('@');
  const sshTarget = ['operator', ['internal', 'company', 'test'].join('.')].join('@');
  const content = [
    `artifact=${privilegedPath}`,
    `target=${privilegedTarget}`,
    `ssh ${sshTarget}`,
    '',
  ].join('\n');
  writeFile(repo, 'operations.md', content);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.match(output, /File: operations\.md/);
  assert.match(output, /Privileged remote filesystem path/);
  assert.match(output, /Privileged SSH account\/host example/);
  assert.match(output, /Literal SSH account\/host target/);
  assert.match(output, /Guidance:/);
  assertRedacted(output, [privilegedPath, privilegedTarget, sshTarget, content, repo]);
});

test('redacts a sensitive filename while retaining a deterministic file index', function (t) {
  const repo = makeRepo(t);
  const sensitiveName = `${['employee', 'company.test'].join('@')}.md`;
  const secret = syntheticSecret('F');
  writeFile(repo, sensitiveName, `credential=${secret}\n`);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.match(output, /File: \[REDACTED_FILE_PATH\] \(index 1\)/);
  assertRedacted(output, [sensitiveName, secret, repo]);
});

test('blocks a real phone number while keeping it and its source line redacted', function (t) {
  const repo = makeRepo(t);
  const phone = ['415', '555', '0199'].join('-');
  const sourceLine = `callback=${phone} confidential-phone-marker`;
  writeFile(repo, 'phone.md', `${sourceLine}\n`);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.match(output, /File: phone\.md/);
  assertRedacted(output, [phone, sourceLine, 'confidential-phone-marker', repo]);
});

test('distinguishes an empty staged set from a Git failure outside a repository', function (t) {
  const repo = makeRepo(t);
  const emptyResult = runScanner(repo);
  assertExit(emptyResult, 0);
  assert.match(combinedOutput(emptyResult), /No staged files/);

  const outsideRepo = makeTempDir(t, 'aegis-scanner-outside-');
  const failureResult = runScanner(outsideRepo);
  const failureOutput = combinedOutput(failureResult);
  assertExit(failureResult, 2);
  assert.match(failureOutput, /unable to enumerate staged files/);
  assertRedacted(failureOutput, [outsideRepo]);
});

test('fails closed with sanitized output when Git cannot be executed', function (t) {
  const repo = makeRepo(t);
  const emptyBin = makeTempDir(t, 'aegis-scanner-empty-bin-');
  const env = scannerEnvironment();
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === 'path') delete env[key];
  }
  env[process.platform === 'win32' ? 'Path' : 'PATH'] = emptyBin;

  const result = runScanner(repo, [], env);
  const output = combinedOutput(result);
  assertExit(result, 2);
  assert.match(output, /unable to enumerate staged files/);
  assertRedacted(output, [repo, emptyBin]);
});

test('--all scans tracked working-tree content that is not staged', function (t) {
  const repo = makeRepo(t);
  const secret = syntheticSecret('C');
  writeFile(repo, 'tracked.md', 'safe fixture\n');
  commitAll(repo);
  writeFile(repo, 'tracked.md', `credential=${secret} all-mode-marker\n`);

  const stagedResult = runScanner(repo);
  assertExit(stagedResult, 0);
  assert.match(combinedOutput(stagedResult), /No staged files/);

  const allResult = runScanner(repo, ['--all']);
  const output = combinedOutput(allResult);
  assertExit(allResult, 1);
  assert.match(output, /File: tracked\.md/);
  assertRedacted(output, [secret, 'all-mode-marker', repo]);
});

test('--all scans a non-ignored untracked repair file', function (t) {
  const repo = makeRepo(t);
  const secret = syntheticSecret('U');
  writeFile(repo, 'untracked-repair.md', `credential=${secret}\n`);

  const stagedResult = runScanner(repo);
  assertExit(stagedResult, 0);
  assert.match(combinedOutput(stagedResult), /No staged files/);

  const allResult = runScanner(repo, ['--all']);
  const output = combinedOutput(allResult);
  assertExit(allResult, 1);
  assert.match(output, /File: untracked-repair\.md/);
  assert.match(output, /GitHub token/);
  assertRedacted(output, [secret, repo]);
});

test('--all fails closed when a tracked text file cannot be read', function (t) {
  const repo = makeRepo(t);
  const fileName = 'missing-tracked.md';
  writeFile(repo, fileName, 'safe fixture\n');
  commitAll(repo);
  fs.unlinkSync(path.join(repo, fileName));

  const result = runScanner(repo, ['--all']);
  const output = combinedOutput(result);
  assertExit(result, 2);
  assert.match(output, /unable to read tracked file missing-tracked\.md/);
  assertRedacted(output, [repo]);
});

test('--all treats a readable empty tracked file as success', function (t) {
  const repo = makeRepo(t);
  writeFile(repo, 'empty.md', '');
  commitAll(repo);

  const result = runScanner(repo, ['--all']);
  assertExit(result, 0);
  assert.match(combinedOutput(result), /Clean/);
});

test('staged regular-to-symlink typechanges are scanned and cannot hide a secret', function (t) {
  const repo = makeRepo(t);
  const fileName = 'typechange.md';
  const secret = syntheticSecret('T');
  writeFile(repo, fileName, 'safe regular file\n');
  commitAll(repo);

  const blob = runGit(repo, ['hash-object', '-w', '--stdin'], `target-${secret}\n`).stdout.trim();
  runGit(repo, ['update-index', '--cacheinfo', `120000,${blob},${fileName}`]);
  const stagedStatus = runGit(repo, ['diff', '--cached', '--name-status']).stdout;
  assert.match(stagedStatus, /^T\s+typechange\.md/m);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.match(output, /File: typechange\.md/);
  assert.match(output, /GitHub token/);
  assertRedacted(output, [secret, repo]);
});

test('blocks configured tenant literals without printing the host or source line', function (t) {
  const repo = makeRepo(t);
  const host = ['tenant', 'internal', 'test'].join('.');
  const sourceLine = `endpoint=${host} tenant-source-marker`;
  writeFile(repo, 'tenant.md', `${sourceLine}\n`);
  stageAll(repo);

  const result = runScanner(repo, [], scannerEnvironment({ AEGION_DOMAIN: host }));
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.match(output, /Tenant\/org literal/);
  assert.match(output, /File: tenant\.md/);
  assertRedacted(output, [host, sourceLine, 'tenant-source-marker', repo]);
});

test('warning-only findings exit zero and keep the source line redacted', function (t) {
  const repo = makeRepo(t);
  const sourceMarker = 'warning-source-marker';
  const sourceLine = `Remove-Item target -Recurse -Force # ${sourceMarker}`;
  writeFile(repo, 'warning.ps1', `${sourceLine}\n`);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 0);
  assert.match(output, /warning\(s\) found/);
  assert.match(output, /File: warning\.ps1/);
  assertRedacted(output, [sourceLine, sourceMarker, repo]);
});

test('warns on high-impact operational sinks that the legacy matcher missed', function (t) {
  const repo = makeRepo(t);
  const cases = [
    ['Remove-Item -LiteralPath $queueFile -Force', /forced file deletion/],
    ['Clear-MgDeviceManagementManagedDevice -ManagedDeviceId $deviceId', /managed-device factory reset/],
    ['Invoke-MgRetireDeviceManagementManagedDevice -ManagedDeviceId $deviceId', /managed-device retire/],
    ['Delete-QuarantineMessage -Identity "[MESSAGE_IDENTITY_GUID]"', /quarantine message deletion/],
    ['Release-QuarantineMessage -Identity "[MESSAGE_IDENTITY_GUID]" -ReleaseToAll', /quarantine release to all recipients/],
    ['Release-QuarantineMessage -Identity "[MESSAGE_IDENTITY_GUID]" -User "[USER@DOMAIN.COM]"', /recipient-scoped quarantine release/],
    ['Remove-BlockedSenderAddress -SenderAddress "[USER@DOMAIN.COM]"', /restricted sender re-enable/],
    ['Remove-ADGroupMember -Identity $group -Members $user -Confirm:$false', /AD group access revocation/],
    ['Remove-PnPGroupMember -LoginName "[UPN]" -Group "[GROUP]"', /SharePoint access revocation/],
    ['Update-MgUser -UserId "[UPN]" -AccountEnabled:$false', /cloud sign-in block/],
    ['Update-MgUser -UserId "[UPN]" -PasswordProfile $profile', /cloud password reset/],
    ['Set-ADAccountPassword -Identity "[UPN]" -Reset -NewPassword $password', /on-premises password reset/],
    ['Invoke-MgInvalidateUserRefreshToken -UserId "[UPN]"', /refresh-token invalidation/],
    ['Set-MgUserLicense -UserId "[UPN]" -BodyParameter $change', /license assignment change/],
    ['New-ADUser -Name "[FIRST_NAME] [LAST_NAME]"', /directory account creation/],
    ['New-Mailbox -Shared -Name "[MAILBOX]"', /mailbox creation/],
    ['New-DistributionGroup -Name "[GROUP]"', /distribution group creation/],
    ['Add-MailboxPermission -Identity "[MAILBOX]" -User "[UPN]"', /mailbox permission grant/],
    ['Add-RecipientPermission -Identity "[MAILBOX]" -Trustee "[UPN]"', /Send As permission grant/],
    ['New-MgGroupMember -GroupId "[GROUP_ID]" -DirectoryObjectId "[USER_ID]"', /group membership grant/],
    ['Start-ADSyncSyncCycle -PolicyType Delta', /directory synchronization trigger/],
    ['Update-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId "[POLICY_ID]"', /Conditional Access policy mutation/],
    ['Set-SPOSite -Identity "https://[@Aegion_DOMAIN]" -LockState NoAccess', /SharePoint site mutation/],
    ['Grant-CsTeamsMeetingPolicy -Identity "[UPN]" -PolicyName "[POLICY_NAME]"', /Teams policy assignment/],
    ['New-MgDeviceManagementDeviceCompliancePolicyAssignment -DeviceCompliancePolicyId "[POLICY_ID]"', /compliance policy assignment/],
    ['Set-Mailbox -Identity "[MAILBOX]" -Type Shared', /mailbox conversion/],
    ['Install-Module Microsoft.Graph -Scope CurrentUser', /PowerShell module installation/],
    ['node scripts/jira-client.js create --summary "[SUMMARY]" --execute --confirm "[CONFIRMATION]"', /external Jira mutation\/read boundary/],
    ['node scripts/init-memory.js --execute --confirm "[CONFIRMATION]"', /local memory filesystem mutation/],
    ['node scripts/security-audit.js --write --confirm "[CONFIRMATION]"', /local report creation/],
    ['scp -- "[HERMES_SSH_USER]@[HERMES_HOST]:[HERMES_REMOTE_FILE]" $destination', /local or remote file transfer/],
    ['chmod +x .git/hooks/pre-commit', /repository-local executable change/],
    ['cp scripts/pre-commit-check.js.hook .git/hooks/pre-commit', /repository-local executable change/],
    ['install -m 0755 scripts/pre-commit-check.js.hook .git/hooks/pre-commit', /repository-local executable change/],
    ['mv pre-commit.reviewed .git/hooks/pre-commit', /repository-local executable change/],
    ['tee .git/hooks/pre-commit < pre-commit.reviewed', /repository-local executable change/],
    ['& $ssh @sshArgs $target $remoteCommand', /Dynamic SSH remote command invocation/],
    ['git commit --no-verify', /pre-commit gate bypass/],
  ];
  const fixtureLines = cases.map(([line], index) => `${line} # scanner-source-${index}`);
  writeFile(repo, 'missed-sinks.ps1', `${fixtureLines.join('\n')}\n`);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 0);
  for (const [, expectedLabel] of cases) assert.match(output, expectedLabel);
  assert.match(output, new RegExp(`${cases.length} warning\\(s\\) found`));
  assertRedacted(output, [...fixtureLines, ...fixtureLines.map((_, index) => `scanner-source-${index}`), repo]);
});

test('does not warn on output formatting cmdlets or Revoke-prefixed prose', function (t) {
  const repo = makeRepo(t);
  writeFile(repo, 'safe-formatting.md', [
    'Get-MgUser | Format-Table -AutoSize',
    'The Revoke-Examples heading describes a documentation category.',
    '',
  ].join('\n'));
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 0);
  assert.match(output, /Clean/);
  assert.doesNotMatch(output, /storage format|session or token revocation/);
});

test('classifies mailbox permission removal as access revocation, not mailbox deletion', function (t) {
  const repo = makeRepo(t);
  const sourceLine = 'Remove-MailboxPermission -Identity "[MAILBOX]" -User "[UPN]" -Confirm:$false';
  writeFile(repo, 'mailbox-permission.ps1', `${sourceLine}\n`);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 0);
  assert.match(output, /mailbox permission revocation/);
  assert.doesNotMatch(output, /permanent mailbox deletion/);
  assertRedacted(output, [sourceLine, repo]);
});

// Google / Okta / Jamf secret formats — every synthetic value is assembled at
// runtime from pieces so this test source never contains a matching literal.
function assertBlocksSyntheticCredential(t, fileName, secret, label) {
  const repo = makeRepo(t);
  const sourceMarker = `${path.parse(fileName).name}-source-marker`;
  const sourceLine = `${secret} ${sourceMarker}`;
  writeFile(repo, fileName, `${sourceLine}\n`);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  assert.match(output, new RegExp(`File: ${fileName.replace(/[.]/g, '\\.')}`));
  assert.equal(output.includes(label), true, `scanner output is missing the label: ${label}`);
  assert.match(output, /Guidance:/);
  assertRedacted(output, [secret, sourceLine, sourceMarker, repo]);
}

test('blocks a Google API key without printing the value or source line', function (t) {
  const secret = 'AIza' + 'A'.repeat(35);
  assertBlocksSyntheticCredential(t, 'google-api-key.md', secret, 'Google API key (AIza…)');
});

test('blocks a Google OAuth client secret without printing the value or source line', function (t) {
  const secret = 'GOCSPX-' + 'B'.repeat(24);
  assertBlocksSyntheticCredential(t, 'google-oauth-secret.md', secret, 'Google OAuth client secret (GOCSPX-…)');
});

test('every new secret-format BLOCK gets revoke-or-rotate guidance, not placeholder guidance', function (t) {
  const repo = makeRepo(t);
  const secrets = [
    'AIza' + 'C'.repeat(35),
    'GOCSPX-' + 'D'.repeat(24),
    ['SSWS', '00' + 'E'.repeat(40)].join(' '),
    ['Authorization:', 'Bearer', 'F'.repeat(32)].join(' '),
  ];
  writeFile(repo, 'rotate-guidance.md', secrets.map((secret, index) => `${secret} rotate-marker-${index}`).join('\n') + '\n');
  stageAll(repo);
  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 1);
  const guidance = output.split('\n').filter((line) => /Guidance:/.test(line));
  assert.ok(guidance.length >= secrets.length, 'one guidance line per finding');
  assert.deepEqual(guidance.filter((line) => !/revoke or rotate/.test(line)), [], 'a credential finding fell through to placeholder guidance');
  assertRedacted(output, [...secrets, repo]);
});

test('blocks a Google service-account key JSON type marker without printing the source line', function (t) {
  const secret = ['"type"', '"service_account"'].join(': ');
  assertBlocksSyntheticCredential(t, 'service-account-type.json', secret, 'Google service-account key JSON (type service_account)');
});

test('blocks a Google service-account key JSON private_key_id without printing the value', function (t) {
  const keyId = '0123456789abcdef'.repeat(2);
  const secret = ['"private_key_id"', `"${keyId}"`].join(': ');
  assertBlocksSyntheticCredential(t, 'service-account-key-id.json', secret, 'Google service-account key JSON (private_key_id)');
});

test('blocks an Okta SSWS API token header without printing the value or source line', function (t) {
  const secret = 'SSWS ' + 'C'.repeat(42);
  assertBlocksSyntheticCredential(t, 'okta-ssws-token.md', secret, 'Okta API token (SSWS header)');
});

test('blocks a bare Okta API token without printing the value or source line', function (t) {
  const secret = '00' + 'D'.repeat(40);
  assertBlocksSyntheticCredential(t, 'okta-bare-token.md', secret, 'Okta API token (bare 00… token)');
});

test('blocks a Bearer credential in an Authorization header without printing the value', function (t) {
  const secret = ['Authorization', 'Bearer ' + 'E'.repeat(32)].join(': ');
  assertBlocksSyntheticCredential(t, 'jamf-bearer-header.md', secret, 'Bearer/Basic credential in an Authorization header (Jamf Pro API and others)');
});

test('blocks a Basic credential in an Authorization header without printing the value', function (t) {
  const secret = ['Authorization', 'Basic ' + 'F'.repeat(28) + '=='].join(': ');
  assertBlocksSyntheticCredential(t, 'jamf-basic-header.md', secret, 'Bearer/Basic credential in an Authorization header (Jamf Pro API and others)');
});

test('allows Google, Okta, and Jamf placeholder forms', function (t) {
  const repo = makeRepo(t);
  writeFile(repo, 'google-okta-jamf-placeholders.md', [
    'SSWS ${OKTA_API_TOKEN}',
    'Authorization: Bearer ${JAMF_TOKEN}',
    'Authorization: Bearer [JAMF_API_TOKEN]',
    '"private_key_id": "[KEY_ID]"',
    '',
  ].join('\n'));
  stageAll(repo);

  const result = runScanner(repo);
  assertExit(result, 0);
  assert.match(combinedOutput(result), /Clean/);
});

test('rejects unknown arguments with deterministic exit 2', function (t) {
  const repo = makeRepo(t);
  const first = runScanner(repo, ['--unknown']);
  const second = runScanner(repo, ['--unknown']);
  assertExit(first, 2);
  assertExit(second, 2);
  assert.equal(combinedOutput(first), combinedOutput(second));
  assert.match(combinedOutput(first), /invalid arguments/);
});

test('warns on Google Workspace, Okta, Jamf and macOS destructive sinks (G1 lane)', function (t) {
  const repo = makeRepo(t);
  const cases = [
    ['gam delete user "[USER@DOMAIN.COM]"', /GAM user deletion/],
    ['gam suspend user "[USER@DOMAIN.COM]"', /GAM user suspension/],
    ['gam update user "[USER@DOMAIN.COM]" suspended on', /GAM user suspension/],
    ['gam create datatransfer "[USER@DOMAIN.COM]" drive "[MANAGER_UPN]" all', /GAM data transfer/],
    ['gam user "[USER@DOMAIN.COM]" transfer drive "[MANAGER_UPN]"', /GAM data transfer/],
    ['gam user "[USER@DOMAIN.COM]" turnoff2sv', /GAM 2-Step Verification turn-off/],
    ['gam user "[USER@DOMAIN.COM]" deprovision', /GAM deprovision/],
    ['gam update cros "[DEVICE_ID]" action deprovision_retiring_device', /GAM ChromeOS device action/],
    ['gam issuecommand cros "[DEVICE_ID]" command remote_powerwash doit', /GAM ChromeOS remote command/],
    ['gam user "[USER@DOMAIN.COM]" delete license "[LICENSE_TYPE]"', /GAM licence removal/],
    ['curl -sS -X POST "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/deactivate"', /Okta lifecycle change/],
    ['curl -sS -X DELETE "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/sessions"', /Okta session or user deletion/],
    ['curl -sS -X POST "https://[@Aegion_JAMF_URL]/api/v2/mdm/commands" --data @erase-device.json', /Jamf MDM command/],
    ['sudo /usr/local/bin/jamf removeFramework', /Jamf framework removal/],
    ['sudo profiles remove -identifier fixture.profile', /profiles removal/],
    ['sudo fdesetup disable', /FileVault change/],
    ['diskutil eraseDisk APFS Fixture disk9', /disk erase/],
  ];
  const fixtureLines = cases.map(([line], index) => `${line} # g1-scanner-source-${index}`);
  writeFile(repo, 'g1-sinks.md', `${fixtureLines.join('\n')}\n`);
  stageAll(repo);

  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 0);
  for (const [, expectedLabel] of cases) assert.match(output, expectedLabel);
  assert.match(output, new RegExp(`${cases.length} warning\\(s\\) found`));
  assertRedacted(output, [...fixtureLines, ...fixtureLines.map((_, index) => `g1-scanner-source-${index}`), repo]);
});

test('read-only Google, Okta, Jamf and macOS diagnostics do not warn', function (t) {
  const repo = makeRepo(t);
  writeFile(repo, 'g1-read-only.md', [
    'gam info user "[USER@DOMAIN.COM]"',
    'gam print users query "isSuspended=True"',
    'gam user "[USER@DOMAIN.COM]" print filecounts',
    'curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]"',
    'profiles show -type enrollment',
    'fdesetup status',
    'diskutil list',
    'sudo jamf recon',
    'curl -sS -H "Authorization: Bearer ${JAMF_TOKEN}" "https://[@Aegion_JAMF_URL]/api/v2/mdm/commands?filter=clientData.managementId==[DEVICE_ID]"',
    '',
  ].join('\n'));
  stageAll(repo);
  const result = runScanner(repo);
  assertExit(result, 0);
  assert.match(combinedOutput(result), /Clean/);
});

test('a Sources line citing GAM wiki page names does not warn; the command it names still does', function (t) {
  const repo = makeRepo(t);
  writeFile(repo, 'g1-sources.md', [
    '**Sources (checked 2026-10-15):** GAM syntax: raw.githubusercontent.com/wiki/GAM-team/GAM (Users and Users-Signout-Turnoff2SV pages)',
    'GAM syntax: raw.githubusercontent.com/wiki/GAM-team/GAM/Users-Deprovision.md',
    '',
  ].join('\n'));
  stageAll(repo);
  const clean = runScanner(repo);
  assertExit(clean, 0);
  assert.match(combinedOutput(clean), /Clean/);

  writeFile(repo, 'g1-sources.md', [
    'gam user "[USER@DOMAIN.COM]" turnoff2sv',
    'gam user "[USER@DOMAIN.COM]" deprovision',
    '',
  ].join('\n'));
  stageAll(repo);
  const warned = combinedOutput(runScanner(repo));
  assert.match(warned, /GAM 2-Step Verification turn-off/);
  assert.match(warned, /GAM deprovision/);
  assert.match(warned, /2 warning\(s\) found/);
});

// ── G2: Slack credential formats (documented by Slack) and the lane's dangerous sinks ──
// Fleet, Jamf Pro and Linear document no token format (docs/aegis/lanes/g2.md), so they
// add no BLOCK pattern; their bearer headers are already caught by the Authorization rule.
test('blocks a Slack refresh token (xoxe-) without printing the value or source line', function (t) {
  const secret = 'xoxe-' + '1-' + 'G'.repeat(40);
  assertBlocksSyntheticCredential(t, 'slack-refresh-token.md', secret, 'Slack refresh or app-level token (xoxe- / xapp-)');
});

test('blocks a Slack app-level token (xapp-) without printing the value or source line', function (t) {
  const secret = 'xapp-' + '1-' + 'H'.repeat(12) + '-' + '1234567890' + '-' + 'a'.repeat(32);
  assertBlocksSyntheticCredential(t, 'slack-app-level-token.md', secret, 'Slack refresh or app-level token (xoxe- / xapp-)');
});

test('blocks a rotating Slack access token (xoxe.xoxp-) through the existing Slack token rule', function (t) {
  const secret = 'xoxe.xoxp-' + '1-' + 'J'.repeat(40);
  assertBlocksSyntheticCredential(t, 'slack-rotating-token.md', secret, 'Slack token');
});

test('allows the Slack, Linear and Fleet placeholder forms the G2 runbooks use', function (t) {
  const repo = makeRepo(t);
  writeFile(repo, 'g2-placeholders.md', [
    'curl -sS "https://slack.com/api/users.info?user=[USER_ID]" -H "Authorization: Bearer ${SLACK_TOKEN}"',
    'curl -sS "https://[@Aegion_FLEET_URL]/api/v1/fleet/hosts/[HOST_ID]" -H "Authorization: Bearer ${FLEET_API_TOKEN}"',
    'export LINEAR_API_KEY="[LINEAR_API_KEY]"',
    '',
  ].join('\n'));
  stageAll(repo);
  const result = runScanner(repo);
  assertExit(result, 0);
  assert.match(combinedOutput(result), /Clean/);
});

test('warns on Fleet, Slack, Linear, Jamf and Google Workspace destructive sinks (G2 lane)', function (t) {
  const repo = makeRepo(t);
  const cases = [
    ['fleetctl mdm wipe --host [HOST_ID]', /Fleet MDM lock \/ unlock \/ wipe/],
    ['fleetctl mdm lock --host [HOST_ID]', /Fleet MDM lock \/ unlock \/ wipe/],
    ['fleetctl run-script --script-path ./fix.sh --host [HOST_ID]', /Fleet script run/],
    ['curl -sS -X POST "https://[@Aegion_FLEET_URL]/api/v1/fleet/hosts/[HOST_ID]/wipe" -H "Authorization: Bearer ${FLEET_API_TOKEN}"', /Fleet host lock, unlock or wipe \(REST\)/],
    ['curl -sS -X POST "https://[@Aegion_FLEET_URL]/api/v1/fleet/scripts/run" --json @run.json', /Fleet script run/],
    ['curl -sS -X DELETE "https://[@Aegion_FLEET_URL]/api/v1/fleet/hosts/[HOST_ID]"', /Fleet host deletion or MDM turn-off/],
    ['curl -sS -X POST "https://slack.com/api/admin.users.remove" -d "user_id=[USER_ID]"', /Slack admin write/],
    ['curl -sS -X POST "https://slack.com/api/admin.users.session.reset" -d "user_id=[USER_ID]"', /Slack admin write/],
    ['curl -sS -X POST "https://slack.com/api/chat.postMessage" -d "channel=[CHANNEL_ID]"', /Slack message post or delete/],
    ['curl -sS -X DELETE "https://api.slack.com/scim/v2/Users/[USER_ID]"', /Slack SCIM deactivation/],
    ['curl -sS -X POST "https://api.linear.app/graphql" --json \'{"query":"mutation { issueDelete(id: \\"[ISSUE_ID]\\") { success } }"}\'', /Linear GraphQL mutation/],
    ['curl -sS -H "Authorization: Bearer ${JAMF_TOKEN}" "https://[@Aegion_JAMF_URL]/api/v1/computers-inventory/[DEVICE_ID]/filevault"', /Jamf secret disclosure/],
    ['gam user "[USER@DOMAIN.COM]" delete drivefileacl "[FILE_NAME]" "[EXTERNAL_DOMAIN]"', /GAM Drive permission removal/],
    ['gam delete admin "[ROLE_NAME]"', /GAM admin-role change/],
    ['gam create admin "[USER@DOMAIN.COM]" "[ROLE_NAME]" customer', /GAM admin-role change/],
  ];
  const fixtureLines = cases.map(([line], index) => `${line} # g2-scanner-source-${index}`);
  writeFile(repo, 'g2-sinks.md', `${fixtureLines.join('\n')}\n`);
  stageAll(repo);
  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 0);
  for (const [, expectedLabel] of cases) assert.match(output, expectedLabel);
  assert.match(output, new RegExp(`${cases.length} warning\\(s\\) found`));
  assertRedacted(output, [...fixtureLines, ...fixtureLines.map((_, index) => `g2-scanner-source-${index}`), repo]);
});

test('Fleet host and Slack SCIM deletions warn when curl names the method with --request (G2 lane)', function (t) {
  const repo = makeRepo(t);
  const cases = [
    ['curl -sS --request DELETE "https://[@Aegion_FLEET_URL]/api/v1/fleet/hosts/[HOST_ID]"', /Fleet host deletion or MDM turn-off/],
    ['curl -sS "https://[@Aegion_FLEET_URL]/api/v1/fleet/hosts/[HOST_ID]/mdm" --request "DELETE"', /Fleet host deletion or MDM turn-off/],
    ['curl -sS --request DELETE "https://api.slack.com/scim/v2/Users/[USER_ID]"', /Slack SCIM deactivation/],
    ['curl -sS "https://api.slack.com/scim/v2/Users/[USER_ID]" --request \'DELETE\'', /Slack SCIM deactivation/],
  ];
  const fixtureLines = cases.map(([line], index) => `${line} # g2-request-source-${index}`);
  writeFile(repo, 'g2-request.md', `${fixtureLines.join('\n')}\n`);
  stageAll(repo);
  const result = runScanner(repo);
  const output = combinedOutput(result);
  assertExit(result, 0);
  for (const [, expectedLabel] of cases) assert.match(output, expectedLabel);
  assert.match(output, new RegExp(`${cases.length} warning\\(s\\) found`));
  assertRedacted(output, [...fixtureLines, ...fixtureLines.map((_, index) => `g2-request-source-${index}`), repo]);
});

test('read-only Fleet, Slack, Linear, Jamf and Google Workspace diagnostics do not warn (G2 lane)', function (t) {
  const repo = makeRepo(t);
  writeFile(repo, 'g2-read-only.md', [
    'fleetctl get hosts --json',
    'curl -sS "https://[@Aegion_FLEET_URL]/api/v1/fleet/hosts/[HOST_ID]/mdm"',
    'curl -sS "https://slack.com/api/users.info?user=[USER_ID]"',
    'node scripts/adapters/linear-client.js verify-comment --issue [ISSUE_ID] --expect-sha256 [NOTE_SHA256] --execute',
    'curl -sS "https://[@Aegion_JAMF_URL]/api/v1/computers-inventory?section=DISK_ENCRYPTION"',
    'gam print admins',
    'gam user "[USER@DOMAIN.COM]" print drivefileacls "[FILE_NAME]"',
    '',
  ].join('\n'));
  stageAll(repo);
  const result = runScanner(repo);
  assertExit(result, 0);
  assert.match(combinedOutput(result), /Clean/);
});
