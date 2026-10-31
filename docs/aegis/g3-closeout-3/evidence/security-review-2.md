# Security review 2 (`/security-review`, batch G3 close-out 3)

- Range: `77b74fd..6bc59da`, every change after security review 1: its three fixes and the three `/code-review xhigh` rounds with their fixes. Run on 2026-10-31. The captures in `docs/aegis/g3-closeout-3/evidence/` were left out (test output and review records); `evidence/tools/gate-field-lines.js` was in scope. REVIEW.md was read first. The commits after `6bc59da` change documents only (the state, contract and boundary rows in `a48396c`, this record, the head captures and `checks.md`), no code, test or runbook.
- Method: as the command prescribes, one sub-task searched for vulnerabilities, tracing data flow in `change-record.js` (`open`, `boundReadBacks`, `namedGates`, `checkGateReadBack`, `staleReadBack`, `checkCount`, `useRunbooksForTests`, `approve`, `link`, `bindRefusal`), `audit-log.js` (`gate_checked`, `flagValue`, the verify `flags` check), `msgraph-client.js`, `trail-helper.js` and the runbook changes. It confirmed or ruled out each hypothesis with local probes on a scratch trail, with no network. A false-positive filter sub-task runs per finding; there were none to filter.
- Result: **No findings at confidence 8 or above.** Three observations below the bar, recorded below; none was changed after this review, so every change in the branch has been through a security review.

## Hypotheses checked and ruled out

| # | question | why ruled out |
|---|---|---|
| 1 | Can `gate_checked: true` be written by any path other than `open`? | Only `change-record.js` `open` writes it; `audit-log.js procedure` refuses `--change` and never passes the field; the Jira client writes `change: null`; `checkEntry` refuses unknown fields and takes only `null` or `true`; editing an entry by hand breaks the hash chain. |
| 2 | Does `staleReadBack` fail open? | Any throw becomes "stale"; `changeView` adds it to `missing`, so status is never done, counted changes included; `bindRefusal`, `approve` and `link` refuse it. `audit-log.js approval` can still append an approval for a stale change, but every consumer checks staleness first (code review round 3, finding 5, closed for the owner). |
| 3 | Can `open` accept a read-back its gate does not bind? | `checkGateReadBack` always runs: it refuses a gate that binds nothing, another kind and other pass flags. |
| 4 | Can `namedGates` or `boundReadBacks` attribute a line to the wrong gate? | Not in the current runbooks: every bound line at `6bc59da` was listed with its gates; each matches its comment or section, no removal gate binds a presence form, and the one gate binding both forms (the Okta rule change) is intended. A misattribution needs a runbook edit, which is outside the threat model. |
| 5 | Can `useRunbooksForTests` be reached from the CLI, an environment variable or a file? | No: its only caller is `trail-helper.js`, which only tests load; `main` never calls it; the default is the real `.claude/commands`. |
| 6 | Does lower-casing a digest open a mismatch? | `flagValue` is the same in `passFlags` and `parseReadBack`; a connector that accepts upper case compares a hex digest, so a case difference can only fail a read. |
| 7 | Can a credential reach the verify `flags` field? | The credential-shape check refuses it, and `recordVerdict` then withholds the verdict (`AUDIT_FAILED`). |
| 8 | Does `msgraph-client.js` add a write, a secret in output or a read without `--execute`? | Routes are GET only; the dry run and redaction are unchanged; the GUID comparison without case closes a false absent; `INVALID_RESPONSE` is uncounted, never a pass. |
| 9 | Is `gate-field-lines.js` safe to run? | Read-only; `execFileSync` with an argument array; an option-shaped commit argument makes `git ls-tree` fail first. |
| 10 | Secrets, hostnames or personal data added? | None: the only token-shaped values are test fakes built at run time, and `graph.microsoft.com` appears in a test fixture. |

## Observations below the bar (not changed; for the owner)

| # | observation (search confidence) | why it is not changed here |
|---|---|---|
| O1 | `checkCount` still misses a count line disguised with a format or combining character (a soft hyphen, bidi controls, variation selectors, tag characters) or look-alike letters (`Соunt` in Cyrillic): a procedure holding a disguised `Count: 5` and a real `Count: 50` inside an HTML comment opened with `--expected 50` (6) | Not a regression (before this batch a bulleted count was missed too), and it deceives the approver only if the ticket hides the real line. A fix after this review would go unreviewed, so it is an owner item with a ready fix: drop every `\p{Cf}`, `\p{Mn}` and `\p{Me}` character before matching, and refuse a counted procedure that holds a non-Latin letter in a word that folds to "count". |
| O2 | `verify-method-absent` treats a list entry with no `id`, or not an object, as absent (3) | Unchanged in this range; it needs a malformed Graph answer. |
| O3 | A placeholder value in a runbook line (`--reviews [N]`, `--expect [MEMBER_COUNT]`) lets `open` take any value its rule allows, and the approval's digest does not cover that value (3) | The placeholder rule is unchanged in this range; binding the value to the approved text is object-level binding (owner decision 3, parked). |
