$url = "https://blueorion-qms.onrender.com/api/login"
$body = '{"username":"rendel","password":"BlueRendel2026!"}'
try {
    $r = Invoke-WebRequest -Uri $url -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    "Login Status: $($r.StatusCode)"
    "Login Body: $($r.Content)"
} catch {
    $s = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "Unknown" }
    "Login Status: $s"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        "Login Body: $($reader.ReadToEnd())"
    } else {
        "Error: $($_.Exception.Message)"
    }
}
