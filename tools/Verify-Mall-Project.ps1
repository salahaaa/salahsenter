# Read-only local preflight. Does not change files, database, Git history or Vercel.
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

try {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 22.19.0 is required." }
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is required." }
  Push-Location $ProjectRoot
  try {
    & npm run release:verify:source
    if ($LASTEXITCODE -ne 0) { throw "Release source verification failed." }
  } finally { Pop-Location }
  Write-Host "SUCCESS: Local project passed release source verification." -ForegroundColor Green
}
catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
