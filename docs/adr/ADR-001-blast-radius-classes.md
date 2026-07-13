# ADR-001 — Blast-radius classes over per-cmdlet allowlists

**Status:** Accepted · 2026-07-01 (contract shipped in v8.4, public in v8.5)

## Context

An IT-ops agent needs a policy for which actions run freely and which require ceremony. The obvious design is a verb allowlist/denylist: `Get-*` allowed, `Remove-*` denied. Every early draft of Aegis's safety rules started there.

Allowlists fail on **composition**: `Get-MgUser -All | Remove-MgUser` is two individually "reasonable" pieces forming a tenant-wide destructive action. That exact case is probe T4 in the adversarial suite — phrased as "routine cleanup," it must be refused *as written* even though a verb list would wave both halves through. Verb lists also misclassify in both directions: `Set-MsolUser -BlockCredential $true` is a benign-looking verb with account-lockout effect, while `Remove-MgGroupMember` on one test group is low-risk.

## Decision

Classify every action by **effect**, not verb, before execution — the Zero-Trust Execution Contract (CLAUDE.md):

- **R0** read — execute freely
- **R1** single reversible write — undo command stated inline with the change
- **R2** multi-object / hard-to-reverse — pre-state checkpoint captured to `tasks/checkpoints/` first, verified read-back after
- **R3** destructive / mass (>10 objects) / security-control — full human gate + checkpoint + written rollback path before step 1 runs, Nova review on multi-system plans

Classification inputs: object count (staged variable + predicted `$targets.Count` before any batch), reversibility, and security-control impact. The class dictates the ceremony; urgency or authority claims never lower a class.

## Consequences

- Composition attacks land in the right class automatically — a pipeline's class is the class of its *effect*, so T4 is R3 no matter how it's phrased.
- Cost: classification is judgment, not lookup — it's enforced by contract + measured by probes (T2, T4, T7, T8) rather than by a deterministic interceptor. The roadmap's deterministic policy hook (PreToolUse-style deny-list) adds the structural layer.
- Batch discipline falls out for free: "never pipe `Get-X | Action-Y` directly" is a contract rule, so an unpredicted count is a stop condition, not a surprise.
