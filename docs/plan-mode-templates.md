# Plan-Mode Templates — High-Risk Surfaces

When a change crosses 3+ system boundaries or touches a security gate, Aegis writes the plan *first*, gets explicit confirmation, then executes. These are the templates for the four highest-risk surfaces. Every plan ends with a Nova review hand-off because the supervisor pattern catches the gap a single agent doesn't see.

---

## Template 1 — Conditional Access policy change

**When to use:** any new CA policy, scope expansion, or condition change. CA policy errors lock everyone out instantly.

### Plan
```
Step 1 — Snapshot current state
  - Entra → Protection → Conditional Access → export current policy JSON
  - Note which break-glass accounts exist and confirm they're excluded
  - Confirm the *current* sign-in volume (Sign-in logs → last 24h baseline)

Step 2 — Build new policy in Report-only mode
  - Create the policy with desired conditions and grant controls
  - Set state = Report-only (does NOT enforce; logs as if it did)
  - Save and let it run for 24h

Step 3 — Analyze Report-only results
  - Sign-in logs → filter by policy name → confirm impact matches intent
  - Run the What-If tool with 3 representative user scenarios
  - If any unexpected user/scenario would be blocked, STOP and revise

Step 4 — Verify break-glass before enforcing
  - Confirm break-glass account excluded from this policy
  - Confirm break-glass credentials in password manager + paper safe
  - Test break-glass sign-in (privately) — must succeed bypassing MFA

Step 5 — Enforce
  - Flip policy state from Report-only to On
  - Watch sign-in logs for next 30 min — any unexpected blocks → flip back

Step 6 — Document
  - Update internal CA policy registry with: purpose, scope, owner, review date
  - Jira ticket links the policy export and the Report-only analysis
```

### Verification gate
Cannot mark complete until: Report-only ran 24h with no surprise blocks · break-glass tested · post-enforce 30-min window showed no unexpected failures.

### Hand to Nova
> "CA policy plan attached. New policy is [purpose], scope is [groups]. Anything missing in the Report-only analysis? Anything risky in the enforcement window I haven't accounted for?"

---

## Template 2 — Mass license operation (>10 users)

**When to use:** removing or reassigning licenses across more than 10 users. Mistakes here are mailbox-deletion-scale damage.

### Plan
```
Step 1 — Generate the target list
  - Source: HR offboarding sheet / department-restructure list / etc.
  - Build a CSV: UPN, current SKU, target action (remove / change SKU / etc.)
  - Two-pass review: yourself + one other person (or paste to Nova for verification)

Step 2 — Spot-check 3 random rows
  - For each, confirm in M365 admin that the user's current state matches the CSV
  - If any row is wrong, STOP — regenerate the list

Step 3 — Pre-flight: convert mailboxes if needed
  - For removals, ensure every affected mailbox is already converted to shared
  - Run the conversion as a separate pre-step; verify before proceeding

Step 4 — Execute with logging
  - Use Set-MgUserLicense in a loop, write per-user result to a CSV
  - Sleep 200ms between calls to avoid throttling
  - On any failure: log and continue (do NOT abort the whole batch — one stuck user shouldn't block the other 49)

Step 5 — Post-flight reconciliation
  - Re-query each UPN's licenses, compare to expected target state
  - Anyone whose state doesn't match: investigate, fix, document

Step 6 — Restore plan ready
  - Keep the pre-state CSV; if anything blows up, you can re-assign licenses to roll back
```

### Verification gate
Every UPN's post-state matches the CSV target · the result CSV is committed to the ticket · seat count in M365 Billing matches expected delta.

### Hand to Nova
> "Mass license op plan attached. Target list is [N] users, all in [group/department]. Pre-conversion state confirmed for mailboxes. Anything missing? Anything I should sequence differently?"

---

## Template 3 — Site-to-site VPN cutover (Meraki MX)

**When to use:** migrating a site from one VPN topology to another. Done wrong, the site is offline until someone drives there.

