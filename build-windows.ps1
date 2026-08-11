param(
    [string]$QtBin = "",
    [ValidateSet("release", "debug")]
    [string]$Configuration = "release",
    [string]$OutDir = ".\release\windows"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Project = Join-Path $Root "launcher\MHSaveEditor.pro"
$Target = "MHSaveEditor"

if (-not $QtBin) {
    if ($env:QTDIR) {
        $QtBin = Join-Path $env:QTDIR "bin"
    } elseif (Test-Path "C:\msys64\mingw64\bin") {
        $QtBin = "C:\msys64\mingw64\bin"
    } else {
        throw "Qt MinGW bin directory not found. Pass -QtBin."
    }
}

$QtBin = (Resolve-Path $QtBin).Path
$Qmake = @("qmake.exe", "qmake-qt5.exe") |
    ForEach-Object { Join-Path $QtBin $_ } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1
$Make = Join-Path $QtBin "mingw32-make.exe"
$Deploy = @("windeployqt.exe", "windeployqt-qt5.exe") |
    ForEach-Object { Join-Path $QtBin $_ } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1
$Objdump = Join-Path $QtBin "objdump.exe"

if (-not $Qmake) { throw "qmake was not found in $QtBin" }
if (-not (Test-Path $Make)) { throw "mingw32-make.exe was not found in $QtBin" }
if (-not $Deploy) { throw "windeployqt was not found in $QtBin" }
if (-not (Test-Path $Objdump)) { throw "objdump.exe was not found in $QtBin" }

function Copy-ImportedDlls {
    param([string]$PackageDir, [string]$DependencyDir, [string]$ObjdumpPath)

    $systemDlls = @{
        "advapi32.dll"=$true; "bcrypt.dll"=$true; "comdlg32.dll"=$true
        "crypt32.dll"=$true; "dwmapi.dll"=$true; "gdi32.dll"=$true
        "imm32.dll"=$true; "iphlpapi.dll"=$true; "kernel32.dll"=$true
        "mpr.dll"=$true; "netapi32.dll"=$true; "ole32.dll"=$true
        "oleaut32.dll"=$true; "opengl32.dll"=$true; "rpcrt4.dll"=$true
        "secur32.dll"=$true; "setupapi.dll"=$true; "shell32.dll"=$true
        "shlwapi.dll"=$true; "user32.dll"=$true; "userenv.dll"=$true
        "uxtheme.dll"=$true; "version.dll"=$true; "winmm.dll"=$true
        "winspool.drv"=$true; "ws2_32.dll"=$true
    }
    $queue = [System.Collections.Queue]::new()
    Get-ChildItem $PackageDir -Recurse -File -Include "*.exe", "*.dll" |
        ForEach-Object { $queue.Enqueue($_.FullName) }
    $scanned = @{}

    while ($queue.Count -gt 0) {
        $binary = $queue.Dequeue()
        $binaryKey = $binary.ToLowerInvariant()
        if ($scanned.ContainsKey($binaryKey)) { continue }
        $scanned[$binaryKey] = $true

        $imports = & $ObjdumpPath -p $binary 2>$null |
            Select-String "DLL Name:" |
            ForEach-Object { ($_.Line -replace ".*DLL Name:\s*", "").Trim() } |
            Where-Object { $_ }

        foreach ($dll in $imports) {
            if ($systemDlls.ContainsKey($dll.ToLowerInvariant())) { continue }
            $targetPath = Join-Path $PackageDir $dll
            if (Test-Path $targetPath) { continue }
            $sourcePath = Join-Path $DependencyDir $dll
            if (Test-Path $sourcePath) {
                Copy-Item $sourcePath $targetPath -Force
                $queue.Enqueue($targetPath)
            }
        }
    }
}

Set-Location $Root
$env:PATH = "$QtBin;$env:PATH"

foreach ($path in @("Makefile", "Makefile.Debug", "Makefile.Release", "build", "bin")) {
    $fullPath = Join-Path $Root $path
    if (Test-Path $fullPath) { Remove-Item $fullPath -Recurse -Force }
}

& $Qmake $Project "CONFIG+=$Configuration" "CONFIG-=debug_and_release"
& $Make "-j$([Environment]::ProcessorCount)"

$BuiltExe = Join-Path $Root "bin\$Target.exe"
if (-not (Test-Path $BuiltExe)) { throw "Executable not found: $BuiltExe" }

$Package = Join-Path $Root $OutDir
if (Test-Path $Package) { Remove-Item $Package -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Package | Out-Null
Copy-Item $BuiltExe (Join-Path $Package "$Target.exe")

& $Deploy (Join-Path $Package "$Target.exe") "--$Configuration"
if ($LASTEXITCODE -ne 0) {
    Write-Warning "windeployqt reported an error; required files will be checked explicitly."
    $global:LASTEXITCODE = 0
}

$QtRoot = Split-Path -Parent $QtBin
$platformDir = Join-Path $Package "platforms"
New-Item -ItemType Directory -Force -Path $platformDir | Out-Null
$qwindows = @(
    (Join-Path $QtRoot "share\qt5\plugins\platforms\qwindows.dll"),
    (Join-Path $QtRoot "plugins\platforms\qwindows.dll")
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $qwindows) { throw "qwindows.dll was not found." }
Copy-Item $qwindows (Join-Path $platformDir "qwindows.dll") -Force

Copy-ImportedDlls $Package $QtBin $Objdump

$required = @(
    (Join-Path $Package "$Target.exe"),
    (Join-Path $Package "Qt5Core.dll"),
    (Join-Path $Package "Qt5Gui.dll"),
    (Join-Path $Package "Qt5Widgets.dll"),
    (Join-Path $Package "platforms\qwindows.dll")
)
foreach ($file in $required) {
    if (-not (Test-Path $file)) { throw "Required portable file is missing: $file" }
}

Set-Content -Path (Join-Path $Package "run-windows.bat") -Encoding ASCII -Value @"
@echo off
cd /d "%~dp0"
start "" "$Target.exe"
"@

Write-Host "Windows launcher package created: $Package"
$global:LASTEXITCODE = 0
