# Claim → evidence ledger (v8.8, 2026-09-02)

Every material technical claim the public README makes, read the way a skeptical
engineer reads it, with the command or file that proves it. Status vocabulary:

| Status | Meaning |
|---|---|
| **PROVEN** | a script in this tree checks it on every `node --test` run, or a deterministic CLI demonstrates it |
| **PARTIALLY PROVEN** | the deterministic part is checked; the rest is a model-behavior contract with a rubric |
| **MODEL CONTRACT** | cannot be checked without a model; stated as behavior, evaluated by rubric/probe, never claimed as enforced |
| **WEAKENED** | the README wording was stronger than the evidence and was changed in v8.8 |
| **NOT TESTED** | no evidence either way; the README does not claim it |

Re-run everything with `node --test` (full battery), or the individual commands listed.

## Ticket handling

| Claim | Status | Evidence |
|---|---|---|
| Plain-English ticket intake; the operator never names tiers, agents, or commands | MODEL CONTRACT | `PRODUCT_CONTRACT.md` #5, `CLAUDE.md` §Response Format; observed in `docs/evidence/ticket-eval-samples.md` (handlers given only the ticket text) |
| GUI/admin-portal steps first, exact navigation | PARTIALLY PROVEN | content surface: `node scripts/lint/command-structure.js` (`gui-steps-present`, `gui-before-powershell`) on all operational/troubleshooting commands; rendered answer: rubric row "GUI path" (`scripts/eval/README.md`), samples |
| PowerShell second, collapsed, commented per line | PARTIALLY PROVEN | `powershell-collapsed` + `powershell-commented` (≥1 comment per fence is what a script can check; per-line commenting is the model contract), samples |
| Current Microsoft procedure knowledge | PARTIALLY PROVEN | Entra left-nav paths verified against Microsoft Learn on 2026-09-01 and applied (CHANGELOG v8.8); the `fresh-portal-paths` lint rule keeps the *listed* retired forms (`Identity →`, `Hybrid management →`, `Protection → …`, `Monitoring → …`, `Azure Active Directory →`, emphasis-stripped) out of all 58 commands and 17 docs/modules — it is a deny-list, not proof that every path in the tree is current. Exchange/Intune/M365 admin-center paths were spot-checked, not exhaustively verified. Freshness beyond the checked paths is a model contract ("research current vendor docs first") |
| Depth sized to the ticket class (QUICK FIX / DIAGNOSTIC / PROCEDURE / REFERENCE) | MODEL CONTRACT | `docs/command-output-standard.md` v1.2; corpus carries all four classes (`scripts/eval/ms-tickets.json`); rubric row "Classification"; samples show a 4-step T1 answer vs a ranked-checks T2 answer |
| Troubleshooting continuity after "still doesn't work" | MODEL CONTRACT | `docs/command-output-standard.md` §Failure escalation; tier2 card now carries the rule; one captured follow-up in samples |
| Verification checklist and Jira-ready note on every runbook | PROVEN (content) | `one-final-checklist`, `paste-ready-note`, `checklist-before-note` lint rules on all A/B commands |
| 58 runbook slash commands | PROVEN | `ls .claude/commands | wc -l` = 58; `variant-mapped` lint rule classifies every one; `scripts/repository-structure.test.js` validates frontmatter |
| Microsoft and Google coverage | WEAKENED | 0 Google runbooks in `.claude/commands/`; both handler cards cover Google (tier suite asserts the markers). README now says "Microsoft first; Google through the same handlers, no Google runbooks ship yet" |

## Safety

| Claim | Status | Evidence |
|---|---|---|
| Aegis advises, humans execute (no tenant writes) | PROVEN (structure) + MODEL CONTRACT (prose) | `scripts/command-safety-gates.test.js` (179 tests): every discovered mutation in a command is inert preview or owned by an action-local gate; no code path in the tree performs a tenant write (`grep` for Graph/EXO write cmdlets finds only Markdown examples; `scripts/jira-client.js` is dry-run-first with a zero-network tripwire). Handler cards say HUMAN-RUN; samples show it |
| R0–R3 blast-radius authorization | MODEL CONTRACT + deterministic floors | stated as behavioral policy (`README`, `CLAUDE.md` enforcement boundary); deterministic pieces: tier guard floor (`scripts/tier/tier-routing.test.js`), graph SR-2 trigger scan (`scripts/graph/graph.test.js`), CLI write flags |
| Tier 1 / Tier 2 / Tier 3 routing; tier never overrides risk | PARTIALLY PROVEN | floor is deterministic and tested (17 tests incl. mass, wipe/retire, delete device, disable account/mailbox, license removal, offboarding, security control, suspected compromise, confusable homoglyphs); it is a pattern-set floor beneath judgment, not a classifier (`PRODUCT_CONTRACT.md` §Tier philosophy) — the T1-vs-T2 split and any wording outside the set are judgment (model contract) |
| Placeholders always; no real names/UPNs/tenant values | PROVEN (tree) + MODEL CONTRACT (answers) | `node scripts/pre-commit-check.js --all` (CI); replay store refuses real emails/phones (R9); corpus is PII-free (eval test); answer-time behavior is SR-1/SR-8 doctrine + EVALUATE.md probe 1 |
| Injection resistance (content ≠ instructions) | MODEL CONTRACT + WARN scanner | doctrine SR-3; probes T1/T2 in `EVALUATE.md`; scanner flags injection markers in files; graph sanitizer flags at edges (`scripts/graph/sanitize.js`) |
| Independent review, maker ≠ checker, nothing in-session satisfies it | PROVEN (graph) | `graph.test.js` — `independentReviewRequired` cannot be satisfied by agent output; hash-bound human gate |
| Bounded loops (machine gate, ceiling 3) | MODEL CONTRACT | `docs/harness.md` §Bounded-loop contract; the graph's review ceiling is tested, ad-hoc loops are doctrine |
| Deterministic gates outside the model (scanner, boundary guard) | PROVEN | `scripts/pre-commit-check.test.js`, `scripts/harness/release-boundary-check.js` (PASS), CI workflow `release-gate.yml` on ubuntu + windows |

