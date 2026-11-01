#!/usr/bin/env node
// clean-capture.js <file>...: edit a saved command capture after the run, as the Phase 0
// captures were: U+2014 written as "--", ANSI colour codes removed, the repository path written
// as <repo> and temporary paths as <tmp>. A note naming the edit is appended as the last line,
// so every line number stays the same. A file already noted is left alone.
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..', '..', '..', '..');
const NOTE = '# capture edited after the run:';
for (const file of process.argv.slice(2)) {
  let text = fs.readFileSync(file, 'utf8');
  if (text.includes(NOTE)) continue;
  const dashes = (text.match(/\u2014/g) || []).length;
  text = text.replace(/\u2014/g, '--')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(REPO).join('<repo>')
    .replace(/\/tmp\/[A-Za-z0-9._\/-]+/g, '<tmp>');
  if (!text.endsWith('\n')) text += '\n';
  text += `${NOTE} U+2014 written as "--" (${dashes}), ANSI colour codes removed, the repository path written as <repo> and temporary paths as <tmp>; line numbers unchanged\n`;
  fs.writeFileSync(file, text);
}
