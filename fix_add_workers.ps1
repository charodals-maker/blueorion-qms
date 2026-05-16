$filePath = "data\ws_dep_records.json"
$content = Get-Content $filePath -Raw
$json = $content | ConvertFrom-Json
[array]$workers = @($json)

$newWorkers = @(
  @{name='Patricia Gonzalez Morales'; pos='Nurse'; employer='Emirates Care Services'; country='Dubai'; sal='AED 2800'; curr='AED'; stat='Deployed'; oec='complete'; dob='1985-03-15'; end='2027-05-16'; pport='PH123456789'; emerg='Juan Gonzalez'},
  @{name='Vincent Santos Reyes'; pos='Construction Supervisor'; employer='Qatari Construction'; country='Qatar'; sal='QAR 2500'; curr='QAR'; stat='Deployed'; oec='complete'; dob='1980-07-22'; end='2027-08-16'; pport='PH987654321'; emerg='Rosa Santos'},
  @{name='Lisette Flores Aquino'; pos='Caregiver'; employer='KL Hospitality Group'; country='Malaysia'; sal='MYR 1800'; curr='MYR'; stat='Pending'; oec='pending'; dob='1990-11-05'; end='2027-11-16'; pport='PH555666777'; emerg='Jose Flores'},
  @{name='Gabriel Mendoza Torres'; pos='Factory Foreman'; employer='Singapore Staffing'; country='Singapore'; sal='SGD 2200'; curr='SGD'; stat='Deployed'; oec='complete'; dob='1982-01-18'; end='2027-06-16'; pport='PH111222333'; emerg='Maria Mendoza'},
  @{name='Evelyn Cristal Bautista'; pos='Household Service Worker'; employer='Al-Nakheel Household Co.'; country='Saudi Arabia'; sal='SAR 1500'; curr='SAR'; stat='On Hold'; oec='incomplete'; dob='1988-09-30'; end='2027-09-16'; pport='PH444555666'; emerg='Manel Bautista'},
  @{name='Danny Marquez Navarro'; pos='Kitchen Helper'; employer='Jeddah Healthcare'; country='Saudi Arabia'; sal='SAR 1100'; curr='SAR'; stat='Deployed'; oec='complete'; dob='1992-04-12'; end='2027-04-16'; pport='PH777888999'; emerg='Aurora Marquez'},
  @{name='Cecilia Ramos Garcia'; pos='Admin Officer'; employer='Emirates Care Services'; country='Dubai'; sal='AED 2300'; curr='AED'; stat='Deployed'; oec='complete'; dob='1987-06-28'; end='2027-07-16'; pport='PH222333444'; emerg='Pedro Ramos'},
  @{name='Roberto Santos Diaz'; pos='Heavy Equipment Operator'; employer='Qatari Construction'; country='Qatar'; sal='QAR 2800'; curr='QAR'; stat='Pending'; oec='pending'; dob='1979-12-14'; end='2028-01-16'; pport='PH666777888'; emerg='Stella Santos'},
  @{name='Melinda Paguio Villanueva'; pos='Sales Manager'; employer='Singapore Staffing'; country='Singapore'; sal='SGD 2400'; curr='SGD'; stat='Deployed'; oec='complete'; dob='1986-02-03'; end='2027-10-16'; pport='PH999000111'; emerg='Fernando Paguio'},
  @{name='Jason Mercado Lopez'; pos='Plumber'; employer='Al-Nakheel Household Co.'; country='Saudi Arabia'; sal='SAR 1600'; curr='SAR'; stat='Deployed'; oec='complete'; dob='1983-08-19'; end='2027-03-16'; pport='PH333444555'; emerg='Luz Mercado'},
  @{name='Adrienne Cabrera Montoya'; pos='Medical Technologist'; employer='Jeddah Healthcare'; country='Saudi Arabia'; sal='SAR 2300'; curr='SAR'; stat='On Hold'; oec='incomplete'; dob='1989-05-07'; end='2027-12-16'; pport='PH888999000'; emerg='Carlos Cabrera'},
  @{name='Elbert Villarosa Tupas'; pos='Electrician'; employer='KL Hospitality Group'; country='Malaysia'; sal='MYR 1900'; curr='MYR'; stat='Deployed'; oec='complete'; dob='1981-10-25'; end='2027-02-16'; pport='PH444555666'; emerg='Gloria Villarosa'},
  @{name='Jasmine Quiling Yorro'; pos='Retail Supervisor'; employer='Emirates Care Services'; country='Dubai'; sal='AED 1900'; curr='AED'; stat='Deployed'; oec='complete'; dob='1991-03-11'; end='2027-01-16'; pport='PH111222333'; emerg='Mario Quiling'},
  @{name='Kevin Remonde Salas'; pos='Security Guard'; employer='Singapore Staffing'; country='Singapore'; sal='SGD 1600'; curr='SGD'; stat='Pending'; oec='pending'; dob='1993-07-29'; end='2027-05-16'; pport='PH777888999'; emerg='Tanya Remonde'},
  @{name='Nicole Ferrera Sanchez'; pos='Translator'; employer='Qatari Construction'; country='Qatar'; sal='QAR 1800'; curr='QAR'; stat='Deployed'; oec='complete'; dob='1987-11-13'; end='2027-04-16'; pport='PH555666777'; emerg='Anthony Ferrera'}
)

$lastWorker = $workers[-1]
$maxId = 0
if ($lastWorker.id -match '(\d+)$') { $maxId = [int]$matches[1] }

$added = 0
foreach ($w in $newWorkers) {
  $maxId++
  $rec = [ordered]@{
    pid='PENDING'
    id="DEP-2026-05-16-$($maxId.ToString('000'))"
    name=$w.name
    pos=$w.pos
    employer=$w.employer
    country=$w.country
    salary=$w.sal
    currency=$w.curr
    status=$w.stat
    oec=$w.oec
    cat='OFW'
    date='2026-05-16'
    flightDate='2026-05-16'
    dob=$w.dob
    contractEnd=$w.end
    passportNo=$w.pport
    emergencyContact=$w.emerg
    notes='Deployed via Blueorion International'
    createdAt='2026-05-16'
  }
  $workers += $rec
  $added++
}

$workers | ConvertTo-Json -Depth 10 | Out-File -Encoding UTF8 $filePath
Write-Host "Added $added workers. Total: $($workers.Count)"
