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
- If a provider outage explains it → log it, notify users, wait/escalate. Don't troubleshoot their cloud.

### 3. Gather the 3 facts that solve most tickets
- **What changed** (password, new device, update, policy)? **When did it start**? **Reproducible** (every time / intermittent / one app)?

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

### 5. Test the most-likely fix first (cheap → expensive)
Restart/sign-out-in → clear cache/credentials → update → re-register → reconfigure. Change **one variable at a time**.

### 6. Verify (prove it, don't assume)
Reproduce the original action and confirm it now works. "If the COO asked 'is it fixed?' — can I prove it?"

### 7. Escalate when warranted
- Microsoft (tenant issue) — use the Microsoft escalation template.
- Vendor (`[@Aegion_ISP]` / `[@Aegion_NETPARTNER]` / `[@Aegion_VOIP]`) — use the vendor template.
- Senior IT for unknowns. Cross-domain/strategy → `/ask-hermes`.

## ⚠️ Risk warning
- Never disable a security control (MFA/CA/AV/firewall) as a first fix.
- Anything destructive (wipe, license removal, account disable, mass change) hits the confirmation gate — route through Nova if irreversible.

## ✅ Verification checklist
- [ ] Original symptom no longer reproduces
- [ ] Scope confirmed resolved (not just one user of many)
- [ ] No new side effects introduced
- [ ] Root cause identified (not just symptom patched)

## 📝 Jira-ready note
> Resolved [date/time]. Issue: [symptom]. Scope: [user/dept/org]. Root cause: [cause]. Fix: [action] (routed via `/[specialist-command]`). Verified by reproducing the original action. Time spent: [X] min. [Escalation: vendor/MS case # if any.]
