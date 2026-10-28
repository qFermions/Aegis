# Security review, batch G2 (round 1)

Run on 2026-10-28 with `/security-review` against `origin/chore/baseline-and-boundary` (`3592bd1`) at head `35b0415`. One finder subagent (high effort, read-only, its own worktree) read the code; markdown, evidence captures and corpora are excluded by the skill. The false-positive filter step had nothing to filter.

**Result: No findings.** Nothing newly added met the bar of more than 80% confidence of a real exploit.

Checked, one line each:

- Contract allow-list (`scripts/adapters/readonly-contract.js`): routes must be GET at definition time; raw paths are matched to a route and the URL is rebuilt from validated values; a POST is accepted only on the exact GraphQL path with a body equal to a defined query document; everything else is refused before a credential is read.
- GraphQL: all seven Linear documents are queries, checked for mutation names at load; variables are plain values.
- Token exchange: Google posts exactly `grant_type` and `assertion` to the fixed `oauth2.googleapis.com/token`; Jamf posts its three fields to `/api/oauth/token` on the configured host; never retried.
- Google JWT: RS256 with an RSA-only key; audience, the seven read-only scopes and `exp = iat + 3600` are fixed.
- Host and path injection: hostnames must be bare; HTTPS on 443 with default TLS checks; redirects are not followed; CLI values are checked against patterns that exclude `/`, `%`, `?` and `#` before they reach a path.
- Credential leakage: credentials and bearer tokens are redacted from data, errors and output; HTTP error bodies are withheld; dry runs read no credential.
- Jamf secrets: no FileVault, Recovery Lock or LAPS route; key-like fields, script parameters, `run_command`, profile payloads and secret-named extension attributes are stripped at any depth.
- Google recovery details print only as set or missing in the `user` and `users` reads.
- Tenant binding: Google `customerId`, Slack `team_id`, Linear `urlKey`; a mismatch returns no data (exit 3).
- Linear note reader: `.md` or `.txt` under `tasks/` or the temporary folder only, key and settings folders refused, symlinks resolved, 64 KB cap, scanner-blocked lines refused.
- `scripts/gws-posture-audit.js`: bounded strict CSV read; addresses masked; the write goes through `scripts/security-audit.js`'s exclusive writer behind the exact SHA-256 phrase; the `security-audit.js` change only exports two existing functions.
- No exec, eval or child process in new code; `socket-tripwire.js` is test-only; scanner, tier and engine changes only add detections; CI and tier changes are additive.

Below the bar, not a finding (confidence 2 of 10): `scripts/adapters/gws-client.js` `verdictOutput` passes the contract's flag quotes through without the recovery-field withholding `readOutput` applies, so a recovery address would print only if it held instruction-like text, which Google's format validation makes impractical. The fix is two lines, so it was made anyway: test `b497ce7` (red), fix `a7fab15` (both reads now share `withholdRecovery`).
