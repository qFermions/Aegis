## Verdict
**The cause isn't known yet, and no fix is safe to advise.** The ticket gives one line of symptoms and no evidence. "Everyone" points to the studio's internet line, router or Wi-Fi, or to something using up the bandwidth, rather than to individual Macs.

- **Facts:** the requester reports slowness for "everyone". There's no start time, location or list of affected apps.
- **Gap:** Customer B's router, firewall, Wi-Fi and ISP aren't on record. The Meraki paths in `/lan-wan` and T-05 are for a different environment, so don't use them here.
- **Not run:** I have no access to Customer B's systems, and these checks haven't been done. I also couldn't run the memory CLI in this session, and the local store shows no files.

## What to check first
All of these are read-only (R0) and take about 10 minutes.

1. **Vendor status:** check the Google Workspace Status Dashboard and Slack Status. If only those apps are slow, the problem may not be the internet.
2. **Scope:** test one Mac on Wi-Fi and one on Ethernet in the same spot, at fast.com or with the Terminal commands below. Then test from a second area or floor, if there is one.
3. **Router or firewall dashboard:** look at these on the WAN/uplink page:
   - Throughput against the contracted speed
   - Latency and packet loss
   - When the graph changed, which gives you the start time
   - Top clients by usage
4. **Jamf Pro:** go to Computers → Managed Software Updates and read the existing plans, in case a macOS update is downloading across the Macs. The runbook marks this menu location as unverified, so confirm it on screen.

<details>
<summary>Mac Terminal, for reference only (human-run, read-only)</summary>

```bash
# Measures this Mac's download and upload speed and responsiveness
# It briefly uses the full connection, so run it once per Mac
networkQuality

# Tests the path to the office router; loss here points to the local network
ping -c 20 [GATEWAY_IP]

# Tests the path to the internet; loss here but not above points to the line or ISP
ping -c 20 8.8.8.8
```
</details>

## Step-by-step fix
Each likely cause below is a hypothesis until the checks support it.

- **Uplink not busy, but high latency or loss, or speeds well below contract:** likely the ISP. Open a case with the readings and start time.
- **Uplink near capacity (sustained above about 80%):** something is using up the bandwidth. At a design studio, likely causes are large file syncs such as Google Drive for desktop, backups or OS updates. Identify the device and the traffic, then bring that back here before changing anything.
- **Ethernet fine, Wi-Fi slow:** likely the access points. Compare client counts, channel use and signal on the Wi-Fi dashboard.
- **Both fine, only Google or Slack slow:** likely a vendor incident. Log it and wait for the vendor to clear it.
- **Speed tests fine, but pages slow to start loading:** check DNS by comparing the router's DNS settings with the responses clients are getting.

## ⚠️ Risk warning
- Don't reboot the router, firewall or access points during work hours. It drops all 40 people and clears evidence you may still need.
- Don't turn off the firewall, content filtering or any other security control to test speed.
- If a change turns out to be needed, it gets its own runbook, gate and rollback.

## ✅ Verification checklist
This is for closing the ticket once a cause is found and resolved:
- [ ] Wi-Fi and Ethernet speed tests are near the contracted speed
- [ ] Latency and loss are back to baseline on the uplink graph
- [ ] Macs in a second area also test normal, if there is one
- [ ] The requester confirms it's back to normal

## 📝 Ticket note
> Report: slow internet for all staff at Customer B. No change made. Replay lookup: MISS. Status: read-only triage in progress. Checks: vendor status, Wi-Fi vs Ethernet speed tests, WAN throughput/latency/loss, top clients, Jamf update plans. Results: [RESULTS]. Start time: [TIME]. Next step: [ISP CASE / TOP-CLIENT REVIEW / WI-FI REVIEW / VENDOR INCIDENT].

## Next action
Which router or firewall does Customer B run? With that, I can give exact dashboard paths for step 3.

Gate: none
