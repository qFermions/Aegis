Mode: Fix card
## Fix
Assumed setup: Meraki MX client VPN with Microsoft 365 (no company profile given). Tell me what your company runs for a better answer.

**What's wrong:** The VPN works from home but can't reach the server from the hotel network, so the hotel's network is the first suspect.
**Do this:**
1. Ask whether anyone else on the VPN has trouble, and whether ordinary websites load at the hotel. Check https://status.meraki.net.
2. Have the user open any website in a browser at the hotel and finish the hotel's sign-in or terms page. Then try the VPN again.
3. Have the user connect to their phone's hotspot and try the VPN.
4. Meraki dashboard → Network-wide → Event log, filtered to client VPN: look for this user's attempt at the time they tried.

**Done when:** The VPN connects and the user can open one internal resource.
**Stop if:** The VPN fails on the hotspot too, or other remote users fail as well. The problem is then on the company side.
**Tell the user now:** IT is looking into your VPN. Please open any website first and finish the hotel's sign-in page, then try again. If it still fails, try connecting through your phone's hotspot.
**Tell the user when done:** Your VPN is connecting again. Let IT know if it drops.

## Details
- **Verdict:** Client VPN, can't connect at all (`/vpn-check`, Client VPN step 4). The user's laptop and account worked last night, and the only thing that changed is the network. That makes the hotel network the likely cause, although nobody has confirmed it yet.
- **Ranked causes:**
  1. The hotel's sign-in page hasn't been completed, so the network blocks everything until it is.
  2. The hotel network blocks VPN traffic (IPsec uses UDP 500/4500). If the hotspot works, this is the cause.
  3. Something is wrong on the company side (MX uplink down, client VPN off). If others fail too, or the hotspot also fails, switch to the `/vpn-tunnel-down` and MX uplink checks.
- **What the event log shows:** If no attempt appears, the traffic never reached the MX, which points to the hotel network. If an attempt appears with an authentication failure, it's an account or secret problem.
- **Changes:** None advised. Don't change the client VPN settings, its routing mode or any firewall rules for one hotel network.
- **Verification:** The VPN connects, and an internal share or app opens by name.
- **Jira-ready note:** VPN issue: client VPN, remote user at a hotel. Symptom: "can't reach the server", worked from home the night before. Root cause: [hotel sign-in page / hotel blocks VPN ports / company side]. Fix: [completed sign-in page / used phone hotspot / escalated]. Verified: VPN connects and an internal resource opens. Time spent: [X] min.

```asker-reply
Your VPN most likely can't get through the hotel's network. It worked from home last night, and the hotel network is the only thing that changed. I haven't confirmed that yet.

In the meantime, open any website in your browser and finish the hotel's sign-in or terms page if one appears, then try the VPN again. If it still won't connect, turn on your phone's hotspot, connect your laptop to it and try once more.

A technician will pick this up next. They'll check whether your connection attempts are reaching the company network and whether anyone else is affected.
```

```aegis-desk
Gate: none
```