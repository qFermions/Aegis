---
description: Update a Jira Service Management ticket — add a resolution comment, read status, or transition state. Dry-run first; transitions double-gated. Placeholders only.
disable-model-invocation: true
---

# /jira-update

## Risk metadata

- **Risk level:** R0 for `get`/dry-run, R1 for one comment, and R3 for a reporter-visible workflow transition.
- **Access:** remote read or remote write according to the selected subcommand.
- **Credential-sensitive:** yes during execution; Jira credentials remain environment-only.
- **Invocation:** operator-only; Claude must not invoke this command automatically.

**What this does:** Updates an existing JSM request via `scripts/jira-client.js` — add a comment (internal or reporter-visible), read current status, or move the ticket's state. Pairs with `/jira-create`.

**Setup:** same env vars as `/jira-create` (`JIRA_SITE`, `JIRA_EMAIL`, `JIRA_API_TOKEN`). Never commit a token.

## Step-by-step

1. **Read status** (confirm you're acting on the right ticket):
   ```bash
   node scripts/jira-client.js get --issue [ISSUE_KEY] --execute
   ```

2. **Add a comment** — dry-run shows visibility before posting:
   ```bash
   # internal note (default — reporter does NOT see it):
   node scripts/jira-client.js comment --issue [ISSUE_KEY] --body "[NOTE]"
   # add --execute to post; add --public to make it reporter-visible:
   node scripts/jira-client.js comment --issue [ISSUE_KEY] --body "[REPLY TO USER]" --public --execute
   ```

3. **Transition state** — ⚠️ double-gated, see warning:
   ```bash
   # dry run (shows it would move, calls nothing):
   node scripts/jira-client.js transition --issue [ISSUE_KEY] --to "Resolved"
   # actually move it — requires BOTH flags:
   node scripts/jira-client.js transition --issue [ISSUE_KEY] --to "Resolved" --execute --confirm
   ```
   The client looks up the available transition by name first and fails loudly (listing valid options) if `--to` doesn't match — so a wrong status name can't silently no-op.

`--execute`, `--confirm`, and `--public` are bare boolean flags. Supplying values such as `false`, `0`, or an equals form is rejected rather than treated as authorization.

## ⚠️ Risk warning
- **`--public` comments are visible to the reporter.** Default is internal; opt into public deliberately. Keep placeholders out of reporter-facing text only where a real value is needed — and only with operator-supplied sanitized values.
- **Transitions are a state change** (reporter-visible, may fire SLAs/automations) — the destructive-action gate applies: dry-run unless **both** `--execute` and `--confirm` are passed. For a transition that closes or escalates a high-impact ticket, run the plan past Nova first.
- Token = credential: env only, never committed. Leak → revoke first.

## ✅ Verification checklist
- `get` shows the expected status before and after.
- Comment: dry-run visibility line matched intent (internal vs public) before `--execute`.
- Transition: client confirmed the new state name; re-run `get` to prove the move landed.

## 📝 Jira-ready note
After updating, note in the ticket thread what changed in JSM (comment posted / status moved) and the new state, so the local work-up stays in sync with the portal.
