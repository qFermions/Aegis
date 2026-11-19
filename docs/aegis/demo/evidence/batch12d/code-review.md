# Code reviews of batch 12d

Risk tier C (`node scripts/risk_tier.mjs 80397eaa`), so /code-review ran at xhigh. `REVIEW.md` read first. Every finding is fixed in its own commit with a test, or closed with a one-line reason in `checks.md`.

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
