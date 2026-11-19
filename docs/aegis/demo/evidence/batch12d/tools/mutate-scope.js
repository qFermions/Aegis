'use strict';
// mutate.js <repo>: applies each wrong implementation below to the tool server in turn, runs its tests, restores the
// file, and prints which tests failed. Exit 1 when a mutation is not caught.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = process.argv[2];
const dir = path.join(repo, 'scripts', 'mcp', 'aegis-tools');
const MUTATIONS = [
  ['a typed host matched by suffix (a subdomain of a typed name passes)', 'tools.js', 'typed.hosts.has(host)', '[...typed.hosts].some((t) => host === t || host.endsWith(`.${t}`))'],
  ['a typed URL matched by host only (any path or query on it passes)', 'tools.js', 'typed.urls.has(target.u.href)', '[...typed.urls].some((x) => new URL(x).host === target.u.host)'],
  ['a typed URL matched by prefix', 'tools.js', 'typed.urls.has(target.u.href)', '[...typed.urls].some((x) => x.startsWith(target.u.href) || target.u.href.startsWith(x))'],
  ['typed text matched as a substring', 'tools.js', 'typed.hosts.has(host)', 'ctx.typedText().includes(host)'],
  ['a typed bare host opens a URL on it', 'tools.js', 'typed.urls.has(target.u.href)', '(typed.urls.has(target.u.href) || typed.hosts.has(host))'],
  ['redirect hops not scope-checked', 'tools.js', "        inScope(ctx, 'net_http', next);\n", ''],
  ['scope checked after the guard (net_tls)', 'tools.js', "  inScope(ctx, 'net_tls', host);\n  const pinned = await pin(host, ctx);", "  const pinned = await pin(host, ctx);\n  inScope(ctx, 'net_tls', host);"],
  ['the probe allowlist ignored', 'tools.js', ' || ctx.probe.has(host)', ''],
  ['the typed file read once, at the first call', 'server.js', 'typed: () => typed || (typed = typedTokens(readTyped()))', 'typed: () => (createServer.once || (createServer.once = typedTokens(readTyped())))'],
  ['a typed file read through a link', 'server.js', "fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)", 'fs.constants.O_RDONLY'],
  ['no scope at all on net_dns', 'tools.js', "  inScope(ctx, 'net_dns', args.name);\n", ''],
];
let missed = 0;
for (const [label, file, from, to] of MUTATIONS) {
  const p = path.join(dir, file);
  const original = fs.readFileSync(p, 'utf8');
  if (!original.includes(from)) { console.log(`SKIPPED (text not found): ${label}`); missed += 1; continue; }
  let text = original.replace(from, to);
  if (label === 'typed text matched as a substring') text = text.replace('const typed = ctx.typed();', 'const typed = ctx.typed(); ctx.typedText = () => [...typed.hosts, ...typed.urls].join(" ");');
  fs.writeFileSync(p, text);
  try {
    const r = spawnSync(process.execPath, ['--test', path.join(dir, 'server.test.js')], { encoding: 'utf8', env: { ...process.env, TMPDIR: '/private/tmp' } });
    const failed = [...new Set((r.stdout + r.stderr).split('\n').filter((l) => l.startsWith('✖ ') && !l.startsWith('✖ failing tests')).map((l) => l.replace(/ \([\d.]+ms\)$/, '')))];
    console.log(`${failed.length ? 'CAUGHT' : 'NOT CAUGHT'}: ${label}`);
    for (const f of failed) console.log(`  ${f}`);
    if (!failed.length) missed += 1;
  } finally {
    fs.writeFileSync(p, original);
  }
}
console.log(`${MUTATIONS.length - missed} of ${MUTATIONS.length} mutations caught`);
process.exitCode = missed ? 1 : 0;
