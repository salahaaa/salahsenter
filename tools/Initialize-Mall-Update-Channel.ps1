# One-time setup for the safe staging update channel.
[CmdletBinding()]
param(
  [string]$RemoteUrl,
  [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Stop-Setup([string]$Message) { throw "SETUP STOPPED: $Message" }
function Invoke-Checked([string]$File, [string[]]$Arguments, [string]$Context) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { Stop-Setup "$Context failed (exit code $LASTEXITCODE)." }
}

function ConvertTo-TrimmedText([object]$Value) {
  if ($null -eq $Value) { return "" }
  return (($Value | Out-String).Trim())
}

function Test-LocalGitHasCommit {
  $gitDirectory = Join-Path $ProjectRoot ".git"
  $headPath = Join-Path $gitDirectory "HEAD"
  if (-not (Test-Path -LiteralPath $headPath)) { return $false }
  $head = (Get-Content -LiteralPath $headPath -Raw).Trim()
  if ($head -match '^ref:\s+(.+)$') {
    $reference = $Matches[1]
    if (Test-Path -LiteralPath (Join-Path $gitDirectory $reference)) { return $true }
    $packedRefs = Join-Path $gitDirectory "packed-refs"
    return (Test-Path -LiteralPath $packedRefs) -and [bool](Select-String -LiteralPath $packedRefs -Pattern ("\s" + [regex]::Escape($reference) + "$"))
  }
  return $head -match '^[a-fA-F0-9]{40}$'
}

try {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Stop-Setup "Install Git for Windows before initializing the update channel." }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Stop-Setup "Install Node.js 22.19.0 before initializing the update channel." }

  $versionText = ConvertTo-TrimmedText (& node -p "process.versions.node")
  if (-not $versionText) { Stop-Setup "Node.js version could not be read." }
  $version = $versionText.Split('.')
  if ($version.Count -lt 2 -or [int]$version[0] -ne 22 -or [int]$version[1] -lt 19) { Stop-Setup "Node.js 22.19.0 or newer within Node 22 is required." }

  if (-not $NoPrompt) {
    $confirmation = ConvertTo-TrimmedText (Read-Host "Type INITIALIZE_STAGING_UPDATE_CHANNEL to create/use the staging Git channel")
    if ($confirmation -ne "INITIALIZE_STAGING_UPDATE_CHANNEL") { Stop-Setup "Confirmation phrase did not match." }
  }

  # A ZIP delivery intentionally has no .git directory. Remember whether this
  # invocation initialized Git so untracked source files are allowed until the
  # first commit is created. Do not query HEAD here: a new repository has none.
  $initializedHere = $false
  if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ".git"))) {
    Invoke-Checked "git" @("-C", $ProjectRoot, "init") "Git initialization"
    $initializedHere = $true
  }

  $status = (& git -C $ProjectRoot status --porcelain)
  $hasCommit = Test-LocalGitHasCommit
  if ($status -and $hasCommit -and -not $initializedHere) { Stop-Setup "This folder has uncommitted changes. Commit or stash them before initialization." }

  # `git config user.name` exits with code 1 when unset. Read the complete
  # config list instead, which succeeds in both a fresh and existing repository.
  $gitConfig = ConvertTo-TrimmedText (& git -C $ProjectRoot config --list)
  $nameMatch = [regex]::Match($gitConfig, '(?m)^user\.name=(.+)$')
  $emailMatch = [regex]::Match($gitConfig, '(?m)^user\.email=(.+)$')
  $name = if ($nameMatch.Success) { $nameMatch.Groups[1].Value.Trim() } else { "" }
  $email = if ($emailMatch.Success) { $emailMatch.Groups[1].Value.Trim() } else { "" }
  if (-not $name -or -not $email) {
    Stop-Setup "Configure Git once first: git config --global user.name and git config --global user.email"
  }

  # `git remote` succeeds with an empty list in a new repository. Do not call
  # `git remote get-url origin` until origin is known to exist.
  $remoteNames = ConvertTo-TrimmedText (& git -C $ProjectRoot remote)
  $hasOrigin = ($remoteNames -split "`r?`n" | Where-Object { $_.Trim() -eq "origin" }).Count -gt 0
  $existingRemote = if ($hasOrigin) { ConvertTo-TrimmedText (& git -C $ProjectRoot remote get-url origin) } else { "" }
  if (-not $existingRemote) {
    if (-not $RemoteUrl) { $RemoteUrl = ConvertTo-TrimmedText (Read-Host "Paste the GitHub repository URL (for example https://github.com/OWNER/REPO.git)") }
    $remoteText = ConvertTo-TrimmedText $RemoteUrl
    if (-not $remoteText -or -not $remoteText.StartsWith("https://github.com/")) { Stop-Setup "A valid GitHub HTTPS repository URL is required." }
    Invoke-Checked "git" @("-C", $ProjectRoot, "remote", "add", "origin", $remoteText) "Git remote configuration"
  }
  $branch = ConvertTo-TrimmedText (& git -C $ProjectRoot branch --show-current)
  if (-not $branch) {
    Invoke-Checked "git" @("-C", $ProjectRoot, "checkout", "-b", "staging") "Staging branch creation"
    Invoke-Checked "git" @("-C", $ProjectRoot, "add", "-A") "Initial source staging"
    Invoke-Checked "git" @("-C", $ProjectRoot, "commit", "-m", "Initialize verified staging update channel") "Initial staging commit"
  } elseif ($branch -ne "staging") {
    Invoke-Checked "git" @("-C", $ProjectRoot, "checkout", "-b", "staging") "Staging branch creation"
  }

  Invoke-Checked "git" @("-C", $ProjectRoot, "push", "-u", "origin", "staging") "Initial staging push"
  Write-Host "SUCCESS: staging update channel initialized. Future updates use tools\Apply-Mall-Update.cmd." -ForegroundColor Green
}
catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
