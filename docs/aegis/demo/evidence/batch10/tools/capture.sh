#!/usr/bin/env bash
# capture.sh <out-file> <command...>: run one command from the repo root and save what it printed, with this
# machine's paths written <home>, <repo> and <tmp> and each long dash written -, as battery.sh does; the last
# line is the exit code. With --mask <file> instead, mask a capture already saved, in place.
set -u
repo="${REPO:-$(git rev-parse --show-toplevel)}"
tmp="${TMPDIR:-/tmp}"; tmp="${tmp%/}"
mask() { sed -e "s#/private$tmp#<tmp>#g" -e "s#$tmp#<tmp>#g" -e "s#/private/tmp#<tmp>#g" -e "s#/var/folders/[^ :)]*#<tmp>#g" -e "s#$repo#<repo>#g" -e "s#$HOME#<home>#g" -e "s#-Users-[A-Za-z0-9-]*#<project-folder>#g" -E -e "s#@[a-z0-9-]+\.example\.(com|org|net)#@[@Aegion_DOMAIN]#g" -e $'s#\xe2\x80\x94#-#g'; }
if [ "$1" = "--mask" ]; then f="$2"; mask < "$f" > "$f.masked" && mv "$f.masked" "$f"; exit 0; fi
out="$1"; shift
cd "$repo" && "$@" > "$out.raw" 2>&1; code=$?
mask < "$out.raw" > "$out"; rm -f "$out.raw"; echo "exit $code" >> "$out"
exit 0
