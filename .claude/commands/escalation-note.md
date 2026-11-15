---
description: Draft a sanitized vendor, Microsoft, or internal escalation note with impact, evidence, and requested action.
---

IMPORTANT: Do NOT ask for employee details, names, emails, departments, or any identifying info. Deliver the FULL procedure IMMEDIATELY using only placeholders like [FIRST_NAME], [UPN], [DEVICE_NAME], [DEPARTMENT]. The user will substitute real values themselves.

Draft a vendor or Microsoft escalation note for [@Aegion] IT. Ask me what vendor and what the issue is. Never ask for employee details.

---

## Escalation Note — Draft

**Ask me:**
1. Which vendor or team are you escalating to? ([VOIP_PARTNER], [@Aegion_VOIP], [SECURITY_VENDOR], [ISP_VENDOR], Microsoft Support, Cisco/Meraki)
2. What is the issue? (brief description)
3. How long has this been happening?
4. What's the business impact? (X users down, site offline, etc.)
5. Do you have a case/ticket number?

---

**Vendor escalation template:**
> We are experiencing [issue] affecting [X users/sites] since [date]. We need Tier 2 escalation. Case: [#]. Please confirm resolution timeline and assign a senior technician.

**Microsoft escalation template:**
> Tenant: [@Aegion_DOMAIN]
> Admin UPN: [USER@DOMAIN.COM]
> Issue: [description]
> Impact: [X users / X sites affected]
> Started: [date/time]
> Steps already tried: [list]
> We require escalation to Tier 2 engineering. Please confirm SLA and next steps.

**Internal escalation (to senior IT):**
> Hi [Name], working on a ticket and want to check before I proceed.
> Situation: [what's happening]
> What I've done: [steps taken]
> Where I'm stuck: [specific question]
> Do you want me to handle this or should I loop you in?

**Security escalation (to the security lead, the security on-call or the incident response team; answer-format section 2, rule a):**
> Possible compromise: [what was seen]
> First seen: [date/time] · Reported: [date/time]
> Account or device: [UPN] / [DEVICE_NAME]
> Evidence: [sign-in log entries / the message with its headers / the alert ID], kept at [location]
> Done so far: [steps, or none]. Nothing deleted, wiped or reset beyond what is listed.
> Please confirm who owns this and the next step.

Tell me the vendor and situation and I'll write the full escalation.
