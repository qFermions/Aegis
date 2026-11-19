# The breaker on task 1: three rounds (batch 12d)

The breaker is a fresh worker (opus, high effort) that did not write the tool server. Its question: the smallest ticket that still gets session text to a host that was not typed. It drove the real server code with the arguments a hijacked model would send, on fake network pieces; it edited nothing in the repository and ran no model session. Its scripts and their outputs are in `breaker/` (paths masked), except eight files that hold made-up email-shaped and phone-shaped test inputs: the pre-commit scan refuses those shapes in any tracked file (`precommit/20261119T045100Z-breaker-evidence.txt`), so they stay out of the repository, and the two regression tests in `scripts/mcp/aegis-tools/server.test.js` reproduce what they showed. Real network requests: seven HEAD requests to registry.npmjs.org, a listed host (`breaker/real-npm.out`, `breaker/real-npm-3.out`); nothing else.

## Round 1, at `ae9fbb6a`: CLASS 1 BREAK FOUND

- Ticket, five characters: `a@b.c`. ask-aegis writes the typed file after its privacy step, which turns an email address into `[USER@DOMAIN.COM]`; the server read `domain.com` as a host the person typed. `net_dns domain.com TXT`, `net_dns DOMAIN.COM MX` and `net_tls domain.com:8443` were all allowed (the breaker's first output, not tracked; the red run `breaker-fixes-red.txt` shows the same: the server tried to resolve domain.com). The chat's `--setup` text had the same path.
- What it carries: a record type (about 2.8 bits), a port (1 bit) and timing, to a fixed third party the attacker does not choose. Small, but a host neither typed nor listed, so it failed the batch's rule.
- Fix: `a6bbd346`, a bracketed placeholder is not typed text. Test: "a bracketed placeholder is not typed text" in `scripts/mcp/aegis-tools/server.test.js`.
- Class 2, described and not built: any path on registry.npmjs.org was allowed, tarballs included, and npm publishes download counts per package version; 256 versions of an attacker's package would carry about a byte per call. Not proven that npm counts a HEAD and a GET cut at 4 KB. Fix: `1e29fd7a`.

## Round 2, at `1e29fd7a`: CLASS 2 CHANNEL STILL OPEN

- The placeholder fix held (`breaker/r1.out`).
- The npm rule looked for `/-/` in the path as written; `/%2D/`, `/%2d/`, `-%2F` and `%2F-%2F` passed, and the registry serves the tarball for each (`breaker/r6.out`, `breaker/real-npm.out`). A redirect to the encoded form was followed.
- Not class 1, and no gain for an attacker: taking out the placeholder alone split one typed run into a host of its own (`a@b.c..example.net` gave `example.net`), and URLs the privacy step had changed stayed as typed URLs (red run: `breaker-retest-red.txt`).
- Fix for all three: `1aa47a39`. registry.npmjs.org takes only metadata paths (the root, a package, a scoped package, one more segment, no percent sign) on the first URL and every hop; a run of non-space text that holds a placeholder gives no host and no URL.

## Round 3, at `1aa47a39`: both fixes hold

- The four encoded tarball paths and the redirect to the encoded form are refused, with nothing sent (`breaker/r6b.out`). The shapes the rule still allows (`/<package>/<file>.tgz`, `/<package>/-`) answer 404 at the registry, and a query on a metadata path returns metadata (`breaker/real-npm-3.out`, `breaker/r8.out`).
- All 33 masking inputs and 144 separator inputs (18 separators in 8 shapes) give no host or URL that is not a whole token of what was typed (`breaker/r7.out`; green run: `breaker-retest-green.txt`).
- The `a@b.c` break is refused (`breaker/r1b.out`).

## What held in every round

Upper case and Unicode case forms; trailing dots; subdomains and parts of a typed name; full-width and ideographic dots; brackets and ports in a host; fragments, tabs, newlines, backslashes, percent-encoding and scheme changes in a URL; user info; a redirect from a typed or listed URL to anything out of scope; the typed file (the session cannot write it; the server opens it read-only, never through a link); the chat hook (it writes the person's prompt only); the judged runner (it writes the case's own fields, no framing).

## Left open, for the owner

- Class 3: hosts named only in pasted evidence count as typed, by the owner's rule (c). A planted block that names K hosts lets a hijacked session signal log2(K) bits per call, plus the record type or the port, to those hosts' name servers: about 10.8 bits per call with 256 names. The breaker recommends counting only the person's own words, or a cap on the distinct typed hosts one session may reach.
- net_http and docs_fetch may put any path or query on a listed host, so session text can reach those vendors' own logs. The breaker knows of no public counter or reflection on the docs hosts, pypi.org, slack-status.com or www.githubstatus.com; it did not verify that with requests.
- Not tested, because it needs a real session: whether a subagent started with the Agent tool shares the server process and its 30-call cap; whether the chat's prompt hook fires for anything but the person's messages; whether npm counts a metadata request anywhere public.
