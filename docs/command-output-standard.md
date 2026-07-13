# Command Output Standard — Global (all slash commands)

> v1.0 (2026-06-10) — adopted from the Hermes output review (relayed by the operator).
> Authority: this standard governs the **shape of slash-command output**. It sits BELOW the
> security gates (CLAUDE.md Core Rules #4/#5/#10, Koinon SR-1–SR-4) and the placeholder
> dictionary (`shared/security/placeholder-dict.md`) — it can never relax them.
> Command `.md` files are content sources; Aegis shapes the rendered output per this standard.

## The regression this fixes

Commands were sometimes returning summary/checklist blocks alone. Not acceptable: a checklist
tells you *what* to verify, not *how* to execute. Every operational command must produce a
**field-ready, GUI-first execution runbook** — phases with portal paths and per-phase
verification — with the checklist near the end, and mentoring after the work.

## Global rules (every command, every variant)

1. GUI/portal execution steps are mandatory for operational IT commands — exact navigation paths.
2. Checklists alone are never the answer; the single final checklist comes AFTER the phased steps.
3. PowerShell is secondary: plain-English comment per line, collapsed `<details>`, unless the operator asks for automation.
4. Placeholders only — inherit Koinon `[@Aegion_*]` + generic tokens. Never invent a competing set.
5. Preserve every admin/destructive gate. Never claim completion unless verified ("deployed = verified, not written").
6. If the operator already gave an input, don't ask for it again.
7. Mentoring is capped: at most ONE **Aha moment** + ONE **Career upgrade** line per output, placed after the operational content. Deeper teaching only on request.
8. Output discipline (2026-06-10 lesson): structure once and stop — no duplicated sections, exactly one checklist, no unrequested recap, no corrupted fragments. If length forces a cut, end cleanly with "Want me to continue with the next section?"
9. End with one useful **Next action** line — not a recap.
10. No fake slash commands — only reference commands that exist in `.claude/commands/`.

## Variant A — Operational runbook

For commands that change identity, access, licensing, devices, mail, VoIP, or production state
(`/new-user`, `/offboard`, `/device-wipe`, `/sharepoint-access`, `/shared-mailbox`, `/distribution-list`, `/mailbox-permissions`, `/email-whitelist`, `/email-quarantine`, `/new-device-setup`, `/unite-*`, `/jira-*`, …).

```
# [Command] Runbook — [Context]

## ⚠️ Admin / safety gate          ← what's sensitive/destructive, approval+scope needed,
                                      self-execute vs guided, "not done until verified"
## Inputs needed                   ← minimum placeholders to execute safely
## Fast path                       ← short numbered map of the whole workflow

## Phase N — [Name]                ← repeat per phase
**Purpose** — one sentence.
**GUI steps** — numbered portal path, clicks, values.
**Optional PowerShell** — only if useful; collapsed; commented per line.
**Verification checkpoint** — [ ] what success looks like before moving on.
**Gotcha** — only if real.

## Final verification checklist    ← once, critical points only, no duplicates
## Paste-ready ticket note         ← Jira note / user reply / vendor note, placeholders only
## Aha moment                      ← one mental model
## Career upgrade                  ← one sentence to the AI/cloud/DevOps path
## Next action                     ← "Start Phase 1 after confirming [X]."
```

## Variant B — Troubleshooting

For diagnostic commands (`/troubleshoot`, `/mfa-issue`, `/printer-issue`, `/wifi-issue`, `/lan-wan`, `/vpn-check`, `/ad-connect`, `/teams-issue`, `/outlook-issue`, `/onedrive-issue`, `/email-to-spam`, `/intune-compliance`, `/meraki-*`, `/sip-trunk-status`, `/security-alert-triage`, …).
Matches the CLAUDE.md Response Format, plus the capped learning tail:

```
## Verdict → ## What to check first → ## Step-by-step fix (GUI first; optional PS collapsed)
→ ## ⚠️ Risk warning → ## ✅ Verification checklist → ## 📝 Jira-ready note
→ ## Aha moment (one) → ## Career upgrade (one line) → ## Next action / escalation if unresolved
```

Symptom intake first when the ticket is ambiguous — ONE clarifying question max.

## Variant C — Documentation / comms

For `/write-sop`, `/runbook`, `/incident-report`, `/board-report`, `/vendor-email`, `/escalation-note`, `/ticket-response`, `/draft-email`.

```
## Purpose → ## Structure (what the doc will contain) → ## Draft (the deliverable)
→ ## Review checklist → ## Career upgrade (one line) → ## Next action
```

No admin gate unless the comm itself is risky (e.g., external escalation naming an incident).

## Variant D — Learning

For `/cloud-lab`, `/devops-drill`, `/ai-engineer-drill`, training-mode asks.

```
## Goal → ## Aha moment (mental model) → ## Lab (hands-on, numbered)
→ ## Verify → ## Common mistake → ## Career upgrade → ## Stretch task (optional)
```

One drill per invocation. No long theory dump.

## Verification (how this standard is enforced)

- The structure lint (backlog: `tasks/todo.md` engineering item) should check each command file
  has phased GUI steps before its checklist, exactly one checklist, and a paste-ready note.
- Repo `.claude/commands/<name>.md` and deployed `~/.claude/skills/<name>/SKILL.md` must have
  identical bodies (2026-06-09 drift lesson) — SKILL.md written BOM-free.
