'use strict';
// socket-tripwire.js: test support for the read-only adapters (scripts/adapters/).
//
// Required first by every adapter test file. It replaces every way Node opens a
// connection (net and tls sockets, http and https requests, DNS lookups) with a
// function that throws "Network tripwire fired", and sets AEGIS_NETWORK_TRIPWIRE=1
// so the contract's default transport throws the same error before it builds a
// request. A test that forgets to inject a mock transport therefore fails loudly
// instead of reaching a real Google, Fleet, Jamf, Slack or Linear system.
//
// node --test runs each test file in its own process, so the patch never leaks
// into another suite.

const dns = require('node:dns');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');

const MESSAGE = 'Network tripwire fired';

class NetworkTripwireError extends Error {
  constructor() {
    super(MESSAGE);
    this.name = 'NetworkTripwireError';
  }
}

const attempts = [];
function trip(kind) {
  return function tripped() {
    attempts.push(kind);
    throw new NetworkTripwireError();
  };
}

process.env.AEGIS_NETWORK_TRIPWIRE = '1';
// Batch G3: a CLI run in a test without an injected transport writes its audit entries to a
// temporary folder, never to the operator's real trail.
if (!process.env.AEGIS_AUDIT_DIR) {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-audit-tripwire-'));
  process.env.AEGIS_AUDIT_DIR = dir;
  process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } });
}
net.Socket.prototype.connect = trip('net.Socket.connect');
net.connect = trip('net.connect');
net.createConnection = trip('net.createConnection');
tls.connect = trip('tls.connect');
http.request = trip('http.request');
http.get = trip('http.get');
https.request = trip('https.request');
https.get = trip('https.get');
dns.lookup = trip('dns.lookup');
dns.resolve = trip('dns.resolve');
if (dns.promises) {
  dns.promises.lookup = trip('dns.promises.lookup');
  dns.promises.resolve = trip('dns.promises.resolve');
}
if (typeof globalThis.fetch === 'function') globalThis.fetch = trip('fetch');

module.exports = { MESSAGE, NetworkTripwireError, attempts };
