---
description: TLS and certificate problems - read openssl s_client and curl -v (chain, SNI, expiry, hostname mismatch, missing intermediate, protocol and cipher), renewal failures, inspecting proxies, Cloudflare 525 and 526, and certificate replacement as a reviewed preview with a change window when the listener is shared. Placeholders only.
disable-model-invocation: true
---

# /tls-certificate

> **Execution boundary:** Read-only diagnostics remain available. Every state-changing line below is a non-executing preview under a PREVIEW ONLY marker: the owner of the listener applies it through a separately reviewed change. Aegis advises; a human administrator runs every step (HUMAN-RUN). A private key never goes into a ticket, a chat or an answer.

**Answer mode (answer-format section 9):** Engineer answer when the ticket carries `openssl`, `curl -v` or browser certificate details, or concerns a renewal, a load balancer or a CDN. Fix card when one person sees a certificate warning and nothing is pasted (often an inspecting proxy, a wrong clock or a captive portal). Ask first when someone asks to "turn off the certificate check", trust a certificate or lower the CDN's SSL mode with no error text (judgment rule d). Incident answer when a certificate for the company's names appears that nobody requested, or every site shows an issuer nobody runs (judgment rule a).

**Placeholders:** `[HOSTNAME]` · `[IP_ADDRESS]` (one node behind a balancer) · `[@Aegion_DOMAIN]` · `[DEVICE_NAME]` · `[JIRA-###]`. Evidence reading: `knowledge/networking/reading-evidence.md` sections 2 and 3.

## Phase 1: How wide before why (R0)

1. Who sees the error: browsers, an API client, a health check, the CDN edge (a Cloudflare 525 or 526 page), a mail server? One person, or everyone?
2. Every site or only [HOSTNAME]? Every site showing the same unexpected issuer is TLS inspection or a captive portal, not the site.
3. What changed: a renewal date, a new certificate, a load balancer or CDN change, a new zero-trust or proxy policy, a client OS update.
4. Read the CDN's or hosting provider's status page when the edge serves the name.

## Phase 2: Read what the host serves (R0)

Read the binding where it lives first: the load balancer's listener and certificate in its console, the web server's site binding, or Cloudflare dashboard → [@Aegion_DOMAIN] → SSL/TLS → Overview for the zone's SSL mode and Edge Certificates for the edge's certificate.

For a public host, a certificate lookup gives the served certificate without anyone pasting anything; report it by what it returned, such as "A certificate lookup for [HOSTNAME] returned a certificate valid until 2026-12-31, issued by an intermediate the chain includes (net_tls, 2026-11-14)". It cannot read an internal-only host.

```bash
# HUMAN-RUN, read-only: what the host serves for this name
# the chain, the SNI name sent, and the verify result
openssl s_client -connect [HOSTNAME]:443 -servername [HOSTNAME] -showcerts </dev/null
# the leaf's names, issuer and dates only
openssl s_client -connect [HOSTNAME]:443 -servername [HOSTNAME] </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
# the same without SNI: a different certificate here means a client that sends no name gets the default one
openssl s_client -connect [HOSTNAME]:443 </dev/null 2>/dev/null | openssl x509 -noout -subject -dates
# one node behind a load balancer, by its address, with the right name
openssl s_client -connect [IP_ADDRESS]:443 -servername [HOSTNAME] </dev/null 2>/dev/null | openssl x509 -noout -serial -dates
```

| What the output shows | Meaning | Next |
|---|---|---|
| `Verify return code: 0 (ok)`, names and dates right | TLS is fine for this client and name | The error is the next layer, or another node or name |
| `NotAfter` in the past, or code 10 | Expired | Phase 3: did the renewal fail, or is the new certificate not bound here? |
| The name is not in `subjectAltName`, or code 62 with `-verify_hostname` | Name mismatch | SNI (compare the two reads above), a missing name on the certificate, or DNS pointing at the wrong host |
| One certificate in `Certificate chain`, code 20 or 21 | The intermediate is missing: the server must send its certificate first, then the intermediates (RFC 8446) | Install the full chain on the listener (Phase 4) |
| An issuer named after a security product or proxy, code 19 | TLS inspection by a proxy or zero-trust client | `/zero-trust-block`, or deploy that proxy's root to managed devices |
| `handshake failure` or `no protocols available`, no certificate shown | No shared TLS version or cipher | Compare the client's versions with the server's policy |
| Different serials on different nodes | One node still has the old binding | Bind the new certificate on every node (Phase 4) |

(The OpenSSL codes are as commonly seen [unconfirmed: check the vendor page].)

<details>
<summary>curl and PowerShell: the same question from a client's side (HUMAN-RUN, read-only)</summary>

