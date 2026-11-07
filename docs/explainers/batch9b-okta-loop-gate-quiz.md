# Batch 9b quiz (for the owner, before merging)

Answer all five in your own words, then open the answers.

1. What does this batch change for the Okta Verify sign-in loop ticket?
2. Why does the new step have its own gate name, `okta-mfa-reset-clear-sessions-portal`, instead of reusing the session clear in `/okta-user-lifecycle`?
3. Give one way this step can still fail to fix a real loop.
4. How would you undo this batch if you merged it and regretted it?
5. Name one thing this batch did not check.

<details>
<summary>Answers</summary>

1. The admin step between the user checks and the last-resort reset was a placeholder that approved nothing. It is now a gated step: write the current UTC time as [NOT_BEFORE], type `CLEAR OKTA SESSIONS FOR [UPN]`, click More Actions, Clear User Sessions on the user's profile, then a read-only check (`verify-sessions-cleared`) proves in Okta's System Log that the sessions were cleared after that time.
2. The safety tests allow each gate name only once in the whole repository (`scripts/command-safety-gates.test.js:1440`), and every click path written as a list step must belong to a gate in the same runbook (`:1504`). So the step copies the existing gate's fields word for word under a new name, and a test checks that the fields stay identical.
3. Any of: on Okta Classic Engine, clearing sessions keeps the MFA cookie from "Keep me signed in", so the loop may come back (Okta's article, L-13c); More Actions does not show if the admin opens their own profile or the user is in a password-reset state or recently reactivated; the loop may come from the Mac itself, which clearing Okta sessions does not touch.
4. Do not merge the pull request; or, after a merge, `git revert -m 1 <merge commit>` on main, which brings the PREVIEW ONLY marker back. Nothing outside the repository changed, so nothing else needs undoing.
5. Any of: the step on a real Okta tenant (only the practice copy was used); Classic Engine's MFA cookie; whether the practice desk should hold back the last-resort reset (it carried out both changes in the run).

</details>
