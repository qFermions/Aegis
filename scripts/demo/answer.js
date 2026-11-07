'use strict';
// answer.js: reads an Aegis answer the way a tech meets it (batch 8). An answer starts with a "## Fix"
// card (docs/aegis/answer-format.md), may go on under "## Details", and closes with one fenced block
// labeled aegis-desk that holds what only the desk needs (Gate lines, gate ids, change records,
// confirmation phrases). Text in, values out; the only file it reads is the placeholder dictionary, once at load. Nothing here decides a closing state on its own;
// the desk's five answer checks read these values and show on the page, and none of them stops a ticket.

const CARD_HEADING = /^##[ \t]+Fix[ \t]*$/;
const NEXT_SECTION = /^#{1,2}[ \t]+\S/;
// The six parts, in their order (batch 9, task 2: "Tell the user" became two lines, the message to send now
// and the one to send when the double-check passed). A part is a line that starts with its label, bold or not.
const PARTS = Object.freeze([
  { key: 'wrong', label: "What's wrong" },
  { key: 'doThis', label: 'Do this' },
  { key: 'doneWhen', label: 'Done when' },
  { key: 'stopIf', label: 'Stop if' },
  { key: 'tellNow', label: 'Tell the user now' },
  { key: 'tellDone', label: 'Tell the user when done' },
]);
// The two parts that speak to the customer, not to the tech: no step is read in them, and the boundary
// check does not read them either (scripts/eval/judged/checks.js).
const USER_PARTS = Object.freeze(['tellNow', 'tellDone']);
const labelRe = (label) => new RegExp(`^[\\s>*_-]*(?:\\*\\*)?${label.replace(/'/g, "['’]")}(?:\\*\\*)?[ \\t]*:[ \\t]*(?:\\*\\*)?[ \\t]*(.*)$`, 'i');
// compiled once (code review 1, finding 15). An answer written before batch 9 has one "Tell the user" line:
// it reads as the now line, so the new check still reads it, and the card is told it lacks the when-done line.
const LABELS = [...PARTS, { key: 'tellNow', label: 'Tell the user', legacy: true }].map((p) => ({ ...p, re: labelRe(p.label) }));
// A top-level numbered step: at most one space of indent (a deeper one is a sub-item of the step above),
// and the number may be bold, as in "**1.** Open" (code review 3, findings 3 and 4).
const fs = require('node:fs');
const path = require('node:path');

const STEP = /^ ?(?:\*\*)?(\d+)[.)](?:\*\*)?[ \t]+(.+)$/;
// Any numbered line, in any of the forms a step takes (indented, quoted, after a bullet, "(2)", "2)",
// "2.Reset", a bold number): what the change scan and the no-card step list read, so the form of a step
// cannot hide a change from INVESTIGATE (security reviews 4 and 5).
const ANY_STEP = /^[ \t>]*(?:[-*+][ \t]+)?(?:\*\*)?\(?(\d+)[.)](?:\*\*)?[ \t]*(\S.*)$/;
const LIST_LINE = /^[ \t>]*(?:[-*+][ \t]+|\(?\d+[.)])/;
// Characters that make a line look plain but read differently: full-width digits and no-break spaces fold
// to plain ones (NFKC), and zero-width characters go.
const plainText = (t) => String(t).normalize('NFKC').replace(/[\u200b-\u200d\u2060\ufeff]/g, '');
const DESK_FENCE = /^[ \t]*```[ \t]*aegis-desk[ \t]*$/;
const FENCE_END = /^[ \t]*```[ \t]*$/;

