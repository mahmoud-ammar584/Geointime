#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v git >/dev/null; then echo 'Git is required'; exit 1; fi
if [ -f '.env.local' ]; then echo 'Local .env.local exists; verify it is ignored by Git before proceeding.'; fi
if [ ! -d .git ]; then git init -b main; fi
git checkout -B main
git add .
if git diff --cached --quiet; then echo 'Nothing new to commit.'; else git commit -m 'Deploy GeoInTime Commercial Studio to Vercel'; fi
if git remote get-url origin >/dev/null 2>&1; then git remote set-url origin 'https://github.com/mahmoud-ammar584/Geointime.git'; else git remote add origin 'https://github.com/mahmoud-ammar584/Geointime.git'; fi
git push -u origin main
