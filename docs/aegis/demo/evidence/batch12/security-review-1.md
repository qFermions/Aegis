# Batch 12, security review 1 (/security-review on feat/batch12-expert-lanes against 046cdde)

Run 2026-11-18 at `2cc60ea`, REVIEW.md read first. First focus, as the owner asked: the tool server's address guard and the docs allowlist (`scripts/mcp/aegis-tools/`, `config/docs-allowlist.json`); then how sessions load it, the four entrypoints and their audit paths, `scripts/start-aegis.js`, and the widened scanner. Step 1, a finder sub-task (Opus, fresh context, read-only; one offline `node -e` probe under the socket tripwire, no traffic) found no candidate vulnerability at confidence 7 or above, so step 2 had nothing to filter.

Result: **No issues** at the review's bar (high-confidence, exploitable).

What the finder checked and why it held (its words, condensed): the IPv4 and IPv6 blocks and the embedded IPv4 forms (27 addresses probed, every private, loopback, link-local and metadata case refused, `::ffff:169.254.169.254`, `64:ff9b::a9fe:a9fe`, `2002:a9fe:a9fe::1`, `fd00:ec2::254`, Teredo, a zone index among them); host-name checks before `domainToASCII` (19 names: full-width digits, `0x7f.1`, a trailing dot, `metadata.google.internal`, `.local` and `.localhost` forms refused); WHATWG URL normalization before the check, userinfo refused, schemes and ports allow-listed (12 URLs); rebinding (one resolution through 1.1.1.1 and 8.8.8.8, the checked IP passed as `host`, the name only in Host and SNI, nothing resolves it again); redirects re-parsed and re-pinned on every hop, docs hops re-checked against the allowlist; HEAD and GET only, no caller header, method or body, unknown keys refused; the 4 KB and 2 MB caps; `rejectUnauthorized: false` only in net_tls, reading the chain; the audit file the only write (O_APPEND, O_CREAT, O_NOFOLLOW, 0600) at a path the entrypoints choose; the judge never gets the server (`isolationArgs` throws); `start-aegis.js` passes the setup as the value after `--setup`, so typed text cannot become an option, and keeps the saved file 0600 in a 0700 folder.

Below the bar, and what was done with each:

| # | Note | Action |
|---|---|---|
| 1 | The widened scanner read four mutating forms as reads: PowerShell `iex` or `winget` after `=` or `.` and `& (gcm iex)`; `kubectl auth reconcile`; a kubectl option value that matches a read verb (`kubectl -n logs delete pod x`); `terraform test` (it applies and destroys) | Fixed as check bugs, test first: `sr1-scanner-red.txt` (0 of 1), `sr1-scanner-green.txt` (1 of 1); the whole scanner fails only the 41 baseline names. Commit after this file. |
| 2 | net_http and net_dns reach any public host, so a session that follows an injected ticket could put text into a URL or a DNS name sent to a host the attacker owns (no body; needs a successful prompt injection) | By design in the charter (public probes); named in `scripts/mcp/aegis-tools/README.md` Limits; listed as an open risk and a decision for the owner in the report (an allowlist for probes, or probes off by default) |
| 3 | net_http's selected headers and net_dns TXT answers return outside the "data, not instructions" markers, JSON-encoded | No new capability (a ticket carries such text already); closed with this reason, recorded in checks.md |
| 4 | A "public" address that is the machine itself or its router (its own global IPv6 address, hairpin NAT on 80, 443 or 8443) | Theoretical; closed with this reason in checks.md |

Pre-existing issues in files this branch touches: none found. Not checked: live sockets (no traffic sent), how the claude CLI treats `--allowedTools` for reads outside the repository.
