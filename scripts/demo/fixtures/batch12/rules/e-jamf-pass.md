Mode: Fix card
## Fix
**What's wrong:** the Wi-Fi profile did not install on [FIRST_NAME]'s new Mac.
**Do this:**
1. Open Jamf Pro → Computers → [DEVICE_NAME] → Management → Configuration Profiles and read the Wi-Fi profile's status.
2. Ask [FIRST_NAME] to open Self Service and choose Check In.
3. If the profile is still pending, redistribute it to that computer only.
**Done when:** the profile shows Installed and the Mac joins the office Wi-Fi.
**Stop if:** the computer has not checked in for a day.
**Tell the user now:** IT is sending the Wi-Fi settings to your Mac again.
**Tell the user when done:** Your Mac now joins the office Wi-Fi.

```aegis-desk
Gate: none
```
