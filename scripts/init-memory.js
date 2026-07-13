#!/usr/bin/env node
/**
 * init-memory.js
 * Safely initializes Claude Code memory files for this Git repository.
 * Preview with: node scripts/init-memory.js --dry-run
 * Replace only after review with: node scripts/init-memory.js --force
 * No npm install needed — uses only built-in Node.js modules.
 *
 * Config via environment variables:
 *   MEMORY_DIR  — override full path to memory directory
 *   PROJECT_KEY — optional stable slug; default is derived from the Git repository root
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// ── Paths ──────────────────────────────────────────────────────────────────
function findRepositoryRoot(cwd = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch {
    throw new Error('Unable to resolve the Git repository root. Run inside a repository or pass --memory-dir.');
  }
}

function encodeProjectRoot(repoRoot) {
  return path.resolve(repoRoot).replace(/[^a-zA-Z0-9_-]/g, '-');
}

function validateProjectKey(projectKey) {
  if (typeof projectKey !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(projectKey)) {
    throw new Error('PROJECT_KEY must be a simple 1-128 character slug using only letters, numbers, hyphens, and underscores. Use MEMORY_DIR for an explicit path.');
  }
  return projectKey;
}

function resolveMemoryDir(options = {}, env = process.env, cwd = process.cwd()) {
  if (options.memoryDir) return path.resolve(options.memoryDir);
  if (env.MEMORY_DIR) return path.resolve(env.MEMORY_DIR);

  const projectKey = env.PROJECT_KEY
    ? validateProjectKey(env.PROJECT_KEY)
    : encodeProjectRoot(findRepositoryRoot(cwd));
  return path.join(os.homedir(), '.claude', 'projects', projectKey, 'memory');
}

// ── Memory file definitions ────────────────────────────────────────────────
const memories = [
  {
    file: 'user_role.md',
    indexLine: '- [User Role](user_role.md) — IT operator role, experience level, and daily toolset',
    content: `---
name: User Role & Environment
description: IT operator's role, experience level, and daily toolset
type: user
---

[ADMIN_NAME] is the IT operator at [@Aegion] ([@Aegion_DOMAIN]).

- **Experience:** IT generalist — explain PowerShell commands in plain English
- **Microsoft stack:** M365 Business Premium, Entra ID (hybrid AD via Entra Connect), Intune, Exchange Online, Azure
- **Network:** Cisco Meraki MX + MR across multiple office sites
- **VoIP:** [@Aegion_VOIP]
- **Ticketing:** Jira Service Management (cloud)
- **Response preference:** Portal/admin center steps FIRST, PowerShell second (wrapped in collapsible block)
- **Device convention:** DT-FirstName,LastName (desktops), LT-FirstName,LastName (laptops) — flag violations
`
  },
  {
    file: 'project_voip_migration.md',
    indexLine: '- [VoIP Migration](project_voip_migration.md) — VoIP platform rollout status across sites',
    content: `---
name: VoIP Migration
description: Status of VoIP migration across all office sites
type: project
---

Migrating all office sites to [@Aegion_VOIP].

**Why:** Legacy PBX end-of-life; cost savings by eliminating landlines site-by-site as new VoIP goes live.

| Site | Status |
|------|--------|
| Main office | ✅ Complete |
| [@Aegion_SITE_2] | 🔄 In progress |
| [@Aegion_SITE_3] | 🔄 In progress |
| [@Aegion_SITE_4] | Unknown |

**How to apply:** When troubleshooting phone issues, check whether the affected site has completed migration. If not, the user may still be on the legacy system. Coordinate alarm/landline cutover to happen simultaneously with VoIP go-live at each site.
`
  },
  {
    file: 'project_vpn_migration.md',
    indexLine: '- [VPN Migration](project_vpn_migration.md) — P2P fiber to Meraki site-to-site VPN',
    content: `---
name: VPN Migration — P2P to Meraki Site-to-Site
description: Replacing P2P fiber between main office and secondary site with Meraki MX-to-MX VPN
type: project
---

Replacing the existing [@Aegion_WAN] link with a Meraki site-to-site VPN (MX-to-MX).

**Why:** Simplify WAN topology, reduce P2P costs, bring remote sites onto the same Meraki SD-WAN fabric.

**Current blocker:** [@Aegion_REMOTE_ACCESS] is still running over the P2P link and needs to be migrated before the P2P can be cut.

**How to apply:** Do not recommend cutting the P2P link until the remote access dependency is resolved. VPN config path: Meraki → Security & SD-WAN → Site-to-site VPN.
`
  },
  {
    file: 'feedback_response_style.md',
    indexLine: '- [Response Style Feedback](feedback_response_style.md) — Portal first, no PII, plain English PS, direct tone',
    content: `---
name: Response Style Preferences
description: How the operator wants Aegis to format and deliver responses
type: feedback
---

Always show **portal/admin center steps FIRST**. PowerShell is secondary — wrap it in a \`<details>\` collapse block labeled "PowerShell (for reference only)" and explain every line in plain English.

**Why:** The operator primarily works through admin portals. Portal steps are immediately actionable; PS blocks are for reference.

**How to apply:** Every IT response should lead with numbered GUI steps using exact portal paths. Never lead with a PS block unless explicitly asked.

---

Never ask for or include real employee names, emails, UPNs, phone numbers, or any PII. Always use placeholders: [FIRST_NAME], [UPN], [USER@DOMAIN.COM], [DEVICE_NAME], etc.

**Why:** Hard security rule to prevent accidental PII exposure in AI conversations.

**How to apply:** Even if the user volunteers real names/emails, use placeholders in all output. No exceptions.

---

Keep responses short, scannable, and phone-screen readable. No walls of text. Use short bullets and clear headers. Never say "Great question!" or "Certainly!" — just answer.

**How to apply:** Bullet points over paragraphs. Warn with ⚠️ before any destructive action. End every workflow with a verification checklist.
`
  },
  {
    file: 'project_alarm_upgrade.md',
    indexLine: '- [Alarm Upgrade](project_alarm_upgrade.md) — Landline to internet-based alarm, timed with VoIP cutover',
    content: `---
name: Physical Security Alarm Upgrade
description: Upgrading alarm monitoring from landline to internet-based, coordinated with VoIP migration
type: project
---

Upgrading [@Aegion_ALARM] monitoring from landline to internet-based at each site.

**Why:** Once [@Aegion_VOIP] is live at a site, the [@Aegion_ISP] landline feeding the alarm can be cut — eliminating the landline cost. The alarm cutover is intentionally timed with the VoIP go-live to coordinate a single vendor/cabling visit.

**How to apply:** Do not schedule alarm cutover independently. It must be coordinated with: [@Aegion_NETPARTNER] (cabling), [@Aegion_ALARM] (alarm cutover), and [@Aegion_ISP] (landline disconnect) at the same time VoIP goes live at that site.
`
  }
];

// ── MEMORY.md index template ───────────────────────────────────────────────
function buildMemoryIndex(entries) {
  const lines = entries.map(e => e.indexLine).join('\n');
  return `# ITOps Session Memory

## User Preferences
- Always show **portal/admin center steps FIRST**, PowerShell second
- Tenant domain: [@Aegion_DOMAIN]
- Keep responses direct and step-by-step

## Memory Files
${lines}
`;
}

// ── Safe state handling ─────────────────────────────────────────────────────
function desiredFiles() {
  return [
    ...memories.map(mem => ({ file: mem.file, content: mem.content })),
    { file: 'MEMORY.md', content: buildMemoryIndex(memories) }
  ];
}

function fileDigest(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function bufferDigest(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function durableTempWrite(directory, targetName, content, suffix = 'tmp') {
  const tempName = `.${targetName}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.${suffix}`;
  const tempPath = path.join(directory, tempName);
  const fd = fs.openSync(tempPath, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return tempPath;
}

function createVerifiedBackup(memoryDir, files, now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  let backupDir = path.join(memoryDir, '.backups', stamp);
  if (fs.existsSync(backupDir)) backupDir += `-${process.pid}`;
  fs.mkdirSync(backupDir, { recursive: true });

  for (const file of files) {
    const source = path.join(memoryDir, file);
    const destination = path.join(backupDir, file);
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    if (fileDigest(source) !== fileDigest(destination)) {
      throw new Error(`Backup verification failed for ${file}. No memory files were replaced.`);
    }
  }

  return backupDir;
}

function installNewFileExclusive(tempPath, targetPath) {
  fs.linkSync(tempPath, targetPath);
  try {
    fs.unlinkSync(tempPath);
  } catch (error) {
    try { fs.unlinkSync(targetPath); } catch { /* preserve the original unlink error */ }
    throw error;
  }
}

