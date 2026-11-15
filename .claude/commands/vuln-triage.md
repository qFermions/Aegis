---
description: Triage a vulnerability (a CVE in a scanner report, a vendor advisory, a "should we patch this now?") - read the CVSS vector with exploitability, check the CISA Known Exploited Vulnerabilities catalog, use EPSS only as a hint, check reachability, and decide patch now, within days, this cycle or accept with an owner and an end date; name compensating controls when a patch cannot go in. Any sign the flaw was used turns it into an incident. Makes no change; routes patching to the fleet's patch runbooks. Placeholders only.
disable-model-invocation: true
---

# /vuln-triage

> **Execution boundary:** Read-only diagnostics remain available. This runbook makes no change and authorizes none: patching and compensating controls are planning pointers to the runbooks and change processes that own them. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Answer mode:** `Mode: Engineer answer` (answer-format section 9). Evidence read: the CVE record, the vector, KEV and the inventory. Hypotheses: the exposure readings below, ranked, each with its smallest test. Recommendation: the patch window and any compensating control. Blast radius: what the patch or the control touches and its rollback. Verify: the re-scan or version read. Ask next: the one fact still missing. If any sign of exploitation turns up, the answer becomes `Mode: Incident answer` and goes to `/incident-triage`.

**Placeholders:** `[CVE_ID]` · `[APP_NAME]` (the software title) · `[HOST_COUNT]` · `[DEVICE_NAME]` · `[JIRA-###]` or `[ISSUE_ID]` · `[ADMIN_NAME]`.

**Knowledge:** `knowledge/security/decision-trees.md` tree 8, `reading-evidence.md` ("Vulnerability evidence"), `failure-catalog.md` entry 13.

## ⚠️ Admin / safety gate

- **The score is not the decision.** Reachability and known exploitation decide the window; the CVSS number orders items inside it.
- **KEV beats EPSS.** An item on the CISA KEV catalog is never moved down because its EPSS is low.
- **A sign of use is an incident.** An internet-facing system that was vulnerable while the flaw was exploited in the wild is checked for signs of use and the security lead is told, even after the patch.
- **Risk acceptance is the owner's, in writing, with an end date.** IT does not accept risk alone.
- **Patching is a change.** It goes through the fleet's patch runbook and the change process; this runbook makes none.

## Inputs needed

- `[CVE_ID]` and the product and version the scanner or advisory names.
- Where the software runs: which devices or servers, and whether any is reachable from the internet or from user devices.
- The organisation's patch windows **[org gap: the emergency window and the normal cycle]**; the defaults below apply until they are known.

## Fast path

1. Phase A: read the CVE, the vector, KEV, EPSS and the vendor advisory (R0).
2. Phase B: read the exposure: installed, which version, running, reachable (R0).
3. Phase C: decide the window.
4. Phase D: compensating controls when the patch cannot go in that window.
5. Phase E: look for signs of use when the flaw is exploited in the wild and the system was reachable.

## Phase A: Read the vulnerability (R0)

1. The CVE record and its vector (`[CVE_ID]` on nvd.nist.gov; cite the page with its date when fetched).
2. The CISA KEV catalog: is `[CVE_ID]` listed, its date added, its due date, and whether it is known to be used in ransomware (SV-27, SV-28).
3. EPSS, as a hint about how likely exploitation is soon [unconfirmed: first.org is not on the lookup allowlist].
4. The vendor's own advisory: the fixed version, the workaround, and the vendor's score for your version.

How to read the vector: AV:N (network) with PR:N (no privileges) and UI:N (no user action) means anyone who can reach it can use it; AV:L or AV:P needs a foothold or hands on the device; S:C means the impact crosses into other components. CVSS describes severity, not your risk [unconfirmed: check nvd.nist.gov].

## Phase B: Read the exposure (R0)

1. Fleet → Software → Vulnerabilities, filtered to `[CVE_ID]`: the hosts and versions (`/fleet-vulnerable-software` for the full read); Jamf Pro patch reporting for Macs (`/jamf-patch-management`); the Microsoft or other endpoint tool the organisation runs for Windows.
2. On one host, read the component: present, which version, running, listening, reachable from where.
3. Write in the ticket: `[HOST_COUNT]` hosts, how many internet-facing, how many reachable from user devices.

