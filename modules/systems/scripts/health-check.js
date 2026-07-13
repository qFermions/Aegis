#!/usr/bin/env node
/**
 * health-check.js — System Health Reporter
 *
 * Checks CPU load, memory usage, disk space, and system uptime.
 * Reports OK (<70%), WARNING (70-90%), CRITICAL (>90%), or UNKNOWN.
 * Provider failures remain UNKNOWN and produce a distinct degraded exit.
 *
 * Usage:
 *   node modules/systems/scripts/health-check.js
 *
 * Exit 0 = no critical or unknown checks (warnings may be present)
 * Exit 1 = one or more critical checks, or an internal reporter error
 * Exit 2 = degraded because one or more checks are unknown or skipped
 *
 * No external dependencies — Node.js core only (os, child_process).
 */

'use strict';

const os = require('os');
const { execFileSync } = require('child_process');

const THRESHOLD_OK = 70;
const THRESHOLD_WARNING = 90;

const STATUS = Object.freeze({
  OK: 'OK',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'UNKNOWN',
  SKIPPED: 'SKIPPED',
});

const EXIT = Object.freeze({
  HEALTHY: 0,
  CRITICAL: 1,
  DEGRADED: 2,
});

const STATUS_COLORED = Object.freeze({
  OK: '\x1b[32mOK\x1b[0m',
  WARNING: '\x1b[33mWARNING\x1b[0m',
  CRITICAL: '\x1b[31mCRITICAL\x1b[0m',
  UNKNOWN: '\x1b[33mUNKNOWN\x1b[0m',
  SKIPPED: '\x1b[36mSKIPPED\x1b[0m',
});

function createContext(overrides = {}) {
  return {
    execFileSync: overrides.execFileSync || execFileSync,
    os: overrides.os || os,
    platform: overrides.platform || process.platform,
  };
}

function getStatusPlain(percent) {
  if (percent < THRESHOLD_OK) return STATUS.OK;
  if (percent < THRESHOLD_WARNING) return STATUS.WARNING;
  return STATUS.CRITICAL;
}

function makeCheck(label, value, statusPlain, percent = null, detail = '') {
  return {
    label,
    value,
    percent,
    status: STATUS_COLORED[statusPlain] || STATUS_COLORED.UNKNOWN,
    statusPlain,
    detail,
  };
}

function makeUsageCheck(label, value, percent) {
  const statusPlain = getStatusPlain(percent);
  return makeCheck(label, value, statusPlain, percent);
}

function makeUnknownCheck(label, detail) {
  return makeCheck(label, 'Unable to determine', STATUS.UNKNOWN, null, detail);
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ') || '< 1m';
}

function compactError(error) {
  const stderr = error && error.stderr ? String(error.stderr).trim() : '';
  const message = error && error.message ? error.message : String(error);
  return (stderr || message).replace(/\s+/g, ' ').slice(0, 160);
}

function runTool(command, args, context, timeout) {
  try {
    const output = context.execFileSync(command, args, {
      encoding: 'utf8',
      timeout,
      windowsHide: true,
    });
    return { ok: true, output: String(output || '') };
  } catch (error) {
    return { ok: false, detail: `${command}: ${compactError(error)}` };
  }
}

