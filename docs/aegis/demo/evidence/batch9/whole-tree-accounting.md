# Whole-tree diff against 73bdc68: every path accounted for

`whole-tree-diff.txt` beside this file is `git diff --stat 73bdc68` at the head it was taken. Paths inside `scripts/demo/`, `scripts/intake/`, `scripts/eval/judged/` and `docs/` are free under the charter. Every other path:

| Path | Why | Allowed by |
|---|---|---|
| `.claude/commands/shared-mailbox.md`, `mailbox-permissions.md` | Full Access and Send As grant gates, the Send As removal gate | task 5 |
| `.claude/commands/email-quarantine.md` | the release gates name verify-quarantine-released | task 6 |
| `.claude/commands/gws-password-reset.md`, `jamf-lock-erase.md` | read-backs for the reset and the erase; 8b ladder lines | tasks 7, 8b |
| `.claude/commands/okta-mfa-reset.md` | the Okta Verify sign-in loop section; 8b ladder lines | tasks 8, 8b |
| `.claude/commands/device-wipe.md`, `fleet-device-actions.md`, `gws-2sv-enforcement.md`, `gws-2sv-reset.md`, `gws-account-containment.md`, `gws-chromeos-device.md`, `gws-offboard.md`, `jamf-enroll-mac.md`, `jamf-filevault.md`, `offboard.md`, `okta-user-lifecycle.md`, `password-reset.md` | the identity, sign-in, MFA and device sections the ladder audit failed | task 8b |
| `CLAUDE.md` | the answer rule (task 2, 3, 8a); the version-history line shortened to fit the 20,000-byte test (deviation, checks.md) | tasks 2, 3, 8a |
| `README.md` | the "Try Aegis" section; the stale walkthrough line (a fix beyond the task) | task 11 |
| `.env.example` | EXO_* variable names only | task 4 |
| `scripts/adapters/exo-client.js`, `exo-client.test.js` | the connector | task 4 |
| `scripts/adapters/verify-flags.js`, `scope-manifest.json`, `operator-message.js`, `README.md`, `scripts/audit/change-record.js` | the connector's registrations: its verify flags, its least-privilege entry, its plain name in failure messages, the adapters table, and CONNECTOR_FILES so a change record can name `exo:` read-backs | task 4 (deviation: these five are not named in the charter's list; a connector cannot be bound to a change record or pass the flag and scope tests without them) |
| `scripts/adapters/change-binding.test.js`, `verify-flags.test.js`, `verify-dry-run.test.js`, `scope-preflight.test.js`, `scripts/audit/read-back-field.test.js`, `pass-flags.test.js`, `newly-classed-read-backs.test.js`, `scripts/gate-r-class.test.js` | connector lists that gained exo, and the gate and read-back counts the gate changes moved, each in a commit naming the gates | "the test counts the gate changes move" |
| `scripts/lint/ladder-audit.js`, `ladder-audit.test.js` | the lint check and its tests | task 8b |
| `scripts/okta-verify-loop.test.js`, `scripts/reset-erase-readbacks.test.js` | the section-order test; the read-back tests | tasks 8, 7 |
| `scripts/ask-aegis.js`, `aegis-chat.js` and their tests | the two commands | task 11 |
| `checks.md`, `progress.md` | the harness records | CLAUDE.md Harness |
| `docs/security/STATE_CHANGE_INVENTORY.json`, `docs/aegis/owner/vendor-facts-priority.md`, `docs/aegis/ladder-audit.md` | generated files their freshness tests require after the gate changes | docs |
