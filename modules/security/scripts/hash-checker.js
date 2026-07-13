#!/usr/bin/env node
/**
 * hash-checker.js — File Hash Generator & Known-Bad Checker
 *
 * Generates MD5, SHA1, and SHA256 hashes for any file and optionally
 * checks them against a local list of known-bad hashes.
 *
 * Usage:
 *   node modules/security/scripts/hash-checker.js <file-path>
 *   node modules/security/scripts/hash-checker.js package.json
 *   node modules/security/scripts/hash-checker.js C:\Users\admin\Downloads\installer.exe
 *
 * No external dependencies — Node.js core only (fs, crypto, path).
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// ── Known-Bad Hash List ──────────────────────────────────────────────────────
// In production, this would be loaded from a threat intelligence feed or
// local database. These are example hashes for demonstration purposes.

const KNOWN_BAD_HASHES = [
  { hash: 'd41d8cd98f00b204e9800998ecf8427e', algo: 'md5',    label: 'Empty file (potential dropper placeholder)' },
  { hash: '5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8', algo: 'sha1', label: 'Known weak credential hash' },
  { hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', algo: 'sha256', label: 'Empty file SHA256' },
  { hash: '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f', algo: 'sha256', label: 'EICAR test file signature' },
];

// ── Hash Generation ──────────────────────────────────────────────────────────

/**
 * Generates a hash of a file using the specified algorithm.
 * Reads the file as a stream to handle large files efficiently.
 * @param {string} filePath - Absolute or relative path to the file
 * @param {string} algorithm - Hash algorithm (md5, sha1, sha256)
 * @returns {Promise<string>} Hex-encoded hash string
 */
function hashFile(filePath, algorithm) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Checks a hash against the known-bad list.
 * @param {string} hashValue - The hash to check
 * @param {string} algorithm - Which algorithm produced this hash
 * @returns {object|null} Matching entry from KNOWN_BAD_HASHES, or null if clean
 */
function checkKnownBad(hashValue, algorithm) {
  return KNOWN_BAD_HASHES.find(
    (entry) => entry.hash === hashValue && entry.algo === algorithm
  ) || null;
}

/**
 * Formats a file size in bytes to a human-readable string.
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted string (e.g., "2,481 bytes" or "1.5 MB")
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes.toLocaleString() + ' bytes';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// ── Report Output ────────────────────────────────────────────────────────────

/**
 * Prints the hash report for a file.
 * @param {string} filePath - Path to the file
 * @param {object} hashes - Object with md5, sha1, sha256 hash strings
 * @param {number} fileSize - File size in bytes
 * @param {Array} matches - Array of known-bad matches found
 */
function printReport(filePath, hashes, fileSize, matches) {
  const separator = '\u2500'.repeat(50);
  const fileName = path.basename(filePath);

  console.log('');
  console.log('  File Hash Report');
  console.log('  ' + separator);
  console.log(`  File:    ${fileName}`);
  console.log(`  Path:    ${path.resolve(filePath)}`);
  console.log(`  Size:    ${formatSize(fileSize)}`);
  console.log('  ' + separator);
  console.log(`  MD5:     ${hashes.md5}`);
  console.log(`  SHA1:    ${hashes.sha1}`);
  console.log(`  SHA256:  ${hashes.sha256}`);
  console.log('  ' + separator);

  if (matches.length === 0) {
    console.log('  Known-bad check: \x1b[32m\u2713 CLEAN\x1b[0m');
  } else {
    console.log('  Known-bad check: \x1b[31m\u2717 MATCH FOUND\x1b[0m');
    for (const match of matches) {
      console.log(`    \u2514 ${match.algo.toUpperCase()}: ${match.label}`);
    }
  }

  console.log('  ' + separator);
  console.log('');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2];

  // Validate input
  if (!filePath) {
    console.error('Usage: node hash-checker.js <file-path>');
    console.error('');
    console.error('Example:');
    console.error('  node hash-checker.js package.json');
    console.error('  node hash-checker.js /path/to/suspicious-file.exe');
    process.exit(1);
  }

  // Check file exists
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Check it's a file, not a directory
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    console.error(`Error: Path is not a file: ${filePath}`);
    process.exit(1);
  }

  try {
    // Generate all three hashes
    const [md5, sha1, sha256] = await Promise.all([
      hashFile(filePath, 'md5'),
      hashFile(filePath, 'sha1'),
      hashFile(filePath, 'sha256')
    ]);

    const hashes = { md5, sha1, sha256 };

    // Check each hash against known-bad list
    const matches = [];
    for (const [algo, value] of Object.entries(hashes)) {
      const match = checkKnownBad(value, algo);
      if (match) matches.push(match);
    }

    // Print report
    printReport(filePath, hashes, stat.size, matches);

    // Exit 1 if known-bad match found
    process.exit(matches.length > 0 ? 1 : 0);

  } catch (err) {
    console.error(`Error hashing file: ${err.message}`);
    process.exit(1);
  }
}

main();
