#!/usr/bin/env node
/**
 * deploy-check.js — Pre-Deployment Checklist Validator
 *
 * Checklist checks are shell-free: executables receive explicit argument arrays,
 * tracked text is inspected with Node.js, and the configured Git hook is inspected
 * at the path Git actually uses.
 *
 * Usage:
 *   node modules/automation/scripts/deploy-check.js
 *   node modules/automation/scripts/deploy-check.js path/to/custom-checklist.json
 *
 * Exit 0 = ready to deploy
 * Exit 1 = blocked (a required check did not pass or any check failed)
 * Exit 2 = degraded (no failures, but at least one result is unknown)
 *
 * No external dependencies — Node.js core only (fs, path, child_process).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const STATUS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  UNKNOWN: 'UNKNOWN',
  SKIPPED: 'SKIPPED',
});

const EXIT = Object.freeze({
  READY: 0,
  BLOCKED: 1,
  DEGRADED: 2,
});

function createContext(overrides = {}) {
  return {
    cwd: overrides.cwd || process.cwd(),
    env: overrides.env || process.env,
    execPath: overrides.execPath || process.execPath,
    fs: overrides.fs || fs,
    nodeVersion: overrides.nodeVersion || process.version,
    path: overrides.path || path,
    platform: overrides.platform || process.platform,
    resolveHookPath: overrides.resolveHookPath,
    spawnSync: overrides.spawnSync || spawnSync,
  };
}

function result(status, detail) {
  return { status, detail };
}

function compactOutput(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 160);
}

function describeProcessFailure(command, args, execution) {
  const rendered = [command, ...args].join(' ');
  if (execution.error) {
    const code = execution.error.code ? ` (${execution.error.code})` : '';
    return `Unable to run ${rendered}${code}: ${execution.error.message}`;
  }

  const diagnostic = compactOutput(execution.stderr) || compactOutput(execution.stdout);
  const status = Number.isInteger(execution.status) ? `status ${execution.status}` : 'no exit status';
  const signal = execution.signal ? `, signal ${execution.signal}` : '';
  return diagnostic
    ? `${rendered} exited with ${status}${signal}: ${diagnostic}`
    : `${rendered} exited with ${status}${signal} and no output`;
}

function runProcess(command, args, context, timeoutMs = 15000) {
  let execution;
  try {
    execution = context.spawnSync(command, args, {
      cwd: context.cwd,
      encoding: 'utf8',
      env: context.env,
      shell: false,
      timeout: timeoutMs,
      windowsHide: true,
    });
  } catch (error) {
    execution = { error, status: null, signal: null, stdout: '', stderr: '' };
  }

  if (execution.error || execution.status !== 0) {
    return {
      ok: false,
      detail: describeProcessFailure(command, args, execution),
      execution,
    };
  }

  return {
    ok: true,
    stdout: String(execution.stdout || ''),
    stderr: String(execution.stderr || ''),
    execution,
  };
}

function compareOutput(output, expect) {
  const trimmed = output.trim();
  if (expect === undefined) return result(STATUS.PASS, 'Command completed successfully');

  if (expect === 'empty') {
    return trimmed.length === 0
      ? result(STATUS.PASS, 'Output is empty (clean)')
      : result(STATUS.FAIL, `Unexpected output: ${compactOutput(trimmed)}`);
  }

  if (typeof expect === 'string' && expect.startsWith('contains:')) {
    const needle = expect.slice('contains:'.length);
    return trimmed.includes(needle)
      ? result(STATUS.PASS, `Output contains "${needle}"`)
      : result(STATUS.FAIL, `"${needle}" not found in output`);
  }

  if (typeof expect !== 'string') {
    return result(STATUS.FAIL, 'Command expect value must be a string');
  }

  return trimmed === expect
    ? result(STATUS.PASS, 'Output matches expected value')
    : result(STATUS.FAIL, `Expected "${expect}", got "${compactOutput(trimmed)}"`);
}

function validateFileExists(check, context) {
  if (typeof check.path !== 'string' || !check.path) {
    return result(STATUS.FAIL, 'file_exists check requires a path');
  }
  const fullPath = context.path.resolve(context.cwd, check.path);
  return context.fs.existsSync(fullPath)
    ? result(STATUS.PASS, `Found: ${check.path}`)
    : result(STATUS.FAIL, `Not found: ${check.path}`);
}

function validateCommand(check, context) {
  if (typeof check.command !== 'string' || !check.command) {
    return result(STATUS.FAIL, 'command check requires an executable name');
  }
  if (check.args !== undefined && !Array.isArray(check.args)) {
    return result(STATUS.FAIL, 'command args must be an array');
  }

  const args = check.args || [];
  const execution = runProcess(check.command, args, context, check.timeoutMs);
  if (!execution.ok) return result(STATUS.FAIL, execution.detail);
  return compareOutput(execution.stdout, check.expect);
}

function validateGitClean(check, context) {
  return validateCommand({
    command: 'git',
    args: ['status', '--porcelain'],
    expect: 'empty',
    timeoutMs: check.timeoutMs,
  }, context);
}

function resolveGitHookPath(context) {
  if (typeof context.resolveHookPath === 'function') {
    return context.resolveHookPath(context);
  }

  const resolved = runProcess(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-path', 'hooks/pre-commit'],
    context
  );
  if (!resolved.ok) return { ok: false, detail: resolved.detail };

  const hookPath = resolved.stdout.trim();
  if (!hookPath) return { ok: false, detail: 'Git returned an empty pre-commit hook path' };
  return { ok: true, path: hookPath };
}

function validateGitHook(check, context) {
  const hookResolution = resolveGitHookPath(context);
  if (!hookResolution.ok) return result(STATUS.FAIL, hookResolution.detail);

  const hookPath = hookResolution.path;
  if (!context.fs.existsSync(hookPath)) {
    return result(STATUS.FAIL, `Pre-commit hook is not installed at ${hookPath}`);
  }

  let stat;
  let content;
  try {
    stat = context.fs.statSync(hookPath);
    content = context.fs.readFileSync(hookPath, 'utf8');
  } catch (error) {
    return result(STATUS.FAIL, `Unable to inspect pre-commit hook: ${error.message}`);
  }

  if (!stat.isFile()) return result(STATUS.FAIL, `Pre-commit hook path is not a file: ${hookPath}`);
  if (context.platform !== 'win32' && (stat.mode & 0o111) === 0) {
    return result(STATUS.FAIL, `Pre-commit hook is not executable: ${hookPath}`);
  }

  const scannerPath = context.path.resolve(context.cwd, check.scanner || 'scripts/pre-commit-check.js');
  if (!context.fs.existsSync(scannerPath)) {
    return result(STATUS.FAIL, `Scanner referenced by hook check is missing: ${scannerPath}`);
  }

  const activeLines = content.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  const scannerInvocation = /^(?:(?:exec|command)\s+)?(?:(?:\/usr\/bin\/env\s+)?node(?:\.exe)?|["'][^"']*node(?:\.exe)?["'])\s+["']?(?:\.[\\/])?scripts[\\/]+pre-commit-check\.js["']?\s*$/i;
  const invokesScanner = activeLines.length === 1 && scannerInvocation.test(activeLines[0]);
  if (!invokesScanner) {
    return result(
      STATUS.FAIL,
      `Pre-commit hook must contain one unmasked scanner command and no other active commands: ${hookPath}`
    );
  }

  const behavior = runProcess(
    'git',
    ['hook', 'run', 'pre-commit'],
    context,
    check.timeoutMs || 30000
  );
  if (!behavior.ok) {
    return result(STATUS.FAIL, `Installed pre-commit hook failed its behavior check: ${behavior.detail}`);
  }

  return result(STATUS.PASS, `Installed hook invokes and successfully runs the safety scanner: ${hookPath}`);
}

function listTrackedFiles(context) {
  const listed = runProcess('git', ['ls-files', '-z'], context);
  if (!listed.ok) return { ok: false, detail: listed.detail };
  return {
    ok: true,
    files: listed.stdout.split('\0').filter(Boolean),
  };
}

function validateTrackedTextAbsent(check, context) {
  if (!Array.isArray(check.needles) || check.needles.length === 0 ||
      check.needles.some(needle => typeof needle !== 'string' || !needle)) {
    return result(STATUS.FAIL, 'tracked_text_absent requires one or more non-empty needles');
  }

  const listed = listTrackedFiles(context);
  if (!listed.ok) return result(STATUS.FAIL, listed.detail);

  const extensions = Array.isArray(check.extensions)
    ? new Set(check.extensions.map(ext => ext.toLowerCase()))
    : null;
  const findings = [];

  for (const relativePath of listed.files) {
    if (extensions && !extensions.has(context.path.extname(relativePath).toLowerCase())) continue;
    const fullPath = context.path.resolve(context.cwd, relativePath);
    let content;
    try {
      content = context.fs.readFileSync(fullPath, 'utf8');
    } catch (error) {
      return result(STATUS.FAIL, `Unable to read tracked file ${relativePath}: ${error.message}`);
    }

    for (const needle of check.needles) {
      if (content.includes(needle)) findings.push(`${relativePath} contains "${needle}"`);
      if (findings.length >= 5) break;
    }
    if (findings.length >= 5) break;
  }

  return findings.length === 0
    ? result(STATUS.PASS, `No forbidden markers found in ${listed.files.length} tracked files`)
    : result(STATUS.FAIL, findings.join('; '));
}

function validateNodeRuntime(_check, context) {
  return typeof context.nodeVersion === 'string' && /^v\d+/.test(context.nodeVersion)
    ? result(STATUS.PASS, `Node.js ${context.nodeVersion}`)
    : result(STATUS.FAIL, 'Unable to determine the active Node.js runtime');
}

function validateScanner(check, context) {
  const scanner = check.path || 'scripts/pre-commit-check.js';
  const args = check.args || [];
  if (!Array.isArray(args)) return result(STATUS.FAIL, 'scanner args must be an array');
  if (!args.includes('--all')) {
    return result(STATUS.FAIL, 'Full-tree scanner check must include --all');
  }

  const scannerPath = context.path.resolve(context.cwd, scanner);
  if (!context.fs.existsSync(scannerPath)) {
    return result(STATUS.FAIL, `Scanner not found: ${scanner}`);
  }

  const execution = runProcess(context.execPath, [scannerPath, ...args], context, check.timeoutMs || 30000);
  if (!execution.ok) return result(STATUS.FAIL, execution.detail);
  return compareOutput(execution.stdout, check.expect);
}

function validateEnvVar(check, context) {
  if (typeof check.name !== 'string' || !check.name) {
    return result(STATUS.FAIL, 'env_var check requires a name');
  }
  const value = context.env[check.name];
  return value !== undefined && value !== ''
    ? result(STATUS.PASS, `${check.name} is set`)
    : result(STATUS.FAIL, `${check.name} is not set`);
}

function runCheck(check, context) {
  let validation;
  switch (check.type) {
    case 'file_exists':
      validation = validateFileExists(check, context);
      break;
    case 'command':
      validation = validateCommand(check, context);
      break;
    case 'git_clean':
      validation = validateGitClean(check, context);
      break;
    case 'git_hook':
      validation = validateGitHook(check, context);
      break;
    case 'tracked_text_absent':
      validation = validateTrackedTextAbsent(check, context);
      break;
    case 'node_runtime':
      validation = validateNodeRuntime(check, context);
      break;
    case 'scanner':
      validation = validateScanner(check, context);
      break;
    case 'env_var':
      validation = validateEnvVar(check, context);
      break;
    case 'skip':
      validation = result(STATUS.SKIPPED, check.reason || 'Skipped by checklist');
      break;
    default:
      validation = result(STATUS.UNKNOWN, `Unknown check type: ${check.type}`);
  }

  return {
    id: check.id || '(unnamed)',
    description: check.description || '',
    required: check.required !== false,
    ...validation,
  };
}

function summarize(results) {
  const counts = { PASS: 0, FAIL: 0, UNKNOWN: 0, SKIPPED: 0 };
  for (const item of results) {
    if (counts[item.status] === undefined) counts.UNKNOWN++;
    else counts[item.status]++;
  }

  const requiredResults = results.filter(item => item.required);
  const requiredReady = requiredResults.length > 0 &&
    requiredResults.every(item => item.status === STATUS.PASS);
  const anyFailure = counts.FAIL > 0;
  const anyUnknown = counts.UNKNOWN > 0;

  if (!requiredReady || anyFailure) {
    return { counts, state: 'BLOCKED', exitCode: EXIT.BLOCKED };
  }
  if (anyUnknown) {
    return { counts, state: 'DEGRADED', exitCode: EXIT.DEGRADED };
  }
  return { counts, state: 'READY TO DEPLOY', exitCode: EXIT.READY };
}

function printReport(checklistName, results) {
  const separator = '\u2550'.repeat(66);
  const divider = '\u2500'.repeat(66);
  const icons = {
    PASS: '\x1b[32m\u2713 PASS\x1b[0m',
    FAIL: '\x1b[31m\u2717 FAIL\x1b[0m',
    UNKNOWN: '\x1b[33m? UNKNOWN\x1b[0m',
    SKIPPED: '\x1b[36m- SKIPPED\x1b[0m',
  };

  console.log('');
  console.log('  ' + separator);
  console.log('  ' + (checklistName || 'Deployment Checklist'));
  console.log('  ' + separator);

  for (const item of results) {
    const icon = icons[item.status] || icons.UNKNOWN;
    const idPad = ' '.repeat(Math.max(1, 24 - item.id.length));
    console.log(`  ${icon}  ${item.id}${idPad}${item.description}`);
    if (item.status !== STATUS.PASS) console.log(`        \u2514 ${item.detail}`);
  }

  const summary = summarize(results);
  const stateColor = summary.exitCode === EXIT.READY ? '\x1b[32m' :
    summary.exitCode === EXIT.DEGRADED ? '\x1b[33m' : '\x1b[31m';

  console.log('  ' + divider);
  console.log(
    `  Summary: ${summary.counts.PASS} PASS | ${summary.counts.FAIL} FAIL | ` +
    `${summary.counts.UNKNOWN} UNKNOWN | ${summary.counts.SKIPPED} SKIPPED`
  );
  console.log(`  Result: ${stateColor}${summary.state}\x1b[0m`);
  console.log('  ' + divider);
  console.log('');
  return summary;
}

function loadChecklist(checklistPath, context) {
  if (!context.fs.existsSync(checklistPath)) {
    throw new Error(`Checklist not found: ${checklistPath}`);
  }

  let checklist;
  try {
    checklist = JSON.parse(context.fs.readFileSync(checklistPath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid JSON in ${checklistPath}: ${error.message}`);
  }

  if (!Array.isArray(checklist.checks) || checklist.checks.length === 0) {
    throw new Error('Checklist must contain a non-empty "checks" array');
  }
  return checklist;
}

function main(argv = process.argv.slice(2), overrides = {}) {
  const context = createContext(overrides);
  const checklistPath = argv[0] || path.join(__dirname, 'checklist.json');

  try {
    const checklist = loadChecklist(checklistPath, context);
    const results = checklist.checks.map(check => runCheck(check, context));
    return printReport(checklist.name, results).exitCode;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error('Usage: node deploy-check.js [path/to/checklist.json]');
    return EXIT.BLOCKED;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  EXIT,
  STATUS,
  compareOutput,
  createContext,
  listTrackedFiles,
  loadChecklist,
  main,
  printReport,
  resolveGitHookPath,
  runCheck,
  runProcess,
  summarize,
  validateCommand,
  validateFileExists,
  validateGitClean,
  validateGitHook,
  validateNodeRuntime,
  validateScanner,
  validateTrackedTextAbsent,
};
