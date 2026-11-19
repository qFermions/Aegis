'use strict';
// IDNA vs toLowerCase: inScope compares lower(args.name); the query goes to domainToASCII(args.name).
const url = require('node:url');
const { make } = require('./harness.js');
const diffs = [];
for (let cp = 0x80; cp <= 0x10ffff; cp++) {
  if (cp >= 0xd800 && cp <= 0xdfff) continue;
  const c = String.fromCodePoint(cp);
  if (!/[\p{L}\p{M}\p{N}]/u.test(c)) continue;
  const a = url.domainToASCII(`x${c}x.example.com`), b = url.domainToASCII(`x${c.toLowerCase()}x.example.com`);
  if (a && b && a !== b) diffs.push(`U+${cp.toString(16)} ${c} lower=${c.toLowerCase()} -> ${a} vs ${b}`);
}
console.log(diffs.length, 'code points where IDNA(x) != IDNA(lower(x)):'); console.log(diffs.join('\n'));
(async () => {
  const s = make('Mail for gross.example.com and größe.example.com bounces');
  for (const name of ['größe.example.com', 'GRÖẞE.example.com']) {
    const r = await s.call('net_dns', { name, type: 'A' });
    console.log(JSON.stringify({ name, decision: r.decision, dns: r.dns }));
  }
})();
