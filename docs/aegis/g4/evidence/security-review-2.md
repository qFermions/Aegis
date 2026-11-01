# /security-review 2, batch G4

- Range: `8492bee..9671ebb` (every change after security review 1: the three code review rounds' fixes in the connectors, `cli-support.js`, `change-record.js`, `calibrate.js` and `trail-helper.js`, and the runbook edits).
- Run: the security-review skill, its find step run by one subagent (Opus 5.5, high) over the changed code; documentation, evidence captures, fixtures and test-only files skipped.
- Result: No findings at confidence 8 or above, so the false-positive filter step had nothing to filter.

## Checked and rejected (summary)

| area | why not a finding |
|---|---|
| `bindRefusal` early or unreadable-approval time bound | fails closed: no argv, a missing or unreadable approval time, or any occurrence earlier than the approval is refused before the read |
| another flag form slipping an early bound past the check | the shared parser refuses `--flag=value` and repeats; a value the audit cannot parse makes the read-back no longer match the change, refused before the read |
| `changeRefusal` passing argv | the same list each connector parses, so the check and the read see the same arguments |
| time formats | Graph and the audit both parse to the millisecond; extra digits truncate in the safe direction |
| `fold` stripping default-ignorable characters | only strengthens the disguised-count check; the visible line is still matched on the raw text |
| undated records | can only turn a failed result into INCONCLUSIVE, never into exit 0 |
| paging changes | missing lists and non-boolean paging fields give INCONCLUSIVE; no new pass path |
| Fleet `verify-wipe` pending, NotNow and more pages | INCONCLUSIVE or a failed object; a pass still needs wiping or wiped and the newest command Acknowledged or 200 |
| GitHub `verify-protection` | only a real true or false counts; the `{}` false pass is closed |
| INCONCLUSIVE in the trail | no linkable audit seq unless verified; uncounted in a counted change; `link` refuses it |
| calibration `readSheet` | input side only; the id is checked against its pattern; the writer still guards formula cells |
| command injection, path traversal | no shell command or file path built from input in the changed code |

## Observations outside the range (pre-existing, for the owner)

- Fleet `verify-wipe` on Apple takes no `--not-before`: an older Acknowledged EraseDevice on a host that reads wiping or wiped could pass. Not changed by this batch; a time bound on the wipe read-back is a candidate for a later batch.
- Jira's `--not-before` is declared a time pass flag while no runbook binds a Jira read-back to a change; harmless today (open refuses a Jira read-back no gate names).
