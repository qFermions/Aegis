# Writing a postmortem

A postmortem explains a failure so the team can stop it from happening again. It is written after the service is stable, by the people who worked the incident, and read by anyone who could have made the same mistake. Aegis drafts it from the evidence the team gives; the incident owner corrects it and publishes it. For a security incident the security lane owns the review, and this template is only its engineering part.

## When to write one

- Users or another team were affected, or a deploy, a pipeline or a data job was down long enough that someone had to work around it.
- The fix needed a revert, a restore or a manual change in production.
- A near miss that only luck stopped (the backup existed by chance, the bad change was caught at the last step).

## The rules

- **Blameless.** It describes what happened and why the system allowed it, never who is at fault. Write roles ("the on-call engineer", "the reviewer"), not names. A person who made a mistake did what the tools, the process and the information let them do: the question is what made the mistake easy and the catch hard.
- **Facts kept apart from guesses.** Each claim is either seen (a log line, a graph, a commit, with the time) or marked as a belief ("we think", "not confirmed").
- **Times in one zone.** UTC, written the same way all through.
- **Contributing factors, not one root cause.** Most failures need several things to line up. List each one; the "root cause" is the deepest one the team can change.
- **Action items that close a gap.** Each has one owner (a role or a team), a due date, and the gap it closes. "Be more careful" is not an action item; a test, a check, an alert, a guard in a script or a changed default is.

## The template

```text
Title: <what failed, in plain words>        Severity: <the team's scale>     Status: draft | final
Date of incident: <YYYY-MM-DD>              Author: <role>                    Reviewed by: <role>

Summary
  Two or three sentences: what broke, for whom, for how long, and how it was fixed.

Impact
  Who and what was affected (users, services, data, money), for how long, measured where possible.
  What was not affected, when people will ask.

Timeline (UTC)
  <time>  first sign (an alert, a report, a failed job), and where it was seen
  <time>  detected by <role>
  <time>  each decision and action, with what it was based on
  <time>  mitigated (users no longer affected)
  <time>  resolved (the cause fixed)
  Unknown times are written "unknown", not guessed.

Root cause and contributing factors
  The chain from the trigger to the impact, one link per line.
  For each link: why it happened, and why nothing stopped it there.

Detection
  How we found out, how long it took, and what would have found it sooner.

What went well
  What limited the damage (a revert that worked, a test that caught the second case, a clear runbook).

What went poorly, and where we were lucky

Action items
  | Action | Gap it closes | Owner (role or team) | Due date | Ticket |
  At least one item makes detection faster and one makes the same trigger harmless.

Evidence
  Links to the logs, runs, commits, pull requests and graphs this document relies on.
```

## What Aegis checks in a draft before handing it over

- Every timeline line has a time and a source, or says unknown.
- No sentence names or blames a person.
- Each action item has an owner, a date and a gap; no item is "be careful" or "communicate better" alone.
- The impact says who and how long, with numbers where the evidence has them.
- A secret, a customer's data or a personal detail in the evidence stays out of the document; the document points to where the evidence is kept.
- When the evidence shows a compromise the team did not treat as one, the draft says so and names the security escalation (judgment rule a) before it is published.
