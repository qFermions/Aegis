Mode: Fix card
## Fix
**What's wrong:** the Wi-Fi profile did not install on [FIRST_NAME]'s new Mac, most likely because the computer finished enrolment before it was added to the smart group the profile is scoped to, so Jamf Pro never queued the profile, or because the profile was queued while the Mac was asleep and the push notification was missed.
**Do this:**
1. Open Jamf Pro → Computers → [DEVICE_NAME] → Management → Configuration Profiles and read the Wi-Fi profile's status, because Pending, Failed and Not scoped each point to a different cause and a different fix.
2. Ask [FIRST_NAME] to open Self Service and choose Check In, since a check-in makes the Mac ask Jamf Pro for anything queued and usually installs a pending profile within a minute or two.
3. If the profile is still pending, redistribute it to that computer only, because redistributing to the whole scope would push it again to every Mac in the group and can drop their Wi-Fi for a moment.
**Done when:** the profile shows Installed and the Mac joins the office Wi-Fi.
**Stop if:** the computer has not checked in for a day, because then the problem is the Mac's connection to Jamf Pro.
**Tell the user now:** IT is sending the Wi-Fi settings to your Mac again.
**Tell the user when done:** Your Mac now joins the office Wi-Fi.

```aegis-desk
Gate: none
```
