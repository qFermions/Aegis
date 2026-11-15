# Start Aegis: the double-click launcher

For the next engineer. Batch 12, task 11.

## What runs

- `Start Aegis.command` (Mac, bash, mode 755 in git) and `Start Aegis.cmd` (Windows, CRLF through `.gitattributes`) sit at the repository root. Each goes to its own folder, checks that `node` is on the PATH, and runs `node scripts/start-aegis.js`. With no `node`, or on a non-zero exit, the window waits for Enter so the message stays on screen.
- `scripts/start-aegis.js` asks one question, "What does your company run?", then starts `scripts/aegis-chat.js` with the same node binary, from the repository root, on the same terminal. It passes `--setup <the saved answer>`, or nothing when there is none, and nothing else. It exits with the chat's exit code. The chat is sealed exactly as `aegis-chat.js` describes.

## What it saves, and where

- One file: `~/.aegis/company-setup.txt`, the answer on one line. The folder is made with mode 0700 and the file is written with mode 0600 (a folder that already exists keeps its mode). On Windows the modes are not enforced.
- The answer passes `protect()` from `scripts/ask-aegis.js` before it is saved: a password, key or tenant literal is refused (3 tries, then the chat starts with no setup), and email addresses and phone numbers become placeholders. A saved file edited by hand passes the same check when it is read.
- Never inside the repository: a home folder inside the repository saves nothing (the answer is used for that run only).
- An empty answer saves nothing. The chat then starts with no setup, and each answer says what Aegis assumed.

## How to reset it

- Double-click Start Aegis and type `clear` at the prompt, or type `change` to answer the question again.
- Or delete the file: `rm ~/.aegis/company-setup.txt` on a Mac, `del %USERPROFILE%\.aegis\company-setup.txt` on Windows.

## Other cases

- No terminal (stdin is not interactive): nothing is asked; the saved answer is used, or none.
- A saved file it cannot read: one plain line, then the chat starts with no setup.
- A home folder it cannot write: one plain line ("was not saved"), then the chat starts with the answer.
- Ctrl-C at the question: exit 0, nothing saved, no chat. While the chat runs, the launcher ignores Ctrl-C, as `aegis-chat.js` does, so Ctrl-C stops a reply instead of closing the window.

## Checks

- `node --test scripts/start-aegis.test.js`: fake spawn, fake prompt, no socket, no real claude.
- Evidence: `docs/aegis/demo/evidence/batch12/start-aegis-red.txt`, `start-aegis-green.txt`, `start-aegis-mutations.txt` and `start-aegis-e2e.txt` (the real `.command` file on a pseudo-terminal with a fake claude).
- Not checked: `Start Aegis.cmd` on a real Windows machine, and the first-open prompts of macOS Gatekeeper and Windows SmartScreen.
