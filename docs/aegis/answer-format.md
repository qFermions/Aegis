# Answer format: the Fix card first

CLAUDE.md's "Answer format" rule points here. It applies to every answer Aegis gives a tech about an IT ticket. Where it differs from the order in `docs/aegis/workflow.md` (Response Format), this file wins. It changes no gate: every confirmation, read-back and approval the runbooks require is still required; only where the answer puts them changes.

## 1. The Fix card

The answer starts with a section headed exactly `## Fix`, before anything else, with these six parts in this order:

| Part | What it holds |
|---|---|
| **What's wrong:** | One sentence. |
| **Do this:** | 3 to 5 numbered steps in plain words. Each step is one action a tech takes in an admin portal or on the phone, with the portal path where there is one (Admin center → Users → ...). Section 2 sets which step comes first and which comes last. |
| **Done when:** | One line a tech can see with their own eyes. When Aegis will check the change, say what it will check, in plain words ("Aegis then checks the old sign-in method is gone"). |
| **Stop if:** | One line: the signal that turns this into a different problem. |
| **Tell the user now:** | At most 3 short sentences the tech sends the person who asked, right away: what happens next and what they should do. |
| **Tell the user when done:** | At most 3 short sentences for after the change is made and Aegis's double-check passed: the confirmation. |

The two messages to the user:

- No portal paths and no technical terms in either.
- "Tell the user now" is in the present or future tense. It never says a change is done ("you now have", "we've locked", "we have reset", "is fixed", "has been released", "you're back in"). It never promises a time the tech does not control ("within the hour", "before 9", "today"), unless the ticket itself set that time. It never states a cause nobody has confirmed. It never announces an action that needs sign-off (a wipe, a reset, a lock) as decided: say what IT is checking, not what IT will do to the account.
- "Tell the user when done" may say the change is done: the desk sends it only after the double-check passed, and shows "not sent: the change is not proved" otherwise.
- The desk checks the now line ("user message now makes no done claim"). It looks for the done phrases, the clock promises and the decided sign-off actions above; it cannot tell a confirmed cause from a guess, so that part is for the tech to read.

Length and Details:

- The card is at most 150 words. The one line that points to Details is not counted.
- When a ticket needs more (an offboarding across several systems, a security incident), the card says so in that one line after "Tell the user when done", such as "This needs a longer plan across four systems: see Details.", and the full plan follows under `## Details`.
- No gate id, R class, change record, confirmation phrase or `Gate:` line in the card.

## 2. How the steps are chosen: three thinking rules

A senior tech does three things before advising a change. The card's steps follow them on every ticket, on every platform.

**What changed.** When the ticket names a recent change (an OS or app update, a new phone or laptop, a password change, a policy change, a move), the first diagnostic step ties to that change. Treat stale state (a cached session, a device binding, a token, a sync that has not run) as the first suspect, before broken state.

> Example: "Since my password change yesterday, my Mac keeps asking for the Wi-Fi password." Step 1 is not "reinstall the Wi-Fi profile"; it is "on the Mac, open Keychain Access and look for the old Wi-Fi password saved for the office network": the saved old password is the stale state the change left behind.

**Lightest fix first.** Before advising any action that cannot be undone, or that resets, wipes, erases, deletes or re-registers (R3, or any reset, wipe, erase, delete or re-register), the steps first list the lighter admin actions the platform offers for that symptom that can be undone: sign the user out or revoke their sessions, ask them to sign in again (re-authentication), re-sync, re-push a profile or policy, refresh a device binding. Each lighter action is its own step. If none applies, say why in one line. The heavy action is the last step, labeled "last resort": a later rung, whose gate stays out of the aegis-desk block (section 5).

> Example: a laptop shows "not compliant" after a policy change. Steps: 1. read the device's compliance detail; 2. ask the user to sync the device from the company portal; 3. re-push the policy assignment; 4. last resort: retire and re-enroll the device. The retire is a gate; steps 2 and 3 can be undone and come first, and the retire's gate waits outside the aegis-desk block until they did not work.

