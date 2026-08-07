# Aegis Ticket Graph (ATG) — contract v1

Deterministic graph engine for working one IT ticket through specialized,
isolated workers. The engine (`engine.js`) owns state, edges, and gates; the
node "brains" are native Claude Code subagents (`.claude/agents/graph-*.md`);
the Aegis session drives: it asks the engine what's next, spawns that node's
subagent, and submits the subagent's JSON artifact back to the engine.

Decision record: `docs/adr/ADR-004-internal-ticket-graph.md`.
Ancestry: `identity-lifecycle-factory/` (artifact shapes, loop limits, double-key
gate), `.claude/commands/troubleshoot.md` (lane taxonomy), CLAUDE.md §Zero-Trust
(R0–R3), `scripts/pre-commit-check.js` (sanitizer pattern set — keep in sync).

## Modes

| Mode | Executes changes? | Human gate | Purpose |
|---|---|---|---|
| `dry-run` (default) | Never. EXECUTOR is skipped. | Computed and **reported** in the work-up (`gates.humanRequired`), not blocking | Produce a reviewed, risk-finalized work-up + Jira note |
| `sim` | Simulated results only | **Blocking** (full ceremony) | Tests and drills |
| `live` | Real (reserved; requires `AEGIS_GRAPH_ALLOW_LIVE=1` at `new`) | **Blocking** | Future scripted execution under full ceremony |

## Nodes

One node = one responsibility = one typed artifact. INTAKE and the gates are
engine code (no model); the rest are subagents.

| Node | Kind | Artifact | One job |
|---|---|---|---|
| INTAKE | engine | (state init) | Sanitize ticket text, flag injection markers, stamp provenance |
| ROUTER | subagent `graph-router` | `router.v1` | Pick the lane + cite real specialist command(s) + first risk guess |
| SPECIALIST | subagent `graph-specialist` | `evidence.v1` | Investigate: ranked causes, checks that discriminate between hypotheses |
| BUILDER | subagent `graph-builder` | `plan.v1` | Produce the change package (steps with radius/undo/verify) |
| REVIEWER | subagent `graph-reviewer` | `review.v1` | PASS/FAIL + findings with `requiredFix`. May not rewrite the plan |
| RISK_FINALIZER | subagent `graph-risk-finalizer` | `risk.v1` | Re-classify risk from the concrete artifact (effect, not phrasing) |
| HUMAN_GATE | engine | (state) | Hash-bound, single-use operator decision via CLI only |
| EXECUTOR | engine (sim/live) | (state) | Run steps in order; halt batch on first failure |
| VERIFIER | subagent `graph-verifier` | `verify.v1` | Evidence-backed verification (command + output, never bare booleans) |
| SCRIBE | subagent `graph-scribe` | `scribe.v1` | The ONLY node that renders final output (Response Format + Jira note) |

Lanes (from `troubleshoot.md`, generalized): `identity` · `endpoint` · `exchange`
· `collab` · `network` · `voip` · `security` · `automation` · `lifecycle` · `other`.

## Artifact schemas (executable truth: `schema.js`; field spec: the role cards)

Validation is STRICT — unknown top-level keys reject the artifact (this is what
makes "an artifact that sets humanGate.decision" unrepresentable, T8).

