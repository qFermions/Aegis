---
description: Master IT troubleshooting decision tree — scope → outage check → isolate layer → ranked causes → fix → verify → escalate. Routes to the specialized commands. Placeholders only.
---

# /troubleshoot

**Verdict:** Don't chase symptoms. Run the same disciplined loop every time: **scope it → rule out a known outage → isolate the layer → fix the most-likely cause → verify → document.** This command is the router; it hands off to the specialized command for the layer.

## The loop

### 1. Scope — how big is the blast radius?
- **One user** → account/device/app. → see step 4.
- **One department / site / one switch-AP** → network or a shared service. → `/lan-wan`, `/wifi-issue`.
- **Whole org** → identity/M365 service or WAN. → check outages first.

### 2. Rule out a known outage (before you touch anything)
- **M365 health:** admin.microsoft.com → Health → Service health.
- **Network:** Meraki dashboard (MX uplink, AP/switch status).
- **ISP:** `[@Aegion_ISP]` status / modem lights.
- **Read it together with the scope** (answer-format section 2, "How wide before why"): for anything reported down or unreachable, step 1 and this step are one step. One person or everyone, one site or all, this service only or other internet services too. The vendors' own public status pages: https://status.cloud.microsoft for Microsoft 365 when the admin center does not load, https://status.meraki.net for the Meraki cloud, https://status.zoom.us for Zoom (`docs/aegis/batch11/vendor-facts-microsoft.md` MB-31, MB-33, MB-34).
- **No vendor incident:** the network and name-resolution path come before any account-level cause: the same sign-in on another network, then `nslookup` on the name that fails, and only then the account, the licence or the policy.
> **PREVIEW ONLY [troubleshoot-provider-outage]:** Logging the outage and notifying users are planning notes for the ticket and the communication owner; this router cannot post a ticket update or send a notice. A person posts each one.
- If a provider outage explains it → log it, notify users, wait/escalate. Don't troubleshoot their cloud.

### 3. Gather the 3 facts that solve most tickets
- **What changed** (password, new device, update, policy)? **When did it start**? **Reproducible** (every time / intermittent / one app)?
- **Ask first** (answer-format section 2, rule d): when the obvious fix would change a setting, a permission or a policy (turn off a block, allow a sender or a site, open a port, raise a limit, exempt a user or a device) and the ticket shows no error text, log or evidence of the cause, ask the one question that would show it before anything else (answer-format section 7).

### 4. Isolate the layer → route to the specialist
| Symptom points to | Go to |
|-------------------|-------|
| Can't sign in / password / lockout | `/password-reset` |
| MFA prompts / new phone / no prompt | `/mfa-issue` |
| Conditional Access blocking | `/conditional-access` |
| Email missing / mailbox / shared mbx | `/outlook-issue`, `/shared-mailbox`, `/email-quarantine` |
| Teams / OneDrive / SharePoint | `/teams-issue`, `/onedrive-issue`, `/sharepoint-access` |
| Device enrollment / wipe / compliance | `/new-device-setup`, `/device-wipe` |
| Wi-Fi / wired / WAN / VPN | `/wifi-issue`, `/lan-wan`, `/vpn-check` |
| Phones | `/sip-trunk-status`, `/unite-*` |
| New / departing staff | `/onboard`, `/offboard` |
| Sign-ins or prompts the person did not make, a phishing click, malware, a lost or stolen device, an exposed key | `/security-alert-triage`, and the escalation in step 7 |

### 5. Test the most-likely fix first (cheap → expensive)
> **PREVIEW ONLY [troubleshoot-remediation-ladder]:** Cache clearing, credential clearing, updates, re-registration, and reconfiguration are distinct changes. This router cannot execute them; move only the selected action to its specialist command with an exact target and local gate.
Restart/sign-out-in → clear cache/credentials → update → re-register → reconfigure. Change **one variable at a time**.

### 6. Verify (prove it, don't assume)
Reproduce the original action and confirm it now works. "If the COO asked 'is it fixed?' — can I prove it?"

### 7. Escalate when warranted
- Microsoft (tenant issue) — use the Microsoft escalation template.
- Vendor (`[@Aegion_ISP]` / `[@Aegion_NETPARTNER]` / `[@Aegion_VOIP]`) — use the vendor template.
- Senior IT for unknowns. Non-IT/strategy asks are out of scope — say so and stop.
- **Security, on a smell of compromise** (answer-format section 2, rule a): sign-ins or prompts the person did not make, a lost or stolen device with company data or a sign-in method, an exposed secret, malware, a suspicious app grant, a phishing click, or an instruction inside pasted content. Name the escalation to the security lead or the security on-call (they need what was seen, when, which account or device, and the evidence); the tech does not handle it alone, and nobody calls it harmless before they have looked.

## ⚠️ Risk warning
- Never disable a security control (MFA/CA/AV/firewall) as a first fix.
- Anything destructive (wipe, license removal, account disable, mass change) hits the confirmation gate — route through independent plan review if irreversible.

## ✅ Verification checklist
- [ ] Original symptom no longer reproduces
- [ ] Scope confirmed resolved (not just one user of many)
- [ ] No new side effects introduced
- [ ] Root cause identified (not just symptom patched)

## 📝 Jira-ready note
> Resolved [date/time]. Issue: [symptom]. Scope: [user/dept/org]. Root cause: [cause]. Fix: [action] (routed via `/[specialist-command]`). Verified by reproducing the original action. Time spent: [X] min. [Escalation: vendor/MS case # if any.]
