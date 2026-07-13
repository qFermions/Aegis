---
description: Create a new [@Aegion_VOIP] extension — user account, DID, voicemail, call groups, desk phone provisioning, and test calls. Placeholders only.
---

# /unite-extension-create

**Verdict:** Creating a new extension in [@Aegion_VOIP] is a portal-only workflow — add the user, assign the extension and DID, configure voicemail, set call routing, then provision the desk phone by MAC. Do this in order; the phone can't register until the user record and extension are fully saved.

---

## What to check first

- Is this a new employee (need a full user record) or an additional extension for an existing user?
- Is a DID (direct inbound number) being assigned, or extension-only (internal calls only)?
- Is a physical desk phone being provisioned, or softphone only?
- Which site is this user at? If [@Aegion_SITE_2], [@Aegion_SITE_3], or [@Aegion_SITE_4] — confirm that site's migration is live before provisioning. Check `/unite-migration-status`.
- Does the extension number [EXTENSION] conflict with an existing extension? Verify in the portal before proceeding.

---

## Step-by-step fix

### 1. Log in to the [@Aegion_VOIP] admin portal

1. Navigate to the [@Aegion_VOIP] admin portal and sign in with your admin credentials.
2. Confirm you are in the correct account/tenant for [@Aegion].

### 2. Create the user and assign the extension

1. Go to **Users** → **Add User** (or **+ New User**).
2. Fill in:
   - **First name:** [FIRST_NAME]
   - **Last name:** [LAST_NAME]
   - **Email address:** [UPN] (used for voicemail-to-email notifications and login)
   - **Extension:** [EXTENSION]
3. Save the user record before continuing.

### 3. Assign a DID (direct inbound number)

1. On the user record → **Phone Numbers** tab.
2. Click **Assign Number**.
3. Select an available DID from the pool: [DID_NUMBER].
   - If no DIDs are available: contact [@Aegion_VOIP] support to port or provision a new number.
4. Set the DID as the **Primary** inbound number.
5. Save.

### 4. Configure voicemail

1. On the user record → **Voicemail** tab.
2. Set a voicemail **PIN** — use a secure default (e.g., employee-chosen PIN, or set a temporary one and require them to change it on first access).
3. **Greeting:** either leave the system default greeting or upload a custom `.wav` greeting file.
4. Enable **Voicemail-to-email notification:**
   - Toggle: **Send voicemail as email attachment** → On
   - Email destination: [UPN]
   - Optionally enable: **Transcription** (if available in the plan)
5. Save.

### 5. Set call forwarding rules

1. On the user record → **Call Forwarding** or **Call Handling** tab.
2. Configure:
   - **No answer:** forward to voicemail after [N] rings (typically 4)
   - **Busy:** forward to voicemail or another extension [EXTENSION]
   - **Offline/unregistered:** forward to voicemail or mobile [PHONE_NUMBER] (if required)
3. Save.

### 6. Assign to a call group or hunt group (if applicable)

1. Navigate to **Groups** (or **Hunt Groups** / **Call Queues**) in the admin portal.
2. Open the relevant group for this user's department or role.
3. Click **Add Member** → search for [USER_NAME] or [EXTENSION].
4. Confirm the ring strategy (simultaneous, round-robin, top-down) is correct for the group.
5. Save.

### 7. Provision the desk phone

**Option A — Auto-provision by MAC address (preferred):**

1. On the user record → **Devices** tab → **Add Device**.
2. Select device type (manufacturer/model).
3. Enter the phone's MAC address: [MAC_ADDRESS] (printed on the back of the phone or its box).
4. Click **Save / Provision**.
5. Plug the phone into the network (PoE switch port). It will pull its config automatically within 1–3 minutes.

**Option B — Manual provisioning (if auto-provision isn't available):**

1. In the [@Aegion_VOIP] portal, retrieve the provisioning server URL and SIP credentials for [EXTENSION].
2. On the phone's web interface (navigate to the phone's IP in a browser): enter the SIP server address, SIP username [EXTENSION], and SIP password.
3. Save and reboot the phone.

> If the phone is at [@Aegion_SITE_2] or [@Aegion_SITE_3]: coordinate with [@Aegion_NETPARTNER] to confirm the desk port is cabled and active before provisioning.

### 8. Test inbound and outbound calls

1. **Outbound:** From extension [EXTENSION], dial an external number. Confirm dial tone, connection, and two-way audio.
2. **Inbound:** Call [DID_NUMBER] from an external phone. Confirm it rings extension [EXTENSION].
3. **Voicemail:** Call [DID_NUMBER] and let it ring to voicemail. Leave a test message. Confirm:
   - Message is accessible by dialing into voicemail from [EXTENSION]
   - Email notification arrives at [UPN] with the audio attachment

---

## ⚠️ Risk warning

- **Extension number conflicts:** assigning a duplicate extension will break both users. Verify [EXTENSION] is unused before saving.
- **DID assignment:** once a DID is assigned to a user, it is removed from the available pool. If assigned to the wrong user, it requires manual correction in the portal.
- **Call group changes** affect everyone in the group — confirm the group ring strategy is still correct after adding the new member.
- **Sites not yet migrated** ([@Aegion_SITE_2], [@Aegion_SITE_3], [@Aegion_SITE_4] partial): provisioning a phone at a site before the network cutover is complete will result in a non-functional phone. Confirm migration status first.

---

## ✅ Verification checklist

- [ ] User record created with correct name and email [UPN]
- [ ] Extension [EXTENSION] assigned and visible in portal
- [ ] DID [DID_NUMBER] assigned and set as primary inbound number
- [ ] Voicemail PIN configured and voicemail-to-email enabled to [UPN]
- [ ] Call forwarding set: no-answer → voicemail after [N] rings
- [ ] Call group/hunt group membership confirmed (if applicable)
- [ ] Desk phone shows **Registered** in the portal with a valid IP
- [ ] Outbound test call: [EXTENSION] → external number ✅ two-way audio
- [ ] Inbound test call: external → [DID_NUMBER] rings [EXTENSION] ✅
- [ ] Voicemail test: message left, retrievable, email notification received at [UPN]

---

## 📝 Jira-ready note

> **New [@Aegion_VOIP] extension created — [JIRA-###]**
>
> Created extension [EXTENSION] for [FIRST_NAME] [LAST_NAME] in the [@Aegion_VOIP] admin portal. Assigned DID [DID_NUMBER]. Configured voicemail with email notification to [UPN]. Set call forwarding (no-answer → voicemail). [Added to call group: GROUP_NAME if applicable.] Provisioned desk phone by MAC. Tested inbound/outbound calls and voicemail-to-email — all confirmed working. Closing ticket.
