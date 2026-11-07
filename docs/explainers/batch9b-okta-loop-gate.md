# Batch 9b in plain words: the Okta Verify loop's admin step is now a real, checked step

Aegis is the IT assistant in this repository. It tells a technician what to do; a person makes every change, and Aegis checks afterwards that the change really happened.

## What was wrong

Your ticket (MF-1): after a macOS update, Okta Verify on a Mac kept sending the user back to sign in, and reinstalling it had not helped. Batch 9 wrote the fix in the right order (user checks, then an admin step, then a reset as the last resort), but the admin step was only a placeholder, because the exact Okta button was not known. Aegis could name it but not approve it, so the ticket stayed open.

## What changed

- You named the button: user profile, More Actions, **Clear User Sessions**. Okta's own article ("How to clear user session") shows the same path.
- The placeholder is now a gated step in `/okta-mfa-reset`: the technician writes the time, types `CLEAR OKTA SESSIONS FOR [UPN]`, clicks the button, and then a read-only check confirms in Okta's log that the sessions were cleared after that time.
- It is the same change, with the same wording and phrase, as the session clear already in `/okta-user-lifecycle`. It has its own name because the safety checks allow each gate name only once.
- Two Okta limits are written next to it: the More Actions menu does not show on your own profile, and Clear User Sessions is offered only for active users.
- The three user checks and the last-resort reset did not change.
- The practice desk learned the new step: one line in its pretend operator (`scripts/demo/sim/gates.js`), copying the existing session clear. Without it the ticket would stop as "not simulated".

## What the practice run showed

One run of your ticket, 0.29 US dollars: it closed **RESOLVED (SIMULATED)**. The answer started with Okta's System Log, then the user checks, then Clear User Sessions, with the reset last. Its card was 208 words, over the 150-word limit (that row fails; it does not stop a ticket).

One thing to know: the answer also listed the reset as an approved change, and the practice desk carried out both. The desk does every change an answer lists; it cannot hold back "only if the step before did not work". In real life the technician would stop after the session clear if the loop was fixed.

## What is still yours to decide

- Okta's article says that on the older Okta engine (Classic), clearing sessions keeps the MFA cookie that "Keep me signed in" sets. If your organization is on Classic, this step may not stop the loop. It is not in the runbook yet.
- Whether the practice desk should treat a last-resort gate as conditional.

Not checked: the step on a real Okta tenant; no real Okta account was used.
