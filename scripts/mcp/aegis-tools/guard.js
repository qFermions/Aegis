'use strict';
// guard.js: the address guard of the aegis-tools MCP server (batch 12). Every network tool asks it two
// questions before it sends anything: is this name one Aegis may look up at all (checkName), and is every
// address the name resolves to a public one (resolveChecked, addressProblem). The tools then connect to the
// one address checked here and nowhere else (the pin), so a second DNS answer cannot move the connection.
//
// IPv6 is default-deny: only global unicast (2000::/3) passes, minus the documentation, Teredo, benchmarking
// and ORCHID blocks. The forms that carry an IPv4 address inside (::ffff:0:0/96, 64:ff9b::/96 and 6to4
// 2002::/16) are judged by the IPv4 address they carry, so the metadata address cannot hide inside them.

const net = require('node:net');
const url = require('node:url');

// [base, prefix length, what the range is]
const V4_BLOCKED = Object.freeze([
  ['0.0.0.0', 8, 'this network'],
  ['10.0.0.0', 8, 'private'],
  ['100.64.0.0', 10, 'carrier-grade NAT'],
  ['127.0.0.0', 8, 'loopback'],
  ['169.254.0.0', 16, 'link-local, cloud metadata'],
  ['172.16.0.0', 12, 'private'],
  ['192.0.0.0', 24, 'IETF protocol assignments'],
  ['192.0.2.0', 24, 'documentation'],
  ['192.168.0.0', 16, 'private'],
  ['198.18.0.0', 15, 'benchmarking'],
  ['198.51.100.0', 24, 'documentation'],
  ['203.0.113.0', 24, 'documentation'],
  ['224.0.0.0', 4, 'multicast'],
  ['240.0.0.0', 4, 'reserved, broadcast'],
  // public space, but the Azure platform endpoint (wire server, metadata) every Azure VM can reach
  ['168.63.129.16', 32, 'Azure platform endpoint'],
]);
const V6_BLOCKED = Object.freeze([
  ['::', 96, 'unspecified, loopback or IPv4-compatible'],
  ['2001::', 32, 'Teredo'],
  ['2001:2::', 48, 'benchmarking'],
  ['2001:10::', 28, 'ORCHID'],
  ['2001:20::', 28, 'ORCHIDv2'],
  ['2001:db8::', 32, 'documentation'],
  ['3fff::', 20, 'documentation'],
]);
// [base, prefix length, index of the 16-bit word where the embedded IPv4 address starts]
const V6_EMBEDDED = Object.freeze([['::ffff:0:0', 96, 6], ['64:ff9b::', 96, 6], ['2002::', 16, 1]]);

// Names that never belong on the public internet: refused before any query, so a query for an internal name
// never leaves (and a split-horizon answer is never asked for).
const PRIVATE_SUFFIXES = Object.freeze(['localhost', 'local', 'localdomain', 'internal', 'home.arpa', 'lan', 'corp', 'intranet', 'private', 'test', 'invalid']);

const v4Number = (s) => s.split('.').reduce((n, octet) => n * 256 + Number(octet), 0);
const v4Text = (n) => [24, 16, 8, 0].map((shift) => Math.floor(n / 2 ** shift) % 256).join('.');

function v4Problem(n) {
  for (const [base, bits, what] of V4_BLOCKED) {
    const size = 2 ** (32 - bits);
    if (Math.floor(n / size) === Math.floor(v4Number(base) / size)) return `${what} (${base}/${bits})`;
  }
  return null;
}

// eight 16-bit words; the input already passed net.isIPv6, so the only shapes left are "::" once at most and
// an optional dotted IPv4 tail
function v6Words(text) {
  let s = text.toLowerCase();
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (dotted) {
    const n = v4Number(dotted[1]);
    s = `${s.slice(0, dotted.index)}${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`;
  }
  const [front, back] = s.split('::');
  const head = front ? front.split(':') : [];
  const tail = back === undefined ? null : (back ? back.split(':') : []);
  const words = tail === null ? head : [...head, ...new Array(8 - head.length - tail.length).fill('0'), ...tail];
  return words.map((w) => parseInt(w, 16));
}

function v6In(words, base, bits) {
  const b = v6Words(base);
  for (let i = 0, left = bits; left > 0; i += 1, left -= 16) {
    const mask = left >= 16 ? 0xffff : (0xffff << (16 - left)) & 0xffff;
    if ((words[i] & mask) !== (b[i] & mask)) return false;
  }
  return true;
}

