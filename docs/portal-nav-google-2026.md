# 2026 Admin Navigation — Google Workspace, Okta, Jamf Pro, Apple Business, Fleet, macOS

Exact navigation paths for the Google / Okta / Jamf / macOS lane, in the same
layout as `docs/portal-nav-2026.md` (the Microsoft companion). Aegis reads this on
demand when a ticket needs a path. Every path below was checked against the live
official vendor page named next to it on **2026-10-15**; a path whose page could
not be opened would carry `[unverified: fetch blocked]` (none in this revision).
`scripts/lint/command-structure.js` fails the build if a retired wording comes
back (its `STALE_PORTAL_PATHS_G1` table lists the retired forms, so this page never
re-teaches them). Update this file when a vendor moves things.

Notes that change how paths read in 2026:
Google's help articles now live at knowledge.workspace.google.com (the old
support.google.com/a links redirect there); Okta's Identity Engine menu is
**Applications and Resources**; Apple Business Manager is now **Apple Business**
and its "MDM server" is now a **device management service**; Jamf Pro's erase
command is **Wipe Computer** (Jamf Pro 11.33.0 documentation).

---

## Google Admin console (admin.google.com)
> **PREVIEW ONLY [portal-nav-google-admin-reference]:** Navigation reference only. Every state-changing control named below requires its owning action-specific runbook, resolved target, pre-state, exact confirmation, and read-back; do not click it from this reference.

- Users: Directory → Users — knowledge.workspace.google.com/admin/users/add-an-account-for-a-new-user (checked 2026-10-15)
- Add a user: Directory → Users → Add new user — knowledge.workspace.google.com/admin/users/add-an-account-for-a-new-user (checked 2026-10-15)
- Suspend a user: Directory → Users → [user row] → More options → Suspend user — knowledge.workspace.google.com/admin/users/suspend-a-user-temporarily (checked 2026-10-15)
- Restore a suspended user: Directory → Users → filter User status = Suspended → More options → Reactivate — knowledge.workspace.google.com/admin/users/restore-a-suspended-user (checked 2026-10-15)
- Delete a user: Directory → Users → [user row] → More options → Delete user — knowledge.workspace.google.com/admin/users/delete-or-remove-a-user-from-your-organization (checked 2026-10-15)
- Recover a deleted user (20 days, super admin): Directory → Users → More options → Recently deleted users → Recover — knowledge.workspace.google.com/admin/users/restore-a-recently-deleted-user (checked 2026-10-15)
- Rename a user: Directory → Users → [user row] → Rename user — knowledge.workspace.google.com/admin/users/change-a-users-email-address (checked 2026-10-15)
- Reset a password: Directory → Users → [user row] → Reset password — knowledge.workspace.google.com/admin/users/reset-a-users-password (checked 2026-10-15)
- Organizational unit: Directory → Users → tick the user → More → Change organizational unit → Continue → Change — knowledge.workspace.google.com/admin/users/advanced/move-users-to-an-organizational-unit (checked 2026-10-15)
- Licences for one user: Directory → Users → [user] → Licenses — knowledge.workspace.google.com/admin/billing/assign-remove-and-reassign-licenses (checked 2026-10-15)
- Automatic licensing: Billing → License settings — knowledge.workspace.google.com/admin/billing/assign-remove-and-reassign-licenses (checked 2026-10-15)
- Group members: Directory → Groups → [group] → Members → Add members — knowledge.workspace.google.com/admin/groups/add-or-invite-users-to-a-group (checked 2026-10-15)
- Remove a group member: Directory → Groups → [group] → Members → point to the member → Remove — knowledge.workspace.google.com/admin/groups/remove-or-ban-users-from-a-group (checked 2026-10-15)
- User security page (2SV backup codes, sign-in cookies, app passwords, connected apps, passkeys & security keys): Directory → Users → [user] → Security — knowledge.workspace.google.com/admin/security/manage-a-users-security-settings (checked 2026-10-15)
- 2-Step Verification policy: Security → Authentication → 2-step verification — knowledge.workspace.google.com/admin/security/deploy-2-step-verification (checked 2026-10-15)
- Context-Aware Access: Security → Access and data control → Context-Aware Access — knowledge.workspace.google.com/admin/security/deploy-context-aware-access (checked 2026-10-15)
- Admin roles (one user): Directory → Users → [user] → Admin roles and privileges — knowledge.workspace.google.com/admin/users/make-a-user-an-admin (checked 2026-10-15)
- Admin roles (role list): Account → Admin roles — knowledge.workspace.google.com/admin/users/assign-specific-admin-roles (checked 2026-10-15)
- Customer ID: Account → Account settings → Profile — knowledge.workspace.google.com/admin/getting-started/find-your-customer-id (checked 2026-10-15)
- Drive ownership transfer: Apps → Google Workspace → Drive and Docs → Transfer ownership — knowledge.workspace.google.com/admin/drive/transfer-drive-files-to-a-new-owner-as-an-admin (checked 2026-10-15)
- Calendar events transfer: Apps → Google Workspace → Calendar → Event and Secondary calendar management → Events transfer — knowledge.workspace.google.com/admin/calendar/cancel-or-transfer-events-or-secondary-calendars-before-deleting-a-user (checked 2026-10-15)
- DKIM: Apps → Google Workspace → Gmail → Authenticate email — knowledge.workspace.google.com/admin/security/set-up-dkim (checked 2026-10-15)
- Email Log Search: Reporting → Email Log Search — knowledge.workspace.google.com/admin/support/troubleshooting/find-messages-with-email-log-search (checked 2026-10-15)
- Admin log events: Reporting → Audit and investigation → Admin log events — knowledge.workspace.google.com/admin/reports/admin-log-events (checked 2026-10-15)
- User log events: Reporting → Audit and investigation → User log events — knowledge.workspace.google.com/admin/reports/user-log-events (checked 2026-10-15)
- Drive log events: Reporting → Audit and investigation → Drive log events — knowledge.workspace.google.com/admin/reports/drive-log-events (checked 2026-10-15)
- Mobile devices: Devices → Mobile & endpoints → Devices (or Devices → Overview → the Mobile devices card) — knowledge.workspace.google.com/admin/devices/view-mobile-device-details (checked 2026-10-15)