// Words a reader reads: markdown marks, list numbers and arrows are not words. An underscore stays, so
// [FIRST_NAME] is one word (code review 1, finding 10).
const words = (text) => String(text).replace(/[*`#>]/g, ' ').split(/\s+/).filter((w) => w && !/^\d+[.)]$/.test(w) && !/^[-|:\u2192]+$/.test(w)).length;
// Sentences in a short text: a run of text that ends at . ! or ? followed by a space or the end.
const sentences = (text) => String(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=\S)/).filter((s) => s.trim() !== '');

// The closing aegis-desk block: present only when its fence closes the answer (nothing but blank lines
// after it). Returns { present, lines, body } where body is the answer without the block.
function deskBlock(answer) {
  const lines = String(answer).split(/\r?\n/);
  let end = lines.length - 1;
  while (end >= 0 && lines[end].trim() === '') end -= 1;
  const absent = { present: false, lines: [], body: lines.join('\n') };
  if (end < 1 || !FENCE_END.test(lines[end])) return absent;
  let start = end - 1;
  while (start >= 0 && !/^[ \t]*```/.test(lines[start])) start -= 1;
  if (start < 0 || !DESK_FENCE.test(lines[start])) return absent;
  return { present: true, lines: lines.slice(start + 1, end), body: lines.slice(0, start).join('\n') };
}

// The Fix card. first: the card is the first thing in the answer. text: the card's lines without its
// heading. parts: each part's text. steps: the numbered "Do this" steps. order: part keys as found.
function fixCard(answer) {
  const lines = deskBlock(answer).body.split(/\r?\n/);
  const at = lines.findIndex((l) => CARD_HEADING.test(l));
  if (at < 0) return { present: false, first: false, text: '', parts: {}, order: [], steps: [], words: 0, lines: [], pointer: null };
  const firstLine = lines.findIndex((l) => l.trim() !== '');
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i += 1) if (NEXT_SECTION.test(lines[i])) { end = i; break; }
  const own = lines.slice(at + 1, end);
  const parts = {};
  const order = [];
  const steps = [];
  // each card line with the part it belongs to (null: no part), so a reader can leave the user messages out
  const tagged = [];
  let pointer = null;
  let current = null;
  for (const line of own) {
    const found = LABELS.find((p) => p.re.test(line));
    if (found) {
      current = found.key;
      if (!order.includes(found.key)) order.push(found.key);
      parts[found.key] = found.re.exec(line)[1].trim();
      tagged.push({ text: line, part: current });
      continue;
    }
    // a list or numbered line is never part of a describing or speaking part: a step filed after "Tell the
    // user now" or "Stop if" is still read as a step (security review 3's stray label)
    const listed = current !== 'doThis' && LIST_LINE.test(plainText(line));
    tagged.push({ text: line, part: (line.trim() === '' && current !== 'doThis') || listed ? null : current });
    // the one line, in no part, that points to Details ("This needs a longer plan ...: see Details."): the
    // 150-word limit counts the card body, not this pointer (batch 9, task 3); only the first such line
    if (current === null && pointer === null && line.trim() !== '' && /\bDetails\b/.test(line)) pointer = line;
    // "Do this" runs to the next part's label: a numbered line starts a step, and every other line in it
    // (a wrapped line, a bullet, a blank line) belongs to the step before it, so no step is ever lost
    // (code review 1, finding 6; security review 2; code review 2, finding 1). A negated change word in
    // such a line ("do not reset") still reads as a change: the safe side, since it only keeps a ticket
    // from closing INVESTIGATE.
    if (current === 'doThis') {
      const step = STEP.exec(line);
      if (step) steps.push(step[2].replace(/\*\*$/, '').trim());
      else if (line.trim() !== '' && steps.length) steps[steps.length - 1] += ` ${line.trim().replace(/^[-*]\s+/, '')}`;
      else if (line.trim() !== '') parts.doThis = `${parts.doThis ? `${parts.doThis} ` : ''}${line.trim()}`;
      continue;
    }
    // another part runs on over its wrapped lines and ends at a blank line; what follows it (such as the
    // line that points to Details) belongs to the card but to no part
    if (line.trim() === '') { current = null; continue; }
    if (current) parts[current] = `${parts[current] ? `${parts[current]} ` : ''}${line.trim()}`;
  }
  const text = own.join('\n').trim();
  return { present: true, first: at === firstLine, text, parts, order, steps, words: words(text) - (pointer ? words(pointer) : 0), lines: tagged, pointer };
}

