# Batch 10 quiz (for the owner, before merging)

Answer all five in your own words, then open the answers.

1. What does this batch change in what Aegis asks a technician to approve at one time?
2. The desk now says a step "only looks" by reading the step's verb. Why does "Look for a macOS update" no longer count as a change, while "Restart the Mac" still does?
3. Give one way the new Google Drive handover check can still fail to prove a real handover.
4. How would you undo this batch if you merged it and regretted it?
5. Name one thing this batch did not check.

<details>
<summary>Answers</summary>

1. The approval block lists only the step to run now. A heavier step the runbook says to try only after a lighter one (the authenticator reset after the session clear, Wipe after Lock), or a step the answer calls a last resort, is written in Details with its name and its condition, and waits for its own approval later. The desk's "lightest step first" row fails a block that holds two such rungs (`scripts/demo/step-ladder.js`).
2. Only the step's verb counts: the first word of the step or of a sentence in it, or the word after "please", "then", "ask the user to" or a leading condition. In "Look for a macOS update", the verb is "Look"; "update" is a noun. In "Restart the Mac", the verb is "Restart" (`scripts/demo/answer.js`, `stepChange`).
3. Any of: Google does not list its status words, so a finished transfer that reads anything but "completed" stays "cannot tell"; Drive's application number (55656082996) is not confirmed on Google's page, so a wrong number finds no entry and stays "cannot tell"; a handover started in the Admin console may not appear in the transfer record the check reads, or may have no transfer ID to give it (vendor facts W-11, W-13, W-14).
4. Before merging, close the pull request. After merging, revert the merge commit with `git revert -m 1 <merge commit>` on main and push; nothing outside the repository was changed, apart from the practice runs' local folders under `~/aegis-demo-runs/`.
5. Any of: no real Google, Okta or Jamf tenant was read, so the new checks are proved only against the pretend systems and Google's and Jamf's pages; whether Jamf records a Lock Computer click as `DEVICE_LOCK`; the PowerShell tests, which need `pwsh` and run only in CI; the answers' quality, which a person should read.

</details>
