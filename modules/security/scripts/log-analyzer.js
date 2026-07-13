#!/usr/bin/env node
/**
 * log-analyzer.js — Security Log Analyzer
 *
 * Scans authentication/security logs for suspicious patterns:
 *   - Brute force: 5+ failed logins from same user
 *   - Impossible travel: same user, different locations, <60 min apart
 *   - Privilege escalation: admin group additions, role changes
 *   - After-hours access: logins outside 07:00-19:00 local time
 *
 * Usage:
 *   node modules/security/scripts/log-analyzer.js
 *   node modules/security/scripts/log-analyzer.js path/to/custom-logs.json
 *
 * Input: JSON array of log entries (see sample-logs.json for format)
 * Output: Security findings report with severity ratings
 *
 * No external dependencies — Node.js core only.
 */

const fs = require('fs');
const path = require('path');

// ── Configuration ────────────────────────────────────────────────────────────

/** Threshold for failed login attempts before flagging as brute force */
const FAILED_LOGIN_THRESHOLD = 5;

/** Maximum minutes between logins to flag as impossible travel */
const IMPOSSIBLE_TRAVEL_MINUTES = 60;

/** Business hours range (24h format) — logins outside this are flagged */
const BUSINESS_HOURS_START = 7;
const BUSINESS_HOURS_END = 19;

// ── Detection Functions ──────────────────────────────────────────────────────

/**
 * Detects brute force attempts — users with repeated failed logins.
 * @param {Array} logs - Array of log entry objects
 * @returns {Array} Array of finding objects with severity, description, details
 */
function detectBruteForce(logs) {
  const findings = [];
  const failedByUser = {};

  // Count failed logins per user
  for (const entry of logs) {
    if (entry.action === 'login_failed') {
      if (!failedByUser[entry.user]) {
        failedByUser[entry.user] = [];
      }
      failedByUser[entry.user].push(entry);
    }
  }

  // Flag users exceeding threshold
  for (const [user, attempts] of Object.entries(failedByUser)) {
    if (attempts.length >= FAILED_LOGIN_THRESHOLD) {
      const sourceIps = [...new Set(attempts.map(a => a.source_ip))];
      findings.push({
        severity: 'CRITICAL',
        type: 'Brute Force Attempt',
        description: `${attempts.length} failed logins for ${user}`,
        details: `Source IP(s): ${sourceIps.join(', ')} | ` +
                 `First attempt: ${attempts[0].timestamp} | ` +
                 `Last attempt: ${attempts[attempts.length - 1].timestamp}`
      });
    }
  }

  return findings;
}

/**
 * Detects impossible travel — same user logging in from distant locations
 * within a short time window.
 * @param {Array} logs - Array of log entry objects
 * @returns {Array} Array of finding objects
 */
function detectImpossibleTravel(logs) {
  const findings = [];
  const loginsByUser = {};

  // Group successful logins by user
  for (const entry of logs) {
    if (entry.action === 'login_success') {
      if (!loginsByUser[entry.user]) {
        loginsByUser[entry.user] = [];
      }
      loginsByUser[entry.user].push(entry);
    }
  }

  // Check for location changes within the time window
  for (const [user, logins] of Object.entries(loginsByUser)) {
    // Sort by timestamp
    logins.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (let i = 1; i < logins.length; i++) {
      const prev = logins[i - 1];
      const curr = logins[i];

      // Skip if same location
      if (prev.location === curr.location) continue;

      const timeDiffMs = new Date(curr.timestamp) - new Date(prev.timestamp);
      const timeDiffMin = timeDiffMs / (1000 * 60);

      if (timeDiffMin <= IMPOSSIBLE_TRAVEL_MINUTES) {
        findings.push({
          severity: 'CRITICAL',
          type: 'Impossible Travel',
          description: `${user} logged in from two locations ${Math.round(timeDiffMin)} min apart`,
          details: `${prev.location} (${prev.source_ip}) at ${prev.timestamp} → ` +
                   `${curr.location} (${curr.source_ip}) at ${curr.timestamp}`
        });
      }
    }
  }

  return findings;
}

/**
 * Detects privilege escalation events — admin group additions, role changes.
 * @param {Array} logs - Array of log entry objects
 * @returns {Array} Array of finding objects
 */
function detectPrivilegeEscalation(logs) {
  const findings = [];

  for (const entry of logs) {
    if (entry.action === 'privilege_escalation') {
      findings.push({
        severity: 'HIGH',
        type: 'Privilege Escalation',
        description: `${entry.user} — ${entry.details}`,
        details: `Source: ${entry.source_ip} (${entry.location}) at ${entry.timestamp}`
      });
    }
  }

  return findings;
}

