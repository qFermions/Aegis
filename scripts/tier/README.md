# Tier 1 / Tier 2 lightweight lane — contract (v8.6.x, additive)

Routing doctrine: `docs/harness.md` §Tier routing. This lane is ADDITIVE: the
Tier-3 fortress (graph, memory, loops, independent review, R0–R3) is unchanged
and owns everything consequential.

## The lane

```
plain-English ticket
  → replay lookup (existing, unchanged)        CACHE_HIT → verified solution, done
  → tier-guard (deterministic floor)           floor=T3 → existing Tier-3/R-ladder path
  → lead classifies T1 / T2 / T3 by judgment   (scope, blast radius, reversibility,
                                                diagnostic complexity, systems,
                                                authorization risk, novelty, uncertainty
                                                — never keywords alone)
  → T1 → ONE dispatch of agent `tier1-support` (Fable, effort medium)
  → T2 → ONE dispatch of agent `tier2-support` (Fable, effort high)
  → T3 → existing fortress, exactly as before
  → answer → existing verification / memory-eligibility rules (unchanged)
```

Exactly two handlers, both dual-ecosystem (Microsoft + Google). No fan-out, no
graph, no reviewer, no repair loop, no recursive spawning — the handler cards
have no Agent tool and carry the prohibition as doctrine. A handler that
discovers consequential work mid-ticket returns `ESCALATE:` as its first line
and the lead routes to the existing path.

## Security invariant

Support tier never overrides action risk. The guard force-floors SR-2-class,
mass, security-control, and extended-gate work to the existing machinery before
any lightweight dispatch — "disable one compromised account" and "disable 150
employee accounts" both floor (both are SR-2 gated), with distinct triggers; the
existing R0–R3 ladder then sizes the ceremony. A ticket that mentions a
suspected compromise, breach, or unauthorized sign-in also floors (lane floor,
not an SR-2 class): "new phone, reset MFA" is routine, "new phone, but we think
the account was compromised" is an incident and belongs to
`/security-alert-triage`. Guard misses fail toward the safer path because the
lead's own classification doctrine also escalates on ambiguity-with-consequences.
The R0–R3 ladder, SR rules, and memory promotion rules are untouched.

The same guard is consulted by the replay cache: identity-variant (shape) keys
are only ever matched when both the stored ticket and the lookup ticket are
floor-clean (`scripts/replay/README.md`).

## Persistence / cold start

No CLAUDE.md change. A fresh session discovers the lane through two durable
surfaces it already loads: (1) the `.claude/agents/` listing, where both handler
descriptions state their dispatch conditions; (2) `docs/harness.md`, which
CLAUDE.md's strategy selector already points at for routing doctrine. The
engineering references behind this lane are extracted here and in the doctrine —
no research documents need re-feeding.

## Tests

`node scripts/tier/tier-routing.test.js` — guard floor behavior (Microsoft +
Google, T1/T2 clean + escalation cases), exactly-two-handlers, no-Agent-tool
negative evidence, dual-ecosystem coverage, doctrine wiring, replay-before-
handler semantics, Tier-3 non-interference.