| Exposure reading (hypotheses, ranked) | Smallest test |
|---|---|
| 1. Installed, vulnerable version, reachable | The version read and a reachability check from where an attacker would be |
| 2. Installed but not running or not reachable | The service state and the firewall or listener read on one host |
| 3. The scanner matched a version string that is not the vulnerable component | The vendor's affected-product list against the component read |
| 4. Already fixed, not yet re-scanned | The installed version against the vendor's fixed version |

## Phase C: Decide the window

| Condition | Window | Default until the organisation sets its own |
|---|---|---|
| On KEV (or the vendor says exploited) and reachable | Patch now | An emergency change within 24 to 72 hours; mitigate or take it off the internet the same day if the patch must wait |
| Exploited but not reachable, or reachable with a public exploit and no exploitation seen | Within days | The next emergency window |
| High base score, no exploit, reachable only inside | This cycle | The normal monthly patch window |
| Low score, not reachable, no exploit | Next cycle or accept | Accepted by the system owner in writing, with an end date |

KEV's due date is a deadline for the agencies the catalog's directive binds; for everyone else it is a strong hint, not the window (SV-28).

## Phase D: Compensating controls (planning only)

> **PREVIEW ONLY [vuln-triage-compensating-control-preview]:** Planning only; this runbook does not authorize any change. When a patch cannot go in the window, the system owner and the security lead pick a control under the change process: take the service off the internet, limit who can reach its admin interface, turn off the vulnerable feature, apply the vendor's workaround, or add a filtering rule in front of it; each with an owner, an end date, and the patch still scheduled.

## Phase E: Look for signs of use

When the flaw is on KEV or the vendor says it is exploited, and a host was reachable while it was vulnerable:

- Read that host's logs and the vendor's indicators of compromise for the window since the flaw was published.
- Tell the security lead. Any indicator found: `/incident-triage`, SEV-2 or higher, and the patch alone is not the fix.

## ⚠️ Risk warning

- **A 9.8 that nobody can reach is not your first fix;** a 7.5 on KEV facing the internet is.
- **Patching an exploited system does not evict an attacker** who got in before the patch.
- **Compensating controls expire quietly.** Each has an owner and an end date.
- **Scanner counts mislead.** Read one host before you report hundreds.

## ✅ Verification checklist

- [ ] The vector, KEV status, EPSS (as a hint) and the vendor advisory are in the ticket, each with its source and date.
- [ ] The exposure reading is done on at least one host, with `[HOST_COUNT]` and the internet-facing count.
- [ ] The window is decided, with the reason.
- [ ] Any compensating control has an owner and an end date.
- [ ] For an exploited flaw on a reachable host, the signs-of-use read is done or handed to the security lead.

## 📝 Jira-ready note

> [Vulnerability triage] `[JIRA-###]`: `[CVE_ID]` in `[APP_NAME]`. Vector (vector). KEV: (listed, date added, due date / not listed). EPSS (value, as a hint, date read). Vendor fix: (version). Exposure: `[HOST_COUNT]` hosts, (n) internet-facing, read on `[DEVICE_NAME]`: (finding). Decision: (patch now / within days / this cycle / accept until (date) by (owner)). Compensating control: (control, owner, end date / none). Signs of use: (none found / handed to the security lead / incident (ticket)). By [ADMIN_NAME]. Time spent: [X] min.

Post it with `/jira-update` on `[JIRA-###]`; for a Linear ticket, `/linear-ticket-note` on `[ISSUE_ID]`.

## Aha moment

Prioritising by CVSS alone puts the noisiest number first. Exploitation in the wild and reachability tell you what an attacker will actually use.

## Career upgrade

Risk-based vulnerability management (KEV, exploitability, reachability, compensating controls) is how security engineers cut a thousand findings down to the ten that matter this week.

## Next action

Read `[CVE_ID]` on the KEV catalog and the vendor advisory, then read one affected host.

**Sources (read 2026-11-14, `docs/aegis/batch12/vendor-facts-security.md`):** www.cisa.gov/known-exploited-vulnerabilities-catalog (SV-27, SV-28). CVSS (SV-61) and EPSS (SV-62) facts are UNCONFIRMED.
