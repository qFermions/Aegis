Mode: Incident answer
Assumed setup: Cisco Meraki switches and access points (no company profile given). Tell me what your company runs for a better answer.
## Incident answer
**Severity:** SEV-3, a suspected compromise with no sign of use yet. At risk: every device on the third-floor network can be sent to a DNS server and gateway nobody here runs, so its lookups and traffic can be redirected.
**Contain first:**
1. Find the unknown DHCP server: an affected laptop's lease names it (192.0.2.254). The network owner finds its switch port and decides whether to shut that one port. Cost: whatever is on that port goes offline.
2. The security on-call decides whether third-floor users pause sign-ins to finance and HR systems until their laptops hold a lease from the known server. Cost: a short pause in that floor's work.
3. After the port, the network owner decides on the switch's DHCP server policy for that VLAN. Cost: a change for the whole VLAN, in a change window.
**Preserve:** before the port is shut: an affected laptop's `ipconfig /all` output (DHCP server, gateway, DNS servers, lease times), the switch port, VLAN and MAC address of the server, the event log for that client, and a short capture of the DHCP exchange. Photograph the device and record its port before anyone unplugs it.
**Escalate to:** the security on-call, now. They need the first-seen time, the floor and VLAN, the server's MAC and address, the DNS server it hands out (203.0.113.99), and the evidence above.
**Communications:** third-floor users hear that IT is checking a network fault on their floor, to save their work and to hold sign-ins to finance and HR systems until told. The reporter is thanked and asked not to touch the device.
**Timeline:** first seen 08:40 by the help desk, reported 09:05, now 09:20; when the server appeared and whether any lookup was redirected: unknown.

## Details
Contain steps 1 and 3 change the network; no runbook gate in this lane covers a switch port or a DHCP server policy, so the network owner applies each through their change process with the port's settings saved first (`knowledge/networking/escalation.md`, `knowledge/networking/safe-changes.md`).

```aegis-desk
Gate: none
```