### Plan
```
Step 1 — Window scheduling
  - After-hours window, both sides
  - On-site contact at the remote end (someone with physical access to the MX)
  - Backup connectivity ready (cellular hotspot, secondary uplink)

Step 2 — Capture current config
  - Both MXs: export current config (Security & SD-WAN → Configuration → export)
  - Document current VPN peer list, subnets, firewall rules
  - Note any routes that depend on the current topology

Step 3 — Pre-stage new config (do NOT enable)
  - Build the new site-to-site VPN config in Meraki dashboard but leave the link Disabled
  - Pre-add the new subnet to firewall rules on both sides
  - Run pre-flight: ping/route tests that should fail (because new link is disabled)

Step 4 — Cutover (single window)
  - Disable the old topology
  - Enable the new VPN link
  - Watch dashboard until both peers show Connected
  - Run connectivity tests from both sides

Step 5 — Validate end-to-end
  - File share access from remote site → main office
  - VoIP registration if applicable
  - AD authentication
  - Print queues, anything else that crosses sites

Step 6 — Rollback plan if any test fails
  - Re-enable old topology, disable new (single click each)
  - Both old configs are still saved (Step 2)
  - Schedule a second window after diagnosing
```

### Verification gate
Dashboard shows both peers Connected · all cross-site tests pass · on-site contact confirms physical link/equipment is happy.

### Hand to Nova
> "S2S VPN cutover plan attached. Window is [date/time], on-site contact is [PERSON] at [SITE]. Rollback path is well-defined. Anything I haven't accounted for? Subnet conflicts, route precedence, anything?"

---

## Template 4 — BitLocker recovery key retrieval (sensitive)

**When to use:** user's machine prompts for BitLocker recovery key and you need to retrieve it from Intune/Entra. Sensitive because the key unlocks the entire disk.

### Plan
```
Step 1 — Identity verification (critical)
  - Callback the user on a known good number (not the one in their ticket)
  - Verify identity: name + manager + recent project, not just "where do you work"
  - Confirm the device by serial or asset tag, not just hostname

Step 2 — Confirm legitimate scenario
  - Common: TPM lost trust after firmware update, hardware change, OS update
  - Uncommon and worth flagging: device wasn't supposed to be powered on, was reported lost,
    or the user is in offboarding flow

Step 3 — Retrieve key
  - Intune → Devices → [device] → Recovery keys → BitLocker recovery key
  - Alternate path: Entra → Devices → [device] → BitLocker keys

Step 4 — Read the key, do NOT email or message it
  - Read it to the user verbally on the callback
  - Have them enter it, confirm boot completes
  - Verify Windows comes up clean and TPM re-syncs

Step 5 — Post-event check
  - Confirm device is back to compliant in Intune
  - If TPM keeps losing trust → escalate to a hardware investigation, don't keep handing out keys
  - Document the retrieval in the ticket: who asked, who verified, when

Step 6 — Audit log
  - The retrieval IS logged automatically in Entra audit logs
  - Add the ticket number as a cross-reference in the user's record
```

### Verification gate
Identity verified independently · device recovered and is back to compliant · audit log entry exists and is annotated with the ticket.

### Hand to Nova
> "BitLocker key retrieval plan. User identity verified via callback to [phone]. Scenario looks like routine TPM trust loss after [event]. Anything missing in the verification path? Any policy I'm forgetting?"

---

## Common pattern across all four

1. **Snapshot state first** — you cannot roll back what you didn't capture.
2. **Stage in safety mode** — Report-only, Disabled, dry-run — before enforcing.
3. **Verify break-glass / rollback** — confirm the escape hatch *before* you need it.
4. **Single change window with watch period** — flip, watch for unexpected breakage, decide.
5. **Document outcome, not just the change** — what was supposed to happen vs what did.
6. **Nova hand-off** is non-optional for any of these — pure machine review misses human-system gaps.
