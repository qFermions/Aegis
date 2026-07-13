# ADR-002 — Repository teardown over history rewrite: revocation, not redaction

**Status:** Accepted · 2026-06-09 (executed for the first public release; reaffirmed for v8.5-public)

## Context

The original development history contained real operational data — org-name literals in old commit trees, a committed PAT (revoked), and financial/personal data in early command docs. The repo was intended for public release.

Two remediation paths existed:

1. **History rewrite** (`git filter-repo --replace-text`) — preserves the contribution graph and commit archaeology.
2. **Teardown** — delete the public remote entirely and ship a fresh-SHA, single-commit curated tree.

A rewrite leaves the data alive in every fork, clone, and GitHub's cached `refs/pull/*` (which survive rewrites and require a support ticket to purge). Once operational data has been public, rewriting your copy redacts nothing anyone else holds.

## Decision

Treat leaked operational data like a leaked credential: **revocation, not redaction.** Tear down the exposed remote, and publish a curated tree as a single fresh-SHA commit (`v8.5-public: main @ c46c2e5`), gated by a full-tree scan (org literals in all casing variants, PII patterns, credential formats) that must print **zero** before push. The private dev history was additionally rewritten — but the public trust story rests on the teardown, not the rewrite.

## Consequences

- `git ls-remote` shows one ref, one commit — there is no reachable history to audit *because that was the requirement*.
- The contribution graph was sacrificed; authorship is evidenced instead by the CHANGELOG's decision trail, these ADRs, and depth that doesn't fake (65 workflows keyed to real 2026 portal navigation, platform-specific rollback patterns).
- Every future public release is a deliberate, scanned push from a staging tree — never an auto-sync of the dev repo. The CI release gate (`.github/workflows/release-gate.yml`) makes the scan continuous and public.
