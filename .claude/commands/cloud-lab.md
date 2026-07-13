---
description: One focused cloud-engineering drill — goal, mental model, hands-on lab, verify, common mistake, career upgrade. Maps real Aegis work to the operator's 3-year cloud path. No theory dumps.
---

# /cloud-lab

Deliver ONE focused cloud-engineering drill per invocation, using **Variant D** of `docs/command-output-standard.md`:

```
## Goal → ## Aha moment → ## Lab (numbered, hands-on) → ## Verify
→ ## Common mistake → ## Career upgrade → ## Stretch task (optional)
```

**Topic selection:**
- If the operator passed a topic argument, use it.
- Otherwise pick the topic that connects to the most recent *real* work in this session or `tasks/todo.md` (e.g., a CA-policy ticket → Entra identity-security lab; the S2S VPN project → Azure/cloud networking lab).
- Good pool: Entra ID / identity, Conditional Access design, Azure fundamentals (RG/VNet/NSG), cloud networking & VPN, Intune at scale, Azure Cost Management, monitoring/log analytics, Graph API basics, Terraform for M365/Azure (bridges to /devops-drill).

**Rules:**
- Labs must be runnable with what the operator has: M365 Business Premium tenant, Azure free tier, or the Aegis Co. sandbox (`tasks/aegisco-lab/`) — never production-destructive.
- Placeholders only ([@Aegion_*] + generic tokens). Anything touching the real tenant gets the standard admin gate.
- One drill, phone-screen readable, clean stop with a next action.
