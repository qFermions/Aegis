'use strict';
// clarify.js: whether a ticket's right first move is one clarifying question (batch G3,
// task 4b). Pure and deterministic: no model, no I/O.
//
// A help desk that runs Okta, Microsoft 365, Google Workspace, Slack, Linear, GitHub,
// Jamf and Fleet cannot work "I can't log in" without knowing which system. The rule asks
// one question, and only when the ticket lacks what every procedure needs first:
//   group    a group change that names no group ("the usual groups", "their groups")
//   system   a sign-in, password, MFA, access or account problem that names no system
//   symptom  a short ticket (12 words or fewer) that names no system, no account problem
//            and no known request (onboarding, offboarding, phishing, a lost device)
// No question either when the ticket carries instruction-like text (the shared injection
// markers): the first move there is to flag it, not to ask the sender anything.
// Anything else gets no question: the ticket goes to its runbook, and the runbook's own
// scoping questions follow the first answer. The floor is decided separately by the tier
// guard; a ticket can need a question and still floor (the gate follows the answer).
//
// clarify(text) -> { clarify: false } or { clarify: true, kind, question } where the
// question holds exactly one "?".

const { injectionMarkersIn } = require('../tier/tier-guard.js');

// Systems, devices and places a ticket can name; a [@Aegion_*] token or a device
// placeholder names one too.
const SYSTEM = new RegExp([
  'okta', 'microsoft', 'm365', 'office ?365', 'o365', 'outlook', 'teams', 'exchange', 'entra', 'azure', 'intune', 'onedrive', 'sharepoint',
  'windows', 'autopilot', 'defender', 'google', 'gmail', 'g ?suite', 'workspace', 'drive', 'chromebooks?', 'chrome', 'slack', 'linear',
  'github', 'repo(?:sitory|sitories|s)?', 'pull requests?', 'dependabot', 'jira', 'jamf', 'fleet', 'macs?', 'macbooks?', 'imacs?', 'iphones?',
  'ipads?', 'android', 'vpn', 'wi-?fi', 'meraki', 'network', 'internet', 'printers?', 'zoom', 'laptops?', 'desktops?', 'computers?', 'pcs?',
  'monitors?', 'keyboards?', 'headsets?', 'voicemail', 'phone system', 'calendar', 'mailbox(?:es)?', 'e-?mail', 'browser', 'filevault',
  'shared drive', 'distribution list', 'dl',
].map((t) => `\\b${t}\\b`).join('|') + '|\\[@Aegion_[A-Z0-9_]+\\]|\\[(?:DEVICE_NAME|APP_NAME|SHARED_MAILBOX|DEPT_DL|CHANNEL_NAME|CHANNEL_ID|ISSUE_ID|HOST_ID|SERIAL_NUMBER)\\]|\\b[DL]T-', 'i');

// A sign-in, credential, MFA, access or account problem.
const IDENTITY = /\b(?:log ?in|logon|sign[- ]?in|signing in|password|passcode|locked out|lockout|mfa|2fa|2sv|two[- ]factor|two[- ]step|verification code|code|authenticator|access|permissions?|accounts?|admin rights|credentials?)\b/i;

// Requests that are clear without naming a system: the runbook asks the rest.
const INTENT = /\b(?:new hire|new starter|onboard\w*|offboard\w*|leaver|starts on|last day|left the company|terminat\w*|phishing|spam|suspicious (?:e-?mail|link|message)|virus|malware|ransomware|stolen|lost (?:my|their|his|her|a) (?:phone|laptop|device))\b/i;

// A group change that names no group.
const GROUP_CHANGE = /\b(?:add|remove|put|take|move|copy|give)\b[^.]*\bgroups?\b/i;
const VAGUE_GROUP = /\b(?:the|their|his|her|my|our|your|usual|right|same|correct|proper|relevant|necessary|appropriate|needed|normal|standard)\s+(?:(?:usual|right|same|correct|proper|relevant|necessary|appropriate|needed|normal|standard)\s+)?groups?\b/i;
const NAMED_GROUP = /\[(?:GROUP_NAME|GROUP|DEPT_DL|SECURITY_GROUP)\]|"[^"]{1,80}"\s+groups?\b/i;

const QUESTIONS = Object.freeze({
  group: 'Which group do you mean (its exact name), and in which system: Okta, Microsoft 365 or Google Workspace?',
  system: 'Which system is this about: Okta, Microsoft 365, Google Workspace, GitHub, Slack, or something else?',
  symptom: 'What exactly is not working, and on which device or app?',
});

function ask(kind) {
  return { clarify: true, kind, question: QUESTIONS[kind] };
}

function clarify(text) {
  const s = String(text || '').slice(0, 20000);
  if (injectionMarkersIn(s).length) return { clarify: false };
  if (GROUP_CHANGE.test(s) && VAGUE_GROUP.test(s) && !NAMED_GROUP.test(s)) return ask('group');
  if (SYSTEM.test(s)) return { clarify: false };
  if (IDENTITY.test(s)) return ask('system');
  const words = s.split(/\s+/).filter(Boolean).length;
  if (!INTENT.test(s) && words <= 12) return ask('symptom');
  return { clarify: false };
}

module.exports = { clarify, QUESTIONS };
