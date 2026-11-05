'use strict';
// dev-verdicts.js: the deterministic checks of the eight DEV cases on the fake CLI's fixture answer. No
// model. Run before and after a change to checks.js and compare the two outputs.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const checks = require(path.join(ROOT, 'scripts/eval/judged/checks.js'));
const FAKE = path.join(ROOT, 'scripts/eval/judged/fixtures/fake-claude.js');
const answer = (() => {
  const r = spawnSync(process.execPath, [FAKE, '-p', 'fixture', '--output-format', 'stream-json'], { encoding: 'utf8' });
  return r.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((e) => e.type === 'result').result;
})();
for (const line of fs.readFileSync(path.join(ROOT, 'scripts/eval/judged/dev-cases.jsonl'), 'utf8').split('\n').filter(Boolean)) {
  const c = JSON.parse(line);
  const results = checks.runChecks(c, { answer, follow_up_answer: c.follow_up ? answer : null });
  console.log(`${c.id}: ${results.map((r) => `${r.check}=${r.applies ? r.verdict : 'n/a'}`).join(' ')}`);
}
