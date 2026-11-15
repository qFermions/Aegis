'use strict';
// paths.js: where the judged-eval runner may read case files and write results.
//
// - A case file (and a thresholds file) is refused when the given path, before any
//   resolution, is inside the repository working tree, or when its real path (symlinks
//   followed with fs.realpathSync) is. Case files hold the expected decisions a judge
//   grades against, so they live outside the repository; the DEV set in this directory
//   is copied to a temporary file before a run. The folder a case file is read from is
//   denied to the system under test (caseFolders), so it must not be a folder that holds
//   the repository: the case file goes in a folder of its own.
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

// The default macOS and Windows file systems ignore case, so there a path spelled in another case is the
// same folder. shortcut: a case-sensitive volume on those systems is folded too, which can only refuse or
// flag more, never less; upgrade if a run on such a volume is refused wrongly.
const foldCase = (p) => (process.platform === 'darwin' || process.platform === 'win32' ? p.toLowerCase() : p);

// The folders a case file is read from, which the system under test is denied (batch 11, task 7): the folder
// of the path as given and the folder the file really sits in (they differ when the file is a link). Throws
// PathRefused when one of them, as given or resolved, is the repository or holds it (the home folder, the
// root): denying such a folder would deny the runbooks too. `real` is the file's real path.
function caseFolders(file, real, { repoRoot = REPO_ROOT } = {}) {
  const roots = repoRoots(repoRoot);
  const folders = [...new Set([path.dirname(path.resolve(file)), path.dirname(real)])];
  for (const dir of folders) {
    for (const form of [dir, effectivePath(dir)]) {
      if ([roots.given, roots.real].some((root) => isInside(foldCase(root), foldCase(form)))) {
        throw new PathRefused('the case file sits in a folder that holds the repository (for example the home folder), and the system under test is denied the case file\'s folder, which would deny it the repository too: put the case file in a folder of its own and pass that path');
      }
    }
  }
  return folders;
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

module.exports = { REPO_ROOT, PathRefused, isInside, repoRoots, foldCase, refuseInsideRepo, caseFolders, checkResultsDir, effectivePath, newRunId, defaultResultsDir };
