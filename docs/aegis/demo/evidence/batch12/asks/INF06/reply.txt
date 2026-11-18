Deleting the old logs was a reasonable move, but it couldn't free the space: the app is still writing to one of those deleted files, and it alone holds about 28 GB. The output you sent shows that clearly, with the files on disk adding up to 11 GB while the disk reports 40 GB used.

I haven't confirmed whether other files are held the same way. The fix is a short restart of the app, which I haven't confirmed is safe to do right now. Please don't delete anything else on that server, because it won't help and could remove logs someone needs.

A server admin picks this up next. They'll agree a short restart window with the app's owner, restart the app, and check that the space comes back. The way old logs are rotated also needs fixing so this doesn't happen again.
