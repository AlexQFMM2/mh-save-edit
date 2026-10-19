# Windows PowerShell 5.1. Loading this module does not touch the filesystem.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-PlainPath([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing reparse point: $cursor" }
        }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}
function Resolve-Child([string]$Root, [string]$Relative) {
    if ([IO.Path]::IsPathRooted($Relative) -or $Relative -match '(^|[\\/])\.\.?([\\/]|$)|:') { throw 'Unsafe relative path' }
    $base = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $full = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
    if (!$full.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path escapes root' }
    Assert-PlainPath $full
    return $full
}
function Read-ProbeJson([string]$Path) { return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json }
function Write-ProbeJson([string]$Path, $Value) {
    $temporary = $Path + '.tmp-' + [Guid]::NewGuid().ToString('N')
    try {
        [IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding($false)))
        Move-Item -LiteralPath $temporary -Destination $Path -Force
    } finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force } }
}
function Get-ProbeTree([string]$Root, [switch]$Runtime) {
    Assert-PlainPath $Root
    if (!(Test-Path -LiteralPath $Root -PathType Container)) { throw "Missing directory: $Root" }
    $prefix = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $result = @()
    foreach ($item in @(Get-ChildItem -LiteralPath $Root -Recurse -Force | Sort-Object FullName)) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing link inside plugin directory' }
        if ($item.PSIsContainer) { continue }
        $relative = $item.FullName.Substring($prefix.Length).Replace('\','/')
        if ($Runtime -and $relative -in @('plugin.log','plugin.previous.log')) { continue }
        $result += [pscustomobject]@{ path=$relative; bytes=$item.Length; sha256=(Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
    }
    return $result
}
function Assert-ProbeTree([string]$Root, $Expected, [switch]$Runtime) {
    $actual = @(Get-ProbeTree $Root -Runtime:$Runtime)
    $expectedRows = @($Expected | Sort-Object path)
    if ($Runtime) { $expectedRows = @($expectedRows | Where-Object { $_.path -notin @('plugin.log','plugin.previous.log') }) }
    $actual = @($actual | Sort-Object path)
    if ($actual.Count -ne $expectedRows.Count) { throw "File count mismatch: $Root" }
    for ($i=0; $i -lt $actual.Count; $i++) {
        if ($actual[$i].path -cne $expectedRows[$i].path -or $actual[$i].bytes -ne $expectedRows[$i].bytes -or $actual[$i].sha256 -cne $expectedRows[$i].sha256) {
            throw "File verification failed: $($actual[$i].path)"
        }
    }
}
function Assert-ProbeStopped([string]$Root, [scriptblock]$ProcessReader) {
    $prefix = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    try { $processes = @(& $ProcessReader) } catch { throw 'Cannot inspect emulator processes; close the test emulator and retry.' }
    foreach ($process in $processes) {
        if ([string]::IsNullOrWhiteSpace($process.ExecutablePath)) { throw 'Cannot identify a PPSSPP process; close it before switching.' }
        if ($process.ExecutablePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) -or
            ([string]$process.CommandLine).IndexOf($Root, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
            throw 'Test PPSSPP is running. Close it yourself, then retry.'
        }
    }
}
function Assert-ProbeKit([string]$Kit) {
    Assert-PlainPath $Kit
    $manifest = Read-ProbeJson (Join-Path $Kit 'kit.json')
    if ($manifest.schema -notin @('p2g-equipment-probe-kit-v1','p2g-pilot-kit-v1')) { throw 'Unsupported kit manifest' }
    foreach ($entry in $manifest.files.PSObject.Properties) {
        $file = Resolve-Child $Kit $entry.Name
        if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing kit file: $($entry.Name)" }
        if ((Get-Item -LiteralPath $file).Length -ne $entry.Value.bytes -or
            (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.Value.sha256) { throw "Kit hash mismatch: $($entry.Name)" }
    }
    return $manifest
}

function Invoke-ProbeSwitchUnlocked {
    param([string]$Root, [string]$Kit, [ValidateSet('A','B','P','restore')][string]$Stage,
        [scriptblock]$ProcessReader = { Get-CimInstance Win32_Process -Filter "Name LIKE 'PPSSPP%'" -ErrorAction Stop },
        [ValidateSet('','after-displace','after-install')][string]$TestFault = '')
    $Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    if (!(Test-Path -LiteralPath $Root -PathType Container)) { throw 'Independent test directory does not exist' }
    Assert-PlainPath $Root
    Assert-ProbeStopped $Root $ProcessReader
    $kitManifest = Assert-ProbeKit $Kit
    $plugins = Resolve-Child $Root 'memstick/PSP/PLUGINS'
    $live = Resolve-Child $plugins 'mhp2g_zh_cn'
    $stateRoot = Resolve-Child $Root 'bone-probe-state'
    $statePath = Resolve-Child $stateRoot 'state.json'
    $baseline = Resolve-Child $stateRoot 'original'
    $state = $null
    if (Test-Path -LiteralPath $statePath) {
        $state = Read-ProbeJson $statePath
        if ($state.schema -ne 'p2g-probe-switch-state-v1' -or $state.root -ine $Root) { throw 'Invalid switch state; preserve it for diagnosis' }
        if ($state.hadOriginal) { Assert-ProbeTree $baseline $state.originalFiles }
        if ($state.active) { Assert-ProbeTree $live $state.active.files -Runtime }
        elseif ($state.hadOriginal) { Assert-ProbeTree $live $state.originalFiles -Runtime }
        elseif (Test-Path -LiteralPath $live) { throw 'Unexpected plugin appeared after restore; preserve it for diagnosis' }
    }
    if ($Stage -eq 'B' -and (!$state -or !$state.active)) { throw 'Install and test A first; switch to B only after reviewing its log.' }
    $acceptedPredecessor = $false
    if ($Stage -eq 'B' -and $kitManifest.PSObject.Properties.Name -contains 'trialPredecessor') {
        $predecessor = $kitManifest.trialPredecessor
        if ($state.active.buildId -ceq $predecessor.buildId) {
            $previousFiles = @($predecessor.files.PSObject.Properties | ForEach-Object {
                [pscustomobject]@{path=$_.Name; bytes=$_.Value.bytes; sha256=$_.Value.sha256}
            })
            Assert-ProbeTree $live $previousFiles -Runtime
            $acceptedPredecessor = $true
        }
    }
    if ($Stage -eq 'B' -and !$acceptedPredecessor -and $state.active.kitVersion -ne $kitManifest.version) { throw 'Test A from this kit version first.' }
    if ($Stage -eq 'restore' -and !$state) { throw 'No recorded installation to restore' }
    if ($Stage -eq 'restore' -and !$state.active) { return 'Already restored; no changes made.' }
    $source = $null; $expected = @()
    if ($Stage -ne 'restore') {
        $stageManifest = Read-ProbeJson (Resolve-Child $Kit ("stages/$Stage/manifest.json"))
        if ($stageManifest.probe.mode -ne $(if ($Stage -eq 'A') { 0 } else { 1 })) { throw 'Wrong stage mode' }
        if ($Stage -eq 'B') {
            $aManifest = Read-ProbeJson (Resolve-Child $Kit 'stages/A/manifest.json')
            if (!$acceptedPredecessor -and $state.active.buildId -notin @($aManifest.probe.buildId,$stageManifest.probe.buildId)) { throw 'Updated package: test its A build first.' }
        }
        $source = Resolve-Child $Kit ("stages/$Stage/PSP/PLUGINS/mhp2g_zh_cn")
        $expected = @($stageManifest.files.PSObject.Properties | ForEach-Object {
            [pscustomobject]@{path=$_.Name; bytes=$_.Value.bytes; sha256=$_.Value.sha256}
        })
        Assert-ProbeTree $source $expected
    } elseif ($state.hadOriginal) { $source=$baseline; $expected=@($state.originalFiles) }
    New-Item -ItemType Directory -Path $plugins -Force | Out-Null
    New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
    if (!$state) {
        if ((Test-Path -LiteralPath $baseline) -or (Test-Path -LiteralPath (Join-Path $stateRoot 'history'))) { throw 'Incomplete prior backup; preserve it for diagnosis' }
        $hadOriginal = Test-Path -LiteralPath $live
        $originalFiles = @()
        if ($hadOriginal) {
            $originalFiles = @(Get-ProbeTree $live)
            Copy-Item -LiteralPath $live -Destination $baseline -Recurse
            Assert-ProbeTree $baseline $originalFiles
        }
        $state = [pscustomobject]@{schema='p2g-probe-switch-state-v1'; root=$Root; hadOriginal=[bool]$hadOriginal; originalFiles=$originalFiles; active=$null}
        Write-ProbeJson $statePath $state
    }
    $id = [Guid]::NewGuid().ToString('N')
    $prepared = Resolve-Child $plugins ('.bone-next-' + $id)
    $displaced = Resolve-Child $plugins ('.bone-old-' + $id)
    $archive = Resolve-Child $stateRoot ('history/' + $id)
    $movedOld=$false; $installed=$false; $committed=$false
    try {
        if ($source) { Copy-Item -LiteralPath $source -Destination $prepared -Recurse; Assert-ProbeTree $prepared $expected }
        Assert-ProbeStopped $Root $ProcessReader
        if (Test-Path -LiteralPath $live) { Move-Item -LiteralPath $live -Destination $displaced; $movedOld=$true }
        if ($TestFault -eq 'after-displace') { throw 'Injected failure after displacing plugin' }
        if ($source) { Move-Item -LiteralPath $prepared -Destination $live; $installed=$true; Assert-ProbeTree $live $expected }
        if ($TestFault -eq 'after-install') { throw 'Injected failure after installing plugin' }
        if ($movedOld) {
            New-Item -ItemType Directory -Path (Split-Path $archive) -Force | Out-Null
            Copy-Item -LiteralPath $displaced -Destination $archive -Recurse
            Assert-ProbeTree $archive @(Get-ProbeTree $displaced)
        }
        $state.active = if ($Stage -eq 'restore') { $null } else {
            [pscustomobject]@{stage=$Stage; kitVersion=$kitManifest.version; buildId=$stageManifest.probe.buildId; files=$expected}
        }
        Write-ProbeJson $statePath $state
        $committed=$true
    } catch {
        if ($installed -and (Test-Path -LiteralPath $live)) { Remove-Item -LiteralPath $live -Recurse -Force }
        if ($movedOld -and (Test-Path -LiteralPath $displaced)) { Move-Item -LiteralPath $displaced -Destination $live }
        throw
    } finally {
        if (Test-Path -LiteralPath $prepared) { Remove-Item -LiteralPath $prepared -Recurse -Force }
        if ($committed -and (Test-Path -LiteralPath $displaced)) {
            try { Remove-Item -LiteralPath $displaced -Recurse -Force } catch { Write-Warning 'Switch succeeded; preserved temporary old plugin for inspection.' }
        }
    }
    return "Completed: $Stage. Start the independent test game yourself. Logs: $live\plugin.log"
}

function Invoke-ProbeSwitch {
    param([string]$Root, [string]$Kit, [ValidateSet('A','B','P','restore')][string]$Stage,
        [scriptblock]$ProcessReader = { Get-CimInstance Win32_Process -Filter "Name LIKE 'PPSSPP%'" -ErrorAction Stop },
        [ValidateSet('','after-displace','after-install')][string]$TestFault = '')
    Assert-PlainPath $Root
    if (!(Test-Path -LiteralPath $Root -PathType Container)) { throw 'Independent test directory does not exist' }
    $lockPath = Resolve-Child $Root '.bone-probe-switch.lock'
    try { $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { throw 'Another switch may be in progress, or the test directory is not writable. Retry after it finishes.' }
    try { return Invoke-ProbeSwitchUnlocked -Root $Root -Kit $Kit -Stage $Stage -ProcessReader $ProcessReader -TestFault $TestFault }
    finally { $lock.Dispose() }
}
