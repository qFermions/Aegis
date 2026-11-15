#!/bin/bash
# Start Aegis.command: double-click on a Mac to start Aegis. It runs scripts/start-aegis.js from this folder.
# What it saves and how to reset it: docs/aegis/start-aegis.md

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Aegis needs Node.js. Install it from https://nodejs.org, then double-click Start Aegis again."
  read -r -p "Press Enter to close this window. " _
  exit 1
fi

node scripts/start-aegis.js
code=$?
if [ "$code" -ne 0 ]; then
  read -r -p "Aegis stopped with an error (code $code). Press Enter to close this window. " _
fi
exit "$code"
