# Security and incident response: the lane

> **Execution boundary:** this module is reference and planning text. It does not authorize any change. Aegis advises; a person runs every step, and every change sits behind the gate of the runbook that owns it.

This lane is what Aegis knows about security and incident response: how to notice a compromise inside any ticket, how to size it, who must hear about it and how fast, and how a senior incident responder contains, preserves, communicates and recovers. It is written for tickets nobody has written yet. Every rule is general.

## What it covers

- Recognising a smell of compromise in any ticket, including a plain helpdesk one (judgment rule a in `docs/aegis/answer-format.md` section 2).
- The incident lifecycle and the Incident answer with its SEV-1 to SEV-4 scale (answer-format section 9).
- Identity compromise in Microsoft Entra ID, Okta and Google Workspace.
- Endpoints: Microsoft Defender for Endpoint and Intune, Jamf Pro, Fleet and osquery.
- Cloud: AWS (CloudTrail, GuardDuty, IAM), Azure (activity log, app registrations), Google Cloud (audit logs, service account keys).
- Exposed secrets: cloud keys, GitHub tokens, Slack tokens, API keys in a repository, a chat or a ticket.
- Phishing and business email compromise, including payment fraud.
- Ransomware, the first hour.
- Suspicious OAuth or app grants in Entra, Google and Okta.
- Vulnerability triage: CVSS read with exploitability, the CISA Known Exploited Vulnerabilities catalog, EPSS as a hint, patch windows and compensating controls.
- Evidence preservation and communications.

## How to use these files

| File | Read it when |
|---|---|
| `method.md` | Any security ticket: the senior responder's method, step by step, and the lifecycle mapped onto the Incident answer. |
| `decision-trees.md` | You must choose: is this an incident, which mode, which severity, contain or watch, wipe or not, patch now or this cycle. |
| `escalation.md` | Always, when rule a fires: who is told at each severity, how fast, who decides containment, what they need. |
| `reading-evidence.md` | The ticket carries a log, a header, an alert or a finding: what each field means and what it would take to be wrong. |
| `failure-catalog.md` | A symptom is in front of you: likely causes ranked, the smallest test that splits them, the fix and the rollback. |
| `safe-changes.md` | You are about to advise a containment change: its blast radius, who applies it, the rollback and the stop conditions. |
| `sources.md` | You need the vendor or standards page behind a fact, with the date it was read. |

Vendor menu paths, limits and numbers that the runbooks rely on are in `docs/aegis/batch12/vendor-facts-security.md`, each CONFIRMED or UNCONFIRMED.

## Which answer mode applies

| The ticket's main point | Mode | Example shape |
|---|---|---|
| A security report, an alert, or a smell of compromise | `Mode: Incident answer` | "I typed my password into a page that looked like our sign-in page." |
| A helpdesk ask with a smell inside it | `Mode: Fix card`, with the escalation as one of the steps | "Reset my MFA for my new phone. Also I got three prompts last night I did not start." |
| A vulnerability or hardening question with no sign it was used | `Mode: Engineer answer` | "Is this CVE on our VPN appliance a patch-now?" |
| Cause unclear and the obvious fix weakens a control | `Mode: Ask first` (judgment rule d) | "Please turn off the block on the finance team's uploads." |

Pick in the order of answer-format section 9: Ask first, then Incident, then Engineer, then Fix card. A vulnerability with signs that it was used is an incident, not an Engineer answer.

## The escalation path in one line

Smell of compromise, then name the security escalation (a role, never a person), say what they need (what was seen, when, which account or device, the evidence), contain only what the decider for that action allows, and never call it harmless before security has looked. The full matrix is in `escalation.md`.

## How the runbooks fit

Existing runbooks that this lane routes to (they keep their own gates):

| Runbook | Used for |
|---|---|
| `/security-alert-triage` | Microsoft alerts; Entra session revocation and sign-in block gates. |
| `/incident-report` | The written report after the incident. |
| `/gws-account-containment` | Google account suspend, password, app passwords, OAuth tokens. |
| `/okta-user-lifecycle` | Okta session clear, suspend, password reset. |
| `/okta-mfa-reset` | Okta factor reset and the Temporary Access Code. |
| `/mfa-issue`, `/password-reset` | Entra methods, Temporary Access Pass, password. |
| `/github-security-alerts` | Secret scanning alerts in GitHub (close only after the issuer revoked). |
| `/fleet-device-actions`, `/jamf-lock-erase`, `/device-wipe` | Lock and wipe of a device, after the evidence decision. |
| `/gws-security-posture` | Blocking a third-party app for Google Workspace. |
| `/slack-app-approval`, `/slack-incident-comms` | Restricting a Slack app; drafting incident messages. |

New runbooks of this lane:

| Runbook | Mode it serves | What it adds |
|---|---|---|
| `/incident-triage` | Incident answer | Severity, contain-first decisions with their deciders, escalation, the Incident answer skeleton. No change of its own. |
| `/identity-compromise` | Incident answer | The revocation order across Entra, Okta and Google, and gates for Exchange forwarding and inbox rules. |
| `/leaked-key` | Incident answer | Revoke or rotate first, review use, clean history last; gates for AWS, Google Cloud, Azure, GitHub and Slack credentials. |
| `/phishing-bec` | Incident answer, or Fix card with escalation | Reported phish, a click, a takeover, payment fraud; gates for purge and sender block. |
| `/ransomware-first-hour` | Incident answer | Isolate without powering off, preserve, scope, backups checked before trust; gates for Defender isolation and release. |
| `/oauth-app-review` | Incident answer | Review, revoke and block suspicious app grants; gates for Entra and Okta. |
| `/vuln-triage` | Engineer answer | CVSS with exploitability, KEV, EPSS, patch windows, compensating controls. No change of its own. |
