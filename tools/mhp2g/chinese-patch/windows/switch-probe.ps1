param([Parameter(Mandatory=$true)][ValidateSet('A','B','P','restore')][string]$Stage)
$ErrorActionPreference = 'Stop'
try {
    . (Join-Path $PSScriptRoot 'switch-core.ps1')
    $kit = Split-Path $PSScriptRoot
    $root = 'D:\MH\ppsspp\p2g-zh-pilot-v1'
    Write-Host 'P2G test package: close the independent test game before switching.'
    if ($Stage -eq 'B') { Write-Host 'B requires reviewed A, or the exact accepted pilot declared by this trial kit.' }
    Write-Host (Invoke-ProbeSwitch -Root $root -Kit $kit -Stage $Stage)
    exit 0
} catch {
    Write-Host ('FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'No emulator was started or stopped. Preserve the error and contact the developer.'
    exit 1
}
