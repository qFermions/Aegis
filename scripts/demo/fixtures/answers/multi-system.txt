## Fix
**What's wrong:** a new starter begins on Monday and has no accounts yet in the four systems the team uses.
**Do this:**
1. Create the account in Microsoft 365 admin center → Users → Active users → Add a user, with the licence the role needs.
2. Add the person to the team's groups in the same place, under Groups.
3. Invite them in each of the other three systems from that system's admin page.
4. Send the start-day details to their manager, not to a personal address.
**Done when:** the starter signs in on day one and sees mail, chat and the team's files.
**Stop if:** the manager cannot confirm the start date and role in writing.
**Tell the user:** Your accounts will be ready before Monday. Your manager has your sign-in details.

This needs a longer plan across four systems: see Details.

## Details
Order matters: the Microsoft account first, because the other systems sign in with it. Each system's step, its risk and its undo are below, and the ticket note is at the end.

1. Microsoft 365: one account, one licence. Undo: delete the account within 30 days.
2. Chat, video and the file store: one invite each. Undo: remove the invite.

Ticket note: new starter accounts created in four systems; manager confirmed role and date.

```aegis-desk
Gate: example-user-create-portal
Gate: example-invite-portal
Phrase: CREATE USER [UPN]
Change record: R2, read-back msgraph:verify-account-enabled
```