## ChromeOS devices (admin.google.com)
> **PREVIEW ONLY [portal-nav-google-chrome-reference]:** Navigation reference only. Disable, reset (powerwash), and deprovision are separate gated actions in their owning runbook; do not click them from this reference.

- Chrome devices: Devices → Chrome → Devices — support.google.com/chrome/a/answer/3523633 (checked 2026-10-15)
- Device actions (disable, re-enable, deprovision): Devices → Chrome → Devices → [device] → actions — support.google.com/chrome/a/answer/3523633 (checked 2026-10-15)
- Remote reset (Clear User Profiles or Factory Reset): Devices → Chrome → Devices → [device] → Reset — support.google.com/chrome/a/answer/1360642 (checked 2026-10-15)
- Forced re-enrollment setting: Devices → Chrome → Settings → Device settings → Enrollment and access — support.google.com/chrome/a/answer/6352858 (checked 2026-10-15)

## Okta Admin Console ([@Aegion_OKTA_ORG_URL])
> **PREVIEW ONLY [portal-nav-okta-reference]:** Navigation reference only. Lifecycle, authenticator, session, and assignment changes require their owning gated runbook; do not execute them from this page.

- People: Directory → People — help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-end-user-states.htm (checked 2026-10-15)
- Suspend / deactivate / activate: Directory → People → [user] → More Actions — help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-deactivate-user-account.htm (checked 2026-10-15)
- Password: Directory → People → [user] → Reset or Remove password — help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-reset-individual.htm (checked 2026-10-15)
- Authenticators (one user): Directory → People → [user] → More Actions → Reset Authenticators — help.okta.com/oie/en-us/content/topics/security/mfa/mfa-reset-users.htm (checked 2026-10-15)
- Sessions: Directory → People → [user] → More Actions → Clear User Sessions — help.okta.com/oie/en-us/content/topics/oda/device-logout.htm (checked 2026-10-15)
- Apps: Applications and Resources → Applications → [app] → Assignments — help.okta.com/oie/en-us/content/topics/provisioning/lcm/lcm-assign-app-user.htm (checked 2026-10-15)
- Authenticator policy: Security → Authenticators — help.okta.com/oie/en-us/content/topics/identity-engine/authenticators/configure-yubikey-otp.htm (checked 2026-10-15)
- System Log: Reports → System Log — help.okta.com/oie/en-us/content/topics/oda/device-logout.htm (checked 2026-10-15)

## Jamf Pro ([@Aegion_JAMF_URL])
> **PREVIEW ONLY [portal-nav-jamf-reference]:** Navigation reference only. Lock, wipe, MDM-profile removal, unmanage, and Lost Mode are separate gated actions; do not send them from this page.

