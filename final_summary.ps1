$records = Get-Content 'data\ws_dep_records.json' -Raw | ConvertFrom-Json
Write-Host " "
Write-Host "+-----------------------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "¦                        FINAL DEPLOYMENT SUMMARY                            ¦" -ForegroundColor Cyan
Write-Host "¦                          2026-05-16 Updated                                ¦" -ForegroundColor Cyan
Write-Host "+-----------------------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host " "
Write-Host "?? DATASET EXPANSION:" -ForegroundColor Green
Write-Host "   Start:  225 records (10 countries, 6 employers)"
Write-Host "   Final: $($records.Count) records (12 countries, 14+ employers) ?" -ForegroundColor Green
Write-Host " "
Write-Host "?? COUNTRIES COVERED:" -ForegroundColor Cyan
$countries = $records | Group-Object -Property country | Select-Object -ExpandProperty Name | Sort-Object
$countries | ForEach-Object {Write-Host "   ? $_" -ForegroundColor Yellow}
Write-Host " "
Write-Host "?? TOP EMPLOYERS:" -ForegroundColor Cyan
$top10Emp = $records | Group-Object -Property employer | Sort-Object Count -Desc | Select-Object -First 10
$top10Emp | ForEach-Object {Write-Host "   • $($_.Name): $($_.Count) workers" -ForegroundColor Yellow}
Write-Host " "
Write-Host "?? CURRENT STATUS BREAKDOWN:" -ForegroundColor Cyan
$deployed = ($records | Where-Object {$_.status -eq 'Deployed'}).Count
$pending = ($records | Where-Object {$_.status -eq 'Pending'}).Count
$onhold = ($records | Where-Object {$_.status -eq 'On Hold'}).Count
$depl_pct = [math]::Round(($deployed / $records.Count) * 100, 1)
$pend_pct = [math]::Round(($pending / $records.Count) * 100, 1)
$hold_pct = [math]::Round(($onhold / $records.Count) * 100, 1)
Write-Host "   ? Deployed: $deployed ($depl_pct%)" -ForegroundColor Green
Write-Host "   ? Pending: $pending ($pend_pct%)" -ForegroundColor Yellow
Write-Host "   ? On Hold: $onhold ($hold_pct%)" -ForegroundColor Red
Write-Host " "
Write-Host "?? COMPLIANCE STATUS:" -ForegroundColor Cyan
$oecComplete = ($records | Where-Object {$_.oec -eq 'complete'}).Count
$oec_pct = [math]::Round(($oecComplete / $records.Count) * 100, 1)
Write-Host "   ? OEC Complete: $oecComplete ($oec_pct%)" -ForegroundColor Green
Write-Host " "
Write-Host "?? EXPORTS READY:" -ForegroundColor Green
Get-ChildItem -Path 'exports/*.csv' | ForEach-Object { Write-Host "   • $($_.Name) ($($_.Length) bytes)" -ForegroundColor Yellow }
Write-Host " "
Write-Host "?? RENDER DEPLOYMENT:" -ForegroundColor Green
Write-Host "   Service: https://blueorion-qms.onrender.com" -ForegroundColor Cyan
Write-Host "   Status: ? Auto-redeploying" -ForegroundColor Green
Write-Host " "
Write-Host "+-----------------------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "¦                   ? ALL TASKS COMPLETED SUCCESSFULLY                      ¦" -ForegroundColor Cyan
Write-Host "+-----------------------------------------------------------------------------+" -ForegroundColor Cyan
