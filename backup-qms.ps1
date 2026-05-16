$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupRoot = Join-Path $projectRoot 'qms_safe_zone'
$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$destination = Join-Path $backupRoot $timestamp

New-Item -ItemType Directory -Force -Path $destination | Out-Null

$itemsToCopy = @(
    @{ Source = Join-Path $projectRoot 'data'; Target = 'data' },
    @{ Source = Join-Path $projectRoot 'render.yaml'; Target = 'render.yaml' },
    @{ Source = Join-Path $projectRoot 'server-enhanced.js'; Target = 'server-enhanced.js' },
    @{ Source = Join-Path $projectRoot 'server.js'; Target = 'server.js' },
    @{ Source = Join-Path $projectRoot 'login.html'; Target = 'login.html' },
    @{ Source = Join-Path $projectRoot 'auth_system.js'; Target = 'auth_system.js' },
    @{ Source = Join-Path $projectRoot 'package.json'; Target = 'package.json' }
)

foreach ($item in $itemsToCopy) {
    if (-not (Test-Path $item.Source)) {
        Write-Host "Skipping missing item: $($item.Source)"
        continue
    }

    $targetPath = Join-Path $destination $item.Target
    if (Test-Path $item.Source -PathType Container) {
        Copy-Item -Path $item.Source -Destination $targetPath -Recurse -Force
    } else {
        Copy-Item -Path $item.Source -Destination $targetPath -Force
    }
}

$manifest = @{
    createdAt = (Get-Date).ToString('o')
    sourceRoot = $projectRoot
    copiedItems = $itemsToCopy | ForEach-Object { $_.Target }
} | ConvertTo-Json -Depth 4

Set-Content -Path (Join-Path $destination 'backup-manifest.json') -Value $manifest -Encoding UTF8

Write-Host "Backup complete: $destination"