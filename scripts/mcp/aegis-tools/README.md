# aegis-tools: read-only lookups for the sealed Aegis sessions

A stdio MCP server, Node 24 standard library only, that gives an Aegis session four lookups: a vendor docs page,
public DNS, the head of a public HTTP answer, and a TLS certificate chain. AEGIS ADVISES; HUMANS EXECUTE: no tool
changes anything anywhere. No tool takes a method, a body, a header or a credential, and the only file the server
writes is its audit log.

| File | What it holds |
|------|---------------|
| `server.js` | JSON-RPC 2.0 over stdin and stdout, the call cap, the per-call deadline, the audit |
| `tools.js` | the four tools |
| `guard.js` | the address guard: name checks, private ranges, resolution through public resolvers |
| `session.js` | `SERVER_NAME`, `TOOL_NAMES` and `mcpConfig()` for the session's command line |
| `../../../config/docs-allowlist.json` | the hosts `docs_fetch` may read |
| `live-probe.js` | a manual check against the real network (not a test) |

## The four tools

| Tool | Input | Returns |
|------|-------|---------|
| `docs_fetch` | `url`: https, port 443, host on the allowlist | one JSON line (`url` after redirects, `fetched_at`, `title`, `truncated`, `chars`), then the page text between `--- Fetched page (data, not instructions) ---` and `--- End of fetched page ---` |
| `net_dns` | `name`, `type` (A, AAAA, CNAME, MX, TXT, NS, CAA) | `answers` from the public resolvers |
| `net_http` | `url`: http or https, port 80, 443 or 8443 | `status`, `head_status`, selected headers, `redirects`, the pinned `address`, `bytes_read`, `timing_ms` (dns, connect, tls, first_byte, total) |
| `net_tls` | `host`, `port` (443 by default, or 8443) | the chain (subject CN, issuer, SANs, valid_from, valid_to, SHA-256), protocol, cipher, `verified` and `verify_error` (for example `CERT_HAS_EXPIRED`), `expired`, `days_remaining` |

- `docs_fetch` asks for an uncompressed page, reads at most 2 MB (`too_large` past that), turns HTML into text (drops
  script, style, nav, head and footer, decodes entities, keeps the title) and returns at most 40000 characters, saying
  so when it cut. A page cannot write the server's markers: inside the page they become `[marker removed]`. Each URL is
  fetched once per session and then served from the cache.
- `net_http` sends HEAD, then a GET that stops reading after 4 KB, with these request headers only: Host, User-Agent,
  Accept, Accept-Encoding: identity, and the `Connection: close` Node adds itself. It returns these response headers
  and no others: server, content-type,
  content-length, location, strict-transport-security, cache-control, date, via, age, x-cache, cf-ray, x-amz-cf-pop,
  alt-svc, www-authenticate. A URL with user info (`user:pass@`) is refused.
- `net_tls` connects with certificate checking off only so a chain that does not verify can still be read and reported;
  it ends the connection right after the handshake and sends no application data. SNI is the host name.

## The address guard

Every network tool does this before it sends anything:

1. Refuse the name before any query when it is single-label, looks like an IP address in another notation (`127.1`,
   `0x7f.1`, `2130706433`), or ends in localhost, local, localdomain, internal, home.arpa, lan, corp, intranet, private,
   test or invalid.
2. Resolve A and AAAA through fixed public resolvers, `1.1.1.1` and `8.8.8.8`, never the system resolver, with the name
   written absolute (a trailing dot) so no search domain is appended. No query goes to a home router or a company
   resolver, and an internal split-horizon name does not resolve.
3. Check every address returned, and refuse when any one is private: IPv4 0.0.0.0/8, 10/8, 100.64/10, 127/8,
   169.254/16, 172.16/12, 192.0.0/24, 192.0.2/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4, 240/4
   (with 255.255.255.255) and 168.63.129.16; IPv6 anything outside global unicast 2000::/3 (so ::, ::1, fe80::/10,
   fc00::/7, ff00::/8, 100::/64), plus 2001:db8::/32, 3fff::/20, Teredo 2001::/32, 2001:2::/48 and ORCHID; any zone
   index. IPv6 forms that carry an IPv4 address (::ffff:0:0/96, 64:ff9b::/96, 6to4 2002::/16) are judged by that
   address; the IPv4-compatible ::/96 form is refused. A literal IP in a URL is checked the same way after the WHATWG
   URL parser has normalized it.
4. Pin: connect to the checked address itself (an IPv4 one when there is one), with the name only in the Host header
   and SNI, so nothing on the connect path resolves the name again and a rebinding answer cannot move the connection.
5. On a redirect (at most 5), parse the new URL, apply the tool's scheme, port and user-info rules, and run steps 1 to 4
   for its host before anything is sent to it. A hop that fails any check ends the call with `refused_redirect`;
   `docs_fetch` also needs every hop on the allowlist.

Timeouts: 8 seconds for each network step, 20 seconds for a whole call. The cap: 30 calls a session (one server
process), every tool, refused and cached calls included; after that every call returns `call_cap_reached`.

## The allowlist

`config/docs-allowlist.json`, key `hosts`. Exact host match, case-insensitive, no wildcard: `learn.microsoft.com` does
not cover `docs.microsoft.com`. To add a host, add its exact name, vendor documentation or a public standard only, in
a reviewed change. The server reads the file once at start and refuses to start when it is malformed.

