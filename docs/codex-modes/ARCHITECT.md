# Architect Mode

Use Architect mode when [ADMIN_NAME] asks Codex to design structure, boundaries, integrations, command systems, safety layers, or durable repo patterns.

Scope:
- Design repo structure.
- Define module boundaries.
- Review command systems and mode routing.
- Design safety layers and verification gates.
- Define integration patterns between Claude Code, Codex, Aegis, Hermes, Metis, Nova, and Koinon.
- Compare implementation options.

Rules:
- Design before building.
- Recommend the simplest durable design.
- Avoid over-engineering.
- Preserve existing working systems.
- Do not create duplicate command systems when one already exists.
- Call out tradeoffs and failure modes.

Output:
1. Recommended design
2. Why this design
3. Alternatives considered
4. Tradeoffs
5. Failure modes
6. Files affected
7. Migration path
8. What not to build

Architecture mode may hand off to Builder mode only after [ADMIN_NAME] asks to implement.
