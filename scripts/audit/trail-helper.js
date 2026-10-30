'use strict';
// trail-helper.js: test support for the runbook command-line tests (batch G3 close-out, owner
// decision 1). A temporary audit trail in which a change is opened and approved for a
// read-back, so a runbook line that passes --change [CHANGE_ID] runs as written: the
// verify-* command checks the change in this trail before its dry run. Used by tests only;
// the folder is removed when the test ends. Not named test-*.js, which node --test would run
// as a test file.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const audit = require('./audit-log.js');
const changes = require('./change-record.js');

// t: the node:test context (its after() removes the folder).
function changeTrail(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-runbook-trail-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { AEGIS_AUDIT_DIR: path.join(dir, 'audit') };
  const procedure = path.join(dir, 'procedure.md');
  fs.writeFileSync(procedure, 'The gated change a runbook line proves, for [UPN].\n');
  const sink = audit.auditSink(env);
  const opened = new Map();
  const call = (argv) => {
    const out = [];
    const err = [];
    const code = changes.main(argv, env, { out: (s) => out.push(s), err: (s) => err.push(s) });
    if (code !== 0) throw new Error(`change-record ${argv[0]} failed: ${err.join('')}`);
    return JSON.parse(out.join(''));
  };
  // The id of an approved change whose read-back is readBack (connector:verify-command).
  function changeFor(readBack) {
    if (opened.has(readBack)) return opened.get(readBack);
    const o = call(['open', '--command', 'runbook-line-test', '--gate', 'runbook-line-test-gate', '--r-class', 'R2', '--target', '[UPN]', '--read-back', readBack, '--procedure-file', procedure]);
    call(['approve', '--change', o.change, '--ref', 'IT-123', '--procedure-sha256', o.procedure_sha256]);
    opened.set(readBack, o.change);
    return o.change;
  }
  return { sink, changeFor };
}

module.exports = { changeTrail };
