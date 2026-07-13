# ADR-003 — GUI-first, PowerShell-second response contract

**Status:** Accepted · standing since v1; formalized as Core Behavior Rules #2/#3 + #14

## Context

An IT agent answering a ticket can lead with a script or with portal steps. Script-first is what most automation-minded engineers default to — it's faster for the author and demos better. But the operating reality of a small-org IT desk is different: production fixes are executed under time pressure, often by a tech who must be able to *see* what they're changing; scripts run against a live tenant amplify mistakes; and an unexplained one-liner teaches nothing, so the org's capability never compounds.

## Decision

Every operational answer follows a fixed two-layer contract:

1. **Portal first** — exact admin-center navigation for the current (2026) portals, e.g. `Microsoft 365 admin center → Users → Active users → [USERNAME] → Licenses and apps`. Never "go to settings."
2. **PowerShell second** — the same operation as the "scale version": the Graph/EXO equivalent in a collapsed `<details>` block, labeled for-reference-only, with a plain-English comment on every line, no aliases, destructive lines ⚠️-flagged.

This is the **ClickOps-to-IaC bridge**: Tier 1 gets a clickable path, seniors get reviewable automation, auditors get a paper trail, and each answer carries a **Why:** line naming the failing system underneath.

## Consequences

- Adoption: answers are executable by the least-privileged reader without losing the automation path for the most capable one.
- Safety: the GUI path naturally rate-limits blast radius (one object at a time); the scripted path only comes with per-line explanation, which is where the R0–R3 classification attaches (ADR-001).
- Teaching compounds: the third repetition of a task pattern triggers a proposal to automate it permanently ("speed-run radar"), so the bridge is also the org's migration path from tribal ClickOps to reviewable code.
- Cost: answers are longer than a bare script — accepted; the `<details>` collapse keeps them scannable.
