'use strict';
// session.js: how a sealed claude session loads the aegis-tools server (batch 12). backends.sutArgs puts mcpConfig()
// after --strict-mcp-config and TOOL_NAMES in --allowedTools; the judge never gets either.
// Batch 12d: the launcher writes what the person typed to a typed file (writeTyped) and names it to the server
// (--typed); the chat also appends each later message through the UserPromptSubmit hook typedHooks() returns.

const fs = require('node:fs');
const path = require('node:path');

const SERVER_NAME = 'aegis-tools';
// the names the claude CLI gives the server's tools: mcp__<server>__<tool> (session.test.js checks them against the
// server's own tools/list)
const TOOL_NAMES = Object.freeze(['docs_fetch', 'net_dns', 'net_http', 'net_tls'].map((tool) => `mcp__${SERVER_NAME}__${tool}`));
const SERVER_PATH = path.join(__dirname, 'server.js');
const HOOK_PATH = path.join(__dirname, 'typed-hook.js');

// The JSON text for --mcp-config: this Node binary runs the server by its absolute path, with --audit when a file is
// named (the server audits to stderr when not) and --typed when a typed file is named. No env block, so no environment
// value is copied into the argv.
function mcpConfig({ auditFile = null, typedFile = null } = {}) {
  const args = [SERVER_PATH, ...(auditFile ? ['--audit', path.resolve(auditFile)] : []), ...(typedFile ? ['--typed', path.resolve(typedFile)] : [])];
  return JSON.stringify({ mcpServers: { [SERVER_NAME]: { type: 'stdio', command: process.execPath, args } } });
}

// The "hooks" value of the chat's inline --settings: one UserPromptSubmit hook in exec form (command plus args, no
// shell; https://code.claude.com/docs/en/hooks), which appends each message the person submits to the typed file.
function typedHooks(typedFile) {
  return { UserPromptSubmit: [{ hooks: [{ type: 'command', command: process.execPath, args: [HOOK_PATH, path.resolve(typedFile)] }] }] };
}

// The person's text and a newline (nothing for empty text), into the typed file: created 0600 (and set 0600 if it was
// there already), never through a symbolic link, truncated unless append is true. Throws on a link or a write failure.
function writeTyped(file, text, { append = false } = {}) {
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | (append ? fs.constants.O_APPEND : fs.constants.O_TRUNC) | (fs.constants.O_NOFOLLOW || 0);
  const fd = fs.openSync(file, flags, 0o600);
  try {
    if (process.platform !== 'win32') fs.fchmodSync(fd, 0o600);
    if (text) fs.writeSync(fd, `${text}\n`);
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { SERVER_NAME, TOOL_NAMES, SERVER_PATH, HOOK_PATH, mcpConfig, typedHooks, writeTyped };
