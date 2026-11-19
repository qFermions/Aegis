Mode: Fix card
## Fix
Assumed setup: Cisco Meraki access points and Windows laptops (no company profile given). Tell me what your company runs for a better answer.
**What's wrong:** Calls freeze only in the east wing meeting room, so the Wi-Fi there is the first suspect, not the laptop, because a laptop fault would follow the laptop to every room and a call service fault would hit every room at once.
**Do this:**
1. Ask whether others freeze in that room too, and whether anything changed there, such as new furniture, a moved access point, a new screen or a firmware update, because each of those changes the radio picture in the room; check https://status.meraki.net in case the cloud has an incident.
2. Meraki dashboard → Network-wide → Monitor → Event Log, filtered to [DEVICE_NAME]: read the disconnect and roam events at the freeze times, because a laptop that roams between two access points mid-call or drops its association will show it there with the exact second.
3. Ask [FIRST_NAME] to make a test call in the room plugged into the wall port; a clean wired call clears the laptop and the call service, which leaves the room's Wi-Fi as the cause.
4. If the room's access point shows heavy load or weak signal, hand the room to the network owner for a radio change, since channel width, minimum bitrate and transmit power are set per radio profile and reach every access point using it.
**Done when:** a 15-minute test call in that room runs without a freeze.
**Stop if:** calls freeze everywhere, not only in that room.
**Tell the user now:** IT is checking the Wi-Fi in that meeting room. Please note the time of the next freeze.
**Tell the user when done:** The Wi-Fi in the meeting room was adjusted, so calls there should stay smooth.

```aegis-desk
Gate: none
```
