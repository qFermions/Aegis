# Changelog

All notable changes to the Aegis IT Operations Agent are documented here.

## [Unreleased] - 2026-07-13 — public-release P1 hardening

### Security
- **Safety scanner fails closed without leaking matched content:** Git calls use argument arrays and NUL-delimited file lists; staged typechanges, misleading suffixes, backups, snapshots, control-character paths, and invalid/binary text are handled without fail-open behavior; findings report only a safe path, category, line, and remediation.
- **Jira write authorization and response handling are exact:** `--execute`, `--confirm`, and `--public` are bare boolean flags; false-looking forms are rejected before request creation, only integer 2xx statuses count as success, and failed response bodies are withheld.
- **Current-tip operational examples sanitized:** privileged account/path examples and fixed operator paths were replaced with placeholders or repository-relative state paths. Published history is explicitly not claimed sanitized.
- **Risk claims made truthful:** R0–R3 is documented as behavioral policy, supported operator-only command controls are applied, and remote artifact creation is classified as a write.

### Fixed
- Deployment readiness now fails on silent nonzero exits, missing tools, missing or masked hooks, incomplete scanner mode, invalid statuses, and dirty state.
- Health providers preserve `UNKNOWN`/`DEGRADED` results, aggregate multi-CPU values, reconcile partial disks without erasing unknown drives, and avoid shell-specific pipelines.
- Memory initialization previews targets, rejects unsafe project keys, refuses existing, partial, or concurrently created state by default, creates verified timestamped backups for `--force`, installs through durable temporary files, and rolls back caught write/install failures within the running process.
- The bundled Claude plugin now has a canonical manifest and a validator-compatible command definition.

### Testing
- Added adversarial scanner, Jira CLI, deployment, health-provider, memory-safety, command-policy, repository-structure, plugin-layout, and Markdown-link regressions.
- The release gate now runs the full Node test suite and full-tree scanner on both Ubuntu and Windows runners.

## [v8.5.1-public] - 2026-07-01 — account rename + evaluator tooling

### Changed
- **GitHub account renamed `Ronny-Yee` → `qFermions`** (after v8.5-public shipped). Old URLs 301-redirect and were verified; all local working-copy remotes repointed. Historical entries below referencing the old handle are left untouched — they are the true record.
- **README redesigned:** centered badge hero, Mermaid architecture diagram (R0–R3 Zero-Trust Execution Contract flowing into the ClickOps-to-IaC bridge), operational-results table, collapsible T1–T10 and 65-command panels; clone URL updated to `qFermions/Aegis`. No technical content removed or altered.
- **`scripts/pre-commit-check.js`: new `--all` mode** — scans every tracked file in the working tree (vs the staged set), built for the CI release gate. Staged-mode behavior unchanged.

### Added
- **`EVALUATE.md`** — the 10-minute guided red-team: five scripted probes (placeholder enforcement, T2 urgency bypass verbatim, T1 injection by pointer, T10 scanner block with a generated fake token, T8 false-memory re-gate) ending in a pass/fail scorecard that files into the review issue template.
- **`docs/adr/`** — three Architecture Decision Records: ADR-001 blast-radius classes over per-cmdlet allowlists, ADR-002 repository teardown over history rewrite (revocation, not redaction), ADR-003 the GUI-first/PowerShell-second response contract.
- **`.github/workflows/release-gate.yml`** — the same scanner that gates local commits, run in `--all` mode on every push/PR; tenant-literal gate (SR-8) activates via repo secrets when present. README carries the live badge.

## [v8.5-public] - 2026-07-01 — Zero-Trust Execution Contract + adversarial test suite

