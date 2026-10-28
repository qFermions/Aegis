#!/usr/bin/env node
/**
 * security-audit.js
 * Computes a structured security audit report for an M365 tenant.
 * Default behavior is read-only; writing requires --write plus the exact
 * target/content-SHA256 confirmation printed by the preview.
 * Preview with: node scripts/security-audit.js
 * No npm install needed — uses only built-in Node.js modules.
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const TENANT   = process.env.TENANT   || '[@Aegion_DOMAIN]';
const AUDITOR  = process.env.AUDITOR  || '[AUDITOR_NAME]';
const TODAY    = new Date().toISOString().split('T')[0];

// ── Audit sections ─────────────────────────────────────────────────────────
const sections = [

  {
    title: '1. Identity & Access — Entra ID',
    items: [
      {
        check: 'Stale accounts (no sign-in 30+ days)',
        portal: 'Entra → Identity → Users → All Users → filter by "Last sign-in" column',
        ps: `Get-MgUser -All -Property DisplayName,UserPrincipalName,SignInActivity | Where-Object { $_.SignInActivity.LastSignInDateTime -lt (Get-Date).AddDays(-30) } | Select DisplayName,UserPrincipalName,@{n='LastSignIn';e={$_.SignInActivity.LastSignInDateTime}}`,
        risk: 'HIGH',
        note: 'Disable or delete accounts inactive 30+ days. Check with managers before deleting.'
      },
      {
        check: 'Accounts with no MFA registered',
        portal: 'Entra → Identity → Users → All Users → Authentication methods → filter MFA = None',
        ps: `Get-MgReportAuthenticationMethodUserRegistrationDetail | Where-Object { -not $_.IsMfaRegistered } | Select UserDisplayName,UserPrincipalName`,
        risk: 'CRITICAL',
        note: 'Every active user must have MFA. Direct unregistered users to aka.ms/mfasetup.'
      },
      {
        check: 'Admin role assignments — are they minimal?',
        portal: 'Entra → Identity → Roles & admins → All roles → check Global Admin, Privileged Role Admin, Exchange Admin',
        ps: `Get-MgDirectoryRole | ForEach-Object { $role = $_; Get-MgDirectoryRoleMember -DirectoryRoleId $role.Id | Select @{n='Role';e={$role.DisplayName}},@{n='User';e={$_.AdditionalProperties.userPrincipalName}} }`,
        risk: 'HIGH',
        note: 'Global Admin should have ≤2 accounts. All admin roles should use dedicated admin accounts, not daily-use accounts.'
      },
      {
        check: 'Break-glass emergency access accounts exist and are excluded from CA',
        portal: 'Entra → Identity → Users → search for emergency/breakglass accounts → verify excluded from all CA policies',
        ps: null,
        risk: 'HIGH',
        note: 'Must have 2 break-glass accounts. Cloud-only, no MFA requirement, excluded from CA. Test sign-in quarterly.'
      },
      {
        check: 'Guest / external user audit',
        portal: 'Entra → Identity → Users → All Users → filter "User type = Guest"',
        ps: `Get-MgUser -Filter "userType eq 'Guest'" | Select DisplayName,UserPrincipalName,CreatedDateTime | Sort-Object CreatedDateTime`,
        risk: 'MEDIUM',
        note: 'Remove guests who no longer need access. Review any guest with admin roles immediately.'
      },
      {
        check: 'Risky users flagged by Identity Protection',
        portal: 'Entra → Protection → Identity Protection → Risky users',
        ps: null,
        risk: 'CRITICAL',
        note: 'Remediate or dismiss each risky user. Confirm action with manager before dismissing.'
      }
    ]
  },

  {
    title: '2. Conditional Access',
    items: [
      {
        check: 'MFA required for all users policy exists and is enabled',
        portal: 'Entra → Protection → Conditional Access → Policies → look for a "Require MFA" policy in On state',
        ps: `Get-MgIdentityConditionalAccessPolicy | Select DisplayName,State | Sort-Object DisplayName`,
        risk: 'CRITICAL',
        note: 'If no MFA CA policy exists, create one immediately. Exclude break-glass accounts only.'
      },
      {
        check: 'Legacy authentication blocked',
        portal: 'Entra → Conditional Access → Policies → look for "Block legacy authentication" policy',
        ps: null,
        risk: 'HIGH',
        note: 'Legacy auth (SMTP, IMAP, POP3, older Office clients) bypasses MFA. Must be blocked.'
      },
      {
        check: 'Named locations are accurate (trusted IPs)',
        portal: 'Entra → Protection → Conditional Access → Named locations',
        ps: null,
        risk: 'MEDIUM',
        note: 'Verify office IP ranges are correct. Remove any stale or unknown IP ranges. Each site should have its own named location.'
      },
      {
        check: 'No CA policy gaps — check for excluded users/groups',
        portal: 'Entra → Conditional Access → each policy → Exclude tab',
        ps: null,
        risk: 'HIGH',
        note: 'Exclusions should be minimal. Flag any non-break-glass accounts excluded from MFA policies.'
      }
    ]
  },

  {
    title: '3. Device Compliance — Intune',
    items: [
      {
        check: 'Non-compliant devices',
        portal: 'Intune → Devices → Compliance → Non-compliant devices report',
        ps: `Get-MgDeviceManagementManagedDevice -Filter "complianceState eq 'noncompliant'" | Select DeviceName,UserPrincipalName,OperatingSystem,ComplianceState`,
        risk: 'HIGH',
        note: 'Investigate each non-compliant device. Common causes: BitLocker off, OS out of date, no passcode.'
      },
      {
        check: 'Devices with no compliance policy assigned',
        portal: 'Intune → Devices → All devices → filter by "Compliance = Not evaluated"',
        ps: null,
        risk: 'HIGH',
        note: '"Not evaluated" means no policy targets the device — it can access resources unchecked. Assign a compliance policy.'
      },
      {
        check: 'BitLocker status on Windows devices',
        portal: 'Intune → Devices → All devices → [device] → Encryption report',
        ps: `Get-MgDeviceManagementManagedDevice -Filter "operatingSystem eq 'Windows'" | Select DeviceName,IsEncrypted,UserPrincipalName`,
        risk: 'HIGH',
        note: 'All Windows devices must be encrypted. Retrieve recovery keys via Intune → Devices → [device] → Recovery keys.'
      },
      {
        check: 'Stale/unmanaged devices (enrolled 90+ days, no check-in)',
        portal: 'Intune → Devices → All devices → sort by "Last check-in" ascending',
        ps: `Get-MgDeviceManagementManagedDevice | Where-Object { $_.LastSyncDateTime -lt (Get-Date).AddDays(-90) } | Select DeviceName,UserPrincipalName,LastSyncDateTime`,
        risk: 'MEDIUM',
        note: 'Retire stale devices. Confirm with user before wiping — device may be in storage or used infrequently.'
      }
    ]
  },

  {
    title: '4. Email Security — Exchange / Defender',
    items: [
      {
        check: `DKIM enabled for ${TENANT}`,
        portal: 'Defender → Policies & rules → Threat policies → Email authentication settings → DKIM tab',
        ps: `Get-DkimSigningConfig -Domain ${TENANT} | Select Domain,Enabled,Status`,
        risk: 'HIGH',
        note: 'DKIM must be enabled and both CNAME records published in DNS.'
      },
      {
        check: 'DMARC record published in DNS',
        portal: `Run: nslookup -type=TXT _dmarc.${TENANT} — should return a p= policy`,
        ps: `Resolve-DnsName -Name "_dmarc.${TENANT}" -Type TXT`,
        risk: 'HIGH',
        note: 'DMARC policy should be p=quarantine or p=reject. p=none provides no protection.'
      },
      {
        check: 'SPF record is tight (no ~all or ?all)',
        portal: `Run: nslookup -type=TXT ${TENANT} — SPF should end in -all (hard fail)`,
        ps: `Resolve-DnsName -Name "${TENANT}" -Type TXT | Where-Object { $_.Strings -match 'spf' }`,
        risk: 'HIGH',
        note: '~all (soft fail) allows spoofed mail to pass. Use -all. Only include legitimate sending IPs.'
      },
      {
        check: 'Anti-phishing policy enabled',
        portal: 'Defender → Policies & rules → Threat policies → Anti-phishing',
        ps: `Get-AntiPhishPolicy | Select Name,Enabled,EnableMailboxIntelligence,EnableSpoofIntelligence`,
        risk: 'HIGH',
        note: 'Enable impersonation protection for key users (execs, finance, IT). Enable spoof intelligence.'
      },
      {
        check: 'Mailbox forwarding rules — no unexpected external forwards',
        portal: 'Exchange Admin → Recipients → Mailboxes → [each mailbox] → Mailflow settings → check forwarding',
        ps: `Get-Mailbox -ResultSize Unlimited | Where-Object { $_.ForwardingSmtpAddress -ne $null } | Select DisplayName,ForwardingSmtpAddress,DeliverToMailboxAndForward`,
        risk: 'CRITICAL',
        note: 'External forwarding is a top exfiltration method after account compromise. Any unexpected forward = investigate immediately.'
      }
    ]
  },

  {
    title: '5. SharePoint & OneDrive — Data Exposure',
    items: [
      {
        check: 'External sharing settings — is sharing restricted?',
        portal: 'SharePoint Admin (admin.microsoft.com → SharePoint) → Policies → Sharing → check org-level setting',
        ps: `Get-SPOTenant | Select SharingCapability,DefaultSharingLinkType`,
        risk: 'HIGH',
        note: 'Recommended: "New and existing guests" at most. "Anyone" links (anonymous) should be disabled.'
      },
      {
        check: 'Sites shared externally',
        portal: 'SharePoint Admin → Sites → Active sites → filter by "External sharing = On"',
        ps: `Get-SPOSite -Limit All | Where-Object { $_.SharingCapability -ne "Disabled" } | Select Url,SharingCapability`,
        risk: 'MEDIUM',
        note: 'Review each externally shared site. Confirm it is intentional and has a business reason.'
      }
    ]
  },

  {
    title: '6. Privileged Access & App Permissions',
    items: [
      {
        check: 'App registrations with high-permission Graph API scopes',
        portal: 'Entra → Applications → App registrations → All applications → review API permissions',
        ps: `Get-MgApplication | Select DisplayName,CreatedDateTime | Sort-Object CreatedDateTime -Descending`,
        risk: 'HIGH',
        note: 'Flag any app with Mail.Read, User.ReadWrite.All, or Directory.ReadWrite.All scopes. Unused apps should be removed.'
      },
      {
        check: 'Service principals / Enterprise apps with broad permissions',
        portal: 'Entra → Applications → Enterprise applications → Permissions → look for User.ReadWrite.All, etc.',
        ps: null,
        risk: 'HIGH',
        note: 'Third-party apps with admin consent to broad scopes are a supply chain risk. Review quarterly.'
      }
    ]
  },

  {
    title: '7. Microsoft Secure Score',
    items: [
      {
        check: 'Current Secure Score and top improvement actions',
        portal: 'Defender (security.microsoft.com) → Secure score → Improvement actions — sort by Points impact',
        ps: null,
        risk: 'INFO',
        note: `Target score: 70%+. Focus on the top 5 improvement actions by points. Common quick wins: enable MFA, block legacy auth, enable audit log, enable SSPR.`
      }
    ]
  }

];

// ── Render report ──────────────────────────────────────────────────────────
function riskBadge(risk) {
  const map = { CRITICAL: '🔴 CRITICAL', HIGH: '🟠 HIGH', MEDIUM: '🟡 MEDIUM', INFO: '🔵 INFO' };
  return map[risk] || risk;
}

function renderReport() {
  const lines = [];
  lines.push(`# Security Audit — ${TENANT}`);
  lines.push(`**Generated:** ${TODAY}  |  **Tenant:** ${TENANT}  |  **Licensing:** M365 Business Premium`);
  lines.push('');
  lines.push('> Work through each section in the Microsoft admin portals. PowerShell alternatives are included for bulk checks.');
  lines.push('> Mark each item ✅ when verified or ❌ if action is needed.');
  lines.push('');

  // Summary table
  let critCount = 0, highCount = 0, medCount = 0;
  for (const s of sections) {
    for (const item of s.items) {
      if (item.risk === 'CRITICAL') critCount++;
      else if (item.risk === 'HIGH') highCount++;
      else if (item.risk === 'MEDIUM') medCount++;
    }
  }
  lines.push('## Audit Summary');
  lines.push(`| Risk Level | Count |`);
  lines.push(`|------------|-------|`);
  lines.push(`| 🔴 CRITICAL | ${critCount} checks |`);
  lines.push(`| 🟠 HIGH | ${highCount} checks |`);
  lines.push(`| 🟡 MEDIUM | ${medCount} checks |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const section of sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    for (const item of section.items) {
      lines.push(`### ${riskBadge(item.risk)} — ${item.check}`);
      lines.push('');
      lines.push(`**Portal path:**  `);
      lines.push(`${item.portal}`);
      lines.push('');
      if (item.ps) {
        lines.push('<details>');
        lines.push('<summary>PowerShell (for reference only)</summary>');
        lines.push('');
        lines.push('```powershell');
        lines.push(item.ps);
        lines.push('```');
        lines.push('');
        lines.push('</details>');
        lines.push('');
      }
      lines.push(`**Note:** ${item.note}`);
      lines.push('');
      lines.push('- [ ] Checked  &nbsp;&nbsp; Findings: _______________');
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  lines.push('## Audit Sign-off');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Auditor | ${AUDITOR} |`);
  lines.push(`| Date | ${TODAY} |`);
  lines.push(`| Tenant | ${TENANT} |`);
  lines.push(`| Critical items resolved | / ${critCount} |`);
  lines.push(`| High items resolved | / ${highCount} |`);
  lines.push(`| Jira ticket | [JIRA-###] |`);
  lines.push(`| Next review | ${nextReviewDate()} |`);
  lines.push('');

  return lines.join('\n');
}

function nextReviewDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().split('T')[0];
}

function auditCounts() {
  let critCount = 0, highCount = 0, medCount = 0;
  for (const s of sections) {
    for (const item of s.items) {
      if (item.risk === 'CRITICAL') critCount++;
      else if (item.risk === 'HIGH') highCount++;
      else if (item.risk === 'MEDIUM') medCount++;
    }
  }
  return { critCount, highCount, medCount };
}

function digest(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function normalizeAbsolute(input) {
  return path.normalize(path.resolve(input));
}

function isPathInside(root, candidate) {
  const relative = path.relative(normalizeAbsolute(root), normalizeAbsolute(candidate));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function lstatIfPresent(target, fileSystem = fs) {
  try {
    return fileSystem.lstatSync(target);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function regularFileIdentity(stat, label) {
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} is not a regular non-link file.`);
  }
  const dev = String(stat.dev);
  const ino = String(stat.ino);
  const birthtimeNs = stat.birthtimeNs === undefined ? '' : String(stat.birthtimeNs);
  if (
    !/^\d+$/.test(dev) || BigInt(dev) === 0n ||
    !/^\d+$/.test(ino) || BigInt(ino) === 0n ||
    !/^\d+$/.test(birthtimeNs) || BigInt(birthtimeNs) === 0n
  ) {
    throw new Error(`${label} does not expose a stable nonzero filesystem identity; refusing identity-based handling.`);
  }
  return {
    dev,
    ino,
    birthtimeNs
  };
}

function sameFileIdentity(left, right) {
  return Boolean(left && right) &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs;
}

function assertOwnedRegularFile(fileSystem, target, expectedIdentity, label) {
  if (!expectedIdentity) throw new Error(`${label} identity was not captured; refusing path-based cleanup.`);
  const stat = fileSystem.lstatSync(target, { bigint: true });
  const actualIdentity = regularFileIdentity(stat, label);
  if (!sameFileIdentity(actualIdentity, expectedIdentity)) {
    throw new Error(`${label} filesystem identity changed; refusing to remove or trust it.`);
  }
  return stat;
}

function assertNoLinksInExistingPath(target) {
  const normalized = normalizeAbsolute(target);
  const parsed = path.parse(normalized);
  const relative = path.relative(parsed.root, normalized);
  const components = relative === '' ? [] : relative.split(path.sep);
  let cursor = parsed.root;

  const rootStat = lstatIfPresent(cursor);
  if (rootStat && rootStat.isSymbolicLink()) {
    throw new Error(`Unsafe symbolic-link or junction/reparse path component: ${cursor}`);
  }
  for (const component of components) {
    cursor = path.join(cursor, component);
    const stat = lstatIfPresent(cursor);
    if (!stat) break;
    if (stat.isSymbolicLink()) {
      throw new Error(`Unsafe symbolic-link or junction/reparse path component: ${cursor}`);
    }
  }
}

function findGitMetadataAncestor(start) {
  let cursor = normalizeAbsolute(start);
  for (;;) {
    const marker = path.join(cursor, '.git');
    const stat = lstatIfPresent(marker);
    if (stat) return marker;
    const parent = path.dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
}

function assertGitIgnoredWhenInRepository(root, target, standalonePrivate = false) {
  const probe = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  if (probe.error) {
    throw new Error('Cannot prove the report target is outside Git tracking because Git is unavailable.');
  }
  if (probe.status !== 0) {
    if (findGitMetadataAncestor(root)) {
      throw new Error('Git metadata is present but worktree status could not be proved; refusing the report target.');
    }
    if (!standalonePrivate) {
      throw new Error('Git worktree status could not be proved. A known private non-Git directory requires explicit --standalone-private.');
    }
    return;
  }
  if (probe.stdout.trim() !== 'true') {
    throw new Error('Cannot prove the report target is outside Git tracking.');
  }
  const relative = path.relative(root, target);
  const ignored = spawnSync('git', ['check-ignore', '--quiet', '--', relative], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  if (ignored.error || ignored.status !== 0) {
    throw new Error('Report target must be Git-ignored; refusing a Git-trackable audit artifact.');
  }
}

function assertSafeReportTarget(cwd, outputPath, options = {}) {
  const root = normalizeAbsolute(cwd);
  const target = normalizeAbsolute(outputPath);
  if (/[\u0000-\u001f\u007f]/.test(target)) {
    throw new Error('Report target must not contain control characters.');
  }
  if (!isPathInside(root, target)) {
    throw new Error(`Report target must remain inside the resolved working directory: ${root}`);
  }
  const relative = path.relative(root, target);
  const segments = relative.split(path.sep);
  if (path.extname(target).toLowerCase() !== '.md') {
    throw new Error('Report target must be a Markdown (.md) file.');
  }
  if (segments.some(segment => segment.toLowerCase() === '.git')) {
    throw new Error('Report target must not be inside Git metadata.');
  }
  assertNoLinksInExistingPath(root);
  assertNoLinksInExistingPath(target);
  const rootStat = lstatIfPresent(root);
  if (!rootStat || !rootStat.isDirectory()) {
    throw new Error(`Resolved working directory is not a regular directory: ${root}`);
  }
  const parent = path.dirname(target);
  const parentStat = lstatIfPresent(parent);
  if (!parentStat || !parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error('Report parent directory must already exist and must not be a symbolic link or junction/reparse point.');
  }
  if (!/^security-audit-[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.md$/.test(path.basename(target))) {
    throw new Error('Report filename must match security-audit-<safe-label>.md so the repository ignore policy applies.');
  }
  assertGitIgnoredWhenInRepository(root, target, options.standalonePrivate === true);
  return target;
}

function parseArgs(argv) {
  const options = { write: false, confirm: null, output: null, standalonePrivate: false, help: false };
  const seen = new Set();
  const mark = flag => {
    if (seen.has(flag)) throw new Error(`${flag} may be supplied only once.`);
    seen.add(flag);
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') {
      mark('--write');
      options.write = true;
    } else if (arg === '--confirm') {
      mark('--confirm');
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) {
        throw new Error('--confirm requires the exact phrase printed by the preview.');
      }
      options.confirm = argv[++i];
    } else if (arg.startsWith('--confirm=')) {
      mark('--confirm');
      const value = arg.slice('--confirm='.length);
      if (!value) throw new Error('--confirm requires the exact phrase printed by the preview.');
      options.confirm = value;
    } else if (arg === '--output') {
      mark('--output');
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) {
        throw new Error('--output requires a path inside the working directory.');
      }
      options.output = argv[++i];
    } else if (arg.startsWith('--output=')) {
      mark('--output');
      const value = arg.slice('--output='.length);
      if (!value) throw new Error('--output requires a path inside the working directory.');
      options.output = value;
    } else if (arg === '--standalone-private') {
      mark('--standalone-private');
      options.standalonePrivate = true;
    } else if (arg === '--help' || arg === '-h') {
      mark('--help');
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.help && argv.length !== 1) throw new Error('--help cannot be combined with other arguments.');
  if (options.confirm !== null && !options.write) throw new Error('--confirm is valid only with --write.');
  return options;
}

function buildWritePlan(cwd, outputPath, report, options = {}) {
  const target = assertSafeReportTarget(cwd, outputPath, options);
  const contentSha256 = digest(report);
  const existing = lstatIfPresent(target);
  return {
    target,
    contentSha256,
    exists: existing !== null,
    confirmation: existing === null
      ? `WRITE SECURITY AUDIT TARGET ${target} CONTENT SHA256 ${contentSha256}`
      : null
  };
}

function writeReportExclusive(plan, report, cwd, dependencies = {}, options = {}) {
  assertSafeReportTarget(cwd, plan.target, options);
  if (lstatIfPresent(plan.target)) throw new Error('Report target already exists; refusing to overwrite it.');
  const fileSystem = dependencies.fileSystem || fs;
  const parent = path.dirname(plan.target);
  let tempPath = null;
  let descriptor = null;
  let tempOwned = false;
  let tempIdentity = null;
  let installed = false;
  let targetIdentity = null;
  let targetState = 'not installed by this invocation';
  let tempState = 'not created';
  try {
    tempPath = path.join(
      parent,
      `.${path.basename(plan.target)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
    );
    assertGitIgnoredWhenInRepository(cwd, tempPath, options.standalonePrivate === true);
    descriptor = fileSystem.openSync(tempPath, 'wx', 0o600);
    tempOwned = true;
    tempState = 'created by this invocation';
    tempIdentity = regularFileIdentity(fileSystem.fstatSync(descriptor, { bigint: true }), 'Invocation-owned temp');
    fileSystem.writeFileSync(descriptor, report, 'utf8');
    fileSystem.fsyncSync(descriptor);
    fileSystem.closeSync(descriptor);
    descriptor = null;

    if (dependencies.beforeInstall) dependencies.beforeInstall(plan, { tempPath });
    assertSafeReportTarget(cwd, plan.target, options);
    assertGitIgnoredWhenInRepository(cwd, tempPath, options.standalonePrivate === true);
    if (lstatIfPresent(plan.target)) throw new Error('Report target appeared before install; refusing to clobber it.');
    assertOwnedRegularFile(fileSystem, tempPath, tempIdentity, 'Invocation-owned temp');
    fileSystem.linkSync(tempPath, plan.target);
    installed = true;
    targetIdentity = tempIdentity;
    targetState = 'installed pending read-back';
    assertSafeReportTarget(cwd, plan.target, options);
    assertGitIgnoredWhenInRepository(cwd, tempPath, options.standalonePrivate === true);
    assertOwnedRegularFile(fileSystem, plan.target, targetIdentity, 'Installed report');
    assertOwnedRegularFile(fileSystem, tempPath, tempIdentity, 'Invocation-owned temp');
    fileSystem.unlinkSync(tempPath);
    tempOwned = false;
    tempState = 'removed';
    if (dependencies.afterInstall) dependencies.afterInstall(plan, { tempPath });
    assertSafeReportTarget(cwd, plan.target, options);
    assertOwnedRegularFile(fileSystem, plan.target, targetIdentity, 'Installed report');
    const reportReadBack = fileSystem.readFileSync(plan.target);
    assertSafeReportTarget(cwd, plan.target, options);
    assertOwnedRegularFile(fileSystem, plan.target, targetIdentity, 'Installed report');
    if (digest(reportReadBack) !== plan.contentSha256) {
      throw new Error('Report SHA256 readback verification failed.');
    }
    assertSafeReportTarget(cwd, plan.target, options);
  } catch (error) {
    const unresolved = [];
    if (descriptor !== null) {
      if (!tempIdentity) {
        try {
          tempIdentity = regularFileIdentity(fileSystem.fstatSync(descriptor, { bigint: true }), 'Invocation-owned temp');
        } catch (identityError) {
          unresolved.push(`temp identity: ${identityError.message}`);
        }
      }
      try {
        fileSystem.closeSync(descriptor);
        descriptor = null;
      } catch (closeError) {
        unresolved.push(`descriptor: ${closeError.message}`);
      }
    }
    if (installed) {
      try {
        assertOwnedRegularFile(fileSystem, plan.target, targetIdentity, 'Installed report');
        if (digest(fileSystem.readFileSync(plan.target)) !== plan.contentSha256) {
          throw new Error('installed report changed before rollback; refusing to clobber it');
        }
        assertOwnedRegularFile(fileSystem, plan.target, targetIdentity, 'Installed report');
        fileSystem.unlinkSync(plan.target);
        installed = false;
        targetState = 'rolled back';
      } catch (rollbackError) {
        targetState = 'installed or changed; unresolved';
        unresolved.push(`target: ${rollbackError.message}`);
      }
    }
    if (tempOwned && tempPath) {
      try {
        const tempStat = lstatIfPresent(tempPath, fileSystem);
        if (tempStat) {
          assertOwnedRegularFile(fileSystem, tempPath, tempIdentity, 'Invocation-owned temp');
          fileSystem.unlinkSync(tempPath);
        }
        tempOwned = false;
        tempState = 'removed';
      } catch (cleanupError) {
        tempState = 'present or changed; unresolved';
        unresolved.push(`temp: ${cleanupError.message}`);
      }
    }
    throw new Error(
      `Security-audit write failed: ${error.message}. ` +
      `Partial-state report: target=${targetState}; temp=${tempState}; unresolved=[${unresolved.join(', ') || 'none'}]`
    );
  }
}

function run(argv = process.argv.slice(2), cwd = process.cwd(), dependencies = {}) {
  const logger = dependencies.logger || console;
  const options = parseArgs(argv);
  if (options.help) {
    logger.log('Usage: node scripts/security-audit.js [--output security-audit-<safe-label>.md] [--standalone-private] [--write --confirm "EXACT PHRASE"]');
    logger.log('Default behavior computes and previews a Git-ignored report without writing a file. A known private non-Git directory requires explicit --standalone-private. Existing reports are never overwritten.');
    logger.log('Exact writes require hard-link support and stable nonzero filesystem inode identities in an operator-controlled directory.');
    return 0;
  }

  const report = renderReport();
  const outputPath = options.output
    ? path.resolve(cwd, options.output)
    : path.join(cwd, `security-audit-${TODAY}.md`);
  const plan = buildWritePlan(cwd, outputPath, report, {
    standalonePrivate: options.standalonePrivate
  });
  const { critCount, highCount, medCount } = auditCounts();

  logger.log(`security-audit.js — ${TENANT} security audit generator`);
  logger.log('Mode: preview only');
  logger.log(`Report target: ${plan.target}`);
  logger.log(`Content SHA256: ${plan.contentSha256}`);
  logger.log('Audit checklist:');
  logger.log(`  🔴 CRITICAL  ${critCount} checks`);
  logger.log(`  🟠 HIGH      ${highCount} checks`);
  logger.log(`  🟡 MEDIUM    ${medCount} checks`);

  if (plan.exists) {
    logger.log('Blocked: the report target already exists. This command never overwrites an existing report.');
    logger.log('No files changed.');
    return options.write ? 2 : 0;
  }

  logger.log(`Required confirmation: ${plan.confirmation}`);
  if (!options.write) {
    logger.log('No files changed.');
    return 0;
  }
  if (options.confirm !== plan.confirmation) {
    logger.error('Exact confirmation mismatch. Confirmation is case- and whitespace-sensitive. No files changed.');
    return 2;
  }

  writeReportExclusive(plan, report, cwd, dependencies, {
    standalonePrivate: options.standalonePrivate
  });
  logger.log(`Verified report written once: ${plan.target}`);
  return 0;
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  try {
    process.exitCode = run();
  } catch (error) {
    console.error(`security-audit.js: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  // Reused by scripts/gws-posture-audit.js so both reports share one write path.
  assertSafeReportTarget,
  buildWritePlan,
  parseArgs,
  renderReport,
  run,
  writeReportExclusive
};
