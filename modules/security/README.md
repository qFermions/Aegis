# Security Module

Defensive security layer for AI-assisted IT operations. Implements OWASP LLM Top 10
mitigations, PII protection, and operational guardrails directly in the agent workflow.

## Contents

| File | Purpose |
|------|---------|
| [threat_detection.md](threat_detection.md) | Prompt injection recognition and response patterns |
| [threat_model.md](threat_model.md) | Trust-boundary map, STRIDE→control matrix, runnable adversarial test suite (T1–T10) |
| [incident_response.md](incident_response.md) | Step-by-step IR playbooks for common M365/Entra scenarios |
| [compliance_checks.md](compliance_checks.md) | Automated checks for MFA coverage, license hygiene, guest access |
| [vulnerability_scan.md](vulnerability_scan.md) | Tenant hardening checklist — Secure Score action items |
| [scripts/log-analyzer.js](scripts/log-analyzer.js) | Runnable log analyzer — detects failed logins, impossible travel, privilege escalation |
| [scripts/hash-checker.js](scripts/hash-checker.js) | File hash generator (MD5/SHA1/SHA256) with known-bad-hash check |
| [scripts/sample-logs.json](scripts/sample-logs.json) | Sample security log data for log-analyzer.js |

## Design Philosophy

Security is not bolted on — it is embedded in the agent execution loop:

1. **Pre-commit scanning** — when the hook is installed and not bypassed, every staged
   add/copy/modify/rename/typechange blob is read; strict UTF-8 text is pattern-scanned for PII,
   hardcoded credentials, and dangerous cmdlets (`scripts/pre-commit-check.js`). Binary or invalid
   text fails closed for manual review; CI separately runs the scanner's `--all` tracked-tree mode.

2. **Destructive action policy** — agent instructions require explicit operator confirmation for
   destructive operations (wipe, delete, disable, revoke, bulk modify). Deterministic CLI gates
   supplement that behavioral policy where a repository client implements them.

3. **Prompt injection defense** — external content (vendor emails, ticket exports, log pastes)
   is processed as data, never as instruction. The agent identifies and flags injected directives
   before acting on the operator's legitimate request.

4. **PII isolation policy** — identity instructions require placeholders in responses and memory.
   The pre-commit hook pattern-checks repository text; it does not inspect model responses or
   external memory and cannot prove that every placeholder conforms to the dictionary.

## Threat Model

| Threat | Vector | Control |
|--------|--------|---------|
| Prompt injection | Pasted email / ticket / log content | Identity-layer detection + operator alert |
| PII leak to repo | Committed scripts or docs | Pre-commit PII pattern scan (BLOCK) |
| Credential exposure | Hardcoded tokens in scripts | Pre-commit credential scan (BLOCK) |
| Accidental mass deletion | Dangerous cmdlet in script | Pre-commit WARN + destructive action gate |
| Self-permission escalation | Instruction to edit settings.local.json | Explicit lockdown rule in CLAUDE.md |
| Stale credential in memory | Memory file containing real values | Behavioral placeholder rule; no deterministic memory-output filter is included here |

## Related

- [`scripts/pre-commit-check.js`](../../scripts/pre-commit-check.js) — the commit-time pattern enforcement layer (PS-danger, PII, credentials, modern secret formats, runtime-loaded tenant literals, injection markers)
- [`../automation/powershell/rollback_patterns.md`](../automation/powershell/rollback_patterns.md) — checkpoint/rollback execution patterns for the R2/R3 blast-radius classes
- [`docs/security_model.md`](../../docs/security_model.md) — full OWASP LLM analysis
- [`CLAUDE.md`](../../CLAUDE.md) — agent identity and immutable security rules