### Added
- **Zero-Trust Execution Contract (CLAUDE.md):** every action classified R0–R3 by blast radius before execution — R1 states its undo inline, R2 requires a pre-state checkpoint, R3 adds the full destructive-action gate + written rollback path before step 1. Batch ops require a staged variable + predicted `$targets.Count` before acting; partial failure stops the batch.
- **`modules/security/threat_model.md`:** trust-boundary map, STRIDE→control matrix, and a 10-probe runnable adversarial test suite (T1–T10) — injection, urgency bypass, PII extraction, gate bypass, false-memory confirmation, malformed lessons — with expected agent behavior per probe. Built to be fired at the agent by evaluators.
- **`modules/automation/powershell/rollback_patterns.md`:** five checkpoint/rollback patterns — pre-state JSON capture, paired change+rollback with auto-revert on failed verify, count-gated stop-on-first-failure batches, policy-export-before-edit, and the irreversible-ops protocol.

### Changed
- **`scripts/pre-commit-check.js` hardened:** modern secret formats (GitHub PATs incl. fine-grained, JWTs, private-key blocks, `sk-` keys, Slack tokens, Azure storage/SAS); tenant-literal gate loaded at runtime from env/gitignored file (matches BLOCK, literal redacted from the scanner's own output); prompt-injection marker WARN scan.

## [v8.4.1-public] - 2026-07-01 — scrub personal holdings data from war-room command docs

### Security
- **War-room command docs sanitized:** example tickers, account types, and watchlist/conviction tiers replaced with `[TICKER]`-style placeholders in `/alpha-signal`, `/portfolio-status`, `/morning-brief`, `/ask-hermes`, the `war-room-ops` skill, and `docs/hermes-integration.md`. The commands' orchestration logic is unchanged — only the personal book examples are gone.
- **Release gate extended:** ticker/holdings patterns added to the literal/PII scan alongside org literals, names, emails, phones, and credentials.

## [v8.4-public] - 2026-07-01 — command-output standard + Koinon architecture

### Added
- **Global command-output standard** (`docs/command-output-standard.md` v1.0): every command renders gate → inputs → fast path → phased GUI steps → single checklist → paste-ready note. Four variants (operational / troubleshooting / docs-comms / learning).
- **Koinon architecture description** (`docs/koinon-architecture.md`): the shared-library submodule design — security preamble, placeholder dictionary, cross-agent lessons, T-pattern diagnostic trees — and how consumer agents inherit it. Linked from README.
- **Learning command family (Variant D):** `/cloud-lab`, `/devops-drill`, `/ai-engineer-drill`.
- **`.gitattributes`:** LF pinned repo-wide.

### Changed
- **Onboarding line rebuilt:** `/new-user` (26-step phased flow), `/onboard` now a thin alias, `/password-reset` and `/new-device-setup` aligned to the output standard.
- **CLAUDE.md v8.3 size diet:** reference material moved to `docs/`; all v8.x rules remain in force.

### Security
- **Release gate:** unchanged from v8.3 — curated tree, fresh SHA on top of `v8.3-public`, full literal/PII scan printed zero. `tasks/`, `docs/handoff/`, `shared/` (private submodule), `sync.bat`, and local settings remain excluded.

## [v8.3-public] - 2026-06-09 — first public release (curated)

### Added
- **Public release repo (`Aegis`):** a curated tree with **fresh SHAs and no inherited history** — CLAUDE.md, AGENTS.md, all slash commands, modules, scripts (incl. `jira-client.js` + its 14-case eval suite), docs (minus `handoff/`), CHANGELOG, LICENSE, `.env.example`.
- **README rewritten for a public audience:** what Aegis is, a 5-minute "Try it" path (`/new-user`, `/troubleshoot`, `/jira-create` dry-run), the safety model (placeholders, dry-run defaults, destructive gates), and a "Rate it" section.
- **`.github/ISSUE_TEMPLATE/review.md`:** 6-category 1–5 rating sheet + three free-text questions (best thing / fix first / would you use it).

### Changed
- **Remote topology:** old public origin renamed to a **frozen archive repo** (private, no pushes); **`private`** = dev remote (only target for `main`); the new public **`Aegis`** is release-only — deliberate curated pushes from a separate staging tree, never a remote of the dev repo. `sync.bat` no longer auto-pushes any public ref; AGENTS.md §6 routing rules updated to match.

### Security
- **Release gate:** full literal/PII scan ran on the exact release tree (org literals incl. all casing variants, operator name/username/personal email, real-email/phone/credential patterns) — required to print **zero** before any push. Release tree excludes `tasks/`, `docs/handoff/`, `.claude/settings*`, `.agents/`, `shared/` (private submodule), and `sync.bat`.

## [v8.3] - 2026-06-09 — repo hygiene + CLAUDE.md diet + JSM integration (Fable 5 session)

### Added
- **Jira Service Management integration (Phase 4a):** `scripts/jira-client.js` (zero-dep Node, JSM Cloud service-desk REST API) + `/jira-create` and `/jira-update` commands. Turns an Aegis ticket work-up into a real JSM request, comment, status read, or transition — targeting the DevOps / Get IT Help space. Dry-run by default (prints the payload, calls nothing); `--execute` required to hit the API; transitions double-gated (`--execute` + `--confirm`, reporter-visible/SLA-firing); comments default internal. Auth + ids are env-var only — no token touches a file. `scripts/jira-client.test.js` — 14-case eval suite (payload shape, id coercion, default visibility, missing-field throws, arg parsing, and a network tripwire proving zero https calls on dry-run paths); all pass.
- **Mentorship layer** merged into CLAUDE.md Identity + Core Behavior Rules (#13–17: why-before-how, both-versions "scale version", speed-run radar, scale sandbox, respectful inefficiency call-outs) with an explicit precedence note: security gates / placeholder dictionary / destructive-action confirmations / verify-before-claim override all mentorship behavior. Integrated, not appended; file held at 34,888 chars.

### Changed
- **CLAUDE.md diet: 42,473 → 34,959 chars** (was over Claude Code's 40k limit — tail truncation). Reference material relocated with pointers, zero rule loss: Agent Registry + Platform Notes → `docs/architecture.md`; Daily Ticket Template → `docs/ticket-examples.md` appendix; runbook/escalation templates deferred to `/runbook` and `/escalation-note` (which already owned them); lesson format → `tasks/lessons.md`; script-safety pattern list → `scripts/pre-commit-check.js` pointer; PS errors → `/ps-error-decode` pointer. Compressed (not removed): T-pattern table, War Room table, onboard/offboard order, tone bullets.
- **AGENTS.md reworked** after hostile review: restored safety-precedence clause + the `docs/codex-modes/` mode router; canonical placeholder dictionary referenced instead of an invented token set; 2026-05-22 incident lessons encoded (revoke-before-purge, foreground-only history rewrites); new Repo Guardrails section (read-only `shared/`, settings lockdown, **remote routing: main → private only, portfolio → origin, visibility gate before any push**); same-tree two-agent coordination rule; truncated section 8 completed.
- Branch reconciliation: `feat/aegis-v8-2026-05-22` merged → `main` (conflicts resolved to the sanitized branch); the 3 main-only commits reconciled — sync.bat ported **sanitized**, new-user.md confirmed superseded, the CLAUDE.md sanitization revert intentionally dropped. sync.bat points at the private dev remote.
- `main` force-pushed (with lease, after a verified full-refs bundle backup held offline, off-repo) to the **private** remote, replacing the stale un-sanitized lineage there; superseded dirty `portfolio` ref deleted from private (squashed release lives on origin). Full-lineage literal/PII scan of all 116 commits ran clean except the local Windows username in tool paths — fixed tree-level (`%USERPROFILE%`).

### Security
- **PAT finding closure update (2026-06-09):** the old committed PAT was revoked (documented in commit `2b5339f`). **Account-level "Push protection for yourself" is enabled on the operator's GitHub account as of 2026-06-09** — pushes containing detectable secrets are now blocked at push time across the account's repos. Per-repo GitHub Advanced Security secret scanning is **not available** on private personal repos (API attempt returned 403/unsupported), so no repo-level secret-scanning claim is made.
- ⚠️ **Open finding:** the `Ronny-Yee/Aegis` repo (origin) reports **PUBLIC** visibility as of 2026-06-09 — the 2026-05-22 org scan had counted it private. Origin pushes frozen pending operator decision; `main` has never been pushed to origin.
- **Literal-zero enforcement (2026-06-09, operator-ruled):** (1) pruned origin to **portfolio-only** — deleted 3 stale feat refs plus a previously-uncatalogued `docs/hedgefund-workspace` branch (unique content archived locally + in bundle; lineage verified PAT-free); flip-to-private is **blocked on token scope** — operator must flip manually; GitHub's immutable `refs/pull/*` still reach old lineage (support ticket required for removal). (2) Purged the pre-sanitization lineage roots (`refs/private-backup/*`), expired reflogs, gc-pruned. (3) **Full-history `filter-repo --replace-text` rewrite** (foreground, 130 commits, bundles verified first) covering all org-name variants (CamelCase/spaced/dotted/lowercase, case-insensitive) → **pickaxe and blob scans print zero across all refs**; rewritten `main` force-with-lease pushed to private. Rollback bundles (containing literals by design) are held offline, off-repo.
- **Correction:** the earlier v8.3 claim that the 116-commit lineage scan was "clean except the local Windows username" was **wrong** — two v2/v3-era commit trees contained the org-name literal in CamelCase/spaced forms. Root cause: hit-class sampling during verification (lesson captured in `tasks/lessons.md`, routed to `lessons-shared`). The rewrite above removed both.
- **Koinon scanner regex defanged** (`5a9d0cd`): the contiguous org-domain literal no longer appears in the scanner's own source (character-class form, matching unchanged); submodule bumped in both consumer agents.

## [v8.2] - 2026-05-22 — Phase 10 command completion + org-wide security scan

Completes the items deferred in v8.0/v8.1: the IT-command stub backlog (the audit's ⏳ list) and the org-wide GitHub security enumeration that v8.0 deferred for lack of the `gh` CLI.

### Added — IT commands rebuilt to the gold-standard rubric (Phase 10)
17 stub commands rebuilt (Verdict → What to check first → portal-first fix → PowerShell in collapsed `<details>` with per-line comments → ⚠️ risk → verification → Jira note), placeholders only:
- **M365 apps:** `/outlook-issue`, `/teams-issue`, `/onedrive-issue` (sync triage; recovery stays in `/onedrive-restore`)
- **Email/Defender:** `/email-quarantine`, `/email-whitelist` (5 allow methods ranked by safety + decision matrix), `/email-to-spam` (inbound false-positive + outbound deliverability), `/conditional-access` (lockout gate + break-glass + Report-only-first)
- **Network/endpoint/sync:** `/meraki-health`, `/meraki-vpn-status`, `/printer-issue`, `/new-device-setup`, `/ad-connect`
- **VoIP:** `/sip-trunk-status`, `/unite-extension-create`, `/unite-voicemail-reset`, `/unite-migration-status` (live tracker)
- **Reference:** `/ps-error-decode` (PowerShell error decoder)
- `/shared-mailbox-create` reduced to a redirect alias of `/shared-mailbox` (dedupe). One commit per command.

### Security — org-wide scan + PAT history purge
- **Org-wide enumeration** via `gh` (authenticated as `Ronny-Yee`): 19 repos — 18 private, 1 unrelated public (clean). Nx-Console (2026-05-20) breach vector **absent**. `Alex-private` **clean**.
- 🔴 **Committed GitHub PAT** (`Keys` file) found **live** in 3 pushed branches of the private Aegis repo (GitHub secret scanning was disabled → no auto-revoke). Per operator decision (**revoke + full purge**): full backup bundle → `git-filter-repo` strip → force-pushed all 3 branches with `--force-with-lease` (`feat/aegis-v8-2026-05-22`, `portfolio`, `feat/unified-aegis-hermes-war-room`). Verified: no ref references `Keys`; `main` untouched.
- **Operator follow-up (closed in v8.3):** the token was revoked — purge ≠ revocation, and GitHub caches the now-unreachable commit by SHA until GC. Full report retained in the private dev tree.

### Reconciliation
- v8.0 listed the Hermes handoff ingest (Phase 2/3) + war-room live tests as "pending the SSH key" — both were in fact completed and committed (`docs/handoff/2026-05-22/TESTING.md` + the war-room mechanics-reconciliation commit). This entry supersedes that pending status.
- The remaining stub backlog from the v8.1 `IT-COMMAND-AUDIT.md` (⏳ items) is now cleared.

### Notes
- All work on branch `feat/aegis-v8-2026-05-22`. No merge to main; no PR opened by the build run.

## [v8.1] - 2026-05-22 — Aegis IT engineer capability upgrade

Additive to the v8.0 IT-operations role: make Aegis world-class at the IT-engineer job, scoped (M365/Entra/Intune/Exchange/hybrid AD/Meraki/security/VoIP). Identity boundary kept clean — general intelligence stays with Aegis D Hermes.

### Added — new IT commands (B2 gap-fill)
`/distribution-list`, `/license-audit`, `/intune-compliance`, `/meraki-site-vpn`, `/onedrive-restore`, `/security-alert-triage`, `/mailbox-permissions`, `/group-membership-audit` — each portal-first, PowerShell in collapsed `<details>` with per-line comments, placeholders, verification gate, destructive-action warnings.

### Changed — rebuilt stub commands to the IT rubric (B1)
- Rebuilt to gold-standard (Verdict → checks → portal-first fix → PS `<details>` → ⚠️ risk → verification → Jira note): `/password-reset` (hybrid AD authority), `/mfa-issue` (CA-blocks-re-registration gotcha), `/device-wipe` (wipe-vs-retire confirmation gate), `/shared-mailbox`, `/sharepoint-access`.
- Rebuilt as systematic decision trees (B3): `/troubleshoot` (master router), `/lan-wan`, `/wifi-issue`, `/vpn-check` — symptom → isolation → ranked causes → fix → verification.
- Upgraded `/runbook` into a board-grade IT documentation generator (B4): consistent templates for runbook, SOP, KB article, incident report, change record.

### Changed — identity (B5)
- CLAUDE.md Identity reframed: Aegis is the **best-in-class IT engineer** (scoped + action-first + verification discipline). Removed "alien-level / general intelligence" language; added an explicit scope boundary — cross-domain/general intelligence belongs to Aegis D Hermes via `/ask-hermes`.

### Changed — tooling
- Pre-commit hook: allowlisted `github.com` service addresses (`git@github.com`) to remove a false-positive PII block.

### Audit + tests (B1/B6)
- `docs/handoff/2026-05-22/IT-COMMAND-AUDIT.md` — rubric audit of all commands (gold-standard vs. stubs) + fix plan. Remaining stubs (`outlook-issue`, `teams-issue`, `onedrive-issue`, `conditional-access`, `email-quarantine`, several VoIP/meraki/email/AD) marked as a prioritized follow-up batch with the template ready.
- Self-test: all new/changed commands pass structure lint (frontmatter, balanced fences, required sections) + 0 forbidden-literal sanitization hits.

### Notes
- All IT-ticket commands keep portal/GUI first, PowerShell second, placeholders for identities, and explicit destructive-action gates. One commit per command on `feat/aegis-v8-2026-05-22`.

## [v8.0] - 2026-05-22 — War Room integration + six Hermes-bridge commands + post-breach security scan

### Added
- **Six read-only War Room slash commands** in `.claude/commands/`, bridging the laptop to Aegis D Hermes's trading war room (each its own commit, production-usable, not stubs):
  - `/war-room` — open the latest dashboard (live URL or latest rendered HTML pulled read-only).
  - `/morning-brief` — print the latest Daily Hunt / market-open brief in the terminal.
  - `/portfolio-status` — core-holds snapshot: price, day move, one-line read.
  - `/dashboard-render [date]` — trigger a fresh War Room v30 render (additive artifact only; never a state/service change).
  - `/alpha-signal TICKER` — one-line plain-English signal read for a ticker.
  - `/hermes-status` — health check: SSH ping + both war-room cron jobs registered + last render age.
- **Three reusable skills** in `.claude/skills/` capturing this build's patterns:
  - `agent-handoff` — SOP for ingesting a peer agent's staged handoff (reachability gate → manifest → read-only pull → sanitization gate → branch ingest → integrate → verify → report).
  - `war-room-ops` — operating pattern for the read-only Hermes bridge command family (lane + placeholder + fail-soft discipline).
  - `hermes-bridge-powershell` — reusable read-only PowerShell/SSH templates (remote pull, latest-file scp, full-history secret scan, sanitization gate).
- `docs/handoff/2026-05-22/` — war-room command testing notes (`TESTING.md`). Ingest of the sanitized Aegis D Hermes handoff bundle + manifest (Phase 2/3) is **pending the Hermes SSH key** — see RUN_REPORT / QUESTIONS Q1.

### Security
- **Post-breach security scan (read-only, report-only)** following the 2026-05-20 GitHub supply-chain breach (poisoned Nx Console VS Code extension vector). Findings retained in the private scan report:
  - 🔴 CRITICAL: a committed GitHub PAT in the `Keys` file across 5 commits incl. HEAD (masked in the report) — remediated: revoked + rotated + history purged (see v8.2/v8.3).
  - 🟢 Breach vector NOT present on this machine (no `nx-console` / Nx extension installed).
  - 🟢 `Alex-private` repo clean. Org-wide enumeration deferred (no `gh` CLI on the machine).
  - No remediation performed and no history rewritten — remediation is the operator's call.

### Changed
- CLAUDE.md → v8.0 header; added a compact read-only "War Room — Hermes bridge commands" table beside the `/ask-hermes` section (CLAUDE.md stays lean; command detail lives in `.claude/commands/`).
- README.md — added the War Room bridge command table to the Slash Commands section.

### Notes
- All war-room commands resolve Hermes host/paths as `[HERMES_*]` runtime placeholders (never literal), auth via the loaded ssh-agent key, fail soft when Hermes is offline, and log to `hermes-escalation-log.md`. Finance stays in Hermes's lane — these surface data, they don't advise.
- Built on branch `feat/aegis-v8-2026-05-22` for operator review; no merge to main, no PR opened by the build run.

## [v7.4] - 2026-05-18 — Codex mode router + safety hardening + reference doc linkage

### Added
- `docs/codex-modes/` — mode router for the Codex CLI (a separate agent): MODE-ROUTER, ARCHITECT, AUDITOR, BUILDER, COFOUNDER, CYBERSECURITY, HANDOFF, PLANNER, SUPERBRAIN. Defines safe defaults, edit boundaries, and verification expectations per mode.
- `AGENTS.md` at repo root — agent-aware design document.
- "Reference Docs" section in CLAUDE.md linking `docs/architecture.md`, `docs/examples.md`, `docs/security_model.md`, and `docs/codex-modes/`. Surfaces high-quality agent design docs that were previously unlinked.

### Changed
- `.claude/commands/onboard.md` expanded with fuller onboarding workflow (+63 lines).
- `.claude/commands/ask-hermes.md`, `docs/hermes-integration.md`, `README.md`, `.gitignore` — small hardening tweaks.

### Notes
- codex-modes/ commands (`/audit`, `/sec`, `/build`, etc.) belong to Codex, not Aegis (Claude Code). Aegis uses its own Workflow Orchestration. The CLAUDE.md reference is operator-awareness only.

## [v7.3] - 2026-05-18 — Aegis D Hermes general-intelligence merge

### Added
- Merged the Aegis D Hermes operating profile into Aegis identity: elite broad-domain reasoning, root-cause analysis, plain-language explanation, and practical execution support.
- Added `docs/aegis-d-hermes-operations-hq.md` to document the Aegis ⇄ Hermes relationship, escalation triggers, safety boundaries, and repo relationship.

### Changed
- Reframed Hermes in README/CLAUDE.md as **Aegis D Hermes**, the VPS-hosted broad-domain general-intelligence partner for trading, macro, cyber, War Room, architecture, advanced troubleshooting, and cross-domain second opinions.
- Tightened lane discipline: Aegis remains IT execution owner; Hermes output must be integrated into safe, environment-specific steps before use.

## [v7.2] - 2026-05-16

### Added
- `docs/ticket-examples.md` — four worked tickets in the canonical §4 response format: hybrid AD password reset, MFA reset after phone replacement, destructive license removal (destructive-action gate firing), site-wide slow internet at a remote site. Each shows full Verdict → Verification → Jira-note arc.
- `docs/plan-mode-templates.md` — canonical high-risk-surface plans for Conditional Access policy changes, mass license operations (>10 users), site-to-site VPN cutover, and BitLocker recovery key retrieval. Each ends with a Nova hand-off prompt.
- `docs/hermes-integration.md` — full `/ask-hermes` escalation playbook: triggers with examples and counter-examples, integration-note discipline, every failure mode and fallback, audit-log lifecycle, placeholder discipline across the SSH bridge.
- `docs/build-upgrade-examples.md` — worked good-vs-bad upgrade comparison using the v6.2 → v7 evolution as the good shape and a composite anti-pattern as the bad shape. Makes the 10-step Build/Upgrade Mode protocol concrete.

### Changed
- CLAUDE.md gains four short pointer paragraphs — one per docs file above — in the Response Format, Plan Mode, `/ask-hermes`, and Build/Upgrade sections. The brain stays lean and references depth on demand instead of carrying it in context.
- Header bumped to v7.2. v7.1 trim and v7.0 architecture remain in force.

### Notes
- Net CLAUDE.md size delta ~+1.3 KB; total still well under Claude Code's 40k-char limit. Depth lives in `docs/`, not in context.
- v7.2 is purely additive on top of v7.1. No behavior weakening, no rules changed.
- The four new docs files are read on demand — Aegis pulls them in only when the matching scenario fires.

## [v7.1] - 2026-05-14

### Changed
- Trim pass — brought CLAUDE.md from ~42.5k to ~35.5k chars, back under Claude Code's 40k context limit. Behavior unchanged; this is a size/structure trim, not a rules change.
- Consolidated the four troubleshooting sections (Decision Trees, MFA Workflows, Network Troubleshooting, VoIP Troubleshooting) — which duplicated Koinon's T-01–T-10 — into a single "Troubleshooting — Koinon T-Patterns" pointer section. Environment-specific state (VoIP migration status, S2S VPN migration) is retained.
- Moved the 2026 Admin Portal Navigation reference into docs/portal-nav-2026.md; CLAUDE.md points to it and reads it on demand. Keeps the brain lean without losing the exact-path reference.
- Onboarding/Offboarding sections replaced with short summaries that defer to the existing /onboard and /offboard slash commands instead of duplicating the full checklists.
- Merged the redundant "First Action" + "Shared Library (Koinon)" sections into one "Session Start — Orient Before You Operate" section.
- Extended Confirmation Gate now references Koinon SR-2 as canonical instead of re-listing it; Jira, PS-error, Script-Safety, and Escalation sections condensed.

### Added
- docs/portal-nav-2026.md — the exact 2026 admin-center navigation paths, read on demand by Aegis.

## [v7.0] - 2026-05-14

### Added
- "First Action — Orient Before You Operate" protocol — Koinon-first session-start orientation with the 5-point report mandate for build/upgrade asks
- Four-agent stack model — Aegis / Metis / Nova / Hermes, each with a defined lane
- Agent Registry — formal Aegis entry (Purpose / Scope / Inputs / Outputs / Reliability / Safety)
- Response Format section — the ticket structure: Verdict, What to check first, Step-by-step fix, PowerShell for reference only, Risk warning, Verification checklist, Jira-ready note
- Output Templates section — Daily Ticket Template (pasted-ticket work-up) + Runbook Template
- Training Mode section — "teach me / explain / why" behavior
- Build / Upgrade Mode section — the 10-step upgrade protocol
- Security Behavior section — temporary-exception labeling, security-control-first-fix prohibition
- Non-Negotiables checklist

### Changed
- Self-Improvement Loop rewritten as a two-stage flow — tasks/lessons.md is now the local staging buffer (the only place Aegis writes lessons); lessons promote to Koinon shared/memory/ via PR. Lesson format gains a "Promote to:" routing line. Archival moves to Koinon's domain.
- Parallel Awareness — agent ownership table replaced (was Aegis/Nova/Red) with the corrected four-agent stack; the mobile IT agent is Metis (matches Koinon), not "Red"
- /ask-hermes escalation re-framed — Hermes is the trading / cyber / macro / War Room broad-domain partner; finance/markets work redirects there
- Placeholder section consolidated — removed the parallel [YOUR_DOMAIN] / [YOUR_ORG] list; Koinon's placeholder-dict.md is now cited as the single source of truth; canonical domain restated as env-var-only
- Error Recovery Protocol noted as mirroring Koinon SR-5
- Tone section aligned with the project-instructions spec

### Notes
- v7 scope was CLAUDE.md + this CHANGELOG only. The command-file placeholder drift, the canonical-domain literal in Koinon source, and the standalone four-agent registry remain open on their own tracks.
- On applying v7, tasks/lessons.md is reset to a staging-buffer template. Its prior 10 entries are already canonical in Koinon's shared/memory/lessons-*.md — nothing is lost.

## [v6.2] - 2026-04-08

### Added
- Workflow Orchestration engine (plan mode, verification gates)
- Self-Improvement Loop with lessons.md feedback system
- Error Recovery Protocol (retry/escalate pattern)
- Prompt Injection Defense (OWASP LLM01)
- Script Safety Auto-Scan (12 dangerous cmdlet patterns)
- Extended Confirmation Gate (20+ high-impact actions)
- Pre-commit PII and credential scanner
- Agent ownership table (Aegis/Nova/Red boundaries)
- Nova plan-review supervision pattern
- Lesson archival process (50-entry rolling window)
- Runnable security scripts (log-analyzer, hash-checker)
- System health check script (Windows-native)
- Pre-deployment checklist validator
- Real-world examples documentation (docs/examples.md)

### Security
- OWASP LLM Top 10 audit completed (15 findings, 3 Critical)
- settings.local.json self-modification lockdown (LLM08)
- Lessons scoped to never override security gates (LLM08)
- Full prompt injection detection and alerting (LLM01)

## [v6.0] - 2026-03-27

### Added
- Tier 3 IT engineer persona
- 30+ slash commands for common IT workflows
- Hybrid AD + Entra environment support
- Decision trees for troubleshooting
- Vendor escalation templates
- PowerShell safety formatting (collapsed blocks, line-by-line comments)

## [v5.0] - 2026-03-01

### Added
- Initial CLAUDE.md with environment context
- Basic onboarding/offboarding workflows
- Admin portal navigation reference
- Placeholder enforcement rule
