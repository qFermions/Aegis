---
description: Create a Jira Service Management ticket from an Aegis work-up — turns a ticket's summary + resolution into a real JSM request. Dry-run first; placeholders only.
disable-model-invocation: true
---

# /jira-create

## Risk metadata

- **Risk level:** R0 in dry-run; R1 when `--execute` creates one request.
- **Access:** remote write only with an explicit bare `--execute` flag.
- **Credential-sensitive:** yes during execution; Jira credentials remain environment-only.
- **Invocation:** operator-only; Claude must not invoke this command automatically.

**What this does:** Takes the ticket you just worked and creates a real request in Jira Service Management (space **DevOps / Get IT Help**) via `scripts/jira-client.js`. Aegis already ends every ticket with a Jira-ready note — this closes the loop without leaving the terminal.

**Scope:** JSM Cloud, the service-desk request API (portal-visible request types), not raw Jira issues. Identities stay placeholders in anything Aegis writes; the operator substitutes real values at run time.

## Before you run (one-time setup)
Set these in your shell — **never commit a token** (the pre-commit scanner blocks it):
- `JIRA_SITE` = your-domain.atlassian.net
- `JIRA_EMAIL` = the API-token owner's email
- `JIRA_API_TOKEN` = from id.atlassian.com → Security → API tokens
- `JIRA_SERVICE_DESK_ID` and `JIRA_REQUEST_TYPE_ID` (defaults) — discover them once with the list commands below.

## Step-by-step

1. **Discover ids (first time only):**
   ```bash
   node scripts/jira-client.js list-desks --execute
   node scripts/jira-client.js list-types --service-desk [DESK_ID] --execute
   ```
   Put the chosen ids in `JIRA_SERVICE_DESK_ID` / `JIRA_REQUEST_TYPE_ID` so you can omit them later.

2. **Dry run (default — shows the exact payload, calls nothing):**
   ```bash
   node scripts/jira-client.js create --summary "[ONE-LINE SUMMARY]" --description "[2-3 SENTENCE DESCRIPTION — placeholders for any identity]"
   ```

3. **Create it** — add `--execute` once the payload looks right:
   ```bash
   node scripts/jira-client.js create --summary "..." --description "..." --execute
   ```
   On success it prints the issue key (e.g. `HELP-123`) and portal link.

   `--execute` is a bare boolean flag. Forms such as `--execute false` and `--execute=false` are rejected rather than treated as authorization.

> **On behalf of a reporter:** add `--on-behalf-of [EMAIL_OR_ACCOUNTID]` only with a real, operator-supplied value. Never invent one. Aegis keeps placeholders in the text it drafts.

## ⚠️ Risk warning
- A created request is **visible to the reporter** and can trigger JSM automations/SLAs. The dry run is the safety net — read the payload before `--execute`.
- The API token is a credential: shell env only, never a file, never a commit. If one is ever pasted into the repo, treat it as leaked — **revoke first** (rotation neutralizes; a later purge does not).

## ✅ Verification checklist
- Dry run printed the intended `serviceDeskId` / `requestTypeId` / summary / description.
- After `--execute`: issue key returned; open the portal link and confirm summary, request type, and (if used) reporter are correct.
- Description contains **no real identities** unless the operator deliberately supplied sanitized real values.

## JSM portal navigation tips (2026)
- **Edit the request form:** open a work item → **Request form** tab → drag the field from the right panel **onto the form canvas**. Fields not on the canvas don't show on the portal form even if they exist on the issue.
- **Department field:** it's a **custom dropdown**, not a system field — manage its options where the custom field is defined, not in the request type (working fix, March 2026).

## 📝 Jira-ready note
Paste the worked ticket's existing **Jira-ready note** as the `--description`. After creation, log the issue key back in the ticket thread so the work-up and the JSM request are linked.
