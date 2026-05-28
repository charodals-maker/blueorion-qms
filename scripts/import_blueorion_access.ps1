$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$db = Join-Path $root 'BLUEORION_QMS\BLUEORION SYSTEM_2026-05-02.accdb'
$outPath = Join-Path $root 'data\private_applicant_finance.json'

if (!(Test-Path $db)) {
  throw "Database not found: $db"
}

$conn = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$db;Persist Security Info=False;")
$conn.Open()

function Get-Table($name) {
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = "SELECT * FROM [$name]"
  $da = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
  $dt = New-Object System.Data.DataTable
  [void]$da.Fill($dt)
  return $dt
}

function Cell($row, [string]$col) {
  if ($null -eq $row) { return '' }
  try {
    $v = $row.Item($col)
    if ($null -eq $v -or [string]::IsNullOrWhiteSpace([string]$v)) { return '' }
    return [string]$v
  } catch {
    return ''
  }
}

function NormName([string]$v) {
  $s = (($v -replace '[^A-Za-z\s-]', ' ') -replace '\s+', ' ').Trim().ToUpper()
  if ($s.Contains(' - ')) { $s = $s.Split(' - ')[0].Trim() }
  return $s
}

function LastSurname([string]$v) {
  $s = (NormName $v)
  if (-not $s) { return '' }
  $parts = $s.Split(' ')
  return $parts[$parts.Length - 1]
}

function ParseMoney([string]$v) {
  if (-not $v) { return 0 }
  $matches = [regex]::Matches($v, '[-+]?[0-9]*\.?[0-9]+')
  $sum = 0.0
  foreach ($m in $matches) {
    $num = 0.0
    if ([double]::TryParse($m.Value, [ref]$num)) {
      if ($num -ge 100) { $sum += $num }
    }
  }
  return [math]::Round($sum, 2)
}

$records = @{}
function Ensure-Rec([string]$name) {
  $n = NormName $name
  if (-not $n) { return $null }
  if (-not $records.ContainsKey($n)) {
    $records[$n] = [ordered]@{
      id = ''
      applicantName = $n
      agent = ''
      amount = 0
      paymentDate = ''
      tesda = 'pending'
      medical = 'pending'
      oec = 'pending'
      status = 'pending'
      familyGroup = LastSurname $n
      familySurname = LastSurname $n
      notes = ''
      createdAt = (Get-Date).ToString('s')
      updatedAt = (Get-Date).ToString('s')
    }
  }
  return $records[$n]
}

$dep = Get-Table 'DEPLOYMENT'
foreach ($row in $dep.Rows) {
  if ($null -eq $row) { continue }
  $name = Cell $row 'NAME OF THE APPLICANT'
  if (-not $name) { continue }
  $rec = Ensure-Rec $name
  if ($null -eq $rec) { continue }
  $dateDep = Cell $row 'DATE DEPLOYED'
  if ($dateDep.Trim()) {
    $rec.status = 'deployed'
    $rec.notes = ($rec.notes + ' DEPLOYED;').Trim()
  }
}

$rep = Get-Table 'REPATRIATION'
foreach ($row in $rep.Rows) {
  if ($null -eq $row) { continue }
  $name = Cell $row 'NAME'
  if (-not $name) { continue }
  $rec = Ensure-Rec $name
  if ($null -eq $rec) { continue }
  $rec.status = 'repatriated'
  $rec.notes = ($rec.notes + ' REPATRIATION;').Trim()
}

$can = Get-Table 'CAN ALRIYADH DEPLOYMENT'
foreach ($row in $can.Rows) {
  if ($null -eq $row) { continue }
  $name = Cell $row 'NAME OF APPLICANT'
  if (-not $name) { continue }
  $rec = Ensure-Rec $name
  if ($null -eq $rec) { continue }
  $amt = ParseMoney (Cell $row 'AMOUNT')
  if ($amt -gt 0) { $rec.amount += $amt }
  $emp = Cell $row 'EMPLOYER'
  if ($emp -and -not $rec.agent) { $rec.agent = $emp }
}

$tes = Get-Table 'TESDA RECORD'
foreach ($row in $tes.Rows) {
  if ($null -eq $row) { continue }
  $name = Cell $row 'NAME'
  if (-not $name) { continue }
  $rec = Ensure-Rec $name
  if ($null -eq $rec) { continue }
  $rec.tesda = 'yes'
  $amt = ParseMoney (Cell $row 'AMOUNT')
  if ($amt -gt 0) { $rec.amount += $amt }
}

$med = Get-Table 'MEDICAL RECORD PAID BY OFFICE'
foreach ($row in $med.Rows) {
  if ($null -eq $row) { continue }
  $name = Cell $row 'NAME'
  if (-not $name) { continue }
  $rec = Ensure-Rec $name
  if ($null -eq $rec) { continue }
  $rec.medical = 'yes'
  $amt = ParseMoney (Cell $row 'AMOUNT')
  if ($amt -gt 0) { $rec.amount += $amt }
  $d = Cell $row 'DATE'
  if ($d -and -not $rec.paymentDate) { $rec.paymentDate = $d }
}

$oec = Get-Table 'OEC PAYMENT'
foreach ($row in $oec.Rows) {
  if ($null -eq $row) { continue }
  $name = Cell $row 'NAME OF THE APPLICANT'
  if (-not $name) { continue }
  $rec = Ensure-Rec $name
  if ($null -eq $rec) { continue }
  $rec.oec = 'yes'
  $amt = ParseMoney (Cell $row 'OEC PAYABLE')
  if ($amt -gt 0) { $rec.amount += $amt }
}

$irc = Get-Table 'IRC SSKILLED SUPPORT WORKER/ CLEANER'
foreach ($row in $irc.Rows) {
  if ($null -eq $row) { continue }
  $name = Cell $row 'NAME'
  if (-not $name) { continue }
  $rec = Ensure-Rec $name
  if ($null -eq $rec) { continue }
  $rec.medical = 'yes'
  $amt = ParseMoney ((Cell $row 'DETAILS') + ' ' + (Cell $row 'STATUS'))
  if ($amt -gt 0) { $rec.amount += $amt }
  if ($rec.status -eq 'pending') { $rec.status = 'deployed' }
}

$conn.Close()

foreach ($k in $records.Keys) {
  $rec = $records[$k]
  if ($rec.status -eq 'repatriated' -and $rec.notes -notmatch 'DEPLOYED') {
    $rec.status = 'not_deployed'
  }
  if (-not $rec.id) {
    $rec.id = 'PVT-' + (Get-Random -Minimum 100000 -Maximum 999999)
  }
}

$out = @($records.Values)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outPath, ($out | ConvertTo-Json -Depth 10), $utf8NoBom)

Write-Output ("IMPORTED_RECORDS=" + $out.Count)
Write-Output ("OUTPUT=" + $outPath)
