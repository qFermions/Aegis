---
description: Full offboarding — contain identity, preserve data, reclaim licenses, wipe devices, revoke site access, document. Medium-depth GUI steps, why-footer, one-concept. Placeholders only.
---

# /offboard

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders. Never prompt for user information.

**Placeholders:** `[UPN]` `[first.last]` `[MANAGER_UPN]` `[DEVICE_NAME]` `[EXTENSION]` `[SHARED_MAILBOX]` `[PRODUCT_PROFILE]` `[WORK_PHONE_DEVICE_GROUP]` — org values use the Koinon `[@Aegion_*]` dictionary.

⚠️ **This is a destructive multi-system plan — route it through Nova before executing.** Every disable/wipe/removal step below hits the destructive-action gate: confirm before running.
⚠️ **Involuntary termination?** Complete Steps 1–4 BEFORE the user is notified. Speed matters.

---

## Phase A — Contain the Identity

### STEP 1 — ⚠️ Disable the account (on-prem first — source of authority)

**Portal:** ADUC (`dsa.msc`) → find `[first.last]` → right-click → **Disable Account** → then force sync.
**Instant cloud cutoff (do this too):** entra.microsoft.com → Users → `[UPN]` → **Edit** → Block sign-in → Yes → Save.

<details>
<summary>PowerShell — disable + sync (for reference only)</summary>

```powershell
Disable-ADAccount -Identity "[first.last]"        # ⚠️ disables the authoritative on-prem account
Start-ADSyncSyncCycle -PolicyType Delta           # run ON the AD Connect server — pushes the disable to Entra
Update-MgUser -UserId "[UPN]" -AccountEnabled:$false  # instant cloud block while sync lands
```
</details>

✅ Verify: Entra → user shows **Sign-in blocked**; ADUC shows account disabled.
**Why:** On-prem AD is the source of authority — a cloud-only block on a synced user can be overwritten by the next sync if the AD account is still enabled. AD disable is authoritative; the Entra block covers the sync gap.

### STEP 2 — Revoke all M365 sessions

**Portal:** entra.microsoft.com → Users → `[UPN]` → **Revoke sessions** → Confirm

✅ Verify: Sign-in logs show no new activity for `[UPN]` after the timestamp.
**Why:** Blocking sign-in stops NEW logins only — existing tokens (Outlook, Teams, mobile) stay valid up to an hour unless revoked.

### STEP 3 — Reset password to long random

**Portal:** ADUC → `[first.last]` → right-click → **Reset Password** → long random value → do NOT record or share → force sync.

✅ Verify: old password fails on a test protocol (or just confirm reset + sync landed).
**Why:** Kills cached credentials — saved passwords in browsers, phones, and legacy protocols that don't respect token revocation.

### STEP 4 — Clear ALL MFA methods

**Portal:** entra.microsoft.com → Users → `[UPN]` → **Authentication methods** → delete every registered method (Authenticator, phone, FIDO).

✅ Verify: Authentication methods list is empty.
**Why:** A registered Authenticator on a personal phone is a standing approval channel — clearing it severs SSPR and any future re-auth path.

---

## Phase B — Preserve the Data (before touching licenses)

### STEP 5 — Convert mailbox to shared + delegate

**Portal:** Exchange admin → Mailboxes → `[UPN]` → **Convert to shared mailbox** → Confirm.
Then (if required): → **Delegation** → Full Access → `[MANAGER_UPN]` (+ Send As only if they must reply from the address). Add forwarding if the business asks for it.

<details>
<summary>PowerShell — convert + delegate (for reference only)</summary>

```powershell
Set-Mailbox -Identity "[UPN]" -Type Shared                                            # no license needed once shared
Add-MailboxPermission -Identity "[UPN]" -User "[MANAGER_UPN]" -AccessRights FullAccess -InheritanceType All  # manager reads
```
</details>

