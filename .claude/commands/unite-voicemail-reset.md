---
description: Reset voicemail PIN, clear greetings, and reconfigure voicemail-to-email for an [@Aegion_VOIP] user. Placeholders only.
disable-model-invocation: true
---

# /unite-voicemail-reset

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Voicemail resets are a straight portal operation — navigate to the user, reset the PIN, clear old greetings, confirm email notification is set. The whole thing takes under five minutes; the only thing that can go wrong is voicemail-to-email pointing at a stale address.

---

## What to check first

- Is the user locked out of voicemail (forgotten PIN), or is the mailbox full / greeting corrupted?
- Is voicemail-to-email currently enabled? If yes, confirm the destination email [UPN] is still correct — especially relevant after a name change or role change.
- Is the user at a site where [@Aegion_VOIP] migration is complete? (Main office = yes. [@Aegion_SITE_2], [@Aegion_SITE_3], [@Aegion_SITE_4] — check `/unite-migration-status` first.)

---

## Step-by-step fix

### 1. Navigate to the user in the [@Aegion_VOIP] admin portal

1. Log in to the [@Aegion_VOIP] admin portal ([@Aegion_VOIP_URL]).
2. [@Aegion_VOIP_URL] → **Users** → **Manage users** → search by name [USER_NAME] or extension [EXTENSION].
3. Open the user record.
4. Click the **Voicemail** tab.

### 2. Reset the voicemail PIN

> **PREVIEW ONLY [voicemail-pin-reset]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.

1. Click **Reset PIN** (or **Change PIN**).
2. Generate a unique random temporary PIN that satisfies the current provider policy. Never use defaults, repeated/sequential digits, personal facts, or a PIN supplied in ticket/chat content.
3. Confirm the portal will force a PIN change at first use; if it cannot, stop and use the provider's secure recovery path rather than issuing a reusable temporary secret.
4. Save only inside the separately approved, target-bound credential runbook.
5. Deliver the temporary PIN once through the approved secure out-of-band secret channel (for example, verified voice or in person), never Teams, ordinary email, or the ticket. Do not retain or quote it after delivery.

> PIN requirements vary by plan. Read the live policy first and generate a compliant random value; do not weaken the policy or fall back to a predictable PIN when validation fails.

### 3. Clear existing greetings (if required)

> **PREVIEW ONLY [voicemail-greeting-delete]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.

1. On the **Voicemail** tab, locate the **Greetings** section.
2. Delete or reset:
   - **Unavailable greeting** (plays when unanswered)
   - **Busy greeting** (plays when line is busy)
   - **Name recording** (used in directories and auto-attendant)
3. Leaving greetings cleared will revert to the system default greeting until the user re-records their own.

### 4. Confirm voicemail-to-email notification

> **PREVIEW ONLY [voicemail-routing-change]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.

1. In the **Voicemail** tab, find **Email Notification** or **Voicemail-to-Email**.
2. Verify:
   - Toggle is **On**
   - Destination email address is [UPN] (correct and current)
   - **Send as attachment** is enabled (so the user can play the `.wav` file from email)
   - Optional: **Transcription** is on if the account plan includes it
3. If the email address is wrong or missing: update it to [UPN] → Save.

### 5. Test — call and leave a voicemail

1. Call extension [EXTENSION] from another phone and let it ring to voicemail.
2. Leave a short test message.
3. Confirm:
   - **From the phone:** dial into voicemail from [EXTENSION] and retrieve the message using the new PIN.
   - **Via email:** check [UPN] inbox — the notification email with audio attachment should arrive within 1–2 minutes.
4. Have the user log in themselves and change the PIN to their own preferred value (if you set a temporary one).

---

## ⚠️ Risk warning

- **Clearing greetings** removes any custom recording the user had set — confirm with the user or manager before deleting, especially if a professional greeting was recorded.
- **PIN reset** locks out any current voicemail session in progress. Coordinate with the user so they're not in the middle of retrieving messages.
- **Voicemail-to-email** — if you update the email address, messages going forward will route to the new address only. Confirm the user's old emails still have any messages they need to retain.

---

## ✅ Verification checklist

- [ ] New PIN set and user notified via out-of-band channel
- [ ] Old greetings cleared (if requested) — system default is now active
- [ ] Voicemail-to-email enabled with correct destination [UPN]
- [ ] Test message left on extension [EXTENSION]
- [ ] User retrieved test message via phone PIN ✅
- [ ] Voicemail-to-email notification received at [UPN] with audio attachment ✅
- [ ] User has changed PIN to their own value (if a temp PIN was set)

---

## 📝 Jira-ready note

Use the completed/closing template only after the portal read-back, PIN retrieval, test call, and voicemail-to-email delivery above are verified. Otherwise use a **Partial state — keep open** note listing the immutable extension, verified steps, pending checks, and failures.

> **Voicemail reset completed — [JIRA-###]**
>
> Reset voicemail PIN for extension [EXTENSION] ([USER_NAME]) in the [@Aegion_VOIP] admin portal. [Cleared existing greetings per request.] Confirmed voicemail-to-email notification enabled and routed to [UPN]. Test call confirmed: voicemail accessible by PIN and email notification delivered with audio attachment. User notified of new PIN. Closing ticket.
