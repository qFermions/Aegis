#!/usr/bin/env node
'use strict';
// tier-guard.js — deterministic escalation floor for the T1/T2 lightweight lane.
//
// The lead model classifies support tier by judgment (scope, blast radius,
// reversibility, diagnostic complexity, systems, authorization risk, novelty,
// uncertainty — doctrine: docs/harness.md §Tier routing). This guard is NOT the
// classifier: it is the fail-safe FLOOR that runs before any T1/T2 dispatch and
// force-escalates consequential actions to the existing Tier-3 / R0–R3 path,
// exactly as the graph engine's SR-2 trigger scan force-raises risk. Tier can
// never override action risk; a miss here fails toward the safer path.
//
// Pattern set mirrors the SR-2 destructive class in
// modules/security/security-doctrine.md and the engine's SR2_TRIGGER_PATTERNS
// (scripts/graph/engine.js) — keep the three in sync. Additive: nothing in the
// existing Tier-3 machinery reads this file.
//
// CLI: node scripts/tier/tier-guard.js --ticket "<text>"
// Output: {"floor":"T3"|"none","triggers":[...]}  Exit 0 always (report, not gate).

// Confusable folding: a homoglyph must not defeat a floor (a dotless "ı" in
// "wıpe", a Cyrillic "а" in "delete"). The table is explicit and auditable — it
// maps the Latin look-alikes that commonly appear in copy-pasted text, then
// strips combining marks. Non-Latin scripts stay untouched: they never match an
// English pattern, and the replay cache refuses shape matching for them anyway.
const CONFUSABLES = {
  'ı': 'i', 'ſ': 's', 'ɡ': 'g', 'ʏ': 'y',
  'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ǫ': 'q', 'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z',
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'һ': 'h', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w', 'ɩ': 'i',
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'Ѕ': 'S', 'І': 'I', 'Ј': 'J',
  'ο': 'o', 'ν': 'v', 'ρ': 'p', 'α': 'a', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'τ': 't', 'υ': 'u', 'χ': 'x', 'γ': 'y',
};
function foldConfusables(text) {
  // 1. drop invisible format characters (zero-width space/joiners, soft hyphen,
  //    word joiner …) — pasted from Outlook/Jira rich text as often as by intent
  // 2. NFKD (full-width / math-bold letters → ASCII) and strip combining marks
  // 3. map Latin look-alikes from the table above
  return String(text)
    .replace(/\p{Cf}/gu, '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\x00-\x7F]/g, (ch) => CONFUSABLES[ch] || ch);
}

const ESCALATION_PATTERNS = [
  // SR-2 destructive class — gated regardless of how routine the wording sounds
  { pattern: /\bwipe\b|\bretire\b[^.]*(?:\b(device|devices|phone|phones|laptop|laptops|iphone|android|ipad|mac|workstation|tablet|intune)\b|\[DEVICE_NAME\]|\b[DL]T-)|Clear-MobileDevice|Invoke-MgRetireDeviceManagementManagedDevice|Fresh\s*Start|factory[- ]reset/i, label: 'device wipe / retire / factory reset (SR-2)' },
  { pattern: /\b(delete|remove|purge)\b[^.]*\b(user|users|account|accounts|mailbox|mailboxes|group|groups|ou|org(anizational)? unit|device|devices|device record)\b/i, label: 'account/mailbox/group/OU/device deletion (SR-2)' },
  { pattern: /\b(disable|suspend|block|deactivate)\b[^.]*\b(user|users|account|accounts|mailbox|mailboxes|sign[- ]?in|login|credential)\b/i, label: 'account/mailbox disable / sign-in block (SR-2)' },
  { pattern: /\b(remove|revoke|reclaim|unassign)\b[^.]*\blicen[cs]e/i, label: 'license removal (SR-2)' },
  { pattern: /\b(remove|revoke)\b[^.]*\b(from|member)[^.]*\bgroup\b/i, label: 'group membership removal (SR-2)' },
  { pattern: /revoke[^.]*\bsession|sign[- ]?out[^.]*\b(all|every)\b|Revoke-MgUserSignInSession/i, label: 'session revocation (SR-2)' },
  { pattern: /\b(disable|bypass|turn\s*off|relax|exclude[^.]*from)\b[^.]*\b(mfa|2sv|2fa|two[- ](step|factor)|conditional access|ca polic|defender|firewall|antivirus|dlp|audit(ing)? log)/i, label: 'security-control change (SR-2)' },
  { pattern: /\boffboard|termination|leaver|separat(ed|ion)\b/i, label: 'offboarding flow (destructive multi-step — existing /offboard path)' },
  // Security incident — not an SR-2 class by itself, but a lane floor: a ticket that
  // says the account may be compromised must never be handled as a routine
  // "new phone" MFA reset. It belongs to the existing /security-alert-triage path.
  { pattern: /\b(compromis(?:e|ed|ing)|breach(?:ed)?|hacked|phish(?:ed|ing) (?:link|click|success)|attacker|unauthori[sz]ed (?:access|sign[- ]?in|login))\b/i, label: 'suspected compromise / security incident (existing /security-alert-triage path)' },
  // G1 — Google Workspace / Okta / Jamf consequential actions. Mirrored in the
  // graph engine's SR2_TRIGGER_PATTERNS; tier-routing.test.js pins both. The
  // engine writes each pattern in its own pre-existing `.*` style (and drops the
  // `from` in the 2SV exclusion), so it floors a superset of what this guard
  // floors: it can over-trigger across sentences, never fail open against it.
  { pattern: /\btransfer(?:s|red|ring)?\b[^.]*\b(?:ownership|owner|drive|calendar|data|files|docs)\b|\bownership\s+transfer\b|\bdata\s+transfer\b/i, label: 'Drive / Calendar / data ownership transfer (R2+ — capture pre-state first)' },
  { pattern: /\bde-?provision(?:s|ed|ing)?\b/i, label: 'deprovision — device or account (SR-2)' },
  { pattern: /\bpower\s*-?wash(?:es|ed|ing)?\b/i, label: 'Chromebook powerwash — factory reset (SR-2)' },
  { pattern: /\b(?:remove|clear|delete|wipe|erase)\b[^.]*\b(?:account|work profile|work data|managed profile|user profiles?)\b[^.]*\b(?:from|on|off)\b[^.]*\b(?:device|devices|phone|phones|laptop|laptops|chromebook|chromebooks|mac|macbook|tablet|ipad|iphone|android)\b/i, label: 'account / work-profile removal from a device (SR-2)' },
  { pattern: /\brevok(?:e|ed|es|ing)\b[^.]*\b(?:oauth|tokens?|app[- ]?passwords?|app[- ]specific passwords?|app access|third[- ]party (?:app )?access|api access)\b|\b(?:delete|remove|reset)\b[^.]*\bapp[- ]?passwords?\b/i, label: 'OAuth token / app-password / app-access revocation (SR-2 session class)' },
  { pattern: /\b(?:grant|assign|make|add|give|promote|elevate)\b[^.]*\b(?:super[- ]?admin|admin(?:istrator)?[- ](?:role|rights|privileges?|access)|global admin|org(?:anization)? admin|delegated admin)\b/i, label: 'admin-role grant — super admin or any admin role (privilege change, SR-2 class)' },
  { pattern: /\b(?:vault|litigation|legal)\s+hold\b|\bretention\s+(?:rule|rules|polic(?:y|ies)|period|settings?)\b/i, label: 'Vault / litigation hold or retention-rule change (records preservation)' },
  { pattern: /\bokta\b[^.]*\b(?:deactivat\w*|de-?provision\w*|delet\w*)\b|\b(?:deactivat\w*|de-?provision\w*|delet\w*)\b[^.]*\bokta\b|\bclear(?:s|ed|ing)?\b[^.]*\bsessions?\b|\breset\b[^.]*\ball\b[^.]*\b(?:factors|authenticators)\b/i, label: 'Okta lifecycle change / session clear / reset all factors (SR-2)' },
  { pattern: /\berase\b[^.]*\b(?:device|devices|mac|macs|macbook|computer|computers|laptop|iphone|ipad|disk)\b|\bremote(?:ly)?[- ]?lock\b|\block\b[^.]*\bremote(?:ly)?\b|\bjamf\b[^.]*\block\b|\block\b[^.]*\bjamf\b|\blost mode\b|\bremove\b[^.]*\bmdm profile\b|\bunmanag(?:e|ed|ing)\b|\bremoveFramework\b/i, label: 'Jamf / MDM erase, remote lock, lost mode, MDM-profile removal or unmanage (SR-2)' },
  { pattern: /\b(?:disable|bypass|turn\s*off|relax|unenforce|exclude[^.]*from|remove|delete)\b[^.]*\b(?:2-?step verification|2-?step|context[- ]aware access|security keys?|passkeys?)\b/i, label: 'security-control change — Google 2-Step Verification, security keys/passkeys, or Context-Aware Access (SR-2)' },
  // Mass / broad blast radius — numbers, "all", org-wide phrasing
  { pattern: /\b(all|every|entire|org[- ]?wide|company[- ]?wide|tenant[- ]?wide|domain[- ]?wide)\b[^.]*\b(user|users|staff|employee|employees|account|accounts|device|devices|mailbox|mailboxes|machine|machines|workstation)/i, label: 'org-wide / all-objects operation (mass)' },
  { pattern: /\b(1[1-9]|[2-9]\d|\d{3,})\s*(\+\s*)?(user|users|employee|employees|account|accounts|device|devices|mailbox|mailboxes|machine|machines|member|members|staff|contractor|contractors|people)\b/i, label: 'mass operation (>10 objects)' },
  // Self-permission / arbitrary execution (existing extended gate)
  { pattern: /settings\.local\.json|Invoke-Expression|\bIEX\b|Install-Module|git push --force|git reset --hard/i, label: 'extended-gate operation (SR-2)' },
];

// The sentence-limited patterns use `[^.]*`, so a dot INSIDE a token — the
// canonical `[first.last]` / `[USER@DOMAIN.COM]` placeholders, a dotted name, a
// file name — must not end the "sentence": "Disable [first.last]'s account"
// is one sentence. Each pattern is also tried against a copy where in-token dots
// are a non-ASCII leader (U+2024) that `[^.]` can cross. Additive by design: it
// can only add floors, never remove one, and a dot followed by whitespace still
// ends a sentence.
function joinInTokenDots(text) {
  return text.replace(/(?<=[^\s.])\.(?=[^\s.])/g, '․');
}

function assess(text) {
  const folded = foldConfusables(text);
  const joined = joinInTokenDots(folded);
  const triggers = [];
  for (const { pattern, label } of ESCALATION_PATTERNS) {
    if (pattern.test(folded) || pattern.test(joined)) triggers.push(label);
  }
  return { floor: triggers.length ? 'T3' : 'none', triggers };
}

// ── untrusted-text rules shared by the graph edge sanitizer and the replay cache ──
// One copy, here, because both may load this pure module (scripts/graph/sanitize.js;
// scripts/replay/replay-cli.js, whose R4 test pins its dependencies to this file).

// The text as written and two folded forms: format characters removed, or read as a
// space (a zero-width character used as the word separator). A marker or token a model
// can read must not hide behind a homoglyph or an invisible character.
function foldedForms(text) {
  const s = String(text);
  return Array.from(new Set([s, foldConfusables(s), foldConfusables(s.replace(/\p{Cf}/gu, ' '))]));
}

// Prompt-injection markers (SR-3): flagged or refused as data, never followed.
const INJECTION_MARKERS = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i, marker: 'ignore-previous-instructions' },
  { pattern: /disregard\s+(your|all|previous)\s+(rules|instructions|guidelines)/i, marker: 'disregard-rules' },
  { pattern: /\bnew\s+system\s+prompt\b/i, marker: 'system-prompt-override' },
  { pattern: /\byou\s+are\s+now\s+(in\s+)?(admin|developer|maintenance)\s+mode\b/i, marker: 'mode-override-claim' },
];
function injectionMarkersIn(text, forms = foldedForms(text)) {
  return INJECTION_MARKERS.filter(({ pattern }) => forms.some((f) => pattern.test(f))).map(({ marker }) => marker);
}

