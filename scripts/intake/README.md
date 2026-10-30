# Intake (batch G3, task 4a)

`intake.js` turns one item from outside into one case in the graph engine's INTAKE node
(`scripts/graph/engine.js`, `newState`). The case's ticket carries the text, the source,
provenance `external_content` and an intake record. Every field is data: nothing in an
imported item is followed as an instruction, and instruction-like text is flagged.

Aegis advises; humans execute. The intake reads a file, or sends one Linear GraphQL query
(`AegisIssueIntake`, a read) through `scripts/adapters/linear-client.js`. It writes nothing,
except the case's `state.json` under `--save`, in the folder `graph-cli.js` uses
(`AEGIS_GRAPH_RUNS_DIR`, default `tasks/graph-runs/`, gitignored).

```bash
node scripts/intake/intake.js email --file [FILE_NAME].eml
```

```bash
node scripts/intake/intake.js linear --issue [ISSUE_ID] --execute --save
```

## Sources and formats

| Source | Input | Tenant check (variable) | Origin id kept |
|---|---|---|---|
| `linear` | `--issue [ISSUE_ID] --execute` (live, one query), or `--file` with the saved `AegisIssueIntake` answer (`{"data": {"issue": ..., "organization": {"urlKey": ...}}}`) | `organization.urlKey` equals `LINEAR_ORG` | the issue identifier |
| `github` | `--file` with the REST issue object, alone or as `{"issue": ..., "comments": [...]}` (the GitHub connector of task 5a can produce it) | the owner in `repository_url` and `html_url` equals `GITHUB_ORG` | `<repo>#<number>` |
| `slack` | `--file` with `conversations.replies` output (`{"messages": [...]}`) or an export day file (a list of messages) | the thread's first message `team` equals `SLACK_TEAM_ID` | the thread `ts` |
| `email` | `--file` with an `.eml` file: plain, HTML-only or multipart; base64 and quoted-printable; RFC 2047 subjects | a To, Cc, Delivered-To or X-Original-To address in `AEGION_DOMAIN` or a subdomain | `msgid-` and 16 hex characters of the Message-ID's SHA-256 |

The text of a case is the title, a blank line, the body, a blank line, then one line per
comment or reply (`Comment 1: ...`), at most 50.

## States (exit code)

| State | Exit | Meaning |
|---|---|---|
| ACCEPTED | 0 | One case was created. |
| OVERSIZED | 1 | The raw item is over 524,288 bytes (512 KiB, checked before parsing), or the ticket text is over 20,000 characters. |
| MALFORMED | 1 | The item is not the format above (not JSON, no title, no headers, no MIME boundary, a bad issue ID, ...). |
| EMPTY | 1 | No title and no text. |
| BLOCKED | 1 | The text holds a credential, a tenant literal or another org's token (the graph sanitizer's BLOCK list). It is never echoed. |
| READ_FAILED | 2 | The live Linear read failed; the record carries the two-part operator message. |
| TENANT_UNBOUND | 3 | The tenant variable is unset or not a valid value, or the item does not name its tenant. |
| TENANT_MISMATCH | 3 | The item belongs to another tenant. Its value is never echoed. |

Every state other than ACCEPTED says what happened (`reason`), that nothing was kept, and
the next step (`next_step`).

## What is redacted

Email addresses become `[USER@DOMAIN.COM]`, phone numbers `[PHONE_NUMBER]`, GitHub
@mentions `[GITHUB_USER]`, Slack user mentions `[USER_ID]`, and the tenant's own values
their `[@Aegion_*]` token. The counts are in the record. Names written in free text are not
detected: they stay as data, as in a typed ticket.

## HTML

An email with only a `text/html` part, or a body that is only HTML, becomes the text a
reader sees. Script, style and head blocks are dropped. An HTML comment is kept as a
quoted line (`HTML comment (hidden in the message, kept as data): ...`), so text hidden
there is scanned and flagged like the rest. The conversion is one forward pass, so a
hostile body near the size limit takes milliseconds, not minutes (`intake.test.js`).

## Tests

`node --test scripts/intake/intake.test.js`: every source with injection, a second
tenant, an unset tenant, oversized, malformed, empty, HTML-only, a credential and
redaction cases; the live Linear read through an injected transport; the CLI. No test
opens a socket (`scripts/adapters/socket-tripwire.js`).