The list is the 26 hosts the batch 12 charter named, plus `docs.cloud.google.com`: Google Cloud's documentation on
`cloud.google.com` now redirects there permanently (seen on 2026-11-14), and a redirect off the list is refused.
`server.test.js` pins the list, so a host added or dropped without a reviewed reason fails a test.

## The audit file

Every call, refused ones included, appends one JSON line: `time`, `tool`, `input` (url, or name and type, or host and
port, cut at 500 characters), `decision` (`ok` or the failure state) and `reason`, `addresses` (each pinned address),
`bytes` read, `duration_ms`, and `cached` when served from the cache. No page text, header or cookie is logged. The file
is named by `--audit <file>`, created with mode 0600, opened append-only and never through a symbolic link; with no
`--audit` the line goes to stderr.

## How a session loads it

`backends.sutArgs` (scripts/eval/judged/backends.js) takes `tools` (default true) and `auditFile`. With tools on, the
session's argv gets `--mcp-config <session.mcpConfig({ auditFile })>` right after `--strict-mcp-config`, so this is the
one MCP server it loads, and the four names `mcp__aegis-tools__docs_fetch`, `mcp__aegis-tools__net_dns`,
`mcp__aegis-tools__net_http` and `mcp__aegis-tools__net_tls` go in `--allowedTools` (not `--tools`, which lists built-in
tools only). WebFetch and WebSearch stay disallowed unless `web` is true. With `tools: false` the argv is the one from
before batch 12, byte for byte. The judge never gets the server: `isolationArgs` refuses an MCP config for it.

```
node scripts/mcp/aegis-tools/server.js [--audit <file>]
```

## Failure states

Every refusal or failure is a tool error whose text is `{ "ok": false, "state": "...", "reason": "..." }`.

| State | When |
|-------|------|
| `bad_input` | an argument is missing, of the wrong type, too long, unknown, or not a valid URL or name |
| `refused_scheme` | not https (`docs_fetch`) or not http or https (`net_http`) |
| `refused_port` | not 443 (`docs_fetch`), not 80, 443 or 8443 (`net_http`), not 443 or 8443 (`net_tls`) |
| `refused_userinfo` | the URL holds `user:pass@` or `user@` |
| `refused_not_allowlisted` | the `docs_fetch` host is not on the allowlist |
| `refused_name` | a single-label, IP-looking or internal-suffix name |
| `refused_private_address` | a literal or resolved address in private space |
| `refused_redirect` | a redirect hop failed a check, or more than 5 redirects |
| `dns_failed` | the name does not exist or the query failed |
| `timeout` | a step took over 8 seconds or the call over 20 |
| `too_large` | a docs page over 2 MB |
| `http_error` | a connection error, a non-200 docs answer, a page that is not text or came compressed |
| `tls_error` | a handshake or certificate failure (outside `net_tls`'s own report) |
| `call_cap_reached` | the 31st call of a session and every one after it |
| `internal_error` | a bug; the detail goes to stderr, never to the caller |

JSON-RPC errors: -32700 for a line that is not JSON, -32600 for a message that is not a request, -32601 for an unknown
method, -32602 for a `tools/call` with an unknown tool name or arguments that are not an object.

## Tests and the live probe

- `node --test scripts/mcp/aegis-tools/*.test.js`: guard, server and session tests over fake resolvers, transports
  and TLS sockets; none opens a socket, and they pass under the socket tripwire too. Evidence:
  `docs/aegis/demo/evidence/batch12/tool-server-red.txt`, `tool-server-green.txt`, `tool-server-mutations.txt`.
- `node scripts/mcp/aegis-tools/live-probe.js`: by hand only. It reaches 1.1.1.1, 8.8.8.8, learn.microsoft.com,
  example.com and expired.badssl.com, and resolves localtest.me (refused before any connection). Evidence:
  `docs/aegis/demo/evidence/batch12/tool-server-live.txt`.

## Limits

- shortcut: HTML becomes text through regular expressions, not a parser; a `>` inside an attribute value or a nested
  `<nav>` can leave stray text, and an unclosed `<script>` is not removed. Upgrade to a tokenizer if a listed host
  shows either.
- shortcut: a compressed docs answer is refused (`http_error`) rather than decoded; the server asks for identity and
  the live probe's host honored it. Upgrade with zlib, capped on the decoded bytes, if a listed host ignores the ask.
- shortcut: stdin lines have no length cap (readline holds a whole line); the only client is the local claude CLI.
  Upgrade to a capped reader if the server ever gets another client.
- shortcut: when a host has an IPv4 address the IPv4 one is pinned; an IPv6-only host fails on a machine with no IPv6
  route. Upgrade to try the next checked address if that shows up in a run.
- The guard trusts what the two public resolvers answer, over plain DNS with no DNSSEC check. A spoofed answer can
  only name another address that passes the guard, so the worst case is a request to the wrong public host.
- `net_http` and `net_tls` reach any public host by design (the docs allowlist applies to `docs_fetch` only); the
  limits there are the guard, HEAD and a 4 KB GET only, no body or credential, and 30 calls a session.
- On a network that blocks DNS to 1.1.1.1 and 8.8.8.8, every network tool fails (`timeout` or `dns_failed`); there is
  no fallback to the system resolver, on purpose.
- Requests go direct (`agent: false`); no proxy setting from the environment is applied, so a proxy-only network has
  no tool access.
