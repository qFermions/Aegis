# Batch 12 lane note: networking

## Hypothesis and what "verified" means (written 2026-11-14 before the first lane edit; not rewritten afterward)

- **Hypothesis:** a knowledge module under `knowledge/networking/` (a layered method with "how wide before why" as step one, decision trees, a failure catalog, evidence reading for dig, curl, openssl, traceroute, mtr, ping and tcpdump text, safe change patterns, escalation, sources) plus five runbooks (`/dns-troubleshoot`, `/tls-certificate`, `/vpn-tunnel-down`, `/zero-trust-block`, `/mtu-path-issue`) whose every change sits under a PREVIEW ONLY marker passes the gate scanner, the structure lint, the ladder audit and the case schema; the work most likely to fail first is the portal grammar reading a knowledge-file list line that carries "Meraki" or "Settings", an arrow and an action word as an unowned mutation.
- **Verified means:** `node --test scripts/command-safety-gates.test.js scripts/markdown-links.test.js scripts/repository-structure.test.js scripts/eval/judged/cases.test.js` with 0 failures; `node scripts/lint/command-structure.js` exit 0; `node scripts/lint/ladder-audit.js --check` exit 0; `readCaseFile` loads the lane's cases; the full `node --test` run fails on exactly the 41 baseline names and no new one; `node scripts/pre-commit-check.js` on the staged set reports no BLOCK.

## How it turned out

- The portal grammar never fired on a knowledge line: portal paths in the knowledge files are written with commas or in tables, and the runbooks' change steps sit inside PREVIEW ONLY regions. What failed first instead were counts and generated pages the brief did not name: the runbook count in `scripts/repository-structure.test.js` (108), `docs/aegis/ladder-audit.md` and `docs/aegis/owner/vendor-facts-priority.md` (both list the runbook count), and the state-change inventory.
- "0 failures" in the hypothesis was wrong as written: the four declared files carry the baseline's 41 pwsh-only failures on this Mac. The check that holds is "no failing name outside the baseline list" (`docs/aegis/demo/evidence/batch12/networking/checks.txt`).

## What was built