function validPercent(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function averagePercentValues(rawValues) {
  if (!Array.isArray(rawValues) || rawValues.length === 0) return null;
  const values = rawValues.map(rawValue => {
    const normalized = String(rawValue).trim();
    return /^\d+$/.test(normalized) ? Number(normalized) : Number.NaN;
  });
  if (values.some(value => !validPercent(value))) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function checkCPU(overrides = {}) {
  const context = createContext(overrides);

  if (context.platform !== 'win32') {
    let loadAverage;
    let cpuCount;
    try {
      const loadAverages = context.os.loadavg();
      const cpus = context.os.cpus();
      loadAverage = Array.isArray(loadAverages) ? loadAverages[0] : Number.NaN;
      cpuCount = Array.isArray(cpus) ? cpus.length : 0;
    } catch (error) {
      return makeUnknownCheck('CPU Load', `Node.js CPU provider failed: ${compactError(error)}`);
    }
    if (!Number.isFinite(loadAverage) || loadAverage < 0 || cpuCount < 1) {
      return makeUnknownCheck('CPU Load', 'Node.js did not return a usable load average or CPU count');
    }
    const loadPercent = Math.round((loadAverage / cpuCount) * 100);
    return makeUsageCheck('CPU Load', `${loadPercent}%`, loadPercent);
  }

  const failures = [];
  const wmic = runTool('wmic', ['cpu', 'get', 'loadpercentage', '/value'], context, 5000);
  if (wmic.ok) {
    const values = [...wmic.output.matchAll(/LoadPercentage=([^\r\n]*)/gi)]
      .map(match => match[1]);
    const loadPercent = averagePercentValues(values);
    if (loadPercent !== null) return makeUsageCheck('CPU Load', `${loadPercent}%`, loadPercent);
    failures.push('wmic returned no usable CPU percentage');
  } else {
    failures.push(wmic.detail);
  }

  const powershell = runTool(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', '(Get-CimInstance Win32_Processor).LoadPercentage'],
    context,
    10000
  );
  if (powershell.ok) {
    const values = powershell.output.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    const loadPercent = averagePercentValues(values);
    if (loadPercent !== null) return makeUsageCheck('CPU Load', `${loadPercent}%`, loadPercent);
    failures.push('PowerShell returned no usable CPU percentage');
  } else {
    failures.push(powershell.detail);
  }

  return makeUnknownCheck('CPU Load', failures.join('; '));
}

function checkMemory(overrides = {}) {
  const context = createContext(overrides);
  let totalMem;
  let freeMem;
  try {
    totalMem = context.os.totalmem();
    freeMem = context.os.freemem();
  } catch (error) {
    return makeUnknownCheck('Memory Usage', `Node.js memory provider failed: ${compactError(error)}`);
  }
  if (!Number.isFinite(totalMem) || totalMem <= 0 || !Number.isFinite(freeMem) ||
      freeMem < 0 || freeMem > totalMem) {
    return makeUnknownCheck('Memory Usage', 'Node.js did not return usable memory totals');
  }

  const usedMem = Math.max(0, totalMem - freeMem);
  const percent = Math.round((usedMem / totalMem) * 100);
  const usedGB = (usedMem / (1024 ** 3)).toFixed(1);
  const totalGB = (totalMem / (1024 ** 3)).toFixed(1);
  return makeUsageCheck('Memory Usage', `${percent}% (${usedGB} / ${totalGB} GB)`, percent);
}

function diskCheck(drive, freeSpace, totalSize) {
  if (!Number.isFinite(freeSpace) || freeSpace < 0 || !Number.isFinite(totalSize) ||
      totalSize <= 0 || freeSpace > totalSize) {
    return null;
  }
  const usedPercent = Math.round(((totalSize - freeSpace) / totalSize) * 100);
  const freeGB = (freeSpace / (1024 ** 3)).toFixed(1);
  const totalGB = (totalSize / (1024 ** 3)).toFixed(1);
  const cleanDrive = String(drive).replace(/:$/, '');
  return makeUsageCheck(
    `Disk ${cleanDrive}`,
    `${usedPercent}% used (${freeGB} GB free / ${totalGB} GB total)`,
    usedPercent
  );
}

function diskProviderCheck(provider, driveRaw, freeRaw, totalRaw) {
  const drive = String(driveRaw || '').trim();
  const free = String(freeRaw || '').trim();
  const total = String(totalRaw || '').trim();
  const validDrive = /^[A-Z]:$/i.test(drive);
  const label = validDrive ? `Disk ${drive.slice(0, -1).toUpperCase()}` : 'Disk';

  if (!validDrive || !/^\d+$/.test(free) || !/^\d+$/.test(total)) {
    return makeUnknownCheck(label, `${provider} returned incomplete fixed-disk data`);
  }

  const check = diskCheck(drive, Number(free), Number(total));
  return check || makeUnknownCheck(label, `${provider} returned impossible fixed-disk totals`);
}

function parseWmicDisks(output) {
  const results = [];
  const lines = output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^(Node,)?Caption,/i.test(line)) continue;
    const parts = line.split(',');
    if (parts.length !== 4) {
      results.push(makeUnknownCheck('Disk', 'WMIC returned a malformed fixed-disk row'));
      continue;
    }
    results.push(diskProviderCheck('WMIC', parts[1], parts[2], parts[3]));
  }
  return results;
}

