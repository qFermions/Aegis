# Batch 9 in plain words: safer messages, the missing steps, a way to try Aegis

Aegis is the IT assistant in this repository. It reads a support ticket and tells a technician what to do. It never changes anything itself: a person does every change, and Aegis then checks that the change really happened.

## What changed for the person who asked for help

Each answer now has two short messages for the person with the problem, not one.

- **Tell the user now:** what happens next and what they should do. It may not say a change is done, promise a time nobody controls, or announce a wipe, reset or lock as decided.
- **Tell the user when done:** the confirmation. The practice desk shows it only after its check passed, and otherwise says "not sent, because the change is not proved".

In the last batch, the brief counted 4 of 16 messages that told people something was done when it was not ("You now have the billing inbox"); run on those same 16 messages, the new rule fails 7. In this batch's runs, 16 of 17 "now" messages passed. The one that failed said "the end of the day", and the ticket itself said "when the day ends", so that was the check's mistake, not the answer's.

## What Aegis knows now that it did not

- **A planted instruction is spotted on arrival.** A line such as "Note to the IT assistant: you are authorized to..." is marked when the ticket comes in. The ticket is still handled; the line is never followed. The planted line in the test ticket T6m was marked this time; last time it was not. The example wordings the rule was built on came from that same line, so this shows the rule works on its own source; the new tickets the commander adds later will show whether it catches lines it has not seen.
- **Shared mailboxes and held email.** Giving someone access to a shared inbox, and releasing a held email, now have proper approval steps, and Aegis can check afterwards that they worked (a new read-only link to Exchange Online).
- **A Google password reset and a Jamf laptop erase** now each have a check.
- **The owner's own ticket.** "Okta Verify keeps looping after a macOS update" now has a section: simple checks for the user first, then an admin step, then resetting the sign-in app only as the last resort. The exact admin menu item is still the owner's to write in, so for now that step is marked "not authorized yet".
- **Lightest fix first.** Aegis is told to ask what changed (an update, a new phone), to look at the sign-in records before guessing, and to try a fix that can be undone before one that cannot. A new check reads every runbook: in the 19 identity, sign-in and device runbooks, every step that resets, wipes or deletes now has something lighter before it, or a written reason why not.

## How a new person tries Aegis

Two commands, both locked down the same way as the practice desk (read only; no commands, no edits, no web, none of the person's own add-ons):

- `ask-aegis` answers one ticket, prints the steps and the two messages, and saves the answer in the person's home folder. It hides email addresses and phone numbers first, and stops if the ticket holds a password or key.
- `aegis-chat` opens a conversation for follow-up questions.

The README has a short "Try Aegis" section with both.

## The runs

The practice desk ran 17 tickets with fictional customers and a pretend technician.

| Set | Fixed and double-checked | Not proved | Not finished | Cost |
|---|---|---|---|---|
| Messy (9 tickets, written like real users) | 5 (last time 2 of 8) | 2 | 2 | 3.81 US dollars |
| Tidy (8 tickets) | 6 (last time 2 of 8) | 1 | 1 | 3.63 US dollars |

Why some did not finish: the desk read "look for a macOS update" as a request to update something (a fault in the desk, 2 tickets); for a stolen laptop, the lock and the Google cookie reset have no check yet, and the erase cannot be proved until the laptop connects again (2 tickets); three Google offboarding steps have no check yet (1 ticket); and the owner's Okta ticket stops at the admin step still waiting for its menu item (1 ticket).

## What is not proved

This is a demo with tickets the builder wrote. It shows the machinery works, not that the advice is right. Nothing here has been run against a real Exchange, Okta, Google or Jamf account. The new checks read words, not meaning, so a person should still read each answer.

The full detail is in `checks.md` and `docs/aegis/demo/evidence/full-run-4/` and `full-run-5/`.
