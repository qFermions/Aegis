---
description: Reset Okta MFA for one user: new phone or lost Okta Verify through Directory → People → More Actions → Reset Authenticators (cannot be undone); reset-all and single-factor unenroll are gated separately; a suspected compromise routes to security triage first. Okta MFA is not Google 2-Step Verification. Placeholders only.
disable-model-invocation: true
---

# /okta-mfa-reset

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[UPN]` (the user's Okta username) · `[USER_ID]` (their Okta user ID, starts `00u`; the connector read-backs write the same value as `[OKTA_USER_ID]`) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

**Change record (R2 and R3 gates):** before a gate whose reversibility is R2 or R3, open its change record with `node scripts/audit/change-record.js open` (this runbook as `--command`, the gate's id as `--gate`, and the read-back that proves it as `--read-back`, such as `okta:verify-factor-reset`), then record the ticket's approval with `approve`. The id it prints is `[CHANGE_ID]`. That gate's read-back below passes `--change [CHANGE_ID]`: it refuses to read until the change is open for that read-back and approved, and only a read-back run that way can be linked to the change with `change-record.js link` (`scripts/audit/README.md`).

## ⚠️ Admin / safety gate

- **Stop first if the ticket smells like a compromise:** sign-ins the user did not make, a phishing click, Okta Verify pushes they did not send, or a "reset my MFA" request that arrived by email or chat instead of from the person. Route it through `/security-alert-triage` before any reset: resetting MFA on a compromised account hands the attacker a fresh enrollment.
- **Okta MFA is not Google 2-Step Verification.** They are two separate controls on two separate systems. Resetting Okta authenticators does nothing to the user's Google 2-Step Verification, and the reverse is also true. Google 2-Step Verification (backup codes, security keys, passkeys) is managed in the Google Admin console by `/gws-2sv-reset`, not here.
- **A reset cannot be undone.** Okta cancels the selected enrollments and the user must enroll again. Resetting *selected* authenticators (Phase B) and resetting *all* authenticators (Phase C) are separate gates with separate phrases.
- Verify the person's identity out of band before any reset: **[org gap: confirm the identity-proofing step]**. Never accept the request on the strength of the message it arrived in.
- Each reset ends with a read-only connector read-back (`scripts/adapters/okta-client.js`: GET only, it cannot change anything in Okta), run before the user re-enrolls. It proves the reset only against the factor list Phase A recorded: a factor type that was never enrolled passes with nothing changed.
- Not done until the user has re-enrolled and completed a sign-in.

## Inputs needed

- `[UPN]` / `[USER_ID]`.
- For the connector: `OKTA_ORG_URL` set to `[@Aegion_OKTA_ORG_URL]` as a bare hostname, and the read-only service app's `OKTA_CLIENT_ID` and `OKTA_PRIVATE_KEY` exported from the secret manager, never pasted into a ticket. It asks for the four Okta read scopes only and refuses a token that also grants a write scope. Without `--execute` a command prints its planned GET and sends nothing.
- Which authenticator is affected (Okta Verify on the old phone is the common case) and whether any other enrolled authenticator still works.
- Okta status: must be **Active**. A factor cannot be unenrolled from a deactivated user; that is a lifecycle ticket (`/okta-user-lifecycle`) first.
- Identity verified out of band: **[org gap]**.

## Fast path

1. Phase A: read status, recent sign-ins and enrolled authenticators (R0); rule out a compromise.
2. Phase B: reset only the affected authenticator (gate). **WAIT UNTIL** the user re-enrolls on the new phone and completes a sign-in.
3. Phase C: reset all authenticators only when every enrollment must go (separate gate).
4. Verify in the System Log and by the completed sign-in.

## Phase A: Read first (R0)

**Purpose:** confirm the account is Active, see what is enrolled, and rule out a compromise before touching MFA.

- Okta Admin Console → Directory → People → `[UPN]` → read **Status** (Active; a Suspended or Deactivated user is a lifecycle ticket, not an MFA ticket).
- Okta Admin Console → Reports → System Log → search for `[UPN]` → read the recent sign-ins and MFA events: an unfamiliar location, a burst of failed pushes, or a push approved at an odd hour means stop and triage.
- The enrolled authenticators are listed by the connector read below and by the read-only API call in the scale version (the Reset Authenticators dialog in Phase B also lists them).

<details>
<summary>Read-only connector reads, the pre-state (HUMAN-RUN)</summary>

```bash
# HUMAN-RUN read-only. The user record, status and login only. The status must read ACTIVE
node scripts/adapters/okta-client.js user --user [OKTA_USER_ID] --execute
# every enrolled factor with its factorType, such as push, signed_nonce or token:software:totp, profile values withheld. Write the factor types in the ticket: the read-backs below are judged against them
node scripts/adapters/okta-client.js factors --user [OKTA_USER_ID] --execute
```
</details>

**Verification checkpoint:** [ ] status Active · [ ] no compromise indicators · [ ] enrolled authenticators and their factor types recorded in the ticket.

## Phase B: Reset the affected authenticator (the new-phone fix)

**Purpose:** cancel the Okta Verify enrollment that is bound to the old phone so the user can enroll Okta Verify on the new one. Authenticators you do not tick stay enrolled.

<!-- SAFETY GATE [okta-mfa-reset-selected-portal] -->
- **Target:** [UPN]
- **Effect:** reset the selected authenticator enrollments for one user; the user must set those authenticators up again at their next sign-in
- **Scope:** only the authenticators ticked in the dialog (Okta Verify for a new phone); unticked authenticators stay enrolled
- **Reversibility:** R2: not reversible; Okta states the action cannot be undone, and the only way back is the user's own re-enrollment
- **Required confirmation:** Type exactly `RESET SELECTED OKTA AUTHENTICATORS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-mfa-reset-selected-portal]:** Only after identity is verified out of band and the exact match:
1. Okta Admin Console → Directory → People → `[UPN]` → **More Actions** → **Reset Authenticators**.
2. Tick only **Okta Verify** (the old phone's enrollment), click **Reset Selected Authenticators**, then **Reset** in the confirmation prompt.
3. Read back: re-open the same dialog (Okta Verify is no longer listed as enrolled), then close it without ticking anything.

Run the connector read-back now, before the user re-enrolls: once Okta Verify is set up on the new phone, a `push` factor is listed again and this read fails.

```bash
# HUMAN-RUN read-only read-back, passes only when no push factor is listed for the user. It proves the reset only when Phase A listed a push factor
node scripts/adapters/okta-client.js verify-factor-reset --user [OKTA_USER_ID] --factor-type push --change [CHANGE_ID] --execute
```

If Phase A also listed `signed_nonce` (FastPass), run the same read with `--factor-type signed_nonce`. The read judges by factor type only: if Phase A listed one type twice, it cannot tell the two apart, so the dialog read-back above decides.

**WAIT UNTIL** the user signs in on the new phone, sets up Okta Verify again when Okta prompts for it (the old enrollment is gone), and completes one full sign-in.

**Gotcha:** Okta Verify is one enrollment set: Okta's API notes that unenrolling the push or FastPass (signed_nonce) factor also unenrolls the user's other Okta Verify factors (TOTP code, push, FastPass), so expect every Okta Verify method on the old phone to go together.

## Phase C: Reset ALL authenticators (separate gate)

**Purpose:** only when every enrollment must go (every device lost, or a clean re-enrollment is required after triage). The account stays Active; the user re-enrolls everything.

<!-- SAFETY GATE [okta-mfa-reset-all-portal] -->
- **Target:** [UPN]
- **Effect:** reset every enrolled authenticator for one user; the account stays Active and the user must enroll all authenticators again
- **Scope:** all authenticators on one user
- **Reversibility:** R3: not reversible; the action cannot be undone and the user re-enrolls from scratch
- **Required confirmation:** Type exactly `RESET ALL OKTA AUTHENTICATORS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
**PORTAL ACTION [okta-mfa-reset-all-portal]:** Only after the triage decision is recorded in the ticket and the exact match:
1. Okta Admin Console → Directory → People → `[UPN]` → **More Actions** → **Reset Authenticators**.
2. Tick every listed authenticator, click **Reset Selected Authenticators**, then **Reset**.
3. Read back: re-open the dialog (no enrollments remain), then close it.

```bash
# HUMAN-RUN read-only read-back, run it before the user re-enrolls, passes only when no factor at all is listed for the user. It proves the reset only when Phase A listed at least one factor
node scripts/adapters/okta-client.js verify-factors-reset-all --user [OKTA_USER_ID] --change [CHANGE_ID] --execute
```

If it fails, the output lists the factor types still enrolled: compare them with the dialog before anything else, and never reset again to make it pass.

**WAIT UNTIL** the user completes a sign-in and enrolls each authenticator Okta prompts for.

<details>
<summary>Okta API, the scale version (HUMAN-RUN, for reference)</summary>

Export `OKTA_API_TOKEN` from the secret manager first (never paste a token into a ticket). Okta recommends OAuth 2.0 over SSWS tokens; an SSWS token inherits its creator's privileges and expires after 30 days unused. The factor ID for a single unenroll comes from the read-only list call: export it as `FACTOR_ID` in the same shell before the gated fence. Whichever way a reset is made, here or in the Admin Console, the connector read-back in its phase above is the proof.

```bash
# HUMAN-RUN, read-only: status and enrolled factors; nothing here changes anything
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # status must read ACTIVE
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/factors" -H "Authorization: SSWS ${OKTA_API_TOKEN}"   # every enrolled factor with its id, factorType and provider; copy the Okta Verify factor id into FACTOR_ID
```

```bash
# HUMAN-RUN, unenroll one factor: the single-factor equivalent of Phase B
# SAFETY GATE [okta-mfa-reset-factor]
# Target: [USER_ID], the factor set in FACTOR_ID
# Effect: unenroll one MFA factor for the user, the user can then enroll a new one
# Scope: one factor on one Active user. Unenrolling an Okta Verify push or signed_nonce factor also unenrolls the user’s other Okta Verify factors
# Reversibility: R2: not reversible. The enrollment is gone and the user enrolls again. The call is refused on a deactivated user
# Required confirmation: type exactly "UNENROLL OKTA FACTOR FOR [USER_ID]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="UNENROLL OKTA FACTOR FOR [USER_ID]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # unenrolls that one factor
  curl -sS -X DELETE "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/factors/${FACTOR_ID}" -H "Authorization: SSWS ${OKTA_API_TOKEN}"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: the factor is no longer listed
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/factors" -H "Authorization: SSWS ${OKTA_API_TOKEN}"
```

```bash
# HUMAN-RUN, reset ALL factors: the API equivalent of Phase C. The user stays ACTIVE
# SAFETY GATE [okta-mfa-reset-all]
# Target: [USER_ID]
# Effect: reset every MFA factor enrollment for the user to the unenrolled state, the user’s status stays ACTIVE
# Scope: all factors on one user
# Reversibility: R3: not reversible, the user enrolls every factor again
# Required confirmation: type exactly "RESET ALL OKTA FACTORS FOR [USER_ID]"
# Failure behavior: Empty, declined, "yes", or any other response means stop, and no change is made.
# the exact phrase to type
required_confirmation="RESET ALL OKTA FACTORS FOR [USER_ID]"
# shows the phrase
printf '%s\n' "Type exactly: $required_confirmation"
# reads one line exactly as typed and runs the change only on an exact, case-sensitive match
if IFS= read -r confirmation && [ "$confirmation" = "$required_confirmation" ]; then
  # returns every factor to the unenrolled state
  curl -sS -X POST "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/lifecycle/reset_factors" -H "Authorization: SSWS ${OKTA_API_TOKEN}"
else
  # explains the stop
  echo "Confirmation did not match. No change was made." >&2
  # stops with a failure status
  exit 1
fi
# read-back: an empty list
curl -sS "https://[@Aegion_OKTA_ORG_URL]/api/v1/users/[USER_ID]/factors" -H "Authorization: SSWS ${OKTA_API_TOKEN}"
```
</details>

## ⚠️ Risk warning

- **The reset cannot be undone.** Until the user re-enrolls, their MFA is whatever they set up next, which is why identity proofing comes before the phrase, not after.
- **Compromise first, reset second.** If the System Log shows anything the user cannot explain, `/security-alert-triage` runs first (contain, revoke sessions, reset the password) and the MFA reset follows as part of that plan.
- **An admin password reset bypasses other factors:** Okta's admin-initiated reset lets the user in with the temporary password or emailed link without other factors. If you also reset the password, hand the temporary password over out of band and never in the same channel the request came from.
- **Do not touch Google 2-Step Verification to fix an Okta problem** (or the reverse); they are separate enrollments on separate systems.

## ✅ Verification checklist

- [ ] Okta Admin Console → Directory → People → `[UPN]` reads **Active**.
- [ ] The user enrolled Okta Verify on the new phone and completed one sign-in: the user confirms it, and Okta Admin Console → Reports → System Log shows that sign-in for `[UPN]`.
- [ ] Reports → System Log shows the authenticator reset for `[UPN]` with the expected admin and time.
- [ ] Right after the reset and before the re-enrollment, the connector read-back passed (exit 0, `"verified": true`) against the factor types Phase A recorded: `verify-factor-reset --factor-type push` (and `signed_nonce` when it was listed) for one authenticator, or `verify-factors-reset-all` for all.
- [ ] After the re-enrollment, the connector `factors` read (or the API read-back `GET /api/v1/users/[USER_ID]/factors`) lists the new Okta Verify enrollment and no stale one.
- [ ] If a compromise was suspected, the triage ticket is linked and its containment steps ran before this reset.

## 📝 Jira-ready note

Use the completed form only when every read-back above passed; otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Okta MFA reset for `[UPN]`: identity verified out of band [how]; [Okta Verify / all authenticators] reset at [timestamp], confirmed by the exact phrase; connector read-back [verify-factor-reset push / verify-factors-reset-all] passed at [timestamp] before re-enrollment. User re-enrolled Okta Verify on the new phone and completed a sign-in at [timestamp]; System Log shows the reset and the sign-in. Google 2-Step Verification untouched (separate control). Compromise indicators: [none found / triage ticket [JIRA-###] linked]. Time spent: [X] min.

## Aha moment

An MFA reset is an identity-proofing decision, not a button: the moment you reset, your out-of-band verification is the only factor the account has left.

## Career upgrade

Keeping IdP MFA (Okta) and application MFA (Google 2-Step Verification) separate in your head is the same layering that zero-trust architecture reviews test for.

## Next action

Run Phase A; if anything in the System Log looks like a compromise, switch to `/security-alert-triage` before any reset.

**Sources (checked 2026-10-15):** help.okta.com/oie/en-us/content/topics/security/mfa/mfa-reset-users.htm · help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-end-user-states.htm · help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-reset-individual.htm (admin-initiated reset bypasses other factors) · developer.okta.com/docs/api/openapi/okta-management/management/tags/userfactor.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/userlifecycle.md · developer.okta.com/docs/guides/create-an-api-token/main/ · knowledge.workspace.google.com/admin/security/deploy-2-step-verification (Google 2-Step Verification is a separate control managed in the Google Admin console).
