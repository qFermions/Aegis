'use strict';
// okta-verify-loop.test.js: the Okta Verify sign-in loop after a macOS update (batch 9, task 8).
//
// EXPECTED DECISION (written before the runbook section)
// - /okta-mfa-reset has a section "Okta Verify sign-in loop after a macOS update" with the source line
//   "Source: operator-validated by the owner, 2026-11-06; not in Okta's published troubleshooting pages".
// - Its steps come in this order: two or three "**User check:**" steps (reinstalling Okta Verify is
//   not the first one: the ticket says it was already reinstalled), then the admin step as the PREVIEW
//   ONLY marker okta-verify-loop-admin-reauth reading "admin re-authentication in the Okta Admin
//   Console (exact menu action to be confirmed by the owner)", then Reset Authenticators as the last
//   resort, pointing to the existing reset gates, which stay in the runbook.
// - The marker names no menu path (the owner's fill-in line was blank) and authorizes nothing.
// Run: node --test scripts/okta-verify-loop.test.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const FILE = path.join(__dirname, '..', '.claude', 'commands', 'okta-mfa-reset.md');
const TEXT = fs.readFileSync(FILE, 'utf8');
const TITLE = 'Okta Verify sign-in loop after a macOS update';
const MARKER = '**PREVIEW ONLY [okta-verify-loop-admin-reauth]:** admin re-authentication in the Okta Admin Console (exact menu action to be confirmed by the owner)';

// The section's lines: from its heading to the next heading of the same or a higher level.
function section() {
  const lines = TEXT.split('\n');
  const start = lines.findIndex((l) => /^#{2,3} /.test(l) && l.replace(/^#+ /, '').trim() === TITLE);
  if (start < 0) return null;
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) if (/^#+ /.test(lines[i]) && lines[i].match(/^#+/)[0].length <= level) { end = i; break; }
  return lines.slice(start, end);
}

test('the section exists in /okta-mfa-reset with its source line, word for word', () => {
  // catches: the section put in another runbook, or a source line that claims Okta published the fix
  const s = section();
  assert.ok(s, `no "${TITLE}" section in okta-mfa-reset.md`);
  assert.ok(s.includes("Source: operator-validated by the owner, 2026-11-06; not in Okta's published troubleshooting pages"), 'the exact source line');
});

test('user checks come first, then the admin PREVIEW ONLY marker, then Reset Authenticators as the last resort', () => {
  // catches: the reset (or the admin step) listed before the user checks, or a reset step with no user check at all
  const s = section();
  assert.ok(s, 'section present');
  const checks = s.map((l, i) => (/^\s*(?:\d+[.)]\s+|[-*]\s+)?\*\*User check:\*\*\s*\S/.test(l) ? i : -1)).filter((i) => i >= 0);
  const marker = s.findIndex((l) => l.includes(MARKER));
  const reset = s.findIndex((l, i) => i > marker && /Reset Authenticators/.test(l));
  assert.ok(checks.length >= 2 && checks.length <= 3, `two or three user checks, found ${checks.length}`);
  assert.ok(marker > 0, 'the admin step is the exact PREVIEW ONLY marker');
  assert.ok(checks.every((i) => i < marker), 'every user check comes before the admin step');
  assert.ok(reset > marker, 'Reset Authenticators comes after the admin step');
  assert.ok(!s.slice(0, marker).some((l) => /Reset Authenticators/.test(l)), 'no reset before the admin step');
  assert.match(s[reset], /last resort/i, 'the reset is labeled the last resort');
});

test('the first user check is not a reinstall, since Okta Verify was already reinstalled', () => {
  // catches: "reinstall Okta Verify" as step 1, the step the ticket says was already done
  const s = section();
  assert.ok(s, 'section present');
  const first = s.find((l) => /\*\*User check:\*\*/.test(l));
  assert.ok(first, 'a user check');
  assert.doesNotMatch(first, /reinstall/i);
});

test('the reset step points to the existing reset gates, which are still in the runbook', () => {
  // catches: a new or renamed reset gate invented for this section, or a pointer to a gate that does not exist
  const s = section();
  assert.ok(s, 'section present');
  const body = s.join('\n');
  for (const gate of ['okta-mfa-reset-selected-portal', 'okta-mfa-reset-all-portal']) {
    assert.match(body, new RegExp(`\`${gate}\``), `the section names ${gate}`);
    assert.ok(TEXT.includes(`<!-- SAFETY GATE [${gate}] -->`), `${gate} is still a gate`);
  }
  assert.doesNotMatch(body, /SAFETY GATE \[/, 'the section adds no gate of its own');
});

test('the admin marker invents no menu path and authorizes nothing', () => {
  // catches: a guessed console path (an arrow breadcrumb) written into the marker, or a marker that reads as authorized
  const s = section();
  assert.ok(s, 'section present');
  const line = s.find((l) => l.includes(MARKER));
  assert.ok(line, 'marker present');
  assert.doesNotMatch(line, /→/);
  assert.match(line, /Planning only/);
  assert.match(line, /UNCONFIRMED/);
});
