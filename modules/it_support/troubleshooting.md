# Troubleshooting — Diagnostic Trees

Structured diagnostic flows for the 10 most common ticket types.
Each tree identifies root cause before prescribing a fix.

---

## T-01 — User Cannot Sign In

```
User reports: "Can't sign in" or "account locked"
│
├─ Is sign-in blocked?
│  Entra → Users → [UPN] → Edit properties → Block sign-in
│  YES → Unblock (if legitimate request) or escalate if unexpected
│
├─ Is password correct?
│  admin.microsoft.com → Users → [UPN] → Sign-in logs → look for "InvalidPassword"
│  YES (wrong pw) → Reset password (WF-04)
│
├─ Is MFA failing?
│  Sign-in log shows "MFA required but no method registered" or "MFA denied"
│  YES → Delete MFA methods + re-register (WF-03)
│
├─ Is Conditional Access blocking?
│  Sign-in log → Conditional Access tab → policy that applied → result = "Failure"
│  YES → Review which CA policy fired and why (device compliance? location block?)
│
└─ Account exists?
   Entra → Users → search [UPN] → not found?
   If hybrid AD: check on-prem ADUC. Did the AD sync run? Force sync.
```

### Key Portal Path
Entra → Identity → Users → `[UPN]` → Sign-in logs — this is always the first stop.
The `Conditional Access` tab in each sign-in event shows exactly which policy blocked and why.

---

## T-02 — New User Not Appearing in M365

```
Account created in on-prem AD but not visible in Entra/M365
│
├─ Has Entra Connect synced?
│  Entra → Hybrid management → Microsoft Entra Connect → Last sync time
│  If > 30 min ago → force sync: Start-ADSyncSyncCycle -PolicyType Delta
│
├─ Is the account in the right OU?
│  Entra Connect only syncs specific OUs (configured during setup)
│  Check: AD Connect server → Synchronization Service Manager → verify OU scope
│
├─ Is the UPN suffix correct?
│  On-prem AD UPN suffix must match the verified domain in Entra
│  ADUC → [user] → Account tab → UPN suffix dropdown → must be [@Aegion_DOMAIN]
│
└─ Any sync errors?
   Entra → Hybrid management → Entra Connect → Sync errors
   Common: duplicate UPN, duplicate proxy address
```

**Resolution time:** After forcing sync, allow 3–5 minutes for Entra to reflect changes.

---

## T-03 — Email Not Received / Missing

```
User reports: "I'm not getting emails from [sender]" or "email is missing"
│
├─ Check quarantine first
│  security.microsoft.com → Email & collaboration → Review → Quarantine
│  Search by recipient or sender — if found, release
│
├─ Run a message trace
│  EAC → Mail flow → Message trace
│  Enter: Sender, Recipient, Date range
│  Status:
│    "Delivered" → email arrived, check spam/focus inbox/rules
│    "FilteredAsSpam" → check anti-spam allow list
│    "Failed" → MX record issue or sender-side problem
│    "Pending" → in transit, wait or check connectors
│
├─ Check inbox rules
│  Is a user-created rule deleting or moving the email?
│  EAC → Mailboxes → [mailbox] → Manage mailbox policies → check rules
│  Or in Outlook: File → Manage Rules & Alerts
│
└─ Check safe senders list
   If sender is being quarantined repeatedly:
   security.microsoft.com → Policies → Anti-spam → allow list → add sender domain
   ⚠️ Only add trusted senders — this bypasses all filtering
```

---

## T-04 — Device Not Enrolling in Intune

```
User's device fails to enroll in Intune during setup
│
├─ Check enrollment restrictions
│  Intune → Devices → Enrollment → Enrollment restrictions
│  Is the device platform (iOS/Android/Windows) allowed?
│  Is the device type blocked (personal vs corporate)?
│
├─ Check user license
│  User must have an Intune-included license (M365 Business Premium includes it)
│  admin.microsoft.com → Users → [UPN] → Licenses — confirm license assigned
│
├─ Check device limit
│  Default: 5 devices per user
│  Intune → Devices → Enrollment → Device limit restrictions → check user's count
│
├─ iOS-specific: Is Company Portal installed?
│  User must install Company Portal from App Store before enrolling
│
├─ Android-specific: Is Work Profile enrollment mode correct?
│  Personal Android → Work Profile (BYOD)
│  Corporate Android → Fully managed or Dedicated
│
└─ Windows-specific: Azure AD Join vs Hybrid Join
   Azure AD Join: device signs in with work account → auto-enrolls
   Hybrid Join: requires Entra Connect + domain-joined device
   Check: Settings → Accounts → Access work or school → what type of join?
```

---

## T-05 — Slow Internet (Site-Specific)

```
Users at one site report: "internet is slow" or "Teams keeps dropping"
│
├─ Which site? Isolate to one location
│  Meraki → Network-wide → Clients → filter by site/network
│
├─ Is it all users or one user?
│  All users → likely WAN or AP issue
│  One user → likely device, VPN, or client issue
│
├─ WAN check (all users)
│  Meraki → Security & SD-WAN → Appliance status → Uplink
│  Check: throughput, latency, packet loss on WAN uplink
│  Compare against contracted speeds
│  High latency / packet loss → ISP issue → check ISP status page + open ticket
│
├─ AP check (wireless users)
│  Meraki → Wireless → Access points → [AP at that site]
│  Check: client count (>25 = overloaded), channel utilization, signal strength
│  Overloaded AP → check band steering + load balancing settings
│
├─ VPN conflict check (remote workers / site VPN)
│  Meraki → Security & SD-WAN → Site-to-site VPN → check tunnel status
│  Tunnel down → check MX uplink on both sides, peer IPs, subnet conflicts
│
└─ Single device
   Run speed test directly at device: fast.com
   Compare wired vs wireless
   Check Intune compliance — is the device using a proxy or VPN that throttles?
```