✅ Verify: mailbox type = Shared; manager can open it; inbound mail still flows.
**Why:** A shared mailbox needs no license — converting BEFORE license removal keeps the mail and the address alive for free.

### STEP 6 — Transfer OneDrive to the manager

**Portal:** admin.microsoft.com → Users → Active users → `[UPN]` → **OneDrive** tab → **Create link to files** / grant access to `[MANAGER_UPN]`.

⚠️ **Retention window:** a deleted/unlicensed user's OneDrive is kept **30 days by default** — flag the deadline to the manager in writing.

✅ Verify: manager opens the link and confirms the files they need.
**Why:** OneDrive is license-bound personal storage, not a shared site — without an explicit transfer it silently expires with the retention window.

### STEP 7 — Remove ALL licenses

**Portal:** admin.microsoft.com → Users → Active users → `[UPN]` → **Licenses and apps** → uncheck all → Save. Group-licensed? Remove from the licensing group instead.

✅ Verify: license count freed in admin center → Billing → Licenses; shared mailbox still works.
**Why:** Licenses are the recurring cost — but only after Steps 5–6, because the license is what's holding the mailbox and OneDrive data.

---

## Phase C — Strip the Access

### STEP 8 — Remove from groups, DLs, and shared-mailbox delegation

**Portal:** Entra → `[UPN]` → Groups → remove all (on-prem-synced ones in ADUC). Exchange admin → remove from DLs and from `[SHARED_MAILBOX]` **Delegation** lists.

<details>
<summary>PowerShell — strip AD groups (for reference only)</summary>

```powershell
# Removes the user from every AD group except Domain Users — run on a domain-joined machine
$user   = Get-ADUser -Identity "[first.last]"
$groups = Get-ADPrincipalGroupMembership $user | Where-Object { $_.Name -ne "Domain Users" }
foreach ($g in $groups) { Remove-ADGroupMember -Identity $g -Members $user -Confirm:$false }  # ⚠️ bulk removal
```
</details>

✅ Verify: group list empty (bar Domain Users); delegation lists clean — this is what `/group-membership-audit` exists for.
**Why:** Stale memberships are the #1 offboarding leftover — they re-grant access the moment anything re-enables the account.

### STEP 9 — ⚠️ Wipe or Retire the computer

**Portal:** intune.microsoft.com → Devices → All devices → `[DEVICE_NAME]`

- **Wipe** (factory reset) — corporate-owned devices
- **Retire** (remove work data only) — BYOD

⚠️ **Confirm which ownership applies BEFORE clicking** — a Wipe on a personal device destroys personal data. Destructive gate: explicit confirmation required.

✅ Verify: device status shows the action completed; device drops from compliant list.
**Why:** Wipe vs Retire is an ownership question, not a security preference — the inventory log from onboarding is what answers it.

### STEP 10 — Work phone: wipe + remove from device group

**Portal:** intune.microsoft.com → Devices → the work phone → **Wipe** (corporate Android). Then remove the device from `[WORK_PHONE_DEVICE_GROUP]`.

✅ Verify: wipe completes; device gone from the group (so app licenses and policy targeting free up).
**Why:** The group membership is the app-deployment trigger from onboarding — leaving the dead device in it skews targeting and counts.

### STEP 11 — [@Aegion_VOIP]: reclaim the extension

**Portal:** [@Aegion_VOIP_URL] → Users → remove/deactivate the user → reclaim `[EXTENSION]` → clear the voicemail box (or export first if the business needs it).

✅ Verify: calls to `[EXTENSION]` hit the intended new target (reassignment or general line), not a dead end.
**Why:** Extensions are a finite, paid pool — and an unmonitored voicemail box quietly eats messages from people who don't know the person left.

### STEP 12 — Zoom: deactivate

**Portal:** Zoom admin → User Management → `[UPN]` → **Deactivate** (or delete after transferring upcoming meetings/recordings).

