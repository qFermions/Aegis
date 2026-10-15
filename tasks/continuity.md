# Aegis continuity snapshot

HEAD: 6d151e6
Snapshot-Date: 2026-10-15
Validate with `node scripts/harness/check-continuity.js` (exit 2 = STALE: HEAD moved
since this was written — refresh, don't trust).

## Identity

Aegis, the adaptive IT-operations harness (`PRODUCT_CONTRACT.md`). Aegis advises;
human administrators execute. Canon: `CLAUDE.md` · `TEAM.md` · `docs/harness.md`.

## Repo ground truth

- Branch claude/aegis-google-okta-jamf-wibzp6 (batch G1, v8.9) on top of the
  v8.8-public release `0febaa9`; draft pull request qFermions/Aegis#2, not merged.
- Zero npm dependencies; Node 24 in CI (ubuntu + windows). Full battery
  `node --test` green on 2026-10-15 (490 tests).
- Scanner `node scripts/pre-commit-check.js --all` exit 0 (0 BLOCK, 170 WARN — 27 of
  them the lane's documented dangerous-verb WARNs);
  `node scripts/harness/release-boundary-check.js` PASS.

## Component state

- Commands: 77 in `.claude/commands/` (58 Microsoft-lane + 19 Google Workspace / Okta /
  Jamf / macOS: `gws-*`, `okta-*`, `jamf-*`, `mac-*`, `zoom-room-issue`).
- Safety gates (`scripts/command-safety-gates.test.js`, 287 tests): shell lane sees gam,
  gcloud, HTTP-API writes, jamf and macOS admin CLIs — wrapped, indirect, prompt-prefixed;
  plain-text shell gate analyzer (no pwsh): read inside the comparison, inert own-line
  comments, no shadowing in any shell fence of the document; the harness runs each
  fence's own lines in bash as a script, with `#` as a plain word, and fed on stdin;
  inventory `docs/security/STATE_CHANGE_INVENTORY.json`.
- Structure lint (`scripts/lint/command-structure.js`): 77 commands clean; G1 roots,
  `cli-*` rules, `STALE_PORTAL_PATHS_G1`.
- Tier guard / graph engine: G1 floors kept in sync (`scripts/tier/tier-routing.test.js`).
- Ticket evals on one core (`scripts/eval/ticket-eval-core.js`): Microsoft 28/28 · 6/6,
  Google 38/38 · 9/9.
- Knowledge: `docs/gws-reversibility.md`, `docs/portal-nav-google-2026.md` (vendor pages
  checked 2026-10-15); lab template `docs/evidence/gws/README.md`.
- Evidence: `docs/evidence/claim-ledger.md` (G1 section), `docs/evidence/gws/`.

## Active work

- Claim `g1-google-lane` (batch G1) until the batch report; release with
  `node scripts/dev/claim.js release --task g1-google-lane`.
- Fresh-context review: WARDEN passes 1–4 REJECT, all findings corrected in their own
  commits (`docs/evidence/gws/g1-checks.md` §H); pass 5 pending.

## Next actions

1. Operator reviews draft PR qFermions/Aegis#2 and decides the open items in
   `docs/evidence/gws/g1-checks.md` (merge is the operator's call).
2. Operator captures lab excerpts per `docs/evidence/gws/README.md`; run the
   fresh-context rubric on `scripts/eval/gws-tickets.json` (`scripts/eval/README.md` §2b).
3. Refresh this snapshot after the next commit (HEAD binding goes STALE by design).

## Verification

`node --test` · `node scripts/eval/ms-ticket-eval.js` · `node scripts/eval/gws-ticket-eval.js` ·
`node scripts/lint/command-structure.js` · `node scripts/replay/replay-demo.js` ·
`node scripts/pre-commit-check.js --all` · `node scripts/harness/release-boundary-check.js`