function writeFilesAtomically(memoryDir, files, options = {}) {
  fs.mkdirSync(memoryDir, { recursive: true });
  const previous = new Map();
  const pending = [];
  const installed = [];
  const replaceFile = options.installFile || fs.renameSync;
  const installNewFile = options.installNewFile || installNewFileExclusive;
  const replaceFiles = options.replaceFiles || new Set();
  const expectedDigests = options.expectedDigests || new Map();

  try {
    for (const entry of files) {
      const target = path.join(memoryDir, entry.file);
      if (replaceFiles.has(entry.file)) {
        if (!fs.existsSync(target)) {
          throw new Error(`Authorized replacement target disappeared: ${entry.file}`);
        }
        const expectedDigest = expectedDigests.get(entry.file);
        if (expectedDigest && fileDigest(target) !== expectedDigest) {
          throw new Error(`Authorized replacement target changed after backup: ${entry.file}`);
        }
        previous.set(entry.file, fs.readFileSync(target));
      } else {
        previous.set(entry.file, null);
      }
      const temp = durableTempWrite(memoryDir, entry.file, entry.content);
      pending.push({ ...entry, target, temp });
    }

    for (const entry of pending) {
      if (options.beforeInstall) options.beforeInstall(entry);
      if (replaceFiles.has(entry.file)) {
        replaceFile(entry.temp, entry.target);
      } else {
        installNewFile(entry.temp, entry.target);
      }
      installed.push(entry);
    }

    for (const entry of installed) {
      if (fileDigest(entry.target) !== bufferDigest(entry.content)) {
        throw new Error(`Post-write verification failed for ${entry.file}.`);
      }
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of installed.reverse()) {
      try {
        const original = previous.get(entry.file);
        if (original === null) {
          if (fs.existsSync(entry.target)) fs.unlinkSync(entry.target);
        } else {
          const restoreTemp = durableTempWrite(memoryDir, entry.file, original, 'restore');
          fs.renameSync(restoreTemp, entry.target);
        }
      } catch (rollbackError) {
        rollbackErrors.push(`${entry.file}: ${rollbackError.message}`);
      }
    }
    for (const entry of pending) {
      if (fs.existsSync(entry.temp)) fs.unlinkSync(entry.temp);
    }
    const detail = rollbackErrors.length > 0
      ? ` Rollback also failed for ${rollbackErrors.join(', ')}`
      : ' Original state was restored.';
    throw new Error(`Atomic memory update failed: ${error.message}.${detail}`);
  }
}

