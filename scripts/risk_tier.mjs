#!/usr/bin/env node
// risk_tier.mjs: compute the review tier of the current change (REVIEW.md, "Risk tiers").
//
//   node scripts/risk_tier.mjs [<base>]
//
// Diffs <base>...HEAD plus uncommitted changes (staged, unstaged, untracked), matches every
// path against the globs in .github/risk-tiers.json, and prints `tier=C|B|A` followed by each
// path that set the tier. One C path wins over any number of B paths. Exits 0 on a result and
// 1 on any error (missing base ref, unreadable tier file), so CI fails closed. No dependencies.
//
// Globs: `**` spans directories, `*` stays inside one path segment, `?` is one character,
// matching is case-sensitive. `.github/**` also matches `.github` itself and `a/**/b` matches `a/b`.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORDER = ['C', 'B'];

export function globToRegExp(glob) {
  let out = '^';
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        // `**/` consumes the following slash so `a/**/b` matches `a/b`; a trailing `**` matches the rest
        if (glob[i + 2] === '/') { out += '(?:.*/)?'; i += 2; } else { out += '.*'; i += 1; }
      } else {
        out += '[^/]*';
      }
    } else if (ch === '?') {
      out += '[^/]';
    } else if (ch === '/' && glob.slice(i + 1) === '**') {
      // `dir/**` also matches `dir` itself
      out += '(?:/.*)?';
      i += 2;
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`${out}$`);
}

export function matchesAny(path, globs) {
  return globs.some((glob) => globToRegExp(glob).test(path));
}

export function classify(paths, tiers) {
  for (const tier of ORDER) {
    const globs = Array.isArray(tiers[tier]) ? tiers[tier] : [];
    const hits = paths.filter((p) => matchesAny(p, globs));
    if (hits.length > 0) return { tier, paths: hits };
  }
  return { tier: 'A', paths: [] };
}

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error) throw new Error(`git ${args.join(' ')}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed (exit ${result.status}): ${(result.stderr || '').trim()}`);
  return result.stdout;
}

function refExists(ref, cwd) {
  return spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd, encoding: 'utf8' }).status === 0;
}

export function defaultBranch(cwd) {
  const head = spawnSync('git', ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], { cwd, encoding: 'utf8' });
  if (head.status === 0 && head.stdout.trim()) return head.stdout.trim().replace(/^origin\//, '');
  for (const candidate of ['main', 'master']) {
    if (refExists(candidate, cwd) || refExists(`origin/${candidate}`, cwd)) return candidate;
  }
  throw new Error('cannot determine the default branch: pass a base ref');
}

export function resolveBase(base, cwd) {
  if (refExists(base, cwd)) return base;
  if (!base.startsWith('origin/') && refExists(`origin/${base}`, cwd)) return `origin/${base}`;
  throw new Error(`base ref not found: ${base} (also tried origin/${base})`);
}

// NUL-separated output (-z): git never quotes a path, so names with non-ASCII, tabs or quotes
// still match the globs. --no-renames lists both sides of a move, so a file moved out of a
// C or B path still sets that tier.
function nulSeparated(text) {
  return text.split('\0').filter(Boolean);
}

export function changedPaths(base, cwd) {
  const committed = nulSeparated(git(['diff', '--name-only', '-z', '--no-renames', `${base}...HEAD`], cwd));
  const uncommitted = nulSeparated(git(['diff', '--name-only', '-z', '--no-renames', 'HEAD'], cwd));
  const untracked = nulSeparated(git(['ls-files', '--others', '--exclude-standard', '-z'], cwd));
  return [...new Set([...committed, ...uncommitted, ...untracked])].sort();
}

export function loadTiers(file) {
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  for (const tier of ORDER) {
    if (parsed[tier] !== undefined && !Array.isArray(parsed[tier])) throw new Error(`${file}: "${tier}" must be an array of globs`);
  }
  return parsed;
}

export function run(argv, cwd, tierFile) {
  const base = resolveBase(argv[0] || defaultBranch(cwd), cwd);
  const tiers = loadTiers(tierFile);
  const result = classify(changedPaths(base, cwd), tiers);
  return [`tier=${result.tier}`, ...result.paths].join('\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const cwd = process.cwd();
  const root = git(['rev-parse', '--show-toplevel'], cwd).trim();
  const tierFile = process.env.RISK_TIERS_FILE || resolve(root, '.github', 'risk-tiers.json');
  try {
    process.stdout.write(`${run(process.argv.slice(2), root, tierFile)}\n`);
  } catch (error) {
    process.stderr.write(`risk_tier: ${error.message}\n`);
    process.exit(1);
  }
}
