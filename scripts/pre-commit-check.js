#!/usr/bin/env node
/**
 * pre-commit-check.js
 * Scans staged files before a git commit for:
 *   1. Dangerous PowerShell cmdlets in .ps1 files
 *   2. PII patterns (real email addresses, phone numbers)
 *   3. Hardcoded credential patterns
 *   4. Modern secret formats (GitHub PATs, JWTs, private keys, Azure/Slack/API tokens)
 *   5. Tenant literals (SR-8) — loaded at runtime from AEGION_* env vars and the
 *      gitignored replacements.txt; the real values never appear in this file
 *   6. Prompt-injection markers in non-security-doc files
 *
 * Called automatically by .git/hooks/pre-commit
 * Can also run manually: node scripts/pre-commit-check.js
 * Full-tree mode (CI release gate): node scripts/pre-commit-check.js --all
 *   — scans every tracked and non-ignored untracked file in the working tree
 *     instead of the staged set
 *
 * Exit 0 = clean or warnings only
 * Exit 1 = blocking findings detected
 * Exit 2 = scanner/runtime failure (fail closed)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EXIT_OK = 0;
const EXIT_FINDINGS = 1;
const EXIT_ERROR = 2;
const MAX_GIT_BUFFER = 64 * 1024 * 1024;

class ScannerError extends Error {
  constructor(publicMessage) {
    super(publicMessage);
    this.name = 'ScannerError';
    this.publicMessage = publicMessage;
  }
}

// ── Dangerous PowerShell patterns ────────────────────────────────────────────
const DANGEROUS_PS_PATTERNS = [
  { pattern: /Remove-Item\s+.*-Recurse\s+.*-Force|Remove-Item\s+.*-Force\s+.*-Recurse/i, label: 'Remove-Item -Recurse -Force — mass file deletion' },
  { pattern: /Remove-Item\b(?![^\r\n]*-Recurse)(?=[^\r\n]*-Force)/i, label: 'Remove-Item -Force — forced file deletion' },
  { pattern: /Remove-Mg\w+/i,                  label: 'Remove-Mg* — Graph API deletion cmdlet' },
  { pattern: /\bRemove-MailboxPermission\b/i,   label: 'Remove-MailboxPermission — mailbox permission revocation' },
  { pattern: /\bRemove-Mailbox\b/i,             label: 'Remove-Mailbox — permanent mailbox deletion' },
  { pattern: /\bClear-MgDeviceManagementManagedDevice\b/i, label: 'Clear-MgDeviceManagementManagedDevice — managed-device factory reset' },
  { pattern: /\bInvoke-MgRetireDeviceManagementManagedDevice\b/i, label: 'Invoke-MgRetireDeviceManagementManagedDevice — managed-device retire' },
  { pattern: /\bDelete-QuarantineMessage\b/i,   label: 'Delete-QuarantineMessage — quarantine message deletion' },
  { pattern: /\bRelease-QuarantineMessage\b[^\r\n]*-ReleaseToAll\b/i, label: 'Release-QuarantineMessage -ReleaseToAll — quarantine release to all recipients' },
  { pattern: /\bRelease-QuarantineMessage\b(?![^\r\n]*-ReleaseToAll\b)/i, label: 'Release-QuarantineMessage — recipient-scoped quarantine release' },
  { pattern: /\bRemove-BlockedSenderAddress\b/i, label: 'Remove-BlockedSenderAddress — restricted sender re-enable' },
  { pattern: /\bRemove-ADGroupMember\b/i,       label: 'Remove-ADGroupMember — AD group access revocation' },
  { pattern: /\bRemove-PnPGroupMember\b/i,      label: 'Remove-PnPGroupMember — SharePoint access revocation' },
  { pattern: /\bUpdate-MgUser\b[^\r\n]*-AccountEnabled\s*:\s*\$false/i, label: 'Update-MgUser AccountEnabled false — cloud sign-in block' },
  { pattern: /\bUpdate-MgUser\b[^\r\n]*-PasswordProfile\b/i, label: 'Update-MgUser -PasswordProfile — cloud password reset' },
  { pattern: /\bSet-ADAccountPassword\b[^\r\n]*-Reset\b/i, label: 'Set-ADAccountPassword -Reset — on-premises password reset' },
  { pattern: /\bInvoke-MgInvalidateUserRefreshToken\b/i, label: 'Invoke-MgInvalidateUserRefreshToken — refresh-token invalidation' },
  { pattern: /\bSet-MgUserLicense\b/i,          label: 'Set-MgUserLicense — license assignment change' },
  { pattern: /\bNew-ADUser\b/i,                 label: 'New-ADUser — directory account creation' },
  { pattern: /\bNew-Mailbox\b/i,                label: 'New-Mailbox — mailbox creation' },
  { pattern: /\bNew-DistributionGroup\b/i,      label: 'New-DistributionGroup — distribution group creation' },
  { pattern: /\bAdd-MailboxPermission\b/i,      label: 'Add-MailboxPermission — mailbox permission grant' },
  { pattern: /\bAdd-RecipientPermission\b/i,    label: 'Add-RecipientPermission — Send As permission grant' },
  { pattern: /\bNew-MgGroupMember\b/i,          label: 'New-MgGroupMember — group membership grant' },
  { pattern: /\bStart-ADSyncSyncCycle\b/i,      label: 'Start-ADSyncSyncCycle — directory synchronization trigger' },
  { pattern: /\b(?:New|Update)-MgIdentityConditionalAccessPolicy\b/i, label: 'Conditional Access policy mutation' },
  { pattern: /\bSet-SPOSite\b/i,                label: 'Set-SPOSite — SharePoint site mutation' },
  { pattern: /\bGrant-CsTeams\w*Policy\b/i,    label: 'Grant-CsTeams*Policy — Teams policy assignment' },
  { pattern: /\bNew-MgDeviceManagementDeviceCompliancePolicyAssignment\b/i, label: 'New-MgDeviceManagementDeviceCompliancePolicyAssignment — compliance policy assignment' },
  { pattern: /\bSet-Mailbox\b[^\r\n]*-Type\s+Shared\b/i, label: 'Set-Mailbox -Type Shared — mailbox conversion' },
  { pattern: /\bInstall-Module\b/i,             label: 'Install-Module — PowerShell module installation' },
  { pattern: /\bFormat-(?:Volume|Drive)\b/i,    label: 'Format-Volume/Drive — destructive storage format' },
  { pattern: /Clear-Mailbox/i,                  label: 'Clear-Mailbox — wipes mailbox contents' },
  { pattern: /Clear-MobileDevice/i,             label: 'Clear-MobileDevice — remote device wipe' },
  { pattern: /Disable-Mg\w+|Disable-ADAccount/i,label: 'Disable-* — account/object disable' },
  { pattern: /\bRevoke-(?:Mg|AzureAD|SPO|PnP|Cs)[A-Za-z0-9]+\b/i, label: 'Revoke-* session/token cmdlet — session or token revocation' },
  { pattern: /BlockCredential\s*\$true/i,        label: 'BlockCredential $true — blocks user sign-in' },
  { pattern: /Invoke-Expression|[^a-z]IEX[^a-z]/i, label: 'Invoke-Expression / IEX — arbitrary code execution' },
  { pattern: /Start-Process\s+.*-FilePath/i,    label: 'Start-Process -FilePath — arbitrary process launch' },
  { pattern: /ConvertTo-SecureString.*-AsPlainText.*-Force/i, label: 'ConvertTo-SecureString -AsPlainText — plaintext credential in script' },
  { pattern: /git\s+push\s+.*--force|git\s+push\s+-f\b/i, label: 'git push --force — can overwrite remote history' },
  { pattern: /git\s+reset\s+--hard/i,           label: 'git reset --hard — destroys uncommitted work' },
  { pattern: /git\s+commit\b[^\r\n]*--no-verify\b/i, label: 'git commit --no-verify — pre-commit gate bypass' },
  { pattern: /\bnode\s+scripts[\\/]jira-client\.js\b[^\r\n]*\s--execute\b/i, label: 'jira-client --execute — external Jira mutation/read boundary' },
  { pattern: /\bnode\s+scripts[\\/]init-memory\.js\b[^\r\n]*\s--execute\b/i, label: 'init-memory --execute — local memory filesystem mutation' },
  { pattern: /\bnode\s+scripts[\\/]security-audit\.js\b[^\r\n]*\s--write\b/i, label: 'security-audit --write — local report creation' },
  { pattern: /\b(?:scp|sftp)\b/i,               label: 'scp/sftp — local or remote file transfer' },
  { pattern: /(?:\b(?:chmod|cp|install|mv|tee)\b|\bCopy-Item\b|\bSet-Content\b|>)[^\r\n]*\.git[\\/]hooks[\\/]/i, label: 'Git hook installation — repository-local executable change' },
  { pattern: /(?:^|[;|&]\s*)&?\s*\$ssh\b[^\r\n]*\$remoteCommand\b/i, label: 'Dynamic SSH remote command invocation' },
  // Google Workspace / Okta / Jamf / macOS sinks (G1) — order matters: one WARN per line
  { pattern: /\bgam\s+issuecommand\b/i,           label: 'GAM ChromeOS remote command (powerwash / wipe users)' },
  { pattern: /\bgam\b[^\r\n]*\bcros\b[^\r\n]*\baction\b/i, label: 'GAM ChromeOS device action (disable / deprovision)' },
  { pattern: /\bgam\s+(?:delete|del)\s+users?\b/i, label: 'GAM user deletion' },
  { pattern: /\bgam\s+suspend\s+users?\b|\bgam\s+update\s+users?\b[^\r\n]*\bsuspended\s+(?:on|true)\b/i, label: 'GAM user suspension' },
  { pattern: /\bgam\b[^\r\n]*\b(?:create|add)\s+(?:datatransfer|transfer)\b|\bgam\b[^\r\n]*\btransfer\s+drive\b/i, label: 'GAM data transfer (Drive / Calendar ownership)' },
  { pattern: /\bgam\b[^\r\n]*\bturnoff2sv\b/i,     label: 'GAM 2-Step Verification turn-off' },
  { pattern: /\bgam\b[^\r\n]*\bdeprovision\b/i,    label: 'GAM deprovision (tokens, app passwords, backup codes)' },
  { pattern: /\bgam\b[^\r\n]*\b(?:delete|remove)\s+licen[cs]es?\b/i, label: 'GAM licence removal' },
  { pattern: /\/api\/v1\/users\/[^\s"']+\/lifecycle\/(?:deactivate|suspend|reset_factors|reset_password|expire_password)\b/i, label: 'Okta lifecycle change (deactivate / suspend / reset)' },
  { pattern: /-X\s*["']?DELETE\b[^\r\n]*\/api\/v1\/users\b|\/api\/v1\/users\b[^\r\n]*-X\s*["']?DELETE\b/i, label: 'Okta session or user deletion (DELETE /api/v1/users…)' },
  { pattern: /\/api\/v[12]\/mdm\/commands\b|\/JSSResource\/computercommands\b/i, label: 'Jamf MDM command (lock / wipe)' },
  { pattern: /\bjamf\s+removeFramework\b/i,        label: 'Jamf framework removal (unmanage)' },
  { pattern: /\bprofiles\s+(?:remove\b|-R\b|-D\b)/, label: 'profiles removal (configuration / MDM profile)' },
  { pattern: /\bfdesetup\s+(?:disable|remove|changerecovery|removerecovery)\b/i, label: 'FileVault change (fdesetup)' },
  { pattern: /\bdiskutil\s+(?:erase\w*|secureErase|zeroDisk|apfs\s+delete\w*)\b/i, label: 'disk erase (diskutil)' },
];

// ── PII patterns ──────────────────────────────────────────────────────────────
// Mask only exact canonical placeholders; bracketed metadata never exempts a line.
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,63}\b/gi;
const PHONE_PATTERN = /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/;
const CANONICAL_PII_PLACEHOLDERS = ['[USER@DOMAIN.COM]', '[PHONE_NUMBER]'];
const ALLOWED_EMAILS = new Set(['git@github.com', 'noreply@github.com']);
const ALLOWED_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
]);
const SSH_COMMAND_WORDS = ['ss' + 'h', 'sc' + 'p'].join('|');
const SSH_ACCOUNT_TARGET_PATTERN = new RegExp(
  `\\b(?:${SSH_COMMAND_WORDS})\\b[^\\r\\n]*\\b(?!git@github\\.com\\b)[A-Za-z_][A-Za-z0-9_-]*@[A-Za-z0-9][A-Za-z0-9.-]*\\b`,
  'i',
);

// Current-tip public releases must use the existing [HERMES_*] and project-path
// placeholders instead of realistic privileged accounts, hosts, or Unix homes.
const OPERATIONAL_METADATA_PATTERNS = [
  {
    pattern: /\/root\//i,
    label: 'Privileged remote filesystem path',
    guidance: 'Replace it with the appropriate [HERMES_*] remote-path placeholder.',
  },
  {
    pattern: /\broot@[A-Za-z0-9][A-Za-z0-9.-]*\b/i,
    label: 'Privileged SSH account/host example',
    guidance: 'Replace it with [HERMES_SSH_USER]@[HERMES_HOST].',
  },
  {
    pattern: SSH_ACCOUNT_TARGET_PATTERN,
    label: 'Literal SSH account/host target',
    guidance: 'Replace the account and host with canonical operational placeholders.',
  },
];

// ── Credential patterns ───────────────────────────────────────────────────────
const CREDENTIAL_PATTERNS = [
  { pattern: /\$\w*(password|secret|token|key|cred)\w*\s*=\s*["'][^"']{4,}["']/i, label: 'Hardcoded credential variable' },
  { pattern: /BOT_TOKEN\s*=\s*["'][0-9]+:[A-Za-z0-9_-]{35}["']/,                  label: 'Hardcoded Telegram bot token' },
  { pattern: /\b[A-Za-z0-9]{32,}:[A-Za-z0-9_-]{27}\b/,                            label: 'Possible API token pattern' },
  // Modern secret formats — exact prefixes, low false-positive rate (all BLOCK)
  { pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,                                    label: 'GitHub token (ghp_/gho_/ghu_/ghs_/ghr_)' },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,                                  label: 'GitHub fine-grained PAT' },
  { pattern: /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\b/, label: 'JWT (signed three-part token)' },
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,                                label: 'Private key block' },
  { pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/,                                         label: 'API secret key (sk-…)' },
  { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,                                  label: 'Slack token' },
  { pattern: /AccountKey=[A-Za-z0-9+/=]{40,}/,                                    label: 'Azure storage account key' },
  { pattern: /SharedAccessSignature\s*=/i,                                        label: 'Azure SAS token assignment' },
  // Google / Okta / Jamf secret formats — exact prefixes or line-level markers
  // (all BLOCK). Placeholder forms (${VAR}, [TOKEN]) never match: the token
  // classes exclude `$`, `{`, `[`, and the key-id marker requires hex.
  { pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,                                         label: 'Google API key (AIza…)' },
  { pattern: /\bGOCSPX-[A-Za-z0-9_-]{20,}/,                                       label: 'Google OAuth client secret (GOCSPX-…)' },
  { pattern: /"type"\s*:\s*"service_account"/,                                    label: 'Google service-account key JSON (type service_account)' },
  { pattern: /"private_key_id"\s*:\s*"[0-9a-f]{16,}"/,                            label: 'Google service-account key JSON (private_key_id)' },
  { pattern: /\bSSWS\s+[A-Za-z0-9_-]{40,}/,                                       label: 'Okta API token (SSWS header)' },
  { pattern: /\b00[A-Za-z0-9_-]{40}\b/,                                           label: 'Okta API token (bare 00… token)' },
  { pattern: /Authorization\s*:\s*(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{20,}/i,   label: 'Bearer/Basic credential in an Authorization header (Jamf Pro API and others)' },
];

// ── Tenant literals (SR-8) ────────────────────────────────────────────────────
// The real org values are NEVER written in this file. They are loaded at runtime
// from AEGION_* env vars and/or the gitignored replacements.txt (one literal per
// line). If neither exists, the check is skipped and a notice is printed.
function loadTenantLiterals() {
  const literals = [];
  for (const v of ['AEGION_DOMAIN', 'AEGION_ORG_NAME']) {
    if (process.env[v]) literals.push(process.env[v]);
  }
  const repFile = path.join(__dirname, '..', 'replacements.txt');
  try {
    fs.readFileSync(repFile, 'utf8').split(/\r?\n/)
      .forEach(function (l) { literals.push(l); });
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw new ScannerError('unable to load tenant-literal configuration.');
    }
  }
  return Array.from(new Set(literals
    .map(function (l) { return l.trim().toLowerCase(); })
    .filter(Boolean)));
}

// ── Prompt-injection markers ──────────────────────────────────────────────────
// Flags injected-instruction text that landed in a staged file (e.g. a saved
// ticket export). WARN only — security docs that DOCUMENT these patterns are
// excluded via isSecurityDoc below.
const INJECTION_MARKERS = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,          label: 'Prompt-injection marker (ignore-previous-instructions)' },
  { pattern: /disregard\s+(your|all|previous)\s+(rules|instructions|guidelines)/i, label: 'Prompt-injection marker (disregard-rules)' },
  { pattern: /\bnew\s+system\s+prompt\b/i,                                        label: 'Prompt-injection marker (system-prompt override)' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStagedFiles() {
  return parseNulList(runGit(
    ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMRT', '--'],
    'unable to enumerate staged files.',
  ));
}

function getStagedContent(filePath, displayPath) {
  return runGit(
    ['cat-file', 'blob', `:${filePath}`],
    `unable to read staged file ${displayPath}.`,
  );
}

// --all mode (CI release gate): every tracked and non-ignored untracked file,
// read from the working tree. This includes a newly created repair file before
// it is staged, so a reviewable local diff receives the same scan as a commit.
function getAllWorkingTreeFiles() {
  return parseNulList(runGit(
    ['ls-files', '-co', '--exclude-standard', '-z', '--'],
    'unable to enumerate working-tree files.',
  ));
}

function getWorkingTreeContent(filePath, displayPath) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      return Buffer.from(fs.readlinkSync(filePath, 'utf8'), 'utf8');
    }
    if (!stat.isFile()) {
      throw new Error('not a regular file');
    }
    return fs.readFileSync(filePath);
  } catch {
    throw new ScannerError(`unable to read tracked file ${displayPath}.`);
  }
}

function runGit(args, publicMessage) {
  try {
    return execFileSync('git', args, {
      encoding: null,
      maxBuffer: MAX_GIT_BUFFER,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch {
    throw new ScannerError(publicMessage);
  }
}

function parseNulList(output) {
  if (output.length === 0) return [];
  const parts = output.toString('utf8').split('\0');
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

function maskCanonicalPiiPlaceholders(line) {
  let masked = line;
  for (const placeholder of CANONICAL_PII_PLACEHOLDERS) {
    masked = masked.split(placeholder).join('');
  }
  return masked;
}

function isAllowedOperationalEmail(email) {
  const lower = email.toLowerCase();
  if (ALLOWED_EMAILS.has(lower)) return true;
  const at = lower.lastIndexOf('@');
  return at !== -1 && ALLOWED_EMAIL_DOMAINS.has(lower.slice(at + 1));
}

function hasUnsafeEmail(line) {
  const matches = maskCanonicalPiiPlaceholders(line).match(EMAIL_PATTERN) || [];
  return matches.some(function (email) { return !isAllowedOperationalEmail(email); });
}

function containsOperationalMetadata(value) {
  return OPERATIONAL_METADATA_PATTERNS.some(function ({ pattern }) { return pattern.test(value); });
}

function safeDisplayPath(filePath, tenantLiterals) {
  const lower = filePath.toLowerCase();
  const sensitive = /[\x00-\x1f\x7f]/.test(filePath)
    || hasUnsafeEmail(filePath)
    || PHONE_PATTERN.test(filePath)
    || CREDENTIAL_PATTERNS.some(function ({ pattern }) { return pattern.test(filePath); })
    || tenantLiterals.some(function (literal) { return lower.includes(literal); })
    || containsOperationalMetadata(filePath);
  return sensitive ? '[REDACTED_FILE_PATH]' : filePath;
}

function remediationGuidance(issue) {
  if (issue.guidance) return issue.guidance;
  if (issue.severity === 'WARN') {
    return 'Review the operation, add the required warning/confirmation gate, and keep it only if intentional.';
  }
  if (/credential|token|key|secret|JWT|SAS/i.test(issue.label)) {
    return 'Remove the value. If it is live, revoke or rotate it before any history cleanup.';
  }
  return 'Replace the value with the canonical placeholder for this data category.';
}

function decodeTextContent(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
  if (buffer.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

function checkFile(filePath, content, tenantLiterals) {
  const issues = [];
  const ext = path.extname(filePath).toLowerCase();
  const text = decodeTextContent(content);
  if (text === null) {
    return [{
      severity: 'BLOCK',
      line: 'n/a',
      label: 'Binary, NUL-containing, or invalid UTF-8 content',
      guidance: 'Public release files must be strict UTF-8 text; remove or explicitly review and redesign this artifact.',
    }];
  }
  const lines = text.split('\n');

  // Operational safety scan — .ps1 files and .md files (generated commands in
  // markdown). Pure reference surfaces are excluded; executable command docs
  // remain covered and require the separate structural gate tests.
  const isDocFile = /CLAUDE\.md$|CLAUDE\.md\.\w+$|lessons.*\.md$|README\.md$/i.test(filePath);
  if ((ext === '.ps1' || ext === '.md') && !isDocFile) {
    lines.forEach((line, i) => {
      for (const { pattern, label } of DANGEROUS_PS_PATTERNS) {
        if (pattern.test(line)) {
          issues.push({ severity: 'WARN', line: i + 1, label });
          break;
        }
      }
    });
  }

  // PII scan — all text files except archive/binary and backup docs
  {
    lines.forEach((line, i) => {
      const masked = maskCanonicalPiiPlaceholders(line);
      if (hasUnsafeEmail(line)) {
        issues.push({ severity: 'BLOCK', line: i + 1, label: 'Real email address detected (use [USER@DOMAIN.COM] placeholder)' });
      }
      if (PHONE_PATTERN.test(masked)) {
        issues.push({ severity: 'BLOCK', line: i + 1, label: 'Phone number pattern (use [PHONE_NUMBER] placeholder)' });
      }
    });
  }

  // Credential scan — all text files
  {
    lines.forEach((line, i) => {
      for (const { pattern, label } of CREDENTIAL_PATTERNS) {
        if (pattern.test(line)) {
          issues.push({ severity: 'BLOCK', line: i + 1, label });
        }
      }
    });
  }

  // Operational reconnaissance scan — public examples must never contain
  // privileged remote accounts, literal SSH targets, or privileged paths.
  {
    lines.forEach((line, i) => {
      for (const { pattern, label, guidance } of OPERATIONAL_METADATA_PATTERNS) {
        if (pattern.test(line)) {
          issues.push({ severity: 'BLOCK', line: i + 1, label, guidance });
          break;
        }
      }
    });
  }

  // Tenant-literal scan (SR-8) — every text file, NO placeholder-line exemption.
  // A literal inside a bracketed line is still a literal; nothing skips this check.
  if (tenantLiterals.length > 0) {
    lines.forEach((line, i) => {
      const lower = line.toLowerCase();
      for (const literal of tenantLiterals) {
        if (lower.includes(literal)) {
          issues.push({ severity: 'BLOCK', line: i + 1, label: 'Tenant/org literal (SR-8) — use the [@Aegion_*] token' });
          break;
        }
      }
    });
  }

  // Prompt-injection marker scan — WARN; security docs that document the
  // patterns as reference material are excluded.
  const isSecurityDoc = /threat_detection\.md$|threat_model\.md$|security_model\.md$|pre-commit-check\.js$/i.test(filePath);
  if (!isDocFile && !isSecurityDoc) {
    lines.forEach((line, i) => {
      for (const { pattern, label } of INJECTION_MARKERS) {
        if (pattern.test(line)) {
          issues.push({ severity: 'WARN', line: i + 1, label });
        }
      }
    });
  }

  return issues;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(args) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--all')) {
    throw new ScannerError('invalid arguments; supported option: --all.');
  }

  const scanAll = args[0] === '--all';
  const tenantLiterals = loadTenantLiterals();
  const files = scanAll ? getAllWorkingTreeFiles() : getStagedFiles();

  if (files.length === 0) {
    console.log(scanAll ? 'pre-commit-check: No tracked or non-ignored files found. Skipping.' : 'pre-commit-check: No staged files. Skipping.');
    return EXIT_OK;
  }

  if (scanAll) {
    console.log(`pre-commit-check: --all mode — scanning ${files.length} tracked and non-ignored files.`);
  }

  if (tenantLiterals.length === 0) {
    console.log('pre-commit-check: ℹ tenant-literal check skipped — configure tenant literals to enable.');
  }

  let totalWarnings = 0;
  let totalBlocks = 0;
  const report = [];

  for (let index = 0; index < files.length; index++) {
    const filePath = files[index];
    const fileNumber = index + 1;
    const displayPath = safeDisplayPath(filePath, tenantLiterals);
    const content = scanAll
      ? getWorkingTreeContent(filePath, displayPath)
      : getStagedContent(filePath, displayPath);

    const issues = checkFile(filePath, content, tenantLiterals);
    if (issues.length === 0) continue;

    const indexSuffix = displayPath === '[REDACTED_FILE_PATH]' ? ` (index ${fileNumber})` : '';
    report.push(`\n  File: ${displayPath}${indexSuffix}`);
    for (const issue of issues) {
      const icon = issue.severity === 'BLOCK' ? '🔴 BLOCK' : '⚠️  WARN';
      report.push(`    ${icon}  Line ${issue.line}: ${issue.label}`);
      report.push(`      Guidance: ${remediationGuidance(issue)}`);
      if (issue.severity === 'BLOCK') totalBlocks++;
      else totalWarnings++;
    }
  }

  if (report.length === 0) {
    console.log('pre-commit-check: ✓ Clean — no issues found.');
    return EXIT_OK;
  }

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  Aegis Pre-Commit Safety Check               ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(report.join('\n'));
  console.log('');

  if (totalBlocks > 0) {
    console.log(`🔴 COMMIT BLOCKED — ${totalBlocks} critical issue(s) found.`);
    console.log('   Fix the issues above, then re-stage and commit.');
    console.log('');
    return EXIT_FINDINGS;
  }

  if (totalWarnings > 0) {
    console.log(`⚠️  ${totalWarnings} warning(s) found — review the flagged lines above.`);
    console.log('   These are dangerous cmdlets in scripts. Confirm they are intentional.');
    console.log('   Commit will proceed. Add a ⚠️ comment in the script to acknowledge.');
    console.log('');
    return EXIT_OK;
  }

  return EXIT_OK;
}

if (require.main === module) {
  try {
  process.exitCode = main(process.argv.slice(2));
  } catch (error) {
  const message = error instanceof ScannerError
    ? error.publicMessage
    : 'unexpected scanner failure.';
  console.error(`pre-commit-check: ERROR — ${message}`);
    process.exitCode = EXIT_ERROR;
  }
}

module.exports = { decodeTextContent, safeDisplayPath };
