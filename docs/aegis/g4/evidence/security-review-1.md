# /security-review 1, batch G4

- Range: `1f6647c..8492bee` (the whole branch: A1 to A4, B1 to B11, C1 to C4, D1 to D3).
- Run: the security-review skill, its find step run by one subagent (Opus 5.5, high) over the code the branch adds or changes (the judged-eval runner, the change-record and audit-log code, verify-flags, cli-support, readonly-contract, the nine connectors and the Jira client, CI). Documentation, evidence captures, fixtures and test-only files skipped, as the skill says.
- Result: No findings at confidence 8 or above, so the false-positive filter step had nothing to filter.

## Checked and rejected (summary of the find step)

| area | why not a finding |
|---|---|
| approval writers | `audit-log.js approval` always throws; `change-record.js approve` is the one writer and checks an open change, the digest and no earlier approval under the write lock |
| `--not-before` before the approval | refused in the plain view, listed as uncounted in a counted view, refused by `link`; compared in ms against the approval's time |
| a time bound parsed differently by the audit and the connector | fails closed: an unparsed value is left out of the entry's flags, so the read-back no longer matches the change's named form |
| repeated flags | the shared `parseArgs` and the Jira parser refuse a repeated flag and a value starting with `--` |
| INCONCLUSIVE | every new branch sets `verified: false`; exit 5, never 0; `link` needs `verified === true` |
| count-line folding | the raw line must still match `^Count: N$`; disguised and hidden counts are refused |
| Read-back field binding | narrows binding to the commands a gate's field names; runbooks are repo-controlled |
| runner command injection | `spawn` with `shell: false` and an argument array; a prompt starting with `-` is prefixed; `--judge-model` checked against a pattern |
| judge verdict forgery | the verdict is the judge process's own result, one strict JSON object with exact keys; Correctness is computed, not taken from the judge |
| paths | case and threshold files checked on the given path and the real path; results folder checked before and after `mkdir` with `git check-ignore` and `git ls-files` |
| judge temp folder | `mkdtemp` under the system temp folder, refused inside the repo, removed in `finally` |
| child environment | `.env.example` names and `_TOKEN`, `_KEY`, `_SECRET`, `_PASSWORD` names removed; the system under test has no Bash |
| CI | `pull_request` and `push` only; the new step dry-runs a repo file copied to `$RUNNER_TEMP`, no secrets |

## Observations below the bar (not findings; kept for the owner)

- O1 `scripts/eval/judged/calibrate.js:28`: formula-leading cells (`=`, `+`, `-`, `@`, tab, CR) get an apostrophe and every cell is quoted; a full-width equals sign or a leading line feed is not neutralized. The content is the owner's case file or a model answer; below the bar.
- O2 `scripts/eval/judged/backends.js`: the system under test may use the Agent tool, and some repo agents declare wider tools (Bash or `*`). `--tools` limits the built-in tool pool, Bash is disallowed explicitly, no `.claude/settings.json` allows it, and `-p` denies tools that are not allowed; not exploitable with confidence. Recorded so the owner's first real run can confirm no subagent ran a command.
