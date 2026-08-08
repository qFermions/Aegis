#!/usr/bin/env node
'use strict';
// claim.js — repository-local task claims for concurrent Claude Code sessions.
//
// Multiple sessions may develop Aegis simultaneously; this is the smallest
// reliable mechanism preventing two sessions from unknowingly editing the same
// scope. A claim is a per-task file in tasks/active/ created with O_EXCL
// (atomic on one machine — sessions share this working tree). Claiming is
// refused when any ACTIVE task's file scope overlaps the requested scope.
// Internal development coordination only — not workday/production automation.
//
//   node scripts/dev/claim.js claim   --task <id> --owner "<who>" --scope "p1,p2" [--intent "<text>"]
//   node scripts/dev/claim.js check   --scope "p1,p2"        (report only)
//   node scripts/dev/claim.js list
//   node scripts/dev/claim.js release --task <id> [--summary "<result>"]
//
// Exit: 0 ok · 1 refused/error (collision refusal is exit 1 and names the owner).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ACTIVE = path.join(ROOT, 'tasks', 'active');
const DONE = path.join(ROOT, 'tasks', 'completed');

const norm = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '').trim();
function overlaps(a, b) {
  // one path equal to, containing, or contained by the other = same scope
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}
function parseScope(s) {
  const list = String(s || '').split(',').map(norm).filter(Boolean);
  if (!list.length) fail('empty --scope');
  return list;
}
function activeTasks() {
  if (!fs.existsSync(ACTIVE)) return [];
  return fs.readdirSync(ACTIVE).filter((f) => f.endsWith('.md')).map((f) => {
    const src = fs.readFileSync(path.join(ACTIVE, f), 'utf8');
    const g = (k) => (src.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1] || '';
    return { file: f, task: f.replace(/\.md$/, ''), owner: g('owner'), scope: g('scope').split(',').map(norm).filter(Boolean), started: g('started') };
  });
}
function collisions(scope, excludeTask) {
  const hits = [];
  for (const t of activeTasks()) {
    if (t.task === excludeTask) continue;
    for (const mine of scope) for (const theirs of t.scope) {
      if (overlaps(mine, theirs)) hits.push({ task: t.task, owner: t.owner, theirs, mine });
    }
  }
  return hits;
}
function out(o) { console.log(JSON.stringify(o, null, 2)); }
function fail(msg, extra) { console.error(JSON.stringify({ ok: false, error: msg, ...extra })); process.exit(1); }

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : undefined; };

switch (cmd) {
  case 'claim': {
    const task = opt('task'); const owner = opt('owner'); const scope = parseScope(opt('scope'));
    if (!task || !owner) fail('usage: claim --task <id> --owner "<who>" --scope "p1,p2"');
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(task)) fail('task id must be alphanumeric/dashes');
    const hits = collisions(scope, null);
    if (hits.length) fail('SCOPE COLLISION — another active task owns overlapping files; wait or hand off explicitly, never overwrite', { collisions: hits });
    fs.mkdirSync(ACTIVE, { recursive: true });
    const body = `owner: ${owner}\nstarted: ${new Date().toISOString()}\nscope: ${scope.join(',')}\nintent: ${opt('intent') || ''}\nstatus: active\n\n## Notes\n`;
    try {
      const fd = fs.openSync(path.join(ACTIVE, task + '.md'), 'wx'); // O_EXCL: atomic claim
      fs.writeFileSync(fd, body); fs.closeSync(fd);
    } catch (e) {
      if (e.code === 'EEXIST') fail(`task "${task}" is already claimed — pick another id or coordinate with its owner`);
      throw e;
    }
    out({ ok: true, task, owner, scope });
    break;
  }
  case 'check': {
    const hits = collisions(parseScope(opt('scope')), opt('task'));
    out({ ok: true, clear: hits.length === 0, collisions: hits });
    break;
  }
  case 'list': {
    out({ ok: true, active: activeTasks() });
    break;
  }
  case 'release': {
    const task = opt('task');
    if (!task) fail('usage: release --task <id> [--summary "<result>"]');
    const src = path.join(ACTIVE, task + '.md');
    if (!fs.existsSync(src)) fail(`no active claim for "${task}"`);
    fs.mkdirSync(DONE, { recursive: true });
    const body = fs.readFileSync(src, 'utf8').replace(/^status: active$/m, 'status: completed')
      + `\ncompleted: ${new Date().toISOString()}\nsummary: ${opt('summary') || ''}\n`;
    fs.writeFileSync(path.join(DONE, task + '.md'), body);
    fs.unlinkSync(src);
    out({ ok: true, task, archived: `tasks/completed/${task}.md` });
    break;
  }
  default:
    fail('usage: claim.js <claim|check|list|release> …');
}
