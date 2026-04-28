$transcript = 'c:\Users\a\AppData\Roaming\Code\User\workspaceStorage\86b62aa10034aeb404800b514ab3308b\GitHub.copilot-chat\transcripts\651ad7b2-106c-45ab-87f8-347b8ea56143.jsonl'
$all = Get-Content $transcript -Raw
$pattern = '"content":"(?<payload>ID\\tNAME OF THE APPLICANT\\tCATEGORY\\tDATE DEPLOYED\\tCOUNTING.*?)","attachments":\[\]'
$m = [regex]::Match($all, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $m.Success) { throw 'Deployment payload not found in transcript raw text.' }

$payloadEscaped = $m.Groups['payload'].Value
$payloadJsonString = '"' + $payloadEscaped + '"'
$rawText = $payloadJsonString | ConvertFrom-Json

$lines = $rawText -split "`r?`n"
$rows = @()
foreach ($line in $lines) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  if ($line -eq "ID`tNAME OF THE APPLICANT`tCATEGORY`tDATE DEPLOYED`tCOUNTING") { continue }

  $parts = $line -split "`t"
  $id = if ($parts.Count -ge 1) { $parts[0].Trim() } else { '' }
  $name = if ($parts.Count -ge 2) { $parts[1].Trim('" ').Trim() } else { '' }
  $category = if ($parts.Count -ge 3) { $parts[2].Trim() } else { '' }
  $dateDeployed = if ($parts.Count -ge 4) { $parts[3].Trim() } else { '' }
  $counting = if ($parts.Count -ge 5) { ($parts[4..($parts.Count - 1)] -join ' ').Trim() } else { '' }

  if ([string]::IsNullOrWhiteSpace($id) -and [string]::IsNullOrWhiteSpace($name) -and [string]::IsNullOrWhiteSpace($category) -and [string]::IsNullOrWhiteSpace($dateDeployed) -and [string]::IsNullOrWhiteSpace($counting)) {
    continue
  }

  $status = if ([string]::IsNullOrWhiteSpace($dateDeployed)) { 'Processing' } else { 'Deployed' }
  $salaryAmount = ''
  $salaryCurrency = ''
  if ($counting -match '(?<amt>\d+(?:\.\d+)?)\s*(?<cur>SAR|QAR|USD|KWD|BHD|AED|OMR|HKD|SGD|TWD|JPY|KRW|MYR|GBP|CAD)\b') {
    $salaryAmount = $matches['amt']
    $salaryCurrency = $matches['cur']
  }

  $rows += [pscustomobject]@{
    id = $id
    name_of_applicant = $name
    category = $category
    date_deployed = $dateDeployed
    counting = $counting
    status = $status
    country = ''
    employer = $category
    salary_amount = $salaryAmount
    salary_currency = $salaryCurrency
    notes = ''
  }
}

$outCsv = 'c:\Users\a\Desktop\QMS-BLUEORION 2026\data\pra_deployment_list.csv'
$outRaw = 'c:\Users\a\Desktop\QMS-BLUEORION 2026\data\pra_deployment_list_raw.tsv'
$rawText | Set-Content -Path $outRaw -Encoding UTF8
$rows | Export-Csv -Path $outCsv -NoTypeInformation -Encoding UTF8

Write-Output "Rows written: $($rows.Count)"