// A second org namespace (SR-1/SR-8): one deployment serves one tenant, whose org
// tokens are the [@Aegion_*] family (modules/security/placeholder-dictionary.md). A
// token is an org token when its suffix is one of the dictionary's own suffixes
// (ORG_TOKEN_SUFFIXES, kept equal to the dictionary by a test), after the bracket body
// is normalized: camelCase and letter-digit boundaries split, spaces, hyphens and
// underscores read as one separator, upper-cased. Every split point is tried, so a
// namespace with its own underscores (Other_Org_DOMAIN) is found, and a numbered
// variant of a dictionary suffix (SITE_5, domain2) counts as that suffix. Any namespace but
// Aegion is a second tenant; the own namespace is Aegion followed by "_" or a space,
// so AegionCo or Aegion-Co is another org. The body cannot hold "[", so an unclosed
// token cannot swallow the next one. A chat handle ([@jane_doe], [@bob_site_visit], [@alex_IT])
// is not an org token: its suffix is not a dictionary suffix.
const ORG_TOKEN = /\[@\s*([A-Za-z][A-Za-z0-9_\s-]{0,79})\]/g;
const OWN_ORG_NAMESPACE = /^Aegion(?:[\s_]|$)/i;
const ORG_TOKEN_SUFFIXES = new Set(['ALARM', 'DOMAIN', 'DOMAIN_SHORT', 'DOMAIN_SP', 'FINANCE_SERVER', 'GWS_CUSTOMER_ID', 'ISP',
  'JAMF_URL', 'JIRA_SPACE', 'JIRA_URL', 'NETPARTNER', 'OKTA_ORG_URL', 'REMOTE_ACCESS', 'SITE_2', 'SITE_3', 'SITE_4',
  'SITE_COUNT', 'SIZE', 'VOIP', 'VOIP_LEGACY', 'VOIP_URL', 'WAN', 'XYZ']);
