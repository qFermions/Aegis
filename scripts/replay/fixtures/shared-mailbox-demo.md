# Verified work-up — shared-mailbox access (synthetic demo fixture)

> Synthetic, placeholder-only. Used by `scripts/replay/replay-demo.js`. This is what a
> verified replay case looks like when rendered: the operator sees this text verbatim.

## Verdict
`[UPN]` needs **Full Access** on `[SHARED_MAILBOX]`; auto-mapping then adds it to their Outlook within about an hour.

## Step-by-step fix (portal first)
> **PREVIEW ONLY [replay-demo-shared-mailbox-steps]:** Synthetic demo fixture, not a runbook: these steps show what a rendered replay case looks like and do not authorize a mailbox permission change. A real grant runs from its gated runbook.
1. Exchange admin center (admin.exchange.microsoft.com) → Recipients → Mailboxes → `[SHARED_MAILBOX]` → **Delegation** → **Read and manage (Full Access)** → **Edit** → **Add permissions** → `[UPN]` → Save.
2. Only if they must send from it: same page → **Send As** → **Edit** → add `[UPN]`.
3. Tell the user to restart Outlook; if the mailbox has not appeared after 60 minutes, add it manually: Outlook → File → Account Settings → Account Settings → Email → Change → More Settings → Advanced → Add → `[SHARED_MAILBOX]`.

## ✅ Verification checklist
- [ ] EAC Delegation list shows `[UPN]` under Read and manage
- [ ] The mailbox appears in the user's Outlook folder list and opens

## 📝 Jira-ready note
> Resolved [date/time]. Granted `[UPN]` Full Access to `[SHARED_MAILBOX]` in the Exchange admin center (Send As [added / not requested]). Delegation read back; user confirmed the mailbox is visible in Outlook. Time spent: [X] min.

Verified: EAC Delegation read-back showed `[UPN]` under Read and manage; user confirmed at [@Aegion].
