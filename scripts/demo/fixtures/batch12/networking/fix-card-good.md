Mode: Fix card
## Fix
Assumed setup: Cisco Meraki access points and Windows laptops (no company profile given). Tell me what your company runs for a better answer.
**What's wrong:** Calls freeze only in the east wing meeting room, so that room's Wi-Fi is the first suspect.
**Do this:**
1. Ask whether others freeze there too and what changed; check https://status.meraki.net.
2. Meraki dashboard → Network-wide → Monitor → Event Log, filtered to [DEVICE_NAME]: read the disconnect and roam events at the freeze times.
3. Ask [FIRST_NAME] to test a call there on the wall port; a clean wired call clears the laptop.
4. If that access point shows heavy load or weak signal, pass the room to the network owner.
**Done when:** a 15-minute test call in that room has no freeze.
**Stop if:** calls freeze in every room.
**Tell the user now:** IT is checking that meeting room's Wi-Fi. Please note when the next freeze happens.
**Tell the user when done:** The meeting room Wi-Fi was adjusted, so calls there should stay smooth.

## Details
Steps 1 to 3 change nothing. Step 4 is the network owner's radio profile change (R3, every client near those access points), applied outside busy hours with the old values saved (`knowledge/networking/safe-changes.md`); `/wifi-issue` holds the single-laptop path.
Step 4 (radio change for the room): no gate in this lane's runbooks. Proof: the access point's load and the room's test call, seen by the network owner.

```aegis-desk
Gate: none
```
