'use strict';
// asker-replies.js <out-file> <asks-root> <list.json>: builds asker-replies.md from the folders
// `ask-aegis.js --reply-to asker` saved (reply.md, answer.md, result.json), one section per ask: the ticket as it
// was typed, the reply word for word, its word count by the desk's counter, and the form check's verdict.
// list.json: [{ "id", "platform", "dir", "ticket", "setup" }]. Batch 11, task 8.
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const { words } = require(path.join(repo, 'scripts/demo/answer.js'));
const { replyProblems, askerReply } = require(path.join(repo, 'scripts/demo/senior-rules.js'));
const { catalog } = require(path.join(repo, 'scripts/demo/catalog.js'));
const [out, root, listFile] = process.argv.slice(2);
const list = JSON.parse(fs.readFileSync(listFile, 'utf8'));
const ids = catalog();
const lines = ['# Six replies to the person who asked (batch 11, task 8)', '',
  'Each reply below is what `node scripts/ask-aegis.js "<ticket>" --reply-to asker` printed for one of the builder\'s own dev tickets: text for a person to read and send. Aegis sent nothing. The word count is the desk\'s own counter; the check is `replyProblems` (`scripts/demo/senior-rules.js`): form, done claims, admin actions, times nobody set, checks nobody ran. It cannot tell whether the reply is right; that is for the reader.', ''];
let total = 0;
const rows = [];
for (const a of list) {
  const dir = path.join(root, a.dir);
  const read = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8') : null);
  const answer = read('answer.md');
  const result = read('result.json');
  const cost = result ? JSON.parse(result).total_cost_usd : null;
  if (typeof cost === 'number') total += cost;
  const model = result ? Object.keys(JSON.parse(result).modelUsage || {}).join(', ') : '';
  let reply = read('reply.md');
  if (reply === null && answer !== null) { const r = askerReply(answer, a.ticket); reply = r.present ? r.text : null; }
  lines.push(`## ${a.id} (${a.platform})`, '', `Ticket as typed: "${a.ticket}"${a.setup ? `\n\nSetup given: "${a.setup}"` : ''}`, '');
  if (reply === null) { lines.push(answer === null ? 'No session ran for this ticket.' : 'The answer held no reply to the asker.', ''); rows.push(`| ${a.id} | ${a.platform} | none | no reply | ${typeof cost === 'number' ? cost.toFixed(2) : 'none'} |`); continue; }
  const problems = replyProblems(reply, { ticket: a.ticket, setup: a.setup || '', ids });
  const n = words(reply);
  lines.push(...reply.trim().split('\n').map((l) => `> ${l}`.trimEnd()), '', `Words: ${n}. Form check: ${problems.length ? `did not pass: ${problems.join('; ')}` : 'passed'}. Cost of the session: ${typeof cost === 'number' ? cost.toFixed(2) : 'not reported'} US dollars${model ? ` (${model})` : ''}.`, '');
  rows.push(`| ${a.id} | ${a.platform} | ${n} | ${problems.length ? 'did not pass' : 'passed'} | ${typeof cost === 'number' ? cost.toFixed(2) : 'none'} |`);
}
lines.splice(4, 0, '| ticket | platform | words | form check | cost in US dollars |', '|---|---|---|---|---|', ...rows, '', `Total cost of these sessions: ${total.toFixed(2)} US dollars.`, '');
fs.writeFileSync(out, `${lines.join('\n').replaceAll(String.fromCharCode(0x2014), '-')}\n`);
console.log(lines.join('\n'));