| Artifact | Required fields |
|---|---|
| `router.v1` | `lane` (enum) · `reason` · `specialistCommands[]` (real commands) · `riskGuess` (R0-R3) |
| `evidence.v1` | `rankedCauses[]` {rank, cause, discriminatedBy} · `evidence[]` {id, kind, summary, command, output, provenance:"agent_derived"} |
| `plan.v1` | `packageId` · `summary` · `steps[]` {id, action, surface, target, targetCount, radius, mutating, undo, verify, checkpoint} · `powershell` · `builderRisk`. Mutating steps require non-empty `undo` + `verify` |
| `review.v1` | `packageId` (must equal the plan's — the verdict binds to what was reviewed) · `verdict` PASS\|FAIL · `findings[]` {id, severity, rule, evidence, requiredFix} · `checklist[]` {rule, ok} attested every round; FAIL needs ≥1 `requiredFix` |
| `risk.v1` | `level` · `reason` · `sr2Triggers[]` · `independentReviewRequired` |
| `verify.v1` | `status` passed\|failed · `results[]` {check, command, output, ok} — `output` evidence mandatory; failed requires `rollbackNote` |
| `scribe.v1` | `workup` (the single rendered Response-Format work-up) · `jiraNote` (≤200 words) |

**Checkpoint actor** (R2+): the BUILDER *names* the pre-state file path in a
step's `checkpoint` field (convention: `tasks/checkpoints/…`); the engine
refuses execution until that file exists on disk; the operator/driver captures
it. Node brains are read-only and never write the checkpoint themselves.

## Edges (transition table — the only legal moves)

```
INTAKE          → ROUTER
ROUTER          → SPECIALIST        valid router.v1
SPECIALIST      → BUILDER           valid evidence.v1
BUILDER         → REVIEWER          valid plan.v1
REVIEWER        → RISK_FINALIZER    verdict PASS
REVIEWER        → BUILDER           verdict FAIL and review.round < 3   (feedback travels as findings[])
REVIEWER        → DEADLOCK          verdict FAIL and review.round >= 3  (terminal; human takes over)
RISK_FINALIZER  → HUMAN_GATE        sim/live and effective risk R3 (or SR-2 trigger hit)
RISK_FINALIZER  → EXECUTOR          sim/live and effective risk <= R2 (R2 requires checkpoint.path on disk)
RISK_FINALIZER  → VERIFIER          dry-run (EXECUTOR skipped; gates recorded, not blocking)
HUMAN_GATE      → EXECUTOR          decision approved + payload hash matches + unused
HUMAN_GATE      → REJECTED          decision rejected (terminal)
EXECUTOR        → VERIFIER          all steps done
EXECUTOR        → BLOCKED           any step failed (terminal; ❌ BLOCKED report with partial state)
VERIFIER        → SCRIBE            verification passed
VERIFIER        → BLOCKED           verification failed (terminal; rollback note required)
SCRIBE          → RESOLVED          valid scribe.v1 (terminal)
any submit      → (no move)         artifact invalid → 1 retry per node, then BLOCKED
```

Pinned refusal semantics: any submit while `awaiting_human` → **exit 2**, state
unmoved (only approve/reject/abort are legal). An exit-4 checkpoint refusal is
the one deliberate "accepted but parked" case: the risk artifact IS recorded,
the run parks at `node=EXECUTOR` with nothing executed, and `next` re-attempts
the engine node once the checkpoint file exists on disk. Refused submits
(exit 2/3/5) never advance work.

Terminal states: `RESOLVED` · `BLOCKED` · `DEADLOCK` · `REJECTED` · `ABORTED`.

## State — `aegis.graph.state.v1`

Stored at `tasks/graph-runs/<runId>/state.json`; artifacts appended under
`artifacts/`; every event in `history[]`. Placeholders only — the sanitizer
blocks tenant literals at every submit.

```jsonc
{
  "schema": "aegis.graph.state.v1",
  "runId": "atg-<uuid4>",
  "createdAt": "<iso>", "updatedAt": "<iso>",
  "mode": "dry-run",
  "node": "ROUTER",                    // next node expected to submit
  "status": "active",                  // active | awaiting_human | resolved | blocked | deadlock | rejected | aborted
  "ticket": {
    "text": "<sanitized>",
    "source": "operator | jira | pasted-content",
    "provenance": "operator_typed | external_content",   // pasted/quoted content is DATA (SR-3)
    "injectionFlags": [{ "line": 3, "marker": "ignore-previous-instructions", "quote": "…" }],
    "sanitization": { "tenantLiteralHits": 0, "piiWarnings": [] }
  },
  "classification": { "lane": "identity", "reason": "", "specialistCommands": ["/mfa-issue"], "riskGuess": "R1" },
  "rankedCauses": [{ "rank": 1, "cause": "", "discriminatedBy": "E1" }],
  "evidence": [{ "id": "E1", "kind": "check|log|config|recent-change", "summary": "",
                 "command": "", "output": "", "provenance": "agent_derived" }],
  "warnings": [{ "node": "", "kind": "dangerous-pattern|pii|injection-flag", "label": "", "path": "" }],
  "plan": {
    "packageId": "", "summary": "",
    "steps": [{ "id": "P1", "action": "", "surface": "portal|powershell", "target": "[UPN]",
                "targetCount": 1, "radius": "R1", "mutating": true,
                "undo": "", "verify": "", "checkpoint": null }],
    "powershell": "", "builderRisk": "R1"
  },
  "review": { "status": "pending|passed|failed", "round": 0, "maxRounds": 3, "reports": [] },
  "risk": {
    "assessments": [{ "by": "ROUTER|BUILDER|RISK_FINALIZER", "level": "R1", "reason": "" }],
    "effective": "R1",                 // monotonic MAX of all assessments + deterministic SR-2 trigger scan
    "gates": { "humanRequired": false, "checkpointRequired": false, "independentReviewRequired": false }
  },
  "humanGate": { "decision": "not_required|pending|approved|rejected",
                 "payloadHash": null, "decidedAt": null, "consumed": false, "note": "" },
  "checkpoint": { "required": false, "path": null, "capturedAt": null },
  "execution": { "status": "not_started|done|failed", "stepResults": [] },
  "verification": { "status": "pending|passed|failed",
                    "results": [{ "check": "", "command": "", "output": "", "ok": true }] },
  "outputs": { "jiraNote": "", "workup": "", "blockedReport": null },
  "retryLedger": { "reviewRounds": 0, "nodeRetries": {} },
  "history": [{ "at": "", "node": "", "event": "", "detail": "" }]
}
```

## Engine-enforced invariants (code, not prompt)

Mapped to the repo's standing rules — the graph strengthens them, never relaxes:

1. **Undo on R1+** — any `mutating` step with empty `undo` fails schema validation (CLAUDE.md R1 rule).
2. **Checkpoint before R2** — sim/live refuse EXECUTOR unless `checkpoint.path` exists on disk with mtime before execution (Zero-Trust rule 1).
3. **Monotonic risk** — `risk.effective` = max of every assessment; a later node can raise, never lower. Plus a deterministic SR-2 trigger scan over plan steps (wipe/disable/delete/license-removal verbs, `targetCount > 10`) that force-raises to R3.
4. **Approval is hash-bound, single-use state** — only `graph-cli approve <runId> --hash <h>` can set it, where `h` = SHA-256 over canonical `{runId, mode, plan}` (the WHOLE plan object: packageId, summary, steps, powershell, builderRisk — everything the human was shown). Any plan resubmission invalidates it; replay refused; the executor re-verifies the hash at time of use (threat-model T8). Checkpoint ordering per CLAUDE.md R3: pre-state must exist **before step 1 runs** — the gate may be approved first; execution stays refused until the checkpoint file exists.
5. **Bounded review loop** — 3 FAIL rounds → DEADLOCK, mirroring ILF.
6. **Retry budget** — 1 invalid-artifact retry per node, tracked in `retryLedger`, then BLOCKED (Error Recovery Protocol: one retry, then stop).
7. **Halt on partial failure** — EXECUTOR stops the batch at the first failed step and emits the ❌ BLOCKED report shape with partial-changes fields (Zero-Trust rule 5).
8. **Evidence, not booleans** — `verify.v1` results without a non-empty `output` are rejected (SR-6; "never claim tested when it wasn't").
9. **Every edge is sanitized** — tenant literals BLOCK the submit; PII warns; injection markers get flagged and quoted as data, never followed (SR-3/SR-8).
10. **Provenance is typed** — `operator_typed | agent_derived | external_content`; nothing agent-derived or external can satisfy a gate.

## CLI

```
node scripts/graph/graph-cli.js new     --ticket-file <path> [--source jira] [--mode dry-run|sim|live]
node scripts/graph/graph-cli.js status  <runId>
node scripts/graph/graph-cli.js next    <runId>              # which node runs next + its input envelope
node scripts/graph/graph-cli.js submit  <runId> --node ROUTER --file <artifact.json>
node scripts/graph/graph-cli.js approve <runId> --hash <h>   # operator only; prints the action summary it is approving
node scripts/graph/graph-cli.js reject  <runId> --reason "…"
node scripts/graph/graph-cli.js abort   <runId> --reason "…"
node scripts/graph/graph-cli.js list
```

All commands print JSON to stdout (machine-readable, like ILF) and exit 0/1;
gate refusals use distinct exit codes: 2 = invalid artifact, 3 = sanitizer BLOCK,
4 = gate precondition missing, 5 = approval refused/hash mismatch.

## Known residual risk

The engine cannot prove *who* typed `approve` (single-operator trust model —
same accepted class as `git commit --no-verify`). Controls: the approval echoes
the exact action summary + hash, is logged with timestamp in `history[]`, and
the SR-2 prompt gate still binds the agent side. The internal REVIEWER does not
satisfy the independent-review requirement; destructive plans still get an
independent, out-of-session review (`gates.independentReviewRequired`) — a
maker/checker separation in a fresh context, not the same session grading itself.

## Tests

`node scripts/graph/graph.test.js` — zero-dep, built-in `assert`, PASS/FAIL lines,
exit 0/1, `jira-client.test.js` idiom. Covers the transition table, all gates,
sanitizer blocks, retry/deadlock ceilings, approval replay, and the threat-model
T1–T10 scenarios mapped onto graph runs.
