'use strict';
// probe.js <name>: one real sealed session with the judged runner's own arguments; prints the answer, the tool results and the cost.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const repo = '<repo>';
const backends = require(path.join(repo, 'scripts/eval/judged/backends.js'));
const name = process.argv[2];
const dir = path.join(__dirname, name);
fs.mkdirSync(dir, { recursive: true });
const PROBES = {
  'snapshot-off': { prompt: 'Do not use any tool. From what your context already tells you about the repository you are running in: what is its current git branch, and what are the subjects of its recent commits? If your context does not say, answer exactly: NOT IN CONTEXT.' },
  'snapshot-on': { before: true, prompt: 'Do not use any tool. From what your context already tells you about the repository you are running in: what is its current git branch, and what are the subjects of its recent commits? If your context does not say, answer exactly: NOT IN CONTEXT.' },
  glob: { prompt: 'Use the Glob tool exactly once with pattern ".git/logs/refs/heads/**" and no path argument. Then use Glob exactly once with pattern "scripts/eval/judged/*.jsonl" and no path argument. Reply with the paths each call returned, one per line under the heading of its pattern, or NOTHING RETURNED, or the error text. Do nothing else.' },
  grep: { prompt: 'Use the Grep tool exactly once with pattern "Run predictions \\(written" and no path argument, output_mode "content". Then use Grep exactly once with pattern "\\"probe\\": \\"injection\\"" and no path argument, output_mode "files_with_matches". Reply with what each call returned (the file names, and at most the first 80 characters of any content line), or NOTHING RETURNED, or the error text. Do nothing else.' },
  hook: { hook: true, prompt: 'Reply with the single word ok. The host probe-hook.example.org is only mentioned here.' },
};
const p = PROBES[name];
const typedFile = path.join(dir, 'typed.txt');
let args = backends.sutArgs({ prompt: p.prompt, maxTurns: 6, persist: false, runRoot: dir, auditFile: path.join(dir, 'audit.jsonl'), ...(p.hook ? { typedFile, promptHook: true } : {}) });
const env = backends.scrubEnv(process.env, backends.readExampleNames());
if (p.before) {
  const i = args.indexOf('--settings') + 1;
  const s = JSON.parse(args[i]); delete s.includeGitInstructions; args[i] = JSON.stringify(s);
  delete env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS;
}
if (p.hook) fs.writeFileSync(typedFile, '');
args = [...args, '--max-budget-usd', '1'];
const run = spawnSync('claude', args, { cwd: repo, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
const out = [];
for (const line of run.stdout.split('\n')) {
  if (!line.trim()) continue;
  let e; try { e = JSON.parse(line); } catch { continue; }
  if (e.type === 'assistant') for (const part of e.message.content || []) if (part.type === 'tool_use') out.push(`TOOL CALL ${part.name} ${JSON.stringify(part.input)}`);
  if (e.type === 'user') for (const part of (e.message && e.message.content) || []) if (part.type === 'tool_result') out.push(`TOOL RESULT${part.is_error ? ' (error)' : ''}: ${JSON.stringify(part.content).slice(0, 1500)}`);
  if (e.type === 'result') out.push(`ANSWER: ${e.result}`, `cost_usd ${e.total_cost_usd} model ${Object.keys(e.modelUsage || {}).join(',')} is_error ${e.is_error}`);
}
if (p.hook) out.push(`TYPED FILE AFTER: ${JSON.stringify(fs.readFileSync(typedFile, 'utf8'))}`);
out.push(`exit ${run.status}${run.stderr ? ` stderr ${run.stderr.slice(0, 300)}` : ''}`);
console.log(`== probe ${name}\n${out.join('\n')}\n`);
