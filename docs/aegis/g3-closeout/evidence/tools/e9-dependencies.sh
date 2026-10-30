#!/usr/bin/env bash
# e9-dependencies.sh <base>: package manifests and lockfiles at HEAD and changed since <base>, and every require() or import added since <base> that is not node: or a relative path (charter check E9). Run from the repository root.
BASE="$1"
echo "--- package manifests or lockfiles tracked at HEAD:"
git ls-files | grep -E -i '(^|/)(package(-lock)?\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|requirements[^/]*\.txt|Pipfile(\.lock)?|pyproject\.toml|Gemfile(\.lock)?|go\.(mod|sum)|Cargo\.(toml|lock)|composer\.(json|lock))$' | grep -v '^shared/' | wc -l
echo "--- of those, changed since $BASE:"
git diff --name-only "$BASE"..HEAD | grep -E -i '(^|/)(package(-lock)?\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|requirements[^/]*\.txt|Pipfile(\.lock)?|pyproject\.toml|Gemfile(\.lock)?|go\.(mod|sum)|Cargo\.(toml|lock)|composer\.(json|lock))$' | wc -l
echo "--- require() or import of a module that is not node: or a relative path, on lines added since $BASE:"
git diff "$BASE"..HEAD -- '*.js' '*.mjs' '*.cjs' | grep -E "^\+" | grep -E "require\(['\"]|^\+\s*import .* from ['\"]" | grep -v -E "require\(['\"](node:|\./|\.\./)|from ['\"](node:|\./|\.\./)" | wc -l
echo "--- tools: $(node --version) (node), $(pwsh --version 2>/dev/null)"
