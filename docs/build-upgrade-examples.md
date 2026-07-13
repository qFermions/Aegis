# Build / Upgrade Mode — Worked Examples

The Build/Upgrade Mode protocol in CLAUDE.md is ten steps, but the steps only mean something once you've seen them applied. This doc walks through one *good* upgrade and one *bad* upgrade, so the shape of "doing it right" is concrete.

---

## The 10-step protocol (summary, from CLAUDE.md)

1. Inspect current files
2. Identify active rules
3. Identify duplicate or outdated files
4. Preserve working systems
5. Propose the upgrade plan — let the operator pick, don't auto-apply
6. Patch only the correct files
7. Add Aegis to any agent registry/table
8. Update docs
9. Add verification steps
10. Summarize what changed

The protocol is anti-yolo. It forces orientation before action and verification before "done."

---

## Good upgrade — the v7 evolution (what actually happened)

**Ask:** "Upgrade Aegis to the current project-instructions spec."

**Step 1 — Inspect current files.** Read CLAUDE.md (v6.2), `.claude/commands/`, `docs/`, `modules/`, `tasks/`, Koinon's `shared/` (all four security files, all 10 T-patterns, lessons-shared, lessons-aegis), `.gitmodules`, `CHANGELOG.md`. Read the project-instructions spec to understand what "current" means.

**Step 2 — Identify active rules.** Build the layer diagram: Koinon `security-preamble.md` is immutable and overrides everything. CLAUDE.md owns desk behavior. Commands own specific workflows. The precedence is explicit.

**Step 3 — Identify duplicates and drift.** Found: `tasks/lessons.md` (local) duplicated `shared/memory/lessons-*.md` (Koinon canonical). CLAUDE.md ownership table called the mobile agent "Red"; Koinon called it "Metis." The canonical domain literal was hardcoded in two Koinon source files (against the env-var-only rule). Commands used parallel placeholder sets not in `placeholder-dict.md`. Three ticket formats coexisted (CLAUDE.md vs §4 vs §12).

**Step 4 — Preserve working systems.** The Koinon submodule wiring works. The T-01–T-10 trees + adapter work. The eval harness (84 cases) works. The modules/ playbooks work. The pre-commit scanner works. **Leave them alone.** The trim/upgrade goes after the drift, not the working pieces.

**Step 5 — Propose the plan, don't auto-apply.** Wrote the upgrade plan in chat. Identified scope boundary: v7 = CLAUDE.md + CHANGELOG only. Command placeholder drift, Koinon domain literal cleanup, and standalone agent registry stayed on their own tracks. Surfaced two open decisions for the operator (ticket-format reconciliation, lessons pointer scope). Waited for picks.

**Step 6 — Patch only the correct files.** Drafted `CLAUDE-v7-DRAFT.md` in the workspace folder — not the live `CLAUDE.md`. Used a single Write call. Built the apply script separately. Operator reviews before any commit.

**Step 7 — Update agent table.** Replaced the Aegis/Nova/Red ownership table in CLAUDE.md with the corrected four-agent stack (Aegis/Metis/Nova/Hermes). Added the formal Agent Registry row for Aegis per the §11 schema.

**Step 8 — Update docs.** v7 added pointers from CLAUDE.md to Koinon's `placeholder-dict.md` as the canonical placeholder source. v7.1 moved the 2026 Admin Portal Navigation reference into `docs/portal-nav-2026.md`. README v7 refresh patched the portfolio README to reflect the four-agent stack, the Koinon submodule, the two-stage lessons flow.

**Step 9 — Add verification steps.** The apply scripts include hard verification gates:
- v7.0 apply: 6 section markers must be present, no stray "Red", scope is exactly 3 files
- v7.1 apply: CLAUDE.md must be under 40,000 chars, all v7.1 markers present, `docs/portal-nav-2026.md` exists
- README v7 apply: 6 positive markers present, 3 negative markers absent, no stray "Red"

Each script bails *before* committing if any check fails. No half-applied upgrades.

**Step 10 — Summarize.** CHANGELOG gets a v7.0 entry, a v7.1 entry. Each entry calls out what was Added, what was Changed, and (importantly) what was deliberately scoped *out*. The "Notes" section flags what remains open on other tracks.

**Why this is the good shape:** Orientation BEFORE proposal. Proposal BEFORE apply. Verification BEFORE commit. Documentation alongside the change, not after. Operator approves at every fork.

---

## Bad upgrade — what to avoid (composite anti-pattern)

**Ask:** same.

**Anti-step 1 — Skip orientation.** Open CLAUDE.md, see "v6.2," assume it's behind, start rewriting from memory of what the project instructions said. **Result:** miss that Koinon already owns the placeholder dictionary; introduce a parallel `[YOUR_*]` token set in CLAUDE.md that conflicts with `[@Aegion_*]`. The pre-commit scanner doesn't catch it because the parallel tokens *look* like placeholders.

**Anti-step 2 — Edit the live file directly.** Use `Set-Content` to overwrite `$env:CLAUDE_PROJECT_DIR\CLAUDE.md` with the new version. No backup, no draft, no script. **Result:** if anything's wrong, the only recovery is `git checkout`, which is fine *unless* uncommitted local changes existed. Two minutes saved upfront, fifteen minutes lost recovering one user's work.

**Anti-step 3 — Auto-apply across branches.** Loop through every git branch and apply the same patch. **Result:** the `main` branch (real daily-ops state) gets clobbered by the `portfolio` (sanitized showcase) content. Personal data the operator had on `main` for legitimate operational reasons is overwritten with placeholders; the operator now has to manually re-add them while the agent is mid-incident.

**Anti-step 4 — Inline all the depth.** Add full Conditional Access policy templates, complete onboarding/offboarding checklists, full PowerShell error reference tables, every T-pattern's full content — *into CLAUDE.md*. **Result:** CLAUDE.md balloons to 60k chars, triggers Claude Code's performance warning, slow context loads degrade every response. The content was already in Koinon and modules — inlining was duplication.

**Anti-step 5 — Skip the changelog.** Apply the changes, commit, push. No CHANGELOG entry, no version bump, no scoped-out notes. **Result:** six months later, no one (including the operator) remembers what changed in this PR, why the four-agent table replaced the three-agent one, or whether the placeholder change was intentional or accidental.

**Anti-step 6 — Trust pure-AI verification.** "I rewrote the brain, looks good, ship it." **Result:** a subtle drift — say, the destructive-action gate's wording weakened from "explicit yes" to "the operator can opt in" — slips through. Six weeks later, an Intune mass-wipe goes off without the gate firing. Verification by another agent (Nova) or by a deliberate test against `shared/evals/cases/` catches what self-review doesn't.

---

## The pattern that separates good from bad

| Stage | Good | Bad |
|---|---|---|
| Orientation | Read first, propose second | Assume, then patch |
| Scope | Define boundary; flag out-of-scope items | Touch everything that "feels relevant" |
| Approval | Wait for explicit operator pick on forks | Pick the "obviously right" thing yourself |
| Apply | Drafts in workspace, apply script with verify gates | `Set-Content`, `Force`, commit |
| Verification | Pre-commit gates, post-commit eval, Nova review | "Looks right to me" |
| Documentation | CHANGELOG + Notes (what was scoped *out*) | Just merge the PR |

The protocol exists because the bad-shape failures are the ones that compound. A subtle weakening of a security gate in v6.2 → v7 isn't visible until a real ticket trips the now-missing gate.

If a proposed upgrade can't fit through all 10 steps without cutting corners, the upgrade is too big — split it.
