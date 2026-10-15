# progress — batch G1 (Google Workspace / Okta / Jamf lane)

- **Task:** G1 — give the Google Workspace / Okta / Jamf / macOS lane the same deterministic proof as the Microsoft lane (gates, corpus, 19 runbooks, knowledge docs, ledger). Claim: `g1-google-lane` (`node scripts/dev/claim.js list`).
- **Branch:** `claude/aegis-google-okta-jamf-wibzp6` (session-designated branch; the batch text names `g1-google-lane`, used as the claim id).
- **Outputs so far:** `scripts/command-safety-gates.test.js`, `scripts/fixtures/command-safety-gates/`, `docs/security/STATE_CHANGE_INVENTORY.json`, `docs/security/COMMAND_RISK_METADATA.md`, `scripts/lint/command-structure.js` (+ test), `scripts/tier/tier-guard.js`, `scripts/graph/engine.js`, `scripts/tier/tier-routing.test.js`, `scripts/pre-commit-check.js` (+ test), `modules/security/placeholder-dictionary.md`, `scripts/repository-structure.test.js`, `docs/evidence/gws/phase1-red-green.md`.
- **Completed:**
  - Phase 0 — baseline recorded (346/346, lint 58 clean, MS eval 28/28 · 6/6, scanner 0 BLOCK / 143 WARN, continuity STALE as expected).
  - Phase 1 — 1.1 safety-gate shell lane + plain-text shell gate analyzer (184/184); 1.2 lint G1 rules (24/24); 1.3 tier/engine floors (21/21); 1.4 scanner secrets (41/41); 1.5 tokens. Acceptance: `node --test` 375/375, lint clean, MS eval 28/28 · 6/6, scanner exit 0.
- **Decisions (evidence):**
  - `[GROUP_EMAIL]` instead of an @-shaped group token — the @ form BLOCKs in the scanner; no exemption widened (`docs/evidence/gws/phase1-red-green.md` §1.5).
  - Google stale paths live in `STALE_PORTAL_PATHS_G1` — the existing lint test pins Microsoft Learn citations on `STALE_PORTAL_PATHS`.
  - Arrow-mutation discovery is live only for G1 cue lines — fixing the dead Microsoft arrow guard surfaces an unowned candidate in `troubleshoot.md` (Microsoft runbooks may not change); reported as a decision.
  - Vendor facts: `/tmp/…/scratchpad/vendor-facts.md` (204 rows, 200 verified 2026-10-15); GAM syntax from `raw.githubusercontent.com/wiki/GAM-team/GAM/*.md` (github.com wiki itself is proxy-blocked).
- **Open issues:** `repository-structure.test.js` pins 58 commands — moves to 77 (still `strictEqual`) when the runbooks land; reported as a deviation. FRESHNESS_DOCS entries land with the Phase 4 docs.
- **Next action:** Phase 2 — write `scripts/eval/gws-tickets.json`, extract the shared evaluator, add `gws-ticket-eval.js` + test (expected red: only "route /x does not exist").
