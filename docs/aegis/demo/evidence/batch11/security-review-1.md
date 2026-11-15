Saved word for word from the reviewer's final report (batch 11, resumed session).

No findings.

I found no high-confidence, exploitable vulnerability added by this branch in the code in scope.

**How I checked (all read-only).** I read `REVIEW.md` and got each diff with `git diff 3ca7a12...HEAD -- <file>` for every file in scope. I read `scripts/demo/senior-rules.js` and the five batch11 tools in full. I ran a grep over the added code lines (tests, md and jsonl excluded) for `shell: true`, `execSync`, `child_process`, `eval(`, `new Function`, `innerHTML`, `spawn(`, `.exec(` and POST/PATCH/PUT/DELETE routes. The only hits were regex `.exec` calls and the existing `spawn(..., shell: false)` in `scripts/aegis-chat.js:73`.

**What I traced and why each is clean**

1. **Spawn arguments** (`backends.sutArgs`/`judgeArgs`/`modelArgs`, `ask-aegis.askArgs`, `aegis-chat.chatArgs`, `customer-desk.sessionArgs`):
   - Every spawn still uses `shell: false`.
   - `--model` and `--judge-model` both go through `isModelName` (`^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,99}$`). A name cannot start with `-`, so it cannot be read as an option. CLI flags are trusted anyway.
   - `--model` is appended after `--settings`, so it does not end the `--tools`/`--allowedTools`/`--disallowedTools` lists early. The tool set is unchanged: Read, Grep, Glob and Agent, with Bash and web tools disallowed.
   - `aegis-chat` still slices from `--tools`, so `--model` and `--append-system-prompt` come after the isolation flags.
2. **Case `setup` field** (untrusted case-file text):
   - The type and the 4000-character limit are checked in `cases.js`.
   - `protectSetups` runs `protect()` on it (emails and phones become placeholders; credentials and tenant literals refuse the run).
   - It enters the system-under-test prompt only through `setupBlock`, which now brackets any line that copies a marker (`MARKER_LINE`).
   - In the judge prompt it is one collapsed line, and it is part of the text checked when the nonce is drawn.
   - It never reaches a spawn option position: the prompt starts with "What the company runs".
3. **Read-deny rules:** `readDenyRules(runRoot, caseDirs)` only adds rules. `caseFolders` refuses a folder that holds the repository (case-folded on darwin/win32). No existing rule was removed or narrowed.
4. **Stream-json / tool-call record:** `toolCall` keeps only the tool name, path, pattern and an agent label, each cut to 300 characters. `outsideReads` only stats paths and can only turn a case INCONCLUSIVE. These values reach `results.json` and `report.md` (markdown, through `cell()`). The terminal line holds only id, verdict and score.
5. **desk.html** (`render.js`):
   - The new `models`/`pinned_model` summary fields render through the existing `esc()` in the `[k, v]` list. `summaryLines` is terminal and markdown only.
   - The new senior rows show only `c.plain` (escaped) and the verdict. The `detail` text with answer quotes reaches HTML only inside `esc(technical)`.
   - The `assumed` card line renders through `esc(cardText(card))`.
6. **Graph read-back** (`verify-temporary-access-pass`):
   - It uses the existing GET-only `authMethods` route and the existing `changeRefusal`, `redactDeep` and `recordVerdict` path. No write route was added.
   - `observed` holds only `createdDateTime`, a boolean `isUsable`, and `methodUsabilityReason` limited to Microsoft's documented values. The pass value is never selected or printed.
   - In the "created before" branch, `createdDateTime` is printed only after the undated check, so it is a parseable time. The source is Graph, which is trusted.
7. **Human-executes boundary:**
   - `isAskFirst` adds a CLARIFY close. CLARIFY approves nothing, and the boundary and probe FAILED closes still run first (`customer-desk.js:557-561`).
   - The `sim/gates.js` TAP gate changes only the simulated tenant object.
   - `--reply-to asker` prints text and sends nothing.
8. **`ask-aegis` init.json:** this saves the CLI's init event under `~/aegis-asks`, outside the repo. Data stored on disk is excluded from this review, and the event holds no key.
9. **Evidence tools** (`capture.sh`, `run-evidence.js`, `judged-evidence.js`, `asker-replies.js`, `saved-answer-rows.js`, `t1-pins.js`): the builder runs them by hand with trusted paths. They write markdown or copy the already-escaped desk.html; `clean()` only inserts fixed `<repo>`/`<home>`/`<tmp>` tokens.

**Considered and dismissed (below the bar)**
- `checks.js` `reproducedFromEvidence`: a compliance phrase inside a word-for-word quote of the evidence (at least 3 extra words) no longer fails the probe check. That softens an eval and desk check: such an answer becomes INCONCLUSIVE, not a pass, unless the flag pattern (`FLAG_RE`) also matches. The boundary check still applies, and only the simulated desk acts on it, so nothing reaches production. It is a quality and grading question for REVIEW.md ("check weakened"), not a security finding. Confidence that it is exploitable: 3/10.
- Case-insensitive path spellings (macOS) could dodge a case-sensitive deny rule on the case folder. `outsideReads` flags any read outside the repo and makes the case INCONCLUSIVE, so the grade is protected. Confidence: 2/10.

Not checked: I ran nothing, so I did not confirm that the CLI applies the new case-folder deny rules in a live session. That needs a real session. I also did not review test files, fixtures, docs, or `STATE_CHANGE_INVENTORY.json`, which were out of scope.

