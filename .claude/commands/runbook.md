---
description: Produce board-grade IT documentation — runbook, SOP, KB article, incident report, or change record — with consistent, audit-ready structure. Placeholders only.
---

# /runbook

**What this does:** Generates polished, consistent IT documentation Aegis can hand to staff, leadership, or an auditor. Pick the doc type; Aegis fills the matching template from the ticket/context. Every doc carries a header block (title · version · owner · last-updated) and uses placeholders for all identities.

**Usage:** `/runbook` then say the type + topic (e.g. "runbook for MFA reset", "incident report for the 5/20 phishing wave", "change record for the VPN cutover"). If unclear, Aegis asks **one** question: which type + what it covers.

## Shared header (every document)
> **Title** · **Version** vX.Y · **Owner** [ADMIN_NAME] · **Last updated** [date] · **Audience** [IT staff / end users / leadership / vendor / auditor] · **Classification** [Internal]

---

## Templates

### 1. Runbook (operational, repeatable fix)
`# Runbook: [NAME]` → **Purpose** · **Applies to** (users/devices/systems) · **Symptoms** · **Common causes** · **Steps** (portal first, exact nav paths; PS in collapsed details) · **⚠️ Warnings** (destructive) · **Verification** · **Rollback** · **Escalation path** · **Jira note**.

### 2. SOP (standardized process / policy)
`# SOP: [NAME]` → **Objective** · **Scope** · **Roles & responsibilities** (RACI) · **Prerequisites** · **Procedure** (numbered) · **Controls & approvals** · **Exceptions** · **Verification/QA** · **Review cadence** (e.g. annual) · **Revision history** table.

### 3. KB Article (end-user-facing)
`# How to: [TASK]` → **What you'll get** · **Before you start** · **Steps** (plain English, screenshots noted) · **If it doesn't work** (top 3 fixes) · **Still stuck? → contact IT** · **Related articles**. No PowerShell; jargon translated.

### 4. Incident Report (post-incident)
`# Incident Report: [ID]` → **Summary** (1 paragraph) · **Severity** (P1–P4) · **Timeline** (detect→contain→eradicate→recover, timestamps) · **Impact** (users/systems/data) · **Root cause** · **Resolution** · **What worked / what didn't** · **Action items** (owner + due date) · **Lessons** (route to `tasks/lessons.md`).

### 5. Change Record (change management)
`# Change Record: [CHG-ID]` → **Change description** · **Reason/benefit** · **Risk** (Low/Med/High) + **rollback plan** · **Affected systems/users** · **Implementation steps** · **Test/verification plan** · **Approvals** (requested/approved by) · **Schedule/window** · **Back-out criteria** · **Post-change verification**.

## Quality bar (board-grade)
- Lead with the outcome; no filler. Consistent headers + numbered steps.
- Portal/GUI first; PowerShell in collapsed `<details>` with per-line comments (operational docs only).
- ⚠️ Mark every destructive step; state who approves.
- Always include **verification** and an **escalation/rollback** path.
- Placeholders for all identities — no real names/UPNs/PII (Core Rule #4/#10).
- Versioned with a revision-history line so changes are auditable.

## Where it goes
- Reusable team docs → propose promoting a repeating pattern to a Koinon T-pattern (`shared/knowledge/troubleshooting/`) so Metis inherits it.
- One-off ticket docs → paste into Jira / the KB. Lessons from incidents → `tasks/lessons.md` per the Self-Improvement Loop.

> Related: `/write-sop` (SOP-focused), `/incident-report` (incident-focused). This command is the unified generator across all five doc types.
