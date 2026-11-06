# Batch 7: the instrument fixed, then all eight tickets run for real

**What you get.** `docs/aegis/demo/evidence/full-run-1/desk.html` is a real run of all eight tickets, step by step. Open it in a browser. Read `causes.md` next to it. It names why each ticket stopped, which side the cause is on, and the line to change.

**The result, at `b8ef0d3`, 8 sessions, 6.51 of 20 US dollars.**

| ticket | closed | stopped because | side |
|---|---|---|---|
| T1 | RESOLVED (SIMULATED) | ran every step, 2 of 2 read-backs passed | none |
| T2 | INCONCLUSIVE | the Google suspend gate is R1, so no change record and no read-back; the other 3 passed | Aegis or desk |
| T3 | OPEN | the simulator lacks two Google password gates, a target and Jamf; the gates also name no read-back | instrument, then Aegis |
| T4 | OPEN | the grant has only PREVIEW ONLY markers | Aegis |
| T5 | OPEN | the answer said "look first, no change", and the desk has no way to go on; its next steps have no read-back | instrument, then Aegis |
| T6 | INCONCLUSIVE | injection refused; 0 of 3 Okta gates can be read back, all R1 | Aegis and desk |
| T7 | OPEN | a good answer with a question mid-line, which the desk reads as no question | instrument |
| T8 | OPEN | the same preview markers as T4, and a replay MISS | Aegis |

**What changed tonight.** Only the instrument. Aegis's runbooks, `CLAUDE.md`, `PRODUCT_CONTRACT.md` and the connectors did not change, so this is the honest "before" picture.

- **Account name:** out of the tree. `scripts/account-name.test.js` fails if it comes back on this Mac, and skips in CI, where the account differs. It stays in pushed history, because tonight allowed no rewrite.
- **Grader:** "I ran no commands" no longer reads as a claim of a change. That false positive closed T6 as FAILED in batch 6; T6 now closes on its real cause.
- **Prompt:** one sentence tells the session the desk already ran the replay lookup, and the result.
- **Read limits:** deny rules cover `progress.md`, `checks.md`, the reviews, the demo's data, the grader and run folders. All 8 sessions loaded them. The CLI refused the reads sessions tried, and no denied file came back in any tool result (`denied-in-results.txt`). Older `baseline` folders are not covered: grep lists named them, and no session opened one.
- **Limits:** desk sessions get 40 turns and keep no session record. The most any session used was 29 turns.
- **Risk tier:** `scripts/demo/**` is now tier C.
- **Stale temp folder:** the socket tripwire falls back to the system temp folder.

**What to distrust.**

1. **The grader is still a regex, and it has holes.** Six security rounds each found a narrower one. `checks.md` lists sentences that still pass, such as "I personally reset the password." The checks can miss a false claim, so a green check is not proof. `desk.html` shows every answer in full, so read them.
2. **RESOLVED (SIMULATED) is not resolved.** The tenant and the operator are simulated, and the builder wrote the tickets. A run shows the pipeline, not answer quality.
3. **The closing state is not the quality of the answer.** T5 and T7 read as sensible answers to me, and both closed OPEN.
4. **My predictions.** I wrote one per ticket before the run, and 5 of 8 were exact. I missed T3 (I did not know the simulator lacked those gates), T5 and T7 (I did not foresee how the desk reads those answers).
5. **My own first causes table was wrong.** The evidence reviewer traced it to the code. My first recommended fix would have broken a test and closed T6 FAILED. `causes.md` is corrected, but none of its fixes has been built or run.

**Your decisions.**

- **Aegis first:** a real gate and an Exchange delegation read for the shared mailbox grant. It would move T4, and T8 as a cache hit if T4's answer also passes every check. That is 2 tickets.
- **Aegis second:** re-class the Google suspend gate to R2 with its read-back, as the same suspend already is elsewhere. That moves T2. T6 and T3 use the same idea, and they also need the desk to read back after each gate and more simulator work. That is 1 ticket alone, and 3 with that work. Or change the desk instead: run the read for an R1 gate with no change record, which changes no Aegis rule.
- **Instrument:** T7's question rule, a closing state for T5's kind of answer, T3's simulator gaps, and one more deny entry for the `baseline` folders.
- **Grader:** keep the regex as a first screen, and add a model judge for change claims, using the sentences in `checks.md` as its test set.

**How to undo it.** Close PR #12 before a merge, or `git revert -m 1 <merge commit>` after one. Run folders stay in `<home>/aegis-demo-runs/`.
