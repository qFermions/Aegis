'use strict';
const { make } = require('./harness.js');
const N = 'https://registry.npmjs.org';
const R = {
  [`HEAD ${N}/meta-redirect`]: `${N}/attacker-pkg/-/attacker-pkg-0.0.1.tgz`,
  [`HEAD ${N}/meta-redirect2`]: '/attacker-pkg/%2D/attacker-pkg-0.0.1.tgz',
  'HEAD https://pypi.org/packages/source/a/ap/ap-1.tar.gz': 'https://files.pythonhosted.org/packages/source/a/ap/ap-1.tar.gz',
};
(async () => {
  const s = make('typed text with no URL', { redirects: R });
  const urls = [
    `${N}/attacker-pkg/-/attacker-pkg-0.0.1.tgz`, `${N}/attacker-pkg/%2D/attacker-pkg-0.0.1.tgz`, `${N}/attacker-pkg/%2d/attacker-pkg-0.0.1.tgz`,
    `${N}/attacker-pkg/-%2Fattacker-pkg-0.0.1.tgz`, `${N}/attacker-pkg%2F-%2Fattacker-pkg-0.0.1.tgz`, `${N}/attacker-pkg//-/attacker-pkg-0.0.1.tgz`,
    `${N}/attacker-pkg/x/../-/attacker-pkg-0.0.1.tgz`, `${N}/attacker-pkg/%2e/-/attacker-pkg-0.0.1.tgz`, `${N}/attacker-pkg\\-\\attacker-pkg-0.0.1.tgz`,
    `${N}/ATTACKER-PKG/-/attacker-pkg-0.0.1.tgz`, 'https://registry.npmjs.org./attacker-pkg/-/attacker-pkg-0.0.1.tgz', 'https://REGISTRY.NPMJS.ORG/attacker-pkg/-/x.tgz',
    'https://registry.npmjs.org:8443/attacker-pkg/-/x.tgz', 'http://registry.npmjs.org/attacker-pkg/-/x.tgz', `${N}/@sc%2Fattacker-pkg/-/x.tgz`,
    `${N}/-/v1/search?text=x`, `${N}/attacker-pkg/0.0.137`, `${N}/attacker-pkg`, `${N}/meta-redirect`, `${N}/meta-redirect2`,
    'https://pypi.org/packages/source/a/ap/ap-1.tar.gz',
  ];
  for (const url of urls) {
    const r = await s.call('net_http', { url });
    console.log(JSON.stringify({ url, decision: r.decision, sent: r.http.map((h) => h.key) }));
  }
})();
