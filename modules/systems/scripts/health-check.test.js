#!/usr/bin/env node
/**
 * Zero-dependency regression tests for health-check.js.
 * Provider behavior is injected; no host health command is changed or mocked globally.
 */

'use strict';

const assert = require('assert');
const {
  EXIT,
  STATUS,
  checkCPU,
  checkDisk,
  checkMemory,
  checkUptime,
  collectChecks,
  main,
  parsePosixDisk,
  summarizeHealth,
} = require('./health-check');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write(`  ok  ${name}\n`);
  } catch (error) {
    failed++;
    process.stdout.write(`FAIL  ${name}\n      ${error.stack || error.message}\n`);
  }
}

function fakeOs(overrides = {}) {
  return {
    cpus: () => [{}, {}, {}, {}],
    freemem: () => 4 * (1024 ** 3),
    hostname: () => 'fixture-host',
    loadavg: () => [0, 0, 0],
    totalmem: () => 8 * (1024 ** 3),
    uptime: () => 3600,
    ...overrides,
  };
}

function unavailable() {
  const error = new Error('simulated provider unavailable');
  error.code = 'ENOENT';
  throw error;
}

test('provider failure: Windows CPU and disk remain UNKNOWN', () => {
  const overrides = { execFileSync: unavailable, os: fakeOs(), platform: 'win32' };
  const checks = collectChecks(overrides);
  const cpu = checks.find(check => check.label === 'CPU Load');
  const disk = checks.find(check => check.label === 'Disk');
  assert.strictEqual(cpu.statusPlain, STATUS.UNKNOWN);
  assert.strictEqual(cpu.percent, null);
  assert.strictEqual(disk.statusPlain, STATUS.UNKNOWN);
  assert.strictEqual(disk.percent, null);
});

test('provider failure: UNKNOWN produces distinct degraded exit 2', () => {
  const overrides = { execFileSync: unavailable, os: fakeOs(), platform: 'win32' };
  const checks = collectChecks(overrides);
  const summary = summarizeHealth(checks);
  assert.strictEqual(summary.exitCode, EXIT.DEGRADED);
  assert.strictEqual(summary.state, 'DEGRADED');
  assert.strictEqual(summary.counts.UNKNOWN, 2);
});

test('provider failure: CLI main returns degraded exit 2', () => {
  const overrides = { execFileSync: unavailable, os: fakeOs(), platform: 'win32' };
  const originalLog = console.log;
  try {
    console.log = () => {};
    assert.strictEqual(main(overrides), EXIT.DEGRADED);
  } finally {
    console.log = originalLog;
  }
});

test('Windows CPU: invalid WMIC output falls back to PowerShell', () => {
  const calls = [];
  const cpu = checkCPU({
    execFileSync: (command, args) => {
      calls.push({ command, args });
      if (command === 'wmic') return 'LoadPercentage=\r\n';
      if (command === 'powershell') return '42\r\n';
      throw new Error('unexpected command');
    },
    os: fakeOs(),
    platform: 'win32',
  });
  assert.strictEqual(cpu.statusPlain, STATUS.OK);
  assert.strictEqual(cpu.percent, 42);
  assert.deepStrictEqual(calls.map(call => call.command), ['wmic', 'powershell']);
});

test('Windows CPU: multiple processor values are averaged', () => {
  const cpu = checkCPU({
    execFileSync: command => {
      if (command === 'wmic') return 'LoadPercentage=10\r\nLoadPercentage=90\r\n';
      throw new Error('PowerShell fallback should not run');
    },
    os: fakeOs(),
    platform: 'win32',
  });
  assert.strictEqual(cpu.statusPlain, STATUS.OK);
  assert.strictEqual(cpu.percent, 50);
});

