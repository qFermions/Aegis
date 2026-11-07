#!/usr/bin/env bash
# failing-names.sh <node-test.txt>: the failing test names in one node --test capture, one per line, sorted:
# the leading tab and the trailing duration taken off, so two captures compare by name alone.
grep -E '^\s*✖ ' "$1" | sed -E 's/^\s*✖ //; s/ \([0-9.]+m?s\)$//' | grep -v '^failing tests:$' | sort -u
