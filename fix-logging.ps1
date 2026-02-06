Set-Location "D:\AVAStudio_WORK\AVASTUDIO_MASTER\AvaStudio\AvaStudio.Gateway"

$h = Get-Content "appsettings.Development.json" -Raw | ConvertFrom-Json -AsHashtable

$h["Logging"] = @{}
$h["Logging"]["LogLevel"] = @{}

$ll = $h["Logging"]["LogLevel"]

$ll["Default"] = "Information"
$ll["Microsoft"] = "Information"
$ll["Microsoft.AspNetCore"] = "Information"
$ll["Microsoft.AspNetCore.Authentication"] = "Debug"
$ll["Microsoft.AspNetCore.Authentication.JwtBearer"] = "Debug"
$ll["Microsoft.IdentityModel"] = "Debug"
$ll["Microsoft.IdentityModel.Protocols"] = "Debug"
$ll["Microsoft.IdentityModel.Protocols.OpenIdConnect"] = "Debug"

($h | ConvertTo-Json -Depth 50) | Set-Content "appsettings.Development.json" -Encoding utf8

Write-Host "OK_LOGLEVEL_WRITTEN_CLEAN"
