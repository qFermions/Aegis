# Aegis continuity snapshot

HEAD: 5676da7
Snapshot-Date: 2026-09-02
Validate with `node scripts/harness/check-continuity.js` (exit 2 = STALE: HEAD moved
since this was written — refresh, don't trust).

## Identity

Aegis, the adaptive IT-operations harness (`PRODUCT_CONTRACT.md`). Aegis advises;
human administrators execute. Canon: `CLAUDE.md` · `TEAM.md` · `docs/harness.md`.

## Repo ground truth

- Public tree, release lineage v8.8-public in progress on top of the v8.7 tag
  commit above; working tree carries the uncommitted v8.8 change set
  (`git diff --stat` for the modified count; new `scripts/lint/`, `scripts/eval/`,
  `docs/evidence/`, `scripts/replay/replay-demo.js`,
  `scripts/replay/fixtures/shared-mailbox-demo.md`, this snapshot).
- Zero npm dependencies; Node 24. Full battery `node --test` green on 2026-09-02
  after two fresh-context WARDEN passes (first REJECT → fixes → second ACCEPT,
  0 blockers; the second pass's five material residuals were closed the same day).
- Scanner `node scripts/pre-commit-check.js --all` exit 0 (WARNs only);
  `node scripts/harness/release-boundary-check.js` PASS.

## Component state

- Replay V2 (`scripts/replay/replay-cli.js`): exact / alias / opt-in shape keys
  (exactly one slot, ASCII only, floor-clean both sides, object class established
  and equal on both sides — placeholder / `#EXT#` / explicit `--object-class`),
  PII boundary with canonical-placeholder exemption only, `explain`; suite 15/15;
  demo `scripts/replay/replay-demo.js` (17 steps).
- Tier lane (`scripts/tier/tier-guard.js`): compromise/retire/device-delete/
  mailbox-disable floors; format-character stripping + NFKD + confusable folding;
  the graph engine's SR-2 scan mirrors the patterns and fold.
- Structure lint (`scripts/lint/command-structure.js`): 58 commands + 17 docs clean;
  emphasis/link/HTML-stripped freshness check; frontmatter skipped.
- Ticket eval (`scripts/eval/ms-ticket-eval.js`): 28 tickets, 6 dangerous pairs, all pass.
- Graph 33/33 · memory 14/14 · safety gates 179/179 (inventory regenerated for
  3 sample markers + 1 nav-note reclassification).
- Model policy: Fable on every card; T1 medium, T2/ZAC/ATLAS high, FORGE/WARDEN xhigh.
- Entra admin-center paths refreshed against Microsoft Learn (checked 2026-09-01).

## Active work

- No active claims. The v8.8 audit claim was released on 2026-09-02 (archived
  under `tasks/completed/`, git-ignored); evidence: `docs/evidence/claim-ledger.md`,
  `docs/evidence/ticket-eval-samples.md`.

## Next actions

1. Operator reviews `git diff`, commits as v8.8-public (no push was performed).
2. Refresh this snapshot after the commit (HEAD binding will go STALE by design).
   (The edited cards were already exercised by a fresh headless session —
   `docs/evidence/runtime-smoke.md`.)

## Verification

`node --test` · `node scripts/eval/ms-ticket-eval.js` ·
`node scripts/lint/command-structure.js` · `node scripts/replay/replay-demo.js` ·
`node scripts/pre-commit-check.js --all` · `node scripts/harness/release-boundary-check.js`
