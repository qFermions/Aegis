# Task 2: G2 close-out, item by item

Each item: the commit that turned its test red (test first where behaviour changed), the commit that fixed it, and the run that proves it (captures in this folder). Base `f185071`; the G2 leftovers come from `docs/aegis/g2/evidence/code-review-rounds.md` ("Batch 1 findings from the misdirected first run"), `docs/aegis/g2/evidence/security-review-2.md` and the G2 `progress.md` open issues (PR #5's body has no report sections 8 to 10; the report lived in the session reply).

| item | red | fix | proof |
|---|---|---|---|
| `/gws-audit-log` sends Google containment to `/gws-account-containment` (and a genuine role grant to `/gws-admin-roles`) | `c1487e9` | `babc6d0` | `t2-gws-audit-log-red.txt` (14/15), `t2-gws-audit-log-green.txt` (15/15) |
| the dead clause at `scripts/command-safety-gates.test.js:630` (a doubled-backslash literal that never fired) uses the list-item rule; its 9 hidden candidates are preview-marked | `be13fe3`, `46b1bbb` (two fixture maps gain the candidates the live clause finds: stricter, nothing removed) | `236efa3` | `t2-dead-clause-red.txt` (429/433), `t2-dead-clause-green.txt` (433/433); `t2-inventory-diff.txt` (676 -> 683 examples, gated 329 -> 329, preview 347 -> 354, none removed, none changed mode) |
| "SLA breached" no longer floors through the compromise rule; corpus pair L12 (routine) and L13 (a breached account floors) | `ffcf311` (corpus first), `92cfb84` | `c70b496` | `t2-sla-pair-g2-eval-red.txt` (64/65, 12/13), `t2-sla-pair-g2-eval-green.txt` (65/65, 13/13); `t2-sla-tier-red.txt` (54/55), `t2-sla-tier-green.txt` (55/55) |
| `scripts/jira-client.js` on the shared read-only contract; every existing Jira test unchanged and passing | `6e30562` | `eb6d785` | `t2-jira-contract-red.txt` (0/8), `t2-jira-contract-green.txt` (8/8), `t2-jira-existing-tests.txt` (64/64) |
| batch 1 finding 7: a verify-* dry run gets its own exit code (4, NOT VERIFIED) | `5d449e9` (the one existing Jira assertion changed, code 0 -> 4, as the charter asks) | `aef668a` | `t2-jira-finding7-red.txt` (63/64), `t2-jira-finding7-green.txt` (64/64) |
| batch 1 finding 1: an injection marker split across a line break | `6d10927` | `8e3005f` | `t2-b1-finding-1-red.txt`, `-green.txt` |
| batch 1 finding 2: replay lookup and render check `verifiedAt` and dependency paths before printing | `730df92` | `c8987e1` | `t2-b1-finding-2-*.txt` |
| batch 1 finding 3: one personal-data rule in `scripts/tier/tier-guard.js` for the graph edge, the memory store and the replay cache | `0a82c97` | `20d77e5` | `t2-b1-finding-3-*.txt`. Behaviour change: the edge loses its exemptions for `vendor-example.`, `example-corp.`, `github.com` and `YOUR_DOMAIN` and gains the replay cache's wider phone forms (warnings at the edge) |
| batch 1 finding 4: a stale-lock takeover never removes a lock another writer just took | `8d014ae` | `726a354` | `t2-b1-finding-4-*.txt` |
| batch 1 finding 6: memory `stats` and `audit` print no text of a record changed on disk | `87b6fb6` | `2f50495` | `t2-b1-finding-6-*.txt` |
| batch 1 finding 8: a lookup that marks a case stale never binds an unbound replay store | `f3bbdab` | `f19a2e8` | `t2-b1-finding-8-*.txt`. `alias` and `invalidate` still bind: they are operator writes, and the store doc says the first write binds |
| batch 1 finding 10: a Jira note in the rich-text editor | `e773759` | `be2d22b` | `t2-jira-finding10-red.txt` (64/65), `-green.txt` (65/65). Normalised: line ends, trailing and non-breaking spaces, on both sides of the digest; the procedure says to post through the plain-text editor. Left for the owner: whether Jira stores a pasted note as typed needs a real Jira site; converted markup fails closed |
| batch 1 finding 11: integrity failures share exit 3 with the sanitizer | closed | none | The batch 1 untrusted-data suite pins exit 3 as its written MUST for a record changed on disk (`scripts/untrusted/poisoned-memory.test.js:50`, `:350`, `:362`); a new code rewrites that acceptance check, and the refusal text already names the integrity failure. Owner decision |
| batch 1 finding 12: the incidents row for batch 1's boundary crossing | none (docs) | `4c0669d`, corrected `e73a051` | `docs/review/incidents.md:7` |
| batch 1 finding 14: `list` re-checks every record | closed | none | A cached "checked hash" would be unkeyed like the seal, so a forger who writes it skips the persist gates that catch an edited record today (the B10 and B13 pattern), and it goes stale when findings 1 and 3 widen the gates; the measured cost is about 0.1 ms per record (subagent measurement: read 0.008 ms, seal 0.017 ms, gates 0.097 ms) |

## Fixed beyond the list (bugs in files this task edits)

| bug | red | fix | proof |
|---|---|---|---|
| replay `lookup` returned CACHE_HIT for any status but candidate or stale, while `render` refuses all but a verified case with evidence | `77c3e17` | `4a1774b` | `t2-replay-a12-a13-red.txt`, `-green.txt` (21/21) |
| replay `record` stored `--deps` paths without a scan | `77c3e17`, fixture corrected `9135a39` (a hyphen-joined marker is not one the shared rule reads) | `8712c71` | `t2-replay-a13-red-fixed-fixture.txt`, `t2-replay-a12-a13-green.txt` |
| memory `stats` printed ledger event names from disk and crashed (stack trace) on a line that is not JSON | `69f882e` | `193e44e` | `t2-memory-b21-red.txt`, `-green.txt` (29/29) |
| the Linear note guard trusted the whole temporary folder, so a repo checked out inside it lost the "repo file outside tasks/ is refused" rule (found by the Phase 0 baseline) | `c65a723` | `744a84f` | `t2-linear-repo-in-tmp-red.txt`, `-green.txt` (34/34); `t2-linear-under-tmp-clone.txt` (the clone under the temporary folder: 19/19, was 18/19) |

## Same class, not changed (decision for the owner)

- The five G2 adapters' `verify-*` dry runs also exit 0 (finding 7's class). Their existing tests pin exit 0 (for example `scripts/adapters/fleet-client.test.js:285`), so changing it rewrites those checks; proposal: exit 4 in every adapter with those assertions updated in one reviewed commit.
