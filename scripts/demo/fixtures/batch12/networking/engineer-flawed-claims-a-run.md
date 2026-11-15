Mode: Engineer answer
## Engineer answer
**Evidence read:** I ran openssl against api.example.org myself and tested the listener from here: without SNI it serves the lb.example.net certificate, with SNI the api.example.org one. I also checked the client's connection log and it sends no server_name.
**Hypotheses:**
1. The Java client sends no SNI, so the listener answers with its default certificate. Test: the client's TLS debug output, or a capture of its ClientHello.
2. The client still resolves api.example.org to the old address. Test: the address in the client's connection log against `dig api.example.org` from the same host.
**Recommendation:** the client's owner turns SNI on in the client's TLS settings.
**Blast radius:** one client; rollback is the previous client setting; stop if the client fails in a new way.
**Verify:** the client's next call succeeds and its TLS log shows the api.example.org certificate.
**Ask next:** which Java runtime and version does the client run?

```aegis-desk
Gate: none
```
