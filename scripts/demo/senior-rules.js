'use strict';
// senior-rules.js: the answer rules of batch 11 as rows the desk shows (docs/aegis/answer-format.md):
//   assumed-setup            the "Assumed setup:" line and the admin paths against the setup that was given (section 1)
//   ask-first                a ticket with nothing to go on gets one question and nothing else (section 7)
//   new-way-in-first         a lost or replaced sign-in device: a new way in before the old way out (section 2)
//   who-else-what-left       access someone should not have had: close the path, then read the audit log (section 2)
//   how-wide-before-why      a service that is down: the scope and the status page first, the network before the account
//   change-class-and-check   a plan with several changes: each change with its class and its double-check in Details
// and the form check of the reply to the person who asked (section 8). Text in, rows out: { check, verdict, plain,
// detail, applies }. Like the other answer rows (scripts/demo/answer.js), none of them stops a ticket, and a row
// that does not apply to a ticket is left off the page.
// shortcut: every reading here is a word list or a shape, so a ticket or an answer worded otherwise reads as "does
// not apply" or passes; upgrade to a model-judged row when the owner's unseen cases show a miss the lists cannot hold.

const { fixCard, deskBlock, words, sentences, userMessageProblems, stepChange, deskOnlyIn } = require('./answer.js');
const { namedGates, asks } = require('./catalog.js');
const checks = require('../eval/judged/checks.js');

const row = (check, plain, ok, detail, applies = true) => ({ check, verdict: ok ? 'pass' : 'fail', plain, detail, applies });

