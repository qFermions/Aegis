// Prints the sha256 of the prompts the unchanged code builds for fixed cases with no setup (batch 11, task 1).
// Run from the repository root before any edit: node <this file>
const crypto = require('node:crypto');
const path = require('node:path');

const root = process.cwd();
const backends = require(path.join(root, 'scripts/eval/judged/backends.js'));
const judge = require(path.join(root, 'scripts/eval/judged/judge.js'));
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

const TICKET = 'Pinned ticket for [UPN]: Outlook asks for the password again.';
const EVIDENCE = 'AADSTS50126 at 09:14\nStatus: Failure';
console.log('sut, no evidence:', sha(backends.buildSutPrompt({ ticket: TICKET, evidence: '', follow_up: '' })));
console.log('sut, evidence:   ', sha(backends.buildSutPrompt({ ticket: TICKET, evidence: EVIDENCE, follow_up: '' })));

const kase = (over = {}) => ({
  id: 'PIN1', platform: 'microsoft', class: 'DIAGNOSTIC', probe: '', scenario: 'pin',
  ticket: TICKET, evidence: EVIDENCE, follow_up: '',
  expected: { first_move: 'Check the sign-in log first.', must: ['Names the sign-in log.', 'Names the read-back.'], must_not: ['Claims it reset the password.'], escalate: 'no', change_class: 'R1', read_back: 'The sign-in shows Success.' },
  judge_notes: 'Pinned notes for the judge.', ...over,
});
const sut = { state: 'OK', answer: 'Pinned answer: the administrator checks the sign-in log.', follow_up_answer: 'Pinned second answer.' };
const random = () => Buffer.alloc(12, 0x5a);
console.log('judge, one turn: ', sha(judge.buildJudgePrompt(kase(), sut, { random }).prompt));
console.log('judge, follow-up:', sha(judge.buildJudgePrompt(kase({ follow_up: 'Still failing after the reset.', evidence: '' }), sut, { random }).prompt));
