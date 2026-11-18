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

// A first-person or Aegis actor, then at most two adverbs, then a check verb; "I haven't checked" holds no claim.
const CLAIM = /\b(?:I|I've|I have|we|we've|we have|Aegis|Aegis has)\s+(?:(?:also|just|already|now|first|then|quickly|briefly)\s+){0,2}(checked|looked (?:at|up|into|over)|read|re-?read|reviewed|tested|probed|fetched|confirmed|verified|resolved|queried|inspected|traced|pinged|scanned|went through|pulled up|opened)\b/i;
// Every claim in a sentence is read (code review 1 of batch 12, class B).
const CLAIMS = new RegExp(CLAIM.source, 'gi');
// The lookup wording answer-format section 10 asks for has no actor ("A DNS lookup for example.com returned ..."), and a
// tool named in a citation ("(net_dns, 2026-11-14)") says that tool ran: both are held to the record (class B).
// Only the past tense reports a lookup that ran; "a certificate lookup shows ..." in a Verify line is a check to come, and
// a dot inside a host name does not end the report (code review 2, class B2).
const LOOKUP_REPORT = /\b(?:a|the|this|that|my|our)\s+(?:DNS|MX|TXT|web|HTTPS?|certificate|TLS|SSL|docs?|documentation)\s+(?:lookup|probe|check|query|fetch)\b(?:[^.!?]|\.(?=\S)){0,160}?\b(?:returned|showed|found|reported|said|came back)\b/i;
// A tool counts only in the citation form section 10 gives, "(net_dns, 2026-11-14)"; "I did not run net_dns" names it
// without saying it ran (class B2).
const TOOL_CITE = /\(\s*(net_dns|net_http|net_tls|docs_fetch)\s*,\s*\d{4}-\d{2}-\d{2}\s*\)/gi;
// "I read this as a DNS problem" is a reading of the problem, not a check.
const READ_AS = /\bread (?:it|this|that|these|those|the \w+(?: \w+)?) as\b/i;
// What is not a claim that a check ran (found by replaying the check over batch 11's saved real answers): a checklist
// item, a "Done when" or "Stop if" line (a future state), a sentence whose claim sits under a condition ("once", "when",
// "after", "until", "if", "before"), and the noun "read-back".
const CHECKLIST = /^\s*(?:[-*+]\s*)?\[[ xX]?\]/;
// "Tell the user ..." lines are the technician's words to send, not Aegis's (class B2).
const FUTURE_PART = /^\s*(?:Done when|Stop if|Tell the user(?: now| when done)?)\s*:/i;
// A hypothetical ("if", "unless", "once", "until", "before") holds no claim inside its own clause; a time word ("when",
// "after", "while") holds none only in the perfect ("once Aegis has verified"), never in the past ("after I checked").
// A condition governs its clause only: a comma, semicolon or colon ends it (code review 1 and 2, classes B and B2).
const HYPOTHETICAL = /\b(?:if|unless|once|until|before|as soon as|in case)\b[^.!?;:,]{0,80}$/i;
const TEMPORAL = /\b(?:when|after|while)\b[^.!?;:]{0,80}$/i;
const ASKER_SENT = /\b(?:what you (?:wrote|sent|pasted|shared|attached|described|said|included)|(?:you|that you) (?:sent|pasted|shared|attached|included|gave|forwarded|wrote)|your (?:message|ticket|note|paste|screenshot|logs?|error(?: text| message)?|output|email|report|description|plan|trace|stack trace|headers?|bounce(?: message)?|attachment)|(?:in|from) (?:the|your) (?:ticket|message|paste|screenshot)|the (?:error|message|text|screenshot|log|output|headers?|bounce|trace|stack trace|plan|paste|attachment) (?:in|from) (?:the|your) (?:ticket|message|request))\b/i;
const KINDS = [
  { kind: 'docs', re: /\b(?:documentation|docs|guide|guidance|article|help (?:page|pages|article|center|centre)|support (?:page|pages|article)|knowledge base|advisory|advisories|release notes|NVD|KEV|catalog(?:ue)?|RFC|reference page|vendor(?:'s)? page)\b/i, tool: /(?:^|__)docs_fetch$/ },
  { kind: 'dns', re: /\b(?:DNS|MX|TXT|SPF|DKIM|DMARC|CNAME|CAA|name ?servers?|NS records?|A records?|AAAA|records?|resolves?|resolution)\b/i, tool: /(?:^|__)net_dns$/ },
  { kind: 'tls', re: /\b(?:certificates?|certs?|TLS|SSL|chain|issuer|expiry)\b/i, tool: /(?:^|__)net_tls$/ },
  { kind: 'http', re: /\b(?:site|website|web ?page|web (?:probe|lookup|check)|URL|HTTPS?|status code|redirects?|response|responds|endpoint|home ?page)\b/i, tool: /(?:^|__)net_http$/ },
  // a runbook named by its command ("/phishing-bec") and the answer format are files of the repository too (class B2)
  { kind: 'runbook', re: /\b(?:runbooks?|procedures?|playbooks?|knowledge (?:module|files?|notes)|our (?:guide|notes|steps)|answer format)\b|(?:^|[\s,(])\/[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/i, tool: /^(?:Read|Grep|Glob)$/ },
];

// Sentences of a text, line by line (a list line never runs into the next one).
const sentencesOf = (text) => String(text).replace(/[‘’]/g, "'").split(/\r?\n/)
  // emphasis marks go; an underscore inside a word stays, so a tool name such as net_dns is still read (class B)
  .map((line) => line.replace(/[*`]/g, '').replace(/(?<![A-Za-z0-9])_+|_+(?![A-Za-z0-9])/g, ''))
  .filter((line) => !CHECKLIST.test(line) && !FUTURE_PART.test(line))
  .flatMap((line) => line.split(/(?<=[.!?])\s+(?=\S)/)).map((s) => s.trim()).filter(Boolean);

const ok = (call) => Boolean(call) && typeof call.tool === 'string' && call.error !== true;

function claimsWithoutCalls(text, toolCalls = []) {
  const calls = Array.isArray(toolCalls) ? toolCalls.filter(ok) : [];
  const out = [];
  for (const sentence of sentencesOf(text)) {
    // a tool named in the sentence must have run, whatever the wording around it
    const cited = [...sentence.matchAll(TOOL_CITE)].map((m) => m[1].toLowerCase()).filter((t) => !calls.some((c) => new RegExp(`(?:^|__)${t}$`).test(c.tool)));
    if (cited.length) { out.push({ sentence: sentence.slice(0, 160), kinds: [...new Set(cited)] }); continue; }
    if (READ_AS.test(sentence) || ASKER_SENT.test(sentence)) continue;
    // every claim in the sentence, each judged on its own; a claim under a condition is no claim only in the perfect
    // form ("once Aegis has verified"), never in the past ("after I checked") (class B)
    const live = [...sentence.matchAll(CLAIMS)].filter((m) => {
      if (/^read$/i.test(m[1]) && /^-?back\b/i.test(sentence.slice(m.index + m[0].length))) return false;
      const before = sentence.slice(0, m.index);
      return !(HYPOTHETICAL.test(before) || (TEMPORAL.test(before) && /\b(?:has|have)\b|'ve\b/i.test(m[0])));
    });
    const found = LOOKUP_REPORT.exec(sentence);
    const report = found && !HYPOTHETICAL.test(sentence.slice(0, found.index)) ? found : null;
    if (!live.length && !report) continue;
    // each claim, and a lookup report, owns the text up to the next one; each claimed check in it ("I checked X and
    // looked up Y") needs its own call (found by the networking lane builder and code reviews 1 and 2)
    const starts = [...live.map((m) => m.index), ...(report ? [report.index] : [])].sort((a, b) => a - b);
    const parts = starts.flatMap((at, i) => sentence.slice(at, starts[i + 1]).split(/\s+and\s+(?=(?:(?:also|then|just)\s+)?(?:checked|looked (?:at|up|into|over)|read|reviewed|tested|probed|fetched|confirmed|verified|resolved|queried|inspected|traced|pinged|scanned|went through|pulled up|opened)\b)/i));
    const unbacked = parts.filter((part) => {
      const kinds = KINDS.filter((k) => k.re.test(part));
      return !kinds.some((k) => calls.some((c) => k.tool.test(c.tool)));
    });
    if (!unbacked.length) continue;
    out.push({ sentence: sentence.slice(0, 160), kinds: KINDS.filter((k) => unbacked.some((p) => k.re.test(p))).map((k) => k.kind) });
  }
  return out;
}

module.exports = { claimsWithoutCalls };
