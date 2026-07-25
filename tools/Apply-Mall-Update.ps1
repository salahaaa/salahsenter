# Safe one-command updater for a local Mall OS Git checkout.
# It never runs database migrations or changes environment files.
[CmdletBinding()]
param(
  [string]$PackagePath,
  [string]$ExpectedSha256,
  [switch]$Publish,
  [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TempRoot = $null
$BackupBranch = $null
$UpdateStarted = $false
$Validated = $false

function Stop-Update([string]$Message) { throw "UPDATE STOPPED: $Message" }

function ConvertTo-TrimmedText([object]$Value) {
  if ($null -eq $Value) { return "" }
  return (($Value | Out-String).Trim())
}

function Invoke-Checked([string]$File, [string[]]$Arguments, [string]$Context) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { Stop-Update "$Context failed (exit code $LASTEXITCODE)." }
}

function Get-NodeVersion {
  $version = ConvertTo-TrimmedText (& node -p "process.versions.node")
  if ($LASTEXITCODE -ne 0 -or -not $version) { Stop-Update "Node.js 22.19.0 is required but node was not found." }
  $parts = $version.Split('.')
  if ($parts.Count -lt 2 -or [int]$parts[0] -ne 22 -or [int]$parts[1] -lt 19) {
    Stop-Update "Node.js 22.19.0 or newer within Node 22 is required. Current version: $version"
  }
  return $version
}

function Get-PackageChecksum([string]$ZipPath) {
  if ($ExpectedSha256) { return $ExpectedSha256.Trim().ToLowerInvariant() }
  $directory = Split-Path -Parent $ZipPath
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($ZipPath)
  $sidecars = @(
    [System.IO.Path]::ChangeExtension($ZipPath, "sha256"),
    (Join-Path $directory "$baseName-CHECKSUM.txt")
  )
  $sidecar = $sidecars | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $sidecar) {
    Stop-Update "Checksum file is missing. Place the matching .sha256 or -CHECKSUM.txt file next to the ZIP, or pass -ExpectedSha256."
  }
  $match = [regex]::Match((Get-Content -LiteralPath $sidecar -Raw), '[a-fA-F0-9]{64}')
  if (-not $match.Success) { Stop-Update "The checksum file does not contain a valid SHA-256 digest." }
  return $match.Value.ToLowerInvariant()
}

function Get-ExtractedProjectRoot([string]$Root) {
  $candidates = Get-ChildItem -LiteralPath $Root -Directory | Where-Object { Test-Path (Join-Path $_.FullName "package.json") }
  if ($candidates.Count -eq 1) { return $candidates[0].FullName }
  if (Test-Path (Join-Path $Root "package.json")) { return $Root }
  Stop-Update "The ZIP does not contain one identifiable project root with package.json."
}

function Invoke-RobocopyMirror([string]$Source, [string]$Destination) {
  if (-not (Test-Path -LiteralPath $Source)) { return }
  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  & robocopy $Source $Destination /MIR /XJ /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XD node_modules .next coverage .cache build dist out .review playwright-report test-results artifacts | Out-Null
  # Robocopy exit codes 0..7 are successful copy/no-copy outcomes.
  if ($LASTEXITCODE -ge 8) { Stop-Update "Could not synchronize source directory: $Source" }
}

function Restore-BackupBranch {
  if ($BackupBranch) {
    Write-Host "Validation failed. Restoring local source from $BackupBranch ..." -ForegroundColor Yellow
    & git -C $ProjectRoot reset --hard $BackupBranch | Out-Null
    & git -C $ProjectRoot clean -fd | Out-Null
  }
}

