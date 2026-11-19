# Decision trees

> **Execution boundary:** reference and planning text only. It does not authorize any change. Each tree ends in a decision and the runbook that owns its gate.

Each tree is a short list of questions. Answer them in order and stop at the first one that decides.

## 1. Is this an incident, and which mode?

1. Does the ticket give nothing to go on (no symptom, no error, no who, no since-when), or is its cause unclear while the obvious fix would loosen a control (turn off a block, allow a sender or a site, exempt a user, make someone an admin)?
   If yes: **Ask first**, one question for the one thing that shows the cause (answer-format section 7, rule d). A ticket that also carries a smell is never Ask first: go to question 2.
2. Is the ticket's main point a smell of compromise (method.md, "Smells"), a security alert, or a report of a phish, a leak, a lost device with data, or malware?
   If yes: **Incident answer**. Go to tree 2 for the severity.
3. Is it a helpdesk ask (a reset, a new phone, a locked account, a blocked sign-in) with a smell somewhere inside it?
   If yes: **Fix card**, and one of its steps names the security escalation and what they need. Do not do the routine step that the smell makes unsafe (for example, do not reset MFA for a "new phone" before the unexpected prompts are looked at).
4. Is it a vulnerability, a hardening or a design question with no sign that anything was used?
   If yes: **Engineer answer** (`/vuln-triage`). If the reading finds a sign of use, it becomes an Incident answer.
5. Otherwise: Fix card.

## 2. Which severity?

1. Is data, money or control leaving now, or is the business stopped (encryption spreading, a payment in flight, an attacker acting with admin rights)? **SEV-1.**
2. Is a compromise confirmed for one account, device, key or system (a sign-in the person did not make that succeeded, a rule they did not create, a key used from an unknown address, malware that ran)? **SEV-2.**
3. Is it suspected but with no sign of use (prompts all denied, a click with no password typed, an alert that may be noise)? **SEV-3.**
4. Is it a weakness or an exposure with no sign it was used (a key in a private repository, unused; an unpatched service)? **SEV-4.**

Raise one level for each of: admin rights involved, personal or payment data in reach, more than one account or device, the attacker still active. Lower only on the security lead's word after the "who else, what left" read.

## 3. Contain now, or watch first?

1. Is harm happening now (money moving, data leaving, encryption spreading, an attacker signed in)? Contain now with the lightest step that stops it; the decider is the one in `method.md`, "Contain first". Capture only what takes seconds first.
2. Is the attacker likely to notice and speed up if you contain one piece (a careful intruder with several footholds)? Ask the security lead before you contain: they may want every foothold closed at once. Keep evidence collection going.
3. Is it suspected with no sign of use? Take the light, reversible steps (end sessions, reset the password through a verified channel), preserve, and let security decide the rest.
4. Is it an exposure with no sign of use (a key in a repository)? Revoke or rotate now anyway: the copy is already out (rule c).

## 4. The identity revocation order

For any account that someone else may be using, in Entra, Okta or Google:

1. **Capture** the sign-in and audit logs and the current list of methods, devices, rules and app grants (seconds to minutes; never longer than the decider allows).
2. **End the sessions and tokens** at the identity provider (Entra revoke sessions, Okta clear sessions with tokens, Google sign the user out). When one provider signs the person in to others (Okta to Microsoft 365 or Google), end the sessions downstream too.
3. **Reset the credential** and hand the new one over a verified channel (a call to a number already on file, in person).
4. **Remove what the attacker added:** sign-in methods and devices, mail rules and forwarding, app passwords, app grants, keys and tokens the account created.
5. **Block or suspend** the account if the person cannot be reached, if the attacker comes back, or if the security lead says so.
6. **Give access back with a new way in:** prove who the person is, issue a time-limited pass, the person registers a new method, the old method is removed.
7. **Read who else and what left.**

`/identity-compromise` carries the order and points to each gate.

## 5. Wipe a device, or not?

1. Is the device lost or stolen, holding company data or a sign-in method, and out of reach? Lock it first (`/jamf-lock-erase`, `/fleet-device-actions`, `/device-wipe` for Intune). Wipe only when the security lead decides the data risk outweighs the evidence.
2. Is the device in hand or on the network with malware or ransomware on it? Do not wipe and do not power it off. Isolate it from the network (`/ransomware-first-hour`), let the incident response team collect what they need, then rebuild from a known-good image. The wipe is the last step and the security lead decides it.
3. Is the device leaving the organisation (sale, leaver)? That is not an incident: use the offboarding runbooks.

## 6. Exposed secret: what first?

1. Is it live? If anyone is unsure, treat it as live.
2. Revoke or rotate it at the issuer now (`/leaked-key`). If revoking breaks a production system, the security lead and the system owner decide between "break it now" and "rotate within the hour"; if the key is being used by someone unknown, break it now.
3. Review its use: the issuer's audit log from the time it was exposed (or, when that time is unknown, from the time it was created) until the revocation.
4. Clean the history last: delete the message, rewrite the commit, remove the file. Never first: the copy is already out.

## 7. Phishing: how far did it get?

1. Reported, not opened or not clicked: purge it from every mailbox that got it and block the sender if it is not a real partner (`/phishing-bec`). SEV-3 at most, often less; still tell the security queue.
2. Clicked a link, nothing typed: check the device for an alert and what the link served; SEV-3; escalate.
3. Typed a password or approved a prompt: treat the account as compromised: tree 4, SEV-2 until shown otherwise.
4. Opened an attachment that ran something: treat the device as compromised; isolate it; SEV-2.
5. Changed payment details or sent money: SEV-1; finance calls the bank now on a number they already hold; tree 4 for the mailbox that asked.

## 8. Patch now, or this cycle?

1. Is the vulnerable thing reachable by an attacker (internet-facing, or reachable from user devices) and is the flaw known to be exploited (on the CISA KEV catalog, or the vendor says so)? **Patch now**, as an emergency change; if a patch is not possible today, apply the vendor's mitigation or take the service off the internet; tell the security lead and look for signs of use.
2. Exploited but not reachable, or reachable with a public exploit but not yet seen exploited? **Patch within days**, by the next emergency window the change process allows.
3. Neither, with a high CVSS base score? **This cycle**, in the normal patch window.
4. Low score, not reachable, no exploit? **Next cycle** or accept the risk with the system owner, written down with an end date.

EPSS raises or lowers urgency inside a step; it never moves a KEV item down. `/vuln-triage` has the detail.
