---
description: A key, token or secret was exposed (a repository, a chat, a ticket, a document, a paste site) - escalate, revoke or rotate it at the issuer first, review its use second, clean the history last. Gates for an AWS access key (deactivate R1, delete R3 after review), an AWS role's active sessions (R2), a Google Cloud service account key (disable R1, CLI only), an Azure app client secret (delete R3), a fine-grained GitHub token's organization access (R2) and a Slack app's tokens (R2). Placeholders only; a secret's value never appears.
disable-model-invocation: true
---

# /leaked-key

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders. Never ask for, copy or repeat the secret's value: refer to it by its ID, its type and where it was seen.

**Answer mode:** `Mode: Incident answer`. An exposure with no sign of use is SEV-4 (SEV-3 when the place it was exposed is public or shared outside the organisation); any unexplained use makes it SEV-2, and SEV-1 when data or money is leaving.

**Placeholders:** `[CREDENTIAL_ID]` (the key or token's ID, never its value) · `[CLOUD_PRINCIPAL]` (the IAM user or role, the Azure app registration, the Google Cloud service account) · `[CLOUD_ACCOUNT_ID]` (the AWS account, Azure subscription or Google Cloud project) · `[GITHUB_USER]`, `[@Aegion_GITHUB_ORG]`, `[REPO_NAME]` · `[APP_NAME]`, `[APP_ID]` (a Slack app) · `[FILE_NAME]` · `[JIRA-###]` or `[ISSUE_ID]` · `[ADMIN_NAME]`.

**Knowledge:** `knowledge/security/decision-trees.md` tree 6, `reading-evidence.md` (CloudTrail, GuardDuty, the Azure activity log, Google Cloud audit logs), `escalation.md`.

## ⚠️ Admin / safety gate

- **Revoke or rotate first, review use second, clean history last** (judgment rule c). Deleting the message, the commit or the file first changes nothing: the secret is already copied.
- **Escalate now.** Tell the security on-call: the credential's type and ID, where it was exposed, when, who could see it, and whether it is known to be in use.
- **Unsure means live.** A "test" key that reaches anything real is a live secret.
- **Who decides:** the credential's owner and the security lead decide together whether to break the systems that use it now or to rotate within the hour; the security lead alone decides when it is being used by someone unknown.
- **Never paste the value** into a ticket, a chat, a shell or a note, not even to check it still works.

## Inputs needed

- The credential's type and issuer (AWS, Azure, Google Cloud, GitHub, Slack, another vendor), its ID, and its owner **[org gap: the owner list for service credentials]**.
- Where it was exposed (a public or private repository, a channel and whether it is shared outside, a ticket, a document) and the time it was exposed, or "unknown".
- What uses it (an app, a pipeline, a person's machine), so the replacement goes there.

## Fast path

1. Phase A: triage the exposure and escalate (R0).
2. Phase B: revoke or rotate at the issuer, per platform.
3. Phase C: review its use from the exposure time (or the creation time, when that is unknown) to the revocation (R0).
4. Phase D: clean the history (last, planning only here).
5. Phase E: delete what was only deactivated, after the review.

## Phase A: Triage and escalate (R0)

1. Identify the issuer and the credential's ID from where it was seen, without copying the value. For an AWS key, an ID starting with AKIA is a long-term key of an IAM user; ASIA is a temporary STS key that cannot be managed in the console (SV-04): go to B2 for it.
2. Find the credential in its issuer's console, read-only:
   - AWS: AWS console → IAM → Users → `[CLOUD_PRINCIPAL]` → Security credentials → Access keys: the key's status and last use (SV-03).
   - Azure: Microsoft Entra admin center → Entra ID → App registrations → `[CLOUD_PRINCIPAL]` → Certificates & secrets → Client secrets (SV-67).
   - GitHub: github.com → `[@Aegion_GITHUB_ORG]` → Settings → Personal access tokens → Active tokens (SV-49).
   - Google Cloud and Slack: the reads in Phase C.
3. Write in the ticket: type, issuer, ID, owner, where exposed, when, who could see it, active or not.
4. Escalate to the security on-call with that hand-over.

**Stop if:** the issuer shows the credential already revoked and its use already reviewed: go to Phase D.

## Phase B: Revoke or rotate at the issuer

### B1: AWS access key: deactivate (R1)

**Role needed:** an IAM administrator in `[CLOUD_ACCOUNT_ID]`, with the key's owner told.

<!-- SAFETY GATE [leaked-key-aws-key-deactivate-portal] -->
- **Target:** [CREDENTIAL_ID] of IAM user [CLOUD_PRINCIPAL] in [CLOUD_ACCOUNT_ID]
- **Effect:** deactivate one AWS access key, [CREDENTIAL_ID], of [CLOUD_PRINCIPAL]
- **Scope:** one access key; the user's other key, console password and roles are not touched; every system that signs with this key fails
- **Reversibility:** R1: undo is activating the same key again in the same place (SV-02), only if the review shows no unknown use
- **Required confirmation:** Type exactly `DEACTIVATE AWS ACCESS KEY [CREDENTIAL_ID] OF [CLOUD_PRINCIPAL] IN [CLOUD_ACCOUNT_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [leaked-key-aws-key-deactivate-portal]:** Only after the escalation and the exact match:
1. AWS console → IAM → Users → `[CLOUD_PRINCIPAL]` → Security credentials → Access keys → the Actions menu of `[CREDENTIAL_ID]` → Deactivate, then confirm in the dialog (SV-01).
2. Read back: the Access keys section shows `[CREDENTIAL_ID]` as Inactive.

**Stop if:** the key ID on screen differs from `[CREDENTIAL_ID]`; the user has a second key nobody recognises (the attacker may have made it: deactivate it under its own run of this gate and escalate).

### B2: AWS role with temporary credentials: revoke active sessions (R2)

For an ASIA key, or a role whose session was exposed. It denies every current user of the role, not only the attacker (SV-47); keys made by IAM users are not affected (SV-48).

**Role needed:** an IAM administrator with permission to put a role policy, with the security lead's decision.

<!-- SAFETY GATE [leaked-key-aws-role-sessions-revoke-portal] -->
- **Target:** role [CLOUD_PRINCIPAL] in [CLOUD_ACCOUNT_ID]
- **Effect:** revoke every active session of the role [CLOUD_PRINCIPAL] issued before now
- **Scope:** every current user of the role is denied until they assume it again; new sessions work; a service-linked role cannot be revoked (SV-76)
- **Reversibility:** R2 (one object, no undo command: the deny policy stays on the role and only blocks sessions issued before its time stamp)
- **Required confirmation:** Type exactly `REVOKE ALL ACTIVE SESSIONS OF ROLE [CLOUD_PRINCIPAL] IN [CLOUD_ACCOUNT_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no connector reads AWS: the proof is the role's permissions tab showing the AWSRevokeOlderSessions policy)
**PORTAL ACTION [leaked-key-aws-role-sessions-revoke-portal]:** Only after the security lead's decision is in the ticket and the exact match:
1. AWS console → IAM → Roles → `[CLOUD_PRINCIPAL]` → the Revoke sessions tab → Revoke active sessions; tick the acknowledgement and confirm (SV-47).
2. Read back: the role's permissions list the inline policy AWSRevokeOlderSessions (SV-47).

**Stop if:** the role was made from an IAM Identity Center permission set (revoke the session in Identity Center instead, SV-76).

### B3: Google Cloud service account key: disable (R1, CLI only)

The Google Cloud console cannot disable a key (SV-45); the CLI can, and the key can be enabled again (SV-45).

<details>
<summary>gcloud: disable one key (HUMAN-RUN, the administrator's own terminal)</summary>

```bash
# HUMAN-RUN: a Google Cloud IAM administrator runs this in their own terminal, Aegis never does
# SAFETY GATE [leaked-key-gcp-key-disable]
# Target: [CREDENTIAL_ID] of service account [CLOUD_PRINCIPAL] in [CLOUD_ACCOUNT_ID]
# Effect: disable one service account key, [CREDENTIAL_ID], of [CLOUD_PRINCIPAL]
# Scope: one key, the service account and its other keys keep working
# Reversibility: R1: undo is enabling the same key again with the same tool
# Required confirmation: type exactly "DISABLE SERVICE ACCOUNT KEY [CREDENTIAL_ID] OF [CLOUD_PRINCIPAL] IN [CLOUD_ACCOUNT_ID]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# Read-back: none, R1: no change record
# the exact phrase to type
required_confirmation="DISABLE SERVICE ACCOUNT KEY [CREDENTIAL_ID] OF [CLOUD_PRINCIPAL] IN [CLOUD_ACCOUNT_ID]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # disables the one key, SV-45
  gcloud iam service-accounts keys disable "[CREDENTIAL_ID]" --iam-account="[CLOUD_PRINCIPAL]@[CLOUD_ACCOUNT_ID].iam.gserviceaccount.com" --project="[CLOUD_ACCOUNT_ID]"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the key should now be listed as disabled
gcloud iam service-accounts keys list --iam-account="[CLOUD_PRINCIPAL]@[CLOUD_ACCOUNT_ID].iam.gserviceaccount.com" --project="[CLOUD_ACCOUNT_ID]"
```
</details>

### B4: Azure app registration client secret: delete (R3)

A client secret cannot be turned off, only deleted, and a deleted secret does not come back [unconfirmed: check the vendor page; the page read lists add steps only].

**Lighter step:** before the delete, the app's owner adds a replacement secret and moves every system to it, under the issuer-handover preview below; the delete then breaks nothing. Skip this only when the security lead decides the secret is being used by someone unknown now.

**Role needed:** an application administrator or the app's owner, with the security lead.

<!-- SAFETY GATE [leaked-key-azure-secret-delete-portal] -->
- **Target:** client secret [CREDENTIAL_ID] of app registration [CLOUD_PRINCIPAL]
- **Effect:** delete one client secret, [CREDENTIAL_ID], of the app registration [CLOUD_PRINCIPAL]
- **Scope:** one secret of one app; anything still using it fails; other secrets and certificates are not touched
- **Reversibility:** R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, "delete"): cannot be undone; the rollback path is the replacement secret written in the ticket before this gate
- **Required confirmation:** Type exactly `DELETE CLIENT SECRET [CREDENTIAL_ID] OF APP [CLOUD_PRINCIPAL]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no connector reads app credentials: the proof is the Client secrets list without [CREDENTIAL_ID])
**PORTAL ACTION [leaked-key-azure-secret-delete-portal]:** Only after the replacement is in place (or the security lead's written decision to accept the outage) and the exact match:
1. Microsoft Entra admin center → Entra ID → App registrations → `[CLOUD_PRINCIPAL]` → Certificates & secrets → Client secrets (SV-67).
2. On the row whose ID reads `[CREDENTIAL_ID]`, use its delete control and confirm [unconfirmed: check the vendor page for the control's label].
3. Read back: the Client secrets list no longer shows `[CREDENTIAL_ID]`.

### B5: GitHub fine-grained token: revoke its organization access (R2)

An organization owner can revoke a fine-grained token's access to the organization; the token can still read public resources (SV-49), and SSH keys it created keep working (SV-77). Classic tokens are not listed there (SV-77): their owner deletes them in their own settings, or the security team submits them to GitHub's credential revocation (preview below, SV-50).

**Role needed:** an organization owner of `[@Aegion_GITHUB_ORG]`.

<!-- SAFETY GATE [leaked-key-github-pat-revoke-portal] -->
- **Target:** token [CREDENTIAL_ID] of [GITHUB_USER] in [@Aegion_GITHUB_ORG]
- **Effect:** revoke the access of one fine-grained personal access token, [CREDENTIAL_ID], to the organization
- **Scope:** one token's access to one organization; the token's public reads and any SSH keys it created are not touched
- **Reversibility:** R2 (one object, no undo command: the owner creates a new token, approved again)
- **Required confirmation:** Type exactly `REVOKE TOKEN [CREDENTIAL_ID] OF [GITHUB_USER] FROM [@Aegion_GITHUB_ORG]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (the read-only GitHub connector does not read tokens: the proof is the Active tokens list without [CREDENTIAL_ID])
**PORTAL ACTION [leaked-key-github-pat-revoke-portal]:** Only after the escalation and the exact match:
1. github.com → `[@Aegion_GITHUB_ORG]` → Settings → Personal access tokens → Active tokens (SV-49).
2. On the row for `[CREDENTIAL_ID]` of `[GITHUB_USER]`, use **Revoke** and confirm (SV-49).
3. Read back: the Active tokens list no longer shows it. Then close the secret scanning alert as revoked with `/github-security-alerts`.

<details>
<summary>GitHub credential revocation (planning only)</summary>

```bash
# PREVIEW ONLY [leaked-key-github-revoke-api-preview]
# Planning only, nothing here runs: the endpoint takes the token value itself, so the security team sends it from a controlled machine, never a shared shell or a ticket. Unauthenticated requests only, owners are notified, SV-50
# curl -X POST https://api.github.com/credentials/revoke --data-binary @[FILE_NAME]
```
</details>

### B6: Slack app token: revoke (R2)

Revoking a bot token does not uninstall the app (SV-52). The app-settings control is unconfirmed; Slack's `auth.revoke` method revokes the token it is called with (SV-52), which the security team may use from a controlled machine.

**Role needed:** the app's owner or a Slack admin, with the security lead.

<!-- SAFETY GATE [leaked-key-slack-token-revoke-portal] -->
- **Target:** Slack app [APP_NAME] with app ID [APP_ID]
- **Effect:** revoke the tokens of one Slack app, [APP_NAME]
- **Scope:** one app; it stops working until it is reinstalled or its token is reissued
- **Reversibility:** R2 (one object, no undo command: the app is reinstalled or reissued a token)
- **Required confirmation:** Type exactly `REVOKE ALL TOKENS OF SLACK APP [APP_NAME] ID [APP_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (the read-only Slack adapter does not read app tokens: the proof is the app's settings page showing no active token)
**PORTAL ACTION [leaked-key-slack-token-revoke-portal]:** Only after the app's owner is on the call and the exact match:
1. Slack app management (api.slack.com/apps) → `[APP_NAME]` → OAuth & Permissions, then its token revocation control [unconfirmed: check the vendor page for the control and its label] (SV-53).
2. Read back: the page shows no active token for `[APP_NAME]`.

### B7: Any other issuer (an API key, a database password, a webhook)

> **PREVIEW ONLY [leaked-key-issuer-handover-preview]:** Planning only; this runbook does not authorize it. The credential's owner rotates or revokes it in the issuer's own console under that system's change process, issues the replacement to every system that uses it, and writes the issuer's revocation time in the ticket. The same holds for the replacement secrets of B1 and B4.

## Phase C: Review its use (R0)

From the exposure time (or the creation time, when that is unknown) to the revocation:

- **AWS:** CloudTrail Event history filtered on the key ID, one Region at a time, management events only, last 90 days (SV-05, SV-06); look for `CreateAccessKey`, `CreateUser`, policy attachments, new instances, `StopLogging`. GuardDuty findings for the key (SV-07).
- **Azure:** Microsoft Entra admin center → Entra ID → Monitoring & health → Sign-in logs → Service principal sign-ins for `[CLOUD_PRINCIPAL]`; the activity log for what it changed (90 days, SV-14).
- **Google Cloud:** Admin Activity audit logs for the service account (always written, SV-18); Data Access logs only if they were on (SV-19).
- **GitHub:** the organization audit log for the token's actions; whether the repository is public and has forks (forks keep the commit, SV-51).
- **Slack:** the channel's members and whether it is shared outside; the app's activity where the plan has audit logs [unconfirmed: check the vendor page].

<details>
<summary>CLI: the same reads (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN read-only: when the key was last used and by which service, SV-03
aws iam get-access-key-last-used --access-key-id "[CREDENTIAL_ID]"
# HUMAN-RUN read-only: the user's keys, a second key nobody recognises shows here
aws iam list-access-keys --user-name "[CLOUD_PRINCIPAL]"
# HUMAN-RUN read-only: management events signed with the key in this Region over the last 90 days, SV-05
aws cloudtrail lookup-events --lookup-attributes AttributeKey=AccessKeyId,AttributeValue="[CREDENTIAL_ID]" --max-results 50
# HUMAN-RUN read-only: the service account's keys and their state
gcloud iam service-accounts keys list --iam-account="[CLOUD_PRINCIPAL]@[CLOUD_ACCOUNT_ID].iam.gserviceaccount.com" --project="[CLOUD_ACCOUNT_ID]"
```
</details>

**Any use nobody can explain:** SEV-2 at least; tell the security on-call and widen the review to everything the credential could reach.

## Phase D: Clean the history (last)

Only after Phases B and C are in the ticket. Rewriting history is a repository change with side effects for everyone who cloned it, and forks keep the commit anyway (SV-51).

<details>
<summary>git: history cleanup (planning only)</summary>

```bash
# PREVIEW ONLY [leaked-key-history-cleanup-preview]
# Planning only, nothing here runs: the repository owner rewrites history under the repository's own reviewed change, after Phases B and C, SV-51
# git push --force --all
```
</details>

For a chat message, a ticket or a document: delete or redact it after Phases B and C, keeping a link and the time in the incident folder as evidence.

## Phase E: Delete a deactivated AWS key (R3, after the review)

**Lighter step:** the key was deactivated in B1 and has stayed inactive through the Phase C review, with no system failing that still needs it.

**Role needed:** an IAM administrator, with the security lead's sign-off on the review.

<!-- SAFETY GATE [leaked-key-aws-key-delete-portal] -->
- **Target:** [CREDENTIAL_ID] of IAM user [CLOUD_PRINCIPAL] in [CLOUD_ACCOUNT_ID]
- **Effect:** delete one deactivated AWS access key, [CREDENTIAL_ID], of [CLOUD_PRINCIPAL]
- **Scope:** one inactive key; nothing that still works uses it
- **Reversibility:** R3 (CLAUDE.md, Risk-Classified Execution Policy, the R3 row, "delete"): cannot be recovered (SV-02); the rollback path is a new key issued to the owner
- **Required confirmation:** Type exactly `DELETE AWS ACCESS KEY [CREDENTIAL_ID] OF [CLOUD_PRINCIPAL] IN [CLOUD_ACCOUNT_ID]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (no connector reads AWS: the proof is the Access keys section without [CREDENTIAL_ID])
**PORTAL ACTION [leaked-key-aws-key-delete-portal]:** Only after the review sign-off and the exact match:
1. AWS console → IAM → Users → `[CLOUD_PRINCIPAL]` → Security credentials → Access keys → the Actions menu of the inactive key `[CREDENTIAL_ID]` → Delete; type the key ID in the dialog to confirm (SV-01).
2. Read back: the Access keys section no longer lists `[CREDENTIAL_ID]`.

## ⚠️ Risk warning

- **The copy is already out.** Removing the commit or the message protects nobody until the credential is revoked.
- **Revoking breaks what uses it.** Name the systems before B, and decide with the owner whether to break now or rotate within the hour.
- **Attackers make their own keys.** Read the user's other keys and new principals in Phase C, and treat any you do not recognise as the attacker's.
- **A temporary AWS key is not in the console.** Revoke the role's sessions instead.

## ✅ Verification checklist

- [ ] Escalated, with type, ID, place, time and who could see it; no value anywhere.
- [ ] Revoked or rotated at the issuer, with the read-back in the ticket.
- [ ] Use reviewed from the exposure (or creation) time to the revocation; unexplained use escalated.
- [ ] History cleaned only after both, under the repository or system owner's change.
- [ ] A deactivated key deleted only after the review sign-off.

## 📝 Jira-ready note

Use the completed form only when every read-back passed; otherwise the partial form.

> [Completed] Exposed (credential type) `[CREDENTIAL_ID]` of `[CLOUD_PRINCIPAL]`, seen in (place) at (UTC or unknown), visible to (who). Escalated to (role) at (UTC). Revoked or rotated at (issuer) at (UTC) by [ADMIN_NAME] under its exact phrase; read back (what showed). Use reviewed (from, to): (no unexplained use / unexplained use, incident (ticket)). History cleaned (what, when) after both. No secret value recorded. Time spent: [X] min.
>
> [Partial state, keep open] Verified: (what passed). Pending: (revocation / review / cleanup). Next owner: (role); next step: (one line).

Post it with `/jira-update` on `[JIRA-###]`; for a Linear ticket, `/linear-ticket-note` on `[ISSUE_ID]`.

## Aha moment

A leaked secret is a key someone else may already have copied. The only fix is to change the lock; hiding the key you left on the table does nothing.

## Career upgrade

"Revoke, review, then clean" is the response every cloud security and DevSecOps team runs for leaked credentials, on every platform.

## Next action

Escalate with the credential's type, ID and where it was seen, then revoke it at its issuer.

**Sources (read 2026-11-14, `docs/aegis/batch12/vendor-facts-security.md`):** docs.aws.amazon.com/IAM/latest/UserGuide/access-keys-admin-managed.html (SV-01 to SV-03) · docs.aws.amazon.com/guardduty/latest/ug/compromised-creds.html (SV-04) · docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events.html (SV-05, SV-06) · docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_revoke-sessions.html (SV-47, SV-48) · docs.cloud.google.com/iam/docs/keys-disable-enable (SV-45, SV-46) · learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials (SV-67) · docs.github.com reviewing and revoking personal access tokens (SV-49), credentials revoke (SV-50), removing sensitive data (SV-51) · docs.slack.dev auth.revoke (SV-52).
