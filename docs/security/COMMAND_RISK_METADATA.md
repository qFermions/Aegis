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
- Google Workspace / Okta / Jamf / macOS lane (v8.9): `/gws-new-user`, `/gws-offboard`, `/gws-password-reset`, `/gws-2sv-reset`, `/gws-group-membership`, `/gws-ou-move`, `/gws-license-assign`, `/gws-drive-transfer`, `/gws-audit-log`, `/gws-chromeos-device`, `/okta-app-assignment`, `/okta-mfa-reset`, `/okta-user-lifecycle`, `/jamf-enroll-mac`, `/jamf-lock-erase`, `/mac-new-hire-laptop`, `/gws-gmail-delivery`, `/mac-troubleshoot`, `/zoom-room-issue`

Each listed mixed-state command is operator-only and states an execution boundary: read-only diagnostics remain available, an adjacent action-specific `SAFETY GATE` may authorize only its named mutation, and explicit `PREVIEW ONLY` regions must move to a separately reviewed runbook. This is a tested documentation contract, not a claim that arbitrary prose is rendered technically unexecutable.

The repository does not claim that this metadata makes R0–R3 a complete authorization boundary. `CLAUDE.md` remains behavioral context. CLI gates, scanner tests, Claude Code permissions, and hooks enforce narrower properties.

## Why arbitrary frontmatter was not added

The installed Claude Code version does not document custom `risk`, `access`, or `credential-sensitive` command-frontmatter fields as enforcement inputs. Adding unsupported keys to all 77 commands would look machine-enforced without creating a real control. Risk metadata therefore remains explicit Markdown, while `disable-model-invocation` uses a documented field with deterministic behavior.

## Procedural command safety boundary

The mixed-state command set is an explicit audited list; adding another mixed command must update that list. Within the audited Markdown surfaces, the test discovers recognized PowerShell plus shell/native sinks in code fences, explicit portal actions, and a constrained set of imperative portal/UI patterns. It gives each discovered live code mutation exactly one same-fence owner, makes preview code inert, bounds portal ownership at the next marker/section boundary, and rejects duplicate IDs. The complete discovered set, including sink multiplicity and impact classifications, is compared exactly with `STATE_CHANGE_INVENTORY.json`; the manifest also names the independently tested Jira, memory, and security-audit client boundaries that do not live inside Markdown fences.

PowerShell gate analysis checks source order, one direct `Read-Host` assignment, and one positive case-sensitive `if ($confirmation -ceq $requiredConfirmation)` branch whose true block dominates every owned sink and whose direct `else` throws. It rejects post-read variable overwrite, dead or indirect guards, target-token omissions, and effect/confirmation mismatch. Adversarial fixtures cover missing/dead guards, variable overwrite, case-insensitive comparison, and a `-WhatIf; later-mutation` bypass. Generic `yes`, empty input, case changes, and extra whitespace do not reach the inert mocked sink; the exact source-derived phrase does.

### Google Workspace, Okta, Jamf and macOS command family (G1, v8.9)

Shell fences (`bash`, `sh`, `shell`, `zsh`, and untagged) are scanned for the administration tools of the Google/Okta/Jamf/macOS lane: `gam` (create, update, delete, undelete, suspend, unsuspend, transfer, move, add, remove, revoke, wipe, deprovision, action, and any verb not on the read-only list), `gcloud` (create, update, delete, set, IAM binding changes, enable/disable, and unlisted verbs), `curl`/`wget`/HTTPie with a write method (`-X`/`--request` DELETE/POST/PUT/PATCH) or a request body (`--data*`, `-d`, `--json`, `--form`, upload flags), the `jamf` binary (policy, recon, manage, removeFramework, enroll, and any verb not on the read-only list), `profiles` (install, remove, renew, `-I`, `-R`), `dscl` write operations, `fdesetup` (enable, disable, add, remove, changerecovery, …), `diskutil` erase/partition/APFS delete, `softwareupdate` install, `networksetup -set…`, `systemsetup -set…`, `defaults write`/`delete`, `launchctl` load/unload/bootstrap/bootout/kickstart, and ARD `kickstart`. Wrappers that run the next word — `sudo` with any options (including `-u user` / `--user=`), `command`, `env` and inline `VAR=value` assignments, `nohup`, `time`, `nice`, `caffeinate`, `exec`, `script`, `xargs` — absolute, quoted or variable paths (`"$HOME/bin/gam7/gam"`), pipelines, and `$(…)` substitution do not hide an invocation; `curl --config`/`-K` and a method-override header count as writes, as does HTTPie `--raw`. Indirect execution — `ssh` with a remote command, `bash`/`sh`/`zsh -c`, `osascript -e`, `eval`, or a variable in command position (`"$GAM" delete …`) — is its own fail-closed sink (`indirect-exec`) that needs a gate. Known limits: a tool name inside a quoted string of some other command (`echo "gam …"`) and code outside fences (indented blocks, inline code) are not executable lines to this grammar; the structure lint keeps CLI out of non-shell fences in commands. Read-only forms (`gam info/print/report/show/whatis`, `gcloud … list/describe`, HTTP GET, `profiles show/list/status`, `dscl -read/-list`, `fdesetup status`, `diskutil list/info`, `softwareupdate -l`, `networksetup -get…`, `systemsetup -get…`, `defaults read`, `launchctl list/print`) stay live diagnostics. The test pins every listed form (`G1 detector` cases).

