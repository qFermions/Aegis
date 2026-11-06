'use strict';
// answer.js: reads an Aegis answer the way a tech meets it (batch 8). An answer starts with a "## Fix"
// card (docs/aegis/answer-format.md), may go on under "## Details", and closes with one fenced block
// labeled aegis-desk that holds what only the desk needs (Gate lines, gate ids, change records,
// confirmation phrases). Pure: text in, values out. Nothing here decides a closing state on its own;
// the desk's five answer checks read these values and show on the page, and none of them stops a ticket.

const CARD_HEADING = /^##[ \t]+Fix[ \t]*$/;
const NEXT_SECTION = /^#{1,2}[ \t]+\S/;
// The five parts, in their order. A part is a line that starts with its label, bold or not.
const PARTS = Object.freeze([
  { key: 'wrong', label: "What's wrong" },
  { key: 'doThis', label: 'Do this' },
  { key: 'doneWhen', label: 'Done when' },
  { key: 'stopIf', label: 'Stop if' },
  { key: 'tellUser', label: 'Tell the user' },
]);
const labelRe = (label) => new RegExp(`^[\\s>*_-]*(?:\\*\\*)?${label.replace(/'/g, "['’]")}(?:\\*\\*)?[ \\t]*:[ \\t]*(?:\\*\\*)?[ \\t]*(.*)$`, 'i');
const STEP = /^[ \t]*(?:\*\*)?(\d+)[.)][ \t]+(.+)$/;
const DESK_FENCE = /^[ \t]*```[ \t]*aegis-desk[ \t]*$/;
const FENCE_END = /^[ \t]*```[ \t]*$/;

