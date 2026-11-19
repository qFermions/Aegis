# Code reviews of batch 12d

Risk tier C (`node scripts/risk_tier.mjs 80397eaa`), so /code-review ran at xhigh. `REVIEW.md` read first. Every finding is fixed in a commit with a test, or closed with a one-line reason in `checks.md`. In round 1 three commits each hold two findings, which the rule (one finding, one commit) does not allow; round 2 found it (its finding 10), and the commits stay as they are because splitting them would rewrite history: `4abdd3b8` (findings 2 and 12, the same lines of `runSut`), `0889ee98` (findings 3 and 5, the same function), `2366f2a0` (findings 8 and 11, with a progress rewrite). Round 2's fixes are one finding to a commit.

## Round 1: /code-review xhigh on `80397eaa..7f01f1b6`

12 findings: 5 important, 2 older than the batch, 5 nits.

| # | Severity | Finding | Outcome |
|---|---|---|---|
| 1 | important | The human-confirmation and read-back checks passed on the closing section's heading alone, whose words are in both patterns; a bare heading, or the fixed no-change line, passed an R3 answer (`scripts/eval/judged/checks.js`, `docs/aegis/answer-format.md` section 9) | fixed, `bb4a33ec`: the checks read the section by its lines (Runs it and Confirms first; Verify). Runs: `cr1-closing-lines-red.txt`, `cr1-closing-lines-green.txt` |
| 2 | important | A judged run into a results folder used before counted the earlier run's tool calls as its own: the server appends to the case's audit file (`scripts/eval/judged/backends.js` `runSut`) | fixed, `4abdd3b8`: the case's audit file is removed before its first turn. Runs: `cr1-runsut-red.txt`, `cr1-runsut-green.txt` |
| 3 | important | `typedTokens` was quadratic on one long run of hex digits or of punctuation, so every lookup hung for seconds on such a ticket (7 seconds for 120 KB) (`scripts/mcp/aegis-tools/tools.js`) | fixed, `0889ee98`: one-class address runs kept only up to 46 characters, punctuation trimmed by a loop. Runs: `cr1-typed-tokens-red.txt`, `cr1-typed-tokens-green.txt` (4 ms) |
| 4 | important | The chat's typed file, which holds each message as typed, stayed on disk when the terminal was closed or the launcher killed (`scripts/aegis-chat.js`) | fixed, `7cd9743f`: tidy on SIGHUP and SIGTERM, the signal passed to claude. Runs: `cr1-chat-signals-red.txt`, `cr1-chat-signals-green.txt`. A SIGKILL or a power loss still leaves the file |
| 5 | important | A typed URL that ends in a bracket, a quote or an asterisk was refused, and its shortened form, which nobody typed, allowed (`tools.js` `typedTokens`) | fixed, `0889ee98`: each typed URL counts as written and without the punctuation at its end. Same runs as finding 3 |
| 6 | older than the batch | The desk's `user-message-now` row still fails every Ask first, Engineer or Incident answer, which rightly has no card (`scripts/demo/answer.js`) | closed, not changed: leaving the row off loosens a check, and the owner approved that for three rows only; listed for the owner (checks.md D-CR1-6) |
| 7 | older than the batch | `knowledge/networking/README.md` says net_dns reads SOA records; the tool has no SOA | closed, not changed: a bug that breaks no check of this batch and is not a security issue; listed in the report with its fix (checks.md D-CR1-7) |
| 8 | nit | `progress.md` said the breaker was still testing, eight commits after it finished | fixed, `2366f2a0` |
| 9 | nit | A host or URL in the same unbroken run as any bracketed word (`[INFO]`, a markdown link's text) is not typed | closed, not changed: the safe direction (it refuses more), stated in the tool server's README; narrowing it after the breaker's three rounds would need another round (checks.md D-CR1-9) |
| 10 | nit | `config/**` (the hosts a session may reach) was review tier A and `scripts/mcp/**` tier B | fixed, `0fda86f4`: both are tier C in `.github/risk-tiers.json` and `REVIEW.md`. Runs: `cr1-risk-tier-red.txt`, `cr1-risk-tier-green.txt` |
| 11 | nit | The side-by-side tool counted every call that was not refused as allowed; the judged record counts only answered calls | fixed, `2366f2a0`: allowed, refused and other, as `toolServerRecord` counts them |
| 12 | nit | A typed file that could not be written threw out of `runSut` and would end a paid run before its results were saved | fixed, `4abdd3b8` with finding 2: the session starts with no typed file and reaches only the two lists |

Not checked by the reviewer: a real `claude` session (whether the chat's prompt hook fires); the full suite; the judged run.

## Round 2: /code-review xhigh on `7f01f1b6..0acc8c26` (the new diff only)

13 findings: 5 important, 5 nits, 3 older than the range. Five of them are gaps in round 1's own fixes. This is the last round the instructions allow, so the fixes below have had no review of their own beyond their tests and the evidence reviewer.

| # | Severity | Finding | Outcome |
|---|---|---|---|
| 1 | important | The closing heading in another form (another level, bold, a colon, a CR, or twice in a follow-up) still passed both checks by its own words | fixed, `998f5018` |
| 2 | important | A closing section in any shape but the one-line template failed, where the same words elsewhere in the answer pass (6 of the 47 saved answers of the run's first part) | fixed, `477ac4af`: the section's lines are read by the general patterns, and its parts may sit on any of its lines |
| 3 | important | On SIGHUP or SIGTERM the chat ran its whole tidy while claude was still alive, so a lookup that finished during the shutdown left no audit line | fixed, `2e5e2416`: only the typed file goes at once |
| 4 | important | A typed URL that ends in a bracket was still refused when sentence punctuation followed it | fixed in the tokenizer commit for finding 4 (see checks.md D-CR2) |
| 5 | important | A case that does not start (the limit is reached, a prompt too long) kept an earlier run's audit and typed files in a results folder used before | fixed, `0368838c`: the runner clears them before it decides anything about the case |
| 6 | nit | A closing part with an empty value ("n/a", "none"), or Aegis named as the runner, passed | fixed, `d8044eb1` |
| 7 | nit | A case whose typed file could not be written left no trace in its record | fixed, `ba3732f3`: `typed_file: 'not written'` |
| 8 | nit | A claude that ignored the signal left a launcher only SIGKILL could stop, and a stopped chat exited with code 2 | fixed, `8e655ec9`: killed after the grace; exit 128 plus the signal |
| 9 | nit | `progress.md` and checks.md row D-T3a described a state two commits old | fixed with the progress rewrite that follows the run |
| 10 | nit | Three round 1 commits each fix two findings, and the record said each had its own | fixed in this record and in checks.md D-CR1: the record now says which commits share findings and why they are not split |
| 11 | older | The trim of dots and hyphens at a host token's ends was quadratic on a long run of them (4.6 seconds for 120,000) | fixed in the tokenizer commit for finding 11 |
| 12 | older | An IPv6 address followed by a colon was not typed | fixed in the tokenizer commit for finding 12 |
| 13 | older | `scripts/eval/judged/backends.js`, which builds every sealed session's wall, was review tier B | fixed, `da444e27` |

Left out of the reviewer's list under its five-nit cap, and not changed: a check's span cut after one character (gone with finding 2's rewrite, which keeps 80 characters); `side-by-side.js` names the pinned model itself where it could read the run's config (both are `claude-opus-5-5`).

Runs: `cr2-closing-red.txt`, `cr2-closing-green.txt`; `cr2-chat-signals-red.txt`, `cr2-chat-signals-green.txt`; `cr2-stale-files-red.txt`, `cr2-stale-files-green.txt`; `cr2-typed-field-red.txt`, `cr2-typed-field-green.txt`; `cr2-risk-tier-red.txt`, `cr2-risk-tier-green.txt`; `cr2-typed-tokens-red.txt`, `cr2-typed-tokens-green.txt`.
