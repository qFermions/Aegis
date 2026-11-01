---
description: Prepare one Jira Service Management request for the administrator to create, then prove it by read-back. Aegis never sends the write. Placeholders only.
disable-model-invocation: true
---

# /jira-create

## Risk metadata

- **Risk level:** R0 for the preview and the read-back; R1 for the one request the administrator creates.
- **Access:** read-only for Aegis. `scripts/jira-client.js` never sends a write (its transport refuses every method but GET); the administrator performs the create in the portal or their own terminal.
- **Credential-sensitive:** yes for the read-back only. The preview reads no credentials; the printed `curl` asks the administrator for the API token instead of taking it from the environment.
- **Invocation:** operator-only; Claude must not invoke this command automatically.

## Execution boundary

Aegis advises; humans execute (`PRODUCT_CONTRACT.md`). The client builds the exact payload, prints it with a SHA-256 binding line, and prints a HUMAN-RUN procedure. `--execute` or `--confirm` on `create` is refused with exit 1 before any credential read or network call: there is no phrase that makes the client post.

This command uses `scripts/jira-client.js` and the Jira Service Management customer-request API. The request is a portal request, not a raw Jira issue.

## One-time setup

Set these values in the shell. Never put the token in a file or commit.

- `JIRA_SITE`: a bare `<tenant>.atlassian.net` hostname. Schemes, paths, ports, userinfo, trailing dots, IP addresses, and suffix variants are rejected.
- `JIRA_EMAIL`: the API-token owner's email.
- `JIRA_API_TOKEN`: the Atlassian API token, used by the read commands only.
- `JIRA_SERVICE_DESK_ID` and `JIRA_REQUEST_TYPE_ID`: optional positive numeric defaults.

The read-only discovery calls are:

```bash
node scripts/jira-client.js list-desks --execute
node scripts/jira-client.js list-types --service-desk [DESK_ID] --execute
```

## Create workflow

1. Preview the exact request. This makes no API call and reads no credentials:

```bash
node scripts/jira-client.js create --summary "[ONE-LINE SUMMARY]" --description "[2-3 SENTENCE DESCRIPTION]"
```

The client prints the exact serialized JSON, a binding line with this shape, and the HUMAN-RUN procedure:

```text
CREATE JSM REQUEST ON <tenant>.atlassian.net DESK <numeric-id> TYPE <numeric-id> PAYLOAD SHA256 <64-hex-digest>
```

2. Review the site, desk, request type, summary, description, and optional reporter. Changing any of them changes the SHA-256 in the binding line.

3. The administrator creates the request, either in the customer portal of that service desk with the printed summary and description pasted unedited, or by running the printed API line in their own terminal: the `curl` line in bash or zsh, or the `Invoke-RestMethod` line in PowerShell 7. Each prompts for the API token. Aegis does not run either step.

4. Prove the create with the printed read-back, filling in the issue key Jira returned. `--expect-sha256` is the digest of the service desk, request type, summary and description; `--not-before` is the time the preview printed (epoch milliseconds, ten minutes early for clock skew). Both are printed values with no free text, so the line pastes the same in bash and PowerShell:

```bash
node scripts/jira-client.js verify-create --issue [JIRA-###] --expect-sha256 [DIGEST] --not-before [PREVIEW_TIME_MS] --execute
```

To create on behalf of a reporter, add `--on-behalf-of [USER@DOMAIN.COM]` to the preview. Use only the operator-supplied reporter value; never invent one.

## Failure behavior

- `create` without flags: preview only, zero credentials, zero network, exit 0.
- `create` with `--execute` or `--confirm`, exact phrase or not: refusal, zero credentials, zero network, exit 1.
- Invalid `JIRA_SITE`: refusal before credentials or network.
- `verify-create` without `--execute`: dry run, zero network, exit 4 (NOT VERIFIED: a dry run proves nothing). With it: one GET; any mismatch in key, immutable ID, service desk, request type, summary, or description, or a request created before the preview (an older request with the same text), is exit 2 and the create is not proven. Any exit other than 0 is not a pass: a read-back that carries no creation time, no field collection, a malformed key or ID, or not exactly one of a field is exit 5 (INCONCLUSIVE: proves nothing either way), and the create is not proven either.
- API response bodies are withheld from terminal errors.

## Verification

`verify-create` passes only when one independent GET returns the same key with a valid immutable ID, a creation time after the preview, and the approved service desk, request type, summary, and description. It does not prove downstream automation or notifications completed; open the exact request in JSM and check its reporter and automation state before reporting the wider workflow complete. Record the verified `[JIRA-###]` key in the local ticket thread.