test('Windows disk: fixed-drive WMIC data parses without shell syntax', () => {
  let observed;
  const disks = checkDisk({
    execFileSync: (command, args) => {
      observed = { command, args };
      return 'Node,Caption,FreeSpace,Size\r\nHOST,C:,53687091200,107374182400\r\n';
    },
    os: fakeOs(),
    platform: 'win32',
  });
  assert.strictEqual(disks.length, 1);
  assert.strictEqual(disks[0].label, 'Disk C');
  assert.strictEqual(disks[0].percent, 50);
  assert.strictEqual(observed.command, 'wmic');
  assert.deepStrictEqual(observed.args, [
    'logicaldisk', 'where', 'DriveType=3', 'get', 'Caption,FreeSpace,Size', '/format:csv',
  ]);
  assert.ok(!observed.args.some(arg => arg.includes('|')));
});

test('Windows disk: PowerShell fallback parses fixed drives when WMIC is unavailable', () => {
  const calls = [];
  const disks = checkDisk({
    execFileSync: command => {
      calls.push(command);
      if (command === 'wmic') return unavailable();
      return '"DeviceID","FreeSpace","Size"\r\n"C:","53687091200","107374182400"\r\n';
    },
    os: fakeOs(),
    platform: 'win32',
  });
  assert.deepStrictEqual(calls, ['wmic', 'powershell']);
  assert.strictEqual(disks.length, 1);
  assert.strictEqual(disks[0].label, 'Disk C');
  assert.strictEqual(disks[0].percent, 50);
});

test('Windows disk: a malformed drive row remains UNKNOWN when fallback fails', () => {
  const disks = checkDisk({
    execFileSync: command => {
      if (command === 'wmic') {
        return 'Node,Caption,FreeSpace,Size\r\n' +
          'HOST,C:,53687091200,107374182400\r\n' +
          'HOST,D:,,107374182400\r\n';
      }
      return unavailable();
    },
    os: fakeOs(),
    platform: 'win32',
  });
  assert.strictEqual(disks.length, 2);
  assert.strictEqual(disks[0].statusPlain, STATUS.OK);
  assert.strictEqual(disks[1].label, 'Disk D');
  assert.strictEqual(disks[1].statusPlain, STATUS.UNKNOWN);
  assert.strictEqual(summarizeHealth(disks).exitCode, EXIT.DEGRADED);
});

test('Windows disk: a clean fallback subset cannot erase an UNKNOWN drive', () => {
  const disks = checkDisk({
    execFileSync: command => {
      if (command === 'wmic') {
        return 'Node,Caption,FreeSpace,Size\r\n' +
          'HOST,C:,53687091200,107374182400\r\n' +
          'HOST,D:,,107374182400\r\n';
      }
      return '"DeviceID","FreeSpace","Size"\r\n' +
        '"C:","53687091200","107374182400"\r\n';
    },
    os: fakeOs(),
    platform: 'win32',
  });
  assert.strictEqual(disks.length, 2);
  assert.strictEqual(disks.find(check => check.label === 'Disk C').statusPlain, STATUS.OK);
  assert.strictEqual(disks.find(check => check.label === 'Disk D').statusPlain, STATUS.UNKNOWN);
  assert.strictEqual(summarizeHealth(disks).exitCode, EXIT.DEGRADED);
});

test('Windows disk: a later healthy fallback cannot erase an earlier critical drive', () => {
  const disks = checkDisk({
    execFileSync: command => {
      if (command === 'wmic') {
        return 'Node,Caption,FreeSpace,Size\r\n' +
          'HOST,C:,5368709120,107374182400\r\n' +
          'HOST,D:,,107374182400\r\n';
      }
      return '"DeviceID","FreeSpace","Size"\r\n' +
        '"C:","53687091200","107374182400"\r\n' +
        '"D:","53687091200","107374182400"\r\n';
    },
    os: fakeOs(),
    platform: 'win32',
  });
  const systemDisk = disks.find(check => check.label === 'Disk C');
  assert.strictEqual(systemDisk.statusPlain, STATUS.CRITICAL);
  assert.strictEqual(systemDisk.percent, 95);
  assert.strictEqual(disks.find(check => check.label === 'Disk D').statusPlain, STATUS.OK);
  assert.strictEqual(summarizeHealth(disks).exitCode, EXIT.CRITICAL);
});

