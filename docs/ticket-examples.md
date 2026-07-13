# Worked Ticket Examples — Aegis Response Format in Practice

Four anonymized ticket walk-throughs in the canonical §4 response format. Each shows the full Verdict → What to check first → Step-by-step fix → PowerShell (for reference only) → ⚠️ Risk warning → ✅ Verification checklist → 📝 Jira-ready note arc. All identifying data is placeholder-only.

---

## Example 1 — Hybrid AD user can't sign in to M365

**Ticket:** "[FIRST_NAME] [LAST_NAME] ([UPN]) says their password isn't working in Outlook. Worked yesterday."

### Verdict
Almost certainly an Entra Connect sync lag after an on-prem password change, or the on-prem AD account is locked.

### What to check first
1. Entra → Users → [UPN] → Sign-in logs (last 24h) — look for "AccountLocked" or "InvalidUserNameOrPassword."
2. AD Users & Computers → [UPN] → Account tab — is **Account is locked out** checked?
3. AD Connect server → was the password changed in on-prem AD in the last 30 min?

### Step-by-step fix
1. If AD shows the account locked: AD Users & Computers → right-click [UPN] → **Unlock Account**.
2. If sign-in logs show "wrong password" but AD looks fine: confirm the user is typing the *current* password (not their old one).
3. If they reset on-prem recently and it hasn't propagated: force a delta sync on the AD Connect server (PS block below).
4. Ask the user to wait 2 minutes, close Outlook completely, reopen.

### PowerShell — for reference only
<details>
<summary>Force Entra Connect delta sync</summary>

```powershell
# Plain English: forces an incremental sync from on-prem AD to Entra ID. Run on the AD Connect server.
Start-ADSyncSyncCycle -PolicyType Delta
# Delta = only changes since last sync (~30 sec). Initial = full sync (slow, rare).
```
</details>

### ⚠️ Risk warning
None for the unlock + sync path. Do **not** reset the password as the first move — if the issue is sync lag, a reset just adds another sync round-trip.

### ✅ Verification checklist
- Sign-in logs show a successful authentication after the fix
- Outlook reconnects without prompting again
- User confirms by replying to the ticket

### 📝 Jira-ready note
> Resolved [date/time]. Root cause: on-prem AD account was locked from repeated bad-password attempts; password itself was current. Fix: unlocked in ADUC, no sync needed. User confirmed successful sign-in. Time spent: ~5 min.

---

## Example 2 — MFA reset after lost/replaced phone

**Ticket:** "[FIRST_NAME] got a new phone, can't sign in to M365 because MFA is asking for the old Authenticator app."

### Verdict
Need to clear all registered MFA methods, then have the user re-register Authenticator at aka.ms/mfasetup.

### What to check first
1. Entra → Users → [UPN] → Authentication methods — list everything registered.
2. Protection → Conditional Access → Policies — any policy require *MFA from a trusted device* that would block initial registration?
3. Confirm with the user that you're talking to the actual person (callback to a known good number — social engineering risk on MFA resets is real).

### Step-by-step fix
1. Entra ID → Users → [UPN] → **Authentication methods** → delete every entry (Microsoft Authenticator, phone, alternate phone, app passwords).
2. Tell the user: go to **aka.ms/mfasetup** on their new phone, sign in, follow the prompts to register Authenticator.
3. Add a phone-number SMS fallback after primary registration (Authentication methods → + Add → Phone).
4. If a CA policy blocks them before they can register, see ⚠️ below.

### PowerShell — for reference only
<details>
<summary>List + remove MFA methods via Graph (rarely needed; portal is faster)</summary>

```powershell
# Plain English: lists the user's registered authentication methods. Read-only.
Get-MgUserAuthenticationMethod -UserId "[UPN]"
# Each method has an Id; you'd then call Remove-MgUserAuthentication<Method> per type.
# The portal does this in one click — only use PS if scripting bulk resets.
```
</details>

### ⚠️ Risk warning
If a Conditional Access policy requires "MFA from a compliant/trusted device" and the user has *no* registered method, they'll be stuck. **Temporary exception — high risk:** exclude [UPN] from that one CA policy, let them register, re-add to the policy. Document the exception in the Jira ticket, set a reminder to confirm re-inclusion within 24h.

### ✅ Verification checklist
- Authentication methods list shows the new Authenticator registration (and SMS fallback)
- User signs in fresh on their phone and gets the new push
- CA exclusion (if used) is reverted

### 📝 Jira-ready note
> Resolved [date/time]. Cleared all auth methods in Entra, directed user to aka.ms/mfasetup. New Authenticator registered + SMS fallback. CA exclusion not needed. User signed in successfully. Time spent: ~10 min.

---

## Example 3 — Remove license for departing user (destructive)

**Ticket:** "[FIRST_NAME] [LAST_NAME]'s last day was yesterday. Remove their M365 Business Premium license."

### Verdict
Standard offboarding step. **Destructive-action gate fires** — confirm before executing.

