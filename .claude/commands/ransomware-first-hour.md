---
description: Ransomware or destructive malware, the first hour - phone the security on-call and declare SEV-1, isolate affected devices without powering them off (Defender for Endpoint isolation, R2, and its release, R1), preserve, scope, protect the backups and check them before any restore, and run the communications on a channel the attacker cannot read. Leadership and legal decide anything about the attacker; IT never does. Placeholders only.
disable-model-invocation: true
---

# /ransomware-first-hour

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Answer mode:** `Mode: Incident answer`. SEV-1 when encryption is spreading, a shared drive or a server is hit, or the business is stopped; SEV-2 for one device caught before it touched anything shared, until the scope read says otherwise.

**Placeholders:** `[DEVICE_NAME]` · `[UPN]` · `[JIRA-###]` or `[ISSUE_ID]` · `[ADMIN_NAME]`.

**Knowledge:** `knowledge/security/method.md` (contain, preserve, communicate), `decision-trees.md` tree 5 (wipe or not), `escalation.md` (SEV-1 row).

## ⚠️ Admin / safety gate

- **Isolate, do not power off.** CISA's checklist: determine which systems were impacted and immediately isolate them; power down only when a device cannot be disconnected, because that loses the evidence in memory (SV-29).
- **Phone first.** A SEV-1 goes to the security on-call by phone, then leadership. A ticket alone is not an escalation.
- **Nothing about the attacker is IT's decision.** Paying, negotiating, or answering the note belongs to leadership with legal.
- **No restore before the backups are checked.** A backup taken after the attacker arrived can bring them back (judgment rule c).
- **The attacker may read mail and chat.** Coordinate by phone or a channel the security lead names.
- **Each change has its own exact phrase**; urgency never replaces it (SR-2).

## Inputs needed

- Which device or share showed it first, and when (UTC); a photo of the note on screen if there is one.
- Whether the organisation has Defender for Endpoint on the devices, and who the network team is **[org gap: the network on-call]**.
- Where the backups are, who runs them, and whether a copy is offline or cannot be changed **[org gap]**.
- The cyber insurer's breach line and whether it must be called first **[org gap]**.

## Fast path (the first hour)

1. Minutes 0 to 10: phone the security on-call; declare SEV-1; the security lead takes command; start the timeline.
2. Minutes 10 to 20: isolate the affected devices (Phase B); do not power them off.
3. Minutes 20 to 40: preserve and scope (Phases C and D).
4. Minutes 40 to 60: protect the backups and run the communications (Phases E and F).

## Phase A: Declare it (R0)

1. Phone the security on-call. Say: what was seen (renamed files, a note, many files changing), where (`[DEVICE_NAME]`, which share or server), when first seen (UTC), what was done.
2. Ask the person at the device to leave it on, unplug its network cable or turn off its Wi-Fi if they can, and not to log off or restart.
3. Start the timeline: every action, its time (UTC) and who did it.

## Phase B: Isolate without powering off

**Who decides:** the security lead or on-call. **Role needed:** at least the Active remediation actions role in Defender, with access to the device's group (SV-79).

<!-- SAFETY GATE [ransomware-first-hour-isolate-portal] -->
- **Target:** [DEVICE_NAME]
- **Effect:** isolate one device, [DEVICE_NAME], from the network
- **Scope:** one device loses its network connections except to the Defender for Endpoint service, which keeps monitoring it (SV-54); a Hyper-V host's guest machines lose their network too; a device behind a full VPN tunnel may lose the Defender service as well
- **Reversibility:** R2 (CLAUDE.md, Risk-Classified Execution Policy: one object, but the person loses the device until release): undo is [ransomware-first-hour-release-portal]; isolation lifts by itself after seven days (SV-54)
- **Required confirmation:** Type exactly `ISOLATE DEVICE [DEVICE_NAME] FROM THE NETWORK`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no connector reads Defender: the proof is the device page showing isolated and the Action center entry)
**PORTAL ACTION [ransomware-first-hour-isolate-portal]:** Only after the security lead's decision and the exact match:
1. Microsoft Defender portal → Assets → Devices → `[DEVICE_NAME]` → the response actions at the top of the device page → Isolate device [unconfirmed: check the vendor page for the Assets menu path] (SV-78).
2. Type a comment with `[JIRA-###]` and confirm (SV-79).
3. Read back: the device page shows the device isolated and its button reads Release from isolation (SV-78). An offline device is retried for up to three days; if it stays offline, isolate again when it reappears (SV-78).

**Stop if:** the device is a server whose outage the security lead has not approved; the device name on screen differs from the ticket.

**Devices Defender does not cover (a Mac in Jamf, a host in Fleet, a server without the agent):**

> **PREVIEW ONLY [ransomware-first-hour-network-isolation-preview]:** Planning only; this runbook does not authorize it. The network team cuts the device off at the network (its switch port, its Wi-Fi access, its VPN access) under the security lead's decision and their own change process. A remote screen lock (`/jamf-lock-erase`, `/fleet-device-actions`) stops the person, not the malware; an erase destroys the evidence and waits for the incident response team (tree 5).

