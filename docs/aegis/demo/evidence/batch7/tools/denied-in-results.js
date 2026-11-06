'use strict';
// denied-in-results.js <run-dir>...: for each real session, the tool results that show a path the deny rules
// cover. It answers one question the refusals alone cannot: did a whole-repository search still return a denied
// file? It counts tool results only, not the model's text, and prints paths with no file content.
const fs = require('node:fs');
const path = require('node:path');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
const DENIED = /(?:^|[\s"/:])(progress\.md|checks\.md|docs\/review\/[\w./-]+|docs\/aegis\/demo\/[\w./-]+|docs\/explainers\/[\w./-]+|scripts\/demo\/[\w./-]+|scripts\/eval\/[\w./-]+|docs\/evidence\/[\w./-]+|docs\/aegis\/[\w.-]+\/evidence\/[\w./-]+|\.aegis-state\/[\w./-]+|aegis-demo-runs\/[\w./-]+)/g;
const OPEN = /(?:^|[\s"/:])(docs\/aegis\/[\w.-]+\/baseline\/[\w./-]+)/g;
for (const dir of process.argv.slice(2)) {
  for (const f of walk(dir).filter((x) => x.endsWith('-stream.jsonl')).sort()) {
    const hits = new Map();
    const baseline = new Set();
    let results = 0;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      for (const c of (e.message && Array.isArray(e.message.content) ? e.message.content : [])) {
        if (c.type !== 'tool_result') continue;
        results += 1;
        const text = typeof c.content === 'string' ? c.content : JSON.stringify(c.content);
        for (const m of text.matchAll(DENIED)) hits.set(m[1], (hits.get(m[1]) || 0) + 1);
        for (const m of text.matchAll(OPEN)) baseline.add(m[1]);
      }
    }
    console.log(`${path.basename(f).replace('-stream.jsonl', '')}: ${results} tool results; ${hits.size} denied path(s) named; ${baseline.size} baseline file(s) named`);
    for (const [p, n] of [...hits].sort()) console.log(`  named: ${p} (${n})`);
    for (const p of [...baseline].sort()) console.log(`  baseline: ${p}`);
  }
}
