'use strict';
// session.js: how a sealed claude session loads the aegis-tools server (batch 12). backends.sutArgs puts mcpConfig()
// after --strict-mcp-config and TOOL_NAMES in --allowedTools; the judge never gets either.

const path = require('node:path');

const SERVER_NAME = 'aegis-tools';
// the names the claude CLI gives the server's tools: mcp__<server>__<tool> (session.test.js checks them against the
// server's own tools/list)
const TOOL_NAMES = Object.freeze(['docs_fetch', 'net_dns', 'net_http', 'net_tls'].map((tool) => `mcp__${SERVER_NAME}__${tool}`));
const SERVER_PATH = path.join(__dirname, 'server.js');

// The JSON text for --mcp-config: this Node binary runs the server by its absolute path, with --audit when a file is
// named (the server audits to stderr when not). No env block, so no environment value is copied into the argv.
function mcpConfig({ auditFile = null } = {}) {
  const args = auditFile ? [SERVER_PATH, '--audit', path.resolve(auditFile)] : [SERVER_PATH];
  return JSON.stringify({ mcpServers: { [SERVER_NAME]: { type: 'stdio', command: process.execPath, args } } });
}

module.exports = { SERVER_NAME, TOOL_NAMES, SERVER_PATH, mcpConfig };
