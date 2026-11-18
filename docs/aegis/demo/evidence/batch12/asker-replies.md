# Batch 12: eight asker replies, two per lane (task 13)

Run 2026-11-18 with docs/aegis/demo/evidence/batch12/tools/run-asks.sh: one `node scripts/ask-aegis.js "<ticket>" --reply-to asker` per ticket, tool server on, each session on claude-opus-5-5 and capped at 0.60 US dollars, 3.50 for all eight. The tickets are the lane dev cases named, with any pasted evidence appended, after the privacy step. Each reply is text for a person to read and send; Aegis sent nothing. The form check is the widened one of batch 12, task 3.

| Case | Lane | Words | Form check | Cost (US dollars) | Tool calls |
|---|---|---|---|---|---|
| SEC03 | Security | 134 | pass | 0.35 | 0 |
| SEC09 | Security | 31 | did not pass: it is not addressed to "you" | 0.20 | 0 |
| NET01 | Networking | 121 | pass | 0.26 | 0 |
| NET14 | Networking | 99 | pass | 0.29 | 0 |
| INF04 | Infrastructure and cloud | 134 | pass | 0.34 | 0 |
| INF06 | Infrastructure and cloud | 145 | pass | 0.31 | 0 |
| SWE05 | Software engineering | 128 | pass | 0.25 | 0 |
| SWE12 | Software engineering | 46 | did not pass: it is not addressed to "you" | 0.21 | 0 |

Openings (first five words), all different: "Yes, it can be fixed,"; "What exactly does the Defender"; "No, the DNS server shouldn't"; "Your VPN most likely can't"; "Thanks for including the exact"; "Deleting the old logs was"; "No, switching the pipeline to"; "What does the push-protection message".

Total: 2.2100 US dollars for the eight sessions. The two ask-first replies (SEC09, SWE12) are the one question, as answer-format section 8 says for a ticket that gets Ask first, and fail the form rule that a reply is addressed to "you": the question asks about the device or the message without the word. The check was left as it is (a decision for the owner in the report).

## SEC03 (Security)

Ticket as typed: "Outlook keeps moving every email from our bank into the RSS Feeds folder for [FIRST_NAME] in accounts payable, so she nearly missed a payment confirmation. She says she never set up any rules. Can you fix her Outlook?"

> Yes, it can be fixed, but first it goes to our security team: a rule she never made that hides bank mail can mean someone else has got into her mailbox. I haven't confirmed that, and it may turn out to be harmless.
> 
> Thank you for raising it quickly. Please pass this on to her: don't delete the rule or any of the moved emails, don't reply to anything that asks for a payment or bank details by email, and check the RSS Feeds folder for anything from the bank she still needs to act on. Before any payment goes out, confirm it by calling the bank on a number she already has.
> 
> The security team and a technician pick this up next. They will call her to make the changes to her account.

## SEC09 (Security)

Ticket as typed: "Can you make the Defender alert on [DEVICE_NAME] stop? It keeps popping up and the user is fed up."

> What exactly does the Defender pop-up say, including the threat or alert name and any file, app or website it mentions, and since when has it been appearing on that computer?

## NET01 (Networking)

Ticket as typed: "We added portal.example.com to our DNS zone about 10 minutes ago for today's go-live. From the office it still says the site cannot be found, but my phone on 4G opens it fine. dig from my laptop is below. Do we need to restart the DNS server? /  / Pasted: / ; <<>> DiG 9.18.28 <<>> portal.example.com A / ;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 11873 / ;; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1 /  / ;; AUTHORITY SECTION: / example.com.            3412    IN      SOA     ns1.example.com. hostmaster.example.com. 2026111402 7200 900 1209600 3600 /  / ;; SERVER [cut]"

> No, the DNS server shouldn't need a restart. The office DNS server most likely asked about the new name just before it existed everywhere, remembered "no such name", and will keep giving that answer for up to about an hour.
> 
> The dig output you sent supports that: the answer came from the server's memory, not from the zone itself. It also hints that one of your DNS servers may not have picked up today's change yet. I haven't confirmed that.
> 
> For now, you can keep testing on your phone's mobile data. Your DNS administrator should next ask each of your DNS servers directly whether they have the new record, and then clear just that one remembered answer instead of restarting anything.

## NET14 (Networking)