// ── The assumed setup line (task 2) ─────────────────────────────────────────────────────────────
// The four platforms whose admin paths the row knows: how a ticket or a setup names one, and how an answer walks
// into its admin console. shortcut: four platforms; a path into another console (Slack, GitHub) is not read.
const TEAMS = /\bTeams\b|^\s*teams\b|\bteams (?:app|call|calls|meeting|meetings|chat|channel|is|isn't|not|won't|keeps|says)\b/;
const FAMILIES = Object.freeze([
  {
    name: 'Microsoft',
    names: (t) => /\b(?:Microsoft|M365|Office 365|O365|Entra|Azure|Intune|SharePoint|OneDrive|Outlook|Active Directory)\b/i.test(t) || /\bExchange (?:Online|admin|mailbox|server)\b/i.test(t) || /\bDefender\b/.test(t) || TEAMS.test(t),
    path: /\b(?:Entra|Microsoft 365|Exchange|Intune|Teams|SharePoint|Purview|Defender|Azure)(?: ID)? admin cent(?:er|re)\b|\b(?:Microsoft Purview|Purview|Azure|Defender|Entra) portal\b|\b(?:admin|entra|intune|portal|security|compliance|endpoint|purview)\.(?:microsoft|azure|office)\.com\b|\bEntra(?: ID)?\s*(?:→|->|>)/i,
  },
  { name: 'Google', names: (t) => /\b(?:Google|Gmail|G Suite|Chromebooks?|ChromeOS)\b/i.test(t), path: /\bGoogle Admin console\b|\badmin\.google\.com\b|(?<!Okta )\bAdmin console\s*(?:→|->|>)/i },
  { name: 'Okta', names: (t) => /\bOkta\b/i.test(t), path: /\bOkta Admin Console\b|\b[a-z0-9-]+-admin\.okta\.com\b|\bOkta admin\s*(?:→|->|>)/i },
  { name: 'Jamf', names: (t) => /\bJamf\b/i.test(t), path: /\bJamf Pro\s*(?:→|->|>)|\bJamf Pro (?:console|dashboard)\b/i },
]);
// Other products a ticket can name; with one of these the ticket names its system too.
const OTHER_SYSTEMS = /\b(?:Slack|GitHub|Linear|Fleet|Zoom|Jira|Meraki|Salesforce|Dropbox|1Password|Duo|Kandji|Zendesk|Notion|Asana|Workday|QuickBooks|Xero|HubSpot|Adobe|AWS|Citrix|Cisco|RingCentral|Webex)\b/i;
const namesSystem = (ticket) => FAMILIES.some((f) => f.names(String(ticket))) || OTHER_SYSTEMS.test(String(ticket));
const NO_PROFILE = /\bno (?:company |customer )?(?:profile|setup)(?: was)? given\b/i;
// What a setup (or an Assumed setup line) says the company runs: its text with each negated list of systems taken out,
// so a system named only to say it is absent is not listed (code review 1, finding 4; code review 2, findings 1, 2, 3
// and 8). A negation word ("no", "not" but not "not-for-profit", "without", "never", "neither", "nor", "lacks",
// "don't use", "no longer use", "dropped") takes out the rest of its clause up to "but" or a full stop, only when a
// system is named in its first few words: "No Microsoft 365 or Active Directory" goes, "not local admins on
// Intune-managed laptops" stays. A clause such as "Microsoft 365 is not used" goes whole.
const NEG_LEAD = /\b(?:no|not(?!-)|without|never|neither|nor|lacks|lacking|(?:do|does|did)(?:n't| not)(?: (?:use|run|have))?|no longer (?:use|run|have)|dropped|got rid of)\b([^.;:!?\n]*?)(?=\sbut\b|[.;:!?\n]|$)/gi;
const POST_NEG = /[^.;:!?\n,]*\b(?:is|are|was|were)(?: not|n't)(?: \w+)? (?:used|in use|run|deployed|licensed)\b[^.;:!?\n]*/gi;
const FILLER = /^(?:use|uses|using|run|runs|have|the|any|a|an)$/i;
const affirmed = (text) => String(text).replace(POST_NEG, ' ').replace(NEG_LEAD, (whole, rest) => {
  const head = rest.trim().split(/\s+/).filter((w) => !FILLER.test(w)).slice(0, 3).join(' ');
  return FAMILIES.some((fam) => fam.names(head)) ? ' ' : whole;
});
const NOT_LISTED = /\b(?:does not|doesn't|did not) (?:list|name|include|have)\b|\bnot (?:listed|in the setup|in the profile)\b|\blacks\b|\bmissing\b/i;

// The row "the answer says which setup it assumed". setup: the profile or setup text given with the ticket, or
// null or '' when none was; ticket: the ticket's text.
function assumedSetup(answer, { setup = null, ticket = '' } = {}) {
  const plain = 'The answer says which company setup it assumed, and stays inside a setup that was given';
  const card = fixCard(answer);
  const line = card.assumed;
  const given = typeof setup === 'string' && setup.trim() !== '';
  if (!given) {
    if (namesSystem(ticket)) return row('assumed-setup', plain, true, 'no setup was given, and the ticket names its system');
    if (!line) return row('assumed-setup', plain, false, 'no setup was given and the ticket names no system, so the first line under "## Fix" must be "Assumed setup: <systems> (no company profile given)."');
    const systems = line.replace(/^Assumed setup:/i, '').replace(/\(.*$/, '').trim();
    if (!/[A-Za-z]{2,}/.test(systems)) return row('assumed-setup', plain, false, 'the Assumed setup line names no system');
    if (!NO_PROFILE.test(line)) return row('assumed-setup', plain, false, 'the Assumed setup line does not say "(no company profile given)"');
    return row('assumed-setup', plain, true, `"${line}"`);
  }
  if (line && NO_PROFILE.test(line)) return row('assumed-setup', plain, false, 'the Assumed setup line says no company profile was given, but a setup was given with this ticket');
  const listed = (f) => f.names(affirmed(setup));
  // the system the ticket is about, when the setup that was given does not list it
  const lacking = FAMILIES.filter((f) => f.names(String(ticket)) && !listed(f));
  const unsaid = lacking.filter((f) => !(line && f.names(line) && NOT_LISTED.test(line)));
  if (unsaid.length) return row('assumed-setup', plain, false, `the ticket is about ${unsaid.map((f) => f.name).join(' and ')}, which the setup given does not list; the Assumed setup line must say which system is missing`);
  const body = deskBlock(answer).body;
  // a line that names the system to say it is absent does not excuse its path (code review 2, finding 3)
  const foreign = FAMILIES.filter((f) => !listed(f) && f.path.test(body) && !(line && f.names(affirmed(line))));
  if (foreign.length) return row('assumed-setup', plain, false, `gives ${foreign.map((f) => `a ${f.name} admin path`).join(' and ')}, a system the setup given does not list`);
  return row('assumed-setup', plain, true, line ? `"${line}"` : 'it uses the setup that was given');
}

// ── Ask first (task 4) ──────────────────────────────────────────────────────────────────────────
// A ticket has nothing to go on when it gives no symptom, no error text, no who and no since-when, or when it
// does not say what the thing is. "Broken", "not working", "a problem" and "acting up" say that something is
// wrong, not what happens, so they are no symptom.
const SINCE_WHEN = /\b(?:since|after|before|when|whenever|every time|each time|yesterday|today|tonight|this (?:morning|afternoon|evening|week|month)|last (?:night|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|ago|\d{1,2}(?::\d{2})?\s?(?:am|pm)|(?:mon|tues|wednes|thurs|fri|satur|sun)day|for (?:an?|\d+|two|three|several|a few|some) (?:minute|hour|day|week|month)s?|all (?:day|morning|week)|every (?:\w+ )?(?:minute|hour|day|morning|week)s?)\b/i;
const WHO = /\b(?:I|I'm|I've|me|my|mine|we|we're|our|us|he|she|they|his|her|their|everyone|everybody|nobody|no one|anyone|someone|somebody|all (?:staff|users|of us)|the (?:whole|entire) (?:team|office|floor|company|site|department)|(?:two|three|four|five|\d+|several|some|a few|many|most|both) (?:\w+ )?(?:users|people|staff|of us|colleagues|employees)|team|department|staff|users?|colleagues?|manager|boss|director|reception|front desk|callers?|customers?|clients?)\b|\[[A-Z][A-Z0-9_@.]*\]/i;
const ERROR_TEXT = /(?:^|\s)["'“‘][^"”\n]{4,}?["'”’](?=\s|[.,;:!?]|$)|\b(?:error|code|message|says|shows|showing|displays|warning|popup|pop-up|prompts?)\b|\b0x[0-9a-f]{3,}\b|\b[A-Z]{2,}\d{3,}\b|\b\d{3,}\b/i;
const SYMPTOM = /\b(?:can(?:'t|not| not)|could(?:n't| not)|won't|will not|unable|fail(?:s|ed|ing)?|keeps?|stuck|slow|blank|frozen|freez\w+|crash\w*|hang(?:s|ing)?|loop\w*|denied|locked(?: out)?|blocked|bounc\w+|missing|gone|disappear\w*|vanish\w*|drops?|dropping|disconnect\w*|offline|down|unreachable|timeout|times? out|timed out|no (?:sound|audio|video|signal|dial tone|internet|connection|access|power)|black screen|blue screen|not (?:loading|syncing|printing|sending|receiving|connecting|charging|ringing|turning on|opening|starting|showing|responding|updating)|doesn't (?:print|send|sync|load|open|start|connect|charge|ring|turn on|show|respond|update)|asks? for|asking for|spinning|garbled|jam\w*|beep\w*|overheat\w*|the wrong \w+|wrong (?:folder|password|printer|time|date|address|number|person|account|name)|expired|rejected|quarantin\w+|shuts? down|restart\w*|reboot\w*|busy tone|echo|lag\w*|delay\w*|duplicate\w*|stopped \w+ing)\b/i;
const BARE_MAX_WORDS = 25;
// A ticket that does not say what the thing is ("It stopped working again this morning."): its subject is a bare
// pronoun, and it names no system and quotes no error. It has nothing to go on whatever else it says.
const NO_THING = /^[\s"'(]*(?:it|this|that|these|those|something|everything|nothing|stuff)(?:'s)?\s+(?!(?:printer|laptop|phone|computer|pc|mac|app|site|page|system|email|mailbox|account|file|folder|link|screen|monitor|keyboard|mouse|scanner|router|wifi|wi-fi|network|vpn|server|drive|tablet|headset|camera|meeting|calendar)\b)/i;
function bareTicket(ticket) {
  const t = String(ticket || '').replace(/[‘’]/g, "'");
  if (words(t) > BARE_MAX_WORDS) return false;
  if (NO_THING.test(t) && !namesSystem(t) && !ERROR_TEXT.test(t)) return true;
  return !SINCE_WHEN.test(t) && !WHO.test(t) && !ERROR_TEXT.test(t) && !SYMPTOM.test(t);
}

const NUMBERED = /^[ \t>]*(?:[-*+][ \t]+)?(?:\*\*)?\(?\d+[.)]/;
const BULLET = /^[ \t>]*[-*+•][ \t]+\S/;
// A sentence that advises: a change verb by the desk's own reader, or a way into an admin console, read with the same
// PORTAL_PATH the reply check uses (code review 1, finding 1: "In the admin center, require ..." holds no verb the
// reader knows, but it walks into a console; code review 2, finding 15: the shared readers, and no bare "portal").
const advises = (sentence) => Boolean(stepChange(sentence)) || PORTAL_PATH.test(sentence) || FAMILIES.some((f) => f.path.test(sentence));
// The sentences of a text that are not questions, by the desk's own sentence reader.
const statements = (text) => sentences(text).filter((s) => !s.trim().endsWith('?'));
const ASK_FIRST_MAX_WORDS = 60;
// An answer that asks and holds no Fix card and no gate: a question of its own (not the ticket's question repeated,
// not a quoted or fenced line: the desk's own question reader).
const asksWithNoCard = (answer, ticket) => !fixCard(answer).present && namedGates(answer).length === 0 && asks(answer, ticket);
// An ask-first answer, which the desk closes CLARIFY: it asks, with no card, no gate, no numbered or bulleted step and
// no sentence that advises. Advice with a stray question ("1. Reset it. Did that help?", the same as bullets or as
// prose) is not one: it stays OPEN, as batch 8 decided.
function isAskFirst(answer, ticket = '') {
  if (!asksWithNoCard(answer, ticket)) return false;
  const body = deskBlock(answer).body;
  return !body.split(/\r?\n/).some((l) => NUMBERED.test(l) || BULLET.test(l)) && !statements(body).some(advises);
}
// What is wrong with the form of an ask-first answer: it is one question and nothing else. The aegis-desk block the
// desk asks every session for is not part of the question, so it is not read here.
function askFirstProblems(answer) {
  const body = deskBlock(answer).body;
  const lines = body.split(/\r?\n/);
  const out = [];
  const marks = (body.match(/\?/g) || []).length;
  if (marks !== 1) out.push(`${marks} question marks, not one`);
  const steps = lines.filter((l) => NUMBERED.test(l)).length;
  if (steps) out.push(`it has ${steps} numbered step${steps === 1 ? '' : 's'}`);
  // read as isAskFirst reads them (code review 2, finding 4): bulleted lines and sentences that advise are not a question
  const bullets = lines.filter((l) => BULLET.test(l)).length;
  if (bullets) out.push(`it has ${bullets} bulleted line${bullets === 1 ? '' : 's'}`);
  const advice = statements(body).filter(advises);
  if (advice.length) out.push(`it advises before it asks ("${advice[0].slice(0, 60)}")`);
  if (lines.some((l) => /^[ \t]*#{1,6}[ \t]+\S/.test(l))) out.push('it has a heading');
  const n = words(body);
  if (n > ASK_FIRST_MAX_WORDS) out.push(`${n} words, more than ${ASK_FIRST_MAX_WORDS}`);
  return out;
}

// The row "a ticket with nothing to go on gets one question and nothing else; every other ticket gets a Fix card".
function askFirst(answer, { ticket = '' } = {}) {
  const plain = 'A ticket with nothing to go on gets one question first; any other ticket gets a Fix card';
  const bare = bareTicket(ticket);
  if (asksWithNoCard(answer, ticket)) {
    if (!bare) return row('ask-first', plain, false, 'the ticket gives a symptom, an error, a who or a since-when, so it gets a Fix card (Rule 8), not a lone question');
    const problems = askFirstProblems(answer);
    return row('ask-first', plain, problems.length === 0, problems.length ? problems.join('; ') : `one question and nothing else, ${words(deskBlock(answer).body)} words`);
  }
  if (bare) return row('ask-first', plain, false, 'the ticket gives nothing to go on (no symptom, no error text, no who and no since-when, or no word for what the thing is), so the answer is one question and nothing else');
  return row('ask-first', plain, true, 'the ticket gives something to go on, and the answer is not a lone question');
}

// ── a. A new way in before the old way out (task 5a) ────────────────────────────────────────────
const DEVICE = '(?:phones?|iphone|android|mobile|cell(?:phone)?|device|handset|tablet|ipad|yubikey|security key|hardware key|token|fob)';
const LOST = '(?:lost|stolen|broke|broken|smashed|snapped|swapped|cracked|dropped|drowned|died|dead|wiped|reset|traded(?:[- ]in)?|replaced|replacement|upgraded|new|old|switched|change|changed|sold|returned|left)';
const LOST_DEVICE = new RegExp(`\\b${LOST}\\b[^.!?\\n]{0,40}\\b${DEVICE}\\b|\\b${DEVICE}\\b[^.!?\\n]{0,60}\\b${LOST}\\b`, 'i');
// The ticket names the sign-in method the device held, not only that the person cannot sign in: "I left my phone at
// home and cannot sign in" is not a lost sign-in device (code review 1, finding 6).
const SIGN_IN = /\b(?:authenticator|mfa|2fa|two[- ]factor|two[- ]step|2[- ]step|2sv|second step|verification (?:code|app)|okta verify|duo|passkeys?|security keys?|yubikeys?|(?:backup|sign[- ]?in|log[- ]?in|login|verification|one[- ]time) codes?)\b/i;
const lostSignInDevice = (ticket) => SIGN_IN.test(String(ticket)) && LOST_DEVICE.test(String(ticket));

const IDENTITY = /\bidentity\b|\bwho (?:they|she|he|the (?:person|user|caller)) (?:is|are|says?)\b|\bit(?: is|'s) (?:really )?(?:them|her|him|the (?:person|user|requester)|\[[A-Z_]+\])|\b(?:verify|confirm|prove|check)\b[^.\n]{0,30}\b(?:requester|caller|identity)\b/i;
const IDENTITY_METHOD = /\bcall(?:s|ed|ing)?\b[^.\n]{0,40}\bback\b|\bcallback\b|\bnumber (?:on file|on record|in the)\b|\bstaff list\b|\bhr record\b|\bvideo call\b|\bin person\b|\bface to face\b|\bmanager\b|\bphoto id\b|\bbadge\b/i;
const TEMP_WAY_IN = /\btemporary access (?:pass|code)s?\b|\bbackup (?:verification )?codes?\b|\bone[- ]time (?:bypass |pass)?codes?\b|\bbypass codes?\b|\brecovery codes?\b|\btemporary (?:pass(?:code|word)?|codes?)\b/i;
const TAP = /\bTAP\b/;
const ADMIN_ROLE = /\b(?:administrator|admin)\b(?! (?:console|cent(?:er|re)|portal)\b)/i;
const REGISTERS_NEW = /\b(?:registers?|sets? up|enrol(?:l)?s?|adds?|installs?)\b[^.\n]{0,80}\b(?:new|replacement)\b|\b(?:new|replacement)\b[^.\n]{0,40}\b(?:registered|set up|enrolled)\b/i;
const REMOVES_OLD = /\b(?:remove|delete|revoke|reset|clear|deactivate|unenroll|un-enroll|turn off|disable)\b[^.\n]{0,80}\b(?:methods?|factors?|authenticator|enrol?lments?|2-step|two-step|2sv|mfa|verification|okta verify|passkeys?|security keys?|phone|device|token)\b/i;
const VERIFIED_CHANNEL = /\bnumber (?:on file|on record)\b|\bstaff list\b|\bin person\b|\bface to face\b|\b(?:through|via|by way of) (?:the|their|her|his) manager\b|\bon (?:that|the) (?:same )?(?:verified |video )?call\b|\bverified (?:channel|call|callback|number)\b|\bknown[- ]good number\b|\bcalls? (?:them|her|him|the (?:user|person)|\[[A-Z_]+\]) back\b/i;
const UNVERIFIED_SEND = /\b(?:by|via|over|in an?|through) (?:text|sms|chat|email|e-mail|slack|teams|whatsapp|im|dm|message|a message)\b|\b(?:text|email|e-mail|slack|message|dm|sms)s? (?:it|the (?:code|pass|link)|them|her|him|one)\b|\bsen[dt]s?\b[^.\n]{0,40}\b(?:slack|teams|chat|text|sms|email|e-mail) message\b|\bemail(?:s|ed)? (?:one|it|the code|a code)\b/i;
const NEW_PRESENT = /\bnew\b[^.\n]{0,80}\b(?:listed|present|registered|shows?|appears?|enrolled|set up|there)\b/i;
const OLD_GONE = /\b(?:old|lost|previous|former|stolen|replaced|traded[- ]in)\b[^.\n]{0,80}\b(?:gone|removed|no longer|not listed|absent|deleted)\b/i;

const firstStep = (steps, test) => steps.findIndex((s, i) => test(s, i));
function newWayInFirst(answer, { ticket = '' } = {}) {
  const plain = 'A lost or replaced sign-in device gets a new way in before the old one is removed';
  if (!lostSignInDevice(ticket)) return row('new-way-in-first', plain, true, 'the ticket is not about a lost or replaced sign-in device', false);
  const card = fixCard(answer);
  if (!card.present || !card.steps.length) return row('new-way-in-first', plain, false, 'there is no Fix card with steps to read');
  const steps = card.steps;
  const issues = (s) => TEMP_WAY_IN.test(s) || TAP.test(s);
  const identity = firstStep(steps, (s) => IDENTITY.test(s) && IDENTITY_METHOD.test(s));
  const way = firstStep(steps, issues);
  const register = firstStep(steps, (s) => REGISTERS_NEW.test(s));
  const removal = firstStep(steps, (s) => REMOVES_OLD.test(s) && !issues(s));
  const out = [];
  if (identity < 0) out.push('no step proves the identity of the person by a method it names');
  if (way < 0) out.push('no step gives a time-limited way in (a temporary pass, backup codes)');
  else {
    if (identity > way) out.push('the identity check comes after the way in is issued');
    if (!ADMIN_ROLE.test(steps[way])) out.push('the step that issues the way in names no admin role');
    // the code, pass or link travels on a verified channel that the step names
    const handover = steps.slice(way, register > way ? register + 1 : way + 1).join(' ');
    if (UNVERIFIED_SEND.test(handover) && !VERIFIED_CHANNEL.test(handover)) out.push('the code, pass or link is sent by text, chat or email with no verified channel');
    else if (!VERIFIED_CHANNEL.test(handover)) out.push('no step names the verified channel the code, pass or link travels on');
  }
  if (register < 0) out.push('no step has the person register the new method');
  if (removal < 0) out.push('no step removes the old method');
  else if ((way >= 0 && removal < way) || (register >= 0 && removal < register) || way < 0 || register < 0) out.push('the old method is removed before the new way in exists');
  const done = card.parts.doneWhen || '';
  if (!NEW_PRESENT.test(done) || !OLD_GONE.test(done)) out.push('"Done when" does not say the new method is present and the old one is gone');
  return row('new-way-in-first', plain, out.length === 0, out.length ? out.join('; ') : 'identity, a time-limited way in on a verified channel, the new method, then the old one removed');
}

// ── b. Who else, and what left (task 5b) ────────────────────────────────────────────────────────
const UNWANTED_ACCESS = /\bshould(?:n't| not| never) (?:have(?!\s+to\b)|be able|see|open|read)\b|\bnot supposed to\b|\bwasn't supposed to\b|\bstill (?:has|have|had|open|opens|see|sees|read|reads|get into|access)\b|\bcould still\b|\bcan still\b|\bunauthori[sz]ed\b|\bby mistake\b|\baccidentally (?:shared|added|gave|granted|sent|invited)\b|\bshared (?:with|to) (?:everyone|anyone|the whole|all staff|the public|external|outside|people outside|the wrong)\b|\banyone (?:with|who has) the link\b|\bpublic(?:ly)? (?:link|shared|accessible|visible)\b|\b(?:former|ex-?) ?(?:employee|contractor|staff|intern|vendor)\b[^.!?\n]{0,60}\b(?:access|open|see|read|log ?in|sign ?in)\b|\bwrong (?:person|people|group|team)\b[^.!?\n]{0,40}\b(?:access|see|open|read)\b|\bno business (?:seeing|reading|having)\b/i;
const CLOSES_PATH = /\b(?:remove|removes|revoke|restrict|unshare|stop sharing|turn off|disable|delete|change|set|block|take)\b[^.\n]{0,80}\b(?:access|link|sharing|share|members?|membership|permissions?|group|guest|invite|restricted)\b/i;
const AUDIT_READ = /\baudit\b|\bactivity (?:log|report)\b|\baccess log\b|\blog events\b|\bfile activity\b|\bsharing activity\b|\baccess history\b|\bsign-in logs?\b|\bsystem log\b/i;
const WHO_ELSE = /\bwho else\b|\bany(?:one|body) else\b|\bother (?:people|users|accounts|person)\b|\beveryone who\b|\bwhich (?:other )?(?:accounts|users|people)\b|\ball (?:the )?(?:accounts|users|people) (?:who|that)\b/i;
const WENT_ONWARD = /\bdownload(?:ed|s)?\b|\bcopied\b|\bexport(?:ed)?\b|\bshared (?:it |them |anything )?(?:onward|on|further|again)\b|\bre-?shared\b|\bforward(?:ed)?\b|\bsynced\b|\bshared them\b/i;
const SEVERITY = /\bno (?:data|files?|information|documents?|records?) (?:was|were|has been|have been|got) (?:lost|leaked|exposed|taken|accessed|stolen|compromised)\b|\bnothing (?:was|has been|got) (?:exposed|leaked|taken|accessed|lost|stolen)\b|\bnot a (?:breach|serious|big|security)\b|\b(?:is|was) (?:a|an) (?:data )?(?:breach|leak)\b|\b(?:minor|low[- ]risk|harmless|no real risk|no harm|no impact|not serious|nothing to worry)\b|\b(?:serious|major|critical|severe) (?:incident|breach|leak)\b/i;

function whoElseWhatLeft(answer, { ticket = '' } = {}) {
  const plain = 'After unwanted access is closed, the audit log is read for who else used it and what left';
  if (!UNWANTED_ACCESS.test(String(ticket))) return row('who-else-what-left', plain, true, 'the ticket is not about access someone should not have had', false);
  const card = fixCard(answer);
  if (!card.present || !card.steps.length) return row('who-else-what-left', plain, false, 'there is no Fix card with steps to read');
  const steps = card.steps;
  const closed = firstStep(steps, (s) => CLOSES_PATH.test(s));
  const full = (s) => AUDIT_READ.test(s) && WHO_ELSE.test(s) && WENT_ONWARD.test(s);
  const read = closed < 0 ? -1 : steps.findIndex((s, i) => i > closed && full(s));
  const out = [];
  if (closed < 0) out.push('no step closes the path');
  if (read < 0) {
    const thin = closed >= 0 && steps.some((s, i) => i > closed && AUDIT_READ.test(s));
    out.push(thin ? 'the audit log read does not ask who else used the path and whether anything was downloaded or shared onward' : 'no step after the path is closed reads the audit log for who else used it and whether anything was downloaded or shared onward');
  }
  // how serious it is cannot be known before that read: what is wrong, the steps up to the read, the message now
  const before = [card.parts.wrong || '', ...steps.slice(0, read < 0 ? steps.length : read), card.parts.tellNow || ''].join(' ');
  if (SEVERITY.test(before)) out.push(`says how serious it is before the audit log is read ("${SEVERITY.exec(before)[0]}")`);
  return row('who-else-what-left', plain, out.length === 0, out.length ? out.join('; ') : `the path is closed in step ${closed + 1} and the audit log is read in step ${read + 1}`);
}

// ── c. How wide before why (task 5c) ────────────────────────────────────────────────────────────
const OUTAGE = /\b(?:is|are|went|goes|been|gone) down\b|\bdown for\b|\bunreachable\b|\boutage\b|\boffline\b|\bnot loading\b|\b(?:will not|won't|doesn't|does not|cannot|can't|can not) (?:load|connect|reach|be reached|come up)\b|\b(?:no one|nobody|none of us)\b[^.!?\n]{0,40}?\bcan(?:'t|not)? (?:reach|open|load|get (?:to|on|onto|into)|connect|sign in|log in)\b|\bunable to (?:reach|connect to|get (?:to|on|onto))\b|\btim(?:e|es|ed|ing) out\b|\bno (?:internet|connection|service|signal|dial tone)\b|\bkeeps? disconnecting\b/i;
const SCOPE = Object.freeze([
  /\bone (?:person|user)\b|\bjust (?:you|one|them|her|him)\b|\beveryone\b|\beverybody\b|\ball (?:users|staff)\b|\bother (?:people|users|staff|colleagues)\b|\banyone else\b/i,
  /\bone site\b|\ball sites\b|\bone (?:office|location|floor)\b|\bother (?:offices|locations)\b|\bevery (?:site|office)\b|\banother (?:site|office)\b|\bat one site or all\b/i,
  /\bother (?:internet )?(?:services|websites|apps|web pages)\b|\bonly (?:this|the) (?:service|app|site)\b|\bonly [A-Z][A-Za-z]+ or other\b|\bthe rest of the internet\b|\banything else (?:online|on the internet)\b/i,
]);
const STATUS_PAGE = /\bstatus (?:page|dashboard|site)\b|\bservice health\b|\bhealth dashboard\b|\bstatus\.[a-z0-9-]+\.[a-z]+\b|\b[a-z]+status\.com\b|\bincident page\b/i;
const NETWORK_PATH = /\bnetwork\b|\bdns\b|\bname resolution\b|\bresolv(?:e|es|ing) the (?:name|host|address)\b|\blook(?:s|ing)? up [^.\n]{0,40}by name\b|\bnslookup\b|\bwi-?fi\b|\bfirewall\b|\bisp\b|\brouter\b|\bvpn\b|\bconnectivity\b|\bping\b|\btraceroute\b|\bcabl(?:e|es|ing)\b/i;
const ACCOUNT_CAUSE = /\blicen[cs]es?\b|\bpasswords?\b|\baccount(?:'s)?\b|\bsuspended\b|\bsign-in logs?\b|\bconditional access\b|\bpermissions?\b|\bmfa\b|\b2-step\b|\bgroup membership\b/i;

function howWideBeforeWhy(answer, { ticket = '' } = {}) {
  const plain = 'A service reported down: how wide it is and the status page first, the network before the account';
  if (!OUTAGE.test(String(ticket))) return row('how-wide-before-why', plain, true, 'the ticket does not report a service down or unreachable', false);
  const card = fixCard(answer);
  if (!card.present || !card.steps.length) return row('how-wide-before-why', plain, false, 'there is no Fix card with steps to read');
  const steps = card.steps;
  const out = [];
  const dims = SCOPE.filter((re) => re.test(steps[0])).length;
  if (dims < 2) out.push('step 1 does not fix the scope (one person or everyone, one site or all, this service or others too)');
  if (!STATUS_PAGE.test(steps[0])) out.push("step 1 does not open the vendor's status page");
  const network = firstStep(steps, (s) => NETWORK_PATH.test(s));
  // step 1 is the scope step the rule asks for ("... whether anyone else's account is affected"), not a cause, so a
  // cause is read from step 2 on (code review 1, finding 15)
  const account = firstStep(steps, (s, i) => i > 0 && ACCOUNT_CAUSE.test(s));
  if (account >= 0 && (network < 0 || account < network)) out.push('an account-level cause comes before the network and name-resolution path');
  return row('how-wide-before-why', plain, out.length === 0, out.length ? out.join('; ') : 'step 1 fixes the scope with the status page, and the network path comes before any account cause');
}

// ── d. Every change carries its class and its double-check (task 5d) ────────────────────────────
const CLASS_AND_CHECK = (l) => (/\bR[1-3]\b/.test(l) && /\b(?:double-check|read-?back)\b/i.test(l)) || (/\bno gate\b/i.test(l) && /\bproof\b/i.test(l));
function changeClassAndCheck(answer) {
  const plain = 'In a plan with several changes, each change shows its class and its double-check in Details';
  const card = fixCard(answer);
  const changes = Math.max(namedGates(answer).length, card.steps.filter((s) => stepChange(s)).length);
  if (changes < 2) return row('change-class-and-check', plain, true, 'the answer advises fewer than two changes', false);
  const body = deskBlock(answer).body.split(/\r?\n/);
  const at = body.findIndex((l) => /^#{1,2}[ \t]+Details\b/i.test(l));
  const details = at < 0 ? [] : body.slice(at + 1);
  const shown = details.filter(CLASS_AND_CHECK).length;
  return row('change-class-and-check', plain, shown >= changes, `${Math.min(shown, changes)} of ${changes} changes show a class (R1 to R3) with a double-check, or "no gate" with a proof, on a line in Details`);
}

// The rows the desk adds at step 5: the two that read every answer, then each thinking rule that applies.
function seniorRows(answer, { setup = null, ticket = '' } = {}) {
  return [
    assumedSetup(answer, { setup, ticket }),
    askFirst(answer, { ticket }),
    newWayInFirst(answer, { ticket }),
    whoElseWhatLeft(answer, { ticket }),
    howWideBeforeWhy(answer, { ticket }),
    changeClassAndCheck(answer),
  ].filter((r) => r.applies);
}

// ── The reply to the person who asked (task 6) ──────────────────────────────────────────────────
const REPLY_FENCE = /^[ \t]*```[ \t]*asker-reply[ \t]*$/;
const FENCE_END = /^[ \t]*```[ \t]*$/;
// The reply an answer holds: the text of its asker-reply block, or, for an ask-first answer, the one question.
function askerReply(answer, ticket = '') {
  const lines = String(answer).split(/\r?\n/);
  const start = lines.findIndex((l) => REPLY_FENCE.test(l));
  if (start >= 0) {
    const end = lines.findIndex((l, i) => i > start && FENCE_END.test(l));
    if (end > start) return { present: true, from: 'block', text: lines.slice(start + 1, end).join('\n').trim() };
  }
  if (isAskFirst(answer, ticket)) return { present: true, from: 'ask-first', text: deskBlock(answer).body.trim() };
  return { present: false, from: null, text: '' };
}

const REPLY_MAX_WORDS = 150;
const REPLY_MAX_PARAGRAPHS = 3;
const PORTAL_PATH = /→|->|\s>\s|\badmin (?:cent(?:er|re)|console|portal)\b|\b[a-z0-9-]+\.(?:microsoft|google|okta|azure|office)\.com\b/i;
// An action only an administrator can take, asked of the person who asked. shortcut: a verb and object list, so an
// admin action worded otherwise passes; a person reads the reply before it is sent.
const ADMIN_ACTION = /\b(?:please|you (?:can|should|could|need to|must|will need to|have to|may)|go ahead and|try to)\s+(?:\w+\s+){0,2}?(?:reset|delete|remove|disable|enable|wipe|erase|revoke|assign|unassign|grant|suspend|unsuspend|unlock|approve|allow-?list|whitelist|release|restore|re-?register|deactivate|reactivate)\b[^.!?\n]{0,60}\b(?:accounts?|licen[cs]es?|sign-in methods?|authentication methods?|mfa|polic(?:y|ies)|groups?|mailbox(?:es)?|quarantine|admin|tenant|users?|devices?|roles?|permissions?)\b/i;

// What is wrong with a reply, one plain clause each; empty when it has the form and makes no done claim. ticket and
// setup: where a time may come from; ids: the runbooks' gate ids (a Set or Map), when the caller has them.
function replyProblems(reply, { ticket = '', setup = '', ids = null } = {}) {
  const text = String(reply || '').trim();
  if (!text) return ['the reply is empty'];
  const out = [];
  const paragraphs = text.split(/\n[ \t]*\n+/).filter((p) => p.trim() !== '');
  if (paragraphs.length > REPLY_MAX_PARAGRAPHS) out.push(`${paragraphs.length} paragraphs, more than ${REPLY_MAX_PARAGRAPHS}`);
  const n = words(text);
  if (n > REPLY_MAX_WORDS) out.push(`${n} words, more than ${REPLY_MAX_WORDS}`);
  if (/^[ \t]*#{1,6}[ \t]+\S/m.test(text)) out.push('it has a heading');
  if (/^[ \t]*(?:[-*+][ \t]+|\(?\d+[.)][ \t]+)\S/m.test(text)) out.push('it has a list');
  if (/\*\*[^*\n]+\*\*|__[^_\n]+__/.test(text)) out.push('it has bold text');
  if (PORTAL_PATH.test(text)) out.push('it has a portal path');
  if (/\[[A-Z][A-Z0-9_@.]*\]/.test(text)) out.push('it has a bracketed placeholder');
  if (/\bR[0-3]\b/.test(text)) out.push('it names a risk class');
  const desk = deskOnlyIn(text.replace(/\bR[0-3]\b/g, ' '), ids);
  if (desk) out.push(`it holds text that belongs to the desk ("${desk}")`);
  if (!/\byou(?:r|rs|'re|'ll|'ve)?\b/i.test(text)) out.push('it is not addressed to "you"');
  if (paragraphs.some((p) => !/[.!?]["')”’]?$/.test(p.trim()))) out.push('a paragraph does not end as a full sentence');
  // the "user message now" logic: no done claim, no change announced as decided, no time nobody set
  out.push(...userMessageProblems(text, `${ticket}\n${setup}`));
  if (ADMIN_ACTION.test(text)) out.push(`it tells the asker to take an admin action ("${ADMIN_ACTION.exec(text)[0].trim()}")`);
  // a check is named only when the sentence is about what the asker sent (the judged runner's observed-output rule)
  const observed = checks.checkObservedOutput(text.replace(/[‘’]/g, "'"), { evidence: String(ticket || '') });
  if (observed.verdict === 'fail') out.push(`it names a check Aegis did not run in this session ("${observed.span}")`);
  return [...new Set(out)];
}

module.exports = {
  FAMILIES, namesSystem, assumedSetup, bareTicket, isAskFirst, askFirstProblems, askFirst,
  lostSignInDevice, newWayInFirst, whoElseWhatLeft, howWideBeforeWhy, changeClassAndCheck, seniorRows,
  askerReply, replyProblems, REPLY_MAX_WORDS, REPLY_MAX_PARAGRAPHS, ASK_FIRST_MAX_WORDS,
};
