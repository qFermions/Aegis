# Answer format: the Fix card first

CLAUDE.md's "Answer format" rule points here. It applies to every answer Aegis gives a tech about an IT ticket. Where it differs from the order in `docs/aegis/workflow.md` (Response Format), this file wins. It changes no gate: every confirmation, read-back and approval the runbooks require is still required; only where the answer puts them changes.

## 1. The Fix card

The answer starts with a section headed exactly `## Fix`, before anything else, with these five parts in this order:

| Part | What it holds |
|---|---|
| **What's wrong:** | One sentence. |
| **Do this:** | 3 to 5 numbered steps in plain words. Each step is one action a tech takes in an admin portal or on the phone, with the portal path where there is one (Admin center → Users → ...). |
| **Done when:** | One line a tech can see with their own eyes. When Aegis will check the change, say what it will check, in plain words ("Aegis then checks the old sign-in method is gone"). |
| **Stop if:** | One line: the signal that turns this into a different problem. |
| **Tell the user:** | At most 3 short sentences to send the person who asked. No portal paths, no technical terms. |

- The card is at most 150 words.
- When a ticket needs more (an offboarding across several systems, a security incident), the card says so in one line after "Tell the user", such as "This needs a longer plan across four systems: see Details.", and the full plan follows under `## Details`.
- No gate id, R class, change record, confirmation phrase or `Gate:` line in the card.

## 2. Details

Everything else goes under `## Details`, after the card: the sections of the Response Format in `docs/aegis/workflow.md` (Verdict, What to check first, Step-by-step fix, PowerShell for reference, Risk warning, Verification checklist, Jira-ready note), the risks, the rollback and the ticket note. Keep them short; the card already gave the fix.

## 3. No commands for the tech

No `node`, `npm` or other script command appears anywhere in an answer meant for a tech, card or Details. Checking that a change worked is Aegis's job: the card says what Aegis will check, in plain words, and the read-back itself goes in the aegis-desk block. PowerShell for reference stays allowed under Details, labeled and explained as CLAUDE.md rule 3 says.

## 4. The aegis-desk block

The answer ends with one fenced block labeled `aegis-desk`, and nothing after it. It holds what the desk needs and a tech does not: gate ids, R classes, change records, confirmation phrases and the `Gate:` lines. The desk reads it and hides it from people; nothing in it is an instruction to the tech.

- One `Gate: <gate id>` line per change the answer advises, using the runbook's SAFETY GATE id (or its PREVIEW ONLY id when that is all the runbook has), or `Gate: none` when it advises no change.
- After a Gate line, when the runbook has them: `Phrase: <the exact confirmation phrase>`, `Change record: <R class>, read-back <connector:verify-command>`, and `Read-back: <the runbook's read-back command, exactly as the runbook writes it>`. The read-back is not dropped from the answer: CLAUDE.md's "verify or it didn't happen" still holds, and the block is where a person or the desk finds the command to run it.

## 5. A short example

This example is about none of the desk's tickets.

````markdown
## Fix
**What's wrong:** [FIRST_NAME]'s mailbox is full, so new mail bounces.
**Do this:**
1. Open Exchange admin center → Recipients → Mailboxes → [UPN].
2. Read the mailbox size under Usage.
3. Turn on the archive mailbox in Others → Manage mailbox archive.
4. Ask [FIRST_NAME] to empty Deleted Items.
**Done when:** a test message to [UPN] arrives. Aegis then checks the archive shows as on.
**Stop if:** the mailbox is not near its limit; then the bounce has another cause.
**Tell the user:** Your mailbox was full. We turned on your archive. New mail will arrive again.

## Details
(The Response Format sections, short.)

```aegis-desk
Gate: <the archive gate's id>
Phrase: <its exact confirmation phrase>
```
````
