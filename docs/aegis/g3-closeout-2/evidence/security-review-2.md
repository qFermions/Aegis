# Security review 2 (`/security-review`, batch G3 close-out 2)

- Range: `a98704b..054f00f`, every change after security review 1 (code review rounds 1 to 3 and their docs), run on 2026-10-31. The captures in `docs/aegis/g3-closeout-2/` were left out (test output). REVIEW.md was read first.
- Method: as the command prescribes, one sub-task searched for vulnerabilities, reading the diff and the full current files of `audit-log.js`, `change-record.js`, `cli-support.js`, `fleet-client.js` and `trail-helper.js`, the counted read-backs with no run id (`okta-client.js` `verifyGroupMember`, `github-client.js` `verify-dependabot-alert`) and every caller of `recordVerdict` and `runIdOf`. It made no network call and changed no file. A false-positive filter sub-task runs for each finding; with no finding, none ran.
- Result: **No findings.** 15 candidates were considered and rejected.

## Data flows traced

| flow | what holds it |
|---|---|
| Fleet `--execution-id` to the trail's `run` | the flag must be a UUID before any read (`fleet-client.js:51`); `runIdOf` records the operator's own value in lower case only when Fleet's answer names the same id (`cli-support.js:109`); the trail refuses a non-UUID run and, on append, a run on any read-back outside `RUN_IDS` (`audit-log.js` `checkWrite`) |
| Fleet's answer to the verdict | `verifyScript` requires a matching `execution_id`; before this range an answer with no id passed, so this only tightens it |
| `--command` and `--gate` to a file read | `checkGate` checks `--command` against the trail's `COMMAND` shape, so the path cannot leave `.claude/commands/`; the gate is matched as a plain string and checked against `GATE` on append |
| trail entries to done or partial (`countedView`) | done needs exactly N passed and no failed read; only an answered pass adds to `passed`; an uncounted read never does |

## Candidates considered and rejected

| # | question | why rejected |
|---|---|---|
| 1 | Can a read with no answer, now uncounted for read-backs with no run id, turn a failed object into done? | Uncounted reads add nothing to `passed`; the Okta and GitHub counted read-backs report a wrong object state as OK and not verified, which still blocks. Re-reading one object N times predates this range and is documented. |
| 2 | Can a compromised Fleet server choose the recorded run id? | The recorded value is the operator's flag; Fleet's id is only compared. A lying Fleet could already fake any verdict. |
| 3 | Case folding tricks in `toLowerCase` | The flag is ASCII hex only, and the recorded value is the flag lower-cased. |
| 4 | One execution counted twice by case | Fixed in this range (lower case recorded); a trail mixing older upper-case runs needs the operator's own input and has no real impact. |
| 5 | The run-id rule moved to append, so `verify` accepts a run on any read-back | Only an entry written outside `append` could carry one, and such a writer can already rebuild the unkeyed chain (README); `countedView` reads `run` only for `RUN_IDS` read-backs. |
| 6 | Path traversal through `--command` | Blocked by the `COMMAND` shape; CLI flags are trusted. |
| 7 | A crafted `--gate` matching other runbook text | Refused by `GATE` on append; `COUNTED_GATES` is an exact-key lookup. |
| 8 | Opening a counted batch under an uncounted gate, or with an unrelated read-back | Trusted CLI flags; the gate must exist in the named runbook. |
| 9 | Fleet answering another id so a change can never be done | Availability only (excluded). |
| 10 | Old trails with non-UUID runs failing `verify` | Compatibility or availability only (excluded); no deployment held such a trail. |
| 11 | `observed.execution_id` read when no `observed` exists | A crash at worst (excluded); every Fleet verify returns `observed`. |
| 12 | PII in status output or the new `/mfa-issue` steps | Run ids are UUIDs; `auth-methods` and sign-in reads go to the gitignored `tasks/checkpoints/`, and the ticket now names the method type only. |
| 13 | `permission-related` removed from one inventory entry | Classification metadata from the moved role line; no enforcement path changes. |
| 14 | `trail-helper.js` uses a real runbook gate | Test only (excluded). |
| 15 | A Fleet path built from the execution id | Now a strict UUID before it enters the path; path-only SSRF is excluded anyway. |
