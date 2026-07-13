---
description: Live tracker for the [@Aegion_VOIP] VoIP migration — status by site, pending tasks, vendor coordination, go-live checklist, and rollback plan. Placeholders only.
---

# /unite-migration-status

**Verdict:** The [@Aegion_VOIP] migration is partially complete — Main office is live, [@Aegion_SITE_2] and [@Aegion_SITE_3] are actively in progress, and [@Aegion_SITE_4] status is pending confirmation. The [@Aegion_ALARM] landline-to-internet cutover is a hard dependency at each remaining site and must be coordinated before [@Aegion_ISP] disconnects the landline.

---

## Status by site

| Site | Status | Notes |
|------|--------|-------|
| Main office | ✅ Complete | [@Aegion_VOIP] live. Legacy system decommissioned. |
| [@Aegion_SITE_2] | 🔄 In progress | Cabling and phone provisioning underway. Number porting TBD. |
| [@Aegion_SITE_3] | 🔄 In progress | Cabling and phone provisioning underway. Number porting TBD. |
| [@Aegion_SITE_4] | ⏳ Status TBD | Confirm current phase with [@Aegion_NETPARTNER] / senior IT. |

---

## Pending tasks per site

### [@Aegion_SITE_2]
- [ ] Cabling complete ([@Aegion_NETPARTNER] to confirm sign-off)
- [ ] Desk phones provisioned by MAC in [@Aegion_VOIP] admin portal
- [ ] Extensions and DIDs assigned for all users
- [ ] Number porting submitted to [@Aegion_ISP] (allow 2–4 weeks)
- [ ] Auto-attendant configured and greeting recorded
- [ ] Call routing and hunt groups set up
- [ ] Voicemail-to-email enabled for all users
- [ ] E911 address registered in [@Aegion_VOIP] portal for site address
- [ ] End-to-end test: inbound, outbound, voicemail, call groups
- [ ] [@Aegion_ALARM] internet-based monitoring activated (landline dependency cleared)
- [ ] [@Aegion_ISP] landline disconnect order placed post-cutover

### [@Aegion_SITE_3]
- [ ] Cabling complete ([@Aegion_NETPARTNER] to confirm sign-off)
- [ ] Desk phones provisioned by MAC in [@Aegion_VOIP] admin portal
- [ ] Extensions and DIDs assigned for all users
- [ ] Number porting submitted to [@Aegion_ISP] (allow 2–4 weeks)
- [ ] Auto-attendant configured and greeting recorded
- [ ] Call routing and hunt groups set up
- [ ] Voicemail-to-email enabled for all users
- [ ] E911 address registered in [@Aegion_VOIP] portal for site address
- [ ] End-to-end test: inbound, outbound, voicemail, call groups
- [ ] [@Aegion_ALARM] internet-based monitoring activated (landline dependency cleared)
- [ ] [@Aegion_ISP] landline disconnect order placed post-cutover

### [@Aegion_SITE_4]
- [ ] Confirm migration phase with [@Aegion_NETPARTNER] / senior IT
- [ ] All tasks from [@Aegion_SITE_2] / [@Aegion_SITE_3] list apply once phase is confirmed

---

## Vendor coordination

| Vendor | Role | Action needed |
|--------|------|---------------|
| [@Aegion_NETPARTNER] | Cabling and physical install | Confirm cabling sign-off per site; schedule desk phone placement |
| [@Aegion_VOIP] | Provisioning, DIDs, porting | Provision extensions; submit porting orders; configure auto-attendant |
| [@Aegion_ISP] | Landline disconnect | Do NOT disconnect until [@Aegion_VOIP] is live AND [@Aegion_ALARM] is switched to internet-based |
| [@Aegion_ALARM] | Physical security monitoring | Upgrade from landline to internet-based monitoring — timed to VoIP cutover at each site |

> **Critical dependency:** [@Aegion_ALARM] must switch to internet-based monitoring BEFORE the [@Aegion_ISP] landline is disconnected. Cutting the landline first will leave the alarm system without connectivity. Sequence: [@Aegion_VOIP] live → [@Aegion_ALARM] internet activated → [@Aegion_ISP] landline disconnect order placed.

---

## Go-live checklist (per site)

Run this checklist at each site on cutover day before signing off:

- [ ] All desk phones show **Registered** in [@Aegion_VOIP] admin portal
- [ ] Test inbound call to main site DID — rings correct phone/hunt group
- [ ] Test outbound call from each desk phone — dial tone and two-way audio confirmed
- [ ] Test voicemail — leave message, retrieve by PIN, email notification arrives
- [ ] Auto-attendant plays correct greeting and routes to correct extensions
- [ ] Call groups / hunt groups ring as configured
- [ ] E911 verified — dialing 911 presents correct site address to emergency services
- [ ] [@Aegion_ALARM] internet-based monitoring confirmed active (test with alarm provider)
- [ ] Legacy phone system lines at this site are silent / confirmed inactive
- [ ] Staff informed of new extension numbers (if changed) and voicemail PIN reset completed
- [ ] [@Aegion_ISP] landline disconnect order placed (after all above are green)
- [ ] Jira ticket updated with cutover date and sign-off

---

## Rollback plan

If cutover fails and phones are non-functional:

1. **Do not disconnect the legacy lines** — keep [@Aegion_ISP] landlines active until [@Aegion_VOIP] is confirmed working end-to-end.
2. Re-activate the legacy VoIP system at the affected site — confirm with senior IT for legacy system credentials.
3. Contact [@Aegion_VOIP] support immediately with the site name, affected extension count, and symptoms.
4. Contact [@Aegion_NETPARTNER] if the issue is physical (cabling, PoE, patch panel).
5. Log the rollback event in Jira with timestamp, what was attempted, and what failed.
6. Do not attempt a second cutover until root cause is identified and confirmed fixed.

> [@Aegion_ALARM]: if alarm was switched to internet-based and [@Aegion_VOIP] is down, confirm the alarm has a separate internet path (not dependent on the VoIP VLAN). If the alarm is also offline, contact [@Aegion_ALARM] support immediately.

---

## ✅ Verification checklist

- [ ] [@Aegion_SITE_2]: all phones registered in [@Aegion_VOIP] portal, test calls passing
- [ ] [@Aegion_SITE_3]: all phones registered in [@Aegion_VOIP] portal, test calls passing
- [ ] [@Aegion_SITE_4]: migration phase confirmed and tracked
- [ ] Number porting orders placed and confirmed with [@Aegion_ISP] (track porting dates)
- [ ] [@Aegion_ALARM] internet-based monitoring active at each completed site
- [ ] [@Aegion_ISP] landline disconnect orders filed only after each site's go-live checklist is green
- [ ] All Jira tickets for each site updated with cutover dates and outcomes

---

## 📝 Jira-ready note

> **[@Aegion_VOIP] migration status update — [JIRA-###]**
>
> Main office: complete. [@Aegion_SITE_2]: in progress — cabling [STATUS], phone provisioning [STATUS], number porting [STATUS]. [@Aegion_SITE_3]: in progress — cabling [STATUS], phone provisioning [STATUS], number porting [STATUS]. [@Aegion_SITE_4]: TBD. [@Aegion_ALARM] internet-based upgrade timed to each site cutover — do not disconnect [@Aegion_ISP] landlines until alarm dependency is cleared. Next action: [DESCRIBE_NEXT_STEP]. Updated [DATE].
