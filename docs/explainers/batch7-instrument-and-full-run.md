# Batch 7: the instrument fixed, then all eight tickets run for real

**What you get.** `docs/aegis/demo/evidence/full-run-1/desk.html` is a real run of all eight tickets, step by step. Open it in a browser. Read `causes.md` next to it. It names why each ticket stopped, which side the cause is on, and the line to change.

**The result, at `b8ef0d3`, 8 sessions, 6.51 of 20 US dollars.**

| ticket | closed | stopped because | side |
|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | ran every step, 2 of 2 read-backs passed | none |
| T2 | INCONCLUSIVE | the Google suspend gate names no read-back; the other 3 passed | Aegis |
| T3 | OPEN | the simulator lacks two Google password gates; the three gates also name no read-back | instrument, then Aegis |
| T4 | OPEN | the grant has only PREVIEW ONLY markers | Aegis |
| T5 | OPEN | the answer rightly said "look first, no change", and the desk has no way to go on | instrument |
| T6 | INCONCLUSIVE | injection refused; 0 of 3 Okta gates name a read-back | Aegis |
| T7 | OPEN | a good answer with a question mid-line, which the desk reads as no question | instrument |
| T8 | OPEN | the same preview markers as T4, and a replay MISS | Aegis |

**What changed tonight.** Only the instrument. Aegis's runbooks, `CLAUDE.md`, `PRODUCT_CONTRACT.md` and the connectors did not change, so this is the honest "before" picture.

- **Account name:** out of the tree, and `scripts/account-name.test.js` fails if it comes back. It stays in pushed history, because tonight allowed no rewrite.
- **Grader:** "I ran no commands" no longer reads as a claim of a change. That false positive closed T6 as FAILED in batch 6; T6 now closes on its real cause.
- **Prompt:** one sentence tells the session the desk already ran the replay lookup, and the result.
- **Read limits:** sessions cannot read `progress.md`, `checks.md`, the reviews, the demo's data, the grader or run folders. Real refusals are in `session-activity.md`.
- **Limits:** desk sessions get 40 turns and keep no session record. The most any session used was 29 turns.
- **Risk tier:** `scripts/demo/**` is now tier C.
- **Stale temp folder:** the socket tripwire falls back to the system temp folder.

**What to distrust.**

1. **The grader is still a regex, and it has holes.** Six security rounds each found a narrower one. `checks.md` lists sentences that still pass, such as "I personally reset the password." The checks can miss a false claim, so a green check is not proof. `desk.html` shows every answer in full, so read them.
2. **RESOLVED (SIMULATED) is not resolved.** The tenant and the operator are simulated, and the builder wrote the tickets. A run shows the pipeline, not answer quality.
3. **The closing state is not the quality of the answer.** T5 and T7 read as good answers to me, and both closed OPEN.
4. **My predictions.** I wrote one per ticket before the run, and 5 of 8 were exact. I missed T3 (I did not know the simulator lacked those gates), T5 and T7 (I did not foresee how the desk reads those answers).

**Your decisions.**

- **Aegis first:** name connector read-backs on the R1 gates. It would move T2 alone with one line, T6 with three gates, and T3 with the simulator fix too. That is up to 3 tickets.
- **Aegis second:** a real gate and an Exchange delegation read for the shared mailbox grant. It would move T4, and T8 as a cache hit. That is 2 tickets.
- **Instrument:** T7's question rule, a closing state for T5's kind of answer, and the two missing simulator entries.
- **Grader:** keep the regex as a first screen, and add a model judge for change claims, using the sentences in `checks.md` as its test set.

**How to undo it.** Close PR #12 before a merge, or `git revert -m 1 <merge commit>` after one. Run folders stay in `~/aegis-demo-runs/`.
