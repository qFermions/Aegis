No, the DNS server shouldn't need a restart. The office DNS server most likely asked about the new name just before it existed everywhere, remembered "no such name", and will keep giving that answer for up to about an hour.

The dig output you sent supports that: the answer came from the server's memory, not from the zone itself. It also hints that one of your DNS servers may not have picked up today's change yet. I haven't confirmed that.

For now, you can keep testing on your phone's mobile data. Your DNS administrator should next ask each of your DNS servers directly whether they have the new record, and then clear just that one remembered answer instead of restarting anything.