function orgTokenWords(body) {
  return body.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/([A-Za-z])(\d)/g, '$1_$2').replace(/(\d)([A-Za-z])/g, '$1_$2')
    .toUpperCase().split(/[\s_-]+/).filter(Boolean);
}
function isForeignOrgBody(body) {
  if (OWN_ORG_NAMESPACE.test(body)) return false;
  const words = orgTokenWords(body);
  for (let k = 1; k < words.length; k += 1) {
    const suffix = words.slice(k).join('_');
    if (ORG_TOKEN_SUFFIXES.has(suffix) || ORG_TOKEN_SUFFIXES.has(suffix.replace(/_\d+$/, '')) || /^SITE_\d+$/.test(suffix)) return true;
  }
  return false;
}
// forms: pass foldedForms(text) when the caller already has them (one fold per line).
function hasForeignOrgToken(text, forms = foldedForms(text)) {
  return forms.some((f) => Array.from(f.matchAll(ORG_TOKEN)).some((m) => isForeignOrgBody(m[1])));
}

// A tenant literal (SR-8) is found as written and in the folded forms, so a zero-width
// character or a look-alike letter inside it does not get it past the gate. The literal
// is folded the same way, so an accented org name still matches its folded text.
function containsLiteral(text, literal, forms = foldedForms(text)) {
  const needles = Array.from(new Set([String(literal).toLowerCase(), foldConfusables(literal).toLowerCase()])).filter(Boolean);
  return needles.length > 0 && forms.some((f) => needles.some((n) => f.toLowerCase().includes(n)));
}

