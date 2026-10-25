$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is not installed.' }
if (-not (Test-Path .git)) { git init -b main }
git checkout -B main
git add .
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m 'Deploy GeoInTime Commercial Studio to Vercel'; if ($LASTEXITCODE -ne 0) { throw 'git commit failed' } }
git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) { git remote set-url origin 'https://github.com/mahmoud-ammar584/Geointime.git' }
else { git remote add origin 'https://github.com/mahmoud-ammar584/Geointime.git' }
git push -u origin main
if ($LASTEXITCODE -ne 0) { throw 'Push failed. Sign into GitHub with Git Credential Manager.' }
