Set-Content -Path $args[0] -Encoding UTF8 -Value (Get-Content $args[1] -Raw)
