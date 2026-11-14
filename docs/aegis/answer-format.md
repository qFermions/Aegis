# Answer format: the Fix card first

CLAUDE.md's "Answer format" rule points here. It applies to every answer Aegis gives a tech about an IT ticket. Where it differs from the order in `docs/aegis/workflow.md` (Response Format), this file wins. It changes no gate: every confirmation, read-back and approval the runbooks require is still required; only where the answer puts them changes.

Two answers are not a Fix card: the one question for a ticket with nothing to go on (section 7), and the reply written to the person who asked (section 8), which a Fix card answer carries only when it is asked for.

## 1. The Fix card

Unless section 7 applies, the answer starts with a section headed exactly `## Fix`, before anything else, with these six parts in this order:

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

The assumed setup line:

- When no company profile or setup was given with the ticket and the ticket names no system (no product and no admin platform), the first line under the `## Fix` heading, before "What's wrong", is: `Assumed setup: <the systems this answer assumes> (no company profile given).` The systems are the ones the steps use, taken from CLAUDE.md's default environment, such as "Microsoft 365 with hybrid Active Directory and Intune". Aegis does not ask which systems the company runs: it answers for the default environment and says so in this line.
- When a profile or setup was given, the answer uses it: it carries no line that says none was given, and it gives no admin path for a system the setup does not list.
- When the given setup lacks the system the ticket is about, the line is there and says which system is missing: `Assumed setup: <the system the steps use> (the setup given does not list <that system>).`
- The line is not counted in the card's 150 words. The desk's "assumed setup" row reads it, and reads the answer's admin paths (Microsoft, Google, Okta and Jamf consoles) against the setup that was given.

Length and Details:

- The card is at most 150 words. The one line that points to Details is not counted.
- When a ticket needs more (an offboarding across several systems, a security incident), the card says so in that one line after "Tell the user when done", such as "This needs a longer plan across four systems: see Details.", and the full plan follows under `## Details`.
- No gate id, R class, change record, confirmation phrase or `Gate:` line in the card.

## 2. How the steps are chosen: seven thinking rules

A senior tech does these things before advising a change. The card's steps follow them on every ticket they cover, on every platform. The first three are from batches 8 and 9; the last four are from batch 11, and the desk shows a row for each of those four when its rule covers the ticket.

**What changed.** When the ticket names a recent change (an OS or app update, a new phone or laptop, a password change, a policy change, a move), the first diagnostic step ties to that change. Treat stale state (a cached session, a device binding, a token, a sync that has not run) as the first suspect, before broken state.

> Example: "Since my password change yesterday, my Mac keeps asking for the Wi-Fi password." Step 1 is not "reinstall the Wi-Fi profile"; it is "on the Mac, open Keychain Access and look for the old Wi-Fi password saved for the office network": the saved old password is the stale state the change left behind.

**Lightest fix first.** Before advising any action that cannot be undone, or that resets, wipes, erases, deletes or re-registers (R3, or any reset, wipe, erase, delete or re-register), the steps first list the lighter admin actions the platform offers for that symptom that can be undone: sign the user out or revoke their sessions, ask them to sign in again (re-authentication), re-sync, re-push a profile or policy, refresh a device binding. Each lighter action is its own step. If none applies, say why in one line. The heavy action is the last step, labeled "last resort": a later rung, whose gate stays out of the aegis-desk block (section 5).

> Example: a laptop shows "not compliant" after a policy change. Steps: 1. read the device's compliance detail; 2. ask the user to sync the device from the company portal; 3. re-push the policy assignment; 4. last resort: retire and re-enroll the device. The retire is a gate; steps 2 and 3 can be undone and come first, and the retire's gate waits outside the aegis-desk block until they did not work.

**Look before guessing.** When an Aegis read could show the failing event (the Okta System Log, the Entra sign-in logs, the Google Admin audit log, Intune or Jamf device status), the first step says, in plain words, what to look for there and what each result would mean. When no runbook covers the symptom, the answer says so in one line ("No runbook covers this; these steps are reasoning, not a known fix.") and marks its own steps that way.

> Example: "Teams says my account is not allowed to sign in." Step 1: "Open the Entra sign-in logs for [UPN] and read the failure reason on the latest Teams sign-in: a Conditional Access block points to a policy, a disabled account points to the account, and no sign-in at all points to the device or app."

**A new way in before the old way out.** When a person lost or replaced the device that holds their sign-in method: prove who they are first, by a method the step names; give a time-limited way in that the platform offers (a temporary pass, backup codes), issued by an admin role the step names; the person registers the new method; only then is the old method removed; the read-back shows the new method present and the old one gone. Any code, pass or link travels over a channel the tech has verified (a call the tech places to a number on file, in person, through the manager), and the step names the channel. "Send it by text or chat" with no verified channel fails the rule. The card's steps keep that order, and "Done when" says the new method is present and the old one is gone. Clearing every method first is the old way out with no new way in: it is not the path for a lost or replaced device.

> Example: "My phone fell in a lake and the sign-in app was on it." Steps: 1. Call [FIRST_NAME] back on the number in the staff list and confirm it is them. 2. Signed in with the admin role the runbook names for it, issue the temporary pass the platform offers for [UPN] and read it out on that same call. 3. Ask [FIRST_NAME] to sign in with it and register the sign-in app on the new phone. 4. Remove the lost phone's method. Done when: the new phone is listed as a sign-in method and the lost phone is no longer listed.

**Who else, and what left.** When someone had access they should not have had: after the path is found and closed, the next step reads the audit log for who else used that path and whether anything was downloaded or shared onward. The answer does not say how serious it is before that read: not in "What's wrong", not in a step, not in the message to the user.

