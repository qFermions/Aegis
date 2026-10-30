# Security review 2 (`/security-review`, batch G3 close-out)

- Range: `60a5580..f9c6a99`, every change after security review 1: code review rounds 1 to 3 (code, tests, runbooks and docs), run on 2026-10-30 at the pushed head `f9c6a99`, whose full battery passed (1422/1422). REVIEW.md was read first. The captures in `docs/aegis/g3-closeout/` were left out of the diff: they are test output.
- Method: as the command prescribes, one sub-task searched `git diff 60a5580..HEAD` for vulnerabilities, tracing the data flow in `cli-support.js` (`takeChange`, `changeRefusal`, `verdictState`, `recordVerdict`), `readonly-contract.js` (`rateLimitOf`, the retry loop, `failure()`), `operator-message.js` (`rateLimitedHandoff`), the `changeRefusal` call site in each of the nine connectors, the Slack and Linear offline paths, `scripts/jira-client.js` (`recordJiraVerdict`, the verdict printed after the record), `audit-log.js`'s exports, `change-record.js` `open`'s next step (with `link` and `bindRefusal` read for context) and the four runbooks edited. A finding would then get its own false-positive filter sub-task, and only findings at confidence 8 or above are kept.
- Result: **No findings.** No candidate reached confidence 7, so no filter sub-task ran.

## Candidates considered and rejected

| # | question | why rejected |
|---|---|---|
| 1 | Can the new `changeRefusal(connector, command, bound, audit)` signature let a run through unbound? | No. All 11 call sites pass `takeChange`'s result; a string or undefined now fails closed (`cli-support.js:81`); it returns null only when no `--change` was given, and that run records change null, which `link` refuses. |
| 2 | Can checking the flag error before "not a read-back" let a malformed `--change` reach a read? | No. Both orders refuse before `createClient`; only the message differs. |
| 3 | Can the Slack and Linear offline paths read before the check? | No. Offline commands call `changeRefusal(..., null)`, which refuses any `--change`; online commands reach it before `createClient`, and nothing before it does network I/O. |
| 4 | Are the change-id and verify-command patterns now imported from `audit-log.js` looser, or stateful? | No. They are the same anchored patterns, with no `g` or `y` flag. |
| 5 | Can Jira record `verified: true` for a dry run or a failed read after its verdict refactor? | No. A verify-* dry run returns 4 and records nothing; `verified: true` needs exit 0 on a verify-* command; the Verified line prints only after the record succeeds, and an audit error withholds it. |
| 6 | Can Jira's printed audit seq make `link` accept the wrong read-back? | No. The seq is advisory; `link` checks the entry's verdict, change, read-back and approval order itself. |
| 7 | Can a vendor state reach the trail through Jira's failed read-back? | No. `verdictState` maps through the trail's allowed states and falls back to INVALID_RESPONSE; the entry says `verified: false` either way. |
| 8 | Can vendor headers make the rate-limit rule wait without bound? | No. Every wait is capped at 30 s, the retry count and the retry budget, else the read ends in RATE_LIMITED; the reset is limited to 12 digits, so the UTC time cannot throw. (Rate limiting is also outside this review's scope.) |
| 9 | Can the response body or a header leak through the new `limit: {kind, header}`? | No. `header` comes from the spec, not the response; `failure()` strips the rate-limit detail before results and audit entries; the body is only tested against the secondary-limit pattern. |
| 10 | Can the rate-limit retry resend a request that is not a GET? | No. It resends the request the method allow-list already passed, the token exchange is never retried, and this path did not change. |
| 11 | Can vendor text in Jira's Verified line carry terminal or prompt injection? | Not new: the same strings were printed before; only the print site moved into `run()`. |
| 12 | Can `open`'s next-step text carry injected input? | No. The change id is generated, the read-back is validated by `checkReadBack`, and the output is one `JSON.stringify` object. |
| 13 | Does one linked host read-back make a whole Fleet batch read done? | A known design limit, not a code flaw: the runbook now says `status` proves one host and the ticket's host list is the batch's record; no code path accepts a read-back for a change it was not bound to. Whether `status` should require every host is an owner decision. |
| 14 | Can the "drop `--change` when R1" notes be used to skip binding on an R2 or R3 change? | No false proof follows: an unbound read-back is refused by `link` and never counted by `status`. |
| 15 | Do the new tests hold real credentials, write the real trail or reach the network? | No. Fixture tokens are built sentinels; transports and audit sinks are injected; the suite passes under the socket tripwire. |

## Addendum: `f9c6a99..6c05c10` (code and tests changed after review 2 ran)

- Range: `git diff f9c6a99..6c05c10 -- scripts .claude .env.example`, run on 2026-10-30 so that every change after security review 1 is reviewed: the Windows path fix in `env-example.test.js` (`c499e9d`), the file-name test in `change-binding.test.js` (`37dabc5`), the rename of `scripts/audit/test-trail.js` to `trail-helper.js` with its three requires and the scan's exclusion (`2ba52bc`), and the env-example diagnostic with a comment fix in `verify-dry-run.test.js` (`6c05c10`). The commits between them touch only `checks.md`, `progress.md`, `docs/aegis/boundary-audit.md` and `docs/aegis/g3-closeout/evidence/`.
- Method: one sub-task, read-only, with the same categories, exclusions and confidence bar as above.
- Result: **No findings.**

| # | question | why rejected |
|---|---|---|
| 1 | Can the new `t.diagnostic` print an environment variable's value? | No. It prints the scan's map keys, upper-case names taken from source text; the file never reads `process.env`. |
| 2 | Could a secret written in a `credentials` list or an `env:` literal be echoed? | The scan keeps identifier shapes only, and anything it finds is already committed source. |
| 3 | Do the names in a public CI log expose anything? | They are variable names, already published in `.env.example`. |
| 4 | Path traversal through the `${dir}/${n}` join? | `n` comes from `readdirSync` and holds no separator; `dir` is a fixed literal. |
| 5 | Can the `.js` filter be bypassed so a `.env` file is read? | Only names ending `.js` and not `.test.js` are kept, plus the fixed `scripts/jira-client.js`. |
| 6 | Does the recursive listing follow a symlink out of the repository? | It lists names only and opens nothing; `scripts/` holds no symlink. |
| 7 | A slow pattern in the file-name test? | Denial of service is out of scope, and the input is short file names. |
| 8 | Does a stale `test-trail.js` require make a runbook test skip? | No code reference is left, and a missing module fails the file loudly. |
| 9 | Does excluding `trail-helper.js` from the scan hide an env read? | The helper builds an `AEGIS_AUDIT_DIR` object for tests and reads no environment. |
| 10 | Temporary folder handling in the helper? | Unchanged apart from comments: a random `mkdtemp` folder removed after the test. |
| 11 | Do the changed runbook tests reach the network? | Only their require line changed; each loads the socket tripwire. |
| 12 | Do connector modules required by `env-example.test.js` do I/O at load? | Not new in this range; every client runs its CLI only under `require.main === module`. |
| 13 | Does the `verify-dry-run.test.js` header change behavior? | A comment only. |
| 14 | Does the name test list files outside `scripts/`? | Its root is `scripts/`, and it only lists names. |
