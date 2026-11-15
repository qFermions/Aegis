---
description: Reset Okta MFA for one user: new phone or lost Okta Verify through Directory → People → More Actions → Reset Authenticators (cannot be undone); reset-all and single-factor unenroll are gated separately; a suspected compromise routes to security triage first. Okta MFA is not Google 2-Step Verification. Placeholders only.
disable-model-invocation: true
---

# /okta-mfa-reset

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

CRITICAL: Do NOT ask for employee details, names, emails, or any PII. Deliver the FULL procedure IMMEDIATELY using only placeholders.

**Placeholders:** `[UPN]` (the user's Okta username) · `[USER_ID]` (their Okta user ID, starts `00u`; the connector read-backs write the same value as `[OKTA_USER_ID]`) · `[NOT_BEFORE]` (the UTC time in ISO 8601, such as `2026-10-28T09:00:00Z`, written in the ticket just before a change) · org values from the `[@Aegion_*]` dictionary (`modules/security/placeholder-dictionary.md`).

**Change record (R2 and R3 gates):** before a gate whose reversibility is R2 or R3 and that has a read-back named for it below, open its change record with `node scripts/audit/change-record.js open` (this runbook as `--command`, the gate's id as `--gate`, and the read-back that proves it as `--read-back`, such as `okta:verify-factor-reset --factor-type push`), then record the ticket's approval with `approve`. The id it prints is `[CHANGE_ID]`. That gate's read-back below passes `--change [CHANGE_ID]`: it refuses to read until the change is open for that read-back and approved, and only a read-back run that way can be linked to the change with `change-record.js link` (`scripts/audit/README.md`). Name the read-back with the flags on its line below that change what its pass means, such as `okta:verify-factor-reset --factor-type push`, and run the line with the same flags: a read with other flags is refused under the change and never counts for it. A gate with no read-back named for it below takes no change record (`open` refuses it): its proof is the read its own step names.

## ⚠️ Admin / safety gate

- **Stop first if the ticket smells like a compromise:** sign-ins the user did not make, a phishing click, Okta Verify pushes they did not send, or a "reset my MFA" request that arrived by email or chat instead of from the person. Route it through `/security-alert-triage` before any reset: resetting MFA on a compromised account hands the attacker a fresh enrollment.
- **Okta MFA is not Google 2-Step Verification.** They are two separate controls on two separate systems. Resetting Okta authenticators does nothing to the user's Google 2-Step Verification, and the reverse is also true. Google 2-Step Verification (backup codes, security keys, passkeys) is managed in the Google Admin console by `/gws-2sv-reset`, not here.
- **A reset cannot be undone.** Okta cancels the selected enrollments and the user must enroll again. Resetting *selected* authenticators (Phase B) and resetting *all* authenticators (Phase C) are separate gates with separate phrases.
- **A lost or replaced phone follows one order** (answer-format section 2, "A new way in before the old way out"): identity first, then a Temporary Access Code handed over on a verified channel where the org has that authenticator, then the reset of the old enrollment, then Okta Verify on the new phone, then both read-backs. Phase B holds that order. Phase C clears every authenticator first and is not that path.
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
2. An Okta Verify sign-in loop after a macOS update: follow "Okta Verify sign-in loop after a macOS update" below first (the user checks, then the session clear gate); Phase B, or Phase C when every enrollment must go, is its last resort.
3. Phase B (a new phone, or the loop's last resort when the session clear did not stop it): for a lost or replaced phone, identity first, then a Temporary Access Code on a verified channel when the user has no way in (gate); then reset only the affected authenticator (gate). **WAIT UNTIL** the user re-enrolls on the new phone and completes a sign-in.
4. Phase C: reset all authenticators only when every enrollment must go (separate gate).
5. Verify in the System Log and by the completed sign-in.

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

## Okta Verify sign-in loop after a macOS update

Source: operator-validated by the owner, 2026-11-06; not in Okta's published troubleshooting pages

**Purpose:** after a macOS update, Okta Verify on the Mac keeps sending the user back to sign in, and reinstalling Okta Verify, if it was already tried, did not stop it. What changed is the macOS update, so stale state on the Mac is the first suspect, before any reset. Run Phase A first: the compromise check still applies.

1. **User check:** ask the user to quit Okta Verify completely (not only close its window), open it again, and sign in once.
2. **User check:** ask the user to restart the Mac, then open Okta Verify and sign in once after the restart.
3. **User check:** ask the user to read the macOS version (Apple menu, About This Mac) and the Okta Verify version the app shows, and write both in the ticket, so the loop can be matched to the update.

**Admin step, only when the three user checks did not stop the loop:** clear the user's Okta sessions. This is the same change as `/okta-user-lifecycle` Phase C (gate `okta-user-lifecycle-clear-sessions-portal`), with the same fields and phrase.

Source: operator-validated by the owner on the real ticket, 2026-11-07, path confirmed against Okta's "How to clear user session" article.

**Before the click:** write the current UTC time in the ticket as `[NOT_BEFORE]` (a later time misses the clear, an older one can match an earlier clear).

<!-- SAFETY GATE [okta-mfa-reset-clear-sessions-portal] -->
- **Target:** [UPN]
- **Effect:** clear every active Okta session for one user; with the dialog option ticked, Okta also revokes tokens for logout-enabled apps and Okta API tokens
- **Scope:** Okta identity-provider sessions (and optionally those tokens); sessions already created inside web or native apps are not cleared
- **Reversibility:** R1: not reversible and none needed; the user authenticates again on the next request
- **Required confirmation:** Type exactly `CLEAR OKTA SESSIONS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [okta-mfa-reset-clear-sessions-portal]:** Only after the exact match:
1. Okta Admin Console → Directory → People (or the search box on the Dashboard) → `[UPN]` → **More Actions** → **Clear User Sessions**.
2. In the **Clear sessions and revoke tokens** dialog, tick **Also include logout enabled apps and Okta API tokens** when the tokens must go too, then click **Clear and revoke**.
3. Read back: Reports → System Log shows the session-end events for `[UPN]`.

```bash
# HUMAN-RUN read-only read-back, passes only when the System Log holds a user.session.clear event with outcome SUCCESS for the user at or after [NOT_BEFORE]
node scripts/adapters/okta-client.js verify-sessions-cleared --user [OKTA_USER_ID] --not-before [NOT_BEFORE] --execute
```

**WAIT UNTIL** the user quits Okta Verify, opens it again and completes one full sign-in.

**Gotcha:** **More Actions** does not show when an admin opens their own profile, and **Clear User Sessions** is offered only for active users: a user in a password-reset state or recently reactivated does not get it.

4. **Last resort:** Reset Authenticators, only when the steps above did not stop the loop: Phase B below resets only the ticked authenticator, Okta Verify here (gate `okta-mfa-reset-selected-portal`), and Phase C resets every authenticator (gate `okta-mfa-reset-all-portal`) only when every enrollment must go. Those gates are unchanged: follow them as written.

## Phase B: Reset the affected authenticator (the new-phone fix)

**Purpose:** cancel the Okta Verify enrollment that is bound to the old phone so the user can enroll Okta Verify on the new one. Authenticators you do not tick stay enrolled. For a lost or replaced phone the steps below follow answer-format section 2, "A new way in before the old way out", with one stated departure (the new phone is enrolled right after the reset, not before it: step 3 says why); the loop's last resort starts at step 3.

**Step 1, identity (no gate, nothing changes):** prove who is asking before anything else, by the check the org names: **[org gap: confirm the identity-proofing step]**. Until that is written down, the check this step names is a call the tech places to a number on file that is not the lost or replaced phone (a desk line, a second number on record), or the user's manager confirming on a call the tech places or in person. A call to the lost phone reaches whoever holds it, and the request's own channel and any number it supplies prove nothing.

**User check:** ask whether the old phone still opens Okta Verify and whether another authenticator Phase A recorded still works: a user who can still sign in is not locked out, so the reset waits until the new phone is in hand. Two cases follow. Another authenticator that is not on the old phone still works: that is a way in the reset below does not touch, so skip step 2. Only Okta Verify on the old phone works (a replaced phone still in hand): the reset below would take that last way in, so either the user puts Okta Verify on the new phone first ("When the new phone is already enrolled" below) or step 2 issues a code before the reset.

**Step 2, a way in that runs out: a Temporary Access Code (gate below), only when no enrolled authenticator works.** Okta's Temporary Access Code authenticator (Identity Engine) lets an admin create a code on the user's profile: the dialog sets how long it is valid and whether it works once or more than once (the multi-use choice shows only when the org's authenticator allows it). Okta's page asks for the two things this step asks for: verify the user's identity before giving the code, and give it over a secure, out-of-band channel, like a phone call. **Role needed:** an admin whose role holds Okta's permission "Manage user's temporary access code" for this user (Okta's page builds a custom role and a resource set for it and names no standard role). **[org gap: whether the Temporary Access Code authenticator is set up for [@Aegion], which role holds the permission, and which users may receive a code]**. Where no code can be issued, read "No Temporary Access Code" below before any reset.

**Verified channel:** read the code to the user on a call the tech places to a number on file that is not the lost or replaced phone (a desk line, a second number on record), or hand it over in person, or through the user's manager in person. Never the lost phone's own number. Never send it by email, chat or text to an address or number the request supplied. Write the channel in the ticket, never the code.

<!-- SAFETY GATE [okta-mfa-reset-tac-portal] -->
- **Target:** [UPN]
- **Effect:** create one Temporary Access Code for one user; the user can sign in with it, once or until it expires as the dialog sets, and any earlier code for the user is revoked
- **Scope:** one user and one code, valid for the time set in the dialog; no enrolled authenticator is changed
- **Reversibility:** R1: one user, and the undo is one click, Expire code under View active Temporary Access Code details, which ends the code at once; it also lapses by itself at the time set. A sign-in already made with the code is not taken back, which is why the identity check and the verified channel come first
- **Required confirmation:** Type exactly `CREATE TEMPORARY ACCESS CODE FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [okta-mfa-reset-tac-portal]:** Only after step 1 verified the identity, with the user on the verified channel, and the exact match:
1. Okta Admin Console → Directory → People → `[UPN]` → **More Actions** → **Create Temporary Access Code**.
2. In the dialog, set how long the code is valid, the shortest time that covers this call, and read whether it is one-time or multi-use (the WAIT UNTIL below depends on it), then click **Create code**. The code is shown once and does not reappear after the dialog closes.
3. Read the code to the user on the verified channel. Do not copy it into the ticket, a chat or an email.
4. Read back: the user's More Actions menu now lists **View active Temporary Access Code details**.
5. When the new phone is enrolled (step 4 of this phase), end the code from that same entry with **Expire code**, or write in the ticket the time it lapses. This is the gate's own undo and takes no second phrase.

No connector read proves a code exists, and an R1 change takes no change record. Proof a person can see: the **View active Temporary Access Code details** entry in the user's More Actions menu after the click. After the expiry, open the same menu again and read what it shows [unconfirmed: check the vendor page: Okta's page does not say what the menu shows once a code is expired]; a code still shown as active means the expiry did not take.

**WAIT UNTIL** the new way in is proven, on the verified call, before anything is removed. A multi-use code: the user signs in once with it now. A one-time code (the only kind unless the org's authenticator allows multi-use): do not spend it on a test, because the user needs it for the sign-in after the reset; its proof before the reset is the menu entry above and the user reading the code back. Okta can still ask for another method when the sign-in policy requires one: its page says the code is a single knowledge factor and does not meet a policy that asks for any two factor types. If a multi-use code does not get the user in, stop, reset nothing, expire the code, and take the policy question to the Okta administrator.

**Step 3, the old way out: reset the old phone's Okta Verify (gate below).** For a lost or replaced phone, only after the WAIT UNTIL above, or for a user whose other authenticator still works.

**Why the new phone comes after the reset on Okta:** the read-back of this gate passes only while no push factor is listed, and Okta's support article on removing a single enrollment gives only an API call for it, no control in the Admin Console; whether the reset clears Okta Verify on every device is not on Okta's page [unconfirmed: check the vendor page]. So the new phone is enrolled right after the reset, on the same call, and the code is meant to be the way in that bridges the two: the verified person holds it from before the reset until the new phone is enrolled (step 4 says what is not confirmed about enrolling with it).

**No Temporary Access Code:** where the authenticator is not set up or the user may not receive a code, this runbook has one path left, the reset first and the re-enrollment at the next sign-in. That takes the old way out before a new way in exists (until the user re-enrolls, the second factor is whatever is set up next), so it is not the lost-or-replaced-phone order; it is the right tool only when there is no code to issue. Keep the gap as short as it can be: run the identity check and the reset with the user on the verified call, stay on the call until the new phone is enrolled and the `factors` read lists it, and write in the ticket that no code was available.

**When the new phone is already enrolled** (the user added it from their Okta dashboard while the old phone still worked: Settings, Security Methods, Okta Verify, Set Up Another, on Identity Engine): the Phase A `factors` read lists two push factors. The reset below is then the wrong tool until you know what it removes, because its read-back passes only while no push factor is listed. The user removes the old phone's entry under Security Methods themselves [unconfirmed: check the vendor page: whether Remove there takes one phone or every phone]. No gate: the user's own action. Proof a person can see: the `factors` read lists one push factor, and its `created` time is the new phone's. If it still lists two, stop and ask the Okta administrator before any reset.

<!-- SAFETY GATE [okta-mfa-reset-selected-portal] -->
- **Target:** [UPN]
- **Effect:** reset the selected authenticator enrollments for one user; the user must set those authenticators up again at their next sign-in
- **Scope:** only the authenticators ticked in the dialog (Okta Verify for a new phone); unticked authenticators stay enrolled
- **Reversibility:** R2: not reversible; Okta states the action cannot be undone, and the only way back is the user's own re-enrollment
- **Required confirmation:** Type exactly `RESET SELECTED OKTA AUTHENTICATORS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `okta-client.js verify-factor-reset --user [OKTA_USER_ID] --factor-type push --change [CHANGE_ID] --execute`
**PORTAL ACTION [okta-mfa-reset-selected-portal]:** Only after identity is verified out of band and the exact match:
1. Okta Admin Console → Directory → People → `[UPN]` → **More Actions** → **Reset Authenticators**.
2. Tick only **Okta Verify** (the old phone's enrollment), click **Reset Selected Authenticators**, then **Reset** in the confirmation prompt.
3. Read back: re-open the same dialog (Okta Verify is no longer listed as enrolled), then close it without ticking anything.

Run the connector read-back now, before the user re-enrolls: once Okta Verify is set up on the new phone, a `push` factor is listed again and this read fails.

```bash
# HUMAN-RUN read-only read-back of [okta-mfa-reset-selected-portal] or [okta-mfa-reset-factor], passes only when no push factor is listed for the user. It proves the reset only when Phase A listed a push factor
node scripts/adapters/okta-client.js verify-factor-reset --user [OKTA_USER_ID] --factor-type push --change [CHANGE_ID] --execute
```

If Phase A also listed `signed_nonce` (FastPass), also run the same read with `--factor-type signed_nonce` and without `--change`: the change is named for its `push` read-back, and a read under it with another factor type is refused before it reads. The read judges by factor type only: if Phase A listed one type twice, it cannot tell the two apart, so the dialog read-back above decides.

**WAIT UNTIL** the user signs in on the new phone, sets up Okta Verify again when Okta prompts for it (the old enrollment is gone), and completes one full sign-in.

**Step 4, the new method, on the same call:** the WAIT UNTIL above is the user registering the new method. Where a Temporary Access Code was issued, the user signs in with it to reach the enrollment prompt [unconfirmed: check the vendor page: whether a sign-in with the code alone is enough to enroll Okta Verify depends on this org's sign-in and enrollment policies, and Okta's page does not say]; if Okta refuses the enrollment, stop and take it to the Okta administrator, with the code still valid. Stay on the verified call until Okta Verify on the new phone has completed one full sign-in.

**Step 5, read back both halves, then close the code:** old one gone: the `verify-factor-reset` read above passed before the re-enrollment. New one present: the connector `factors` read from Phase A, run again, lists a push factor whose `created` time is after the reset. Then end the Temporary Access Code (step 5 of its gate). The ticket is not done on one half.

**Gotcha:** Okta Verify is one enrollment set: Okta's API notes that unenrolling the push or FastPass (signed_nonce) factor also unenrolls the user's other Okta Verify factors (TOTP code, push, FastPass), so expect every Okta Verify method on the old phone to go together.

## Phase C: Reset ALL authenticators (separate gate)

**Purpose:** only when every enrollment must go (every device lost, or a clean re-enrollment is required after triage). The account stays Active; the user re-enrolls everything.

**Try first:** Phase B, which resets only the affected authenticator; reset all only when every enrollment must go.

**Not the lost-or-replaced-phone path:** resetting every authenticator takes every old way out at once, before any new way in exists. A lost or replaced phone is Phase B. This phase is the right tool only when every enrollment must go: every device is lost or stolen, or the triage of a compromise decided on a clean re-enrollment. Where a Temporary Access Code can be issued (Phase B, step 2, its own gate), issue it first and hand it over on the verified channel, so the verified person holds a way in while they enroll again (Phase B, step 4, says what is not confirmed about enrolling with a code).

<!-- SAFETY GATE [okta-mfa-reset-all-portal] -->
- **Target:** [UPN]
- **Effect:** reset every enrolled authenticator for one user; the account stays Active and the user must enroll all authenticators again
- **Scope:** all authenticators on one user
- **Reversibility:** R3: not reversible; the action cannot be undone and the user re-enrolls from scratch
- **Required confirmation:** Type exactly `RESET ALL OKTA AUTHENTICATORS FOR [UPN]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** `okta-client.js verify-factors-reset-all --user [OKTA_USER_ID] --change [CHANGE_ID] --execute`
**PORTAL ACTION [okta-mfa-reset-all-portal]:** Only after the triage decision is recorded in the ticket and the exact match:
1. Okta Admin Console → Directory → People → `[UPN]` → **More Actions** → **Reset Authenticators**.
2. Tick every listed authenticator, click **Reset Selected Authenticators**, then **Reset**.
3. Read back: re-open the dialog (no enrollments remain), then close it.

```bash
# HUMAN-RUN read-only read-back of [okta-mfa-reset-all-portal] or [okta-mfa-reset-all], run it before the user re-enrolls, passes only when no factor at all is listed for the user. It proves the reset only when Phase A listed at least one factor
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
# Read-back: okta-client.js verify-factor-reset --user [OKTA_USER_ID] --factor-type push --change [CHANGE_ID] --execute
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
# Read-back: okta-client.js verify-factors-reset-all --user [OKTA_USER_ID] --change [CHANGE_ID] --execute
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
- **A Temporary Access Code is a sign-in credential.** Whoever holds it can use it until it expires: create it only after the identity check, read it out only on the verified channel, keep its life short, and expire it once the new phone is enrolled.
- **Do not touch Google 2-Step Verification to fix an Okta problem** (or the reverse); they are separate enrollments on separate systems.

## ✅ Verification checklist

- [ ] Okta Admin Console → Directory → People → `[UPN]` reads **Active**.
- [ ] Okta Verify sign-in loop: after the session clear, the connector `verify-sessions-cleared` passed (exit 0) against the `[NOT_BEFORE]` written before the click. When it fixed the loop and the user completed one full sign-in, with no reset done, the five reset and re-enrollment items below do not apply; if the reset followed, they apply too. The compromise item applies either way.
- [ ] Lost or replaced phone: the ticket names the identity check and the verified channel the Temporary Access Code went over (never the code); the code was proven before the reset (a sign-in for a multi-use code, the menu entry and a read-back for a one-time code); once the new phone was enrolled the code was expired, or the time it lapses is in the ticket. Where no code could be issued, the ticket says so.
- [ ] The user enrolled Okta Verify on the new phone and completed one sign-in: the user confirms it, and Okta Admin Console → Reports → System Log shows that sign-in for `[UPN]`.
- [ ] Reports → System Log shows the authenticator reset for `[UPN]` with the expected admin and time.
- [ ] Right after the reset and before the re-enrollment, the connector read-back passed (exit 0, `"verified": true`) against the factor types Phase A recorded: `verify-factor-reset --factor-type push` (and `signed_nonce` when it was listed) for one authenticator, or `verify-factors-reset-all` for all.
- [ ] After the re-enrollment, the connector `factors` read (or the API read-back `GET /api/v1/users/[USER_ID]/factors`) lists the new Okta Verify enrollment and no stale one.
- [ ] If a compromise was suspected, the triage ticket is linked and its containment steps ran before this reset.

## 📝 Jira-ready note

Use a completed form only when every read-back above that the path taken requires passed (the session clear's `verify-sessions-cleared`; the reset's `verify-factor-reset` or `verify-factors-reset-all`; both when both changes were made); otherwise write a partial-state note naming what is verified, what is pending, and the next owner.

> [Only if all checks passed] Okta MFA reset for `[UPN]`: [if the session clear ran first] sessions cleared after [NOT_BEFORE] for an Okta Verify loop, connector read-back verify-sessions-cleared passed at [timestamp], the loop continued; identity verified out of band [how]; [lost or replaced phone: Temporary Access Code created at [timestamp] under its exact phrase, handed over by [a call placed to a number on file that is not the lost phone / in person / the manager], proven before the reset, expired at [timestamp] / no code could be issued in this org]; [Okta Verify / all authenticators] reset at [timestamp], confirmed by the exact phrase; connector read-back [verify-factor-reset push (and signed_nonce when Phase A listed it) / verify-factors-reset-all] passed at [timestamp] before re-enrollment. User re-enrolled Okta Verify [on the new phone / on the Mac] and completed a sign-in at [timestamp]; System Log shows the reset and the sign-in. Google 2-Step Verification untouched (separate control). Compromise indicators: [none found / triage ticket [JIRA-###] linked]. Time spent: [X] min.

> [Okta Verify loop fixed by the session clear, only if its checks passed] Okta Verify sign-in loop for `[UPN]` after a macOS update: user checks [results]; macOS [version], Okta Verify [version]; sessions cleared after [NOT_BEFORE], confirmed by the exact phrase; connector read-back verify-sessions-cleared passed at [timestamp]; the user completed a sign-in at [timestamp]. No authenticator was reset. Compromise indicators: [none found / triage ticket [JIRA-###] linked]. Time spent: [X] min.

## Aha moment

An MFA reset is an identity-proofing decision, not a button: the moment you reset, your out-of-band verification is the only factor the account has left.

## Career upgrade

Keeping IdP MFA (Okta) and application MFA (Google 2-Step Verification) separate in your head is the same layering that zero-trust architecture reviews test for.

## Next action

Run Phase A; if anything in the System Log looks like a compromise, switch to `/security-alert-triage` before any reset.

**Sources (checked 2026-10-15):** help.okta.com/oie/en-us/content/topics/security/mfa/mfa-reset-users.htm · help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-end-user-states.htm · help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-reset-individual.htm (admin-initiated reset bypasses other factors) · developer.okta.com/docs/api/openapi/okta-management/management/tags/userfactor.md · developer.okta.com/docs/api/openapi/okta-management/management/tags/userlifecycle.md · developer.okta.com/docs/guides/create-an-api-token/main/ · knowledge.workspace.google.com/admin/security/deploy-2-step-verification (Google 2-Step Verification is a separate control managed in the Google Admin console).

**Sources (checked 2026-11-13, vendor facts GB-04 to GB-13 and GB-54 in `docs/aegis/batch11/vendor-facts-google-okta-jamf.md`):** help.okta.com/oie/en-us/content/topics/identity-engine/authenticators/configure-temporary-access-code.htm (the Temporary Access Code authenticator: the menu path, the permission, the out-of-band channel, Expire code) · support.okta.com/help/s/article/enroll-multiple-devices-in-okta-verify (Set Up Another, Identity Engine) · support.okta.com/help/s/article/remove-a-single-user-from-a-device-with-multiple-users-using-the-okta-api (one enrollment is removed by API only).
