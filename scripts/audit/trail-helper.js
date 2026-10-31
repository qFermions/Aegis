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

// A folder of test gates, each binding one read-back with --change, which change-record.js reads
// instead of .claude/commands in this test process (code review round 1 of the batch G3
// close-out 3, finding 13: open refuses a gate whose runbook binds no read-back, and a real gate
// binds only its own). Returns gateFor(readBack): the runbook and gate that bind it. When the test
// ends, change-record.js reads the folder it read before (code review round 2, finding 7; round 3,
// finding 6).
function testRunbooks(dir, t) {
  const folder = path.join(dir, 'commands');
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'aegis-test.md');
  fs.writeFileSync(file, '# Test gates for the connector tests\n');
  const before = changes.useRunbooksForTests(folder);
  t.after(() => changes.useRunbooksForTests(before));
  const gates = new Map();
  return (readBack) => {
    if (gates.has(readBack)) return gates.get(readBack);
    const { kind, flags } = audit.parseReadBack(readBack);
    const [connector, command] = kind.split(':');
    const client = connector === 'jira' ? 'scripts/jira-client.js' : `scripts/adapters/${connector === 'google-workspace' ? 'gws' : connector}-client.js`;
    const gate = `aegis-test-gate-${gates.size + 1}`;
    fs.appendFileSync(file, `\n## ${gate}\n\n<!-- SAFETY GATE [${gate}] -->\n- **Reversibility:** R2 (a test gate)\n\n\`\`\`bash\nnode ${client} ${command}${flags ? ` ${flags}` : ''} --change [CHANGE_ID] --execute\n\`\`\`\n`);
    const bound = { command: 'aegis-test', gate };
    gates.set(readBack, bound);
    return bound;
  };
}

// t: the node:test context (its after() removes the folder).
function changeTrail(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-runbook-trail-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { AEGIS_AUDIT_DIR: path.join(dir, 'audit') };
  const procedure = path.join(dir, 'procedure.md');
  fs.writeFileSync(procedure, 'The gated change a runbook line proves, for [UPN].\n');
  const sink = audit.auditSink(env);
  const gateFor = testRunbooks(dir, t);
  const opened = new Map();
  const call = (argv) => {
    const out = [];
    const err = [];
    const code = changes.main(argv, env, { out: (s) => out.push(s), err: (s) => err.push(s) });
    if (code !== 0) throw new Error(`change-record ${argv[0]} failed: ${err.join('')}`);
    return JSON.parse(out.join(''));
  };
  // The id of an approved change whose read-back is the runbook line's: kind (connector:verify-
  // command) with the flags in argv that change what its pass means (batch G3 close-out 3, H1).
  function changeFor(kind, argv = []) {
    const readBack = audit.readBackFor(kind, argv);
    if (opened.has(readBack)) return opened.get(readBack);
    const g = gateFor(readBack);
    const o = call(['open', '--command', g.command, '--gate', g.gate, '--r-class', 'R2', '--target', '[UPN]', '--read-back', readBack, '--procedure-file', procedure]);
    call(['approve', '--change', o.change, '--ref', 'IT-123', '--procedure-sha256', o.procedure_sha256]);
    opened.set(readBack, o.change);
    return o.change;
  }
  return { sink, changeFor };
}

module.exports = { changeTrail, testRunbooks };