---

## T-06 — Phone Has No Dial Tone (VoIP)

```
User reports: "no dial tone" or "can't make calls"
│
├─ Desk phone or softphone app?
│  Desk phone → check physical first: cable connected, PoE light on switch port
│  Softphone → check app is logged in, internet connection is working
│
├─ Check extension status
│  [@Aegion_VOIP] admin → Phone system → Extensions → [extension]
│  Is extension enabled and assigned to the user?
│
├─ Check call routing
│  [@Aegion_VOIP] admin → Phone system → Call routing
│  Is the DID routing to the correct extension?
│
├─ Network issue?
│  VoIP requires low-latency network. Check Meraki:
│  Meraki → Network-wide → Clients → [phone IP] → check latency/jitter
│  Jitter >30ms or packet loss >1% = QoS issue → check MX QoS rules
│
└─ Site-specific (migration in progress)
   Check migration status — some sites may still be on legacy system
   Verify which system the user should be on before troubleshooting the wrong platform
```

---

## T-07 — Shared Mailbox Not Appearing in Outlook

```
User granted access to shared mailbox but it doesn't show in Outlook
│
├─ Is delegation actually set?
│  EAC → Recipients → Mailboxes → [shared mailbox] → Delegation → Full Access
│  Confirm [UPN] is listed
│
├─ Auto-mapping vs manual add
│  Auto-mapping is enabled by default — mailbox should appear automatically within 20–30 min
│  If user re-logged in and it's still not there → try manual add:
│    Outlook → File → Account Settings → Account Settings → More Settings → Advanced
│    → Add → type shared mailbox name
│
├─ Has it been long enough?
│  Permission changes take up to 60 minutes to fully replicate
│  Ask user to close and reopen Outlook, or sign out/back in
│
└─ Is the shared mailbox licensed?
   Shared mailboxes under 50 GB don't require a license
   Over 50 GB → needs Exchange Online Plan 1 license
   Check size: EAC → Mailboxes → [mailbox] → Mailbox usage tab
```

---

## T-08 — MFA Prompt Not Appearing (User Bypassing MFA)

```
User signs in without being prompted for MFA
│
├─ Check CA policy scope
│  Entra → Protection → CA → [MFA policy] → Users → is the user included?
│  Check for exclusions — is the user in an exclusion group?
│
├─ Check named locations / trusted IPs
│  Entra → Protection → CA → Named locations
│  Is the user's office IP listed as trusted? Trusted IPs often bypass MFA.
│
├─ Check sign-in log MFA result
│  Entra → Users → [UPN] → Sign-in logs → [sign-in] → Authentication details
│  Look for: "MFA requirement satisfied by..." → will show WHY MFA was skipped
│  Common: "MFA satisfied by claim in token" = remembered device / persistent session
│
└─ Per-user MFA legacy setting
   Entra → Users → All users → Per user MFA (top nav) → is user set to "Disabled"?
   This legacy setting can conflict with CA — if CA is the policy, per-user should be "Disabled"
```

---

## T-09 — OneDrive Sync Issues

```
User reports: "OneDrive isn't syncing" or "sync errors"
│
├─ Check OneDrive sync client status
│  System tray → OneDrive icon → right-click → View sync problems
│  Blue swirling icon = syncing (wait)
│  Red X = error — click for details
│
├─ Common errors:
│  "File name too long" → path + filename > 400 chars → rename/shorten
│  "File type blocked" → .exe, .tmp blocked by policy → move elsewhere
│  "Not enough storage" → OneDrive quota full → check admin.microsoft.com
│  "Account not connected" → user signed out → sign back in
│
├─ Reset OneDrive sync client (nuclear option — won't delete files)
│  %localappdata%\Microsoft\OneDrive\onedrive.exe /reset
│  Wait 2 min → OneDrive should restart and re-sync
│
└─ Admin view of a user's OneDrive
   admin.microsoft.com → Users → [UPN] → OneDrive → Open
   Or SharePoint admin → Sites → [user's OneDrive site]
```

---

## T-10 — Device Showing Non-Compliant in Intune

```
User's device is flagged non-compliant, blocking access to apps
│
├─ What compliance policy is it failing?
│  Intune → Devices → All devices → [device] → Device compliance → failed policy
│  Click the failed policy → shows which specific setting is non-compliant
│
├─ Common failures:
│  "BitLocker not enabled" → Windows: turn on BitLocker via Settings
│  "Minimum OS version" → update the OS
│  "Password required" → user has no screen lock set
│  "Defender not active" → re-enable Windows Security
│
├─ Force a compliance re-check (after user fixes the issue)
│  Intune → Devices → [device] → Sync
│  Or on device: Settings → Accounts → Work or school → [account] → Info → Sync
│
└─ Compliance grace period
   Is there a grace period configured? Intune → Compliance policies → [policy] → Properties
   If yes, access may still work temporarily even while non-compliant — useful for urgent situations
```