- `knowledge/networking/`: `README.md` (scope, file guide, which answer mode applies when, the public lookups `net_dns`, `net_http`, `net_tls`: when they help, how to report them per answer-format section 10, and their limits), `method.md`, `decision-trees.md` (A to H: a name fails, TLS, VPN, the policy layer against the origin, unreachable, MTU, Wi-Fi at scale, DHCP), `failure-catalog.md` (symptom, ranked causes, smallest splitting test, fix with its R class, rollback; DNS, TLS, routing, VPN, MTU, firewall, Wi-Fi, uplink saturation and traffic shaping, DHCP), `reading-evidence.md` (annotated dig, curl -v, openssl s_client, traceroute, mtr, DF ping, tcpdump lines, DHCP leases, wg show, IPsec log phrases, looking glass), `safe-changes.md` (a pattern table and five PREVIEW ONLY blocks), `escalation.md` (network smells of compromise, who gets what), `sources.md`.
- Runbooks (variant B, all in `MIXED_STATE_COMMANDS`): `/dns-troubleshoot` (Engineer answer; Fix card; Ask first; Incident when NS or DS change unexpectedly), `/tls-certificate` (Engineer; Fix card; Ask first; Incident for a certificate nobody requested), `/vpn-tunnel-down` (Engineer; Fix card for one person's client, pointing to `/vpn-check`; Ask first; Incident for unknown peers or sign-ins), `/zero-trust-block` (Ask first; Engineer; Fix card; Incident for a malware or phishing block after a click), `/mtu-path-issue` (Engineer; Fix card; Ask first).
- PREVIEW ONLY ids: `dns-troubleshoot-cache-flush`, `dns-troubleshoot-record-change`, `dns-troubleshoot-delegation-change`, `tls-certificate-bind-change`, `vpn-tunnel-down-reinitiate`, `vpn-tunnel-down-wireguard-peer`, `vpn-tunnel-down-proposal-change`, `zero-trust-block-exception`, `mtu-path-issue-icmp-allow`, `mtu-path-issue-mss-clamp`, `mtu-path-issue-appliance-mss`; in the knowledge module `net-safe-dns-record-change`, `net-safe-firewall-rule-change`, `net-safe-wireguard-peer-change`, `net-safe-mss-clamp-linux`, `net-safe-dns-cache-flush-windows`.
- Vendor facts: `docs/aegis/batch12/vendor-facts-networking.md`, 73 lines, 63 CONFIRMED and 10 UNCONFIRMED.
- Fixtures: `scripts/demo/fixtures/batch12/networking/` (below). Dev cases: `docs/aegis/batch12/lanes/networking-dev-cases.jsonl`, NET01 to NET15. Capability rows: `docs/aegis/batch12/lanes/networking-capability-rows.md`. Evidence: `docs/aegis/demo/evidence/batch12/networking/checks.txt` (the declared checks, the widened scanner's results for the lane's markers, the case parse) and `full-run.txt` (the full `node --test` after merging the lead's branch: 2443 tests, 41 failing, every one a baseline name).

## Decisions and why

1. **Every change is a PREVIEW ONLY marker; no new SAFETY GATE.** The brief allows either. Two tests pin the SAFETY GATE count at 351 (`scripts/gate-r-class.test.js`, `scripts/audit/read-back-field.test.js`) and neither is a registry the brief lets a lane edit; four lanes raising it in parallel would also conflict. Network changes here are R2 or R3 changes to a site, a zone or a policy that their owner applies in a change window, and no connector reads Meraki, Cloudflare, Zscaler or a host's configuration, so a gate could name no read-back command. The existing network runbooks (`/meraki-site-vpn`, `/vpn-check`, `/wifi-issue`) do the same. The answer-format block takes a preview id when that is all a runbook has.
2. **Shell previews carry a `cp` backup line.** The scanner does not know `wg`, `nft`, `ip` or `swanctl` as sinks, and a preview region with no sink it knows fails "preview marker owns no mutation vocabulary". Saving the config first is the rollback anyway, so each shell preview starts with it; the strongSwan re-initiate is a portal-style preview in prose for the same reason.
3. **Five runbooks, not seven.** Firewall rule review and Wi-Fi at scale live in the knowledge module (the review table and pattern in `safe-changes.md`, decision tree G, the failure catalog) because both are review and design work whose changes are site-wide R3 previews either way; `/wifi-issue` and `/lan-wan` keep the single-client and site paths.
4. **New placeholder tokens** (a "Networking lane" block in `modules/security/placeholder-dictionary.md`): `[HOSTNAME]`, `[IP_ADDRESS]`, `[SUBNET]`, `[INTERFACE]`. Examples use the documentation ranges and example.com, example.org, example.net; the dev cases use only tokens already in the dictionary.
5. **Registries touched, each because a failing test asked:** `VARIANTS` (B) in `scripts/lint/command-structure.js`; `MIXED_STATE_COMMANDS` in `scripts/command-safety-gates.test.js`; the runbook count in `scripts/repository-structure.test.js` (108 to 113, a changed number rather than an appended entry); regenerated `docs/security/STATE_CHANGE_INVENTORY.json`, `docs/aegis/ladder-audit.md` and `docs/aegis/owner/vendor-facts-priority.md`. Merging the four lanes will conflict on the count and on the three generated files: sum the counts and regenerate the files.
6. **Escalate "yes" in the dev cases** means the answer must hand the work to a named outside party (a supplier, a partner's network owner, the DNS provider and registrar) or to security; each case's judge notes say which.
7. **No fresh-context reviewer started.** The lane brief says "do not start subagents"; the project CLAUDE.md calls the evidence-reviewer once per batch, which is the batch lead's step. This lane did a self-review pass instead (below).

## Fixture tickets (the fixtures answer these; no dev case uses them)

- Engineer: "A legacy Java client calling https://api.example.org fails since the API moved behind the shared load balancer: 'No subject alternative DNS name matching api.example.org found'. Browsers are fine. openssl output with and without -servername pasted." Good; flawed without split tests; flawed claiming a run.
- Fix card: "Teams calls keep freezing for me in the east wing meeting room, fine at my desk." Good; flawed over 150 words.
- Ask first: "Please lower the MTU on all the laptops, the VPN is slow." Good; flawed with two questions and steps.
- Incident: "Laptops on the third floor get addresses from a DHCP server we do not run: gateway 192.0.2.254 and DNS server 203.0.113.99." Good; flawed calling it harmless.
- Against the lead's `modeRow`: the four good fixtures pass; the flawed ones fail, except `engineer-flawed-claims-a-run.md`, whose flaw `claimsWithoutCalls` catches instead.

## Left out

- No SAFETY GATE (decision 1), so no exact-phrase ceremony or change record for network changes.
- Zscaler's block page, headers and admin paths; WireGuard's own documentation; OpenSSL's verify codes; the Linux and macOS ping manuals: hosts outside the allowed list, so those facts are UNCONFIRMED and marked.
- BGP configuration (only awareness and looking-glass reading), SD-WAN policy routing, load balancer vendor steps, Azure and Google Cloud VPN gateways, IPv6 beyond the basics, wireless site surveys.
- No model-judged run of the dev cases.

## Open questions for the batch lead or the owner

1. Should single, bounded network changes (one DNS record, one firewall rule) get real portal SAFETY GATEs in a later batch? That needs the two gate-count tests raised and a read-back (a `net_dns` lookup could prove a public record).
2. `scripts/lint/ladder-audit.js` files the five new runbooks under "Microsoft" because its `GENERAL` set lists `lan-wan`, `vpn-check` and `wifi-issue` but not new vendor-neutral runbooks. Add them to `GENERAL`?
3. `scripts/demo/expert-rules.js` `SMELLS` has no network smells: a rogue DHCP server, name servers or DS changed by nobody, a certificate nobody requested, the company's prefixes seen through an unknown network. The incident fixture and NET10 do not trigger the escalation row. Add them?
4. `scripts/demo/reading-claims.js` `CLAIM` misses "I ran ..." and a second verb after "and" without its subject ("I ran openssl ... and tested the listener").
5. Existing runbooks use tokens that are not in the dictionary (`[SITE_A]`, `[SITE_B]`, `[SITE_B_HOST]`, `[SITE_B_GATEWAY]` in `/meraki-site-vpn` and `/vpn-check`; `[SWITCH_NAME]`, `[VLAN_ID]` in `/lan-wan`). Not changed here (the brief forbids editing existing runbooks).

## Self-review: did I miss anything?

- Found and fixed: real root and top-level server names and addresses in a `dig +trace` example (now documentation values); `/l` read as a slash reference by the lint; the Fix card fixture at 176 words (now 147); vendor-fact "used in" phases that pointed at the wrong phase; NV-57 cited by a runbook line that did not exist (line added to `/zero-trust-block`).
- Not fixed, stated: the lane's portal previews are not exercised by any test beyond "states a non-executing boundary"; the knowledge module's accuracy is checked by no test; the incident fixture's escalation row does not apply under today's `SMELLS` (question 3).
