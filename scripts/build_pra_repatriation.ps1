$ErrorActionPreference = 'Stop'

$transcript = 'c:\Users\a\AppData\Roaming\Code\User\workspaceStorage\86b62aa10034aeb404800b514ab3308b\GitHub.copilot-chat\transcripts\651ad7b2-106c-45ab-87f8-347b8ea56143.jsonl'
if (!(Test-Path $transcript)) { throw "Transcript not found: $transcript" }

function Normalize-Text([string]$s) {
  if ([string]::IsNullOrWhiteSpace($s)) { return '' }
  $x = $s.ToUpperInvariant().Trim()
  $x = $x -replace '"', ''
  $x = $x -replace '[^A-Z0-9 ]', ' '
  $x = $x -replace '\s+', ' '
  return $x.Trim()
}

function Parse-Date([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return @{ raw=''; iso=''; valid=$false } }

  $candidates = New-Object System.Collections.Generic.List[string]
  $candidates.Add($text)

  $m1 = [regex]::Match($text, '(?<a>\d{1,2})/(?<b>\d{1,2})/(?<y>\d{1,4})')
  if ($m1.Success) {
    $a = [int]$m1.Groups['a'].Value
    $b = [int]$m1.Groups['b'].Value
    $yRaw = [int]$m1.Groups['y'].Value
    $y = $yRaw
    if ($yRaw -lt 100) { $y = 2000 + $yRaw }
    elseif ($yRaw -ge 100 -and $yRaw -lt 1000) { $y = 2000 + ($yRaw % 100) }
    $candidates.Add("$a/$b/$y")
  }

  $m2 = [regex]::Match($text, '(?i)(?<mon>JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JAN|FEB|MAR|APR|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)\s+(?<d>\d{1,2})(?:\s|,)+(?<y>\d{2,4})')
  if ($m2.Success) {
    $mon = $m2.Groups['mon'].Value
    $d = [int]$m2.Groups['d'].Value
    $yRaw = [int]$m2.Groups['y'].Value
    $y = $yRaw
    if ($yRaw -lt 100) { $y = 2000 + $yRaw }
    elseif ($yRaw -ge 100 -and $yRaw -lt 1000) { $y = 2000 + ($yRaw % 100) }
    $candidates.Add("$mon $d $y")
  }

  foreach ($c in $candidates | Select-Object -Unique) {
    $dt = [datetime]::MinValue
    if ([datetime]::TryParse($c, [System.Globalization.CultureInfo]::GetCultureInfo('en-US'), [System.Globalization.DateTimeStyles]::AllowWhiteSpaces, [ref]$dt)) {
      return @{ raw=$c; iso=$dt.ToString('yyyy-MM-dd'); valid=$true }
    }
  }

  return @{ raw=''; iso=''; valid=$false }
}

function Parse-AmountCurrency([string]$text) {
  $amt = ''
  $cur = ''
  if ([string]::IsNullOrWhiteSpace($text)) { return @{ amount=$amt; currency=$cur } }

  $m = [regex]::Match($text, '(?<amt>\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?<cur>SAR|QAR|USD|KWD|BHD|AED|OMR|PHP|KD|QR)\b', 'IgnoreCase')
  if ($m.Success) {
    $amt = ($m.Groups['amt'].Value -replace ',', '')
    $cur = $m.Groups['cur'].Value.ToUpperInvariant()
    if ($cur -eq 'KD') { $cur = 'KWD' }
    if ($cur -eq 'QR') { $cur = 'QAR' }
    return @{ amount=$amt; currency=$cur }
  }

  $m2 = [regex]::Match($text, '\$(?<amt>\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)')
  if ($m2.Success) {
    return @{ amount=($m2.Groups['amt'].Value -replace ',', ''); currency='USD' }
  }

  return @{ amount=$amt; currency=$cur }
}

