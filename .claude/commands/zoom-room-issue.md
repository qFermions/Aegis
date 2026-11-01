---
description: Troubleshoot a Zoom Room that shows offline or whose controller cannot connect — portal status first, then network and port checks, then a gated remote restart. Placeholders only.
disable-model-invocation: true
---

# /zoom-room-issue

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview unless an immediately adjacent `SAFETY GATE` names the target, effect, scope, reversibility, and exact confirmation. Unmarked mutations must move to a separate reviewed runbook before execution; do not click, paste, or run them from this command. Aegis advises; a human administrator runs every step (HUMAN-RUN).

**Placeholders:** `[DEVICE_NAME]` (the Zoom Room's name as shown in the Zoom web portal) · `[@Aegion_SITE_2]` / `[@Aegion_SITE_3]` for the site · org values from `modules/security/placeholder-dictionary.md`.

## Verdict

A room shows **offline** when it stops sending heartbeats to Zoom's cloud — almost always power, network, or the room computer's session. A controller that says **cannot connect** while the room is online is usually a network split: the controller and the room computer are on different networks, or port 9090 is blocked by the network or by antivirus.

## What to check first

1. **Room status (R0):** Zoom admin → Room Management → Zoom Rooms → `[DEVICE_NAME]` → read the status and the device list (online / offline, last heartbeat).
2. **Power and cabling (R0):** is the room computer on, and does its network cable or Wi-Fi show a link? A power-loss alert and a network-loss alert are separate alerts on the room's **Alert** tab.
3. **Same network (R0):** the controller (tablet) and the room computer must be on the same network segment — a controller moved to the guest Wi-Fi cannot reach the room.
4. **Port 9090 (R0):** if both sit on the same network, check whether a firewall rule or the room computer's antivirus blocks port 9090.
5. **Site-wide?** If every room at `[@Aegion_SITE_2]` is offline, this is a site network problem — treat it as a LAN/WAN ticket, not a room ticket.

## Step-by-step fix

### Phase 1 — Confirm the scope in the portal

**Purpose** — know whether one room or a whole site is affected before touching anything.

- Zoom admin → Room Management → Zoom Rooms → filter by location → read how many rooms are offline.
- **Verification checkpoint** — [ ] the number of offline rooms and their site are recorded.

### Phase 2 — Restore power and network (on site)

**Purpose** — most offline rooms come back once the room computer has power and the right network.

1. Check the room computer is powered and signed in (remote management needs **auto login** enabled on the room device).
2. Check the controller and the room computer join the same network; move the controller back to the room network if it drifted.
3. **WAIT UNTIL** the portal shows the room online again (the heartbeat resumes within a few minutes of the network returning).

### Phase 3 — Remote restart (only when the room is online but misbehaving)

**Purpose** — a remote restart clears a stuck app without a site visit. The room must be online, and you need an admin or owner role with Zoom Rooms permission.

<!-- SAFETY GATE [zoom-room-restart-app-portal] -->
- **Target:** [DEVICE_NAME]
- **Effect:** restart the Zoom Rooms app on the room device; a meeting in progress in that room drops
- **Scope:** one Zoom Room
- **Reversibility:** R1 — the app starts again on its own; nothing is deleted, but a dropped meeting cannot be resumed
- **Required confirmation:** Type exactly `RESTART ZOOM ROOMS APP IN [DEVICE_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [zoom-room-restart-app-portal]:** Only after confirming no meeting is running in the room and the exact match:
1. Zoom admin → Room Management → Zoom Rooms → `[DEVICE_NAME]` → **Edit** → **Devices** → **Restart Zoom Rooms App**.
2. Confirm **Restart**, then **WAIT UNTIL** the room reads online in the portal.

<!-- SAFETY GATE [zoom-room-restart-computer-portal] -->
- **Target:** [DEVICE_NAME]
- **Effect:** restart the room computer that runs the Zoom Room; the room is unavailable until it boots
- **Scope:** one room computer
- **Reversibility:** R1 — the computer boots back on its own; nothing is deleted
- **Required confirmation:** Type exactly `RESTART ZOOM ROOMS COMPUTER IN [DEVICE_NAME]`.
- **Failure behavior:** Empty, declined, `yes`, or any other response means stop; no change is made.
- **Read-back:** none (R1: no change record)
**PORTAL ACTION [zoom-room-restart-computer-portal]:** Only when the app restart did not help, and only after this separate exact match:
1. Zoom admin → Room Management → Zoom Rooms → `[DEVICE_NAME]` → **Edit** → **Devices** → **Restart Zoom Rooms Computer**.
2. Confirm **Restart**, then **WAIT UNTIL** the room reads online in the portal (allow the full boot time).

<details>
<summary>Terminal — the scale version (read-only diagnostics, HUMAN-RUN)</summary>

```zsh
# HUMAN-RUN — read-only reachability checks from a Mac on the room network; nothing here changes anything
ping -c 4 [DEVICE_NAME]   # does the room computer answer on this network?
nc -vz [DEVICE_NAME] 9090   # is port 9090 (controller pairing) reachable from here?
networksetup -getairportnetwork en0   # which Wi-Fi network this Mac (or the controller's segment) is on
```
</details>

## ⚠️ Risk warning

- A restart drops any meeting running in that room — check the room calendar first.
- Do not "fix" a cannot-connect error by opening port 9090 broadly on the firewall or by turning off the room computer's antivirus; scope any exception to the room network and the room computer, and document it as a temporary exception.
- If several rooms are offline at once, a restart is the wrong tool — escalate as a site network incident.

## ✅ Verification checklist

- [ ] Zoom admin → Room Management → Zoom Rooms shows `[DEVICE_NAME]` online with a fresh heartbeat.
- [ ] The controller pairs and starts a test meeting; audio and video work in the room.
- [ ] If a restart was used, the portal's room history shows it, with the admin and time.

## 📝 Jira-ready note

> Resolved [date/time]. Zoom Room `[DEVICE_NAME]` at [site] was [offline / unable to pair with its controller]. Cause: [power / network change / controller on a different network / port 9090 blocked / stuck app]. Fix: [action taken; restart used: none / app / computer, confirmed by the exact phrase]. Verified: room online in the portal and a test meeting worked. Time spent: [X] min.

## Aha moment

"Offline" in a cloud-managed room is a heartbeat statement, not a hardware statement: the portal only knows the room stopped talking — power, network, and session come first, restarts last.

## Career upgrade

Reasoning from heartbeats and ports instead of rebooting by habit is the same discipline as SRE health checks — name the signal before you change the system.

## Next action

Run Phase 1 in the portal and record whether one room or a whole site is offline.

**Sources (checked 2026-10-15):** support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0068519 (remote Zoom Rooms management — path, restart options, auto-login and role prerequisites) · support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0066210 (room alerts, heartbeat definition) · support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058473 ("Cannot connect to Zoom Rooms": different networks, port 9090) — read through a rendered fetch because the support portal returns no article text to curl; the commander should re-check these three pages in a browser.
