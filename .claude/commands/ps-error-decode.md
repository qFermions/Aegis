---
description: PowerShell error decoder — anatomy of red-text errors, common errors with plain-English fixes, and how to extract full error details. Reference doc, not a portal procedure.
---

# /ps-error-decode

**Verdict:** PowerShell errors follow a consistent structure — exception type → message → script line → position. Read the error top-to-bottom: the first line tells you *what* failed, the second tells you *where*, and "CategoryInfo" tells you *why*. Most IT errors fall into six patterns: missing module, wrong permissions, bad data type (or a placeholder not replaced), network block, auth token expired, or a cascading failure from a previous error.

---

## Anatomy of a PowerShell error

When PowerShell shows red text, it has up to four parts:

```
<ExceptionType>: <Error message>                   ← What broke and why
At <script or command>:<line number>               ← Where in the script
char:<position>                                    ← Column in that line
+ CategoryInfo    : <category> [<cmdlet>]          ← Type of failure
+ FullyQualifiedErrorId : <error ID>, <cmdlet>     ← Specific error code
```

**What to read first:**
- The **first line** = the plain error message. This is what you Google.
- **"At line:X char:Y"** = the exact line that failed. Go there in your script.
- **CategoryInfo** = broad type: `ObjectNotFound` (not installed/wrong path), `PermissionDenied` (access issue), `InvalidArgument` (wrong data type or placeholder), `ConnectionError` (network), `AuthenticationError` (re-auth needed).

---

## Common errors — plain-English fix

| Error message | What it means | Fix |
|---------------|---------------|-----|
| `The term 'Get-MgUser' is not recognized as the name of a cmdlet` | The Microsoft Graph module is not installed or not imported in this session | Run `Install-Module Microsoft.Graph -Scope CurrentUser` (once per machine), then `Import-Module Microsoft.Graph` (each session). Same pattern for `ExchangeOnlineManagement` or any other module. |
| `Access is denied` | Your account doesn't have permission, OR the PowerShell session wasn't started as Administrator | If it's a local operation: right-click PowerShell → Run as Administrator. If it's a cloud operation: your admin account is missing a required Entra role — check **Entra → Roles and administrators**. |
| `Cannot bind argument to parameter 'UserId' because it is null` | A variable or parameter is empty — most often a `[PLACEHOLDER]` that was never replaced with a real value | Search your script for `[PLACEHOLDER]` text or any variable that equals `$null`. Replace it with the actual value before running. |
| `Cannot bind parameter 'X'. Cannot convert value "Y" to type "Z"` | Wrong data type passed — e.g., passing a plain string where an object is expected | Check the cmdlet's `-X` parameter docs. You may need to wrap the value (e.g., `[GUID]"..."` or use a `Get-*` call to retrieve the object first). |
| `AADSTS700016: Application not found` / `Unauthorized` / `AuthorizationRequestDenied` | Your auth token expired or you connected with the wrong permission scopes | Re-run the connect command: `Connect-MgGraph -Scopes "User.ReadWrite.All","Directory.ReadWrite.All"` (adjust scopes for your task). For Exchange: `Connect-ExchangeOnline -UserPrincipalName [UPN]`. |
| `Connect-MgGraph: The remote server returned an error: (400) Bad Request` | Wrong or unsupported `-Scopes` value, or tenant conditional access is blocking the sign-in | Verify the exact scope names at [Microsoft Graph permissions reference]. Confirm no Conditional Access policy blocks this admin account from signing in. |
| `The pipeline has been stopped` | A previous cmdlet in a pipeline threw an error and PowerShell aborted the whole pipeline | Read the error that appeared *before* this one — that's the root cause. Fix that error first; this one will disappear. |
| `Insufficient privileges to complete the operation` | The Graph or Exchange cmdlet needs a higher admin role than your account currently has | In Entra admin center → Roles and administrators → assign the required role (e.g., User Administrator, Exchange Administrator) to your account. Re-authenticate after the role is assigned. |
| `New-MgUser: A conflicting object with one or more of the specified property values is present` | A user with that UPN or email already exists in the directory | Check with `Get-MgUser -UserId [UPN]` before creating. If the account exists as a soft-deleted object, restore or permanently delete it first. |
| `Get-ADUser: Unable to find a default server` | The script is running on a machine that can't reach the on-prem Active Directory domain controller | Run the script from the AD Connect server or a domain-joined machine. Or specify the DC explicitly: `Get-ADUser -Server "[DC_FQDN]" ...` |
| `VERBOSE: Connecting ... OperationStopped: Connection timed out` | Network or firewall is blocking the connection to the target service | Check internet connectivity first (`Test-NetConnection -ComputerName "graph.microsoft.com" -Port 443`). If blocked, check the Meraki MX firewall outbound rules — port 443 (HTTPS) must be open. |

---

## Get the full error details

When the red text is truncated or you need more context, use these:

```powershell
# Show every property of the most recent error — the full story
$Error[0] | Format-List * -Force
# $Error[0] = the last error that occurred
# Format-List * = show all properties (not just the short summary)
# -Force = include hidden/protected properties

# See just the exception type and message clearly
$Error[0].Exception | Format-List * -Force
# .Exception = the underlying .NET exception object

# See exactly which line number threw the error
$Error[0].InvocationInfo | Format-List *
# .InvocationInfo = the script position, line, and command that failed

# Check all recent errors (newest first)
$Error | Select-Object -First 5 | Format-List CategoryInfo, Exception
# Useful when a pipeline produced multiple errors
```

### Make errors stop the script and be catchable

By default, PowerShell "non-terminating" errors don't stop execution — they just print red text and keep going. This means a failing step won't actually stop your script. Fix it with `-ErrorAction Stop` + `try/catch`:

```powershell
try {
    # -ErrorAction Stop turns any error into a terminating error
    # so the catch block runs instead of silently continuing
    Get-MgUser -UserId "[UPN]" -ErrorAction Stop
}
catch {
    # $_.Exception.Message = the plain-English error message
    Write-Host "Failed: $($_.Exception.Message)"
    # Add your fallback or exit logic here
}
```

> Use `-ErrorAction Stop` on any cmdlet where a failure should halt the script. Without it, your script may silently skip a failed step and continue — dangerous for multi-step operations like onboarding or offboarding.

---

## ✅ Verification checklist

- [ ] Re-ran the failing command after the fix — no red error text
- [ ] `$Error[0]` is either empty or a different (unrelated) error
- [ ] The command produced expected output (e.g., `Get-MgUser` returned the user object)
- [ ] If a module was installed: `Get-Module -Name Microsoft.Graph -ListAvailable` confirms it's present
- [ ] If an auth issue: `Get-MgContext` shows the correct account, tenant, and scopes
- [ ] If a placeholder was the problem: the script now contains no `[PLACEHOLDER]`-style text

---

## 📝 Jira-ready note

> **PowerShell error resolved — [JIRA-###]**
>
> Encountered error while running [SCRIPT/COMMAND]: "[ERROR_MESSAGE]". Root cause: [MODULE_NOT_INSTALLED / WRONG_PERMISSIONS / PLACEHOLDER_NOT_REPLACED / AUTH_TOKEN_EXPIRED / OTHER]. Fix applied: [DESCRIBE_FIX — e.g., "installed Microsoft.Graph module and reconnected with correct scopes"]. Command re-ran successfully and produced expected output. Verified with [GET_COMMAND or OUTPUT]. Closing ticket.