try {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Stop-Update "Git is required. Install Git for Windows first." }
  Get-NodeVersion | Out-Null

  if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ".git"))) {
    Stop-Update "This updater must run inside the initialized local Git checkout. Run Initialize-Mall-Update-Channel.ps1 once first."
  }

  $branch = ConvertTo-TrimmedText (& git -C $ProjectRoot branch --show-current)
  if ($branch -ne "staging") { Stop-Update "Current Git branch is '$branch'. Switch to the staging branch before applying an update." }
  $status = (& git -C $ProjectRoot status --porcelain)
  if ($status) { Stop-Update "The local checkout has uncommitted changes. Commit/stash them before applying an update." }
  $email = ConvertTo-TrimmedText (& git -C $ProjectRoot config user.email 2>$null)
  $name = ConvertTo-TrimmedText (& git -C $ProjectRoot config user.name 2>$null)
  if (-not $email -or -not $name) { Stop-Update "Configure Git user.name and user.email once before using the updater." }

  if (-not $PackagePath) { $PackagePath = ConvertTo-TrimmedText (Read-Host "Paste the full path of the downloaded update ZIP") }
  $PackagePath = [System.IO.Path]::GetFullPath((ConvertTo-TrimmedText $PackagePath).Trim('"'))
  if (-not (Test-Path -LiteralPath $PackagePath) -or [System.IO.Path]::GetExtension($PackagePath).ToLowerInvariant() -ne ".zip") {
    Stop-Update "A valid update ZIP path is required."
  }

  $expected = Get-PackageChecksum $PackagePath
  $actual = (Get-FileHash -LiteralPath $PackagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { Stop-Update "SHA-256 mismatch. Do not use this ZIP; download the update package again." }

  $TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("mall-os-update-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
  Expand-Archive -LiteralPath $PackagePath -DestinationPath $TempRoot -Force
  $PackageRoot = Get-ExtractedProjectRoot $TempRoot

  Push-Location $PackageRoot
  try {
    Invoke-Checked "node" @("scripts/verify-release-package.mjs") "Downloaded package completeness check"
  } finally {
    Pop-Location
  }

  $manifestPath = Join-Path $PackageRoot "config/update-channel-manifest.json"
  if (-not (Test-Path -LiteralPath $manifestPath)) { Stop-Update "Downloaded package has no update-channel manifest." }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  foreach ($file in $manifest.requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $PackageRoot $file))) { Stop-Update "Downloaded package is missing required file: $file" }
  }

  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $BackupBranch = "backup/staging-before-update-$timestamp"
  Invoke-Checked "git" @("-C", $ProjectRoot, "branch", $BackupBranch) "Local backup branch creation"

  $oldLockHash = if (Test-Path (Join-Path $ProjectRoot "package-lock.json")) { (Get-FileHash (Join-Path $ProjectRoot "package-lock.json") -Algorithm SHA256).Hash } else { "" }
  $UpdateStarted = $true

  foreach ($directory in $manifest.sourceDirectories) {
    Invoke-RobocopyMirror (Join-Path $PackageRoot $directory) (Join-Path $ProjectRoot $directory)
  }

  foreach ($file in Get-ChildItem -LiteralPath $PackageRoot -File) {
    if ($manifest.excludedRootFiles -contains $file.Name) { continue }
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $ProjectRoot $file.Name) -Force
  }

  $newLockHash = if (Test-Path (Join-Path $ProjectRoot "package-lock.json")) { (Get-FileHash (Join-Path $ProjectRoot "package-lock.json") -Algorithm SHA256).Hash } else { "" }
  if ($oldLockHash -ne $newLockHash -or -not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
    Push-Location $ProjectRoot
    try { Invoke-Checked "npm" @("ci") "Dependency installation" } finally { Pop-Location }
  }

  Push-Location $ProjectRoot
  try { Invoke-Checked "npm" @("run", "release:verify:source") "Release verification" } finally { Pop-Location }
  $Validated = $true

  Invoke-Checked "git" @("-C", $ProjectRoot, "add", "-A") "Git staging"
  Invoke-Checked "git" @("-C", $ProjectRoot, "commit", "-m", "Safe update $timestamp") "Git commit"

  if (-not $Publish -and -not $NoPrompt) {
    $answer = (Read-Host "All checks passed. Push this verified update to origin/staging now? [Y/N]").Trim().ToUpperInvariant()
    if ($answer -eq "Y") { $Publish = $true }
  }
  if ($Publish) {
    Invoke-Checked "git" @("-C", $ProjectRoot, "push", "origin", "staging") "Git push to staging"
    Write-Host "SUCCESS: Verified update pushed to origin/staging." -ForegroundColor Green
  } else {
    Write-Host "SUCCESS: Verified update committed locally. Push later with: git push origin staging" -ForegroundColor Green
  }
  Write-Host "Rollback branch retained locally: $BackupBranch" -ForegroundColor Cyan
}
catch {
  if ($UpdateStarted -and -not $Validated) { Restore-BackupBranch }
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
finally {
  if ($TempRoot -and (Test-Path -LiteralPath $TempRoot)) { Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