## Phase C: Preserve

- A photo of the note and the screen; the note file and one encrypted sample file, copied by the incident response team, never opened on a clean machine.
- The device's Defender alert story and timeline; an investigation package when the responder asks for it (it holds the device's state: processes, connections, persistence, SV-55).
- Sign-in and audit logs for the accounts used on the device and on the hit shares.
- Keep the device running and isolated: memory holds evidence a power-off destroys (SV-29).

## Phase D: Scope

1. Which devices show the same alert, file names or note (Defender, the endpoint tool, the file server's recent changes).
2. Which accounts touched the encrypted files: an account encrypting a share from many devices is compromised; an admin account is the worst case. Blocking accounts is the security lead's decision (`/identity-compromise` Phase E).
3. Whether anything left: large uploads, new outbound connections, a new cloud storage app. Ransomware groups often copy before they encrypt.

## Phase E: Protect the backups

1. Confirm a copy exists that the attacker cannot reach: offline, or one that cannot be changed or deleted before its date.
2. Restrict the backup console to the people the security lead names; change its admin credentials from a clean device.
3. Do not mount, browse or restore a backup on the infected network.
4. Before any restore, the incident response team confirms the backup predates the attacker's arrival; restore to an isolated place first, check it, then return systems in the order of the business's critical services (SV-75).

## Phase F: Communications

- **Leadership:** what is stopped, what is at risk, the decision needed (shut a site or a service down; call the insurer; call outside responders).
- **Legal or privacy:** data may have been copied before encryption.
- **The insurer:** per the policy, often before outside responders are hired.
- **Law enforcement:** leadership and legal decide; CISA's checklist advises consulting federal law enforcement about possible decryptors even when recovery is possible (SV-74).
- **Staff:** only what the security lead approves, by phone or a channel outside the hit systems.
- **The reporter:** thanks; leave the device on and do not log off; the security team has it. No blame.

## Phase G: Release from isolation (R1, only on the responder's word)

**Who decides:** the incident response team clears the device, the security lead decides. Normally the device is rebuilt from a known-good image instead.

<!-- SAFETY GATE [ransomware-first-hour-release-portal] -->
- **Target:** [DEVICE_NAME]
- **Effect:** release one device, [DEVICE_NAME], from isolation
- **Scope:** one device rejoins the network
- **Reversibility:** R1: undo is [ransomware-first-hour-isolate-portal] again
- **Required confirmation:** Type exactly `RELEASE DEVICE [DEVICE_NAME] FROM ISOLATION`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [ransomware-first-hour-release-portal]:** Only after the responder's written clearance and the exact match:
1. Microsoft Defender portal → Assets → Devices → `[DEVICE_NAME]` → Release from isolation [unconfirmed: check the vendor page for the Assets menu path] (SV-78).
2. Read back: the device page no longer shows it isolated.

## ⚠️ Risk warning

- **A power-off destroys memory evidence.** Isolate instead; power down only when the device cannot be disconnected (SV-29).
- **Isolation lifts after seven days.** Re-check every isolated device before then (SV-54).
- **A restore from a poisoned backup brings the attacker back.** Check before trust, restore to an isolated place first.
- **The attacker may be watching mail and chat.** Use the phone.

## ✅ Verification checklist

- [ ] Security on-call phoned and SEV-1 declared, with the time.
- [ ] Every affected device isolated (read back) and none powered off.
- [ ] Evidence listed in Phase C captured, with the chain of custody.
- [ ] Scope written: devices, shares, accounts, signs of copying.
- [ ] A backup copy confirmed out of the attacker's reach; no restore before the responder's check.
- [ ] Leadership, legal and the insurer told, as the policy and the security lead require.

## 📝 Jira-ready note

> [Ransomware, first hour] `[JIRA-###]`: first seen on `[DEVICE_NAME]` (share / server) at (UTC). SEV-(n). Security on-call phoned at (UTC); the security lead in command. Isolated (devices, times, read back); none powered off. Preserved: (list, where kept). Scope so far: (devices, shares, accounts, signs of copying). Backups: (offline or unchangeable copy confirmed / not yet). Told: leadership (UTC), legal (UTC), insurer (UTC), law enforcement (decision). Next owner: (role); next step: (one line). Time spent: [X] min.

Post it with `/jira-update` on `[JIRA-###]`; for a Linear ticket, `/linear-ticket-note` on `[ISSUE_ID]`.

## Aha moment

The instinct is to pull the plug. The right move is to cut the network and leave the power on: the spread stops, and the evidence of how it got in stays in memory.

## Career upgrade

Running the first hour of a ransomware incident, calmly and in the right order, is what incident commanders are hired for.

## Next action

Phone the security on-call, then isolate the first device without powering it off.

**Sources (read 2026-11-14, `docs/aegis/batch12/vendor-facts-security.md`):** www.cisa.gov/stopransomware/ransomware-guide (SV-29) · learn.microsoft.com/en-us/defender-endpoint/respond-machine-alerts (SV-54, SV-55).
