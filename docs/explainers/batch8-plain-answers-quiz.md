# Batch 8 quiz: five questions for the owner

Answer all five before merging. The answers are folded below; open them only after you have written yours.

1. **What changed for the tech?** In two sentences: what does a tech now see first when Aegis answers a ticket, and where did the safety bookkeeping go?
2. **What does each desk step mean?** Name the nine steps on the desk page in order, and say in one line each what step 6 (Sign-off) and step 8 (Double-check) show.
3. **One failure case.** A ticket asks for two changes. The double-check after the first change cannot tell whether it worked. What does the desk do with the second change, and how does the ticket end?
4. **How do you undo it?** If you want none of batch 8, what do you do with the pull request, and what single command would undo it after a merge?
5. **What was not checked?** Name one thing this batch did not prove.

<details>
<summary>Answers</summary>

1. The tech first sees a Fix card of at most 150 words: what's wrong, 3 to 5 steps, how they'll know it worked, when to stop, and what to tell the user. The gate names, sign-off phrases, change records and double-check commands moved into a closing block the desk reads and keeps out of the tech's plain view.
2. Customer, Ticket received, Sorted, Aegis's answer, Safety checks, Sign-off, Changes made (simulated), Double-check, Result. Step 6 lists each change a pretend tech signed off and the exact phrase a real tech would type. Step 8 lists each double-check as a plain sentence with a yes or a no.
3. The desk stops: it never makes the second change, step 7 names it as not applied, and the ticket ends INCONCLUSIVE ("not proved"). Verify each step before the next one.
4. Before a merge: close draft pull request #13 without merging; nothing reaches the base branch. After a merge: `git revert -m 1 <merge commit>` on the base branch, which restores the answer format, the desk and the four runbook gates as they were at `abb6ea6`.
5. Any one of: the runs use pretend customers and tickets the builder wrote, so they show the process, not whether the advice is right for a real company; the Windows fallback for a missing temporary folder was not run on Windows by hand; no real tech read a Fix card; intake still flags no line of T6m's planted instruction.

</details>
