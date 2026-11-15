# Sources

Every vendor or standards page this module relies on, with the date it was read and the EV ids of the facts taken from it. Each fact, with its verbatim quote and its CONFIRMED or UNCONFIRMED status, is one line of `docs/aegis/batch12/vendor-facts-software-engineering.md`. All pages were read on 2026-11-14 with a web fetch tool that returns a model's reading of the page; the quotes are as it returned them. Only GET requests were sent; no vendor API was called and no credential was used.

## GitHub (docs.github.com, www.githubstatus.com)

| Page | Facts |
|---|---|
| https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions | EV-01 |
| https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows | EV-02, EV-06 |
| https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication | EV-03 |
| https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax | EV-04, EV-14 |
| https://docs.github.com/en/actions/reference/security/secure-use | EV-05, EV-16, EV-17 |
| https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/re-running-workflows-and-jobs | EV-07, EV-08, EV-09 |
| https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/troubleshooting-workflows/enabling-debug-logging | EV-10 |
| https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs | EV-11 |
| https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching | EV-12, EV-13 |
| https://docs.github.com/en/actions/reference/limits | EV-14 |
| https://docs.github.com/en/actions/reference/runners/github-hosted-runners | EV-15 |
| https://docs.github.com/en/actions/concepts/security/github_token | EV-18, EV-19 |
| https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts | EV-20 |
| https://www.githubstatus.com/ | EV-21 |
| https://docs.github.com/en/code-security/dependabot/dependabot-security-updates/about-dependabot-security-updates | EV-22 |
| https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository | EV-25, EV-26 |

Not found: the page on restoring a deleted branch (`.../deleting-and-restoring-branches-in-a-repository` returned 404), so the pull request page's restore button is UNCONFIRMED (EV-68).

## Git (git-scm.com)

| Page | Facts |
|---|---|
| https://git-scm.com/docs/git-bisect | EV-23 |
| https://git-scm.com/docs/git-revert | EV-24, EV-30 |
| https://git-scm.com/docs/git-reflog | EV-27 |
| https://git-scm.com/docs/git-push | EV-28 |
| https://git-scm.com/docs/git-filter-branch | EV-29 |

## npm (docs.npmjs.com)

| Page | Facts |
|---|---|
| https://docs.npmjs.com/cli/v11/commands/npm-ci | EV-31, EV-32 |
| https://docs.npmjs.com/policies/unpublish | EV-33 |
| https://docs.npmjs.com/cli/v11/configuring-npm/package-json | EV-34, EV-35 |
| https://docs.npmjs.com/cli/v11/commands/npm-audit | EV-36, EV-37 |
| https://docs.npmjs.com/cli/v11/commands/npm-explain | EV-38 |

## pip (pip.pypa.io)

| Page | Facts |
|---|---|
| https://pip.pypa.io/en/stable/topics/secure-installs/ | EV-39 |
| https://pip.pypa.io/en/stable/cli/pip_check/ | EV-40 |
| https://pip.pypa.io/en/stable/user_guide/ | EV-41, EV-43 (not on the page) |
| https://pip.pypa.io/en/stable/topics/repeatable-installs/ | EV-42 |

## Python (docs.python.org)

| Page | Facts |
|---|---|
| https://docs.python.org/3/tutorial/errors.html | EV-44, EV-45 |
| https://docs.python.org/3/library/argparse.html | EV-46 |
| https://docs.python.org/3/library/logging.html | EV-47 |

## Node.js (nodejs.org)

| Page | Facts |
|---|---|
| https://nodejs.org/api/cli.html | EV-48, EV-52 |
| https://nodejs.org/api/process.html | EV-49, EV-54 |
| https://nodejs.org/api/errors.html | EV-50, EV-51, EV-53 (default not found) |

## PowerShell (learn.microsoft.com)

| Page | Facts |
|---|---|
| https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_error_handling | EV-55, EV-56, EV-60, EV-61 |
| https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_try_catch_finally | EV-57 |
| https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/get-error | EV-58 |
| https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_functions_cmdletbindingattribute | EV-59 |

## Docker (docs.docker.com)

| Page | Facts |
|---|---|
| https://docs.docker.com/build/cache/ | EV-62 |
| https://docs.docker.com/build/building/best-practices/ | EV-63, EV-64 |
| https://docs.docker.com/build/building/secrets/ | EV-65 |

## Not read

- Bash: the GNU Bash manual is not on the hosts this batch may fetch. The exit-code conventions (EV-66) and the exceptions to `set -e` (EV-67) are UNCONFIRMED, and the module marks each place it uses them.
- The GitHub CLI manual (cli.github.com) is not on those hosts either; `gh run rerun` and `gh run view --log-failed` are quoted from docs.github.com pages instead (EV-09, EV-11).
