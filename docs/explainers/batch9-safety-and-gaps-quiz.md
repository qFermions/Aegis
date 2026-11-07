# Batch 9 quiz (for the owner, before merging)

Answer all five in your own words, then open the answers.

1. What are the two messages to the user, and when does the practice desk show the second one?
2. Name one specific decision in this batch and why it was made: for example, why does a laptop erase show as "not proved" in the practice desk even after the pretend technician sends it?
3. Give one way this change can still go wrong for a real ticket.
4. How would you undo this whole batch if you merged it and regretted it?
5. Name one thing this batch did not check.

<details>
<summary>Answers</summary>

1. "Tell the user now" says what happens next and what they should do, with no claim that a change is done, no promised time and no wipe, reset or lock announced as decided. "Tell the user when done" is the confirmation. The desk shows it only when its double-check passed; otherwise it says "not sent, because the change is not proved".
2. The erase command is sent to the laptop, but the laptop only acts on it when it next connects. The pretend technician sends the command; the laptop acting on it is not the technician's act, so the check honestly says it has not happened yet. The lock already worked this way in batch 8. (Other good answers: the Okta admin step is a "not authorized yet" marker because the menu item was not given; a short line in CLAUDE.md was trimmed so the new rules fit its size limit.)
3. The new message and look-first checks read words, not meaning. For example, the desk read "look for a macOS update" as a request to update something and closed two tickets as unfinished. A check can also miss a claim worded in a way its lists do not know. Another: the Exchange connector has never run against a real tenant, so a field it reads may be named differently there.
4. The batch is one merge: revert the merge commit on main with `git revert -m 1 <merge commit>`, which restores every file. Nothing outside the repository changed, apart from practice runs saved under the home folder and any answers a person saved with ask-aegis.
5. Any of: a real Exchange Online, Okta, Google or Jamf account; whether Microsoft's sign-in option limits the Exchange session to the four read commands; whether the Jamf API names the erase command "ERASE_DEVICE"; whether a real person's tickets get better advice (the held-out set the commander runs after merging measures that).

</details>