/**
 * Detects after-hours access — logins outside normal business hours.
 * @param {Array} logs - Array of log entry objects
 * @returns {Array} Array of finding objects
 */
function detectAfterHours(logs) {
  const findings = [];

  for (const entry of logs) {
    if (entry.action === 'login_success') {
      const hour = new Date(entry.timestamp).getUTCHours();
      if (hour < BUSINESS_HOURS_START || hour >= BUSINESS_HOURS_END) {
        findings.push({
          severity: 'MEDIUM',
          type: 'After-Hours Access',
          description: `${entry.user} logged in at ${entry.timestamp.split('T')[1].replace('Z', '')} UTC`,
          details: `Source: ${entry.source_ip} (${entry.location}) | ${entry.details}`
        });
      }
    }
  }

  return findings;
}

// ── Report Formatting ────────────────────────────────────────────────────────

/**
 * Formats severity with consistent padding for report output.
 * @param {string} severity - CRITICAL, HIGH, MEDIUM, or LOW
 * @returns {string} Padded severity string
 */
function formatSeverity(severity) {
  const icons = {
    CRITICAL: '\x1b[31mCRITICAL\x1b[0m',
    HIGH:     '\x1b[33mHIGH    \x1b[0m',
    MEDIUM:   '\x1b[36mMEDIUM  \x1b[0m',
    LOW:      '\x1b[32mLOW     \x1b[0m'
  };
  return icons[severity] || severity;
}

/**
 * Prints the full analysis report to stdout.
 * @param {Array} findings - Array of all finding objects
 * @param {string} logFile - Path to the log file analyzed
 * @param {number} totalEntries - Total number of log entries processed
 */
function printReport(findings, logFile, totalEntries) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  console.log('');
  console.log('\u2550'.repeat(60));
  console.log('  Security Log Analysis Report');
  console.log('  Generated: ' + now);
  console.log('  Source:     ' + logFile);
  console.log('  Entries:    ' + totalEntries);
  console.log('\u2550'.repeat(60));

  if (findings.length === 0) {
    console.log('');
    console.log('  \u2713 No suspicious activity detected.');
    console.log('');
    return;
  }

  // Sort by severity (CRITICAL first)
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  console.log('');
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    console.log(`  [${formatSeverity(f.severity)}]  ${f.type}`);
    console.log(`           ${f.description}`);
    console.log(`           ${f.details}`);
    console.log('');
  }

  // Summary counts
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] || 0) + 1;
  }

  console.log('\u2500'.repeat(60));
  console.log(`  Summary: ${findings.length} finding(s)`);
  console.log(`  CRITICAL: ${counts.CRITICAL} | HIGH: ${counts.HIGH} | MEDIUM: ${counts.MEDIUM} | LOW: ${counts.LOW}`);
  console.log('\u2500'.repeat(60));
  console.log('');
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // Determine log file path — CLI arg or default to sample-logs.json
  const logFile = process.argv[2] || path.join(__dirname, 'sample-logs.json');

  try {
    // Verify file exists
    if (!fs.existsSync(logFile)) {
      console.error(`Error: Log file not found: ${logFile}`);
      console.error('Usage: node log-analyzer.js [path/to/logs.json]');
      process.exit(1);
    }

    // Read and parse log data
    const raw = fs.readFileSync(logFile, 'utf8');
    let logs;

    try {
      logs = JSON.parse(raw);
    } catch (parseErr) {
      console.error(`Error: Invalid JSON in ${logFile} — ${parseErr.message}`);
      process.exit(1);
    }

    if (!Array.isArray(logs)) {
      console.error('Error: Log file must contain a JSON array of entries.');
      process.exit(1);
    }

    // Run all detection modules
    const findings = [
      ...detectBruteForce(logs),
      ...detectImpossibleTravel(logs),
      ...detectPrivilegeEscalation(logs),
      ...detectAfterHours(logs)
    ];

    // Print report
    printReport(findings, logFile, logs.length);

    // Exit code: 1 if critical findings, 0 otherwise
    const hasCritical = findings.some(f => f.severity === 'CRITICAL');
    process.exit(hasCritical ? 1 : 0);

  } catch (err) {
    console.error(`Unexpected error: ${err.message}`);
    process.exit(1);
  }
}

main();
