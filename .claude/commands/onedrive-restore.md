---
description: Restore OneDrive / SharePoint files — version history, recycle bins, Files Restore (whole library to a point in time), and a departed user's OneDrive. Portal first. Placeholders only.
disable-model-invocation: true
---

# /onedrive-restore

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command.

**Verdict:** Match the tool to the loss. **One file/older version** → version history. **Deleted recently** → Recycle bin (then second-stage). **Ransomware / mass overwrite** → Files Restore (roll the whole OneDrive back to a point in time, up to 30 days). **Departed user** → grant manager access, then restore/transfer.

## What to check first
- What was lost: a version, a deleted file, or many files? When? (Files Restore window = 30 days.)
- Is it OneDrive (personal) or a SharePoint library (shared)?
- **Restore to a safe place first** (answer-format section 2, rule c): look before replacing. One file: open the older version from Version history, which does not overwrite the current one (`docs/aegis/batch12/vendor-facts-runbook-rules.md` RR-05), and save it under a new name beside the live file; the owner compares the two, and only then is it restored over the live file, which makes it the current version (RR-06). A whole OneDrive: before Files Restore, copy the files changed after the restore point that are still good into a separate folder, since files created after that point go to the recycle bin (RR-07); the owner checks the result, and a wrong restore is undone by running Restore again (RR-08).
- **A smell of compromise** (rule a): many files overwritten or renamed with a strange extension, or a ransom note, points to ransomware. Name the escalation to the security lead or the security on-call before any restore (they need the account, the device that synced the changes, when the changes started from the activity chart, and one affected file name); a device that is still syncing can overwrite a restore.
- **Least privilege** (rule b): the access step 4 gives the manager is admin rights on the whole OneDrive. Who approves it (the leaver's manager, or the data owner for HR or finance data) is named in the ticket, and the access ends on a date written there, before the OneDrive's retention runs out.

## Step-by-step (portal/web first)

> **PREVIEW ONLY [onedrive-restore-actions]:** The state-changing path below is not authorized by this reference. Move the intended action to a separate reviewed runbook with resolved target, effect, scope, reversibility/checkpoint, and an action-specific exact confirmation.
1. **Older version of a file:** in OneDrive/SharePoint web → right-click the file → **Version history** → restore the good version.
2. **Recently deleted:** OneDrive → **Recycle bin** → restore. If not there → **Second-stage recycle bin** (bottom of recycle bin) — items live ~93 days total.
3. **Mass loss / ransomware (whole OneDrive back in time):** OneDrive → Settings (gear) → **Restore your OneDrive** → pick a date (uses the activity histogram) → Restore. Undoes all changes after that point.
4. **Departed user's OneDrive:** M365 admin → Users → `[UPN]` → **OneDrive** tab → **Create link to files** (grants you/manager access) → restore or move data. (Coordinated in `/offboard`; OneDrive retained per retention policy after deletion.)

<details>
<summary>PowerShell — for reference only (SharePoint/PnP)</summary>

```powershell
# Grant a manager access to a departed user's OneDrive (admin)
Connect-SPOService -Url "https://[@Aegion_DOMAIN_SP]-admin"          # SharePoint admin endpoint
# PREVIEW ONLY [onedrive-manager-admin] — non-executing permission-grant reference; use a separate reviewed runbook with a removal rollback.
# Set-SPOUser -Site "https://[@Aegion_DOMAIN_SP]/personal/[UPN_PATH]" -LoginName "[MANAGER_NAME]" -IsSiteCollectionAdmin $true
# (File-level restore is done in the web UI / Files Restore — no destructive PS needed)
```
</details>

## ⚠️ Risk warning
- **Files Restore is itself a bulk change** — it reverts everything after the chosen point and can undo good edits. This reference has no execution gate: move the exact tenant/user, restore point, staged item/count evidence, checkpoint, and rollback limits to a separate target-bound gate before any restore.
- Second-stage recycle bin and retention windows expire — act before the clock runs out.

## ✅ Verification checklist
- [ ] The restore was checked as a copy, or the good later files were copied aside, before live data was replaced (rule c)
- [ ] User confirms the restored file/version/library is correct
- [ ] (Files Restore) only the intended time range was rolled back
- [ ] (Departed user) manager has access; data transferred if needed
- [ ] No newer good edits were lost by a bulk restore

## 📝 Jira-ready note
> Resolved [date/time]. Restored [file version / deleted items / OneDrive to [date] via Files Restore / departed user `[UPN]` OneDrive to [MANAGER_NAME]]. User confirmed correct data. Time spent: [X] min.