function v6Problem(text) {
  const w = v6Words(text);
  for (const [base, bits, at] of V6_EMBEDDED) {
    if (!v6In(w, base, bits)) continue;
    const v4 = w[at] * 65536 + w[at + 1];
    const p = v4Problem(v4);
    if (p) return `${base}/${bits} carrying ${v4Text(v4)}: ${p}`;
    if (base !== '2002::') return null; // a mapped or NAT64 form of a public IPv4 address
  }
  for (const [base, bits, what] of V6_BLOCKED) if (v6In(w, base, bits)) return `${what} (${base}/${bits})`;
  if ((w[0] & 0xe000) !== 0x2000) return 'not global unicast (outside 2000::/3)';
  return null;
}

// null when the address is public; otherwise a short reason naming the range.
function addressProblem(ip) {
  const kind = net.isIP(String(ip));
  if (kind === 4) return v4Problem(v4Number(ip));
  if (kind === 6) return String(ip).includes('%') ? 'an IPv6 zone index (link-local scope)' : v6Problem(ip);
  return 'not an IP address';
}

// { name } (lower case, ASCII, no trailing dot) or { state, reason }.
function checkName(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 254) return { state: 'bad_input', reason: 'the name must be 1 to 253 characters' };
  if (net.isIP(raw.replace(/^\[|\]$/g, ''))) return { state: 'refused_name', reason: 'an IP address, not a name' };
  // domainToASCII parses like a URL host and stops at "/", ":" or "@" ("a/b.example.com" becomes "a"), so
  // anything but letters, digits, marks, dot, dash and underscore is refused before it gets there
  if (/[^\p{L}\p{M}\p{N}._-]/u.test(raw)) return { state: 'bad_input', reason: 'not a valid host name' };
  const ascii = url.domainToASCII(raw);
  if (!ascii) return { state: 'bad_input', reason: 'not a valid host name' };
  const name = ascii.toLowerCase().replace(/\.$/, '');
  const labels = name.split('.');
  if (name.length > 253 || !labels.every((l) => /^(?!-)[a-z0-9_-]{1,63}(?<!-)$/.test(l))) return { state: 'bad_input', reason: 'not a valid host name' };
  // the URL parser reads a host whose last label is a number as an IPv4 address (127.1, 0x7f.1, 2130706433)
  if (/^(\d+|0x[0-9a-f]*)$/.test(labels[labels.length - 1])) return { state: 'refused_name', reason: 'an IP address in another notation, not a name' };
  if (labels.length < 2) return { state: 'refused_name', reason: 'a single-label name is an internal name' };
  const suffix = PRIVATE_SUFFIXES.find((s) => name === s || name.endsWith(`.${s}`));
  if (suffix) return { state: 'refused_name', reason: `names under .${suffix} are internal` };
  return { name };
}

function withTimeout(promise, ms) {
  let timer;
  const expired = new Promise((resolve) => { timer = setTimeout(() => resolve({ timedOut: true }), ms); });
  return Promise.race([promise.then((value) => ({ value }), (error) => ({ error })), expired]).finally(() => clearTimeout(timer));
}

// Resolves A and AAAA through the given resolver and checks every answer. The name goes out absolute (a
// trailing dot), so the resolver library never appends a search domain from the machine's resolver settings.
// { address, addresses } with an IPv4 address pinned when there is one, or { state, reason }.
async function resolveChecked(name, resolver, stepMs) {
  const query = `${name}.`;
  const [a, aaaa] = await Promise.all([withTimeout(Promise.resolve().then(() => resolver.resolve4(query)), stepMs), withTimeout(Promise.resolve().then(() => resolver.resolve6(query)), stepMs)]);
  const v4 = Array.isArray(a.value) ? a.value : [];
  const v6 = Array.isArray(aaaa.value) ? aaaa.value : [];
  const addresses = [...v4, ...v6];
  if (addresses.length === 0) {
    if (a.timedOut || aaaa.timedOut) return { state: 'timeout', reason: `resolving ${name} took over ${stepMs} ms` };
    const code = (a.error && a.error.code) || (aaaa.error && aaaa.error.code) || 'no address';
    return { state: 'dns_failed', reason: code === 'ENOTFOUND' ? `${name} does not exist (NXDOMAIN)` : `${name} did not resolve (${code})` };
  }
  for (const ip of addresses) {
    const problem = addressProblem(ip);
    if (problem) return { state: 'refused_private_address', reason: `${name} resolves into private space: ${ip} is ${problem}` };
  }
  return { address: v4.length ? v4[0] : v6[0], addresses };
}

module.exports = { PRIVATE_SUFFIXES, V4_BLOCKED, V6_BLOCKED, addressProblem, checkName, resolveChecked, withTimeout };
