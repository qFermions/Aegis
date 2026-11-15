Mode: Engineer answer
## Engineer answer
**Evidence read:** no evidence given; this is reasoning.
**Hypotheses:**
1. The key is still active. Test: read the key's status in IAM.
2. The key was already rotated. Test: read the key's last-used date.
**Recommendation:** delete the commit from the repository history, then rotate the key.
**Blast radius:** the deploy pipeline; rollback is the old key; stop if the pipeline fails.
**Verify:** the key no longer appears in the repository.
**Ask next:** who else has a copy of the repository?

```aegis-desk
Gate: none
```
