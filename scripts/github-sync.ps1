param(
  [switch]$Watch,
  [int]$CheckSeconds = 10,
  [int]$QuietSeconds = 20,
  [string]$Message = "",
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

function Assert-GitRepo {
  if (-not (Test-Path ".git")) {
    throw "This folder is not a Git repository: $RepoRoot"
  }

  $remote = git remote get-url origin 2>$null
  if (-not $remote) {
    throw "Git remote 'origin' is not configured."
  }
}

function Get-WorkingTreeSignature {
  return (git status --porcelain) -join "`n"
}

function Invoke-GitHubSync {
  Assert-GitRepo

  $changes = @(git status --porcelain)
  if ($changes.Count -eq 0) {
    Write-Host "[GitHub Sync] No local changes to upload."
    return
  }

  Write-Host "[GitHub Sync] Local changes found:"
  foreach ($change in $changes) {
    Write-Host "  $change"
  }

  git add -A

  $staged = @(git diff --cached --name-only)
  if ($staged.Count -eq 0) {
    Write-Host "[GitHub Sync] Nothing was staged. Check .gitignore if this seems wrong."
    return
  }

  if ([string]::IsNullOrWhiteSpace($Message)) {
    $commitMessage = "Auto sync: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  } else {
    $commitMessage = $Message
  }

  Write-Host "[GitHub Sync] Creating commit: $commitMessage"
  git commit -m $commitMessage

  if (-not $NoPush) {
    Write-Host "[GitHub Sync] Pushing to GitHub..."
    git push
    Write-Host "[GitHub Sync] Done. GitHub Pages usually updates within 1-3 minutes."
  } else {
    Write-Host "[GitHub Sync] Commit created. Push skipped because -NoPush was used."
  }
}

Assert-GitRepo

if ($Watch) {
  Write-Host "[GitHub Sync] Watch mode started."
  Write-Host "[GitHub Sync] Repository: $RepoRoot"
  Write-Host "[GitHub Sync] Every saved change will be committed and pushed after $QuietSeconds seconds of no new changes."
  Write-Host "[GitHub Sync] Keep this window open. Press Ctrl+C to stop."

  $lastSignature = Get-WorkingTreeSignature
  $lastChangeAt = Get-Date
  $syncing = $false

  while ($true) {
    Start-Sleep -Seconds $CheckSeconds

    if ($syncing) {
      continue
    }

    $signature = Get-WorkingTreeSignature
    if ($signature -ne $lastSignature) {
      $lastSignature = $signature
      $lastChangeAt = Get-Date
      if ($signature) {
        Write-Host "[GitHub Sync] Change detected. Waiting for edits to settle..."
      }
      continue
    }

    if ($signature -and (((Get-Date) - $lastChangeAt).TotalSeconds -ge $QuietSeconds)) {
      try {
        $syncing = $true
        Invoke-GitHubSync
      } catch {
        Write-Host "[GitHub Sync] ERROR: $($_.Exception.Message)"
      } finally {
        $lastSignature = Get-WorkingTreeSignature
        $lastChangeAt = Get-Date
        $syncing = $false
      }
    }
  }
} else {
  Invoke-GitHubSync
}
