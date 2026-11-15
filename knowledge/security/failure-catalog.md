# Failure catalog

> **Execution boundary:** reference and planning text only. It does not authorize any change. Each "fix" names the runbook whose gate a person runs.

Each entry: the symptom as people report it, the likely causes ranked most likely first, the smallest test that tells them apart, the fix, and the rollback. Every entry with a possible compromise also names the escalation (judgment rule a).

## 1. "I keep getting sign-in prompts I did not start"

- **Likely causes:** (1) someone has the password and is trying to get past MFA by repeated prompts (ATT&CK T1621); (2) an old device or app of the person's own retrying with a stale password; (3) a sync or mail client on a new phone set up halfway.
- **Smallest test:** the identity provider's sign-in log for the prompts' source: an address, place and client the person does not use means cause 1; the person's own device and app means 2 or 3.
- **Fix:** cause 1 is SEV-3 (all denied) or SEV-2 (one approved): escalate to the security on-call, then `/identity-compromise` (end sessions, reset the password over a verified channel, check for a new method). Causes 2 and 3: update or remove the stale app on the person's device. Never reset MFA "for the new phone" before the log is read.
- **Rollback:** none needed for a session end; a password reset is replaced by another reset.

## 2. A sign-in from a country the person was not in

- **Likely causes:** (1) the person on a VPN or a mobile network whose address maps far away; (2) a stolen password or session used from elsewhere; (3) a travel day the ticket did not mention.
- **Smallest test:** the sign-in's client app, device and authentication details: the person's managed device and the usual app point to 1; an unmanaged device, a new browser or legacy authentication points to 2. Ask the person on a verified channel only after the log read.
- **Fix:** 1 or 3: note it, no change. 2: SEV-2, escalate, `/identity-compromise`.
- **Rollback:** none.

## 3. "People got an email from me that I did not send"

