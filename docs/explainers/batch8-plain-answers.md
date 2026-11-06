# Batch 8: short answers a tech can use, a desk a non-coder can read

## The problem
Aegis is meant for IT techs, not programmers. In the last full run, its answer to a locked-out user was 1,130 words. The real fix was three clicks and a phone call, the reply to the user sat near the bottom, and about 20 lines were Aegis's own bookkeeping. The page that shows a ticket's journey spoke like an engineer.

## What changed for the tech
- Every answer now opens with a short **Fix card**, at most 150 words, in five parts:
  - **What's wrong:** one sentence.
  - **Do this:** 3 to 5 steps, each one click path or phone call.
  - **Done when:** what the tech will see when it worked.
  - **Stop if:** the sign that this is a different problem.
  - **Tell the user:** up to three plain sentences to send the person.
- The longer plan, the risks and the ticket note follow under "Details".
- Aegis's own bookkeeping (which safety rule applies, the exact sign-off phrase, the double-check command) moves into a closing block that the desk reads and keeps out of the tech's way.
- Aegis now gets a short profile of each customer (their systems, how they confirm who someone is, who approves changes, their hours) instead of assuming every customer looks like one default company.
- `/mfa-issue` now starts by confirming the person asking is who they say.

## What changed on the desk page
The nine steps have plain names: Customer, Ticket received, Sorted, Aegis's answer, Safety checks, Sign-off, Changes made (simulated), Double-check, Result. Each step starts with one plain sentence. The technical text is still there, folded under "Technical details". The answer step shows the Fix card first. The sign-off step shows the phrase a real tech would type. The double-check step lists each check as a sentence with a yes or a no.

## Gaps from the last run that are closed
- Four account changes (suspending and resetting in Google and Okta) now come with a double-check.
- The desk double-checks each change right after making it, and stops at the first one that fails or proves nothing.
- A "look first" answer now ends as **INVESTIGATE**, not as unfinished.
- A question in the middle of a line now counts as Aegis asking.

## The two runs
Both runs used real Aegis sessions on pretend customers: 16 sessions, 6.54 US dollars of the 30 allowed.
- **Run A, the same 8 tickets as last time:** 2 fixed and double-checked (last time 1), 1 not proved, 3 not finished, 1 question first, 1 stopped. Every answer got shorter, by 15 to 50 percent (the locked-out answer from 1,094 words to 552), and the first step now sits on line 4 or 5 instead of as far down as line 32.
- **Run B, the same tickets as real users write them:** 2 fixed and double-checked, 2 not proved, 4 not finished. The planted "turn off MFA for everyone" line was refused.
- **What still goes wrong:** 13 of 16 Fix cards ran over 150 words. One ticket was stopped because the check read the card's draft message to the user ("We've locked your account") as Aegis claiming it did it. Two "look first" answers missed INVESTIGATE because the check reads "Don't release" and "We'll update you" as changes. The shared-mailbox tickets still have no approved way to make the change. Each cause and its fix is in `docs/aegis/demo/evidence/full-run-2/causes.md`.

## What this is not
It is a practice run: the customers, their systems and the person who signs off are pretend, and the builder wrote the tickets. It shows the process and the answer's shape, not whether the advice is right for a real company.

## Where to look
- The format rule: `docs/aegis/answer-format.md`.
- The desk: `scripts/demo/README.md`.
- The checks and the evidence: `checks.md`, `docs/aegis/demo/evidence/full-run-2/` and `full-run-3/`.
