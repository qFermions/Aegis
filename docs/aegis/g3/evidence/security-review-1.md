# Security review 1 (batch G3, `/security-review`, range `f185071..c1e60ec`)

Run on 2026-10-28 over the branch's non-test code and config (30 files, 4,085 added lines in
the JavaScript files); captures, docs, tests, corpora and fixtures excluded as the skill's
filters require. Step 1: one sub-task read the code and traced every untrusted input (vendor
responses, intake files, ticket text) to requests, file writes, output and the audit trail.
Step 2 (false-positive filtering) had nothing to filter.

**Result: no findings** at the skill's bar (more than 80% confident of a real exploit).

What was checked, and why each was safe (the sub-task's report, file and line at `c1e60ec`):

1. Connectors send only GET to their fixed vendor host: `readonly-contract.js` refuses any
   non-GET route (`freezeRoute`), validates and encodes every path parameter and query
   value, and `checkRequest` refuses any other host. The GitHub, Okta and Microsoft Graph
   route tables are GET-only; Graph's token host is fixed and its tenant must be a GUID.
   Pagination never follows a URL from a vendor; Okta's cursor must pass `AFTER`
   (`okta-client.js:143`, `:319`).
2. Token exchanges leak no secret: errors name the variable, never its value; the private
   keys and signed assertions are registered for redaction; token responses are never
   printed; HTTP errors say "body withheld"; `renderResult` redacts after the operator
   message is added.
3. The scope preflight cannot be skipped from outside: it is on unless code injects a
   transport (`cli-support.js`); token kinds are judged before the token is kept; the route
   kind runs its who-am-I read first; the header kind withholds a write-scoped answer.
4. Intake: input size, MIME depth and part counts are capped; the HTML reader is one forward
   pass; text is quoted, never followed; no tenant evidence is `TENANT_UNBOUND` and a
   foreign tenant `TENANT_MISMATCH`; `saveCase` writes under a random `atg-<UUID>` run id with
   the `wx` flag (no traversal, no overwrite).
5. Intake provenance cannot be spoofed: `engine.js` `checkIntake` requires exact keys, a bound
   tenant, a matching source and fixed shapes for origin, digest and time.
6. The audit trail holds no secret or raw body: five entry kinds with fixed fields and value
   shapes plus a credential-shape deny pattern; folder 0700, files 0600; the lock is an
   exclusive create.
7. A change record is never done without a matching approval and a verified read-back after
   it; `approve` refuses a mismatched digest.
8. The one new child process is `latency.js:36` (`spawnSync(process.execPath, ['-e', '0'])`);
   no new `eval` or `Function`.
9. `ci.yml` adds a file probe and the G3 eval; no untrusted pull request input reaches a shell.
10. Memory, replay and the personal-data rule are not weakened: the shared email finder
    returns the same matches as the old regex in linear time.

Notes below the bar, recorded for the owner (not findings): the audit hash chain is unkeyed,
so someone with local file access can rewrite it consistently (external anchoring is an owner
decision, `scripts/audit/README.md`); a GitHub fine-grained token or a Microsoft Graph
credential with write rights is still used, with a notice, because neither vendor shows the
granted permissions to the credential (documented in `docs/aegis/g3/scope-manifest.md`);
`change-record.js link` accepts a verify entry for any target (operator input through the CLI).
