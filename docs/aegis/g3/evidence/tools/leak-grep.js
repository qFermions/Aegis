'use strict';
// leak-grep.js <base>: the charter's D10 grep over `git log -p <base>..HEAD`, grouped by
// file and keyword so every hit can be explained, then a second pass over added lines for
// real credential shapes, and a list of every URL host and mail domain added lines name.
// Run from the repository root: node docs/aegis/g3/evidence/tools/leak-grep.js f185071
const { execFileSync } = require('node:child_process');

const base = process.argv[2];
if (!/^[0-9a-f]{7,40}$/.test(base || '')) { console.error('usage: leak-grep.js <base commit>'); process.exit(1); }
const log = execFileSync('git', ['log', '-p', '--no-color', `${base}..HEAD`], { maxBuffer: 1 << 30, encoding: 'utf8' });
// the charter's expression (as grep -E receives it: C:\\Users is one backslash), case-insensitive
const charter = /api[_-]?key|secret|token|password|\/Users\/|C:\\Users|@gmail/i;
// a personal path or mail, over every line: /Users/ case-sensitive (so the API path /users/ is not
// one); a Windows home path in any case, with one backslash or the two a JS or JSON string holds;
// @gmail in any case
const personal = /\/Users\/|[Cc]:\\{1,2}[Uu][Ss][Ee][Rr][Ss]|@[Gg][Mm][Aa][Ii][Ll]/;
const shapes = [
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/],
  ['Okta SSWS token', /\b00[A-Za-z0-9_-]{40}\b/],
  ['Microsoft client secret', /[A-Za-z0-9_.-]{3}\dQ~[A-Za-z0-9~._-]{31,34}/],
  ['Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ['Linear key', /\blin_api_[A-Za-z0-9]{32,}/],
  ['Google API key or token', /\bAIza[0-9A-Za-z_-]{35}\b|\bya29\.[0-9A-Za-z_-]{20,}/],
  ['AWS key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
let file = '';
let n = 0;
const byFile = new Map();
const keywords = {};
const shapeHits = [];
const personalHits = [];
const hosts = new Map(); // URL host -> added lines naming it
const mailDomains = new Map(); // mail domain -> added lines naming it
const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
for (const line of log.split('\n')) {
  n += 1;
  const d = line.match(/^diff --git a\/(\S+)/);
  // a commit's header and message belong to no file until its first diff header
  if (/^commit [0-9a-f]{40}\b/.test(line)) file = `(commit ${line.slice(7, 14)} header and message)`;
  if (d) file = d[1]; // the header line is still searched, as the charter grep searches it
  const m = line.match(charter);
  if (m) {
    const k = m[0].toLowerCase();
    keywords[k] = (keywords[k] || 0) + 1;
    byFile.set(file, (byFile.get(file) || 0) + 1);
  }
  if (personal.test(line)) personalHits.push(`${n}: ${file}: ${line.slice(0, 160)}`);
  if (line.startsWith('+')) for (const [name, re] of shapes) if (re.test(line)) shapeHits.push(`${n}: ${name}: ${file}: ${line.trim().slice(0, 140)}`);
  if (line.startsWith('+') && !line.startsWith('+++')) {
    for (const m of line.matchAll(/https?:\/\/([^/\s"'`)>,;]+)/g)) bump(hosts, m[1]);
    for (const m of line.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g)) bump(mailDomains, m[1].toLowerCase());
  }
}
const total = Object.values(keywords).reduce((a, b) => a + b, 0);
console.log(`charter grep: ${total} hit lines (case-insensitive) in ${byFile.size} files; by keyword: ${JSON.stringify(keywords)}`);
console.log(`a personal path or mail on any line (/Users/; C:\\Users or C:\\\\Users in any case; @gmail): ${personalHits.length}`);
personalHits.forEach((p) => console.log(`  ${p}`));
console.log('hits by file (path: lines):');
[...byFile.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, c]) => console.log(`  ${f}: ${c}`));
console.log(`credential-shape pass over added lines: ${shapeHits.length} hit(s)`);
shapeHits.forEach((h) => console.log(`  ${h}`));
// every URL host and mail domain an added line names, so each can be explained (a vendor's
// public host, a placeholder, an example or test domain): the charter grep alone does not look
// for internal hostnames or private mail
const list = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, c]) => `${k} ${c}`).join(', ');
console.log(`URL hosts in added lines (${hosts.size}): ${list(hosts)}`);
console.log(`mail domains in added lines (${mailDomains.size}): ${list(mailDomains)}`);