function parsePowerShellDisks(output) {
  const results = [];
  const lines = output.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return results;
  if (!/^"?DeviceID"?,"?FreeSpace"?,"?Size"?$/i.test(lines[0])) {
    return [makeUnknownCheck('Disk', 'PowerShell returned an invalid fixed-disk header')];
  }

  for (const line of lines.slice(1)) {
    const match = line.match(/^"?([A-Z]:)"?,"?([^",]*)"?,"?([^",]*)"?$/i);
    if (!match) {
      results.push(makeUnknownCheck('Disk', 'PowerShell returned a malformed fixed-disk row'));
      continue;
    }
    results.push(diskProviderCheck('PowerShell', match[1], match[2], match[3]));
  }
  return results;
}

function parsePosixDisk(output) {
  const lines = output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const parts = lines[lines.length - 1].split(/\s+/);
  if (parts.length < 6) return null;

  const totalKb = Number(parts[1]);
  const freeKb = Number(parts[3]);
  const usedPercent = Number.parseInt(parts[4], 10);
  if (!Number.isFinite(totalKb) || totalKb <= 0 || !Number.isFinite(freeKb) ||
      freeKb < 0 || freeKb > totalKb || !validPercent(usedPercent)) return null;

  const freeGB = (freeKb / (1024 ** 2)).toFixed(1);
  const totalGB = (totalKb / (1024 ** 2)).toFixed(1);
  return makeUsageCheck(
    'Disk /',
    `${usedPercent}% used (${freeGB} GB free / ${totalGB} GB total)`,
    usedPercent
  );
}

function checkDisk(overrides = {}) {
  const context = createContext(overrides);
  const failures = [];
  let partialDisks = null;

  function mergeDiskResults(current, candidate) {
    const merged = new Map(current.map(check => [check.label, check]));
    for (const check of candidate) {
      const existing = merged.get(check.label);
      if (!existing ||
          (existing.statusPlain === STATUS.UNKNOWN && check.statusPlain !== STATUS.UNKNOWN)) {
        merged.set(check.label, check);
        continue;
      }
      if (existing.statusPlain === STATUS.UNKNOWN || check.statusPlain === STATUS.UNKNOWN) {
        continue;
      }

      // Providers are fallbacks, not an authority ordering. When two usable
      // measurements disagree, retain the worse observation so a later stale
      // or partial provider cannot turn an earlier critical disk into healthy.
      const severity = { OK: 0, WARNING: 1, CRITICAL: 2 };
      const existingSeverity = severity[existing.statusPlain] ?? 3;
      const candidateSeverity = severity[check.statusPlain] ?? 3;
      if (candidateSeverity > existingSeverity ||
          (candidateSeverity === existingSeverity &&
           Number.isFinite(check.percent) && Number.isFinite(existing.percent) &&
           check.percent > existing.percent)) {
        merged.set(check.label, check);
      }
    }
    return [...merged.values()];
  }

  function recordProviderResult(provider, disks) {
    if (disks.length === 0) {
      failures.push(`${provider} returned no usable fixed-disk data`);
      return null;
    }
    const reconciled = partialDisks ? mergeDiskResults(partialDisks, disks) : disks;
    if (reconciled.every(check => check.statusPlain !== STATUS.UNKNOWN)) return reconciled;
    failures.push(`${provider} returned incomplete fixed-disk data`);
    partialDisks = reconciled;
    return null;
  }

  if (context.platform === 'win32') {
    const wmic = runTool(
      'wmic',
      ['logicaldisk', 'where', 'DriveType=3', 'get', 'Caption,FreeSpace,Size', '/format:csv'],
      context,
      10000
    );
    if (wmic.ok) {
      const disks = parseWmicDisks(wmic.output);
      const resolved = recordProviderResult('wmic', disks);
      if (resolved) return resolved;
    } else {
      failures.push(wmic.detail);
    }

    const powershell = runTool(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,FreeSpace,Size | ConvertTo-Csv -NoTypeInformation',
      ],
      context,
      10000
    );
    if (powershell.ok) {
      const disks = parsePowerShellDisks(powershell.output);
      const resolved = recordProviderResult('PowerShell', disks);
      if (resolved) return resolved;
    } else {
      failures.push(powershell.detail);
    }

    return partialDisks || [makeUnknownCheck('Disk', failures.join('; '))];
  }

  const df = runTool('df', ['-kP', '/'], context, 5000);
  if (!df.ok) return [makeUnknownCheck('Disk /', df.detail)];
  const disk = parsePosixDisk(df.output);
  return disk
    ? [disk]
    : [makeUnknownCheck('Disk /', 'df returned no usable filesystem data')];
}

