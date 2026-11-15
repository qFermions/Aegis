Mode: Engineer answer
## Engineer answer
**Evidence read:** the two `openssl s_client` reads you pasted. With `-servername api.example.org` the shared listener serves a certificate for api.example.org and the chain verifies (return code 0). Without `-servername` it serves its default certificate for lb.example.net, which does not name api.example.org. The Java error ("No subject alternative DNS name matching api.example.org found") matches the second read.
**Hypotheses:**
1. The Java client sends no SNI, so the listener answers with its default certificate. Test: the client's TLS debug output, or a capture of its ClientHello: no server_name extension confirms it.
2. The client still resolves api.example.org to the old address, which serves only the default certificate. Test: the address in the client's connection log against `dig api.example.org` from the same host.
3. A proxy between the client and the balancer re-terminates TLS. Test: the issuer the client logs; an issuer other than the public CA points to the proxy.
**Recommendation:** fix the client first: its owner turns SNI on in the client's TLS settings or moves it to a runtime that sends SNI by default. Only if that cannot happen in time, the balancer's owner makes api.example.org's certificate the listener's default, a change that reaches every client without SNI:
```text
listener 443 default certificate: api.example.org (now: lb.example.net)
```
**Blast radius:** the client fix touches one client. The default-certificate change touches every client of the shared listener that sends no SNI; rollback is setting lb.example.net back as the default; stop if any other service's health check or client fails after the swap.
**Verify:** the client's next call succeeds and its TLS log shows the api.example.org certificate; a read without `-servername` shows the new default only if the listener was changed.
**Ask next:** which Java runtime and version does the client run?

## Details
Step 1 (turn SNI on in the client): no gate. Proof: the client's TLS log shows server_name sent and the call succeeds.
Step 2, only if step 1 cannot be done in time: gate `tls-certificate-bind-change` (R3, a shared listener, change window).

```aegis-desk
Gate: none
```
