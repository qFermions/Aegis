---
description: Troubleshoot network printer issues — offline, stuck queue, driver, single-user failure, add by IP, VLAN/DHCP check. GUI first. Placeholders only.
---

# /printer-issue

**Verdict:** Most printer problems fall into four buckets: the Print Spooler service is stuck, the printer has a stale/wrong IP, a driver mismatch on one user's machine, or the printer is on the wrong VLAN and can't get a DHCP lease. Identify which bucket first, then follow the matching fix below.

## What to check first
- Can anyone print, or is it just one user? One user = driver/queue issue on their machine. No one = printer, network, or spooler issue
- Is the printer powered on and showing a ready light?
- Can you ping [PRINTER_IP] from your machine? If no ping = network/IP issue. If ping works = software issue
- Check the printer's own display panel for paper jams, low toner alerts, or error codes

## Step-by-step fix

---

**Network printer not showing up (can't find it to add)**

1. Confirm the printer has a valid IP — print a configuration page from the printer's front panel (usually Menu → Print Config Page)
2. Note the IP ([PRINTER_IP]) and confirm it's on the correct VLAN/subnet for your site
3. On Windows: `Settings → Bluetooth & devices → Printers & scanners → Add a printer or scanner`
4. If the printer doesn't appear in the auto-scan list, click **"The printer that I want isn't listed"**
5. Choose **"Add a printer using a TCP/IP address or hostname"** → enter [PRINTER_IP] → Next
6. Windows will detect the port and suggest a driver — confirm or install the correct driver (see Driver issues below)

---

**Stuck print queue / spooler restart**

1. On the affected machine: `Win + R → services.msc`
2. Scroll to **Print Spooler** → right-click → **Stop**
3. Open File Explorer → navigate to `C:\Windows\System32\spool\PRINTERS`
4. Delete all files in that folder (do NOT delete the folder itself — only the contents)
5. Back in Services: **Print Spooler** → right-click → **Start**
6. Retry the print job

<details>
<summary>PowerShell — for reference only</summary>

```powershell
# Stop the Print Spooler service so files can be deleted
Stop-Service -Name Spooler -Force  # forcefully stops the spooler — open jobs will be lost

# Delete all stuck jobs in the spooler queue folder
Remove-Item -Path "C:\Windows\System32\spool\PRINTERS\*" -Force -Recurse  # clears all pending print jobs; only files inside, never the folder itself

# Restart the Print Spooler service
Start-Service -Name Spooler  # starts the service again so new jobs can be processed

# Confirm the service is running
Get-Service -Name Spooler | Select-Object Name, Status  # should return "Running"
```

</details>

---

**Driver issues (reinstall / update driver)**

1. `Settings → Bluetooth & devices → Printers & scanners → [PRINTER_NAME] → Printer properties → Advanced tab`
2. Note the current driver name
3. Download the latest driver from the printer manufacturer's website for your exact model
4. `Control Panel → Devices and Printers → right-click [PRINTER_NAME] → Printer properties → Advanced → New Driver` → run the wizard with the downloaded driver
5. Alternatively: remove the printer entirely, run the downloaded driver installer, then re-add via TCP/IP (see "Add new printer" below)

---

**Printer shows offline but is powered on**

1. On Windows: `Settings → Bluetooth & devices → Printers & scanners → [PRINTER_NAME] → Open print queue`
2. In the print queue window: `Printer menu → uncheck "Use Printer Offline"`
3. If that doesn't work: `Printer menu → Set as Default Printer` and re-test
4. Confirm the printer's IP hasn't changed — print a config page from the printer to verify current IP vs what Windows has configured
5. If the IP has changed: remove and re-add the printer using the new [PRINTER_IP] (see Add new network printer below)
6. As a last resort: remove the printer, reboot the machine, and re-add

---

**One user can't print but others can (user-side issue)**

1. On the affected machine: `Settings → Bluetooth & devices → Printers & scanners` — confirm the printer appears and is not in error state
2. Open the print queue: check for stuck jobs with error status — delete them
3. Restart the Print Spooler (see Stuck queue steps above)
4. Compare the driver version against a working machine: `Printers & scanners → [PRINTER_NAME] → Printer properties → Advanced tab → Driver`
5. If the driver version differs: reinstall the correct driver on the affected machine (see Driver issues above)
6. Check that the user has print permissions: some printers are access-controlled via Active Directory printer deployment — confirm the user is in the correct group in ADUC or Entra

---

**Add a new network printer (by IP)**

1. On the target machine: `Settings → Bluetooth & devices → Printers & scanners → Add device`
2. Wait for auto-scan; if the printer doesn't appear: **"The printer that I want isn't listed"**
3. Select **"Add a printer using a TCP/IP address or hostname"**
4. Enter [PRINTER_IP] → Next → Windows detects the port
5. Select or install the driver: choose from the Windows built-in list, or click **"Have Disk"** and browse to the downloaded driver .INF file
6. Name the printer clearly (e.g., `[SITE]-[FLOOR]-[MODEL]`) → set as default if appropriate → Finish
7. Print a test page to confirm

---

**Meraki VLAN/DHCP check (printer has wrong IP or can't be reached)**

`Meraki dashboard → [Site Network] → Switch → DHCP`
1. Confirm the printer's MAC address has a DHCP lease on the correct VLAN
   - Navigate to: `Network-wide → Clients` → search for the printer by MAC or IP
   - Check "VLAN" column — printer should be on the correct staff or device VLAN, not the guest VLAN
2. If the printer is on the wrong VLAN: check the switch port it's connected to
   - `Switch → Switches → [Switch name] → Ports` → find the port by MAC → confirm it's in the correct access VLAN
3. If no DHCP lease is showing: the printer may have a static IP outside the DHCP range — print a config page to confirm
4. To set a DHCP reservation (recommended for printers): `Security & SD-WAN → DHCP → [VLAN] → Fixed IP assignments` → add MAC → assign [PRINTER_IP] → Save

## ⚠️ Risk warning
- Restarting the Print Spooler drops all active print jobs — warn users before doing it on a shared print server
- Deleting files from `C:\Windows\System32\spool\PRINTERS` removes all pending jobs permanently — there is no undo
- Changing a printer's VLAN assignment on a Meraki switch port will briefly disconnect the printer from the network (~5 seconds)
- Driver changes affect only the machine you're on; if the printer is deployed via Group Policy, a driver update there affects all machines that receive the policy

## ✅ Verification checklist
- [ ] Printer shows "Ready" status in Windows Printers & scanners
- [ ] Print queue is empty and no jobs are stuck
- [ ] Test page prints successfully from the affected machine
- [ ] Ping [PRINTER_IP] succeeds from the user's machine
- [ ] Meraki client list shows the printer on the correct VLAN with a stable IP
- [ ] If driver was changed: other users on different machines can still print normally

## 📝 Jira-ready note
> Investigated printer issue reported at [@Aegion] — [BRIEF_SYMPTOM e.g. "printer offline / queue stuck / one user can't print"]. Root cause: [CAUSE]. Fix applied: [ACTION — e.g. "restarted Print Spooler, cleared queue, reinstalled driver, re-added printer by IP [PRINTER_IP]"]. Verified: test page printed successfully. Time spent: [X] min.
