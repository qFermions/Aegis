---
description: Reset voicemail PIN, clear greetings, and reconfigure voicemail-to-email for an [@Aegion_VOIP] user. Placeholders only.
---

# /unite-voicemail-reset

**Verdict:** Voicemail resets are a straight portal operation — navigate to the user, reset the PIN, clear old greetings, confirm email notification is set. The whole thing takes under five minutes; the only thing that can go wrong is voicemail-to-email pointing at a stale address.

---

## What to check first

- Is the user locked out of voicemail (forgotten PIN), or is the mailbox full / greeting corrupted?
- Is voicemail-to-email currently enabled? If yes, confirm the destination email [UPN] is still correct — especially relevant after a name change or role change.
- Is the user at a site where [@Aegion_VOIP] migration is complete? (Main office = yes. [@Aegion_SITE_2], [@Aegion_SITE_3], [@Aegion_SITE_4] — check `/unite-migration-status` first.)

---

## Step-by-step fix

### 1. Navigate to the user in the [@Aegion_VOIP] admin portal

1. Log in to the [@Aegion_VOIP] admin portal.
2. Go to **Users** → search by name [USER_NAME] or extension [EXTENSION].
3. Open the user record.
4. Click the **Voicemail** tab.

### 2. Reset the voicemail PIN

1. Click **Reset PIN** (or **Change PIN**).
2. Set a new temporary PIN — use a generic default (e.g., `0000` or `1234`) that the user must change on first access, OR set a PIN the user provided verbally.
3. Save.
4. Inform the user of their new PIN via a channel other than voicemail (Teams message, in-person, or email).

> PIN requirements vary by plan — typically 4–10 digits, no repeating sequences. If the portal rejects the PIN, try a longer or more complex value.

### 3. Clear existing greetings (if required)

1. On the **Voicemail** tab, locate the **Greetings** section.
2. Delete or reset:
   - **Unavailable greeting** (plays when unanswered)
   - **Busy greeting** (plays when line is busy)
   - **Name recording** (used in directories and auto-attendant)
3. Leaving greetings cleared will revert to the system default greeting until the user re-records their own.

### 4. Confirm voicemail-to-email notification

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

> **Voicemail reset completed — [JIRA-###]**
>
> Reset voicemail PIN for extension [EXTENSION] ([USER_NAME]) in the [@Aegion_VOIP] admin portal. [Cleared existing greetings per request.] Confirmed voicemail-to-email notification enabled and routed to [UPN]. Test call confirmed: voicemail accessible by PIN and email notification delivered with audio attachment. User notified of new PIN. Closing ticket.
