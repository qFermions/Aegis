# /security-review 3, batch G4

- Range: `9671ebb..2b9fdf1` (every change after security review 2: the K rows, the evidence review's corrections, and the A3 correction that makes Okta `verify-factor-reset --factor-type` a pass flag).
- Run: the security-review method, its find step by one subagent (Opus 5.5, high); markdown, captures, fixtures and tests skipped.
- Result: No findings at confidence 8 or above.

Checked and rejected: the rule in `scripts/adapters/verify-flags.js` and the connector's `FACTOR_TYPE` are byte-identical and lowercase, with no folding or alias on either side, so the recorded, named and checked values are one string; values with colons are recorded and named; a missing flag is refused by the connector and would not match the change; the shared parser refuses repeated flags and `--flag=value`; matching in `open`, `link`, `status` and `bindRefusal` is exact and the runbook lines name `--factor-type push` literally, so the set of linkable reads only got smaller; the `signed_nonce` read now runs without `--change`.

Observation for the owner (pre-existing design limit, not new here): on `/okta-mfa-reset`'s single-factor gate the read judges by factor type only; if the factor removed was not `push` and the user had no push factor, the push read passes whatever happened. The runbook already says the dialog read-back decides.
