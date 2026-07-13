---
description: Review and safely update Aegis instructions, commands, and documentation without overwriting existing structure. Placeholders only.
disable-model-invocation: true
---

## Risk metadata

- **Risk level:** R1 for one reversible file edit; R2 when multiple agent files change.
- **Access:** local write after the operator approves the scoped plan.
- **Credential-sensitive:** no; settings and secret-bearing files remain out of scope.
- **Invocation:** operator-only; Claude must not invoke this command automatically.

IMPORTANT: Do NOT ask for employee details, names, emails, departments, or any identifying info. Deliver the FULL procedure IMMEDIATELY using only placeholders like [FIRST_NAME], [UPN], [DEVICE_NAME], [DEPARTMENT]. The user will substitute real values themselves.

Help me update Aegis agent files, commands, or CLAUDE.md. Tell me what you want to change.

---

## Aegis Update — Agent File Maintenance

**What I can help you update:**

| Target | What to change |
|--------|---------------|
| `CLAUDE.md` | Environment info, active projects, rules, slash command list |
| `.claude/commands/*.md` | Add, edit, or remove any slash command |
| `.claude/plugins/enterprise-it-ops/` | Plugin metadata or skills |
| Memory files | User prefs, feedback, project context |

**Tell me:**
1. What do you want to change? (add a command, update a project status, fix a rule, add a new vendor, etc.)
2. Which file(s) does it affect?
3. What should the new content say?

---

**Common updates I handle:**
- New slash command → I'll write the .md file and add it to the commands table in CLAUDE.md
- Project status change → I'll update the active projects table in CLAUDE.md
- New environment detail → I'll add it to the environment section
- Rule change → I'll update "How I Work" in CLAUDE.md
- New vendor added → I'll add to vendor escalation templates

Tell me what needs updating and I'll make the change.
