---
description: Restore OneDrive / SharePoint files — version history, recycle bins, Files Restore (whole library to a point in time), and a departed user's OneDrive. Portal first. Placeholders only.
---

# /onedrive-restore

**Verdict:** Match the tool to the loss. **One file/older version** → version history. **Deleted recently** → Recycle bin (then second-stage). **Ransomware / mass overwrite** → Files Restore (roll the whole OneDrive back to a point in time, up to 30 days). **Departed user** → grant manager access, then restore/transfer.

## What to check first
- What was lost: a version, a deleted file, or many files? When? (Files Restore window = 30 days.)
- Is it OneDrive (personal) or a SharePoint library (shared)?

## Step-by-step (portal/web first)
1. **Older version of a file:** in OneDrive/SharePoint web → right-click the file → **Version history** → restore the good version.
2. **Recently deleted:** OneDrive → **Recycle bin** → restore. If not there → **Second-stage recycle bin** (bottom of recycle bin) — items live ~93 days total.
3. **Mass loss / ransomware (whole OneDrive back in time):** OneDrive → Settings (gear) → **Restore your OneDrive** → pick a date (uses the activity histogram) → Restore. Undoes all changes after that point.
4. **Departed user's OneDrive:** M365 admin → Users → `[UPN]` → **OneDrive** tab → **Create link to files** (grants you/manager access) → restore or move data. (Coordinated in `/offboard`; OneDrive retained per retention policy after deletion.)

<details>
<summary>PowerShell — for reference only (SharePoint/PnP)</summary>

```powershell
# Grant a manager access to a departed user's OneDrive (admin)
Connect-SPOService -Url "https://[@Aegion_DOMAIN_SP]-admin"          # SharePoint admin endpoint
Set-SPOUser -Site "https://[@Aegion_DOMAIN_SP]/personal/[UPN_PATH]" -LoginName "[MANAGER_NAME]" -IsSiteCollectionAdmin $true  # grant access
# (File-level restore is done in the web UI / Files Restore — no destructive PS needed)
```
</details>

## ⚠️ Risk warning
- **Files Restore is itself a bulk change** — it reverts everything after the chosen point; confirm the date with the user first (it can undo good edits made after the incident). This hits the confirmation gate.
- Second-stage recycle bin and retention windows expire — act before the clock runs out.

## ✅ Verification checklist
- [ ] User confirms the restored file/version/library is correct
- [ ] (Files Restore) only the intended time range was rolled back
- [ ] (Departed user) manager has access; data transferred if needed
- [ ] No newer good edits were lost by a bulk restore

## 📝 Jira-ready note
> Resolved [date/time]. Restored [file version / deleted items / OneDrive to [date] via Files Restore / departed user `[UPN]` OneDrive to [MANAGER_NAME]]. User confirmed correct data. Time spent: [X] min.
