# Command Output Standard — Global (all slash commands + plain-question answers)

> v1.2 (2026-08-05) — Task classification + Procedural completeness contract
> (regression source: `/new-user` Step 15 work-phone compression). v1.1 — Default
> answer contract + Failure escalation; ATG `graph-scribe` bound to this standard.
> v1.0 (2026-06-10) — adopted from an external output review (relayed by the operator).
> Authority: this standard governs the **shape of slash-command output**. It sits BELOW the
> security gates (CLAUDE.md Core Rules #4/#5/#10, SR-1–SR-4) and the placeholder
> dictionary (`modules/security/placeholder-dictionary.md`) — it can never relax them.
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
4. Placeholders only — the native `[@Aegion_*]` + generic token dictionary (`modules/security/placeholder-dictionary.md`). Never invent a competing set.
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

## Default answer contract — plain-text IT questions (v1.1)

Graph Engineering is the architecture UNDER Aegis; a normal question must feel
like a senior IT coworker, not a graph engine. For ordinary plain-English IT
questions (no slash command, no explicit format ask), the presentation order is:

1. **Most likely action first** — reason from what the operator is actually
   trying to make happen, not from keywords. Lead with the likely fix.
2. **GUI first, shortest exact path** — `Portal → blade → object → control`
   arrows, not a paragraph about what the portal is. If a safe official
   self-service page solves it directly, give the direct link.
3. **Only the details needed to complete step 1** — do not enumerate five
   alternative branches before the likely one has been tried.
4. **PowerShell / CLI at the bottom** — clearly labeled, after the GUI
   procedure, commented per line (standard rule 3 still applies).
5. **Verify** — one short line: what success looks like.

Exceptions: the operator explicitly asks for PowerShell/CLI only (their stated
preference overrides GUI-first) · no useful GUI equivalent exists · safety or
investigation evidence requires a different order. Freshness-sensitive answers
(current portal layout, product behavior, links): research current authoritative
sources FIRST (Microsoft Learn/Support, Meraki/Dell/vendor docs) rather than
confidently rendering a stale path — sanitize queries (no names, tenants, IPs,
tokens, ticket PII), synthesize internally, cite a link only where useful.

## Task classification + procedural completeness (v1.2)

Classify the ask BEFORE rendering — the classes get different depth:

- **QUICK FIX** ("user's password doesn't work") → shortest likely GUI fix first
  (Default answer contract above).
- **DIAGNOSTIC** ("why isn't this policy applying?") → discriminating checks in
  ranked order.
- **PROCEDURE / RUNBOOK** ("set up the work phone", "onboard this laptop",
  "offboard this person") → the FULL operational chain. Completeness is
  mandatory here and only here — don't force a quick question into 25 steps.
- **REFERENCE** ("what's the cmdlet for X?") → answer the reference directly.

For PROCEDURE-class answers, assume the operator is standing at the device or
portal right now and must complete the job from this answer alone:

- **No required action missing.** Never compress prerequisite steps, "obvious"
  steps, or post-steps an experienced engineer would fill in from memory. The
  regression to never repeat: "factory reset → scan QR → add device group" for
  a corporate Android — which silently dropped the user-group prerequisites,
  the route from a wiped phone into QR enrollment, the wait boundary, and the
  post-enrollment app/account provisioning.
- **Dependency boundaries are explicit and survive summarization.** Phase the
  chain: *Before the device/object exists* → *On the device* → **WAIT UNTIL**
  the object appears in the admin surface → *After it appears* → *After
  policies apply* → *Verification*. Words like BEFORE / THEN / WAIT UNTIL /
  ONLY AFTER carry operational meaning — an answer with every step in the
  wrong order is still wrong.
- **Each step: one action → exact clicks/taps → "Done when: [observable]".**
  Complete ≠ verbose: no architecture lectures, no pre-loaded troubleshooting
  branches, one short Why only where it prevents a mistake.
- **Org-specific vs vendor procedure stay distinguishable.** Org facts
  (group names, tokens, approval chains) come from operator input or local
  canonical runbooks — NEVER invented. Where an org value isn't recorded,
  keep a named placeholder with an explicit "[org gap — confirm and fill]"
  marker and deliver the rest of the procedure. Vendor mechanics get
  researched current when freshness matters (rules in v1.1 above).
- Source priority: operator's explicit facts in this conversation →
  canonical local runbooks/knowledge → current vendor docs → general
  knowledge. A conflict between the first two is investigated, not silently
  resolved.

## Failure escalation — troubleshooting continuity (v1.1)

"still no" / "didn't work" / "same issue" is DIAGNOSTIC EVIDENCE, not a request
to repeat louder. On a failure reply:

- Keep the running state: original symptom · environment facts learned ·
  attempts made · result of each · current hypothesis · next discriminating
  action. Never make the operator reconstruct the history.
- Treat the failed attempt as an eliminated/weakened hypothesis; pick the next
  most informative action, not a wordier restatement of the last one.
- Answer shape stays the same: next GUI action first, PS/diagnostic at bottom.
- When the next step depends on current product behavior that isn't confidently
  known, research it (rules above) before answering.
- In an ATG graph run this is the failure edge made explicit: `rankedCauses[]`
  ordering, `review.findings[]` → BUILDER, and `verification`/`blockedReport`
  all carry the failed attempt forward in `state.json` instead of resetting.

None of this relaxes a gate: GUI-first does not bypass R0–R3, PowerShell-last
does not authorize PowerShell, research does not authorize execution, and low
friction never manufactures approval (SR-2 stands).

## Verification (how this standard is enforced)

- The structure lint (backlog: `tasks/todo.md` engineering item) should check each command file
  has phased GUI steps before its checklist, exactly one checklist, and a paste-ready note.
- Repo `.claude/commands/<name>.md` and deployed `~/.claude/skills/<name>/SKILL.md` must have
  identical bodies (2026-06-09 drift lesson) — SKILL.md written BOM-free.
