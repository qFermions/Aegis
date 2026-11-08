# Batch 10 in plain words: one step at a time, and a double-check for every step

Aegis is the IT assistant in this repository. It tells a technician what to do; a person makes every change, and Aegis checks afterwards that the change really happened. The practice desk runs it on made-up tickets against pretend company systems.

## What was wrong

- **Two steps approved at once.** For your Okta Verify loop (MF-1), batch 9b's answer said the authenticator reset was the last resort, but its approval block listed it next to the session clear. A technician who approved the block as written would run a reset that cannot be undone, before knowing whether the lighter step had already fixed it. The stolen-laptop answers did the same with Lock and Wipe.
- **A noun read as a change.** The desk decides "Aegis only advised looking" by spotting change words. It counted "update" in "look for a macOS update", so the slow-internet tickets (T7, T7m) stayed open instead of closing as "look first".
- **Changes with no double-check.** The laptop lock, the Google "sign out everywhere" (cookie reset), and three Google offboarding steps (Okta deactivate, the Drive and Calendar handovers) had no read that proves them, so those tickets could only end "not proved".
- Smaller: two scripts that start Claude were not in the strictest review tier, and the privacy rule let "password isHunter22!" through.

## What changed

- **One rung per approval block** (`CLAUDE.md`, `docs/aegis/answer-format.md`). The block lists only what to do now. A step for "if that did not work" is written in Details with its name and its condition, and waits. The desk's "lightest step first" row now fails a block that holds two rungs: a heavier step and the lighter one the runbook says to try first, or a step the answer itself calls a last resort. It reads the rungs from the runbooks' own "Try first" and "Last resort" lines, so an offboarding checklist, where every step runs now, is not flagged.
- **Change words count only as the step's verb**: "Restart the Mac" still counts; "look for a macOS update" does not; nor does what the user is asked to try ("ask the user to quit the app; if it still fails, restart").
- **New double-checks**: the lock reads Jamf's command history; the cookie reset reads Google's audit event `RESET_SIGNIN_COOKIES` (Google's own page names it); the Okta deactivate reads the account status; the Drive and Calendar handovers read Google's transfer record, through a new read-only connection that can only look at one transfer and never start one.
- **Fixed on the way**: the Jamf check read the wrong field names, so on a real server every lock or wipe check would have said "not done"; a profile check on a record without a profile name now says "cannot tell" instead of "not done".
- The two scripts are now tier C; the privacy rule stops "password isHunter22!", "pw: x", "passwd=x" and "pass is x1", and still lets "I forgot my password" through.

## What is not proved

- Google does not list the words its transfer status uses, so only "completed" counts and anything else reads "cannot tell". Drive's application number came from a search snippet, not the page itself. Whether a handover started in the Admin console shows up in that record is not confirmed.
- Whether Jamf records a Lock Computer click under the name `DEVICE_LOCK` is not confirmed; if the check finds nothing, read the Mac's history in Jamf first.
- The desk still runs every step in a block; it trusts the block to hold one rung.

## The practice runs

Both sets ran once, one ticket at a time, for 6.36 US dollars and 16 sessions (limit: 10 dollars, 17 sessions).
- **Messy set** (T1m to T9m): 8 fixed in the practice copy and checked, 1 "look first" (T7m). Before (batch 9): 5 fixed, 2 not proved, 2 open. Your ticket, T9m, now lists only Clear User Sessions to approve; the reset waits in Details for "only if step 4 didn't stop the loop".
- **Tidy set** (T1 to T8): 7 fixed and checked, 1 question back to the user (T7). Before: 6 fixed, 1 not proved, 1 open.
- The stolen-laptop tickets now approve Lock only, with Wipe as a later step, and close checked instead of "not proved".
- Every card is still over the 150-word limit (151 to 260 words); that row does not stop a ticket.
- T1's "lightest step first" row fails: it deletes the old phone's sign-in method without revoking sessions first, and says why (the phone was wiped). The row reads the runbook's order, not the reason.

Quiz: `docs/explainers/batch10-ladder-and-readbacks-quiz.md`. Details for the next engineer: `PROJECT_STATE.md`, "Changed by batch 10".
