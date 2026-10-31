# Evidence tools (batch G3 close-out 3)

The one script this batch added for its captures, so each capture names a command a reviewer can
run again. The batch's other captures use the tools of the earlier batches:
`docs/aegis/g3/evidence/tools/` (inventory diff, leak grep, fixtures and mocks, test counts, head
checks, suite counts), `docs/aegis/g3-closeout/evidence/tools/` (the charter grep, dependencies,
gates, state files) and `docs/aegis/g3-closeout-2/evidence/tools/` (runbook gate markers). Run from
the repository root with Node 24 on the PATH. It only reads, with `git show` of the commits named.

| Tool | Capture | What it prints |
|---|---|---|
| `gate-field-lines.js <before> <after>` | `head/gate-field-lines.txt` (`0a5feb7` to the head), `head/gate-field-lines-h4.txt` (`371a1b0` to `251b1c7`, H4 alone) | the SAFETY GATE count at both commits, the gates removed or added, how many gates changed only by an R class put first on their Reversibility line, and every other change to a gate field (Target, Effect, Scope, Reversibility, Required confirmation, Failure behavior) or to its PORTAL ACTION line, with the text before and after |
