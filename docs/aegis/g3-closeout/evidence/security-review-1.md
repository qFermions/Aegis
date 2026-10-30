# Security review 1 (`/security-review`, batch G3 close-out)

- Range: `01dcb37..60a5580` (tasks 2, 3, 1 and 4, the audit-seq fix and the docs up to that head), run on 2026-10-30 after every task passed. REVIEW.md was read first.
- Method: as the command prescribes, one sub-task searched for vulnerabilities over `git diff 01dcb37..HEAD -- scripts .env.example modules/security`, reading the full current `readonly-contract.js`, `cli-support.js`, `change-record.js`, `audit-log.js`, `operator-message.js`, the `run()` path of every connector and `scripts/jira-client.js`; a finding would then get its own false-positive filter sub-task, and only findings at confidence 8 or above are kept.
- Result: **No findings** at confidence 8 or above, so no filter sub-task ran.

## Candidates considered and rejected

| # | question | why rejected |
|---|---|---|
| 1 | Can a read happen before the `--change` check? | No. In all nine connectors `changeRefusal` runs after argument parsing and local validation, and before `createClient`, the dry-run plan and `--execute`; GitHub, Microsoft Graph, Google Workspace and Okta now build `cliDeps` before the dry run so the check covers it; Slack and Linear refuse `--change` on offline commands; Jira checks before the command runs. Nothing before the check touches the network. |
| 2 | Can a verify entry carry a change id that did not pass the check? | No. Every `recordVerdict(..., bound.change)` and `recordJiraVerdict` is reached only after `changeRefusal` returned null; the trail still requires the change id's form; a dry run records no verdict. |
| 3 | Can `link` or `status` report done without a bound, verified read-back after the approval? | No. Both require `change` equal to the change id, `verified` true, a seq after the matching approval and the read-back named at `open`; `bindRefusal` fails closed on a broken chain, an unknown change, another read-back or a missing or mismatched approval. |
| 4 | Can the argv stripping be bypassed? | No. `--change=chg-...` is not stripped, and every connector's parser then refuses it as an unknown flag; a repeated `--change` or one with no value is an error. CLI flags are trusted input. |
| 5 | Can the rate-limit retry send a non-GET request or reach another host? | No. The retry resends the same request object, already checked against the allow-list; the token exchange is still one attempt; `spec.rateLimit` accepts only 403 and 429 and checks its header and field names. |
| 6 | Can the response body leak through the secondary-limit check? | No. `rateLimitOf` reduces the body to one boolean; `failure()` drops the internal `rateLimit` object; the handoff holds fixed text, the platform name, the status number and an ISO time built from numbers; the audit entry holds only the `RATE_LIMITED` name. |
| 7 | Can `audit_seq` or Jira's "Recorded as audit entry N" leak anything? | No: an integer only. |
| 8 | Do refusal messages echo untrusted data? | Only checked values: the change id after it matches its form, and `read_back` from trail entries the chain check re-validates. |
| 9 | Secrets or real values in `.env.example`, the dictionary or `tier-guard.js`? | None: secrets empty, org values `[@Aegion_*]` placeholders; adding `MS_TENANT_ID` to `ORG_TOKEN_SUFFIXES` keeps foreign-token detection as strict as before for every other name. |
| 10 | Can a huge reset or retry-after value break the ISO time? | No: both are capped (12 and 7 digits); any throw would be caught by the client's `run()` wrapper; it would be a denial-of-service concern, which the command excludes. |
| 11 | Is a read-back bound to the object it read? | No, by design and stated in the code and docs: the trail holds placeholders only. Not new; an owner decision in the PR body. |
| 12 | Can someone with write access to the local trail forge entries? | Yes, the existing local-trust model (an unkeyed hash chain); not introduced by this branch; the keyed seal is an open owner item. |
