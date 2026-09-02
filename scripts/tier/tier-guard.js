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
  // Mass / broad blast radius — numbers, "all", org-wide phrasing
  { pattern: /\b(all|every|entire|org[- ]?wide|company[- ]?wide|tenant[- ]?wide|domain[- ]?wide)\b[^.]*\b(user|users|staff|employee|employees|account|accounts|device|devices|mailbox|mailboxes|machine|machines|workstation)/i, label: 'org-wide / all-objects operation (mass)' },
  { pattern: /\b(1[1-9]|[2-9]\d|\d{3,})\s*(\+\s*)?(user|users|employee|employees|account|accounts|device|devices|mailbox|mailboxes|machine|machines|member|members|staff|contractor|contractors|people)\b/i, label: 'mass operation (>10 objects)' },
  // Self-permission / arbitrary execution (existing extended gate)
  { pattern: /settings\.local\.json|Invoke-Expression|\bIEX\b|Install-Module|git push --force|git reset --hard/i, label: 'extended-gate operation (SR-2)' },
];

function assess(text) {
  const folded = foldConfusables(text);
  const triggers = [];
  for (const { pattern, label } of ESCALATION_PATTERNS) {
    if (pattern.test(folded)) triggers.push(label);
  }
  return { floor: triggers.length ? 'T3' : 'none', triggers };
}

module.exports = { assess, foldConfusables, ESCALATION_PATTERNS };

if (require.main === module) {
  const i = process.argv.indexOf('--ticket');
  const ticket = i >= 0 ? process.argv[i + 1] : undefined;
  if (!ticket) {
    console.error(JSON.stringify({ ok: false, error: 'usage: tier-guard.js --ticket "<text>"' }));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, ...assess(ticket) }, null, 2));
}
