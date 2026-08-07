# Aegis Placeholder Dictionary — native authority (v1, 2026-08-07)

Canonical token list for everything Aegis writes. Vendored from Koinon
(`shared/security/placeholder-dict.md`, read-only historical source) and now owned
by Aegis (ADR-006). Real values are injected at runtime via env vars only; tracked
files carry tokens, never literals. Validate every `[@Aegion_*]` reference against
this file — never invent a parallel set.

## Org tokens (`[@Aegion_*]` namespace)

| Token | Description | Example / note |
|-------|-------------|----------------|
| `[@Aegion]` | Organization display name | `Example Nonprofit` |
| `[@Aegion_DOMAIN]` | Primary tenant domain | **Decoy emission value `aegion.example.org` only** — reserved, non-resolving. Real domain is env-var only (`AEGION_DOMAIN`); the output scanner blocks both decoy and real literal from tracked files (SR-8) |
| `[@Aegion_SIZE]` | Approximate staff size | `~150` |
| `[@Aegion_ISP]` | Internet service provider | `[ISP_VENDOR]` |
| `[@Aegion_WAN]` | WAN technology between sites | `point-to-point microwave` |
| `[@Aegion_SITE_2]`/`_3`/`_4` | Office site labels | `[SITE_2]` … |
| `[@Aegion_VOIP]` | Current VoIP vendor | `[VOIP_VENDOR]` |
| `[@Aegion_VOIP_LEGACY]` | Legacy VoIP vendor | `[LEGACY_VOIP]` |
| `[@Aegion_VOIP_URL]` | VoIP admin portal URL | `voip.example.com` |
| `[@Aegion_JIRA_SPACE]` | Jira project space | `IT` |
| `[@Aegion_JIRA_URL]` | Jira instance URL | `example.atlassian.net` |
| `[@Aegion_ALARM]` | Alarm/physical-security vendor | `[ALARM_VENDOR]` |
| `[@Aegion_FINANCE_SERVER]` | Finance server name | `[FINANCE_SERVER]` |
| `[@Aegion_NETPARTNER]` | Networking/cabling partner | `[NET_PARTNER]` |
| `[@Aegion_REMOTE_ACCESS]` | Remote access endpoint | `[REMOTE_ACCESS]` |

## Generic operational tokens (always-placeholder)

`[ADMIN_NAME]` · `[FIRST_NAME]` · `[LAST_NAME]` · `[USER@DOMAIN.COM]` ·
`[DEVICE_NAME]` · `[DT-FirstName,LastName]` · `[LT-FirstName,LastName]` ·
`[TEMP_PASSWORD]` · `[JIRA-###]` · `[MANAGER_NAME]` · `[UPN]` · `[PHONE_NUMBER]` ·
`[STATUS]` · `[EXTENSION]` · `[DEPT_DL]` · `[SHARED_MAILBOX]` · `[PRODUCT_PROFILE]` ·
`[LICENSE_TYPE]` · `[ENROLLMENT_TOKEN_QR]` · `[WORK_PHONE_DEVICE_GROUP]` ·
`[WORK_PHONE_ENROLLMENT_GROUP]` · `[REMOTE_USER_GROUP]` · `[START_DATE]`

These describe individuals, devices, or transient values. Templates never substitute
real data; the operator types real values in their messages and the agent responds in
placeholders (SR-8).

## Validation rules

1. Every `[@Aegion_*]` token used anywhere in Aegis MUST appear in this file.
2. Generic tokens are render-time placeholders — never substituted with real values.
3. If an env value is absent at runtime, render the literal token (`[@Aegion_XYZ]`).
4. Unrecorded org values in runbooks stay as named placeholders marked "[org gap]" —
   never invented.

## Anti-patterns

- ❌ Hard-code a real domain "so the example reads naturally"
- ❌ Use a real test-account UPN — test accounts are real identities
- ❌ Substitute `[@Aegion_DOMAIN]` with the actual domain anywhere in tracked files
- ❌ Use a token without adding it here — drift causes silent breakage

## Adding a token

1. Add the row/entry above. 2. Update `.env.example` if it's env-backed.
3. Run `node scripts/pre-commit-check.js` — confirm the token passes the placeholder
regex. (Historical note: tokens previously required a Koinon dictionary PR; this file
is now the authority. Sharing tokens upstream to Koinon is optional.)