// What is wrong with a card's shape, one plain clause each; empty when it has the five parts in order
// with the counts the format sets.
function cardProblems(card) {
  if (!card.present) return ['there is no "## Fix" card'];
  const problems = [];
  const missing = PARTS.filter((p) => !card.order.includes(p.key)).map((p) => p.label);
  if (missing.length) problems.push(`it has no ${missing.join(', ')}`);
  const expected = PARTS.map((p) => p.key).filter((k) => card.order.includes(k));
  if (card.order.join() !== expected.join()) problems.push('its parts are out of order');
  if (card.order.includes('doThis') && (card.steps.length < 3 || card.steps.length > 5)) problems.push(`"Do this" has ${card.steps.length} numbered steps, not 3 to 5`);
  for (const key of USER_PARTS) {
    const n = card.parts[key] ? sentences(card.parts[key]).length : 0;
    if (n > 3) problems.push(`"${PARTS.find((p) => p.key === key).label}" has ${n} sentences, more than 3`);
  }
  return problems;
}

// A command a tech would have to run: a package tool, node with a script, or a script of this repository.
// PowerShell cmdlets are not on this list: CLAUDE.md rule 3 still allows them, labeled, under Details.
const COMMAND_RES = [
  /(?<=^|[\s`'"(])(?:node|npm|npx|pnpm|yarn)[ \t]+(?:--?[a-z]|[\w./-]+\.(?:js|mjs|cjs)\b|scripts\/|run\b|install\b|test\b|exec\b|ci\b)/m,
  /(?<=^|[\s`'"(])(?:\.\/)?scripts\/[\w./-]+\.(?:js|mjs|cjs|sh|ps1|py)\b/m,
  /\b[a-z]+-client\.js\b/,
  /\b(?:change-record|replay-cli|memory-cli|tier-guard|intake)\.js\b/,
];
function commandIn(text) {
  for (const re of COMMAND_RES) {
    const m = re.exec(String(text));
    if (m) return m[0].trim();
  }
  return null;
}

// What belongs only in the aegis-desk block: a gate id the runbooks hold, a Gate line, an R class, a
// change record. ids: a Set or Map of the catalog's ids.
function deskOnlyIn(text, ids) {
  const t = String(text);
  for (const m of t.matchAll(/(?<![A-Za-z0-9-])[a-z0-9]+(?:-[a-z0-9]+)+(?![A-Za-z0-9-])/g)) if (ids && ids.has(m[0])) return m[0];
  const other = /^[\s*_`#-]*Gate:|\bR[0-3]\b|\bchange record\b|\bCHANGE_ID\b/im.exec(t);
  return other ? other[0].trim() : null;
}

// The org tokens that describe the default organization itself (its size, ISP, WAN, sites, phones, alarm,
// servers, partners, remote access), read from the placeholder dictionary's "Org tokens" table, so a token
// added there is known here too (code review 3, finding 10). Left out by prefix: the per-tenant connection
// tokens every customer has (DOMAIN, the Google, Okta, Jamf, Fleet, Slack, Linear, GitHub and Microsoft
// ids and hosts), and the Jira tokens, which the Jira fact covers.
const CONNECTION_TOKEN = /^\[@Aegion_(?:DOMAIN|GWS|OKTA|JAMF|FLEET|SLACK|LINEAR|GITHUB|MS|JIRA)(?:_[A-Z0-9_]+)?\]$/;
function defaultOrgTokens(file = path.join(__dirname, '..', '..', 'modules', 'security', 'placeholder-dictionary.md')) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('## Org tokens');
  const end = text.indexOf('\n## ', start + 1);
  const table = text.slice(start, end < 0 ? undefined : end);
  const tokens = [...new Set([...table.matchAll(/^\|[^|]*\|/gm)].flatMap((row) => row[0].match(/\[@Aegion(?:_[A-Z0-9_]+)?\]/g) || []))];
  return tokens.filter((tok) => !CONNECTION_TOKEN.test(tok));
}
const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// one pattern for the answer and the profile (code review 3, finding 11)
const DEFAULT_ORG_TOKENS = new RegExp(defaultOrgTokens().map(escapeRe).join('|'));

// The default environment of CLAUDE.md, fact by fact: how an answer names it and how a customer
// profile would say it is theirs. A customer profile replaces that block, so an answer that names one
// of these for a customer whose profile does not have it is using the wrong organization's facts.
// shortcut: a word list for the facts that block names, so a new fact there needs a line here.
const DEFAULT_FACTS = Object.freeze([
  { fact: 'hybrid Active Directory synced by Entra Connect', answer: /\bhybrid (?:AD|Active Directory|identity)\b|\b(?:Entra|AD|Azure AD) Connect\b|Start-ADSyncSyncCycle/i, profile: /\bhybrid\b|\bEntra Connect\b|\bAD Connect\b/i },
  { fact: 'SMS as the MFA fallback', answer: /\bSMS[ \t]+fallback\b|\bfall[ -]?back[ \t]+(?:to|on)[ \t]+SMS\b/i, profile: /\bSMS\b/i },
  { fact: 'a Cisco Meraki network', answer: /\bMeraki\b/i, profile: /\bMeraki\b/i },
  { fact: 'Microsoft 365 Business Premium licensing', answer: /\bBusiness Premium\b/i, profile: /\bBusiness Premium\b/i },
  { fact: 'Microsoft Intune', answer: /\bIntune\b/i, profile: /\bIntune\b/i },
  { fact: 'Jira Service Management', answer: /\bJira Service Management\b|\[@Aegion_JIRA_(?:SPACE|URL)\]/i, profile: /\bJira\b/i },
  { fact: 'the DT- and LT- device names', answer: /\b(?:DT|LT)-(?:First|\[)/, profile: /\b(?:DT|LT)-/ },
  { fact: 'the default organization\'s own sites, vendors and servers', answer: new RegExp(`${DEFAULT_ORG_TOKENS.source}|\\bAD Connect server\\b|\\bthird tower\\b`), profile: DEFAULT_ORG_TOKENS },
]);
// A mention counts only when no negation opens its own clause ("No SMS fallback added" names the fact to say
// it is not used; batch 8's T1, batch 9). A clause ends at . ; : ! ? , or a line end.
function usesFact(text, re) {
  const t = String(text);
  for (const m of t.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))) {
    const start = Math.max(...[...'.;:!?,\n'].map((c) => t.lastIndexOf(c, m.index - 1))) + 1;
    if (!NEGATION.test(t.slice(start, m.index))) return true;
  }
  return false;
}
function defaultFactsIn(text, profile) {
  return DEFAULT_FACTS.filter((f) => usesFact(text, f.answer) && !f.profile.test(String(profile || ''))).map((f) => f.fact);
}

// The message to the user now (batch 9, task 2) says what happens next. It never says a change is done, never
// announces an action that needs sign-off as decided, and never promises a time the tech does not control.
// shortcut: phrase lists, so a claim worded otherwise passes; the page shows the message for a person to read.
// A phrase in a clause that opens with "once", "when", "after", "until", "if" or "as soon as" is a plan, not
// a claim ("once it has been approved"). An unconfirmed cause is in the rule but not in this check.
const DONE_CLAIMS = [
  /\byou now have\b/i,
  /\byou(?:'re| are) (?:now |all )?back (?:in|on)\b/i,
  /\b(?:is|are|'s|'re) (?:now |all )?(?:fixed|resolved|sorted|unlocked|restored|working again|back up)\b/i,
  // the participles that name a change, so "has been received" or "has been escalated" stays an acknowledgement
  // (code review round 1 of batch 9, finding 6)
  /\b(?:has|have) (?:now |already |just )?been (?:reset|released|removed|deleted|wiped|erased|disabled|enabled|unlocked|locked|restored|granted|added|given|fixed|changed|revoked|resolved|blocked|unblocked|suspended|unsuspended|moved|created|turned (?:on|off)|set up|done|undone|sorted)\b/i,
  /\b(?:we|I|IT|Aegis)(?:'ve| have| has)? (?:just |now |already )?(?:locked|unlocked|reset|released|removed|deleted|wiped|erased|disabled|enabled|suspended|unsuspended|restored|granted|added|given|fixed|changed|blocked|unblocked|revoked|moved|created|signed you out|turned (?:on|off)|set up)\b/i,
];
const DECIDED_ACTION = /\b(?:we|I|IT)(?:'ll| will| are going to| is going to|'re going to|'m going to) (?:now |then |also |first |just )?(?:lock|wipe|erase|reset|disable|delete|remove|suspend|block|revoke|re-?register|sign you out)\b/i;
const CLOCKS = [
  /\bwithin (?:the |an? |\d+ |a few |the next |the next \d+ )?(?:hours?|minutes?|days?)\b/i,
  /\b(?:before|by) \d{1,2}(?::\d{2})?(?: ?[ap]\.?m\.?)?(?![\d:])/i,
  /\b(?:today|tonight|tomorrow|this (?:morning|afternoon|evening)|(?:by )?end of (?:the )?day|by noon)\b/i,
  /\b(?:before|by|on) (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bin (?:\d+|a few|an?) (?:minutes?|hours?)\b/i,
];
const PLAN_CLAUSE = /\b(?:once|when|after|until|if|as soon as)\b/i;
const squashed = (t) => String(t).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ');
function userMessageProblems(message, ticket = '') {
  const text = squashed(message);
  const found = [];
  for (const sentence of sentences(text)) {
    for (const clause of sentence.split(/[;,:]|\s-\s/)) {
      if (PLAN_CLAUSE.test(clause)) continue;
      for (const re of DONE_CLAIMS) { const m = re.exec(clause); if (m) found.push(`says a change is done ("${m[0].trim()}")`); }
      const d = DECIDED_ACTION.exec(clause);
      if (d) found.push(`announces a change that needs sign-off as decided ("${d[0].trim()}")`);
    }
  }
  const theirs = squashed(ticket);
  for (const re of CLOCKS) {
    const m = re.exec(text);
    if (m && !theirs.includes(m[0].trim())) found.push(`promises a time the ticket did not set ("${m[0].trim()}")`);
  }
  return [...new Set(found)];
}

// The six answer checks the desk adds at step 5 (batch 8, task 8; batch 9, task 2), in page order. Each is
// { check, verdict: 'pass'|'fail', plain, detail }. The aegis-desk block is the only place a command may sit.
// ticket: the ticket's text, so a time the user set is not read as a promise.
function answerChecks(answer, { profile = '', ticket = '' } = {}) {
  const card = fixCard(answer);
  const block = deskBlock(answer);
  const shape = cardProblems(card);
  const command = commandIn(block.body);
  const facts = defaultFactsIn(block.body, profile);
  const now = card.present && card.parts.tellNow !== undefined ? userMessageProblems(card.parts.tellNow, ticket) : null;
  const row = (check, ok, plain, detail) => ({ check, verdict: ok ? 'pass' : 'fail', plain, detail });
  return [
    row('fix-card-first', card.present && card.first, 'The Fix card comes first', card.present ? (card.first ? 'the answer opens with "## Fix"' : 'the card is not the first thing in the answer') : 'there is no "## Fix" card'),
    row('fix-card-parts', card.present && shape.length === 0, 'The Fix card has its five parts in order', shape.length ? shape.join('; ') : 'what is wrong, do this (3 to 5 steps), done when, stop if, tell the user'),
    row('fix-card-words', card.present && card.words <= 150, 'The Fix card is 150 words or fewer', card.present ? `${card.words} words${card.pointer ? ', not counting the line that points to Details' : ''}` : 'there is no "## Fix" card'),
    row('no-command', command === null, 'The answer asks the tech to run no command', command ? `a command outside the aegis-desk block: ${command}` : 'none outside the aegis-desk block'),
    row('customer-facts', facts.length === 0, "The answer uses only this customer's facts", facts.length ? `names ${facts.join('; ')}, which the customer profile does not have` : 'no default-environment fact the profile lacks'),
    row('user-message-now', now !== null && now.length === 0, 'The message to the user now makes no done claim', now === null ? 'there is no "Tell the user now" line' : (now.length ? `"${card.parts.tellNow}": ${now.join('; ')}` : 'it says what happens next, with no done claim and no time the tech does not control')),
  ];
}

// Change words: a step that holds one asks the tech to change something, not only to look.
// shortcut: a word list, so a change worded otherwise reads as a look; INVESTIGATE also needs the
// answer to close with Gate: none, so such a miss can only turn an OPEN into an INVESTIGATE.
const CHANGE_STEMS = ['reset', 'delete', 'remove', 'release', 'grant', 'assign', 'unassign', 'suspend', 'unsuspend', 'disable', 'enable', 'revoke', 'wipe', 'erase', 'lock', 'unlock', 'add', 'create', 'change', 'update', 'move', 'transfer', 'deactivate', 'reactivate', 'activate', 'approve', 'restart', 'reboot', 'install', 'uninstall', 'rotate', 'purge', 'exclude', 'whitelist', 'unblock', 'edit', 'modify', 'restore', 're-register', 'reregister', 'register', 'replace', 'migrate', 'rename'];
const forms = (s) => [s, `${s}s`, `${s}ed`, `${s}d`, `${s}ing`, ...(s.endsWith('e') ? [`${s.slice(0, -1)}ing`] : [])];
const CHANGE_WORD = new RegExp(`(?<![A-Za-z-])(?:${[...new Set(CHANGE_STEMS.flatMap(forms))].sort((a, b) => b.length - a.length).join('|')}|turn(?:s|ed|ing)? (?:on|off))(?![A-Za-z-])`, 'i');

// The steps an answer gives: the card's "Do this" steps, or, with no card, every numbered line.
function answerSteps(raw) {
  const answer = plainText(raw);
  const card = fixCard(answer);
  if (card.present && card.steps.length) return card.steps;
  return deskBlock(answer).body.split(/\r?\n/).map((l) => ANY_STEP.exec(l)).filter(Boolean).map((m) => m[2].replace(/\*\*$/, '').trim());
}

// A change word asks for a change unless a negation opens its own clause ("Don't release anything yet",
// "do not unlock the account yet"); a negation in another clause hides nothing ("Don't wait, reset the
// password") (batch 9, task 9). Returns the first change word that counts, or null.
const NEGATION = /\b(?:don['\u2019]?t|do not|never|no|not|won['\u2019]?t|without)\b/i;
function changeIn(text) {
  const t = String(text);
  for (const m of t.matchAll(new RegExp(CHANGE_WORD.source, 'gi'))) {
    const clause = t.slice(Math.max(...[...'.;:!?,'].map((c) => t.lastIndexOf(c, m.index - 1)), t.lastIndexOf(' - ', m.index - 1)) + 1, m.index);
    if (!NEGATION.test(clause)) return m[0];
  }
  return null;
}

// The step half of the INVESTIGATE rule: at least one step, and no change word where a change could be
// asked. With a Fix card: in every card line but those of the parts that only describe or speak
// (MENTION_PARTS: the two messages to the user speak to the customer, "We'll update you within the hour"); a Details line mentions a change, it does
// not ask for one, so Details is not read (batch 9, task 9). With no card (an answer in the older format): in
// every numbered line, in any form. shortcut: an older-format answer's prose and bullets are not read, since a
// look-first answer of that form says "don't release" or "don't delete it" in them (full run 1's T5); such an
// answer can only gain a label, never a change, since INVESTIGATE approves and applies nothing.
// The card parts that describe or speak, and ask nothing of the tech: what is wrong ("the account is locked"),
// the signal to stop at ("a rule is moving the invoices") and the two user messages. Batch 8's T5 card held
// "moving" in its Stop if line (batch 9, task 9).
const MENTION_PARTS = Object.freeze(['wrong', 'stopIf', ...USER_PARTS]);
function onlyLooks(raw) {
  const answer = plainText(raw);
  const steps = answerSteps(answer);
  const card = fixCard(answer);
  const body = deskBlock(answer).body.split(/\r?\n/);
  const scan = card.present
    ? [...steps, card.parts.doThis || '', ...card.lines.filter((l) => !MENTION_PARTS.includes(l.part)).map((l) => l.text)]
    : [...steps, ...body.filter((l) => ANY_STEP.test(l))];
  let change = null;
  for (const x of scan) { change = changeIn(x); if (change) break; }
  return { steps, looks: steps.length > 0 && change === null, change };
}

module.exports = { defaultOrgTokens, PARTS, USER_PARTS, userMessageProblems, changeIn, deskBlock, fixCard, cardProblems, commandIn, deskOnlyIn, DEFAULT_FACTS, defaultFactsIn, answerChecks, answerSteps, onlyLooks, words, sentences, CHANGE_WORD };