### What to check first
1. M365 admin → Users → Active users → [UPN] → confirm this is the right person (check display name + department).
2. Confirm their mailbox conversion status — if not yet converted to shared, removing the license will start the 30-day mailbox deletion clock.
3. Has sign-in already been blocked? If not, do that first (Entra → Users → [UPN] → Block sign-in = Yes).

### Step-by-step fix
1. ⚠️ Confirm with the requester: "About to remove the M365 Business Premium license from [UPN]. After removal, OneDrive becomes inaccessible to the user and mailbox enters a 30-day grace period unless already converted to shared. Proceed? (yes/no)"
2. On explicit "yes": M365 admin → Users → Active users → [UPN] → **Licenses and apps** → uncheck Business Premium → Save.
3. Verify: M365 admin → Billing → Licenses → confirm the seat returned to the pool.
4. If mailbox wasn't converted to shared: do that next (EAC → Recipients → [mailbox] → **Convert to shared**).

### PowerShell — for reference only
<details>
<summary>Remove license via Graph — bulk-safe</summary>

```powershell
# Plain English: removes the M365 Business Premium SKU from the user. -RemoveLicenses takes a SkuId.
Set-MgUserLicense -UserId "[UPN]" -RemoveLicenses @("[SKU_ID]") -AddLicenses @()
# ⚠️ This is the destructive line — flagged by the script-safety scanner.
# Confirm [SKU_ID] is the Business Premium SKU before running.
```
</details>

### ⚠️ Risk warning
**Destructive — gate required.** Without explicit "yes, proceed" from the requester, do not execute. After removal, the user's OneDrive becomes inaccessible (transfer ownership *first*), and the mailbox starts a 30-day deletion clock if not already shared. This is irreversible past 30 days.

### ✅ Verification checklist
- License count in M365 admin → Billing shows the seat returned
- User's Active users entry shows no licenses
- Mailbox status confirms shared (if applicable)
- OneDrive ownership transferred to manager (separate step)

### 📝 Jira-ready note
> Resolved [date/time]. License removed from [UPN] after explicit confirmation from [REQUESTER]. Mailbox converted to shared (transferred manager access to [MANAGER_NAME]). OneDrive ownership transferred. Sign-in already blocked yesterday. Seat returned to pool. Time spent: ~15 min.

---

## Example 4 — "Internet is slow" at [@Aegion_SITE_2]

**Ticket:** "Whole office at [@Aegion_SITE_2] says internet is crawling since this morning."

### Verdict
Site-wide symptom — check WAN uplink and AP load before touching individual clients.

### What to check first
1. Meraki dashboard → Security & SD-WAN → Appliance status → [@Aegion_SITE_2] uplink — current throughput vs baseline, packet loss, latency.
2. Meraki → Network-wide → Event log — any uplink flaps in the last 4h?
3. [@Aegion_ISP] status page — any reported incident in the area?
4. Wireless → Access points — client count per AP. Anything over 25-30 = oversubscription.

### Step-by-step fix
1. If uplink shows packet loss or high latency: ISP issue. Call [@Aegion_ISP] support, give them the public IP at [@Aegion_SITE_2] and a 4h event-log snippet.
2. If uplink is clean but an AP is overloaded: identify the AP, check if a non-work device pulled a huge download (Network-wide → Clients → sort by usage).
3. If it's clearly a single user/device hogging bandwidth: apply traffic shaping at the SSID level (Wireless → Firewall & traffic shaping → set per-client cap on guest SSID).
4. If nothing obvious: failover test — Meraki → Security & SD-WAN → manually fail to secondary uplink if one exists, see if speed recovers.

### ⚠️ Risk warning
Don't reboot the MX during business hours unless you have a confirmed firmware bug — it'll drop everyone for ~90 seconds. Schedule reboots after hours and announce them.

### ✅ Verification checklist
- Meraki dashboard shows uplink throughput/latency back at baseline
- Speed test from a [@Aegion_SITE_2] client matches expected fiber speed
- User from the original ticket confirms speed is normal

### 📝 Jira-ready note
> Resolved [date/time]. Root cause: [@Aegion_ISP] confirmed a fiber-loop fault in the area, resolved at [time]. Meraki dashboard shows uplink back to baseline. Confirmed with reporter at [@Aegion_SITE_2]. No reboot needed. Vendor case: [ISP_CASE_#]. Time spent: ~20 min (mostly waiting on ISP).


---

## Appendix — Daily Ticket Template (moved from CLAUDE.md, v8.3)

When a full Jira ticket is pasted and the operator wants the complete work-up (including a user reply and an escalation point), use this fuller structure instead of the default Response Format:

- **Ticket read** — the issue in plain English
- **Likely cause** — top 1-3 causes
- **First checks** — in order
- **Execution steps** — clear admin steps
- **Escalation point** — when to escalate to MSP, vendor, ISP, or leadership
- **Verification** — how to prove it's resolved
- **User reply** — short message the operator can send to the user
- **Jira note** — clean internal ticket note

The default Response Format (Verdict → checks → fix → risk → verification → Jira note) remains the standard for any IT question; this template is the variant for a pasted raw ticket needing the full package end to end.
