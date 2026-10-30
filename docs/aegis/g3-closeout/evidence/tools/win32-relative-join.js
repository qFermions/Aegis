'use strict';
// win32-relative-join.js: preload (node --require) that makes path.join of relative parts use
// Windows separators, as it does on the windows-latest CI runner, while joins onto an absolute
// path still resolve on this machine. Used to reproduce, on Linux, the windows-latest failure of
// scripts/env-example.test.js (CI job 123974215667): `node --require <this file> --test
// scripts/env-example.test.js`. It changes nothing but path.join inside that one process.
const path = require('node:path');
const posixJoin = path.join;
path.join = (...parts) => (path.isAbsolute(parts[0] || '')
  ? posixJoin(...parts.map((p) => String(p).replace(/\\/g, '/')))
  : path.win32.join(...parts));
