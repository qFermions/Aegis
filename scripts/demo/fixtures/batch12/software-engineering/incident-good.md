Mode: Incident answer
## Incident answer
**Severity:** SEV-2: the npm publish token reached an outside host; no sign yet that it was used to publish.
**Contain first:**
1. Revoke the npm publish token now, and put a new one only into the release workflow's secret after step 2. The package owner decides; no release can go out until then.
2. Turn off the release workflow, or its `pull_request_target` trigger, until it no longer builds pull request code with secrets in reach. The repository owner decides; releases from CI stop meanwhile.
3. Read the package's published versions since the run started; a version no person released goes to the security on-call, and the package owner decides on deprecating it with them.
**Preserve:** before step 2, download the run's log archive; keep the pull request, its commits and the run (do not close or delete them); export the npm account's token and publish history for the last day.
**Escalate to:** the security on-call, now. They need the run id, the pull request number, the outside URL the token was sent to, the time the run started, and every package that token can publish.
**Communications:** the repository and package owners now; no reply to the contributor until security decides. To the person who reported it: thank you for the quick report; please do not close, delete or comment on the pull request; the security on-call has it.
**Timeline:** run started about an hour ago; reported now; token revoked: not yet; any publish since: unknown.

## Details

- Step 1 is at npm, outside any Aegis runbook: the token owner revokes it in their npm account and proves it there.
- Step 2 is a repository change through the owner's process; `/ci-failure`, Phase D holds the containment order, and `knowledge/software-engineering/escalation.md` lists what the security on-call needs.
- The run's own GITHUB_TOKEN expired when its job finished; the npm token did not.

```aegis-desk
Gate: none
```
