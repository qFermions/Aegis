# Pre-Commit Hooks — Safety Scanner

Documentation for `scripts/pre-commit-check.js` — the automated security gate
that runs on every `git commit` in this repo.

---

## What It Does

The pre-commit hook scans every staged file for three classes of issues:

| Class | Severity | Effect |
|-------|---------|--------|
| PII (email, phone) | BLOCK | Commit is rejected — must fix before re-committing |
| Hardcoded credentials | BLOCK | Commit is rejected |
| Dangerous PowerShell / git cmdlets | WARN | Commit proceeds — operator is informed |

---

## How It's Installed

The hook is installed in `.git/hooks/pre-commit`:

```bash
#!/bin/sh
node scripts/pre-commit-check.js
```

To install on a fresh clone:

```bash
# Copy the hook from the repo into the .git/hooks directory
cp scripts/pre-commit-check.js.hook .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Or manually create `.git/hooks/pre-commit`:
```bash
#!/bin/sh
node scripts/pre-commit-check.js
```

---

## Scan Details

### PII Patterns (BLOCK)

Applied to all non-binary, non-backup files:

```javascript
// Real email addresses — anything except [YOUR_DOMAIN] placeholder
/\b[A-Za-z0-9._%+-]+@(?!YOUR_DOMAIN)[a-z0-9.-]+\.(org|com|net)\b/g

// Phone number patterns
/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g
```

**Exclusion:** Lines containing a `[PLACEHOLDER]` marker (text inside square brackets)
are skipped. This allows examples like `[user@YOUR_DOMAIN.COM]` to appear safely.

### Credential Patterns (BLOCK)

Applied to all non-binary files:

```javascript
// Variable assigned a string value containing password/secret/token/key/cred
/\$\w*(password|secret|token|key|cred)\w*\s*=\s*["'][^"']{4,}["']/i

// Telegram bot token format
/BOT_TOKEN\s*=\s*["'][0-9]+:[A-Za-z0-9_-]{35}["']/

// Generic API token (32+ char : 27+ char)
/\b[A-Za-z0-9]{32,}:[A-Za-z0-9_-]{27}\b/
```

### Dangerous Cmdlet Patterns (WARN)

Applied to `.ps1` and `.md` files, excluding documentation files
(CLAUDE.md, lessons.md, README.md — these legitimately list dangerous cmdlets as reference).

Full list of flagged patterns:

| Pattern | Risk |
|---------|------|
| `Remove-Item -Recurse -Force` | Mass file/directory deletion |
| `Remove-Mg*` | Graph API deletion (users, groups, devices) |
| `Remove-Mailbox` | Permanent mailbox deletion |
| `Format-*` | Disk format risk |
| `Clear-Mailbox` | Wipes mailbox contents |
| `Clear-MobileDevice` | Remote device wipe |
| `Disable-Mg*` / `Disable-ADAccount` | Account/object disable |
| `Revoke-Mg*` / `Revoke-*` | Session/token revocation |
| `BlockCredential $true` | Blocks user sign-in |
| `Invoke-Expression` / `IEX` | Arbitrary code execution |
| `Start-Process -FilePath` | Arbitrary process launch |
| `ConvertTo-SecureString -AsPlainText -Force` | Plaintext credential in script |
| `git push --force` / `git push -f` | Can overwrite remote history |
| `git reset --hard` | Destroys uncommitted work |

---

## Output Format

### Clean
```
pre-commit-check: ✓ Clean — no issues found.
```

### Blocked
```
╔══════════════════════════════════════════════╗
║  Aegis Pre-Commit Safety Check               ║
╚══════════════════════════════════════════════╝

  scripts/my-script.ps1
    🔴 BLOCK  Line 14: Real email address detected (use [USER@DOMAIN.COM] placeholder)
           → Connect-MgGraph -Scopes "User.Read.All" -AccountId "[USER@DOMAIN.COM]"

🔴 COMMIT BLOCKED — 1 critical issue(s) found.
   Fix the issues above, then re-stage and commit.
   To bypass (only if you are certain): git commit --no-verify
```

### Warning (commit proceeds)
```
╔══════════════════════════════════════════════╗
║  Aegis Pre-Commit Safety Check               ║
╚══════════════════════════════════════════════╝

  scripts/offboard-user.ps1
    ⚠️  WARN  Line 32: Disable-* — account/object disable
           → Disable-ADAccount -Identity $user.SamAccountName

⚠️  1 warning(s) found — review the flagged lines above.
   These are dangerous cmdlets in scripts. Confirm they are intentional.
   Commit will proceed. Add a ⚠️ comment in the script to acknowledge.
```

---

## How to Extend the Scanner

### Adding a New PII Pattern

In `scripts/pre-commit-check.js`, add to the `PII_PATTERNS` array:

```javascript
const PII_PATTERNS = [
  // ... existing patterns ...
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,  // US Social Security Number
    label: 'SSN pattern detected (use [SSN] placeholder)'
  },
];
```

### Adding a New Dangerous Cmdlet

In `scripts/pre-commit-check.js`, add to the `DANGEROUS_PS_PATTERNS` array:

```javascript
const DANGEROUS_PS_PATTERNS = [
  // ... existing patterns ...
  {
    pattern: /Remove-MgDevice/i,
    label: 'Remove-MgDevice — permanently deletes device from Entra'
  },
];
```

### Adding a File Extension to Skip

In the `checkFile` function, add to the extension exclusion list:

```javascript
if (!['.zip', '.png', '.jpg', '.pdf', '.exe', '.your-extension'].includes(ext) && !isBakFile) {
```

### Adding a Documentation File to Exclude from Cmdlet Scan

In the `isDocFile` regex on line 82:

```javascript
const isDocFile = /CLAUDE\.md$|CLAUDE\.md\.\w+$|lessons.*\.md$|README\.md$|YOUR_FILE\.md$/i.test(filePath);
```

---

## Testing the Scanner

```bash
# Run against all currently staged files
node scripts/pre-commit-check.js

# Test a specific scenario — stage a file with a known pattern
echo '$password = "abc"' > /tmp/test.ps1
git add /tmp/test.ps1
node scripts/pre-commit-check.js
# Should output: BLOCK — Hardcoded credential variable
git reset HEAD /tmp/test.ps1
```

---

## False Positives

The scanner occasionally flags legitimate content. Common cases:

| False positive | Cause | Resolution |
|---------------|-------|-----------|
| Example password in docs | Credential pattern in a code block | Wrap in a `[PLACEHOLDER]` marker or use `--no-verify` with comment |
| External email in vendor template | PII pattern | Replace with `[vendor@VENDOR_DOMAIN.COM]` |
| `Revoke-*` in an IR playbook | Dangerous cmdlet in a .md file | Add file to `isDocFile` exclusion regex |
| API token format in docs | Credential pattern | Use `[API_TOKEN_PLACEHOLDER]` format |