$all = Get-Content $transcript -Raw
$pattern = '"content":"(?<payload>NAME\\tOR NUMBER.*?)","attachments":\[\]'
$matches = [regex]::Matches($all, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
if ($matches.Count -eq 0) { throw 'Could not find repatriation list payload in transcript.' }
$payloadEscaped = $matches[$matches.Count - 1].Groups['payload'].Value
$payloadJsonString = '"' + $payloadEscaped + '"'
$rawText = $payloadJsonString | ConvertFrom-Json

$rawOut = 'c:\Users\a\Desktop\QMS-BLUEORION 2026\data\pra_repatriation_list_raw.tsv'
$csvOut = 'c:\Users\a\Desktop\QMS-BLUEORION 2026\data\pra_repatriation_list.csv'
$cleanOut = 'c:\Users\a\Desktop\QMS-BLUEORION 2026\data\pra_repatriation_list_clean.csv'
$issuesOut = 'c:\Users\a\Desktop\QMS-BLUEORION 2026\data\pra_repatriation_list_issues.csv'
$matchOut = 'c:\Users\a\Desktop\QMS-BLUEORION 2026\data\pra_deployment_repatriation_match_report.csv'

$rawText | Set-Content -Path $rawOut -Encoding UTF8

$lines = $rawText -split "`r?`n"
$records = New-Object System.Collections.Generic.List[object]
$id = 1
foreach ($line in $lines) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $lineNorm = ($line -replace '\s+', ' ').Trim().ToUpperInvariant()
  if ($lineNorm -eq 'NAME OR NUMBER' -or $lineNorm -eq 'NAME	OR NUMBER') { continue }

  $parts = $line -split "`t"
  $name = if ($parts.Count -ge 1) { $parts[0].Trim() } else { '' }
  $orField = if ($parts.Count -ge 2) { ($parts[1..($parts.Count - 1)] -join ' ').Trim() } else { '' }

  if ([string]::IsNullOrWhiteSpace($name) -and [string]::IsNullOrWhiteSpace($orField)) { continue }

  $combined = ($name + ' ' + $orField).Trim()
  $date = Parse-Date $combined
  $money = Parse-AmountCurrency $combined

  $statusTag = 'other'
  if ($combined -match '(?i)REPAT|REPATRIAT') { $statusTag = 'repatriation' }
  elseif ($combined -match '(?i)IMMIGRAT|ARRIVAL|ARIIVAL') { $statusTag = 'immigration' }
  elseif ($combined -match '(?i)TICKET') { $statusTag = 'ticket' }
  elseif ($combined -match '(?i)CLAIM|SETTLEMENT|NLRC|INSURANCE|PAYMENT|PAID') { $statusTag = 'claims_payment' }

  $records.Add([pscustomobject]@{
    id = $id
    name = $name
    or_number = $orField
    raw_line = $line
    status_tag = $statusTag
    event_date_text = $date.raw
    event_date_iso = $date.iso
    amount = $money.amount
    currency = $money.currency
    notes = ''
  })
  $id++
}

$records | Export-Csv -Path $csvOut -NoTypeInformation -Encoding UTF8

# Clean + issues + duplicate detection
$nameCounts = @{}
foreach ($r in $records) {
  $nk = Normalize-Text $r.name
  if (-not [string]::IsNullOrWhiteSpace($nk)) {
    if (-not $nameCounts.ContainsKey($nk)) { $nameCounts[$nk] = 0 }
    $nameCounts[$nk]++
  }
}

$clean = New-Object System.Collections.Generic.List[object]
$issues = New-Object System.Collections.Generic.List[object]

foreach ($r in $records) {
  $nk = Normalize-Text $r.name
  $isDup = $false
  if ($nk -and $nameCounts.ContainsKey($nk) -and $nameCounts[$nk] -gt 1) { $isDup = $true }

  $clean.Add([pscustomobject]@{
    id = $r.id
    name = $r.name
    or_number = $r.or_number
    raw_line = $r.raw_line
    status_tag = $r.status_tag
    event_date_text = $r.event_date_text
    event_date_iso = $r.event_date_iso
    amount = $r.amount
    currency = $r.currency
    notes = $r.notes
    name_normalized = $nk
    possible_duplicate = $(if ($isDup) { 'yes' } else { 'no' })
  })

  if ([string]::IsNullOrWhiteSpace($r.name)) {
    $issues.Add([pscustomobject]@{ id=$r.id; issue='missing_name'; value=$r.name })
  }
  if ([string]::IsNullOrWhiteSpace($r.or_number)) {
    $issues.Add([pscustomobject]@{ id=$r.id; issue='missing_or_number'; value=$r.or_number })
  }
  if ($isDup) {
    $issues.Add([pscustomobject]@{ id=$r.id; issue='possible_duplicate_name'; value=$r.name })
  }
}

$clean | Export-Csv -Path $cleanOut -NoTypeInformation -Encoding UTF8
$issues | Export-Csv -Path $issuesOut -NoTypeInformation -Encoding UTF8

# Match against deployment clean list (if available)
$matchRows = New-Object System.Collections.Generic.List[object]
$depPath = 'c:\Users\a\Desktop\QMS-BLUEORION 2026\data\pra_deployment_list_clean.csv'
if (Test-Path $depPath) {
  $deps = Import-Csv $depPath
  $depMap = @{}
  foreach ($d in $deps) {
    $dk = Normalize-Text $d.name_of_applicant
    if (-not [string]::IsNullOrWhiteSpace($dk) -and -not $depMap.ContainsKey($dk)) {
      $depMap[$dk] = $d
    }
  }

  foreach ($r in $clean) {
    $rk = $r.name_normalized
    $matched = $null
    if ($rk -and $depMap.ContainsKey($rk)) { $matched = $depMap[$rk] }

    $matchRows.Add([pscustomobject]@{
      repatriation_id = $r.id
      repatriation_name = $r.name
      repatriation_status_tag = $r.status_tag
      repatriation_event_date_iso = $r.event_date_iso
      deployment_match_found = $(if ($null -ne $matched) { 'yes' } else { 'no' })
      deployment_id = $(if ($null -ne $matched) { $matched.id } else { '' })
      deployment_name = $(if ($null -ne $matched) { $matched.name_of_applicant } else { '' })
      deployment_date_iso = $(if ($null -ne $matched) { $matched.date_deployed_iso } else { '' })
      deployment_status = $(if ($null -ne $matched) { $matched.status } else { '' })
    })
  }
}

$matchRows | Export-Csv -Path $matchOut -NoTypeInformation -Encoding UTF8

Write-Output "repatriation_rows=$($records.Count)"
Write-Output "clean_rows=$($clean.Count)"
Write-Output "issues_rows=$($issues.Count)"
Write-Output "match_rows=$($matchRows.Count)"
