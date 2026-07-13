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
  assert.match(source, /\['ls-files', '-z', '--'\]/);
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

test('rejects unknown arguments with deterministic exit 2', function (t) {
  const repo = makeRepo(t);
  const first = runScanner(repo, ['--unknown']);
  const second = runScanner(repo, ['--unknown']);
  assertExit(first, 2);
  assertExit(second, 2);
  assert.equal(combinedOutput(first), combinedOutput(second));
  assert.match(combinedOutput(first), /invalid arguments/);
});
