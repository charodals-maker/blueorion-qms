$users = @(
    @{user="shekai"; pass="BlueShekai2026!"},
    @{user="staff1"; pass="BlueStaff1!"},
    @{user="staff2"; pass="BlueStaff2!"}
)

foreach ($u in $users) {
    Write-Output "Testing user: $($u.user)"
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    try {
        $loginBody = @{ username = $u.user; password = $u.pass } | ConvertTo-Json
        $loginRes = Invoke-RestMethod -Uri "http://localhost:3000/api/login" -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session
        Write-Output "Login successful: $($u.user)"
        
        try {
            $adminRes = Invoke-WebRequest -Uri "http://localhost:3000/admin-monitoring" -WebSession $session -ErrorAction Stop
            Write-Output "$($u.user) access to /admin-monitoring: $($adminRes.StatusCode)"
        } catch {
            Write-Output "$($u.user) access to /admin-monitoring: $($_.Exception.Response.StatusCode.value__)"
        }
    } catch {
        Write-Output "Login failed for $($u.user): $($_.Exception.Message)"
    }
    Write-Output "----------------"
}
