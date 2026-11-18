# Batch 12 quiz (for the owner, before merging)

Answer all five in your own words, then open the answers.

1. What does the new tool server let Aegis do, and what stops it from reaching a machine inside the office network?
2. The networking lane adds no safety gate. Why is that allowed, and where is the proof?
3. Give one ticket from the scoring run that failed only because of the new 150-word Fix card rule, and say why the old tickets dropped from 9 passes to 3.
4. How would you undo this batch if you merged it and regretted it?
5. Name one thing this batch did not check.

<details>
<summary>Answers</summary>

1. It reads pages from 29 allowed documentation sites and looks up public DNS names, web pages and certificates, read-only (`scripts/mcp/aegis-tools/`, `config/docs-allowlist.json`). Before connecting it resolves the name through public resolvers, refuses any private, local or link-local address, and connects to the checked address only; a redirect is checked again (`guard.js`, `tools.js`; tests in `guard.test.js` and `server.test.js`). It can still reach any public host, which is the open decision in `checks.md` row CR1-1.
2. Every change step in the five networking runbooks is marked PREVIEW ONLY, so nothing there is a step a person runs as written; the scanner fails any change command with no gate, preview or visitor owner. Proof: `docs/aegis/demo/evidence/batch12/lane-gates-and-previews.txt` (16 previews, 0 gates) and the scanner's ownership tests in `scripts/command-safety-gates.test.js`.
3. Any of DEV18, DEV20, DEV23 or DEV24 (`docs/aegis/demo/evidence/batch12/judged-dev-run/summary.md`, the side-by-side table). The charter made a card over 150 words a fail; batch 11 only measured it. With that and some rubric misses, 3 of the 24 old tickets passed instead of 9.
4. Before merging, close the pull request. After merging, revert the merge commit with `git revert -m 1 <merge commit>` on main and push. Outside the repository the batch left only local run folders (`/private/tmp/aegis-b12-*`, `~/aegis-asks/`) and the model spend (33.64 US dollars); nothing in any tenant, cloud or network changed.
5. Any of: answers on tickets nobody wrote for the rules (only outside cases measure that); a real tenant, cloud account or network; the PowerShell tests, which need `pwsh` and run only in CI; whether the vendor facts marked UNCONFIRMED are right; whether the replies read well to a real person.

</details>
