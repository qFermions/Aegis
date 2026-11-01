'use strict';
// paths.js: where the judged-eval runner may read case files and write results.
//
// - A case file (and a thresholds file) is refused when the given path, before any
//   resolution, is inside the repository working tree, or when its real path (symlinks
//   followed with fs.realpathSync) is. Case files hold the expected decisions a judge
//   grades against, so they live outside the repository; the DEV set in this directory
//   is copied to a temporary file before a run.
// - A results directory outside the repository is allowed. One inside it is allowed only
//   when `git check-ignore -q` says it is ignored and `git ls-files` lists nothing under
//   it, so a run never writes into a tracked path. Symlinks on the way are followed.
// - The default results directory is <repo>/.aegis-state/evals/<run-id>/ (.aegis-state/
//   is gitignored). A run id is a UTC timestamp plus random hex.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

class PathRefused extends Error {
  constructor(message) {
    super(message);
    this.name = 'PathRefused';
  }
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

function repoRoots(repoRoot = REPO_ROOT) {
  const given = path.resolve(repoRoot);
  let real = given;
  try { real = fs.realpathSync(given); } catch { /* keep the given form */ }
  return { given, real };
}

function insideRepo(p, roots) {
  return isInside(p, roots.given) || isInside(p, roots.real);
}

// An input file (case file, thresholds file) that must live outside the repository.
// Returns its real path; throws PathRefused.
function refuseInsideRepo(file, label, { repoRoot = REPO_ROOT } = {}) {
  if (typeof file !== 'string' || file === '') throw new PathRefused(`${label}: a path is required`);
  const roots = repoRoots(repoRoot);
  const abs = path.resolve(file);
  if (insideRepo(abs, roots)) throw new PathRefused(`${label} is inside the repository working tree: copy it to a file outside the repository (for example under the system temporary directory) and pass that path`);
  let real;
  try { real = fs.realpathSync(abs); } catch { throw new PathRefused(`${label} cannot be read (no such file)`); }
  if (insideRepo(real, roots)) throw new PathRefused(`${label} resolves (through a symlink) to a file inside the repository working tree: copy the file outside the repository and pass that path`);
  return real;
}

// The path a directory will really have: the nearest existing ancestor resolved, plus the rest.
function effectivePath(dir) {
  const abs = path.resolve(dir);
  const rest = [];
  let cur = abs;
  for (;;) {
    try {
      const real = fs.realpathSync(cur);
      return rest.length ? path.join(real, ...rest.reverse()) : real;
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return abs;
      rest.push(path.basename(cur));
      cur = parent;
    }
  }
}

function defaultGit(args, cwd) {
  try {
    const stdout = execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return { code: 0, stdout };
  } catch (e) {
    return { code: typeof e.status === 'number' ? e.status : 128, stdout: e.stdout ? String(e.stdout) : '' };
  }
}

// Throws PathRefused when results may not be written to dir. Returns the effective path.
function checkResultsDir(dir, { repoRoot = REPO_ROOT, git = defaultGit } = {}) {
  if (typeof dir !== 'string' || dir === '') throw new PathRefused('results directory: a path is required');
  const roots = repoRoots(repoRoot);
  const eff = effectivePath(dir);
  const abs = path.resolve(dir);
  const targets = [abs, eff].filter((p) => insideRepo(p, roots));
  for (const p of targets) {
    const base = isInside(p, roots.real) ? roots.real : roots.given;
    const rel = path.relative(base, p).split(path.sep).join('/');
    if (rel === '' || rel === '.git' || rel.startsWith('.git/')) throw new PathRefused('results directory is the repository root or its .git folder');
    const ignored = git(['check-ignore', '-q', '--', rel], base);
    if (ignored.code !== 0) throw new PathRefused('results directory is inside the repository and not ignored by git: choose a directory under .aegis-state/ or outside the repository');
    const tracked = git(['ls-files', '--', rel], base);
    if (tracked.code !== 0 || tracked.stdout.trim() !== '') throw new PathRefused('results directory is inside the repository and holds tracked files');
  }
  return eff;
}

function newRunId(now = new Date(), random = crypto.randomBytes) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${stamp}-${random(4).toString('hex')}`;
}

function defaultResultsDir(runId, repoRoot = REPO_ROOT) {
  return path.join(repoRoot, '.aegis-state', 'evals', runId);
}

module.exports = { REPO_ROOT, PathRefused, isInside, refuseInsideRepo, checkResultsDir, effectivePath, newRunId, defaultResultsDir };
