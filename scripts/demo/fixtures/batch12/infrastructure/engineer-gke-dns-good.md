Mode: Engineer answer
## Engineer answer
**Evidence read:** No evidence given; this is reasoning. The ticket says calls to an outside API from pods in `payments` take 5 to 10 seconds since this morning's node pool upgrade, while calls inside the cluster stay fast.
**Hypotheses:**
1. Short external names walk the pod's search list first (`ndots:5`), and one of those lookups now times out after the upgrade. Test: read the pod spec's `dnsPolicy`, then time a lookup of the name with a trailing dot against one without it.
2. The cluster DNS pods are short of capacity on the new nodes. Test: list the `kube-dns` pods in `kube-system` with their restarts, and their CPU in `kubectl top`.
3. The new nodes' outbound path is slow, not DNS. Test: time a TCP connection to the API's address directly, with no name.
**Recommendation:** if test 1 shows the trailing-dot lookup is fast, lower `ndots` for this workload only, through its manifest in Git; the workload owner merges it:

```yaml
spec:
  template:
    spec:
      dnsConfig: { options: [ { name: ndots, value: "2" } ] }
```

**Blast radius:** one Deployment's pods, replaced one by one; in-cluster short names still resolve through the search list. Rollback is reverting the commit. Stop if in-cluster calls slow down, or test 3 shows the delay without DNS.
**Verify:** the external call takes under a second from a new pod, and the p95 latency panel for `payments` is back to its level before the upgrade.
**Ask next:** do other namespaces on the upgraded node pool show the same delay?

## Human-run and read-back
- **Lower ndots for the payments Deployment.** Runs it: the workload owner, by merging the manifest change. Confirms first: test 1 showed the name with a trailing dot resolves fast. Verify: a new pod's external call takes under a second.

```aegis-desk
Gate: none
```
