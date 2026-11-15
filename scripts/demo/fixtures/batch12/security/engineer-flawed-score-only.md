Mode: Engineer answer
Assumed setup: a Cisco Meraki MX appliance as the VPN at the network edge (no company profile given). Tell me what your company runs for a better answer.
## Engineer answer
**Evidence read:** your scanner line: [CVE_ID] on the VPN appliance, base 9.8.
**Hypotheses:**
1. It is critical because the score is 9.8.
2. Everything above 9.0 must be patched tonight.
**Recommendation:** patch the appliance tonight because the score is critical.
**Blast radius:** remote users lose VPN for a few minutes.
**Verify:** the scanner no longer shows the CVE.
**Ask next:** none.

```aegis-desk
Gate: none
```