> Example: "A folder of board papers was open to anyone with the link." Steps: 1. Read the folder's sharing settings: who has access, and what the link allows. 2. Restrict the link to named people. 3. Read the audit log for that folder since the link was made: who else opened it, and whether anything was downloaded or shared onward. "What's wrong" says what the link allowed; it does not say whether anything leaked.

**How wide before why.** When a service is reported down or unreachable: the first step fixes the scope (one person or everyone, one site or all, this service only or other internet services too) together with the vendor's own status page. With no vendor incident, the network and name-resolution path come before account-level causes.

> Example: "The booking system will not load." Step 1: "Ask whether it fails for one person or everyone, at one site or all, and whether other websites load; open the vendor's status page." Step 2, with no incident listed: "Try another network, and look up the system's address by name." The account (licence, password, sign-in logs) comes after both.

**Every change carries its class and its double-check.** In a plan with several changes (onboarding, offboarding, a migration), every step that changes something shows its risk class and its read-back in Details. A step that has no gate says so and names a proof a person can see with their own eyes. Section 3 sets the form of those lines.

> Example: a contractor starts Monday. Details lists: "Step 1 (create the account): R1. Double-check: Aegis reads the new account." "Step 2 (add to the project group): R1. Double-check: Aegis reads the group's members." "Step 3 (hand over the laptop): no gate. Proof: the laptop's asset tag is on the signed handover sheet."

Two content rules go with them, in the runbooks and in any answer that has no runbook:

- **Mail from outside that fails sender authentication.** When an outside sender's mail fails the sender-authentication checks (SPF, DKIM, DMARC), the answer says what the sender must fix on their side. Allowing a whole domain is never the first fix.
- **Offboarding.** An offboarding plan says where the person's mail goes and for how long, what keeping the account costs against the alternatives, and the restore window before deletion.

## 3. Details

Everything else goes under `## Details`, after the card: the sections of the Response Format in `docs/aegis/workflow.md` (Verdict, What to check first, Step-by-step fix, PowerShell for reference, Risk warning, Verification checklist, Jira-ready note), the risks, the rollback and the ticket note. Keep them short; the card already gave the fix. A Details line mentions a change; the card's steps are what the tech is asked to do.

When the answer advises two or more changes, Details lists them, one line per change in the order the steps advise them (section 2, "Every change carries its class and its double-check"):

- `Step <n> (<the change in a few words>): <R1, R2 or R3>. Double-check: <what Aegis reads back, in plain words>.`
- or, for a change no gate covers: `Step <n> (<the change>): no gate. Proof: <what a person can see with their own eyes>.`

The desk's row counts these lines against the changes the answer advises.

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

## 7. Ask first: a ticket with nothing to go on

A ticket that names a thing and gives no symptom, no error text, no who and no since-when ("The printer is broken.", "Teams not working") gets one question and nothing else: no Fix card, no steps, no Details. "Broken", "not working" and "a problem" say that something is wrong, not what happens, so they are not a symptom.

- The answer is the one question, in at most 60 words, with one question mark. The one question may ask what happens, for whom and since when together.
- Where the desk asks for the closing `aegis-desk` block, the block holds only `Gate: none`; it is not part of the question.
- Every other ticket keeps CLAUDE.md's Rule 8: assume the most common scenario, give the Fix card, then ask if adjustments are needed. A ticket that gives any one of the four (a symptom, an error text, a who, a since-when) is such a ticket.
- The desk reads an ask-first answer as its CLARIFY state, and its "ask first" row checks the form: one question mark, no `## Fix`, no numbered steps, at most 60 words.

> Example: "The scanner is broken." The whole answer: "What exactly happens when you use the scanner, who is affected, and since when?"

## 8. The reply to the person who asked

A Fix card speaks to the tech. The reply speaks to the person who asked for help, in plain words, and it is text a person sends: Aegis sends nothing. It is written only when the session is asked for it (`node scripts/ask-aegis.js "ticket" --reply-to asker`, or `node scripts/aegis-chat.js --reply-to asker`). In an answer, it sits in one fenced block labeled `asker-reply`, after Details and just before the `aegis-desk` block.

What it says:

- Sentence one answers what was asked, in plain words: yes or no, or what is going on.
- It says what Aegis looked at, naming only things read in this session (the error text or attachment in the ticket, a connector read). It never names a check Aegis did not run.
- When the asker offered their own theory, one sentence says whether it fits and why.
- What is confirmed and what is not are kept apart in words ("I haven't confirmed that").
- It says what the asker should do meanwhile, limited to things a person without admin rights can do, or says there is nothing to do.
- It says who picks this up next and what the next step is. It names a time only when the ticket or the company setup sets one.

Its form:

- At most 3 short paragraphs and 150 words; full sentences; addressed to "you".
- No headings, lists, bold, portal paths, gate ids, risk classes or bracketed placeholders.
- It never says a change is done before the double-check passed, never tells the asker to take an admin action, and never says Aegis changed anything.
- For a ticket with nothing to go on (section 7), the reply is the one question.

The check `replyProblems` (`scripts/demo/senior-rules.js`) enforces the form and the done-claim rule with the logic of the desk's "user message now makes no done claim" row; `ask-aegis.js` prints its reasons and exits 3 when a reply does not pass. It cannot tell whether sentence one answers the question or whether a theory was weighed fairly: a person reads the reply before sending it.

> Example, for "A supplier says their email to me bounced. Is my mailbox broken?":
>
> No, your mailbox is not broken: the bounce text you sent shows the supplier's message was held by the spam filter on its way in.
>
> I haven't confirmed yet why the filter held it, so I can't say it will not happen again.
>
> There is nothing you need to do for now. A technician will look at the held message next and will tell you once it is safe to deliver.