```bash
# HUMAN-RUN, read-only: the handshake and the first response; the headers name who answered
curl -sv -o /dev/null https://[HOSTNAME]/
# the same request sent to one node by address, keeping the name for SNI
curl -sv -o /dev/null --resolve [HOSTNAME]:443:[IP_ADDRESS] https://[HOSTNAME]/
```

```powershell
# the certificate Windows sees for the name: subject, issuer and expiry
$tcp = New-Object Net.Sockets.TcpClient('[HOSTNAME]', 443)
$ssl = New-Object Net.Security.SslStream($tcp.GetStream(), $false, { $true })
$ssl.AuthenticateAsClient('[HOSTNAME]')
$ssl.RemoteCertificate | Format-List Subject, Issuer, GetExpirationDateString
$tcp.Close()
```
</details>

## Phase 3: Why the renewal failed (R0)

1. Which system renews it: the CA's portal, an ACME client on the server, the cloud's managed certificates (AWS Certificate Manager, a CDN's edge certificates)? Read its last run and its error.
2. DNS validation: the validation record must still be in public DNS. AWS Certificate Manager renews a DNS-validated certificate on its own only while every validation CNAME stays in public DNS and the certificate is in use; it starts 45 days before expiry and sends warnings at 30, 15, 7, 3 and 1 days. A cleaned-up zone that removed those CNAMEs stops renewals quietly. `/dns-troubleshoot` reads the record.
3. HTTP validation: the validation path must reach the server through any redirect, CDN or firewall.
4. Renewed but not served: the new certificate exists, but the listener, a second node, the CDN's origin, or a mail or VPN service still binds the old one. Compare serials (Phase 2).
5. Cloudflare 526: the edge cannot validate the origin's certificate while the zone requires a valid one (Full strict). 525: the edge and the origin share no handshake. The fix is the origin's certificate or TLS settings, read from a host allowed to reach the origin; lowering the zone's SSL mode is not the first fix.

## Phase 4: Replace or bind a certificate (changes: PREVIEW ONLY)

1. **Lighter step:** when the right certificate is already issued, bind it on the node or listener that still serves the old one (one listener at a time), before reissuing anything.
2. **Lighter step:** when only the chain is missing, install the intermediate bundle on the listener; no new certificate is needed.
3. A new or reissued certificate (a missing name, an expired one that will not renew): the certificate owner requests it, then binds it.

> **PREVIEW ONLY [tls-certificate-bind-change]:** R2 per listener; R3 when the listener is shared by many services or the change needs a restart that drops connections. Planning only: this runbook does not authorize the change. The owner of the listener (the load balancer, the web server, the CDN origin) binds the new certificate and chain in a change window when the listener is shared, after saving the current certificate's serial, expiry and chain to the ticket. Rollback: rebind the previous certificate, which only helps while it is still valid. Stop if the served chain does not verify, or any client group fails after the swap.
- Load balancer console → the listener for [HOSTNAME] → its certificate: replace with the new one, with its full chain.
- Cloudflare dashboard → [@Aegion_DOMAIN] → SSL/TLS → Origin Server for an origin certificate the edge trusts; the origin server's own binding is the server owner's change.
- Read-back: the Phase 2 reads on every node show the new serial, the new `NotAfter` and `Verify return code: 0 (ok)`; a certificate lookup (net_tls, dated) shows the same from outside.

## ⚠️ Risk warning

- Binding a certificate on a shared listener or a restart that reloads TLS can drop live connections for every service on it: change window when shared.
- An expired certificate is no rollback: rebind an old one only while it is valid.
- Telling users to click through warnings, turning off certificate checks in scripts, or lowering a CDN's SSL mode hides the fault and can hide an interception.
- A private key travels only between the owner's systems through the certificate tooling; never through a ticket, a chat or a mailbox.

## ✅ Verification checklist

- [ ] Scope and what changed are in the ticket
- [ ] The served certificate (names, issuer, dates, serial, chain) was read with the right SNI, on every node that serves the name
- [ ] The cause is named with the read that proved it
- [ ] Any bind or reissue followed its PREVIEW ONLY plan with the previous certificate's details saved
- [ ] Read-back: every node serves the new certificate, the chain verifies, and a public lookup (net_tls, dated) agrees
- [ ] The renewal path is fixed, so the next renewal does not fail the same way

## 📝 Jira-ready note

> [JIRA-###] TLS: [HOSTNAME] showed [expired / name mismatch / missing intermediate / inspection issuer / handshake failure] for [clients] since [time]. Read: served certificate [serial, NotAfter, issuer] on [nodes] ([openssl / net_tls, date]). Cause: [renewal failed because / not bound on / chain missing]. Change: [none / bound new certificate on [listener] by the owner, previous certificate saved]. Verified: chain verifies on every node, public lookup agrees. Next renewal: [date, path fixed].