✅ Verify: license freed in Zoom admin → Account Management → Billing.
**Why:** Zoom seats are per-license spend; deactivate-before-delete preserves recordings until ownership is decided.

### STEP 13 — Adobe: remove from product profile

**Portal:** adminconsole.adobe.com → Users → `[UPN]` → remove from `[PRODUCT_PROFILE]` → remove user.

✅ Verify: seat count freed on the profile.
**Why:** Adobe bills by profile seat — an offboarded user holding one is pure waste.

### STEP 14 — Remote access: revoke VPN + legacy tools

**Steps:** remove client-VPN access (Meraki → revoke the user's VPN credentials/group). Check the user's machines for any legacy remote-access tools and remove them.

✅ Verify: VPN auth fails for the account; no remote tool answers on their devices.
**Why:** Remote access is the path that works AFTER badge collection — it dies with the account or it doesn't die at all.

### STEP 15 — Physical/site: alarm code + badge

**Steps:** request alarm-code removal via the **office manager** (coordinated with [@Aegion_ALARM] — don't assume, confirm) and badge/door access removal with whoever owns it at the site.

✅ Verify: office manager confirms code deactivated; badge returns/deactivates.
**Why:** Alarm codes don't expire on their own — they outlive employment until someone explicitly removes them.

---

## Phase D — Close It Out

### STEP 16 — Document + AD disposal

1. Move the AD account to the **Disabled Users** OU (out of sync scope per policy)
2. Log every step + timestamp in the Jira ticket (closure note below)
3. Calendar the **AD account deletion after the retention window** — disposal is the actual end of offboarding

✅ Verify: ticket closed with the full trail; disposal date scheduled.
**Why:** The disabled account is the audit anchor during retention — deleting too early breaks mailbox/OneDrive holds; never deleting accumulates risk.

---

## ✅ Completion checklist

- [ ] AD disabled (authoritative) + Entra sign-in blocked · sessions revoked · password randomized · MFA methods cleared
- [ ] Mailbox → shared + manager delegated · OneDrive transferred (30-day window flagged) · all licenses removed (after conversion)
- [ ] Groups/DLs/shared-mailbox delegation stripped
- [ ] Computer wiped/retired (ownership confirmed) · work phone wiped + removed from `[WORK_PHONE_DEVICE_GROUP]`
- [ ] [@Aegion_VOIP] extension reclaimed + voicemail cleared · Zoom deactivated · Adobe seat freed
- [ ] VPN + legacy remote tools revoked · alarm code + badge removed (coordinated)
- [ ] AD account moved to Disabled OU · disposal date scheduled · Jira closed

## 📝 Jira-ready note

> Offboarding completed for `[UPN]` ([voluntary/involuntary], last day [DATE]). Identity contained [timestamp]: AD disabled, sign-in blocked, sessions revoked, password randomized, MFA cleared. Data preserved: mailbox → shared (delegated to `[MANAGER_UPN]`), OneDrive transferred (30-day retention flagged). Reclaimed: M365 licenses, [@Aegion_VOIP] ext `[EXTENSION]`, Zoom, Adobe. Devices: `[DEVICE_NAME]` [wiped/retired], work phone wiped + de-grouped. Access stripped: groups/DLs/delegation, VPN/remote tools, alarm code + badge (coordinated). AD account in Disabled OU; disposal scheduled [DATE+retention].

---

🧠 **Why this order:** contain (A) before anything else — every minute an active session survives is live access; preserve (B) before reclaiming, because the license you want back is what's holding the mailbox and OneDrive; strip (C) only after the data is safe, working from cloud access down to physical site; document (D) last because the ticket is the proof and the retention clock is the real finish line. Run the sequence backwards and you get data loss with the access still live.

🎓 **One new concept — license-bound data:** in M365, a user's mailbox and OneDrive exist only as long as a license (or a shared-mailbox conversion / retention hold) sustains them. Remove the license first and the data starts a silent countdown — which is why offboarding is sequenced around the data, not the cost savings.
