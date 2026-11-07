# Exchange Online, read-only: setting up the connector on a TEST tenant

Aegis advises; humans execute (`PRODUCT_CONTRACT.md`). This page is for the owner. It says how to
give `scripts/adapters/exo-client.js` a read-only sign-in on a **test** tenant, what the connector
reads, and what it never does. Do this on a test or trial tenant first, never on a customer tenant.
Every fact below is from Microsoft Learn, opened on 2026-11-06, and is listed with its quote in
[the batch 9 vendor facts](../batch9/vendor-facts.md) ("Exchange Online (task 4)", X-01 to X-27).
The setup steps follow Microsoft's page
[App-only authentication for unattended scripts](https://learn.microsoft.com/powershell/exchange/app-only-auth-powershell-v2).

## What the connector reads, and what it never does

It runs PowerShell 7 (`pwsh`) with the ExchangeOnlineManagement module (version 2.0.4 or later,
X-01) and four read cmdlets, nothing else:

| Command | Cmdlet | What it shows |
|---|---|---|
| `mailbox-permissions --mailbox [SHARED_MAILBOX]` | `Get-MailboxPermission -Identity` | who has Full Access (User, AccessRights, Deny, IsInherited) |
| `recipient-permissions --mailbox [SHARED_MAILBOX]` | `Get-RecipientPermission -Identity` | who has Send As (Trustee, AccessControlType, AccessRights) |
| `send-on-behalf --mailbox [SHARED_MAILBOX]` | `Get-Mailbox -Identity` | the GrantSendOnBehalfTo field only |
| `quarantine-message --identity <GUID1\GUID2>` or `--message-id <Message-ID> --recipient [UPN]` | `Get-QuarantineMessage` | Identity, MessageId, RecipientAddress, ReleaseStatus, Type (never the subject or body) |
| `verify-mailbox-permission --mailbox ... --delegate [UPN] [--absent]` | `Get-MailboxPermission -Identity -User` (Exchange resolves the delegate in any form) | proves a person granted (or removed) Full Access |
| `verify-recipient-permission --mailbox ... --delegate [UPN] [--absent]` | `Get-RecipientPermission -Identity -Trustee`, then `-Identity` alone (the filter can miss a principal with several Sids, X-13) | proves a person granted (or removed) Send As |
| `verify-quarantine-released --identity ...` or `--message-id ... --recipient ...` | `Get-QuarantineMessage` | proves a person released the message (ReleaseStatus RELEASED) |

Known limit: a permission read-back proves the grant to the delegate, not access the delegate has
through a group. A PowerShell run that exits 0 but writes error text is a failed read (exit 2).

It never grants or removes a permission, never changes a mailbox, never releases or deletes a
message and never changes a policy. Those are steps a person runs in the Exchange admin center or
the Microsoft Defender portal; the `verify-*` command reads the result afterwards.

How it stays read-only:

- Every command is built from fixed text plus validated values. A cmdlet that is not one of the
  four, another parameter, or a value holding `;`, `|`, `{`, `}`, a backtick, `$`, a quote or a line
  break is refused before PowerShell starts.
- The values are never written into PowerShell script text. The script is fixed and sent with
  `-EncodedCommand`; the request travels as JSON in an environment variable and is passed to the
  cmdlet by splatting. The credentials are in the child's environment, never on its command line.
- `Connect-ExchangeOnline -CommandName` asks for the four read cmdlets only (X-07; whether this
  limits the session is not confirmed, so the role below is the boundary).
- The app holds only Exchange.ManageAsApp and the Global Reader role. Exchange Online does not show
  an app its role, so every live result prints a `scope_notice` saying Aegis could not check it.

## Set it up on the test tenant

You need a Microsoft 365 test or trial tenant with Exchange Online, one shared mailbox and two test
users. You sign in to the Microsoft Entra admin center as an admin of that test tenant.

1. **Register the app** (X-01). Microsoft Entra admin center > App registrations > New registration.
   Name it, for example, `Aegis EXO read-only (test)`. Supported account types: **Accounts in this
   organizational directory only (single tenant)**. No redirect URI. Select **Register**, and copy
   the **Application (client) ID** for `EXO_APP_ID`.
2. **Make a certificate** (X-25). It must come from a CSP key provider: CNG certificates are not
   supported. On Windows, Microsoft's example uses `New-SelfSignedCertificate ... -KeySpec
   KeyExchange`, then exports a `.pfx` (private key, password-protected) and a `.cer` (public key).
   Keep the `.pfx` and its password in your secret manager, never in this repository.
3. **Upload the certificate** (X-24). The app > Certificates & secrets > Certificates > Upload
   certificate > choose the `.cer` file > Add.
4. **Grant Exchange.ManageAsApp** (X-05, X-27). The app > API permissions > Add a permission > APIs
   my organization uses > **Office 365 Exchange Online** > Application permissions > Exchange >
   **Exchange.ManageAsApp** > Add permissions. Then **Grant admin consent for** the test tenant > Yes; the status reads "Granted". For the default Microsoft Graph >
   User.Read entry, select ... > **Revoke admin consent** > Yes. Add no other permission.
5. **Assign Global Reader to the app** (X-06). Microsoft Entra admin center > Roles and
   administrators > select the **Global Reader** role by its name > Add assignments > find and
   select the app from step 1 > Add. Check the app is listed on the role's Assignments page. Assign
   no other role: Exchange Administrator, Exchange Recipient Administrator, Helpdesk Administrator,
   Security Administrator and the rest can write.
6. **Set the environment, by name only** (names in `.env.example`; values from your secret manager,
   exported in the shell for the test and unset afterwards):
   - `EXO_APP_ID`: the Application (client) ID from step 1.
   - `EXO_ORGANIZATION`: the test tenant's primary `.onmicrosoft.com` domain (X-04).
   - `EXO_CERTIFICATE_PATH` and `EXO_CERTIFICATE_PASSWORD`: the `.pfx` file and its password; or, on
     Windows only, `EXO_CERTIFICATE_THUMBPRINT` with the certificate in the user store (X-03).
     Set one form, not both. Microsoft notes a stored password weakens the method (X-26), so prefer
     the thumbprint on Windows.
7. **Install the tools**: PowerShell 7 (`pwsh` on the PATH) and the module. WARNING: installing a
   PowerShell module is on the SR-2 list (`modules/security/security-doctrine.md`), so it needs your
   own explicit yes; you run it on the test machine, once, and Aegis never installs a module:
   `Install-Module -Name ExchangeOnlineManagement -Scope CurrentUser`.

## Run it once

Each command first as a dry run (prints the planned cmdlet, reads no credential, starts no
PowerShell), then with `--execute`. Use the test tenant's shared mailbox and test users.

```bash
node scripts/adapters/exo-client.js mailbox-permissions --mailbox [SHARED_MAILBOX]
node scripts/adapters/exo-client.js mailbox-permissions --mailbox [SHARED_MAILBOX] --execute
```

Good result: exit 0, a `data` list with the `NT AUTHORITY\SELF` entry and any delegates, and the
`scope_notice` line.

```bash
node scripts/adapters/exo-client.js verify-mailbox-permission --mailbox [SHARED_MAILBOX] --delegate [UPN]
node scripts/adapters/exo-client.js verify-mailbox-permission --mailbox [SHARED_MAILBOX] --delegate [UPN] --execute
```

Good result: the dry run exits 4 with `NOT VERIFIED`; after you grant the test user Full Access in
the Exchange admin center, the live run exits 0 with `"verified": true`. Then remove it and run the
same line with `--absent`: exit 0 again. Repeat with `recipient-permissions` and
`verify-recipient-permission` for Send As, `send-on-behalf`, and, after releasing a test message from
quarantine in the Defender portal, `quarantine-message` and `verify-quarantine-released --identity
<GUID1\GUID2>` (the message's Identity as `quarantine-message` prints it).

Under a change record a read-back runs with `--change [CHANGE_ID]`, as a runbook's Read-back line
writes it, for example:
`node scripts/adapters/exo-client.js verify-mailbox-permission --mailbox [SHARED_MAILBOX] --delegate [UPN] --absent --change [CHANGE_ID] --execute`.

## What this test run answers

Record each answer outside this repository (as the [test-tenant runbook](test-tenant-runbook.md)
says), then update the vendor facts:

- Does Global Reader run all four cmdlets? (not confirmed per cmdlet)
- Does `User` or `Trustee` print the delegate's address, or a display name? (X-22: a display name
  makes the permission read-backs INCONCLUSIVE, exit 5)
- Does `ReleaseStatus` print `RELEASED` in upper case after a release? (X-09)
- Does `-CommandName` stop any other cmdlet from running in the session? (X-07)

Exit codes: 0 read or verified; 1 refused, input error or missing credentials (the message names
the variable); 2 the read failed or the read-back did not prove the change; 4 a read-back's dry
run; 5 INCONCLUSIVE, an answer that proves nothing either way (not JSON, a field missing, more or
fewer than one matching record, an unknown ReleaseStatus).