function checkUptime(overrides = {}) {
  const context = createContext(overrides);
  let uptimeSeconds;
  try {
    uptimeSeconds = context.os.uptime();
  } catch (error) {
    return makeUnknownCheck('System Uptime', `Node.js uptime provider failed: ${compactError(error)}`);
  }
  if (!Number.isFinite(uptimeSeconds) || uptimeSeconds < 0) {
    return makeUnknownCheck('System Uptime', 'Node.js did not return a usable uptime');
  }
  return makeCheck('System Uptime', formatUptime(uptimeSeconds), STATUS.OK, null);
}

function summarizeHealth(checks) {
  const counts = { OK: 0, WARNING: 0, CRITICAL: 0, UNKNOWN: 0, SKIPPED: 0 };
  if (!Array.isArray(checks) || checks.length === 0) {
    return { counts, state: 'DEGRADED', exitCode: EXIT.DEGRADED };
  }
  for (const check of checks) {
    if (counts[check.statusPlain] === undefined) counts.UNKNOWN++;
    else counts[check.statusPlain]++;
  }

  if (counts.CRITICAL > 0) {
    return { counts, state: 'CRITICAL', exitCode: EXIT.CRITICAL };
  }
  if (counts.UNKNOWN > 0 || counts.SKIPPED > 0) {
    return { counts, state: 'DEGRADED', exitCode: EXIT.DEGRADED };
  }
  return {
    counts,
    state: counts.WARNING > 0 ? 'HEALTHY WITH WARNINGS' : 'HEALTHY',
    exitCode: EXIT.HEALTHY,
  };
}

function printReport(checks, overrides = {}) {
  const context = createContext(overrides);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const hostname = context.os.hostname();
  const separator = '\u2550'.repeat(66);
  const divider = '\u2500'.repeat(66);

  console.log('');
  console.log('  ' + separator);
  console.log(`  System Health Report \u2014 ${hostname}`);
  console.log(`  ${now}`);
  console.log('  ' + separator);

  for (const check of checks) {
    const padding = ' '.repeat(Math.max(1, 22 - check.label.length));
    console.log(`  ${check.label}:${padding}${check.value}  [${check.status}]`);
    if (check.detail) console.log(`    \u2514 ${check.detail}`);
  }

  const summary = summarizeHealth(checks);
  console.log('  ' + divider);
  console.log(
    `  Summary: ${summary.counts.OK} OK | ${summary.counts.WARNING} WARNING | ` +
    `${summary.counts.CRITICAL} CRITICAL | ${summary.counts.UNKNOWN} UNKNOWN | ` +
    `${summary.counts.SKIPPED} SKIPPED`
  );
  console.log(`  Result: ${summary.state}`);
  console.log('  ' + divider);
  console.log('');
  return summary;
}

function collectChecks(overrides = {}) {
  return [
    checkCPU(overrides),
    checkMemory(overrides),
    ...checkDisk(overrides),
    checkUptime(overrides),
  ];
}

function main(overrides = {}) {
  try {
    const checks = collectChecks(overrides);
    return printReport(checks, overrides).exitCode;
  } catch (error) {
    console.error(`Health check error: ${error.message}`);
    return EXIT.CRITICAL;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  EXIT,
  STATUS,
  checkCPU,
  checkDisk,
  checkMemory,
  checkUptime,
  collectChecks,
  createContext,
  diskCheck,
  formatUptime,
  getStatusPlain,
  main,
  makeUnknownCheck,
  parsePosixDisk,
  parsePowerShellDisks,
  parseWmicDisks,
  printReport,
  runTool,
  summarizeHealth,
};
