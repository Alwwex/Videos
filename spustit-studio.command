#!/bin/bash
# macOS / Linux: dvojklik (macOS) nebo ./spustit-studio.command
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Chybí Node.js – stáhni LTS z https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install
node --import tsx studio/server.ts "$@"
