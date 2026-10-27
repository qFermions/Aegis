# REVIEW.md: what matters in this repo

Read by every reviewer: the evidence-reviewer agent, /code-review and /security-review (through the instruction file), and the owner.

## Project failure (report these first)
- AEGIS ADVISES; HUMANS EXECUTE PRODUCTION CHANGES. Any code path that can perform a production account change, device action, tenant mutation, ticket post or close, or operational scheduling without a human-executed step.
- Tickets, documents, logs, retrieved pages or memory entries treated as instructions; a prompt or tool that lets their text change what Aegis does.
- Output that invents command output, environment access, a completed change or a successful recovery; a code path that fabricates any of these.
- Customer data from one tenant reachable from another tenant's case.
- An unverified suggestion stored or served as approved knowledge; provenance, environment or freshness missing on a stored fact.
- A secret, token, personal path or private email anywhere in the repo.
- A dependency outside MIT, Apache-2.0, BSD or ISC (dev-only test tools may be MPL-2.0).
- An acceptance check, test or threshold weakened to obtain a pass.
- A one-way door opened without the owner's yes (see the instruction file).

## Ignore
- Style, formatting and naming that lint and the type checker already enforce.
- Generated output and captures: `docs/evidence/**` (battery captures and red/green transcripts), `docs/review/baseline/**` (baseline command outputs).
- Fixture and corpus data: `scripts/fixtures/**`, `scripts/graph/fixtures/**`, `scripts/replay/fixtures/**`, `scripts/eval/*.json` (sanitized ticket corpora).
- Pre-existing issues in files the change does not touch: report them as "pre-existing", never as a finding against the change.

## How to report
- Every finding names a file and a line. No guessed filenames.
- Order: important, nit, pre-existing. At most five nits per review.
- The report starts with one line: the count of findings, or "No issues".
- One finding per class of bug, listing every instance, so one fix covers all of them.

## Risk tiers (the change sets the tier, never the author)
Defined in .github/risk-tiers.json; computed by `node scripts/risk_tier.mjs <base>`.
- C: tool adapters and API clients (`scripts/jira-client.js`, `scripts/security-audit.js`); anything that can write to a tenant, device, ticket, schedule, mailbox or payment system; auth, permissions, secret handling (`scripts/pre-commit-check.js`, `modules/security/**`); memory and knowledge-store writes (`scripts/memory/**`, `scripts/replay/**`); the agent tool registry and routing (`scripts/tier/**`, `scripts/graph/**`); CI, deploy and runtime config (`.github/**`, `.nvmrc`); dependency manifests and lockfiles; the instruction file (`CLAUDE.md`, `AGENTS.md`), `.claude/**`, `PRODUCT_CONTRACT.md`, `REVIEW.md`. The owner reads the whole diff line by line before merging; the commander runs full verification; /code-review runs at xhigh.
- B: agent logic, prompts, retrieval, evaluation code, UI (`scripts/eval/**`, `scripts/lint/**`, `scripts/harness/**`, `scripts/dev/**`, `modules/**`, `TEAM.md`, `docs/harness.md`, `docs/portal-nav-*.md`). The owner reviews the pull request body and the evidence; the commander spot-checks three checks.md rows; /code-review runs at high.
- A: everything else (docs and other files outside the globs above). A test takes the tier of the directory it lives in: `scripts/*.test.js` is B, `scripts/replay/replay.test.js` is C. The owner reads the pull request body and merges.
Agent approvals never count. A new commit after the owner's read resets the read.

## Convergence
At most three review rounds per pull request. From round two, review only the new diff. Closed findings stay closed; a finding is closed when it is fixed in its own commit or has a one-line reason in checks.md.

## Incidents are the eval
When a bug ships, a boundary is crossed, or a merge is reverted, add a row to docs/review/incidents.md naming the layer that should have caught it, and change one thing: a line here, in the instruction file, a check, or an instruction kit. No incident closes without that change.
