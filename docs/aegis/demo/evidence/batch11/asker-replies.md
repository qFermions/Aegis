# Six replies to the person who asked (batch 11, task 8)

Each reply below is what `node scripts/ask-aegis.js "<ticket>" --reply-to asker` printed for one of the builder's own dev tickets: text for a person to read and send. Aegis sent nothing. The word count is the desk's own counter; the check is `replyProblems` (`scripts/demo/senior-rules.js`): form, done claims, admin actions, times nobody set, checks nobody ran. It cannot tell whether the reply is right; that is for the reader.

| ticket | platform | words | form check | cost in US dollars |
|---|---|---|---|---|
| DEV10 | Okta | 131 | passed | 0.35 |
| DEV24 | Okta and Jamf (setup given) | 110 | passed | 0.45 |
| DEV14 | Microsoft | 91 | passed | 0.23 |
| DEV17 | Microsoft | 138 | passed | 0.45 |
| DEV18 | Google | 147 | passed | 0.33 |
| DEV23 | Google (setup given) | 147 | did not pass | 0.35 |

Total cost of these sessions: 2.17 US dollars.

## DEV10 (Okta)

Ticket as typed: "My phone was swapped under warranty and Okta Verify did not come across to the new one. I cannot get into anything behind Okta. The old phone went back to the shop."

> Your new phone isn't connected to your Okta account yet. Okta still links your sign-in approvals to the old phone, and that phone has gone back to the shop, so nothing can approve your sign-ins. I've only read what you wrote in your request. I haven't looked at your account, so I can't yet confirm that nothing else is involved.
>
> Meanwhile, you can install the Okta Verify app on your new phone from the app store. Don't try to add your account until a technician is on the phone with you.
>
> A technician will call you on a number already on file to confirm it's you. They will then give you a one-time way to sign in and help you set up Okta Verify on the new phone during that call.

Words: 131. Form check: passed. Cost of the session: 0.35 US dollars (claude-opus-5-5).

## DEV24 (Okta and Jamf (setup given))

Ticket as typed: "One of the engineers left his laptop in a taxi last night. He has rung the taxi firm but has not got it back."

Setup given: "Okta is the identity provider for every app. The laptops are Macs managed with Jamf Pro. Slack for chat. No Microsoft 365 and no Intune."

> The laptop is still missing, so for now IT treats it as a device someone else might use. So far I have only read what you wrote in the ticket. I haven't checked the laptop's record or his account activity yet, so I can't say whether anyone has tried to use them.
>
> Meanwhile he should work from another device and avoid signing in on any computer he does not know. If the taxi firm finds the laptop, please tell IT straight away.
>
> A technician will check the laptop's last contact and his recent sign-ins next. They will then decide whether to sign him out everywhere and lock the laptop remotely.

Words: 110. Form check: passed. Cost of the session: 0.45 US dollars (claude-opus-5-5).

## DEV14 (Microsoft)

Ticket as typed: "Nobody at the second office can get into Outlook or Teams since about 10 this morning. Head office seems fine."

> Something at your office seems to be blocking Outlook and Teams. It doesn't look like a problem with anyone's account, because head office is working normally.
>
> So far I've only read your message. I haven't confirmed the cause yet: it could be your office's internet connection, its link to head office, or a network setting.
>
> For now, you can use Teams or Outlook on a phone with Wi-Fi switched off, or call colleagues directly. A technician will check your office's network connection next and will tell you once things work again.

Words: 91. Form check: passed. Cost of the session: 0.23 US dollars (claude-opus-5-5).

## DEV17 (Microsoft)

Ticket as typed: "Invoices from our printing supplier keep landing in quarantine. Accounts are fed up. Can you just whitelist their whole domain so this stops?

Authentication-Results: spf=fail (sender IP is 203.0.113.44) smtp.mailfrom=billing.printsupplier.example; dkim=none (message not signed) header.d=none; dmarc=fail action=quarantine header.from=printsupplier.example; compauth=fail reason=000"

> No, I don't recommend allowing their whole domain. The message header you sent shows their invoices fail all three checks that prove an email really comes from them, and their own settings tell receiving mail systems to hold that mail. Allowing the domain would also let in anyone faking their address, which is a common way fake invoices get through.
>
> I looked only at the header you pasted. I haven't confirmed whether the supplier's email setup is wrong or whether some of these messages aren't from them at all.
>
> In the meantime, please don't pay any invoice or accept new bank details from them unless you've confirmed it by phone on a number you already have. A technician will check the held invoices next, contact the supplier about fixing their setup, and release the ones the supplier confirms.

Words: 138. Form check: passed. Cost of the session: 0.45 US dollars (claude-opus-5-5).

## DEV18 (Google)

Ticket as typed: "A supplier says their emails to us bounce. They sent us the bounce below and say the fault is on our side, so they want us to allowlist their domain in Gmail.

550-5.7.26 This mail has been blocked because the sender is unauthenticated. Gmail requires all senders to authenticate with either SPF or DKIM. Authentication results: DKIM = did not pass, SPF [deliveries.supplier.example] with ip: [198.51.100.23] = did not pass"

> No, this isn't a fault on our side, and allowlisting their domain isn't the right fix. The bounce they sent shows their own mail setup failed both of the sender checks our mail system requires.
>
> I've only read the bounce text you passed on. It says their sending server isn't listed in their own records and their messages aren't signed. That's why their theory doesn't fit: those records sit with them, not with us. I haven't yet confirmed the rejection in our own mail logs. Allowing their whole domain would also let through fake mail pretending to be from them.
>
> There's nothing you need to change. Please ask them to call you for anything urgent in the meantime. A technician will check our mail logs next and send their IT contact the exact fix. Once they've made it and a test message arrives, we'll let you know.

Words: 147. Form check: passed. Cost of the session: 0.33 US dollars (claude-opus-5-5).

## DEV23 (Google (setup given))

Ticket as typed: "A new starter cannot sign in on her first day. She says it tells her the password is wrong, and she is sure she typed what was on the welcome sheet."

Setup given: "Google Workspace Business Standard for mail, calendar and files. Chromebooks, managed in the Google Admin console. No Microsoft 365 and no Active Directory."

> This looks like a problem with the new account's starting password, not with her or the Chromebook. So far I have only read what the ticket says, and nothing on the account has been checked yet.
>
> She may well have typed exactly what was on the welcome sheet. That fits if the sheet itself is wrong, or if it has characters that look alike, such as a lowercase l and the number 1. I haven't confirmed either one.
>
> In the meantime, she can try once more, typing slowly with the eye icon on so she can see the password, and checking the full email address too. A technician will check her account and sign-in record next. If she still can't get in, they will give her a new temporary password in person or on a phone call, and she will choose her own password at that first sign-in.

Words: 147. Form check: did not pass: it is not addressed to "you". Cost of the session: 0.35 US dollars (claude-opus-5-5).

