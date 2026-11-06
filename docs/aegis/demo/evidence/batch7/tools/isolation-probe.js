'use strict';
// isolation-probe.js: the real CLI, the local /context command only: zero turns, no model. Prints what loads
// and which deny rules the CLI took, under the desk's final flags.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const b = require(path.join(repo, 'scripts/eval/judged/backends.js'));
const env = b.scrubEnv(process.env, b.readExampleNames());
const home = os.homedir();
const clean = (s) => String(s).replaceAll(repo, '<repo>').replaceAll(home, '<home>').replace(/\/(?:private\/)?tmp\/[^\s"\]]*/g, '<tmp>');
const dbg = path.join(os.tmpdir(), `aegis-b7-probe-${process.pid}.log`);
const all = b.sutArgs({ prompt: 'x', runRoot: path.join(home, 'aegis-demo-runs', 'example-run'), maxTurns: 40, persist: false });
const iso = all.slice(all.indexOf('--setting-sources'));
const r = spawnSync('claude', ['-p', '/context', '--output-format', 'json', ...iso, '--debug-file', dbg], { encoding: 'utf8', env, cwd: repo, input: '' });
const j = JSON.parse(r.stdout);
const t = clean(j.result);
const i = t.indexOf('### Memory Files');
const e = t.indexOf('\n### ', i + 5);
console.log("claude -p /context with the scrubbed environment and the desk's final flags, from the repository root. A local command: no model call. Paths written <home>, <repo>, <tmp>.");
console.log(`exit ${r.status}, total_cost_usd ${j.total_cost_usd}, num_turns ${j.num_turns}, duration_api_ms ${j.duration_api_ms}\n`);
console.log(t.slice(i, e > 0 ? e : undefined).trim());
console.log("\nThe CLI's debug log, the lines on permissions:");
for (const l of fs.readFileSync(dbg, 'utf8').split('\n')) if (/deny rule|\[permissions\]/i.test(l)) console.log(clean(l).replace(/^\S+ /, ''));
fs.rmSync(dbg);
const s = spawnSync('claude', ['-p', '/context', '--output-format', 'stream-json', '--verbose', ...iso], { encoding: 'utf8', env, cwd: repo, input: '' });
const init = JSON.parse(s.stdout.split('\n')[0]);
console.log(`\nInit event: mcp_servers ${JSON.stringify(init.mcp_servers)}; plugins ${JSON.stringify(init.plugins.map((p) => p.source))}; memory_paths ${JSON.stringify(init.memory_paths ?? null)}; permissionMode ${init.permissionMode}. The init event does not list permission rules.`);
console.log('Not shown here: that the CLI refuses a read. /context runs no tool, so only a real session can show that.');
