# Command Risk Metadata

## What is deterministic

Claude Code 2.1.207 treats files under `.claude/commands/` as skills. The supported `disable-model-invocation: true` frontmatter field prevents Claude from selecting a command automatically; only the operator can invoke it. This release applies that supported control both to commands that directly execute privileged integrations and to every inventoried command that mixes read-only diagnostics with state-changing guidance.

Direct-integration commands also declare, in their body:

- R0–R3 risk level or range;
- read/local-write/remote-write access;
- credential sensitivity;
- operator-only invocation.

Direct-integration set (validated by `scripts/command-policy.test.js`):

- `/aegis-update`
- `/jira-create`
- `/jira-update`
- `/ps-script`

(The former Hermes/war-room direct-integration commands were removed from the
product surface in v8.6 — ADR-006; history preserves them.)

Mixed-state procedural set (validated by `scripts/command-safety-gates.test.js`):

- `/ad-connect`, `/conditional-access`, `/device-wipe`, `/distribution-list`
- `/email-quarantine`, `/email-to-spam`, `/email-whitelist`
- `/group-membership-audit`, `/intune-compliance`, `/lan-wan`, `/license-audit`
- `/mailbox-permissions`, `/meraki-site-vpn`, `/mfa-issue`
- `/meraki-vpn-status`, `/ps-error-decode`
- `/new-device-setup`, `/new-user`, `/offboard`
- `/onedrive-issue`, `/onedrive-restore`, `/outlook-issue`, `/password-reset`, `/printer-issue`
- `/security-alert-triage`, `/shared-mailbox`, `/sharepoint-access`, `/sip-trunk-status`, `/teams-issue`
- `/unite-extension-create`, `/unite-migration-status`, `/unite-voicemail-reset`, `/vpn-check`, `/wifi-issue`
- aliases `/onboard` and `/shared-mailbox-create`

Each listed mixed-state command is operator-only and states an execution boundary: read-only diagnostics remain available, an adjacent action-specific `SAFETY GATE` may authorize only its named mutation, and explicit `PREVIEW ONLY` regions must move to a separately reviewed runbook. This is a tested documentation contract, not a claim that arbitrary prose is rendered technically unexecutable.

The repository does not claim that this metadata makes R0–R3 a complete authorization boundary. `CLAUDE.md` remains behavioral context. CLI gates, scanner tests, Claude Code permissions, and hooks enforce narrower properties.

## Why arbitrary frontmatter was not added

The installed Claude Code version does not document custom `risk`, `access`, or `credential-sensitive` command-frontmatter fields as enforcement inputs. Adding unsupported keys to all 65 commands would look machine-enforced without creating a real control. Risk metadata therefore remains explicit Markdown, while `disable-model-invocation` uses a documented field with deterministic behavior.

## Procedural command safety boundary

The mixed-state command set is an explicit audited list; adding another mixed command must update that list. Within the audited Markdown surfaces, the test discovers recognized PowerShell plus shell/native sinks in code fences, explicit portal actions, and a constrained set of imperative portal/UI patterns. It gives each discovered live code mutation exactly one same-fence owner, makes preview code inert, bounds portal ownership at the next marker/section boundary, and rejects duplicate IDs. The complete discovered set, including sink multiplicity and impact classifications, is compared exactly with `STATE_CHANGE_INVENTORY.json`; the manifest also names the independently tested Jira, memory, and security-audit client boundaries that do not live inside Markdown fences.

PowerShell gate analysis checks source order, one direct `Read-Host` assignment, and one positive case-sensitive `if ($confirmation -ceq $requiredConfirmation)` branch whose true block dominates every owned sink and whose direct `else` throws. It rejects post-read variable overwrite, dead or indirect guards, target-token omissions, and effect/confirmation mismatch. Adversarial fixtures cover missing/dead guards, variable overwrite, case-insensitive comparison, and a `-WhatIf; later-mutation` bypass. Generic `yes`, empty input, case changes, and extra whitespace do not reach the inert mocked sink; the exact source-derived phrase does.

The discovery grammar is intentionally documented rather than described as universal. Novel prose, a new language, indirect function calls, or new sink vocabulary can fall outside it. Semantic review and scanner extension remain required, and the test fails new recognized imperative/code sinks that lack a section-local gate or preview marker.

Reference modules that contain state-changing examples use a parallel boundary: their read-only diagnostics remain usable, while explicit preview regions are planning references only. The vulnerability checklist is planning-only throughout.

For every new or changed command branch:

1. Inventory any line or portal step that can change local, tenant, device, network, or third-party state.
2. Keep it unexecutable by default or add an immediately adjacent action-specific gate.
3. Use a distinct confirmation for each target and effect; one phrase never carries into a later phase.
4. Add a failing structural test and source-derived inert exact-match model before the implementation.
5. Extend the pre-commit scanner when the branch introduces a new dangerous sink.

Semantic review remains required. Frontmatter and structure tests narrow invocation and documentation behavior; they do not turn Markdown into a complete authorization system.