test('Linux confidence: zero load is valid 0% rather than a Windows fallback', () => {
  let called = false;
  const cpu = checkCPU({
    execFileSync: () => { called = true; throw new Error('must not run'); },
    os: fakeOs({ loadavg: () => [0, 0, 0] }),
    platform: 'linux',
  });
  assert.strictEqual(cpu.statusPlain, STATUS.OK);
  assert.strictEqual(cpu.percent, 0);
  assert.strictEqual(called, false);
});

test('Linux confidence: disk uses df argument array with no pipe or tail', () => {
  let observed;
  const disks = checkDisk({
    execFileSync: (command, args, options) => {
      observed = { command, args, options };
      return 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/root 104857600 52428800 52428800 50% /\n';
    },
    os: fakeOs(),
    platform: 'linux',
  });
  assert.strictEqual(disks.length, 1);
  assert.strictEqual(disks[0].statusPlain, STATUS.OK);
  assert.strictEqual(disks[0].percent, 50);
  assert.strictEqual(observed.command, 'df');
  assert.deepStrictEqual(observed.args, ['-kP', '/']);
  assert.ok(!observed.args.some(arg => /\||tail/.test(arg)));
  assert.strictEqual(observed.options.shell, undefined);
});

test('Linux provider parse failure is UNKNOWN, not 0% OK', () => {
  const disks = checkDisk({
    execFileSync: () => 'not usable\n',
    os: fakeOs(),
    platform: 'linux',
  });
  assert.strictEqual(disks[0].statusPlain, STATUS.UNKNOWN);
  assert.strictEqual(disks[0].percent, null);
});

test('memory: invalid provider data is UNKNOWN', () => {
  const memory = checkMemory({
    os: fakeOs({ totalmem: () => 0 }),
    platform: 'linux',
  });
  assert.strictEqual(memory.statusPlain, STATUS.UNKNOWN);
});

test('Node OS provider exceptions remain UNKNOWN and produce DEGRADED', () => {
  const osProvider = fakeOs({
    loadavg: unavailable,
    totalmem: unavailable,
    uptime: unavailable,
  });
  const checks = [
    checkCPU({ os: osProvider, platform: 'linux' }),
    checkMemory({ os: osProvider, platform: 'linux' }),
    checkUptime({ os: osProvider, platform: 'linux' }),
  ];
  assert.ok(checks.every(check => check.statusPlain === STATUS.UNKNOWN));
  assert.strictEqual(summarizeHealth(checks).exitCode, EXIT.DEGRADED);
});

test('summary: CRITICAL takes precedence while UNKNOWN stays counted', () => {
  const summary = summarizeHealth([
    { statusPlain: STATUS.CRITICAL },
    { statusPlain: STATUS.UNKNOWN },
    { statusPlain: STATUS.SKIPPED },
  ]);
  assert.strictEqual(summary.exitCode, EXIT.CRITICAL);
  assert.strictEqual(summary.counts.CRITICAL, 1);
  assert.strictEqual(summary.counts.UNKNOWN, 1);
  assert.strictEqual(summary.counts.SKIPPED, 1);
});

test('summary: zero collected checks is DEGRADED, never HEALTHY', () => {
  const summary = summarizeHealth([]);
  assert.strictEqual(summary.exitCode, EXIT.DEGRADED);
  assert.strictEqual(summary.state, 'DEGRADED');
});

test('POSIX parser: portable df output is accepted deterministically', () => {
  const disk = parsePosixDisk(
    'Filesystem 1024-blocks Used Available Capacity Mounted on\n' +
    '/dev/root 209715200 104857600 104857600 50% /\n'
  );
  assert.ok(disk);
  assert.strictEqual(disk.percent, 50);
  assert.strictEqual(disk.value, '50% used (100.0 GB free / 200.0 GB total)');
});

test('POSIX parser: impossible free-space totals are rejected', () => {
  const disk = parsePosixDisk(
    'Filesystem 1024-blocks Used Available Capacity Mounted on\n' +
    '/dev/root 100 0 101 0% /\n'
  );
  assert.strictEqual(disk, null);
});

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
