'use strict';
// reading-claims.js: a sentence that says Aegis checked something, held against the session's reading record
// (batch 11, task 7: the tool calls of the session; batch 12, task 3: a claim must match a call).
//
// claimsWithoutCalls(text, toolCalls) returns the claim sentences no call backs, each { sentence, kinds }. A claim is a
// sentence whose actor is "I", "we" or "Aegis" and whose verb is a check (checked, looked up, read, reviewed, tested,
// fetched, confirmed, verified, resolved, queried, inspected, traced, pinged, opened). It needs no call when it is about
// what the asker sent (the error text, the paste, the screenshot). Otherwise its object names a kind of check, and the
// record must hold a successful call of that kind:
//   docs     a vendor's documentation, help page, advisory or catalog   a docs_fetch call (the tool server)
//   dns      records, MX, SPF, name servers, resolution                  a net_dns call
//   tls      a certificate, its chain or expiry                          a net_tls call
//   http     a site, URL, status code, redirect, response                a net_http call
//   runbook  a runbook, procedure, playbook or knowledge file            a Read (or Grep, Glob) of the repository
// A claim whose object names none of these fails: Aegis cannot check settings, accounts or tenants, so the safe side is
// a claim no call can back. toolCalls: the records judged-eval keeps ({ tool, path, target, error }) or the parsed
// calls of a stream ({ tool, error }); a call with error true read nothing.
// shortcut: a word list, so a claim worded otherwise ("I've had a look") is not read, and a sentence about two kinds
// passes on either; upgrade to a model-judged row if a real reply shows one.

const fs = require('node:fs');
const path = require('node:path');

