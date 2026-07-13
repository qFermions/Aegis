# Command Risk Metadata

## What is deterministic

Claude Code 2.1.207 treats files under `.claude/commands/` as skills. The supported `disable-model-invocation: true` frontmatter field prevents Claude from selecting a command automatically; only the operator can invoke it. This release applies that supported control to commands that directly execute credential-sensitive remote operations, create remote state, update Jira, or generate privileged scripts.

Each controlled command also declares, in its body:

- R0–R3 risk level or range;
- read/local-write/remote-write access;
- credential sensitivity;
- operator-only invocation.

Current controlled set:

- `/aegis-update`
- `/alpha-signal`
- `/ask-hermes`
- `/dashboard-render`
- `/hermes-status`
- `/jira-create`
- `/jira-update`
- `/morning-brief`
- `/portfolio-status`
- `/ps-script`
- `/war-room`

The repository does not claim that this metadata makes R0–R3 a complete authorization boundary. `CLAUDE.md` remains behavioral context. CLI gates, scanner tests, Claude Code permissions, and hooks enforce narrower properties.

## Why arbitrary frontmatter was not added

The installed Claude Code version does not document custom `risk`, `access`, or `credential-sensitive` command-frontmatter fields as enforcement inputs. Adding unsupported keys to all 65 commands would look machine-enforced without creating a real control. Risk metadata therefore remains explicit Markdown, while `disable-model-invocation` uses a documented field with deterministic behavior.

## Procedural command migration

Many commands provide portal or PowerShell instructions but do not directly execute a tool. Their final risk depends on the operator-selected branch, object count, and target system. For example, `/offboard` can range from an R0 review to R3 account disable, license removal, and device wipe.

Migrate the remaining procedural commands in focused batches:

1. Inventory every branch that can lead to a write.
2. Add one `## Risk metadata` section declaring its possible risk range and access types.
3. Mark a command operator-only only when automatic model invocation itself creates unacceptable risk.
4. Keep per-action classification in the workflow; never assign one low class to an entire mixed-risk command.
5. Add structure tests for each migrated batch.

Priority order:

1. Destructive and security-control workflows: `/device-wipe`, `/offboard`, `/conditional-access`, `/security-alert-triage`.
2. Identity and access writes: `/new-user`, `/onboard`, `/mfa-issue`, `/mailbox-permissions`, `/sharepoint-access`.
3. Infrastructure and service writes: `/meraki-site-vpn`, `/shared-mailbox`, `/distribution-list`, `/unite-extension-create`, `/unite-voicemail-reset`.
4. Read-mostly workflows with optional remediation branches.

This migration is intentionally not automated: semantic classification requires reviewing each workflow branch, and broad mechanical labels would create false assurance.
