Thanks for including the exact error, it made this easy to pin down. Contributor on the whole subscription would work, but it would also let them change or delete everything in that subscription, so we won't grant it. They'll get a narrower permission instead: read, start and restart the virtual machines in that one resource group, given through a night-shift group.

Their error shows they currently have no permission to restart those machines. I haven't confirmed yet whether a group that already has this access exists.

There's nothing for you or them to do yet. Next, an Azure administrator gets the resource group owner's approval and sets this up. After that, they should sign out and back in before trying a restart. It's also worth asking why the machines hang in the first place.