- Computers: Computers → Search inventory — learn.jamf.com/r/en-US/jamf-pro-documentation-current/Performing_a_Simple_Computer_Search (checked 2026-10-15)
- Remote commands: Computers → Search inventory → [computer] → Management tab → the command button (Lock Computer, Wipe Computer, Remove MDM Profile) — learn.jamf.com/r/en-US/jamf-pro-documentation-current/Sending_a_Remote_Command_to_a_Computer (checked 2026-10-15)
- Pending commands: [computer] → History → Pending Commands — learn.jamf.com/r/en-US/jamf-pro-documentation-current/Remote_Commands_for_Computers (checked 2026-10-15)
- PreStage enrollments: Computers → PreStage enrollments — learn.jamf.com/r/en-US/jamf-pro-documentation-current/Configuring_a_Computer_PreStage_Enrollment (checked 2026-10-15)
- Automated Device Enrollment instance: Settings → Global → Automated Device Enrollment — learn.jamf.com/r/en-US/jamf-pro-documentation-current/Uploading_the_Server_Token_File_to_Configure_Automated_Device_Enrollment (checked 2026-10-15)
- API clients: Settings → System → API roles and clients — developer.jamf.com/jamf-pro/docs/client-credentials (checked 2026-10-15)
- Lost Mode (supervised iPhone/iPad): Devices → Search inventory → [device] → Management → Enable/Disable Lost Mode — learn.jamf.com/r/en-US/jamf-pro-documentation-current/Enabling_Lost_Mode (checked 2026-10-15)

## Apple Business (formerly Apple Business Manager)
> **PREVIEW ONLY [portal-nav-apple-business-reference]:** Navigation reference only. Device assignment and release are gated actions in their owning runbook; release cannot be undone — do not use it from this page.

- Device inventory: Devices → Inventory — support.apple.com/guide/business/assign-reassign-or-unassign-devices-axmf500c0851/web (checked 2026-10-15)
- Assign to the device management service: Devices → Inventory → [device] → Assign Device Management — support.apple.com/guide/business/assign-reassign-or-unassign-devices-axmf500c0851/web (checked 2026-10-15)
- Default assignment per device type: Devices → Management Services → Default Device Assignment — support.apple.com/guide/business/assign-reassign-or-unassign-devices-axmf500c0851/web (checked 2026-10-15)
- Release from the organization (irreversible): Devices → Inventory → [device] → Release from Organization — support.apple.com/guide/business/release-devices-axmec4d28461/web (checked 2026-10-15)

## Fleet
> **PREVIEW ONLY [portal-nav-fleet-reference]:** Navigation reference only. Lock and wipe are gated actions; do not send them from this page.

- Hosts: Hosts → [host] → Actions (Lock, Wipe; Fleet Premium) — fleetdm.com/guides/lock-wipe-hosts (checked 2026-10-15)

## macOS System Settings (current Mac User Guide)
> **PREVIEW ONLY [portal-nav-macos-reference]:** Navigation reference only. Turning FileVault on or off, removing profiles, and erasing the Mac are separate gated actions; do not change them from this page.

- FileVault: System Settings → Privacy & Security → FileVault — support.apple.com/guide/mac-help/protect-data-on-your-mac-with-filevault-mh11785/mac (checked 2026-10-15)
- Profiles: System Settings → General → Device Management — support.apple.com/guide/mac-help/configuration-profiles-standardize-settings-mh35561/mac (checked 2026-10-15)
- Wi-Fi: System Settings → Wi-Fi — support.apple.com/guide/mac-help/wi-fi-settings-on-mac-mh11935/mac (checked 2026-10-15)
- Users & Groups: System Settings → Users & Groups — support.apple.com/guide/mac-help/change-users-groups-settings-mtusr001/mac (checked 2026-10-15)
- Software Update: System Settings → General → Software Update — support.apple.com/guide/mac-help/keep-your-mac-up-to-date-mchlpx1065/mac (checked 2026-10-15)
- Erase All Content and Settings: System Settings → General → Transfer or Reset → Erase All Content and Settings — support.apple.com/guide/deployment/erase-devices-dep0a819891e/web (checked 2026-10-15)

## Zoom Rooms (Zoom web portal)
> **PREVIEW ONLY [portal-nav-zoom-rooms-reference]:** Navigation reference only. Remote restarts are gated actions in their owning runbook; do not trigger them from this page.

- Rooms: Room Management → Zoom Rooms — support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0068519 (checked 2026-10-15; read through a rendered fetch — the portal returns no article text to curl)
- Remote restart: Room Management → Zoom Rooms → [room] → Edit → Devices → Restart Zoom Rooms App / Restart Zoom Rooms Computer — support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0068519 (checked 2026-10-15; rendered fetch)
