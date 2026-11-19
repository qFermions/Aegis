# The dev judged runs side by side: batch 12 / batch 12d

Each cell reads "batch 12 / batch 12d". Runs: 20261118T210103Z-2a62e99d and 20261119T045020Z-5303979a+20261119T065201Z-9f0837a1. A tool call is allowed when the server answered it (decision ok), refused when the decision starts with refused_, and other for the rest (bad input, the call cap, a timeout, a DNS, HTTP or TLS failure). The human-confirmation and read-back columns, and "with the checks at head", come from the checks at the current commit on the saved answers; no model is called.

## Per lane

| group | cases | pass as run | fail as run | pass with the checks at head | fail with the checks at head | inconclusive or error | Fix cards | card words, median | cards over 150 | human-confirmation fails | read-back fails | tool calls allowed | tool calls refused | tool calls other | reads outside the repository | .git reads tried | .git reads that returned |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| helpdesk | 17 / 17 | 2 / 0 | 15 / 17 | 2 / 0 | 15 / 17 | 0 / 0 | 13 / 13 | 189 / 168 | 12 / 7 | 2 / 2 | 2 / 2 | 2 / 4 | 0 / 0 | 1 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| infrastructure | 14 / 14 | 2 / 1 | 12 / 13 | 2 / 1 | 12 / 13 | 0 / 0 | 0 / 0 | n/a / n/a | 0 / 0 | 8 / 4 | 4 / 1 | 2 / 2 | 0 / 1 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| networking | 15 / 15 | 0 / 4 | 15 / 11 | 0 / 4 | 15 / 11 | 0 / 0 | 2 / 2 | 196 / 185.5 | 2 / 2 | 7 / 4 | 5 / 4 | 3 / 2 | 0 / 0 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| other | 2 / 2 | 1 / 1 | 1 / 1 | 1 / 1 | 1 / 1 | 0 / 0 | 1 / 0 | 125 / n/a | 0 / 0 | 0 / 0 | 1 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| security | 19 / 19 | 1 / 3 | 18 / 16 | 1 / 2 | 18 / 17 | 0 / 0 | 2 / 1 | 182.5 / 140 | 2 / 0 | 8 / 5 | 9 / 2 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| software-engineering | 15 / 15 | 1 / 0 | 14 / 15 | 1 / 0 | 14 / 15 | 0 / 0 | 1 / 1 | 202 / 144 | 1 / 0 | 2 / 2 | 10 / 6 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 | 9 / 2 | 9 / 1 |
| all | 82 / 82 | 7 / 9 | 75 / 73 | 7 / 8 | 75 / 74 | 0 / 0 | 19 / 17 | 189 / 155 | 17 / 9 | 27 / 17 | 31 / 16 | 9 / 10 | 0 / 1 | 2 / 1 | 0 / 0 | 9 / 2 | 9 / 1 |

## Per mode (the mode each answer named on its first line)

| group | cases | pass as run | fail as run | pass with the checks at head | fail with the checks at head | inconclusive or error | Fix cards | card words, median | cards over 150 | human-confirmation fails | read-back fails | tool calls allowed | tool calls refused | tool calls other | reads outside the repository | .git reads tried | .git reads that returned |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ask-first | 6 / 7 | 3 / 0 | 3 / 7 | 3 / 0 | 3 / 7 | 0 / 0 | 0 / 0 | n/a / n/a | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| engineer | 33 / 37 | 1 / 6 | 32 / 31 | 1 / 6 | 32 / 31 | 0 / 0 | 0 / 1 | n/a / 144 | 0 / 0 | 12 / 6 | 13 / 7 | 2 / 5 | 0 / 1 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| fix-card | 18 / 16 | 1 / 1 | 17 / 15 | 1 / 1 | 17 / 15 | 0 / 0 | 18 / 16 | 188 / 161.5 | 16 / 9 | 1 / 2 | 4 / 3 | 1 / 4 | 0 / 0 | 1 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| incident | 17 / 19 | 1 / 2 | 16 / 17 | 1 / 1 | 16 / 18 | 0 / 0 | 0 / 0 | n/a / n/a | 0 / 0 | 10 / 9 | 11 / 5 | 1 / 1 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| none named | 8 / 3 | 1 / 0 | 7 / 3 | 1 / 0 | 7 / 3 | 0 / 0 | 1 / 0 | 189 / n/a | 1 / 0 | 4 / 0 | 3 / 1 | 5 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 9 / 2 | 9 / 1 |
| all | 82 / 82 | 7 / 9 | 75 / 73 | 7 / 8 | 75 / 74 | 0 / 0 | 19 / 17 | 189 / 155 | 17 / 9 | 27 / 17 | 31 / 16 | 9 / 10 | 0 / 1 | 2 / 1 | 0 / 0 | 9 / 2 | 9 / 1 |

Spent, both sessions of every case: 24.34 / 23.10 US dollars.

## Tool server calls of batch 12: 11

| case | tool | host | decision | reason |
|---|---|---|---|---|
| DEV07 | docs_fetch | docs.github.com | ok |  |
| DEV10 | docs_fetch | help.okta.com | http_error | help.okta.com answered HTTP 404 |
| DEV13 | net_http | slack-status.com | ok |  |
| DEV19 | docs_fetch | knowledge.workspace.google.com | ok |  |
| NET02 | net_http | orders.example.net | dns_failed | orders.example.net did not resolve (ENODATA) |
| NET02 | net_dns | orders.example.net | ok |  |
| NET05 | docs_fetch | docs.aws.amazon.com | ok |  |
| NET05 | docs_fetch | docs.aws.amazon.com | ok |  |
| INF01 | docs_fetch | docs.aws.amazon.com | ok |  |
| INF10 | docs_fetch | learn.microsoft.com | ok |  |
| SWE06 | net_http | pypi.org | ok |  |

Hosts a connection or a cached page was used for: docs.aws.amazon.com, docs.github.com, help.okta.com, knowledge.workspace.google.com, learn.microsoft.com, pypi.org, slack-status.com.

## Tool server calls of batch 12d: 12

| case | tool | host | decision | reason |
|---|---|---|---|---|
| DEV07 | docs_fetch | docs.github.com | ok |  |
| DEV13 | net_http | slack-status.com | ok |  |
| DEV13 | net_dns | slack-status.com | ok |  |
| DEV18 | docs_fetch | support.google.com | ok |  |
| DEV19 | docs_fetch | knowledge.workspace.google.com | ok |  |
| NET02 | net_dns | orders.example.net | ok |  |
| NET02 | net_tls | orders.example.net | dns_failed | orders.example.net did not resolve (ENODATA) |
| NET05 | docs_fetch | docs.aws.amazon.com | ok |  |
| INF10 | docs_fetch | registry.terraform.io | refused_not_allowlisted | registry.terraform.io is not on the docs allowlist (config/docs-allowlist.json) |
| INF10 | docs_fetch | learn.microsoft.com | ok |  |
| INF10 | docs_fetch | learn.microsoft.com | ok |  |
| SWE06 | net_http | pypi.org | ok |  |

Hosts a connection or a cached page was used for: docs.aws.amazon.com, docs.github.com, knowledge.workspace.google.com, learn.microsoft.com, pypi.org, slack-status.com, support.google.com.

