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

const ESCALATION_PATTERNS = [
  // SR-2 destructive class — gated regardless of how routine the wording sounds
  { pattern: /\bwipe\b|Clear-MobileDevice|Fresh\s*Start|factory[- ]reset/i, label: 'device wipe / factory reset (SR-2)' },
  { pattern: /\b(delete|remove|purge)\b[^.]*\b(user|users|account|accounts|mailbox|mailboxes|group|groups|ou|org(anizational)? unit)\b/i, label: 'account/mailbox/group/OU deletion (SR-2)' },
  { pattern: /\b(disable|suspend|block|deactivate)\b[^.]*\b(user|users|account|accounts|sign[- ]?in|login|credential)\b/i, label: 'account disable / sign-in block (SR-2)' },
  { pattern: /\b(remove|revoke|reclaim|unassign)\b[^.]*\blicen[cs]e/i, label: 'license removal (SR-2)' },
  { pattern: /\b(remove|revoke)\b[^.]*\b(from|member)[^.]*\bgroup\b/i, label: 'group membership removal (SR-2)' },
  { pattern: /revoke[^.]*\bsession|sign[- ]?out[^.]*\b(all|every)\b|Revoke-MgUserSignInSession/i, label: 'session revocation (SR-2)' },
  { pattern: /\b(disable|bypass|turn\s*off|relax|exclude[^.]*from)\b[^.]*\b(mfa|2sv|2fa|two[- ](step|factor)|conditional access|ca polic|defender|firewall|antivirus|dlp|audit(ing)? log)/i, label: 'security-control change (SR-2)' },
  { pattern: /\boffboard|termination|leaver|separat(ed|ion)\b/i, label: 'offboarding flow (destructive multi-step — existing /offboard path)' },
  // Mass / broad blast radius — numbers, "all", org-wide phrasing
  { pattern: /\b(all|every|entire|org[- ]?wide|company[- ]?wide|tenant[- ]?wide|domain[- ]?wide)\b[^.]*\b(user|users|staff|employee|employees|account|accounts|device|devices|mailbox|mailboxes|machine|machines|workstation)/i, label: 'org-wide / all-objects operation (mass)' },
  { pattern: /\b(1[1-9]|[2-9]\d|\d{3,})\s*(\+\s*)?(user|users|employee|employees|account|accounts|device|devices|mailbox|mailboxes|machine|machines|member|members|staff|contractor|contractors|people)\b/i, label: 'mass operation (>10 objects)' },
  // Self-permission / arbitrary execution (existing extended gate)
  { pattern: /settings\.local\.json|Invoke-Expression|\bIEX\b|Install-Module|git push --force|git reset --hard/i, label: 'extended-gate operation (SR-2)' },
];

function assess(text) {
  const triggers = [];
  for (const { pattern, label } of ESCALATION_PATTERNS) {
    if (pattern.test(text)) triggers.push(label);
  }
  return { floor: triggers.length ? 'T3' : 'none', triggers };
}

module.exports = { assess, ESCALATION_PATTERNS };

if (require.main === module) {
  const i = process.argv.indexOf('--ticket');
  const ticket = i >= 0 ? process.argv[i + 1] : undefined;
  if (!ticket) {
    console.error(JSON.stringify({ ok: false, error: 'usage: tier-guard.js --ticket "<text>"' }));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, ...assess(ticket) }, null, 2));
}
