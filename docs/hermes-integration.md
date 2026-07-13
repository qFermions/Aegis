# Hermes Integration Playbook

Hermes is the cross-domain partner in the agent stack — VPS-hosted (gpt-5.5 / Codex), persistent memory, polymath generalist scope (trading / macro / cyber / War Room). Aegis reaches it via the `/ask-hermes` SSH bridge. This doc covers when to escalate, how to integrate the response, failure modes, and the audit log lifecycle. Hermes never speaks directly to end users — Aegis is the translation layer.

---

## When Aegis escalates to Hermes

Hermes earns its escalation when a ticket has a dimension Aegis's IT scope can't fully cover. Concrete triggers:

| Signal | Example | Escalate? |
|---|---|---|
| Trading / macro question buried in an IT ticket | "I need access to Bloomberg because we're rebalancing — is my Conditional Access blocking it?" | Yes — Hermes weighs in on the trading-workflow context; Aegis solves the CA piece |
| Vendor relationship history matters | "Should we renew the [@Aegion_VOIP] contract or switch?" | Yes — Hermes has persistent memory of prior vendor pain points |
| Executive-tone draft for board | "Write the board update on the BitLocker incident" | Yes — Hermes does executive register better than Aegis's Tier-3 voice |
| Cross-domain second opinion before action | Aegis's plan touches finance + IT + legal | Yes — broad-domain sanity check |
| Pure IT troubleshooting | "User can't sign in" | **No** — stay in Aegis's lane |
| Pure trading question | "Should I increase [TICKER] exposure?" | **No** — that's Hermes's lane directly via Telegram, not an Aegis ticket |

Lane discipline: Aegis owns the IT execution. Hermes adds breadth when the ticket has cross-domain weight. Don't escalate to Hermes for things Aegis should just handle.

---

## The `/ask-hermes` bridge — mechanics

```
ssh -o ConnectTimeout=15 [HERMES_SSH_USER]@[HERMES_HOST] 'timeout 240 hermes -z "<query>"'
```

- SSH agent must have the `[LOCAL_OPERATOR_CONFIG]` key loaded
- 240-second timeout — Codex is thorough, not fast
- Returns Hermes's response verbatim
- Aegis prefixes the verbatim block with `🪓 **Aegis D Hermes:**` so it's visually distinct
- Below the verbatim block, Aegis adds the **integration note**

---

## The integration note — required after every Hermes response

Hermes's raw output is a generalist take. Aegis's job is to integrate that take with the actual IT context. The integration note is non-optional:

```
> **Aegis read for the ticket:** [one paragraph integrating Hermes's answer
> with the specific IT/ticket context — what to act on, what to ignore,
> what to confirm with the operator before moving]
```

Why this matters: Hermes might say something like "this looks like a Conditional Access blocker — exclude the user from the CA policy." That's Hermes pattern-matching on the symptom. Aegis knows the *actual* CA policy structure, knows which exclusions are safe, knows the destructive-action gate fires before any CA edit. The integration note translates Hermes's generalist take into a concrete, safe-in-this-environment action.

Never blind-paste Hermes's output to an end user, a Jira ticket, or a vendor escalation. Always integrate first.

---

## Failure modes — handle gracefully

The bridge has known failure modes. Aegis never blocks on Hermes being unreachable; it falls back to local knowledge.

| Failure | Detection | Response |
|---|---|---|
| SSH connection refused / timeout | `ssh` returns non-zero, network message | "Hermes is unreachable right now (network or VPS issue). Falling back to local Aegis knowledge:" then answer from Aegis's own context |
| `hermes -z` runs past 240s | `timeout` exits 124 | "Hermes is taking longer than expected (>4 min). Falling back to local Aegis knowledge:" then answer locally |
| SSH auth error | "Permission denied (publickey)" | "SSH agent doesn't have the right key loaded. Run `ssh-add -l` and check for `[LOCAL_OPERATOR_CONFIG]`. If missing: `ssh-add [SSH_KEY_PATH]`." Then either retry or fall back |
| Empty output | Stdout is blank | Retry once with a 60-sec sleep; if still blank, fall back |
| Garbled / truncated output | Output doesn't parse cleanly | Don't blind-paste — flag the truncation, fall back |

The fallback is not a degraded mode — Aegis is the IT specialist for any ticket. Hermes is depth/breadth bonus, not a dependency.

---

## Audit log — every escalation is recorded

Aegis appends a one-line record to the repository-relative `.aegis-state/hermes-escalation-log.md` for every `/ask-hermes` call:

```
[YYYY-MM-DD HH:MM:SS] /ask-hermes "<query summarized to 80 chars>" → <PASS | FALLBACK | FAIL>
```

- `PASS` — Hermes responded, Aegis integrated the answer
- `FALLBACK` — Hermes unreachable / timeout / empty; Aegis answered locally
- `FAIL` — both Hermes and local knowledge were inadequate (rare; surface to the operator)

Why log: cross-domain escalations are valuable patterns. Reviewing the log weekly shows which ticket types benefit from Hermes most, which queries Hermes consistently improves vs which it doesn't add to. That informs whether the escalation is paying for itself.

---

## Privacy / placeholder discipline

Hermes runs on [ADMIN_NAME]'s VPS — it's a trusted endpoint inside the same security domain. But the standard rules still apply:

- The query sent to Hermes should use placeholders if the prompt is going into any version-controlled or shared context
- Hermes's response, when integrated into a Jira ticket or user-facing draft, gets sanitized — no real domain, no internal IPs, no real vendor pricing leak
- The `[@Aegion_*]` placeholder family travels with the query and back

If Hermes returns something that would echo real data (a vendor name, the canonical domain literal), Aegis sanitizes it during the integration step before any of it appears in output.
