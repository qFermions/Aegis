# Audit trail (batch G3)

Aegis advises; humans execute (`PRODUCT_CONTRACT.md`). This folder records what Aegis itself did, so an owner can later check it: each connector call, each procedure Aegis issued, each approval reference the operator supplied, and each `verify-*` result. It never records what a person did in a vendor system; the `verify-*` read-backs prove that.

## Files

| file | what it is |
|---|---|
| `audit-log.js` | The one module that writes the trail, and its CLI (`verify`, `status`, `procedure`, `approval`). |
| `change-record.js` | Change records for R2 and R3 procedures: the issued digest, the approval reference and the `verify-*` read-back, joined by a change id. |

The trail lives in `.aegis-state/audit/` (gitignored), or in `AEGIS_AUDIT_DIR`: `audit.jsonl` (one entry per line), `audit.head` (the last seq and hash) and, while a write is in progress, `audit.lock`.

## The chain

Every entry is one JSON line with `seq` (1, 2, 3 and so on), `at` (UTC), `kind`, its fields, `prev` (the `hash` of the entry before it; 64 zeros for the first) and `hash`, the SHA-256 of `aegis.audit.v1`, `prev` and the entry's canonical JSON without its hash. `audit.head` names the last `seq` and `hash`, written after the line by an atomic rename.

`node scripts/audit/audit-log.js verify` walks the chain and names the first broken link: a line that is not JSON (a cut or edited line), a `seq` out of order (a missing, inserted or reordered entry), a `prev` that does not match (a removed, inserted or reordered entry), a `hash` that does not match (an edited entry), a field the trail never writes, a head that names a later entry (a removed tail) or a missing head. Exit 0 intact, 2 broken. An append onto a broken tail is refused, so every Aegis read that records a call stops (the contract's `AUDIT_FAILED` state) until a person runs `verify` and decides.

## What is written, and what never is

Five kinds, each with a fixed field list, every value of a fixed form; anything else is refused before a byte is written:

| kind | fields |
|---|---|
| `connector-call` | connector name, operation (route or query name), result state, attempts, HTTP status, request id, handoff state, duration in ms |
| `procedure` | command, gate id, R class, one placeholder target such as `[UPN]`, the read-back that proves it (`connector:verify-...`, for a change record), the procedure's SHA-256, change id |
| `approval` | an issue key such as `IT-123`, gate id, the approved procedure's SHA-256, change id |
| `verify` | connector, `verify-*` command, verified true or false, result state, change id (the `--change` the read-back ran under, or null) |
| `change-link` | change id, the seq of a `verify` entry already in the trail (`change-record.js link`; refused unless it is the connector and command the change named at `open`, ran under `--change` with this change id, verified, after the approval, and no other change holds it) |

No body, no response data, no free text, no secret, no token and no personal value can be written: a field outside the list is refused, a value outside its form is refused (a target must be a placeholder, a reference an issue key), and every value is also checked against credential shapes (Slack, GitHub, Google, Okta tokens, a JWT, a bearer or basic header, a private key block).

## Binding a read-back to its change (batch G3 close-out, owner decision 1)

A change record for an R2 or R3 procedure runs in this order, and only people run the procedure itself:

1. `node scripts/audit/change-record.js open --command C --gate G --r-class R2|R3 --target [UPN] --read-back CONNECTOR:verify-... --procedure-file FILE` records the issued procedure's digest and prints the change id (`[CHANGE_ID]` in the runbooks, `chg-` and 12 lower-case hex characters).
2. `change-record.js approve --change [CHANGE_ID] --ref ISSUE-123 --procedure-sha256 H` records the ticket's approval of exactly that digest. It authorizes a person's procedure and triggers no write.
3. A person runs the procedure.
4. The read-back runs with `--change [CHANGE_ID] --execute`. Before any read, dry or live, the `verify-*` command (any of the nine connectors: Fleet, GitHub, Google Workspace, Jamf Pro, Linear, Microsoft Graph, Okta, Slack, Jira) checks the id's form and that this trail holds the change, opened for this connector and command, with an approval of its procedure recorded after it (`change-record.js` `bindRefusal`); otherwise it refuses with exit 1 and reads nothing. Its `verify` entry records the change id.
5. `change-record.js link --change [CHANGE_ID] --verify-seq N` joins that entry to the change (N is the entry's seq, which the read-back prints as `audit_seq`, or in Jira's "Recorded as audit entry N" line); `status --change [CHANGE_ID]` reports done only when the digest, the approval and a verified read-back bound to this change match, in that order.

A read-back run without `--change` still prints its verdict and records `change: null`, but `link` refuses it, and `status` never counts it, even when a link to it is written into the trail around the CLI. The same holds for a read-back bound to another change. What the entries cannot say is which object the read-back read: they hold placeholders, never a user or device value, so matching the object stays the operator's step (`docs/aegis/boundary-audit.md` row 37).

## Concurrency

One writer at a time: `audit.lock` is created with O_EXCL and holds the writer's process id. A lock left by a process that no longer exists is removed under a second lock (`audit.lock.steal`) and only if it is still the same lock, so a fresh lock is never removed. A writer waits up to 15 s, then fails closed.

## What the chain cannot prove without external storage

- **A rewrite of the whole file.** Anyone who can write this folder can delete the log and head, or rebuild a consistent chain with different entries; the hashes are not keyed and nothing outside this machine holds a copy. Proving that no entry was ever removed or replaced needs the head (or each entry's hash) sent somewhere the writer cannot change: a write-once store, a log service, or a signed copy the owner keeps.
- **A removed tail together with a rewritten head.** The head catches a cut tail only while the head itself is intact.
- **The time.** `at` is this machine's clock.
- **Completeness.** The trail holds what the Aegis CLIs and the contract recorded. A command run outside them (a person's own terminal, an agent holding a shell, `.claude/agents/*`) is not recorded; that is the residual named in `docs/aegis/boundary-audit.md` rows 4 and 5.

## Status

`node scripts/audit/audit-log.js status [--since 24h|7d|<UTC time>]` prints connector calls and failures in the window, by connector: calls, failures, the failure states and the handoff states (`RETRIES_EXHAUSTED`, `RETRY_AFTER_TOO_LONG`, `RETRY_BUDGET_SPENT`, and `RATE_LIMITED` since the batch G3 close-out). Only entries before the first broken link are counted, and the summary says whether the chain is intact. Nothing leaves the machine.