## Recurring-ticket economics (replay)

| Claim | Status | Evidence |
|---|---|---|
| Verified exact repeat → CACHE_HIT, rendered verbatim | PROVEN | `replay.test.js` R3; `replay-demo.js` steps 5 and 13 |
| Unverified resolution cannot replay (also via alias) | PROVEN | R2, R5 |
| Zero model / agent / loop / graph / network on the direct CLI path | PROVEN | R4: static scan of the whole module graph + runtime tripwire that throws on any http/https/net/tls/dns/child_process/worker/fetch call while lookup and render succeed |
| Zero *new ticket reasoning* on a Claude Code CACHE_HIT | MODEL CONTRACT | `CLAUDE.md` §Response Format ("render verbatim, zero new reasoning"); one conversation turn of platform overhead is documented, not hidden (`scripts/replay/README.md` §honest token boundary) |
| Fingerprint invalidation, stale preserved as history, unrelated change ignored | PROVEN | R6, R7; demo steps 16–17 |
| Safe normalized equivalents hit; approved aliases hit | PROVEN | R3 |
| Identity-variant (shape) hits only under the stated conditions | PROVEN (deterministic anchors) · caller-asserted anchors are labeled, not proven | Proven: exact wording, exactly one identity slot, pure ASCII, tier-guard floor clean on both sides, per-case opt-in, **and object class established on both sides and equal** — R10 (hit), R11 (misses on two users, one changed word, destructive verb, homoglyph, zero-width character; consequential, multi-slot, non-ASCII and slot-less cases cannot opt in; no opt-in → MISS), R12 (six corpus dangerous pairs never collide at any key, floors differ), R15 (member vs guest via `[GUEST_UPN]` and via Microsoft's `#EXT#` marker, member vs shared mailbox / distribution group / M365 group / resource / service account, user mailbox vs shared mailbox, ambiguous `[EMAIL]` cannot opt in, contradiction between assertion and anchor refused — all MISS). **Not proven and not claimed:** when a caller passes `--object-class` for a raw literal, the CLI records `anchor: asserted` and trusts it; the engine never infers a class from a domain, local part, or word list (`scripts/replay/README.md` §Object class) |
| Secrets and private content cannot enter the store through the CLI | PROVEN (pattern set) | R8 (tokens, tenant literal), R9 (real emails incl. bracket-wrapped, phone numbers in common formats, on every write surface). The pattern set is explicit and finite (`sanitizationHits`); it is a boundary against the shapes it lists, not a PII classifier |
| Lock / concurrency | PROVEN | R13 (exit 5, no partial write, reads unaffected), R14 (six parallel writers, index consistent, no lock left) |
| Store is git-ignored; fixtures synthetic | PROVEN | R8, `release-boundary-check.js` |

## Engineering proof and public/private boundary

| Claim | Status | Evidence |
|---|---|---|
| Reproducible tests; counts in the README | PROVEN | `node --test` on 2026-09-02 (346 tests, see CHANGELOG v8.8); badge reads graph 33 · memory 14 · replay 15 · ticket eval 28 · lint 58, each reconciled against its suite |
| Public repo contains the real product; only data stays private | PROVEN (structure) | boundary guard PASS; `.gitignore` private stores; no `[@Aegion_*]` literal in the tree (scanner) |
| Fresh-session usability (clone, run, no hidden dependencies) | PROVEN | zero npm dependencies (no `package.json`); Node 24 built-ins only; CI runs the same commands on a clean checkout |
| Multi-session coordination (atomic claims, overlap refusal) | PROVEN | `scripts/dev/claim.test.js` (6 tests incl. the README phantom-task regression) |
| Model policy (Fable 5.1 on required paths, no haiku/sonnet) | PARTIALLY PROVEN | tier suite + claim suite assert the card declarations (`model: fable`, an `effort:` value, no haiku/sonnet). A fresh headless session on 2026-09-02 loaded all six support/dev-plane cards (the seven graph-node cards were untouched), ran lead and both handlers on `claude-fable-5-1`, and hit replay exactly (`docs/evidence/runtime-smoke.md`). Cards carrying `effort:` loaded and dispatched; whether the field was parsed or ignored is not observable from the stream — that it is honoured is vendor-documented (https://code.claude.com/docs/en/sub-agents.md, https://code.claude.com/docs/en/model-config.md — cited in `TEAM.md`), not testable from this tree |
| Continuity snapshot for fresh sessions | PROVEN | `tasks/continuity.md` now ships (written at the end of the v8.8 session); `node scripts/harness/check-continuity.js` → PASS on 2026-09-02, and returns exit 2 (STALE) the moment HEAD moves — a refreshed snapshot is part of every release |

## What remains model-dependent, stated plainly

A script proves the content surface and the deterministic gates. It cannot prove
that the model chooses the most useful first action, keeps depth proportional,
carries failed attempts forward, or refuses an urgency claim inside pasted
content. Those are evaluated, not enforced: `scripts/eval/README.md` (rubric),
`EVALUATE.md` Parts B and C (probes and judging), and
`docs/evidence/ticket-eval-samples.md` (captured, dated, single-run answers).
