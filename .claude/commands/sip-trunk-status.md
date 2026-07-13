---
description: Check SIP trunk health and desk phone registration status across [@Aegion_VOIP] and Meraki MX. Placeholders only.
---

# /sip-trunk-status

**Verdict:** Most SIP/registration failures trace to one of three causes — SIP ALG enabled on the Meraki MX (disrupts SIP signaling), a NAT/firewall blocking RTP media ports (causes one-way audio or no audio), or the desk phone losing its provisioning profile. Start at the [@Aegion_VOIP] admin portal to confirm registration state, then move to Meraki if the phone shows as registered but audio is broken.

---

## What to check first

- Is this one phone or all phones at a site? → All phones = network/trunk issue. One phone = device or extension config issue.
- Is the phone showing "No Service," "Unregistered," or ringing with no audio?
- Did this start after a network change, Meraki config update, or ISP event?
- Is the affected site still on the legacy VoIP system ([@Aegion_SITE_2], [@Aegion_SITE_3], [@Aegion_SITE_4])? Check migration status first — `/unite-migration-status`.

---

## Step-by-step fix

### 1. Check phone registration in [@Aegion_VOIP] admin portal

1. Log in to the [@Aegion_VOIP] admin portal.
2. Navigate to **Users** → search for [USER_NAME] or [EXTENSION].
3. Open the user record → **Devices** tab.
4. Confirm status shows **Registered** and the device has an assigned IP address.
5. If status is **Unregistered**: note the last-seen timestamp — use it to correlate with any network events.
6. If no device is listed: the phone was never provisioned or lost its profile → go to step 4 (reprovision).

### 2. Verify the phone itself has network connectivity

- Check the phone screen — does it show an IP address in the phone's status/network menu?
- If no IP: check the PoE switch port (Meraki MS) → **dashboard.meraki.com → Switch → Ports** — confirm the port is up and the phone is listed as a connected client.
- Reboot the phone (unplug PoE, wait 10 s, replug) and watch for registration.

### 3. Check SIP ALG on the Meraki MX — MUST be disabled

SIP ALG rewrites SIP headers and breaks registrations and audio. Verify it is off:

1. **dashboard.meraki.com → Security & SD-WAN → Firewall**.
2. Scroll to **SIP ALG** — confirm it is **Disabled**.
3. If it is enabled: disable it → **Save**. Wait 2 min, reboot the affected phone(s).

> SIP ALG must be **disabled** for [@Aegion_VOIP] on all Meraki MX appliances. This is the single most common cause of intermittent registration drops and one-way audio.

### 4. Check NAT and firewall — one-way audio diagnosis

One-way audio (you can hear them, they can't hear you — or vice versa) = RTP media ports are being blocked or mis-NATted.

**Meraki MX firewall rules:**

1. **dashboard.meraki.com → Security & SD-WAN → Firewall → Outbound rules**.
2. Confirm outbound UDP is not overly restricted for the phone VLAN/subnet.
3. [@Aegion_VOIP] requires these ports to be open outbound:
   - **UDP 5060** — SIP signaling
   - **UDP 5061** — SIP over TLS (if used)
   - **UDP 10000–20000** — RTP media (verify exact range with [@Aegion_VOIP] support if unsure)
4. If port address translation (PAT) is aggressive: [@Aegion_VOIP] phones may need a static 1:1 NAT or a UDP timeout increase.
   - **Meraki MX → Firewall → One-to-one NAT** — add entry if needed.

**UDP timeout (if RTP drops mid-call):**

- Meraki default UDP timeout can be short. Check with [@Aegion_VOIP] support for recommended UDP session timeout value and set it under **MX → Firewall → Firewall settings**.

### 5. Test with a softphone to isolate hardware vs. network

- Install the [@Aegion_VOIP] softphone app (mobile or desktop) and log in as [USER_NAME] on the same network.
- If the softphone registers and audio works: the desk phone itself is faulty or needs reprovisioning → go to step 6.
- If the softphone also fails: the problem is network or trunk → recheck steps 3–4 or escalate to [@Aegion_VOIP] support with a SIP trace.

### 6. Reprovision the desk phone

1. In the [@Aegion_VOIP] admin portal → **Users** → [USER_NAME] → **Devices**.
2. Locate the desk phone (by MAC address: `[MAC_ADDRESS]`).
3. Select **Reprovision** or **Resync** — the phone will pull a fresh config from the provisioning server.
4. If the phone is not listed: **Add Device** → enter MAC address → assign to extension [EXTENSION] → save.
5. Reboot the phone after reprovisioning.

---

<details>
<summary>Network test snippets (PowerShell — optional, run from a PC on the same subnet as the phone)</summary>

```powershell
# Test if SIP port 5060 is reachable outbound from the office network
# Replace [VOIP_SERVER_FQDN] with the [@Aegion_VOIP] SIP server hostname (get from portal)
Test-NetConnection -ComputerName "[VOIP_SERVER_FQDN]" -Port 5060
# Result: TcpTestSucceeded = True means the port is open

# Check current NAT/firewall state isn't blocking DNS resolution of the SIP server
Resolve-DnsName "[VOIP_SERVER_FQDN]"
# Should return one or more IP addresses — if it fails, DNS issue on the local network

# Trace the network path to the SIP server to find where packets are dropping
tracert "[VOIP_SERVER_FQDN]"
# Look for a hop that shows * * * (timeout) — that's the blocking point
```

</details>

---

## ⚠️ Risk warning

- **Disabling SIP ALG** takes effect immediately and affects all VoIP calls in progress at that site. Do this during off-hours or warn staff first.
- **Modifying firewall rules** on the Meraki MX affects all traffic, not just VoIP. Double-check rule scope before saving.
- **Reprovisioning a phone** will briefly drop any active call on that device.
- Sites still on the legacy VoIP system ([@Aegion_SITE_2], [@Aegion_SITE_3], [@Aegion_SITE_4] until migration is complete) — confirm which system the phone is registered to before making changes in the [@Aegion_VOIP] portal.

---

## ✅ Verification checklist

- [ ] Phone shows **Registered** in the [@Aegion_VOIP] admin portal with a current IP
- [ ] SIP ALG is **Disabled** on the Meraki MX at the affected site
- [ ] RTP media ports (UDP 5060, 10000–20000) are open outbound in MX firewall rules
- [ ] Test call: [USER_NAME] dials an external number — audio works in both directions
- [ ] Test call: external number dials [EXTENSION] — call rings and connects
- [ ] Voicemail works: call goes to voicemail when unanswered, message is retrievable
- [ ] If a softphone was used for testing: desk phone is confirmed working and softphone is logged out

---

## 📝 Jira-ready note

> **SIP/phone registration check completed — [JIRA-###]**
>
> Investigated phone registration issue for extension [EXTENSION] at [SITE]. Confirmed registration status in [@Aegion_VOIP] admin portal. Verified SIP ALG disabled on Meraki MX. Reviewed firewall rules for SIP/RTP ports. [Describe finding: e.g., "SIP ALG was enabled — disabled and phone re-registered immediately" or "Phone required reprovisioning via admin portal."] Test calls confirmed inbound and outbound audio working. Closing ticket.
