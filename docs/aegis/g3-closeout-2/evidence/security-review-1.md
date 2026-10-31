# Security review 1 (`/security-review`, batch G3 close-out 2)

- Range: `f086c88..a98704b` (F1, F2 and the docs), run on 2026-10-31. The captures in `docs/aegis/g3-closeout-2/` were left out (test output). REVIEW.md was read first.
- Method: as the command prescribes, one sub-task searched for vulnerabilities, tracing data flow in `change-record.js` (`COUNTED_GATES`, `--expected`, `countedView`), `audit-log.js` (procedure `expected`, verify `run`), `cli-support.js` (`RUN_ID_FLAGS`, `runIdOf`, `recordVerdict`), `fleet-client.js` and the runbook changes; each finding then got its own false-positive filter sub-task, and only findings at confidence 8 or above are kept.
- Result: **No findings.** One candidate was reported at confidence 7 and filtered out at 2 (below).

## The filtered candidate, and what was done about it

| candidate | filter verdict | action |
|---|---|---|
| The verify entry's new `run` field copies whatever follows `--execution-id`, even on a failed read, and the shape checks accept a serial, a host name or a user name, so one could be written to the append-only trail | filtered out, confidence 2: the value is a CLI flag the operator types (precedent 3), the trail is local and gitignored, the same value already goes to the operator's own Fleet server and stdout, and a serial is not sensitive PII; it is a hardening item | The filter confirmed a correctness gap: the audit README promised the run is "never a user, email, device name or serial", and the code only checked its shape. Fixed as a bug in files this batch edits: the trail takes a UUID only, and Fleet records the run only when the read succeeded and Fleet echoed that same id (`88cdd51` red, `0c5e02b` green; `sr1-run-id-red.txt`, `sr1-run-id-green.txt`) |

## Candidates considered and rejected by the search sub-task

| # | question | why rejected |
|---|---|---|
| 1 | Can one Fleet host count several times through several execution ids? | Matching the object read is the operator's step (boundary-audit row 37), and object-level binding is owner decision 3, "not now"; the one-read-back rule had the same gap. |
| 2 | Can an Okta or GitHub counted change be made done by reading one object N times? | Documented: status always carries the note that a repeated read is not detected; same trust model as 1. |
| 3 | Can a batch be opened under another or an uncounted `--gate` to avoid counting? | The gate, read-back and target have always been labels the opener supplies; not new in this diff. |
| 4 | Can `--expected` be set lower than the real batch, outside the approved digest? | Input the opener supplies, like gate, read-back and target, none of which the approval covers; a hardening idea (N in the digest) goes to the owner. |
| 5 | Can `--expected` be bypassed? | Counted gates refuse without it, others refuse with it, the value is 1 to 99999, and the trail refuses `expected` without a change id. |
| 6 | Can case variants of one execution id count twice? | Fleet's echoed `execution_id` must equal the one asked for, so a variant fails closed. |
| 7 | Can N verify entries be forged with the library? | Any local process could already forge entries; local code execution is outside the trail's trust boundary. |
| 8 | Does a passing run stay passed after a later failed read? | Correct: Fleet script results do not change once reported. |
| 9 | Can a mix of entries with and without a run id under one change mislead? | Only with an older client on the same trail; status then carries the note. |
| 10 | Prototype-key lookups in `RUN_ID_FLAGS` or `COUNTED_GATES`? | `COUNTED_GATES` uses `hasOwnProperty`; the `RUN_ID_FLAGS` key is reached only after the command passes the allow-list; the gate shape forbids `_`. |
| 11 | Do older trails without `expected` or `run` break? | Missing fields read as null; verify still passes. |
| 12 | `/mfa-issue` session revocation and one-method delete take no change record | Human-run steps with no verify-* read-back in any connector; no code path. |
| 13 | Could a credential pasted as `--execution-id` be recorded? | The credential-shape check still applies, Fleet's id pattern rejects base64 characters, and the run is now a UUID only. |
| 14 | Is the new `[mfa-require-reregister-portal]` gate sound? | Exact typed confirmation, fail-closed, change record approved first, and its read-back records no run id, so `[USER_ID]` never reaches the trail. |
