# Security reviews, rounds 5 and 6

## Round 5 (705eede...0d5c99b: the round 4 fixes)

One MEDIUM (confidence 9 of 10): the written-password rule's status-word exemption ended at a word boundary, so a password that begins with a status word ("Reset@123", "no-Hunter22", "Valid!2024") went to the session. Fixed in 905c268: a status word is exempt only when it is the whole value (followed by a space, punctuation and a space, or the end). Test: "final security review" in `scripts/ask-aegis.test.js` gained those cases; red `sr5-red.txt`, green `sr5-green.txt` with the reviewer's probes. A minor case recorded, not fixed: "password isHunter22!" (no space after "is") passes, as it did before.

The answer.js change of that range (a routing mention skips only its own span) was found clean.

## Round 6 (905c268 alone)

No finding (confidence 9 of 10). Every value that passes the new exemption also passed the old one, so the regex blocks a superset of what it blocked at 905c268's parent; probed with passwords starting with each of the 31 status words, trailing punctuation, and the honest cases ("password is expired.", "password is not working", "password: [TEMP_PASSWORD]", "password issues"). The code is frozen at 905c268 for the runs.
