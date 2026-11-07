# Vendor facts: the lighter steps of the ladder fixes (batch 9, task 8b)

Collected 2026-11-06. Read-only research. No vendor API was called, no credential was used.
Every line: fact | URL opened | date | how read | verbatim quote (under 25 words).
Hosts allowed for this task: learn.microsoft.com, help.okta.com, support.google.com, learn.jamf.com. No other host was read.
"Microsoft Learn fetch" = the page fetched through the Microsoft Learn MCP tool (full page as markdown).
"fetch tool summary" = the page fetched with the web fetch tool, which returns a model's reading of the page; its quotes are as that tool returned them and are marked so.
UNCONFIRMED = could not be confirmed from the vendor's own documentation on an allowed host; nothing in a runbook rests on it as a vendor menu path.

The runbook lines that cite nothing below are of two kinds: a user step that is a plain user action (restart, sign in again, quit and reopen an app, read a version), and a "Try first" or "No lighter step" line that points to a gate already in the same runbook.

## Microsoft

- L-01. Intune remote lock locks a managed device without wiping data or removing enrollment; used in `/device-wipe` as the planning-only marker device-remote-lock-preview. | https://learn.microsoft.com/en-us/intune/intune-service/remote-actions/device-remote-lock | 2026-11-06 | Microsoft Learn fetch | "Use this action when a device is misplaced, left unattended, or suspected of unauthorized use without wiping data or removing enrollment."
- L-02. The remote lock's path in the Intune admin center: Devices, All devices, the device, then Secure, Remote lock. | same URL | 2026-11-06 | Microsoft Learn fetch | "At the top of the device overview pane, find the row of action icons. Select Secure > Remote lock."
- L-03. Remote lock supports Android Enterprise corporate-owned, AOSP, iOS/iPadOS, macOS and visionOS 2.0+; Windows is not in the list, and it is only effective when a passcode is set. | same URL | 2026-11-06 | Microsoft Learn fetch | "Remote lock is only effective if a passcode or PIN is already set"
- L-04. Self-service password reset lets a user who forgot the password, or whose account is locked, reset it with no admin; used in `/password-reset` as a "Try first" line. | https://learn.microsoft.com/en-us/entra/identity/authentication/concept-sspr-howitworks | 2026-11-06 | Microsoft Learn search excerpt of that page | "If a user's account is locked or they forget their password, they can follow prompts to unblock themselves and get back to work."
- L-05. The user's own entry point is aka.ms/sspr. | same URL | 2026-11-06 | Microsoft Learn search excerpt | "If you're an end user already registered for self-service password reset and need to get back into your account, go to https://aka.ms/sspr."
- L-06. A synced user (password managed on-premises) can use it only when SSPR writeback is deployed. | same URL | 2026-11-06 | Microsoft Learn search excerpt | "If SSPR writeback isn't deployed and the user's password is managed on-premises, the user is asked to contact their administrator"

## Google

- L-07. A user who saved backup codes can use one as the second step when the phone is lost; used in `/gws-2sv-reset` Phase B as a user check. | https://support.google.com/accounts/answer/185839 | 2026-11-06 | fetch tool summary | "If you lose your phone, you can use a backup code for the second step."
- L-08. UNCONFIRMED: an admin setting that lets users recover their own password, and Google's admin guidance on passing a login challenge. support.google.com/a/answer/33382 and support.google.com/a/answer/6002699 both answered with a redirect to knowledge.workspace.google.com, a host outside the allowed list, so neither page was read. No admin action was added from them; `/gws-password-reset` Phase B and `/gws-2sv-reset` Phase D use plain user checks instead (sign in again by hand in a private window; try again from the usual device and network).
- L-09. UNCONFIRMED: a remote Reboot command for a ChromeOS device. support.google.com/chrome/a/answer/1360642 ("Wipe ChromeOS device data") names only Reset, with Clear User Profiles or Factory Reset; support.google.com/chrome/a/answer/1289314 ("Managing your ChromeOS devices") was read without a Reboot action found (the tool reported its text cut short). No admin reboot step was added; `/gws-chromeos-device` Phase D's lighter step is the user signing out, restarting and signing in again.

## Okta

- L-10. An admin can unlock a locked-out user from Directory, People, the Locked Out view, the user, More Actions, Unlock Account; used in `/okta-user-lifecycle` Phase B as the planning-only marker okta-user-lifecycle-unlock-preview (no gate: an unlock needs its own reviewed gate). | https://help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-unlock-individual.htm | 2026-11-06 | fetch tool summary, the path confirmed again by the independent reviewer's own fetch of the page | "Click More Actions, and then click Unlock Account."
- L-11. The same page's action label. | same URL | 2026-11-06 | fetch tool summary | "Unlock Account"
- L-12. UNCONFIRMED: an end user adding Okta Verify on a new phone from their own Okta settings, which would make the Phase B reset in `/okta-mfa-reset` unnecessary. help.okta.com/en-us/.../end-user/ov-new-device.htm, help.okta.com/oie/en-us/.../end-user/ov-new-device.htm and help.okta.com/eu/en-us/.../end-user/ov-new-device.htm returned 404; help.okta.com/eu/en-us/content/topics/end-user/ov-overview.htm and ov-overview-ios.htm list no such page; help.okta.com/oie/en-us/content/topics/security/mfa/mfa-reset-users.htm ("Reset multifactor authentication for users") covers only the admin reset. No self-service step was added; the Phase B user check asks only whether the old phone or another enrolled authenticator still works.
- L-13. UNCONFIRMED: the admin re-authentication action for the Okta Verify sign-in loop after a macOS update. The owner's fill-in line with the exact menu action was blank, and no Okta page was read for it; `/okta-mfa-reset` carries it as the planning-only marker okta-verify-loop-admin-reauth with no menu path. The section's source is the owner's own validation, not an Okta page.

## Jamf

- L-14. Wipe Computer sends the macOS EraseDevice command; used by `/jamf-lock-erase` Phase C's read-back. | https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Remote_Commands_for_Computers | 2026-11-06 | fetch tool summary (read in two parts, offset 100000) | "Permanently and immediately erases the computer by sending a macOS EraseDevice command to the computer."
- L-15. UNCONFIRMED: the Jamf Pro API command type value ERASE_DEVICE that the read-back passes to `jamf-client.js verify-command --type`. The page in L-14 names the Apple command EraseDevice, not an API type string, and Jamf's API reference is on a host outside the allowed list. The value is the one this repo's adapter tests already use beside DEVICE_LOCK (scripts/adapters/inconclusive.test.js); the runbook says to read Management History in the GUI if the read finds nothing.
- No new lighter admin action was added for Jamf: the lighter steps are Lock Computer (an existing gate, as "Try first" before the wipe), plain user checks (FileVault: Caps Lock, input source, the previous password; Lost Mode: look for the device first), and "No lighter step" lines with their reasons.

## Fleet

- Fleet's documentation host is not on the allowed list, so no Fleet page was read and no new Fleet admin action was added. The Fleet sections use the runbook's existing gates (Lock before Wipe; the E1 pilot before the E2 batch) as "Try first" lines, and "No lighter step" lines with their reasons for the script run, Turn off MDM and the record deletion.