A shell mutation is owned by a same-fence `# SAFETY GATE [id]` in an explicitly tagged `bash`/`sh`/`shell`/`zsh` fence (never untagged). The gate is checked with a plain-text grammar — no PowerShell engine is involved: the six fields (`Target`, `Effect`, `Scope`, `Reversibility`, `Required confirmation: type exactly \`PHRASE\``, and the standard `Failure behavior` sentence); exactly one `required_confirmation="PHRASE"` literal with no expansion, equal to the field phrase; exactly one `IFS= read -r confirmation` (whitespace preserved); exactly one top-level `if [ "$confirmation" = "$required_confirmation" ]; then` whose true branch contains every owned sink; and a direct `else` that only prints to stderr and ends in `exit <non-zero>`. Only the comment header may sit between the marker and the template, and only the read plus plain `printf '%s\n' "…"` / `echo "…"` prompts between the template and the comparison. `alias`, `eval`, `trap`, `declare`, `unset`, function definitions, `${confirmation…}` and `${!…}` expansion, a second `read`, direct reassignment, `printf -v`, `mapfile`/`readarray`, `getopts`, `let`, `coproc`, `wait -p`, a gate variable used as a loop variable or array, `elif`, `|| true`, negated comparison, and dead or nested wrappers are rejected (31 adversarial fixtures in the test). The harness then executes the fence's own lines from the template to the comparison in `bash` where available (always on Linux/macOS CI), with the positive branch replaced by one mocked line and the fence's own else body: the exact phrase reaches the mocked sink once; empty, `yes`, case changes, padding, and a trailing backslash all exit non-zero without reaching it. Two committed fixtures (`scripts/fixtures/command-safety-gates/`) prove a GAM fence without a marker fails and the same fence with a correct marker passes.

Portal discovery gained the lane's verbs (Suspend, Unsuspend, Reactivate, Undelete, Deprovision, Powerwash, Lock, Unlock, Erase, Enroll, Unenroll, Unmanage, Unassign, Activate, and ChromeOS's Re-enable in the lane's click grammar only) with matching confirmation families, and a case-sensitive cue for Admin console, Okta, Jamf, Apple Business (and its former name Apple Business Manager), System Settings, Self Service, Fleet, Zoom Rooms, ChromeOS and Chromebook lines: a list item carrying that cue whose breadcrumb ends in an action, or that says Click/Select/Choose/Tap an action, is a mutation candidate and needs a section-local gate or preview owner. Inside a G1 lane document (the 19 runbooks, `docs/portal-nav-google-2026.md`, `docs/gws-reversibility.md`) the same click grammar also applies to list items carrying a generic portal cue (Devices, Users, Settings…), so a control named without its product ("At the top, click **Disable selected devices**") is still a candidate; Microsoft runbooks keep their original grammar. Known limitation: a Google/Okta/Jamf CLI written inside a PowerShell fence is outside this grammar; the structure lint (`cli-in-shell-fence`) rejects that placement in commands.

The discovery grammar is intentionally documented rather than described as universal. Novel prose, a new language, indirect function calls, or new sink vocabulary can fall outside it. Semantic review and scanner extension remain required, and the test fails new recognized imperative/code sinks that lack a section-local gate or preview marker.

Reference modules that contain state-changing examples use a parallel boundary: their read-only diagnostics remain usable, while explicit preview regions are planning references only. The vulnerability checklist is planning-only throughout.

For every new or changed command branch:

1. Inventory any line or portal step that can change local, tenant, device, network, or third-party state.
2. Keep it unexecutable by default or add an immediately adjacent action-specific gate.
3. Use a distinct confirmation for each target and effect; one phrase never carries into a later phase.
4. Add a failing structural test and source-derived inert exact-match model before the implementation.
5. Extend the pre-commit scanner when the branch introduces a new dangerous sink.

Semantic review remains required. Frontmatter and structure tests narrow invocation and documentation behavior; they do not turn Markdown into a complete authorization system.
