---
name: agent-handoff
description: SOP for ingesting a staged handoff from another agent (e.g. Aegis D Hermes → Aegis) — reachability gate, manifest read, read-only pull, sanitization gate, branch ingest, integrate, verify, report.
---

# Skill: agent-handoff

**Trigger:** `/agent-handoff` or "ingest the Hermes handoff" or "pull the staged bundle" or any time another agent in the stack stages files for Aegis to absorb.

**Goal:** Move a bundle of work products from one agent's machine into the Aegis repo **safely** — never leaking the source agent's internals, never writing back to the source, always verifiable.

> Maps to the runbook family. This is the canonical "agent-to-agent handoff" runbook. Worked example below = the 2026-05-22 Hermes war-room handoff.

---

## When to use
- Aegis D Hermes (or any peer agent) has staged files in a known directory + a `MANIFEST.md`.
- You need those artifacts inside the Aegis repo, sanitized and committed on a feature branch for operator review.

## Hard rules (inherit from CLAUDE.md + Koinon)
- **Source is READ-ONLY.** SSH for `cat`/`scp`/`rsync` pull only. Never write back to the source agent's host.
- **Sanitization gate is non-negotiable.** Re-scan the sanitized subset before ingesting. Any forbidden-pattern hit ⇒ STOP, log it, do not commit that file.
- **One feature branch.** All ingest commits land on a single `feat/...` branch. No push to main, no PR — operator opens PRs.
- **No credential reads.** Auth via the operator's ssh-agent / git credential helper — never read token/key files.

## Steps

### 1. Reachability gate
```
ssh -o ConnectTimeout=10 [PEER_SSH_USER]@[PEER_HOST] 'whoami'
```
- Pass → continue. Fail with auth error → print Aegis's **public** key, give the operator the exact `authorized_keys` append command for the peer console, STOP and wait for "key added", retry once.

### 2. Read the manifest first
```
ssh [PEER_SSH_USER]@[PEER_HOST] 'cat [PEER_STAGING_DIR]/MANIFEST.md'  > local staging/MANIFEST.md
```
Confirm the expected file count + the `sanitized/` subset exist before pulling.

### 3. Read-only pull
- Prefer `rsync -av`; if rsync absent (Windows laptop), use `scp -r` (functionally equivalent for a one-way copy):
```
scp -r [PEER_SSH_USER]@[PEER_HOST]:[PEER_STAGING_DIR]/  ./local-staging/
```
- Confirm the file count matches the manifest.

### 4. Sanitization gate (run on the sanitized subset)
Must be **0 hits**. Fill the bracketed terms from your peer's real internals + the canonical secret-prefix ruleset in your **private** security config — never commit the literal forbidden values into a sanitized repo:
```
grep -nE '<peer_home>/\.<agent>/|/opt/<agent>|<PEER_IP>|<peer_user>@<peer>|<peer_hostname>|<llm_key_prefixes>|<vcs_token_prefixes>' sanitized/*
```
- 0 hits → proceed. Any hit → log `file:line:pattern` to ABORT.log, skip ingest of the offending file, continue with the rest.

### 5. Branch + ingest
```
git fetch origin
git checkout -b feat/<name>-<date>
mkdir -p docs/handoff/<date>/
# copy sanitized files + MANIFEST.md into docs/handoff/<date>/
git add docs/handoff/<date>/ && git commit -m "feat: ingest <peer> handoff bundle <date>"
```
Use scoped `git add <path>` — never sweep in unrelated working-tree changes.

### 6. Integrate
Turn raw handoff content into Aegis-native artifacts (slash commands, skills, docs). Keep peer internals as `[PEER_*]` placeholders — the integration is where leaks happen, so re-scan anything you author.

### 7. Verify + report
- Verify each artifact (frontmatter parses, no unfilled placeholders, no forbidden patterns).
- Write a RUN_REPORT: what came in, what was built, what's deferred, recommended operator next steps.

## Verification checklist
- [ ] Manifest file count == pulled file count
- [ ] Sanitization scan = 0 forbidden hits on everything committed
- [ ] Nothing written back to the peer host
- [ ] All commits on the single feature branch; main untouched
- [ ] RUN_REPORT written

## Worked example — Hermes war-room handoff (2026-05-22)
Hermes staged 26 files + `sanitized/` + `MANIFEST.md` at its staging dir. Aegis: gated SSH → read manifest → `scp -r` pull (rsync absent) → 0-hit sanitization scan on `sanitized/` → branch `feat/aegis-v8-2026-05-22` → ingest into `docs/handoff/2026-05-22/` → built 6 read-only war-room slash commands → verified + reported. Hermes never written to.