**Look before guessing.** When an Aegis read could show the failing event (the Okta System Log, the Entra sign-in logs, the Google Admin audit log, Intune or Jamf device status), the first step says, in plain words, what to look for there and what each result would mean. When no runbook covers the symptom, the answer says so in one line ("No runbook covers this; these steps are reasoning, not a known fix.") and marks its own steps that way.

> Example: "Teams says my account is not allowed to sign in." Step 1: "Open the Entra sign-in logs for [UPN] and read the failure reason on the latest Teams sign-in: a Conditional Access block points to a policy, a disabled account points to the account, and no sign-in at all points to the device or app."

## 3. Details

Everything else goes under `## Details`, after the card: the sections of the Response Format in `docs/aegis/workflow.md` (Verdict, What to check first, Step-by-step fix, PowerShell for reference, Risk warning, Verification checklist, Jira-ready note), the risks, the rollback and the ticket note. Keep them short; the card already gave the fix. A Details line mentions a change; the card's steps are what the tech is asked to do.

## 4. No commands for the tech

No `node`, `npm` or other script command appears in the card or in Details, anywhere outside the aegis-desk block. Checking that a change worked is Aegis's job: the card says what Aegis will check, in plain words, and the read-back itself goes in the aegis-desk block. PowerShell for reference stays allowed under Details, labeled and explained as CLAUDE.md rule 3 says.

## 5. The aegis-desk block

The answer ends with one fenced block labeled `aegis-desk`, and nothing after it. It holds what the desk needs and the Fix card leaves out: gate ids, R classes, change records, read-back commands, confirmation phrases and the `Gate:` lines. The desk reads it and keeps it out of the tech's plain view; the sign-off phrase and the double-check reach the tech through the desk, not as text to copy from the answer.

- One `Gate: <gate id>` line per change the answer advises, in the order the steps advise them, using the runbook's SAFETY GATE id (or its PREVIEW ONLY id when that is all the runbook has), or `Gate: none` when it advises no change.
- **One rung per block.** The block lists only the gates to run now. A change that applies only if an earlier change did not work (a "last resort", an "if it still fails") is a later rung: the card's step says so in plain words, Details names its gate id and its condition on one line ("Step 4, only if step 3 did not stop the errors: gate `<the re-register gate's id>`."), and its gate stays out of the block. A higher-class gate (R2 or R3) and a lighter gate the runbook offers for the same symptom are never in one block. User checks and reads are not rungs: the first change after them is the one to run now, even when its step opens "If it still fails" about a user check. The desk's "lightest step first" row fails a block that holds two rungs.
- After a Gate line, when the runbook has them: `Phrase: <the exact confirmation phrase>`, `Change record: <R class>, read-back <connector:verify-command>`, and `Read-back: <the runbook's read-back command, exactly as the runbook writes it>`. The read-back is not dropped from the answer: CLAUDE.md's "verify or it didn't happen" still holds, and the block is where a person or the desk finds the command to run it.

## 6. A short example

This example is about none of the desk's tickets.

````markdown
## Fix
**What's wrong:** [FIRST_NAME]'s mailbox is full, so new mail bounces.
**Do this:**
1. Open Exchange admin center → Recipients → Mailboxes → [UPN] and read the mailbox size under Usage.
2. Ask [FIRST_NAME] to empty Deleted Items, then send a test message.
3. If it still bounces, turn on the archive mailbox in Others → Manage mailbox archive.
**Done when:** a test message to [UPN] arrives. Aegis then checks the archive shows as on.
**Stop if:** the mailbox is not near its limit; then the bounce has another cause.
**Tell the user now:** IT is looking at your mailbox space. Please empty your Deleted Items folder.
**Tell the user when done:** Your archive is on, so new mail arrives again.

## Details
(The Response Format sections, short.)

```aegis-desk
Gate: <the archive gate's id>
Phrase: <its exact confirmation phrase>
Read-back: <the runbook's read-back command for that gate, as the runbook writes it>
```
````
