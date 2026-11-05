# Security review 2

The reviewer's report as it came back, with local paths written <home>, <repo> and <tmp>.

No issues

No finding reaches confidence 8. Every path I traced ends in the run folder, and the tickets are repo files, not outside input (`customers.js:18-19`, `tickets.json`). No ticket file under `scripts/demo/customers/*/T*` contains a `Gate:` line.

**Below 8, and why they fell short**
1. **A ticket line echoed last can select a gate (`catalog.js:39-59`), confidence 3.**
   - `namedGates('advice\nGate: okta-mfa-reset-all-portal')` returns that gate. A `>` quote, or any prose after the line, returns `[]`.
   - It needs the model to reproduce the line unquoted at the very end, which falls under the "user content in AI prompts" exclusion.
   - The target comes from `tickets.json`, not the ticket text, and the write stays in the run folder.
   - Doc nit: `scripts/demo/README.md` says "a line quoted from the ticket... selects nothing", which is true only for `>` quotes or non-closing lines.
2. **`Gate: none, see okta-mfa-reset-all-portal` selects that gate (`catalog.js:59`), confidence 2.** I confirmed this by running it. The effect is simulated only, so it is a correctness matter for code review.
3. **`cleanPaths` can leave a path in place (`customer-desk.js:540`), confidence 3.**
   - The boundary list omits quotes, so `EACCES: open '<home>'` stays unchanged. A subpath under home is still cleaned by the next pair, giving `'~/run'`.
   - The leak needs an error on a listed folder itself, or a run folder outside home. It reaches only the untracked `run.json` and page.
   - It did not throw or misbehave on `( [ \ $& + ? * {1} | )(?=`. The escape covers every metacharacter, and the replacer is a function, so `$&` stays literal.
4. **A symlinked parent folder could redirect writes, confidence 2.**
   - `applySimulatedGates` (`gates.js:130-131`) uses `path.resolve` without `realpath`, and `customer-desk.js:210,331,357,411,412,426` use plain `writeFileSync`.
   - It needs a local writer planting links in a fresh, empty run folder. The session has no write path, so this is a hardening or race issue, both excluded.
   - `writeReplacing` itself holds (`customers.js:90`): `wx` refuses a link at the temp name, and rename replaces a link at the target.
5. **Pre-existing: the session's `Agent` tool can reach write-capable subagents (`backends.js:29`, unchanged in this range), confidence 3.**
   - The session lists `forge` (Write, Edit, Bash) and `zac` (`*`).
   - `smoke-T4-init.json` shows `permissionMode: default`, and I found no `.claude/settings.json`, so headless writes should be denied. I did not run this.
   - `boundary-audit.md` row 41 says "no write-capable tool", which holds for the session's own list only.

**Checked and clean**
- **Replay store:**
  - The only path into it is `customer-desk.js:525`. It needs every read-back PASS, no check that applies short of `pass` (so an inconclusive one blocks), and no cache hit.
  - A read-back that could not run gives INCONCLUSIVE and closes at line 520.
  - A leftover candidate never replays (`replay-cli.js:480,525`).
  - The store is `customerDir/replay` by explicit environment (`customer-desk.js:155`, `replay-cli.js:57`).
- **Tripwire:**
  - The file is unchanged in this range and loads before any other require (`customer-desk.js:23`).
  - It is rethrown at `customer-desk.js:341,505` and `readonly-contract.js:641,861`.
  - I found no swallow on a network path.
- **XSS:** `run.aborted` is escaped (`render.js:132`), `safeId` covers the CSS rules, and the CSP is `default-src 'none'`.
- **`--settings` (`backends.js:51`):** it is built with `JSON.stringify` and spawned with no shell. It holds paths only.
- **Personal data:**
  - Added lines in every commit, excluding `.b64` and `.png`, had no hits for home-folder paths, the owner's names, known vendor names, secret shapes or non-example emails.
  - Tracked evidence, excluding `.b64`, has no home-folder paths.
  - The commit author email is a noreply address.
  - The UUID `28c10230-…` in the tenant files is already in the repo at `dae3c51`.

**Scope note:** you asked for no files, but I wrote one temporary patch to the session scratchpad to grep it, then deleted it. The repo is untouched.

**Files read:**
- **In full:** `REVIEW.md`, `scripts/demo/customer-desk.js`, `render.js`, `sim/vendors.js`, `scripts/eval/judged/backends.js`, `paths.js`, `scripts/adapters/socket-tripwire.js`.
- **Nearly all, or by diff:**
  - `catalog.js`: lines 34-75 via the diff, but only 2KB of the earlier output, which covered lines 1-33.
  - `customers.js`: lines 18-29 and 30 to the end.
  - `sim/gates.js`: lines 15-147.
  - `checks.js`: lines 1-140.
  - Diffs of `README.md`, `boundary-audit.md`, `isolation-probe.txt`, `.gitattributes`, tenants c and e.
- **Partly:**
  - `replay-cli.js` (lines 290-300, 425-520, plus grep).
  - `readonly-contract.js` (grep only).
  - `.claude/agents/*` (frontmatter).
  - `smoke-T4-init.json`.
  - `tickets.json` (grep only).

**Not checked:**
- A live `claude -p` session, including whether a subagent's Write is actually denied.
- `.b64` screenshots, per your instruction.
- `readonly-contract.js:894,906` catch blocks, which I did not read.
- `customer-desk.test.js`, other than the grep of its added lines.
- `change-record.js` internals.
- `render` and `record` in `replay-cli.js`, read only in part.
