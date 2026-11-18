Mode: Engineer answer
## Engineer answer
Assumed setup: a Linux server with systemd, running the Java app as one service (no company profile given). Tell me what your company runs for a better answer.

**Evidence read:** the output you pasted, checked against the Linux triage runbook and the infrastructure lane's disk-full entry.
- `df` shows 40G used on `/var`, but `du` finds only 11G. Files you can see account for 11G. The other ~29G is held by files that were deleted but are still open.
- `lsof +L1` names one of them. Java PID 18422 still has `/var/log/app/app.log.1 (deleted)` open for writing (FD `12w`, NLINK 0) at 30,064,771,072 bytes, about 28 GiB. That matches the gap.
- Deleting the logs removed the file names only. The space stays in use until the process closes the file, so deleting more files won't free anything. Because the file is open for writing (`w`), it is still growing.

**Hypotheses:**
1. **Java is still writing to the rotated file you deleted.** It fits all three outputs. Test: run the full `lsof +L1` read below. If the total for PID 18422 is about 29G, this is the cause.
2. **More deleted files are held open.** You pasted only `head -3`. Test: the same full list, checking for other PIDs on `/var`.
3. **Log rotation is the underlying fault.** Rotation renamed `app.log` to `app.log.1`, but the app was never told to reopen its log, so it kept writing to the old file. Test: read the app's logrotate rule for `copytruncate` or a `postrotate` reload.

Inodes are not the cause here, because `df` shows 0 bytes free.

**Recommendation:** read first, then restart the one service with the service owner's agreement. The restart removes nothing and releases the 28G. A human admin runs every step.

```bash
# Read-only: every deleted-but-open file on /var, with sizes
sudo lsof +L1 /var
# Read-only: which systemd unit owns PID 18422
systemctl status 18422 --no-pager
# Read-only: the app's rotation rule
grep -rn "/var/log/app" /etc/logrotate.d/
```

Restart that unit through the runbook gate (it saves the unit's log first). This change is not covered by a runbook gate, so the app team should review it before applying. After the restart, fix rotation so this doesn't happen again:

```text
/var/log/app/*.log {
    daily
    rotate 7
    compress
    copytruncate   # or a postrotate that tells the app to reopen its log
}
```

**Blast radius:** one service on one host. API calls drop briefly during the restart. No undo is needed because the unit comes back with the same configuration. Stop if PID 18422 isn't a unit you recognise or isn't one you deployed: that is a security question, so leave it running and escalate. Also stop if the restart fails or `/var` fills again within minutes.

**Verify:** `systemctl status` shows the unit active with a new start time. `df -h /var` shows about 28G free. `lsof +L1 /var` no longer lists `app.log.1`. The app's write errors stop.

**Ask next:** does the full `lsof +L1 /var` list show any other process holding deleted files?

```asker-reply
Deleting the old logs was a reasonable move, but it couldn't free the space: the app is still writing to one of those deleted files, and it alone holds about 28 GB. The output you sent shows that clearly, with the files on disk adding up to 11 GB while the disk reports 40 GB used.

I haven't confirmed whether other files are held the same way. The fix is a short restart of the app, which I haven't confirmed is safe to do right now. Please don't delete anything else on that server, because it won't help and could remove logs someone needs.

A server admin picks this up next. They'll agree a short restart window with the app's owner, restart the app, and check that the space comes back. The way old logs are rotated also needs fixing so this doesn't happen again.
```

```aegis-desk
Gate: linux-server-triage-restart-unit
Phrase: RESTART [UNIT_NAME] ON [HOST_NAME]
Change record: R1, none (no change record for R1)
Read-back: systemctl status [UNIT_NAME] --no-pager
```