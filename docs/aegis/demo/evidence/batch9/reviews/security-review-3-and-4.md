# Security reviews, rounds 3 and 4

## Round 3 (57d48ef...b3815bc, the code review round 2 fixes)

One MEDIUM: scripts/ask-aegis.js protect() kept every bracketed piece and dropped the intake's international phone forms, so "[mailto:<address>]" and "+44 20 7946 0958" reached the session unmasked. Fixed in a1e7d86 (only a known placeholder, or an address at the placeholder domain, is kept in brackets; every PHONE_LITERAL form is masked except ten bare digits) and ebc6bae (the comment and the test values no longer trip the scan). Test: `scripts/ask-aegis.test.js` "security review 3", red `sr3-red.txt`, green `sr3-green.txt`.

## Round 4 (b3815bc...aeda61c, the code review round 3 fixes)

One MEDIUM: the round 3 written-password rule (six characters with a letter and a digit or symbol) let digit-only passcodes, letter-only and short passwords through. Fixed in 768bea9: any value of four or more characters after password, passcode, pin or secret stops the ask, except a status word or a whole placeholder; "is" needs a word boundary, so "password issues" passes. Below its bar, fixed too: a ticket routing mention skipped the whole clause, so a done claim after it passed (7c0728b). Tests: "final security review" in `scripts/ask-aegis.test.js` and `scripts/demo/user-messages.test.js`, red `sr4-red.txt`, green `sr4-green.txt`.

Checked and found to hold in both rounds: brackets now stricter than before; phone masking covers every form the intake masks except ten bare digits; checks.js only got stricter; the intake changes only report lines, the ticket is still accepted; the ladder lint and the desk row run nothing; no new command injection, path traversal or XSS.