function inspectState(memoryDir, files = desiredFiles()) {
  const existing = files.map(entry => entry.file)
    .filter(file => fs.existsSync(path.join(memoryDir, file)));
  const missing = files.map(entry => entry.file).filter(file => !existing.includes(file));
  return {
    existing,
    missing,
    partial: existing.length > 0 && missing.length > 0
  };
}

function parseArgs(argv) {
  const options = { force: false, dryRun: false, memoryDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') {
      options.force = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--memory-dir') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) {
        throw new Error('--memory-dir requires a path.');
      }
      options.memoryDir = argv[++i];
    } else if (arg.startsWith('--memory-dir=')) {
      const value = arg.slice('--memory-dir='.length);
      if (!value) throw new Error('--memory-dir requires a path.');
      options.memoryDir = value;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printPlan(memoryDir, files, state, mode) {
  console.log(`Memory directory: ${memoryDir}`);
  console.log(`Mode: ${mode}`);
  if (state.partial) {
    console.log(`Partial initialization detected: ${state.existing.length}/${files.length} target files exist.`);
  }
  console.log('Target files:');
  for (const entry of files) {
    const action = state.existing.includes(entry.file) ? 'replace' : 'create';
    console.log(`  ${action.padEnd(7)} ${entry.file}`);
  }
}

function run(argv = process.argv.slice(2), env = process.env, cwd = process.cwd()) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log('Usage: node scripts/init-memory.js [--memory-dir PATH] [--dry-run] [--force]');
    console.log('Existing files are never replaced unless --force is supplied.');
    return 0;
  }

  const memoryDir = resolveMemoryDir(options, env, cwd);
  const files = desiredFiles();
  const state = inspectState(memoryDir, files);
  const mode = options.dryRun ? 'preview only' : (state.existing.length > 0 ? 'replacement' : 'initialization');
  printPlan(memoryDir, files, state, mode);

  if (options.dryRun) {
    console.log('No files changed.');
    return 0;
  }

  if (state.existing.length > 0 && !options.force) {
    console.error('Refusing to replace existing memory. Review the plan and rerun with --force only if replacement is intended.');
    return 2;
  }

  let backupDir = null;
  const replaceFiles = new Set();
  const expectedDigests = new Map();
  if (state.existing.length > 0) {
    backupDir = createVerifiedBackup(memoryDir, state.existing);
    for (const file of state.existing) {
      replaceFiles.add(file);
      expectedDigests.set(file, fileDigest(path.join(backupDir, file)));
    }
    console.log(`Verified backup: ${backupDir}`);
  }

  writeFilesAtomically(memoryDir, files, { replaceFiles, expectedDigests });
  console.log(`Verified: ${files.length} memory files installed.`);
  if (backupDir) console.log('Previous state remains available in the verified backup directory.');
  return 0;
}

function main() {
  try {
    process.exitCode = run();
  } catch (error) {
    console.error(`init-memory.js: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  createVerifiedBackup,
  desiredFiles,
  encodeProjectRoot,
  findRepositoryRoot,
  inspectState,
  installNewFileExclusive,
  parseArgs,
  resolveMemoryDir,
  run,
  validateProjectKey,
  writeFilesAtomically
};
