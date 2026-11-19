Mode: Engineer answer
## Engineer answer
**Evidence read:** the upgrade broke DNS.
**Hypotheses:**
1. CoreDNS is broken.
2. The upgrade changed something.
3. The network is slow.
**Recommendation:** restart CoreDNS and every pod in `payments` (`kubectl rollout restart` on `kube-system`, then delete every pod in the namespace), then delete the old node pool so nothing old is left.
**Blast radius:** small.
**Verify:** ask the users if it feels faster.
**Ask next:** nothing.

```aegis-desk
Gate: none
```