// A bracketed token is exempt from a PII scan only when it IS a canonical placeholder:
// the literal [USER@DOMAIN.COM], the [@Aegion_*] family, or an upper-case token with no
// "@" ([UPN], [JIRA-###], [PHONE_NUMBER]). maskCanonicalPlaceholders blanks those and
// leaves everything else, so a real address next to a placeholder is still scanned.
function isCanonicalPlaceholder(tok) {
  if (tok === '[USER@DOMAIN.COM]') return true;
  if (/^\[@Aegion_[A-Za-z0-9_]*\]$/.test(tok)) return true;
  return !tok.includes('@') && /^\[[A-Z0-9_.,/#-]+\]$/.test(tok) && /[A-Z]/.test(tok);
}
function maskCanonicalPlaceholders(text) {
  return String(text).replace(/\[[^\]\n]*\]/g, (tok) => (isCanonicalPlaceholder(tok) ? ' ' : tok));
}

module.exports = {
  assess, foldConfusables, ESCALATION_PATTERNS,
  foldedForms, INJECTION_MARKERS, injectionMarkersIn, ORG_TOKEN, ORG_TOKEN_SUFFIXES, hasForeignOrgToken, containsLiteral,
  isCanonicalPlaceholder, maskCanonicalPlaceholders,
};

if (require.main === module) {
  const i = process.argv.indexOf('--ticket');
  const ticket = i >= 0 ? process.argv[i + 1] : undefined;
  if (!ticket) {
    console.error(JSON.stringify({ ok: false, error: 'usage: tier-guard.js --ticket "<text>"' }));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, ...assess(ticket) }, null, 2));
}
