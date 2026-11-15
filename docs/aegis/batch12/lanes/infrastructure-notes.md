# Lane note: infrastructure and cloud (batch 12)

## Hypothesis and verified means (written 2026-11-14, before the first lane file)

- **Hypothesis:** capability-map rows 18 and 19 are missing because Aegis has no method for infrastructure work, not because it lacks commands. A knowledge module that teaches the senior engineer's order (read the evidence, rank causes, split them with the smallest read, change through code a person applies, prove it) plus seven runbooks whose every change sits behind the existing gate grammar will let Aegis give Engineer answers on AWS, Azure, Google Cloud, Kubernetes, Terraform and Linux without tuning to any ticket.
- **Verified means:** `node --test scripts/command-safety-gates.test.js scripts/markdown-links.test.js scripts/repository-structure.test.js scripts/eval/judged/cases.test.js` passes with no new failing test name against the 41 pwsh-only names in `docs/aegis/demo/evidence/batch12/baseline/failing-names.txt`; `node scripts/lint/command-structure.js` exits 0; `node scripts/lint/ladder-audit.js --check` exits 0; every new gate id has its own per-gate test in the safety-gates run; the dev cases parse with `readCaseFile`. None of this proves answer quality: only the batch lead's judged run can.

(The rest of this note is written at the end of the lane.)
