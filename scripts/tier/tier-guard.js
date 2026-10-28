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

// Linear issue deletion. The verb and the object are read without case; the anchor is
// Linear, [ISSUE_ID] or an issue key written in one case throughout (ENG-142, eng-142),
// so a product name with a number in mixed case (Office-365, Windows-11) is not a key.
// The key needs case, so it is a second regex without the i flag, tried on the same
// sentence; an inline modifier group would need Node 23 and stop a Node 22 hook loading.
const LINEAR_DELETE_VERB = /\b(?:delete[sd]?|deleting|trash(?:es|ed|ing)?|purge[sd]?|purging)\b(?=[^.]*\b(?:issues?|projects?|cycles?|labels?|workflow states?|initiatives?|teams?)\b)/i;
const LINEAR_ANCHOR = /\blinear\b|\[ISSUE_ID\]/i;
const LINEAR_KEY = /\b(?:[A-Z][A-Z0-9]{1,9}|[a-z][a-z0-9]{1,9})-[0-9]{1,6}\b/;
const LINEAR_DELETION = {
  test: (text) => String(text).split('.').some((s) => LINEAR_DELETE_VERB.test(s) && (LINEAR_ANCHOR.test(s) || LINEAR_KEY.test(s))),
};

const ESCALATION_PATTERNS = [
  // SR-2 destructive class — gated regardless of how routine the wording sounds
  { pattern: /\bwipe\b|\bretire\b[^.]*(?:\b(device|devices|phone|phones|laptop|laptops|iphone|android|ipad|mac|workstation|tablet|intune)\b|\[DEVICE_NAME\]|\b[DL]T-)|Clear-MobileDevice|Invoke-MgRetireDeviceManagementManagedDevice|Fresh\s*Start|factory[- ]reset/i, label: 'device wipe / retire / factory reset (SR-2)' },
  { pattern: /\b(delete|remove|purge)\b[^.]*\b(user|users|account|accounts|mailbox|mailboxes|group|groups|ou|org(anizational)? unit|device|devices|device record)\b/i, label: 'account/mailbox/group/OU/device deletion (SR-2)' },
  { pattern: /\b(disable|suspend|block|deactivate)\b[^.]*\b(user|users|account|accounts|mailbox|mailboxes|sign[- ]?in|login|credential)\b/i, label: 'account/mailbox disable / sign-in block (SR-2)' },
  // batch G2 code review: a message purge across mailboxes (a Purview search-and-purge);
  // the three words are separate lookaheads from the verb, so a miss costs linear time;
  // security review 2: delete or purge with the mailboxes named as many (plural inboxes,
  // every or all next to inbox, everyone's inbox, company-wide), not one person's inbox
  { pattern: /\bpurg(?:e|es|ed|ing)\b(?=[^.]*\b(?:messages?|e-?mails?|mail|items?)\b)(?=[^.]*\b(?:every|all|each|across)\b)(?=[^.]*\b(?:inbox(?:es)?|mailbox(?:es)?|users?)\b)|\b(?:delet(?:e|es|ed|ing)|purg(?:e|es|ed|ing))\b(?=[^.]*\b(?:messages?|e-?mails?|mail|items?)\b)(?=[^.]*(?:\b(?:inboxes|mailboxes)\b|\b(?:every|all|each|across)\s+(?:[\w'-]+\s+){0,2}(?:inbox(?:es)?|mailbox(?:es)?|users?)\b|\beveryone\W?s\s+(?:inbox|mailbox)(?:es)?\b|\b(?:org|company|tenant|domain)[- ]?wide\b|\bentire\s+(?:company|org(?:ani[sz]ation)?|tenant|domain)\b))|\b(?:compliance|content)\s+search\b[^.]*\bpurg(?:e|es|ed|ing)\b|\bpurg(?:e|es|ed|ing)\b[^.]*\b(?:compliance|content)\s+search\b|New-ComplianceSearchAction\b[^\r\n]*-Purge\b/i, label: 'Exchange / Purview message purge across mailboxes (SR-2, hard delete)' },
  { pattern: /\b(remove|revoke|reclaim|unassign)\b[^.]*\blicen[cs]e/i, label: 'license removal (SR-2)' },
  { pattern: /\b(remove|revoke)\b[^.]*\b(from|member)[^.]*\bgroup\b/i, label: 'group membership removal (SR-2)' },
  { pattern: /revoke[^.]*\bsession|sign[- ]?out[^.]*\b(all|every)\b|Revoke-MgUserSignInSession/i, label: 'session revocation (SR-2)' },
  { pattern: /\b(disable|bypass|turn\s*off|relax|exclude[^.]*from)\b[^.]*\b(mfa|2sv|2fa|two[- ](step|factor)|conditional access|ca polic|defender|firewall|antivirus|dlp|audit(ing)? log)/i, label: 'security-control change (SR-2)' },
  { pattern: /\boffboard|termination|leaver|separat(ed|ion)\b/i, label: 'offboarding flow (destructive multi-step — existing /offboard path)' },
  // Security incident — not an SR-2 class by itself, but a lane floor: a ticket that
  // says the account may be compromised must never be handled as a routine
  // "new phone" MFA reset. It belongs to the existing /security-alert-triage path.
  // batch G3: "breached" about an SLA, a deadline or a target ("SLA breached", "breached its SLA",
  // "in breach of the response SLA") is a missed commitment, not a compromise, so it does not
  // floor here; "the account was breached" and "a data breach" still do.
  { pattern: /\b(compromis(?:e|ed|ing)|(?<!\b(?:SLAs?|service[- ]levels?|deadlines?|targets?|OLAs?|KPIs?)\s+(?:(?:was|were|is|are|has\s+been|have\s+been|got)\s+)?)breach(?:ed|es)?(?!\s+(?:of\s+)?(?:(?:its|their|the|our|an?|this|that)\s+)?(?:[\w-]+\s+){0,2}(?:SLAs?|service[- ]levels?|deadlines?|targets?|OLAs?|KPIs?)\b)|hacked|phish(?:ed|ing) (?:link|click|success)|attacker|unauthori[sz]ed (?:access|sign[- ]?in|login))\b/i, label: 'suspected compromise / security incident (existing /security-alert-triage path)' },
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
  // G2: Fleet (fleetdm). Each G2 floor is mirrored in the graph engine's
  // SR2_TRIGGER_PATTERNS (`.*` there, so the engine floors a superset);
  // tier-routing.test.js pins both, one block per platform.
  // The unenroll floor anchors on a device word, Intune or the Company Portal; Intune
  // followed by a course or training word is a class, not a device (security review 2).
  { pattern: /\bfleet(?:ctl|dm)?\b[^.]*\block(?:s|ed|ing)?\b|\block(?:s|ed|ing)?\b[^.]*\bfleet(?:ctl|dm)?\b|\bturn(?:s|ed|ing)?\s*off\b[^.]*\bmdm\b|\bun-?enroll(?:s|ed|ing|ment)?\b[^.]*(?:\b(?:fleet(?:ctl|dm)?|mdm|hosts?|devices?|iphones?|ipads?|android|phones?|macs?|macbooks?|laptops?|computers?|chromebooks?|tablets?|workstations?|company portal)\b|\bintune\b(?!\s+(?:basics|training|courses?|class(?:es)?|webinars?|workshops?|lessons?|modules?|certifications?|exams?|learning|bootcamps?|101|fundamentals)\b)|\[DEVICE_NAME\]|\b[DL]T-)|(?:\b(?:fleet(?:ctl|dm)?|mdm|hosts?|devices?|iphones?|ipads?|android|phones?|macs?|macbooks?|laptops?|computers?|chromebooks?|tablets?|workstations?|company portal)\b|\bintune\b(?!\s+(?:basics|training|courses?|class(?:es)?|webinars?|workshops?|lessons?|modules?|certifications?|exams?|learning|bootcamps?|101|fundamentals)\b)|\[DEVICE_NAME\]|\b[DL]T-)[^.]*\bun-?enroll(?:s|ed|ing|ment)?\b|\b(?:delete|remove)\b[^.]*\bhosts?\b(?![- ]file)/i, label: 'Fleet host lock, MDM turn-off / unenroll, or host deletion (SR-2)' },
  { pattern: /\b(?:run|runs|running|execute[sd]?|executing|push(?:es|ed|ing)?|deploy(?:s|ed|ing)?)\b[^.]*\bscripts?\b[^.]*\bfleet(?:ctl|dm)?\b|\bfleet(?:ctl|dm)?\b[^.]*\b(?:run|runs|running|execute[sd]?|executing|push(?:es|ed|ing)?|deploy(?:s|ed|ing)?)\b[^.]*\bscripts?\b/i, label: 'Fleet script run on hosts (code runs on endpoints, SR-2 extended-gate class)' },
  { pattern: /\b(?:lock|wipe|erase|install|uninstall|delete|remove|transfer|unenroll|run|execute|push|deploy|update|upgrade|scope|redeploy|enable|disable)\w*\b[^.]*(?:\b(?:all|every|entire)\b[^.]*\bhosts?\b|\b(?:1[1-9]|[2-9]\d|\d{3,})\s*(?:\+\s*)?hosts\b)/i, label: 'fleet-wide host operation (mass)' },
  // G2: Linear (the IT ticket system)
  // needs a Linear anchor (Linear, [ISSUE_ID] or an issue key) in the same sentence, so
  // "Outlook keeps deleting emails, the issue started" and "deleted a Teams chat" stay clean
  { pattern: LINEAR_DELETION, label: 'Linear issue / project / label / team deletion (SR-2)' },
  { pattern: /\b(?:bulk|mass)\b[^.]*\b(?:delete|archive|close|cancel|move|update|edit|relabel|label|assign|reassign|mark|trash)\w*\b|\b(?:delete|archive|close|cancel|move|update|edit|relabel|label|assign|reassign|mark|trash)\w*\b[^.]*(?:\b(?:all|every)\b[^.]*\b(?:issues?|tickets?|requests?)\b|\b(?:1[1-9]|[2-9]\d|\d{3,})\s*(?:\+\s*)?(?:\w+\s+)?(?:issues|tickets|requests)\b)/i, label: 'Linear bulk issue operation (mass)' },
  { pattern: /\b(?:suspend|deactivate|remove|kick)\w*\b[^.]*\bmembers?\b/i, label: 'workspace member suspension or removal (SR-2)' },
  { pattern: /\b(?:deactivat\w*|suspend\w*|kick\w*|disabl\w*|offboard\w*)\b[^.]*(?:\[FIRST_NAME\]|\[LAST_NAME\]|\[USER_ID\]|\[USER@DOMAIN\.COM\]|\[UPN\]|\b(?:guests?|users?|members?|accounts?|people|person|employees?|contractors?|staff)\b)[^.]*\b(?:slack|linear)\b|\b(?:slack|linear)\b[^.]*\b(?:deactivat\w*|suspend\w*|kick\w*|disabl\w*|offboard\w*)\b[^.]*(?:\[FIRST_NAME\]|\[LAST_NAME\]|\[USER_ID\]|\[USER@DOMAIN\.COM\]|\[UPN\]|\b(?:guests?|users?|members?|accounts?|people|person|employees?|contractors?|staff)\b)|\bremov\w*\b[^.]*\bfrom\b(?:\s+the)?\s+(?:slack|linear)\b/i, label: 'Slack or Linear member deactivation, suspension or removal (SR-2)' },
  { pattern: /\b(?:disable[sd]?|disabling|turn(?:s|ed|ing)?\s*off|switch(?:es|ed|ing)?\s*off|relax\w*|remove[sd]?|removing|bypass\w*|unenforce\w*)\b[^.]*\b(?:saml|scim|sso|single sign-on|login methods?|sign-in methods?|authentication methods?)\b/i, label: 'SSO / SCIM / sign-in method change (security control, SR-2)' },
  // G2: Slack
  // needs a Slack anchor (Slack, a channel, DMs or the workspace) in the same sentence, so
  // "Delete temporary files on [DEVICE_NAME]" stays clean
  { pattern: /\b(?:delete[sd]?|deleting|purge[sd]?|purging)\b(?=[^.]*\b(?:messages?|files?|channels?|conversations?|dms?|direct messages|threads?|chat history)\b)(?:(?=[^.]*(?:\bslack\b|#\[CHANNEL_NAME\]|#[a-z0-9][\w-]*|\[CHANNEL_ID\]|\bchannels?\b|\bdms?\b|\bdirect messages\b|\bworkspace\b))|(?<=(?:\bslack\b|#\[CHANNEL_NAME\]|#[a-z0-9][\w-]*|\[CHANNEL_ID\]|\bchannels?\b|\bdms?\b|\bdirect messages\b|\bworkspace\b)[^.]*))/i, label: 'Slack message / file / channel deletion (SR-2)' },
  { pattern: /\bexport\w*\b[^.]*\b(?:messages|dms|direct messages|private channels|conversations|chat history|workspace data)\b/i, label: 'message or workspace data export (disclosure, SR-2 class)' },
  { pattern: /\breset\w*\b[^.]*\bsessions?\b|\bsign(?:s|ed|ing)?\s*out\b[^.]*\bsessions?\b/i, label: 'session reset / sign-out (SR-2 session class)' },
  { pattern: /\b(?:sign|log)\s+(?!(?:in|on|into|up)\b)(?:(?!(?:and|but|or|then|to)\b)(?:\[[A-Z_@.]+\]|\w+)\s+){1,4}out\b[^.]*\b(?:sessions?|everywhere|every device|all devices)\b/i, label: 'sign-out everywhere: a person signed out of every session or device (SR-2 session class)' },
  { pattern: /\b(?:change[sd]?|changing|shorten\w*|reduc\w*|lower\w*|set|sets|setting|turn(?:s|ed|ing)?\s+off|disabl\w*|delet\w*|remov\w*)\b[^.]*\b(?:messages?|files?|channels?|conversations?|workspace|slack|data)\b[^.]*\bretention\b|\b(?:change[sd]?|changing|shorten\w*|reduc\w*|lower\w*|set|sets|setting|turn(?:s|ed|ing)?\s+off|disabl\w*|delet\w*|remov\w*)\b[^.]*\bretention\b[^.]*\b(?:messages?|files?|channels?|conversations?|workspace|slack|data)\b/i, label: 'retention change (records preservation)' },
  { pattern: /\bdisconnect\w*\b[^.]*\b(?:slack connect|organi[sz]ations?|external (?:orgs?|organi[sz]ations?|channels?|workspaces?))\b/i, label: 'Slack Connect disconnection (R3)' },
  // G2: Jamf Pro (beyond G1's lock, erase and unmanage)
  { pattern: /\b(?:disable[sd]?|disabling|turn(?:s|ed|ing)?\s*off|decrypt\w*|remove[sd]?|removing|deactivate[sd]?|deactivating)\b[^.]*\b(?:filevault|disk encryption)\b/i, label: 'FileVault / disk-encryption turned off (security control, SR-2)' },
  { pattern: /\b(?:delete|remove)\b[^.]*\b(?:computer|mobile device) records?\b/i, label: 'computer or mobile-device record deletion (SR-2)' },
  { pattern: /\b(?:lock|wipe|erase|install|uninstall|delete|remove|deploy|push|update|upgrade|scope|redeploy|enable|disable|run)\w*\b[^.]*(?:\b(?:all|every|entire)\b[^.]*\b(?:computers?|macs?|macbooks?|mobile devices?|endpoints?|ipads?|iphones?)\b|\b(?:1[1-9]|[2-9]\d|\d{3,})\s*(?:\+\s*)?(?:computers|macs|macbooks|mobile devices|endpoints|ipads|iphones)\b)/i, label: 'fleet-wide computer or Mac operation (mass)' },
  // G2: Google Workspace (beyond G1)
  { pattern: /\b(?:allow(?:s|ed|ing)?|enabl(?:e|es|ed|ing)|turn(?:s|ed|ing)?\s+on|open(?:s|ed|ing)?(?:\s+up)?|permit(?:s|ted|ting)?)\b[^.]*\b(?:external sharing|sharing outside|share\w*\s+(?:externally|outside)|outside (?:the )?(?:domain|organi[sz]ation|company)|public links?|anyone with the link)/i, label: 'external sharing opened (data exposure, security control)' },
  { pattern: /\b(?:allow(?:s|ed|ing)?|enabl(?:e|es|ed|ing)|turn(?:s|ed|ing)?\s+on|permit(?:s|ted|ting)?)\b[^.]*\bauto(?:matic)?[- ]?forward/i, label: 'Gmail automatic forwarding allowed (exfiltration path, security control)' },
  { pattern: /\b(?:remove[sd]?|removing|revok(?:e|es|ed|ing)|unassign\w*|demot\w*|strip\w*)\b[^.]*\b(?:super[- ]?admin|admin(?:istrator)?[- ](?:roles?|rights|privileges?|access))/i, label: 'admin-role removal (privilege change, SR-2 class)' },
  { pattern: /\b(?:allow(?:s|ed|ing)?|enabl(?:e|es|ed|ing)|turn(?:s|ed|ing)?\s+on|trust(?:s|ed|ing)?)\b[^.]*\b(?:less secure apps?|legacy (?:access|auth\w*|protocols?)|unconfigured third-party apps|all third-party apps|unrestricted (?:api|app) access)/i, label: 'legacy or third-party app access opened (security control)' },
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
// so AegionCo or Aegion-Co is another org. A dot separates words like a hyphen, so
// [@Contoso.DOMAIN] is found too. Inside the own namespace the rest must be exactly one
// dictionary suffix: [@Aegion_Contoso_DOMAIN] names a second org. The body cannot hold
// "[", so an unclosed token cannot swallow the next one. A chat handle ([@jane_doe],
// [@bob_site_visit], [@alex_IT]) is not an org token: its suffix is not a dictionary suffix.
// A bracketed handle whose last word is a dictionary suffix ([@it_voip], [@ops-wan])
// cannot be told from a second org's token ([@globex_domain]), so it reads as one: the
// gate fails safe, and the refusal tells the operator to write a handle without brackets.
const ORG_TOKEN = /\[@\s*([A-Za-z][A-Za-z0-9_.\s-]{0,79})\]/g;
const OWN_ORG_NAMESPACE = /^Aegion(?:[\s_]|$)/i;
const ORG_TOKEN_SUFFIXES = new Set(['ALARM', 'DOMAIN', 'DOMAIN_SHORT', 'DOMAIN_SP', 'FINANCE_SERVER', 'GWS_CUSTOMER_ID', 'ISP',
  'JAMF_URL', 'JIRA_SPACE', 'JIRA_URL', 'NETPARTNER', 'OKTA_ORG_URL', 'REMOTE_ACCESS', 'SITE_2', 'SITE_3', 'SITE_4',
  'SITE_COUNT', 'SIZE', 'VOIP', 'VOIP_LEGACY', 'VOIP_URL', 'WAN', 'XYZ',
  // G2: Fleet, Slack and Linear
  'FLEET_URL', 'SLACK_URL', 'SLACK_TEAM_ID', 'LINEAR_ORG', 'LINEAR_TEAM']);
function orgTokenWords(body) {
  return body.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/([A-Za-z])(\d)/g, '$1_$2').replace(/(\d)([A-Za-z])/g, '$1_$2')
    .toUpperCase().split(/[\s_.-]+/).filter(Boolean);
}
function isOrgSuffix(suffix) {
  return ORG_TOKEN_SUFFIXES.has(suffix) || ORG_TOKEN_SUFFIXES.has(suffix.replace(/_\d+$/, '')) || /^SITE_\d+$/.test(suffix);
}
function isForeignOrgBody(body) {
  const words = orgTokenWords(body);
  // own namespace: [@Aegion] or [@Aegion_<suffix>]; a word between them is a second org
  const first = OWN_ORG_NAMESPACE.test(body) ? 2 : 1;
  if (first === 2 && (words.length === 1 || isOrgSuffix(words.slice(1).join('_')))) return false;
  for (let k = first; k < words.length; k += 1) {
    if (isOrgSuffix(words.slice(k).join('_'))) return true;
  }
  return false;
}
// forms: pass foldedForms(text) when the caller already has them (one fold per line).
function hasForeignOrgToken(text, forms = foldedForms(text)) {
  return forms.some((f) => Array.from(f.matchAll(ORG_TOKEN)).some((m) => isForeignOrgBody(m[1])));
}

// A tenant literal (SR-8) is found as written and in the folded forms, so a zero-width
// character or a look-alike letter inside it does not get it past the gate. The literal
// is folded the same way, so an accented org name still matches its folded text. The
// needles are computed once per literal; lowerForms lets a caller lower-case a line once.
const NEEDLES = new Map();
function literalNeedles(literal) {
  const key = String(literal);
  if (!NEEDLES.has(key)) NEEDLES.set(key, Array.from(new Set([key.toLowerCase(), foldConfusables(key).toLowerCase()])).filter(Boolean));
  return NEEDLES.get(key);
}
function containsLiteral(text, literal, forms = foldedForms(text), lowerForms = forms.map((f) => f.toLowerCase())) {
  const needles = literalNeedles(literal);
  return needles.length > 0 && lowerForms.some((f) => needles.some((n) => f.includes(n)));
}

// A bracketed token is exempt from a PII scan only when it IS a canonical placeholder:
// the literal [USER@DOMAIN.COM], the [@Aegion_*] family, or an upper-case token with no
// "@" and fewer than four digits ([UPN], [JIRA-###], [PHONE_NUMBER], [SITE_2]).
// maskCanonicalPlaceholders blanks those and leaves everything else, so a real address
// next to a placeholder, or a phone number dressed as one, is still scanned.
function isCanonicalPlaceholder(tok) {
  if (tok === '[USER@DOMAIN.COM]') return true;
  if (/^\[@Aegion_[A-Za-z0-9_]*\]$/.test(tok)) return true;
  // Four or more digits make it data, not a placeholder (a real number behind [TEL-).
  return !tok.includes('@') && /^\[[A-Z0-9_.,/#-]+\]$/.test(tok) && /[A-Z]/.test(tok) && (tok.match(/\d/g) || []).length < 4;
}
function maskCanonicalPlaceholders(text) {
  return String(text).replace(/\[[^\]\n]*\]/g, (tok) => (isCanonicalPlaceholder(tok) ? ' ' : tok));
}

// Personal data (SR-1), one rule for the graph edge sanitizer, the memory store and the
// replay cache. An email-shaped literal is personal data unless its domain is an RFC
// example domain ("#" is part of the literal, so a guest UPN ...#EXT#@tenant is one
// literal); a phone number is any of the forms below. Callers blank the canonical
// placeholders first (maskCanonicalPlaceholders), so [USER@DOMAIN.COM] is not data.
const EMAIL_LITERAL = /[A-Za-z0-9._%+#-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const ALLOWED_EMAIL_DOMAIN = /(^|\.)example\.(com|org|net)$/i;
// dashed, dotted, spaced, parenthesised area code, +country with 2 to 4 groups,
// +country (0) trunk form, E.164 without separators, bare ten digits
const PHONE_LITERAL = /(?:\(\d{3}\)\s?\d{3}[-.\s]?\d{4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\+\d{1,3}\s*\(0\)\s*\d{2,4}(?:[\s-]\d{2,4}){1,4}\b|\+\d{1,3}(?:[\s-]\d{2,4}){2,4}\b|\+\d{9,15}\b|\b\d{10}\b)/;
// The kinds of personal data in the text: 'email' and 'phone', each at most once.
function personalDataIn(text) {
  const s = String(text);
  const found = [];
  for (const m of s.matchAll(EMAIL_LITERAL)) {
    if (!ALLOWED_EMAIL_DOMAIN.test(m[0].slice(m[0].indexOf('@') + 1))) { found.push('email'); break; }
  }
  if (PHONE_LITERAL.test(s)) found.push('phone');
  return found;
}

module.exports = {
  assess, foldConfusables, ESCALATION_PATTERNS,
  foldedForms, INJECTION_MARKERS, injectionMarkersIn, ORG_TOKEN, ORG_TOKEN_SUFFIXES, hasForeignOrgToken, containsLiteral,
  isCanonicalPlaceholder, maskCanonicalPlaceholders,
  EMAIL_LITERAL, ALLOWED_EMAIL_DOMAIN, PHONE_LITERAL, personalDataIn,
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
