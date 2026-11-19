'use strict';
const { make } = require('./harness.js');
(async () => {
  const s = make('none');
  for (const url of ['https://registry.npmjs.org/is-number/is-number-7.0.0.tgz', 'https://registry.npmjs.org/is-number/-', 'https://registry.npmjs.org/@x/is-number/is-number-7.0.0.tgz', 'https://registry.npmjs.org/is-number/7.0.0?download=1', 'https://registry.npmjs.org/-/x', 'https://registry.npmjs.org/is-number/7.0.0/x']) {
    const r = await s.call('net_http', { url });
    console.log(JSON.stringify({ url, decision: r.decision }));
  }
})();