// A first-person or Aegis actor, then at most two adverbs, then a check verb; "I haven't checked" holds no claim.
const CLAIM = /\b(?:I|I've|I have|we|we've|we have|Aegis|Aegis has)\s+(?:(?:also|just|already|now|first|then|quickly|briefly)\s+){0,2}(checked|looked (?:at|up|into|over)|read|re-?read|reviewed|tested|probed|fetched|confirmed|verified|resolved|queried|inspected|traced|pinged|scanned|went through|pulled up|opened)\b/i;
// Every claim in a sentence is read (code review 1 of batch 12, class B).
const CLAIMS = new RegExp(CLAIM.source, 'gi');
// The lookup wording answer-format section 10 asks for has no actor ("A DNS lookup for example.com returned ...", or in
// the present as in section 9's example, "a certificate lookup for that host shows ..."): it is held to the record. A dot
// inside a host name does not end it; a semicolon does (code reviews 1 to 3, classes B to B3).
const LOOKUP_REPORT = /\b(?:a|the|this|that|my|our)\s+(?:DNS|MX|TXT|web|HTTPS?|certificate|TLS|SSL|docs?|documentation)\s+(?:lookup|probe|check|query|fetch)\b(?:[^.!?;]|\.(?=\S)){0,160}?\b(returned|returns|shows?|showed|found|finds|reported|reports|says|said|came back|comes back)\b/gi;
const PRESENT = /^(?:returns|shows?|finds|reports|says|comes back)$/i;
// A tool named in a sentence says it ran ("net_dns returned ...", "(net_dns, 2026-11-14)"), unless the name is negated
// in its clause ("I did not run net_dns"): class B3.
const TOOL_NAME = /\b(net_dns|net_http|net_tls|docs_fetch)\b/gi;
const NEGATED_BEFORE = /(?:\b(?:not|never|no|without)\b|n't)[^.!?;:,]{0,40}$/i;
// "I read this as a DNS problem" is a reading of the problem, not a check.
const READ_AS = /\bread (?:it|this|that|these|those|the \w+(?: \w+)?) as\b/i;
// What is not a claim that a check ran (found by replaying the check over batch 11's saved real answers and by the three
// code reviews): a checklist item; a line or sentence labeled as a check to come (Done when, Stop if, Verify, Test,
// Check); a claim inside a hypothetical clause opened by "if", "unless" or "in case"; a claim in the perfect inside a
// clause opened by a time word ("once Aegis has verified ..."); a lookup report in the present inside such a clause
// ("once the DNS lookup shows ..."); and the noun "read-back". A clause ends at a comma, semicolon or colon.
const CHECKLIST = /^\s*(?:[-*+]\s*)?\[[ xX]?\]/;
const LABEL = String.raw`^\s*(?:[-*+]\s+|\d+[.)]\s+)?`;
const FUTURE_LINE = new RegExp(`${LABEL}(?:Done when|Stop if|Verify|Test|Check)\\s*:`, 'i');
const FUTURE_SENTENCE = /^(?:\d+[.)]\s*)?(?:verify|test|split(?:ting)? test|smallest test|check|done when|stop if)\s*:/i;
// "Tell the user ..." lines are the technician's words to send: a first-person claim there is the technician's, but a
// tool citation or a lookup report there still says a lookup ran (class B3).
const USER_VOICE = new RegExp(`${LABEL}Tell the user(?: now| when done)?\\s*:`, 'i');
const HYPOTHETICAL = /(?:^|[,;:(]\s*)(?:if|unless|in case)\b[^.!?;:,]{0,80}$/i;
const TEMPORAL = /\b(?:once|when|after|while|before|until|as soon as)\b[^.!?;:,]{0,80}$/i;
const ASKER_SENT = /\b(?:what you (?:wrote|sent|pasted|shared|attached|described|said|included)|(?:you|that you) (?:sent|pasted|shared|attached|included|gave|forwarded|wrote)|your (?:message|ticket|note|paste|screenshot|logs?|error(?: text| message)?|output|email|report|description|plan|trace|stack trace|headers?|bounce(?: message)?|attachment)|(?:in|from) (?:the|your) (?:ticket|message|paste|screenshot)|the (?:error|message|text|screenshot|log|output|headers?|bounce|trace|stack trace|plan|paste|attachment) (?:in|from) (?:the|your) (?:ticket|message|request))\b/i;
// The runbooks by their command names: "/phishing-bec" is a runbook only when .claude/commands/phishing-bec.md exists
// (class B3: "/api-status" is an endpoint).
const COMMANDS = (() => {
  try { return new Set(fs.readdirSync(path.join(__dirname, '..', '..', '.claude', 'commands')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3))); } catch { return new Set(); }
})();
const namesCommand = (text) => [...text.matchAll(/(?:^|[\s,(])\/([a-z][a-z0-9-]*)\b/gi)].some((m) => COMMANDS.has(m[1].toLowerCase()));
const KINDS = [
  { kind: 'docs', re: /\b(?:documentation|docs|guide|guidance|article|help (?:page|pages|article|center|centre)|support (?:page|pages|article)|knowledge base|advisory|advisories|release notes|NVD|KEV|catalog(?:ue)?|RFC|reference page|vendor(?:'s)? page)\b/i, tool: /(?:^|__)docs_fetch$/ },
  { kind: 'dns', re: /\b(?:DNS|MX|TXT|SPF|DKIM|DMARC|CNAME|CAA|name ?servers?|NS records?|A records?|AAAA|records?|resolves?|resolution)\b/i, tool: /(?:^|__)net_dns$/ },
  { kind: 'tls', re: /\b(?:certificates?|certs?|TLS|SSL|chain|issuer|expiry)\b/i, tool: /(?:^|__)net_tls$/ },
  { kind: 'http', re: /\b(?:site|website|web ?page|web (?:probe|lookup|check)|URL|HTTPS?|status code|redirects?|response|responds|endpoint|home ?page)\b/i, tool: /(?:^|__)net_http$/ },
  { kind: 'runbook', re: { test: (t) => /\b(?:runbooks?|procedures?|playbooks?|knowledge (?:module|files?|notes)|our (?:guide|notes|steps)|answer format)\b/i.test(t) || namesCommand(t) }, tool: /^(?:Read|Grep|Glob)$/ },
];
// A reading verb ("I read", "reviewed", "went through", "opened") is what a Read backs; a check verb on a sentence that
// also names a DNS, web, certificate or docs object needs that lookup, even when a runbook is named too (class B3).
const READING = /^\W*(?:(?:I|I've|I have|we|we've|we have|Aegis|Aegis has)\s+)?(?:(?:also|just|already|now|first|then|quickly|briefly)\s+){0,2}(?:read|re-?read|reviewed|went through|opened)\b/i;
const CHECK_VERBS = String.raw`(?:checked|looked (?:at|up|into|over)|read|reviewed|tested|probed|fetched|confirmed|verified|resolved|queried|inspected|traced|pinged|scanned|went through|pulled up|opened)`;
const AND_CHECK = new RegExp(String.raw`\s+and\s+(?=(?:(?:also|then|just)\s+)?${CHECK_VERBS}\b)`, 'i');

// Sentences of a text, line by line (a list line never runs into the next one), each with whether it is the technician's
// voice; emphasis marks go, and an underscore inside a word stays so a tool name such as net_dns is still read.
const sentencesOf = (text) => String(text).replace(/[‘’]/g, "'").split(/\r?\n/)
  .map((line) => line.replace(/[*`]/g, '').replace(/(?<![A-Za-z0-9])_+|_+(?![A-Za-z0-9])/g, ''))
  .filter((line) => !CHECKLIST.test(line) && !FUTURE_LINE.test(line))
  .flatMap((line) => {
    const voice = USER_VOICE.test(line);
    return line.split(/(?<=[.!?])\s+(?=\S)/).map((s) => ({ text: s.trim(), voice }));
  })
  .filter((s) => s.text && !FUTURE_SENTENCE.test(s.text));

const ok = (call) => Boolean(call) && typeof call.tool === 'string' && call.error !== true;
const kindsOf = (part) => {
  const kinds = KINDS.filter((k) => k.re.test(part));
  return kinds.length > 1 && !READING.test(part) ? kinds.filter((k) => k.kind !== 'runbook') : kinds;
};

function claimsWithoutCalls(text, toolCalls = []) {
  const calls = Array.isArray(toolCalls) ? toolCalls.filter(ok) : [];
  const out = [];
  for (const { text: sentence, voice } of sentencesOf(text)) {
    // a tool named in the sentence, not negated, must have run, whatever the wording around it
    const cited = [...sentence.matchAll(TOOL_NAME)].filter((m) => !NEGATED_BEFORE.test(sentence.slice(0, m.index)))
      .map((m) => m[1].toLowerCase()).filter((t) => !calls.some((c) => new RegExp(`(?:^|__)${t}$`).test(c.tool)));
    if (cited.length) { out.push({ sentence: sentence.slice(0, 160), kinds: [...new Set(cited)] }); continue; }
    if (READ_AS.test(sentence) || ASKER_SENT.test(sentence)) continue;
    // every first-person claim in the sentence, each judged on its own (not in the technician's voice)
    const live = voice ? [] : [...sentence.matchAll(CLAIMS)].filter((m) => {
      if (/^read$/i.test(m[1]) && /^-?back\b/i.test(sentence.slice(m.index + m[0].length))) return false;
      const before = sentence.slice(0, m.index);
      return !(HYPOTHETICAL.test(before) || (TEMPORAL.test(before) && /\b(?:has|have)\b|'ve\b/i.test(m[0])));
    });
    // every lookup report in the sentence, each judged on its own (class B3)
    const reports = [...sentence.matchAll(LOOKUP_REPORT)].filter((m) => {
      const before = sentence.slice(0, m.index);
      return !(HYPOTHETICAL.test(before) || (TEMPORAL.test(before) && PRESENT.test(m[1])));
    });
    if (!live.length && !reports.length) continue;
    // each claim and each report owns the text up to the next one, and each claimed check in it ("I checked X and
    // looked up Y") needs its own call; a part that names nothing ("I checked: ...") is read with the part after it
    const starts = [...new Set([...live, ...reports].map((m) => m.index))].sort((a, b) => a - b);
    const pieces = starts.flatMap((at, i) => sentence.slice(at, starts[i + 1]).split(AND_CHECK));
    const parts = [];
    for (const piece of pieces) {
      if (parts.length && kindsOf(parts[parts.length - 1]).length === 0) parts[parts.length - 1] += piece;
      else parts.push(piece);
    }
    // an object named before its claim ("The AWS encryption guide I looked up confirms ...") belongs to that claim when
    // the claim's own words name nothing (found by replaying the judged run's answers)
    if (parts.length && kindsOf(parts[0]).length === 0) parts[0] = sentence.slice(0, starts[0]) + parts[0];
    const unbacked = parts.filter((part) => !kindsOf(part).some((k) => calls.some((c) => k.tool.test(c.tool))));
    if (!unbacked.length) continue;
    out.push({ sentence: sentence.slice(0, 160), kinds: [...new Set(unbacked.flatMap((p) => kindsOf(p).map((k) => k.kind)))] });
  }
  return out;
}

module.exports = { claimsWithoutCalls };