- **Likely causes:** (1) the mailbox is taken over and sending from inside; (2) someone spoofs the person's address from outside; (3) a lookalike domain.
- **Smallest test:** the person's Sent Items and the message trace: a copy sent from the mailbox means 1; no trace from the tenant and failed SPF, DKIM or DMARC on a recipient's copy means 2; a different domain in the From means 3.
- **Fix:** 1: SEV-2, escalate, `/identity-compromise` (rules, forwarding, sessions, password), then `/phishing-bec` for the recipients. 2 or 3: `/phishing-bec` (warn recipients, block the lookalike, check the organisation's own DMARC policy).
- **Rollback:** a sender block is removed from the block list; a purge is moved back by the remediation's "move to inbox".

## 4. An outside forwarding address on a mailbox

- **Likely causes:** (1) an attacker's persistence after a takeover; (2) the person forwarding to a personal address against policy; (3) a business process (a ticket system, an assistant) set up long ago.
- **Smallest test:** when it was created and by whom (the audit log), and the sign-ins around that time: a creation from an unknown address means 1.
- **Fix:** capture the setting, then turn it off (`/identity-compromise`, forwarding gate). 1: SEV-2, escalate, full revocation order. 2: tell the person's manager and the security lead; no blame in the ticket. 3: move it to an approved route with the outbound policy owner.
- **Rollback:** turn forwarding back on to the recorded address, only if the review shows it was legitimate.

## 5. A key or token found in a repository, chat or ticket

- **Likely causes:** (1) a live credential committed or pasted by mistake; (2) a test or example value; (3) a credential that was already rotated.
- **Smallest test:** the issuer's console: is the credential listed and active, and when was it last used? Unsure means live.
- **Fix:** live: escalate to the security on-call, revoke or rotate first (`/leaked-key`), review its use from the exposure time, clean the history last. Test value: the owner says so in writing; the alert closes as "used in tests" only if it reaches nothing real (`/github-security-alerts`).
- **Rollback:** a deactivated AWS key can be activated again; a disabled Google Cloud key can be enabled again; a deleted secret cannot come back, so a replacement is issued.

## 6. A cloud bill jumps, or instances appear in a Region nobody uses

- **Likely causes:** (1) a leaked key used for mining; (2) a misconfigured autoscaling or a forgotten test; (3) a real new workload.
- **Smallest test:** CloudTrail (or the activity log, or Admin Activity logs) for who created the resources: an unknown address or a key from a developer's machine at an odd hour means 1.
- **Fix:** 1: SEV-2 (SEV-1 if data access is shown), escalate, `/leaked-key` for the key, then the cloud team stops the resources after the evidence is captured.
- **Rollback:** a stopped instance can be started; a terminated one cannot, so stop, do not terminate, until security says.

## 7. "Defender says the malware was remediated, so we are fine"

- **Likely causes:** (1) the file was quarantined but something else already ran; (2) it really was stopped at the door; (3) a false positive.
- **Smallest test:** the alert's process tree and device timeline: a child process, a network connection or a new persistence item after the file arrived means 1.
- **Fix:** 1: SEV-2, escalate, isolate (`/ransomware-first-hour`, isolation gate), let the incident response team decide the rebuild. 2: note it. 3: the security team tunes the detection; IT does not add an exclusion on its own.
- **Rollback:** release from isolation once the responder clears the device; isolation lifts by itself after seven days, so re-check before then.

## 8. Files renamed with a new extension, or a ransom note

- **Likely causes:** (1) ransomware running on a device or against a share; (2) a sync tool renaming conflicts; (3) a user's own archive tool.
- **Smallest test:** is there a note file, are many files changing per minute, and on which device or account do the changes come from?
- **Fix:** 1: SEV-1, phone the security on-call now, `/ransomware-first-hour`: isolate, do not power off, preserve, scope, protect backups.
- **Rollback:** isolation is released by the responder; recovery is from checked backups to a safe place first.

## 9. An app nobody recognises has access to mail or files

- **Likely causes:** (1) an illicit consent grant from a phishing link; (2) a real tool a team adopted without review; (3) a vendor's integration added by an admin.
- **Smallest test:** the consent audit event (who consented, when, from where) and the app's publisher and scopes: consent from an unknown address or a publisher nobody knows means 1.
- **Fix:** 1: SEV-2, escalate, `/oauth-app-review` (disable the app, remove the grants); a password reset alone does not stop it, because the app holds its own grant. 2 and 3: the app's owner asks for it through the normal approval.
- **Rollback:** sign-in for the app turned back on, only after review.

## 10. A supplier asks to change their bank details

- **Likely causes:** (1) business email compromise, from the supplier's taken-over mailbox or a lookalike domain; (2) a real change.
- **Smallest test:** call the supplier on a number already held (the contract, the old invoices), never one in the message.
- **Fix:** 1: hold the change, tell the finance lead and the security on-call; if money already went, SEV-1 and finance calls their bank now (`/phishing-bec`). 2: finance follows its change process.
- **Rollback:** none for money sent; speed with the bank is the only remedy.

## 11. A lost or stolen laptop or phone

- **Likely causes:** (1) lost, will turn up; (2) stolen for the hardware; (3) stolen for the data or the sign-in method on it.
- **Smallest test:** what is on it (company data, a sign-in app, a password manager) and whether it is encrypted and managed.
- **Fix:** any company data or sign-in method: escalate to the security queue (on-call if it held admin access), end the person's sessions, remove the device's sign-in method after a new way in is given, lock it (`/jamf-lock-erase`, `/fleet-device-actions`, `/device-wipe`); wipe only on the security lead's decision.
- **Rollback:** a lock is undone with its PIN; a wipe is not undone.

## 12. Sessions were revoked but the attacker is still active

- **Likely causes:** (1) an access token still valid (Entra access tokens last one hour by default); (2) an app's own session, which the identity provider cannot revoke; (3) persistence: a new method, an app password, an app grant, a forwarding rule, a second key; (4) another compromised account; (5) a federated identity provider (Okta signing in to Microsoft 365 or Google) where only one side was revoked.
- **Smallest test:** the newest activity's client, app and credential type: an app grant or app password points to 3; a different account to 4; activity right after the revocation that stops within the hour points to 1.
- **Fix:** work the whole revocation order (`decision-trees.md`, tree 4) on every provider in the chain; block the account if it keeps happening; escalate if it was not already.
- **Rollback:** unblock only on the security lead's word.

## 13. A critical CVE shows up on hundreds of devices

- **Likely causes:** (1) a real exposure across a common component; (2) a scanner matching a version string on a component that is not installed or not reachable; (3) a fix already applied but not yet re-scanned.
- **Smallest test:** one device: is the component present, which version, is it running and reachable?
- **Fix:** read KEV and the vendor advisory (`/vuln-triage`); patch through the fleet's patch runbook (`/fleet-vulnerable-software`, `/jamf-patch-management`) in the window the decision tree gives.
- **Rollback:** the patch runbook's own rollback.
