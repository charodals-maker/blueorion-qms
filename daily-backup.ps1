param(
    [string]$ProjectRoot = (Split-Path -Parent $MyInvocation.MyCommand.Path)
)
$ErrorActionPreference = 'Stop'
$backupRoot = Join-Path $ProjectRoot 'qms_safe_zone'
$dailyRoot = Join-Path $backupRoot 'daily'
$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$zipPath = Join-Path $dailyRoot ("blueorion-qms_daily_backup_{0}.zip" -f $timestamp)
New-Item -ItemType Directory -Path $dailyRoot -Force | Out-Null
$itemsToArchive = Get-ChildItem -Path $ProjectRoot -Force | Where-Object { $_.Name -ne 'qms_safe_zone' }
if (-not $itemsToArchive -or $itemsToArchive.Count -eq 0) { throw 'No files found to back up.' }
Compress-Archive -Path ($itemsToArchive | ForEach-Object { $_.FullName }) -DestinationPath $zipPath -CompressionLevel Optimal -Force
$latestFile = Join-Path $dailyRoot 'LATEST_BACKUP.txt'
Set-Content -Path $latestFile -Value $zipPath -Encoding UTF8
$backupFile = Get-Item $zipPath
Write-Output "Backup created: $($backupFile.FullName)"
Write-Output ("Size (MB): {0:N2}" -f ($backupFile.Length / 1MB))
Write-Output "Latest marker: $latestFile"
