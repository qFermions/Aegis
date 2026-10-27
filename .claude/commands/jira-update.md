---
description: Read one Jira Service Management request, and prepare one comment or transition for the administrator to perform, then prove it by read-back. Aegis never sends the write. Placeholders only.
disable-model-invocation: true
---

# /jira-update

## Risk metadata

- **Risk level:** R0 for reads, previews, preflights, and read-backs; R1 for one comment and R3 for a reporter-visible workflow transition, both performed by the administrator.
- **Access:** read-only for Aegis. `scripts/jira-client.js` never sends a write (its transport refuses every method but GET); the administrator performs the comment or transition in the portal or their own terminal.
- **Credential-sensitive:** yes for live reads; Jira credentials remain environment-only. The printed `curl` asks the administrator for the API token instead of taking it from the environment.
- **Invocation:** operator-only; Claude must not invoke this command automatically.

## Execution boundary

Aegis advises; humans execute (`PRODUCT_CONTRACT.md`). `scripts/jira-client.js` uses bare `--execute` only for reads. `comment` prints the exact payload, a binding line, and a HUMAN-RUN procedure; `transition --execute` runs a read-only preflight and prints the same. `--execute` on `comment`, and `--confirm` on `comment` or `transition`, are refused with exit 1 before any credential read or network call. `--public` remains a bare visibility switch.

Comment binding lines carry the normalized Jira site, the issue, the visibility, and the full payload SHA-256. Transition binding lines also carry the immutable issue ID, a current-state hash, the selected transition ID, and a transition hash, so two preflights that print different lines prove the request moved.

## Read one request

```bash
node scripts/jira-client.js get --issue [JIRA-###] --execute
```

The response must return the same issue key, a numeric immutable issue ID, and a valid current status.

## Add one comment

1. Preview the exact payload and visibility. Both commands are inert:

```bash
# Internal note; reporter cannot see it.
node scripts/jira-client.js comment --issue [JIRA-###] --body "[NOTE]"

# Public reply; reporter can see it.
node scripts/jira-client.js comment --issue [JIRA-###] --body "[REPLY TO USER]" --public
```

The binding line has one of these shapes:

```text
POST INTERNAL JSM COMMENT ON <tenant>.atlassian.net ISSUE [JIRA-###] PAYLOAD SHA256 <64-hex-digest>
POST PUBLIC JSM COMMENT ON <tenant>.atlassian.net ISSUE [JIRA-###] PAYLOAD SHA256 <64-hex-digest>
```

2. The administrator posts the comment: in the request's agent view as an internal note or a reply to the customer, matching the printed visibility, with the printed body pasted unedited; or by running the printed `curl` line in their own terminal (it prompts for the API token). Aegis does not run either step.

3. Prove it with the printed read-back, filling in the comment ID Jira returned:

```bash
node scripts/jira-client.js verify-comment --issue [JIRA-###] --comment-id [COMMENT_ID] --body "[NOTE]" --execute
```

Add `--public` to the read-back for a public reply. An INTERNAL read-back fails on a PUBLIC comment and the reverse.

## Transition one request

Transitions can fire SLAs, automations, notifications, and reporter-visible workflow changes. Use this protocol:

1. Local preview, zero API calls:

```bash
node scripts/jira-client.js transition --issue [JIRA-###] --to "Resolved"
```

2. Read-only live preflight. This GETs the request and every paginated transition page, requires one unique transition match, and prints the binding line and the HUMAN-RUN procedure. It never POSTs:

```bash
node scripts/jira-client.js transition --issue [JIRA-###] --to "Resolved" --execute
```

The binding line shape is:

```text
TRANSITION JSM ISSUE [JIRA-###] ID <immutable-id> ON <tenant>.atlassian.net FROM STATE SHA256 <64-hex-digest> USING TRANSITION <numeric-id> SHA256 <64-hex-digest>
```

3. Re-run the preflight just before acting. If the binding line changed, the request moved: stop and read it again. The client never follows a server-supplied pagination URL; it constructs bounded numeric pages on the already validated Jira host.

4. The administrator applies the printed transition, from the request's status button or by running the printed `curl` line in their own terminal. Aegis does not run either step.

5. Prove it with the printed read-back:

```bash
node scripts/jira-client.js verify-transition --issue [JIRA-###] --issue-id [ISSUE_ID] --from-status "[STATUS BEFORE]" --execute
```

## Failure behavior

- Local transition preview: zero credentials and zero network.
- Transition `--execute` without `--confirm`: read-only GET preflight; zero POST.
- Any `--confirm` on `comment` or `transition`, and `--execute` on `comment`: refusal, zero credentials, zero network, exit 1.
- Duplicate transition names, duplicate transition IDs, missing match, malformed pages, or non-progressing pagination: exit 2.
- A read-back that does not prove the write (different ID, different body or visibility, unchanged status, read failure): exit 2, and the write is not proven.
- API response bodies are withheld from terminal errors.

## Risk warning

- `--public` makes a comment reporter-visible. Default visibility is INTERNAL.
- A transition is a state change even when its label sounds harmless. The binding line identifies this exact issue state and transition; a line from another request or an older preflight does not describe what the administrator is about to change.

> **PREVIEW ONLY [jira-token-leak-response]:** A suspected token leak requires immediate credential-owner/provider revocation, but this Jira command cannot perform it. Do not paste the token; report only the credential type and route the exact credential identity to the private incident workflow.

## Verification

- Comment: `verify-comment` proved the immutable comment ID, the exact body, and the intended visibility by one independent GET. Inspect the comment in JSM before reporting downstream effects.
- Transition: `verify-transition` proved the same immutable issue ID left the status the preflight saw. If it exits 2, do not claim completion; inspect the actual Jira state.
- Record the verified change in the local ticket thread so the work-up stays synchronized with `[JIRA-###]`.