Ticket as typed: "vpn wont connect from the hotel, says it cant reach the server. worked fine from home last night"

> Your VPN most likely can't get through the hotel's network. It worked from home last night, and the hotel network is the only thing that changed. I haven't confirmed that yet.
> 
> In the meantime, open any website in your browser and finish the hotel's sign-in or terms page if one appears, then try the VPN again. If it still won't connect, turn on your phone's hotspot, connect your laptop to it and try once more.
> 
> A technician will pick this up next. They'll check whether your connection attempts are reaching the company network and whether anyone else is affected.

## INF04 (Infrastructure and cloud)

Ticket as typed: "[FIRST_NAME] from the night shift needs to restart the two batch VMs in rg-batch-prod when they hang. Just make them Contributor on the subscription please. They got this: /  / Pasted: / (AuthorizationFailed) The client '[FIRST_NAME]' with object id '[USER_ID]' does not have authorization to perform action 'Microsoft.Compute/virtualMachines/restart/action' over scope '/subscriptions/[SUBSCRIPTION_ID]/resourceGroups/rg-batch-prod/providers/Microsoft.Compute/virtualMachines/batch-vm-01' or the scope is invalid."

> Thanks for including the exact error, it made this easy to pin down. Contributor on the whole subscription would work, but it would also let them change or delete everything in that subscription, so we won't grant it. They'll get a narrower permission instead: read, start and restart the virtual machines in that one resource group, given through a night-shift group.
> 
> Their error shows they currently have no permission to restart those machines. I haven't confirmed yet whether a group that already has this access exists.
> 
> There's nothing for you or them to do yet. Next, an Azure administrator gets the resource group owner's approval and sets this up. After that, they should sign out and back in before trying a restart. It's also worth asking why the machines hang in the first place.

## INF06 (Infrastructure and cloud)

Ticket as typed: "api-02 alarm: /var 100% full, app throwing write errors. I already deleted the old logs in /var/log/app and it's still full?? output: /  / Pasted: / $ df -h /var / Filesystem      Size  Used Avail Use% Mounted on / /dev/sdb1        40G   40G     0 100% /var / $ sudo du -xsh /var / 11G     /var / $ sudo lsof +L1 | head -3 / COMMAND   PID USER   FD   TYPE DEVICE    SIZE/OFF NLINK  NODE NAME / java    18422 app   12w   REG   8,17 30064771072     0 52311 /var/log/app/app.log.1 (deleted)"

> Deleting the old logs was a reasonable move, but it couldn't free the space: the app is still writing to one of those deleted files, and it alone holds about 28 GB. The output you sent shows that clearly, with the files on disk adding up to 11 GB while the disk reports 40 GB used.
> 
> I haven't confirmed whether other files are held the same way. The fix is a short restart of the app, which I haven't confirmed is safe to do right now. Please don't delete anything else on that server, because it won't help and could remove logs someone needs.
> 
> A server admin picks this up next. They'll agree a short restart window with the app's owner, restart the app, and check that the space comes back. The way old logs are rotated also needs fixing so this doesn't happen again.

## SWE05 (Software engineering)

Ticket as typed: "ci broke right after the last merge to main, npm ci fails on every run now. can we just change the pipeline to npm install so it works? /  / Pasted: / npm error code EUSAGE / npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing. / npm error Invalid: lock file's [USER@DOMAIN.COM] does not satisfy dotenv@^17.0.0"

> No, switching the pipeline to npm install isn't the right fix, though I understand why it's tempting. Your error shows that the last merge asked for dotenv version 17 but left the old version recorded in the lock file, so npm ci refuses to install.
> 
> Your idea would make the build pass by having CI quietly rewrite that lock file on every run. Builds would stop being repeatable, and nobody would review what gets installed. I haven't confirmed which merge caused it, but the error text points to the lock file not being updated.
> 
> There's nothing you need to do meanwhile. Next, a developer regenerates the lock file on a branch and opens a pull request. Once that PR's CI run passes and it's merged, main builds again.

## SWE12 (Software engineering)

Ticket as typed: "Please disable secret scanning push protection for our org. It keeps blocking pushes from the deploy tooling."

> What does the push-protection message say when it blocks a deploy push: which kind of secret it found, in which repository and file, and is the deploy tooling meant to push that value or is it a real credential that got into the code by mistake?
