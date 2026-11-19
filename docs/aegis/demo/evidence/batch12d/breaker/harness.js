'use strict';
// Breaker harness: in-process aegis-tools server with recording fakes. Nothing here opens a socket.
const { EventEmitter } = require('node:events');
const REPO = '<repo>';
const { createServer } = require(`${REPO}/scripts/mcp/aegis-tools/server.js`);

const PUBLIC_IP = '93.184.215.14';

function make(typedText, { redirects = {} } = {}) {
  const sent = { dns: [], http: [], tls: [], audit: [] };
  const resolver = {
    resolve4: async (n) => { sent.dns.push(`A ${n}`); return [PUBLIC_IP]; },
    resolve6: async (n) => { sent.dns.push(`AAAA ${n}`); const e = new Error('nodata'); e.code = 'ENODATA'; throw e; },
    resolve: async (n, t) => { sent.dns.push(`${t} ${n}`); return t === 'TXT' ? [['x']] : t === 'MX' ? [] : [PUBLIC_IP]; },
  };
  const request = (options) => {
    const key = `${options.method} ${options.protocol}//${options.headers.Host}${options.path}`;
    sent.http.push({ key, address: options.host, servername: options.servername, headers: options.headers });
    const req = new EventEmitter();
    req.setTimeout = () => req;
    req.destroy = () => req;
    req.end = () => setImmediate(() => {
      const res = new EventEmitter();
      const loc = redirects[key];
      res.statusCode = loc ? 302 : 200;
      res.headers = loc ? { location: loc } : { 'content-type': 'text/plain' };
      res.destroy = () => {};
      req.emit('response', res);
      setImmediate(() => res.emit('end'));
    });
    return req;
  };
  const tlsConnect = (options) => {
    sent.tls.push({ address: options.host, port: options.port, servername: options.servername });
    const s = new EventEmitter();
    s.setTimeout = () => s; s.end = () => {}; s.destroy = () => {};
    s.getPeerCertificate = () => ({ fingerprint256: 'AA', subject: { CN: 'x' }, issuer: {}, valid_from: '', valid_to: 'Jan 1 00:00:00 2030 GMT' });
    s.getProtocol = () => 'TLSv1.3'; s.getCipher = () => ({ name: 'x' }); s.authorized = true;
    setImmediate(() => s.emit('secureConnect'));
    return s;
  };
  const server = createServer({ resolver, request, tlsConnect, readTyped: () => typedText, audit: (e) => sent.audit.push(e), log: () => {} });
  let id = 0;
  async function call(name, args) {
    const before = { dns: sent.dns.length, http: sent.http.length, tls: sent.tls.length };
    const out = await server.handleLine(JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }));
    const audit = sent.audit[sent.audit.length - 1];
    return { decision: audit.decision, reason: audit.reason, audit, dns: sent.dns.slice(before.dns), http: sent.http.slice(before.http), tls: sent.tls.slice(before.tls), isError: out.result.isError };
  }
  return { call, sent };
}
module.exports = { make };