// Words a reader reads: markdown marks, list numbers and arrows are not words.
const words = (text) => String(text).replace(/[*_`#>]/g, ' ').split(/\s+/).filter((w) => w && !/^\d+[.)]$/.test(w) && !/^[-|:\u2192]+$/.test(w)).length;
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
  if (at < 0) return { present: false, first: false, text: '', parts: {}, order: [], steps: [], words: 0 };
  const firstLine = lines.findIndex((l) => l.trim() !== '');
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i += 1) if (NEXT_SECTION.test(lines[i])) { end = i; break; }
  const own = lines.slice(at + 1, end);
  const parts = {};
  const order = [];
  const steps = [];
  let current = null;
  for (const line of own) {
    const found = PARTS.find((p) => labelRe(p.label).test(line));
    if (found) {
      current = found.key;
      if (!order.includes(found.key)) order.push(found.key);
      parts[found.key] = labelRe(found.label).exec(line)[1].trim();
      continue;
    }
    const step = STEP.exec(line);
    if (current === 'doThis' && step) { steps.push(step[2].replace(/\*\*$/, '').trim()); continue; }
    // a part runs on over its wrapped lines and ends at a blank line; what follows it (such as the line
    // that points to Details) belongs to the card but to no part
    if (line.trim() === '') { current = null; continue; }
    if (current) parts[current] = `${parts[current] ? `${parts[current]} ` : ''}${line.trim()}`;
  }
  const text = own.join('\n').trim();
  return { present: true, first: at === firstLine, text, parts, order, steps, words: words(text) };
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
  if (card.parts.tellUser && sentences(card.parts.tellUser).length > 3) problems.push(`"Tell the user" has ${sentences(card.parts.tellUser).length} sentences, more than 3`);
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
  { fact: 'Jira Service Management', answer: /\bJira Service Management\b|\[@Aegion_JIRA_SPACE\]/i, profile: /\bJira\b/i },
  { fact: 'the DT- and LT- device names', answer: /\b(?:DT|LT)-(?:First|\[)/, profile: /\b(?:DT|LT)-/ },
  { fact: 'the default organization\'s own sites, vendors and servers', answer: /\[@Aegion(?:_(?!DOMAIN\])[A-Z0-9_]+)?\]|\bAD Connect server\b|\bthird tower\b/, profile: /\[@Aegion(?:_(?!DOMAIN\])[A-Z0-9_]+)?\]/ },
]);
function defaultFactsIn(text, profile) {
  return DEFAULT_FACTS.filter((f) => f.answer.test(String(text)) && !f.profile.test(String(profile || ''))).map((f) => f.fact);
}

// The five answer checks the desk adds at step 5 (batch 8, task 8), in page order. Each is
// { check, verdict: 'pass'|'fail', plain, detail }. The aegis-desk block is the only place a command may sit.
function answerChecks(answer, { profile = '' } = {}) {
  const card = fixCard(answer);
  const block = deskBlock(answer);
  const shape = cardProblems(card);
  const command = commandIn(block.body);
  const facts = defaultFactsIn(block.body, profile);
  const row = (check, ok, plain, detail) => ({ check, verdict: ok ? 'pass' : 'fail', plain, detail });
  return [
    row('fix-card-first', card.present && card.first, 'The Fix card comes first', card.present ? (card.first ? 'the answer opens with "## Fix"' : 'the card is not the first thing in the answer') : 'there is no "## Fix" card'),
    row('fix-card-parts', card.present && shape.length === 0, 'The Fix card has its five parts in order', shape.length ? shape.join('; ') : 'what is wrong, do this (3 to 5 steps), done when, stop if, tell the user'),
    row('fix-card-words', card.present && card.words <= 150, 'The Fix card is 150 words or fewer', card.present ? `${card.words} words` : 'there is no "## Fix" card'),
    row('no-command', command === null, 'The answer asks the tech to run no command', command ? `a command outside the aegis-desk block: ${command}` : 'none outside the aegis-desk block'),
    row('customer-facts', facts.length === 0, "The answer uses only this customer's facts", facts.length ? `names ${facts.join('; ')}, which the customer profile does not have` : 'no default-environment fact the profile lacks'),
  ];
}

// Change words: a step that holds one asks the tech to change something, not only to look.
// shortcut: a word list, so a change worded otherwise reads as a look; INVESTIGATE also needs the
// answer to close with Gate: none, so such a miss can only turn an OPEN into an INVESTIGATE.
const CHANGE_STEMS = ['reset', 'delete', 'remove', 'release', 'grant', 'assign', 'unassign', 'suspend', 'unsuspend', 'disable', 'enable', 'revoke', 'wipe', 'erase', 'lock', 'unlock', 'add', 'create', 'change', 'update', 'move', 'transfer', 'deactivate', 'reactivate', 'activate', 'approve', 'restart', 'reboot', 'install', 'uninstall', 'rotate', 'purge', 'exclude', 'whitelist', 'unblock', 'edit', 'modify', 'restore', 're-register', 'reregister', 'register', 'replace', 'migrate', 'rename'];
const forms = (s) => [s, `${s}s`, `${s}ed`, `${s}d`, `${s}ing`, ...(s.endsWith('e') ? [`${s.slice(0, -1)}ing`] : [])];
const CHANGE_WORD = new RegExp(`(?<![A-Za-z-])(?:${[...new Set(CHANGE_STEMS.flatMap(forms))].sort((a, b) => b.length - a.length).join('|')}|turn(?:s|ed|ing)? (?:on|off))(?![A-Za-z-])`, 'i');

// The steps an answer gives: the card's "Do this" steps, or, with no card, every numbered line.
function answerSteps(answer) {
  const card = fixCard(answer);
  if (card.present && card.steps.length) return card.steps;
  return deskBlock(answer).body.split(/\r?\n/).map((l) => STEP.exec(l)).filter(Boolean).map((m) => m[2].replace(/\*\*$/, '').trim());
}

// The step half of the INVESTIGATE rule: at least one step, and no step holds a change word.
function onlyLooks(answer) {
  const steps = answerSteps(answer);
  const change = steps.find((s) => CHANGE_WORD.test(s)) || null;
  return { steps, looks: steps.length > 0 && change === null, change };
}

module.exports = { PARTS, deskBlock, fixCard, cardProblems, commandIn, deskOnlyIn, DEFAULT_FACTS, defaultFactsIn, answerChecks, answerSteps, onlyLooks, words, sentences, CHANGE_WORD };
