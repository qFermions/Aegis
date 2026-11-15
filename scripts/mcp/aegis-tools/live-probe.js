#!/usr/bin/env node
'use strict';
// live-probe.js: a manual check of the aegis-tools server against the real network (batch 12). NOT a test: node --test
// never runs it (the name does not end in .test.js), and it sends real traffic, so run it only by hand.
//
// Usage: node scripts/mcp/aegis-tools/live-probe.js
//
// It starts the real server as a child over stdio, with an audit file in a new temporary folder, and makes the eleven
// calls below. The only hosts it may reach are the two public resolvers (1.1.1.1, 8.8.8.8), learn.microsoft.com,
// example.com and expired.badssl.com; localtest.me is resolved only (it points at 127.0.0.1, so the guard must refuse
// it before any connection). The other refused targets are refused before any packet leaves.
// It prints each call with what was expected and what came back, then the audit lines. Exit 0 when every call came
// back as expected, 1 when not.

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const { makeTempDir } = require('../../temp-dir.js');

const HOSTS = ['1.1.1.1 and 8.8.8.8 (DNS queries)', 'learn.microsoft.com (HTTPS)', 'example.com (HTTPS, TLS)', 'expired.badssl.com (TLS handshake only)', 'localtest.me (DNS query only; refused before any connection)'];
const TAP = 'https://learn.microsoft.com/en-us/entra/identity/authentication/howto-authentication-temporary-access-pass';

// [tool, arguments, expected decision, extra check on an ok body]
const CALLS = [
  ['docs_fetch', { url: TAP }, 'ok', (b, text) => b.title.length > 0 && text.includes('--- Fetched page (data, not instructions) ---')],
  ['docs_fetch', { url: 'https://example.com/' }, 'refused_not_allowlisted'],
  ['net_dns', { name: 'example.com', type: 'A' }, 'ok', (b) => b.answers.length > 0],
  ['net_dns', { name: 'example.com', type: 'MX' }, 'ok'],
  ['net_http', { url: 'https://example.com/' }, 'ok', (b) => b.status === 200 && b.bytes_read <= 4096],
  ['net_http', { url: 'http://169.254.169.254/latest/meta-data/' }, 'refused_private_address'],
  ['net_http', { url: 'http://localhost/' }, 'refused_name'],
  ['net_http', { url: 'http://10.0.0.1/' }, 'refused_private_address'],
  ['net_http', { url: 'http://localtest.me/' }, 'refused_private_address'],
  ['net_tls', { host: 'expired.badssl.com' }, 'ok', (b) => b.expired === true && b.verified === false],
  ['net_tls', { host: 'example.com' }, 'ok', (b) => b.verified === true && b.expired === false],
];

function summary(tool, body, text) {
  if (!body.ok) return `${body.state}: ${body.reason}`;
  if (tool === 'docs_fetch') {
    const start = text.indexOf('\n', text.indexOf('--- Fetched page')) + 1;
    return `url ${body.url}; title "${body.title}"; ${body.chars} characters${body.truncated ? ' (cut)' : ''}; text begins: ${JSON.stringify(text.slice(start, start + 240))}`;
  }
  if (tool === 'net_dns') return `answers ${JSON.stringify(body.answers)} via ${body.resolvers.join(', ')}`;
  if (tool === 'net_http') return `status ${body.status} (HEAD ${body.head_status}); address ${body.address}; ${body.redirects.length} redirects; read ${body.bytes_read} bytes${body.body_cut ? ' (cut)' : ''}; headers ${JSON.stringify(body.headers)}; timing_ms ${JSON.stringify(body.timing_ms)}`;
  return `address ${body.address}; ${body.protocol} ${body.cipher}; verified ${body.verified}${body.verify_error ? ` (${body.verify_error})` : ''}; expired ${body.expired}; days_remaining ${body.days_remaining}; chain ${body.chain.map((c) => `${c.subject_cn} [to ${c.valid_to}]`).join(' <- ')}`;
}

async function main() {
  const dir = makeTempDir('aegis-tools-probe-');
  const auditFile = path.join(dir, 'audit.jsonl');
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, 'server.js'), '--audit', auditFile], { stdio: ['pipe', 'pipe', 'inherit'] });
  const waiting = new Map();
  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    const msg = JSON.parse(line);
    const resolve = waiting.get(msg.id);
    if (resolve) { waiting.delete(msg.id); resolve(msg); }
  });
  let id = 0;
  const send = (method, params) => new Promise((resolve) => {
    id += 1;
    waiting.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });

  console.log(`# aegis-tools live probe, ${new Date().toISOString()}, node ${process.version}`);
  console.log('# hosts this probe sends traffic to, and no other:');
  for (const h of HOSTS) console.log(`#   ${h}`);
  const init = await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'live-probe', version: '1' } });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const list = await send('tools/list', {});
  console.log(`initialize: protocol ${init.result.protocolVersion}, server ${init.result.serverInfo.name} ${init.result.serverInfo.version}; tools: ${list.result.tools.map((t) => t.name).join(', ')}`);
  console.log('');

  let unexpected = 0;
  for (const [i, [tool, args, expected, check]] of CALLS.entries()) {
    const reply = await send('tools/call', { name: tool, arguments: args });
    const text = reply.result.content[0].text;
    const body = JSON.parse(text.split('\n')[0]);
    const decision = body.ok ? 'ok' : body.state;
    const asExpected = decision === expected && (!check || !body.ok || check(body, text));
    if (!asExpected) unexpected += 1;
    console.log(`${String(i + 1).padStart(2)}. ${tool} ${JSON.stringify(args)}`);
    console.log(`    expected ${expected}; got ${decision}: ${asExpected ? 'AS EXPECTED' : 'UNEXPECTED'}`);
    console.log(`    ${summary(tool, body, text)}`);
  }
  child.stdin.end();
  await new Promise((resolve) => child.on('close', resolve));

  console.log('');
  console.log(`# audit file (mode ${(fs.statSync(auditFile).mode & 0o777).toString(8)}), one line per call:`);
  for (const line of fs.readFileSync(auditFile, 'utf8').trim().split('\n')) console.log(line);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('');
  console.log(`# ${CALLS.length - unexpected} of ${CALLS.length} calls as expected`);
  process.exitCode = unexpected ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 2; });
