# progress — batch G1 (Google Workspace / Okta / Jamf lane)

- **Task:** G1 — give the Google Workspace / Okta / Jamf / macOS lane the same deterministic proof as the Microsoft lane (gates, corpus, 19 runbooks, knowledge docs, ledger). Claim: `g1-google-lane` (`node scripts/dev/claim.js list`).
- **Branch:** `claude/aegis-google-okta-jamf-wibzp6` (session-designated branch; the batch text names `g1-google-lane`, used as the claim id). Draft PR qFermions/Aegis#2.
- **Outputs:** `.claude/commands/{gws,okta,jamf,mac}-*.md` + `zoom-room-issue.md` (19), `scripts/eval/gws-tickets.json`, `scripts/eval/ticket-eval-core.js`, `scripts/eval/gws-ticket-eval.js` (+ test), `scripts/command-safety-gates.test.js`, `scripts/fixtures/command-safety-gates/`, `docs/security/STATE_CHANGE_INVENTORY.json`, `docs/security/COMMAND_RISK_METADATA.md`, `scripts/lint/command-structure.js` (+ test), `scripts/tier/tier-guard.js`, `scripts/graph/engine.js`, `scripts/tier/tier-routing.test.js`, `scripts/pre-commit-check.js` (+ test), `modules/security/placeholder-dictionary.md`, `scripts/repository-structure.test.js`, `docs/gws-reversibility.md`, `docs/portal-nav-google-2026.md`, `docs/evidence/gws/`.
- **Completed:**
  - Phase 0 — baseline recorded (346/346, lint 58 clean, MS eval 28/28 · 6/6, scanner 0 BLOCK / 143 WARN, continuity STALE as expected).
  - Phase 1 — 1.1 safety-gate shell lane + plain-text shell gate analyzer; 1.2 lint G1 rules; 1.3 tier/engine floors; 1.4 scanner secrets; 1.5 tokens. Acceptance at the time: `node --test` 375/375, lint clean, MS eval 28/28 · 6/6, scanner exit 0. Red/green: `docs/evidence/gws/phase1-red-green.md`.
  - Phase 2 — corpus 38 tickets / 9 pairs (5 must floor apart); shared core; MS eval output byte-identical after the extraction.
  - Phase 3 — 19 runbooks merged (two exemplars + five FORGE worktrees, cherry-picked; worktrees and their branches removed); wired into the mixed-state list, count pin 58 → 77, risk metadata, inventory; 17 prose mentions turned into slash links. Lint 77 clean; gws eval 38/38 · 9/9; MS eval 28/28 · 6/6; scanner exit 0, 0 BLOCK, every new WARN a dangerous-verb label.
  - Fixed beyond the task (own commits + tests): scanner citation false positive (turnoff2sv/deprovision), Jamf GET status read raising the MDM-command WARN, portal cue "Apple Business" + ChromeOS Re-enable / selected-devices controls.
  - Phase 4 — reversibility, Google nav doc, evidence README, tier cards, ledger, README, EVALUATE, harness, CHANGELOG v8.9, PROJECT_STATE committed; final counts being reconciled.
- **Decisions (evidence):**
  - `[GROUP_EMAIL]` instead of an @-shaped group token — the @ form BLOCKs in the scanner; no exemption widened (`docs/evidence/gws/phase1-red-green.md` §1.5). Okta groups reuse it (pushed Google Groups), per "reuse an existing token".
  - Google stale paths live in `STALE_PORTAL_PATHS_G1` — the existing lint test pins Microsoft Learn citations on `STALE_PORTAL_PATHS`.
  - The pre-existing Microsoft arrow guard is dead (double-escaped regex); fixing it surfaces an unowned candidate in `troubleshoot.md` (Microsoft runbooks may not change) — reported as a decision, not fixed.
  - `.gitignore` `*password*` ignores `gws-password-reset.md`; it is tracked (`git add -f`, same as `password-reset.md`), so the gates see it.
- **Open issues:** WARDEN fresh-context review; `docs/evidence/gws/g1-checks.md`; final battery files; continuity refresh; claim release.
- **Next action:** finish Phase 4 counts, write `docs/evidence/gws/g1-checks.md`, run the WARDEN review on spec + diff vs `0febaa9` + checks table + saved outputs.
