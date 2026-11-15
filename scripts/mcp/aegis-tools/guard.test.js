'use strict';
require('../../adapters/socket-tripwire.js');
// guard.test.js: the address guard of the aegis-tools MCP server (batch 12).
//
// EXPECTED DECISION (written before the guard)
// - addressProblem(ip) is null for a public unicast address and a short reason for every address in the
//   private and special ranges the brief lists (IPv4 and IPv6), including IPv4 hidden inside IPv6
//   (::ffff:0:0/96, 64:ff9b::/96, 2002::/16, the IPv4-compatible ::/96 form) and 168.63.129.16.
// - checkName(name) refuses single-label names, IP-looking names and the private suffixes (localhost,
//   local, internal, home.arpa, lan, corp, intranet, private, test, invalid) before any query is sent, and
//   returns the name lower case, without a trailing dot, in its ASCII form.
// Run: node --test scripts/mcp/aegis-tools/guard.test.js

const assert = require('node:assert/strict');
const test = require('node:test');

const guard = () => require('./guard.js');

const PRIVATE = [
  '0.0.0.0', '0.255.255.255', '10.0.0.1', '10.255.255.255', '100.64.0.1', '100.127.255.255', '127.0.0.1', '127.255.255.254',
  '169.254.169.254', '169.254.0.1', '172.16.0.1', '172.31.255.255', '192.0.0.8', '192.0.2.1', '192.168.1.1',
  '198.18.0.1', '198.19.255.255', '198.51.100.7', '203.0.113.9', '224.0.0.1', '239.255.255.250', '240.0.0.1',
  '255.255.255.255', '168.63.129.16',
  '::', '::1', 'fe80::1', 'febf::1', 'fc00::1', 'fd00:ec2::254', 'ff02::1', '2001:db8::1', '100::1', 'fec0::1',
  '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::ffff:10.0.0.1', '64:ff9b::a9fe:a9fe', '64:ff9b::10.0.0.1',
  '64:ff9b:1::1', '::127.0.0.1', '::8.8.8.8', '2002:7f00:1::1', '2002:a9fe:a9fe::1', '2001::1', 'FD00::1', 'fe80::1%en0',
  // added after the mutation check: a zone index on a global address is refused too (fe80::1%en0 alone did not
  // show that the zone check exists, since fe80::/10 is refused anyway)
  '2606:4700::1111%en0',
];
const PUBLIC = [
  '8.8.8.8', '1.1.1.1', '93.184.215.14', '172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.1',
  '169.253.255.255', '169.255.0.1', '198.17.255.255', '198.20.0.1', '223.255.255.255', '168.63.129.15', '168.63.129.17',
  '11.0.0.1', '192.169.0.1', '2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8', '64:ff9b::8.8.8.8',
  '2002:808:808::1',
];

// Wrong implementations it catches: string-prefix matching ("10." misses nothing, but "172.1" would refuse
// 172.15.255.255 and a "172.16." prefix misses 172.31.x); a CIDR off by one at a range edge (172.15.255.255
// public, 172.16.0.0 private); a guard that checks only plain IPv4 and lets ::ffff:127.0.0.1, 64:ff9b::a9fe:a9fe
// (the metadata address through NAT64) or a 6to4 2002:7f00:1:: address through; one that forgets 168.63.129.16;
// one that accepts a zone index (fe80::1%en0).
test('every private and special address is refused, every public one passes', () => {
  const { addressProblem } = guard();
  for (const ip of PRIVATE) assert.equal(typeof addressProblem(ip), 'string', `${ip} is refused`);
  for (const ip of PUBLIC) assert.equal(addressProblem(ip), null, `${ip} passes`);
  assert.equal(typeof addressProblem('not-an-ip'), 'string', 'a value that is not an address is refused');
});

// Wrong implementations it catches: a suffix check that compares case-sensitively (LOCALHOST), forgets a
// trailing dot (localhost.), matches a substring instead of a label (so "notlocal.example.com" is refused, or
// "x.corp" passes because only ".corp.com" is listed); a name check that lets an IP-looking name through to
// the resolver ("127.1", "0x7f.1", "2130706433"); one that refuses an underscore label, which DMARC and DKIM
// names need.
test('a name is refused before any query when it is single-label, IP-looking or under a private suffix', () => {
  const { checkName } = guard();
  const refused = ['localhost', 'LOCALHOST', 'localhost.', 'api.localhost', 'printer.local', 'db.internal', 'nas.home.arpa', 'pc.lan',
    'srv.corp', 'x.intranet', 'y.private', 'a.test', 'b.invalid', 'intranet', 'wpad', '127.1', '0x7f.1', '10.0.0.1', '2130706433'];
  for (const name of refused) {
    const r = checkName(name);
    assert.equal(r.state, 'refused_name', `${name}: ${JSON.stringify(r)}`);
    assert.equal(typeof r.reason, 'string');
  }
  for (const bad of ['', ' ', 'a b.example.com', 'a..example.com', '-a.example.com', `${'a'.repeat(64)}.example.com`, 'x'.repeat(260), 'host:443', 'a/b.example.com']) {
    assert.equal(checkName(bad).state, 'bad_input', JSON.stringify(bad));
  }
  assert.deepEqual(checkName('EXAMPLE.com.'), { name: 'example.com' });
  assert.deepEqual(checkName('learn.microsoft.com'), { name: 'learn.microsoft.com' });
  assert.deepEqual(checkName('_dmarc.example.com'), { name: '_dmarc.example.com' });
  assert.deepEqual(checkName('notlocal.example.com'), { name: 'notlocal.example.com' });
  assert.deepEqual(checkName('bücher.example'), { name: 'xn--bcher-kva.example' });
});
