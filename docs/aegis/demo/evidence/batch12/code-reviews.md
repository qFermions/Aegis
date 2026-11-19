# Batch 12: the three code reviews, finding by finding

Each review ran the `/code-review` skill at xhigh (tier C) in a subagent on Opus 5.5, which probed the code in node and returned its findings in its final report. The reports themselves were not saved as files; this page lists every finding as the report gave it, condensed to one line, with the commit that fixed it or the `checks.md` row that closed it. The red and green captures named in each fix commit are in this folder (`cr1-*`, `cr2-*`, `cr3-*`).

## Round 1: `main...feat/batch12-expert-lanes`, 15 findings (checks.md rows CR1, CR1-1)

| # | file | finding | outcome |
|---|---|---|---|
| 1 | `scripts/eval/judged/backends.js` | the tool server on by default lets net_http and net_dns carry ticket text to a public host after a prompt injection | closed, owner decision (CR1-1) |
| 2 | `scripts/demo/reading-claims.js` | a claim after a time word is skipped even in the past; only the first claim of a sentence is read | fixed `67e6cb9b` (class B) |
| 3 | `scripts/demo/reading-claims.js` | the actor-less lookup wording of answer-format section 10 is never checked | fixed `67e6cb9b` (class B) |
| 4 | `scripts/ask-aegis.js` | a failed ask leaves the audit file, says "Nothing was saved" and the folder is refused next time | fixed `db720d0b` (class C) |
| 5 | `scripts/aegis-chat.js` | every call leaves an empty chat folder in the real home folder | fixed `d85be729` (class D) |
| 6 | `scripts/command-safety-gates.test.js` | winget update and rm missed in PowerShell | fixed `e8567e44` (class E) |
| 7 | same | a PowerShell force push after an assignment missed | fixed `e8567e44` |
| 8 | same | helm takes an option's value as the subcommand | fixed `e8567e44` |
| 9 | same | terraform init --migrate-state and --force-copy missed | fixed `e8567e44` |
| 10 | same | kubectl value options missing (--as-uid and others) | fixed `e8567e44` |
| 11 | same | git global options with a separate value hide a push | fixed `e8567e44` |
| 12 | `scripts/demo/expert-rules.js` | safeRecovery fails a safe answer that first says what not to do | fixed `66a2a56a` (class F) |
| 13 | same | the Engineer row allows four Options; both parts give "out of order" | fixed `975a0dad` (class G) |
| 14 | `scripts/ask-aegis.js` | the ask-first branch prints the mode line; the Engineer branch uses a looser pattern | fixed `a3124be3` (class H) |
| 15 | `senior-rules.js`, `backends.js`, `report.js` | a duplicated helper and a hand-written server prefix | fixed `539594a8` (class I; no capture, the suites passed 511 of 511 in the session) |

## Round 2: `a7d7cee3..730df7e3`, diff-only, 7 findings and 3 nits (checks.md rows CR2, CR2-7)

| # | finding | outcome |
|---|---|---|
| 1 | the wider claim reader fails sentences that say no check ran (a present-tense Verify line, a hypothetical, a negated tool name, a "Tell the user" draft) | fixed `8a6b003a` (class B2) |
| 2 | the recovery rule's negation crosses "and", so an unsafe order passes | fixed `fd2d2a85` (class F2) |
| 3 | bold negation not read; revoke and alternate take negated mentions | fixed `fd2d2a85` |
| 4 | kubectl and helm reads read as writes after the round 1 fix | fixed `c3bee481` (class E2) |
| 5 | the lookup report stops at a dot in a host name, and is dropped beside a first-person claim | fixed `8a6b003a` |
| 6 | progress.md stale | rewritten in `60903f80` |
| 7 | on a timeout the server may append to the audit file after it was counted empty | closed, not reproduced (CR2-7) |
| nit 1 | GIT_GLOBALS backtracks exponentially | fixed `c3bee481` |
| nit 2 | winget aliases missed in shell fences | fixed `c3bee481` |
| nit 3 | a dead value in aegis-chat | fixed `19a5e98a` (its message says 11 of 11 tests; the run showed 10 of 10; no capture) |

## Round 3: `730df7e3..60903f80`, diff-only, 9 findings, 1 nit, 4 issues from before the range (checks.md row CR3)

| # | finding | outcome |
|---|---|---|
| 1 | past claims after before, once and until excused; "if" as "whether" excuses a claim; one report tested | fixed `485c3b44` (class B3) |
| 2 | helm's next-word rule fails open after an unknown option | fixed `b792c4f2` (class E3) |
| 3 | a tool named outside the exact citation form is no longer checked | fixed `485c3b44` |
| 4 | present-tense lookup reports (the format's own Evidence example) no longer read | fixed `485c3b44` |
| 5 | a /path or "the answer format" lets one Read back a DNS or web claim | fixed `485c3b44` |
| 6 | "Tell the user" lines skipped entirely, so a made-up citation there is never checked | fixed `485c3b44` |
| 7 | a report boundary cuts a claim from its object (false fail) | fixed `485c3b44` |
| 8 | "or" ends a negation (false fail) | fixed `f4c46e80` (class F3) |
| 9 | "never X without Y", "don't forget to" and the noun-first revoke read as negated (false fails) | fixed `f4c46e80` |
| nit | a list marker before a "Tell the user" label | fixed `485c3b44` |
| A | winget.exe and winget repair missed in shell fences | fixed `b792c4f2` |
| B | kubectl's next-word rule looks at the next token only, for writes only; --kuberc missing | fixed `b792c4f2` |
| C | the time-word clause runs across a comma | fixed `485c3b44` |
| D | a quoted git -C path with a space hides a forced push | fixed `b792c4f2` |

The rule allows three rounds, so the round 3 fixes had no fourth review: each class carries one table test holding every probe of the three reviews, and the claim reader was replayed over 153 saved real answers (`cr3-claims-replay.txt`).
