'use strict';
// temp-dir.js: makes one new temporary folder, even when TMPDIR, TMP or TEMP names a folder that does
// not exist (batch 8, task 10c). Node builtins only: socket-tripwire.js loads it with --require before
// anything else.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// A new folder named prefix plus six random characters, under os.tmpdir(); when that fails, under the
// system's own temporary folder (%SystemRoot%\Temp on Windows, /tmp elsewhere). Throws when both fail.
function makeTempDir(prefix) {
  const make = (base) => fs.mkdtempSync(path.join(base, prefix));
  try { return make(os.tmpdir()); } catch { return make(process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'Temp') : '/tmp'); }
}

module.exports = { makeTempDir };
