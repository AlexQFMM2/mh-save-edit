param([Parameter(Mandatory=$true)][string]$Core, [Parameter(Mandatory=$true)][string]$FixtureRoot)
$ErrorActionPreference='Stop'
. $Core

if (Test-Path -LiteralPath $FixtureRoot) { throw 'Use a new fixture directory' }
if (![IO.Path]::GetFullPath($FixtureRoot).StartsWith('D:\MH\ppsspp\p2g-zh-pilot-v1\evidence\offline-switch-tests\',[StringComparison]::OrdinalIgnoreCase)) {
    throw 'Fixture root must stay inside the authorized offline test area'
}
New-Item -ItemType Directory -Path $FixtureRoot | Out-Null
$script:passed=@()
function Assert-Test($Condition,[string]$Name) {
    if (!$Condition) { throw "FAILED: $Name" }
    $script:passed += $Name
}
function Expect-Failure([scriptblock]$Action,[string]$Name) {
    $failed=$false
    try { & $Action | Out-Null } catch { $failed=$true }
    Assert-Test $failed $Name
}
function Put-Text([string]$File,[string]$Text) {
    New-Item -ItemType Directory -Path (Split-Path $File) -Force | Out-Null
    [IO.File]::WriteAllText($File,$Text,(New-Object Text.UTF8Encoding($false)))
}
function Make-Kit([string]$Kit, [string]$Schema='p2g-equipment-probe-kit-v1', [string]$Version='synthetic', [string]$Build='synthetic') {
    foreach ($stage in @('A','B')) {
        $plugin=Join-Path $Kit "stages\$stage\PSP\PLUGINS\mhp2g_zh_cn"
        Put-Text (Join-Path $plugin 'mhp2g_zh_cn.prx') "synthetic-$stage"
        Put-Text (Join-Path $plugin 'hook-probe.bin') "config-$stage"
        if ($Schema -eq 'p2g-pilot-kit-v1') {
            Put-Text (Join-Path $plugin 'texts.bin') "synthetic-text-$Build"
            Put-Text (Join-Path $plugin 'zh-cn.pgf') "synthetic-font-$Build"
        }
        $files=[ordered]@{}
        foreach ($entry in @(Get-ProbeTree $plugin)) { $files[$entry.path]=@{sha256=$entry.sha256;bytes=$entry.bytes} }
        Write-ProbeJson (Join-Path $Kit "stages\$stage\manifest.json") @{
            probe=@{mode=$(if($stage -eq 'A'){0}else{1});buildId="$Build-$stage"};files=$files
        }
    }
    $files=[ordered]@{}
    foreach ($entry in @(Get-ProbeTree $Kit)) { $files[$entry.path]=@{sha256=$entry.sha256;bytes=$entry.bytes} }
    Write-ProbeJson (Join-Path $Kit 'kit.json') @{schema=$Schema;version=$Version;files=$files}
}

$tokens=$null;$errors=$null
[Management.Automation.Language.Parser]::ParseFile($Core,[ref]$tokens,[ref]$errors) | Out-Null
Assert-Test ($errors.Count -eq 0) 'PowerShell 5.1 syntax'
$wrapper=Join-Path (Split-Path $Core) 'switch-probe.ps1'
[Management.Automation.Language.Parser]::ParseFile($wrapper,[ref]$tokens,[ref]$errors) | Out-Null
Assert-Test ($errors.Count -eq 0) 'Production entrypoint syntax'
$kit=Join-Path $FixtureRoot 'kit';Make-Kit $kit
$root=Join-Path $FixtureRoot 'target';New-Item -ItemType Directory -Path $root | Out-Null
$live=Join-Path $root 'memstick\PSP\PLUGINS\mhp2g_zh_cn'
Put-Text (Join-Path $live 'original.bin') 'keep original plugin'
Put-Text (Join-Path $live 'plugin.log') 'keep original log'
Put-Text (Join-Path $root 'memstick\PSP\SAVEDATA\sentinel.bin') 'keep save'
Put-Text (Join-Path $root 'memstick\PSP\PLUGINS\other\sentinel.bin') 'keep other plugin'
$baseline=@(Get-ProbeTree $live)
$noProcesses={ @() }
$lock=[IO.File]::Open((Join-Path $root '.bone-probe-switch.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try { Expect-Failure { Invoke-ProbeSwitch $root $kit A -ProcessReader $noProcesses } 'Concurrent switch refused' } finally { $lock.Dispose() }
$running={ @([pscustomobject]@{ExecutablePath=(Join-Path $root 'PPSSPPWindows64.exe');CommandLine=''}) }
$unknown={ @([pscustomobject]@{ExecutablePath=$null;CommandLine=''}) }
Expect-Failure { Invoke-ProbeSwitch $root $kit A -ProcessReader $running } 'Running test emulator refused'
Expect-Failure { Invoke-ProbeSwitch $root $kit A -ProcessReader $unknown } 'Unknown process refused'
Expect-Failure { Invoke-ProbeSwitch $root $kit A -ProcessReader {throw 'CIM unavailable'} } 'Process query failure refused'
Assert-Test (!(Test-Path -LiteralPath (Join-Path $root 'bone-probe-state'))) 'Preflight does not create state'
Expect-Failure { Invoke-ProbeSwitch $root $kit B -ProcessReader $noProcesses } 'B before A refused'
Invoke-ProbeSwitch $root $kit A -ProcessReader $noProcesses | Out-Null
Assert-Test ((Get-Content -LiteralPath (Join-Path $live 'mhp2g_zh_cn.prx') -Raw) -eq 'synthetic-A') 'First A installation'
Assert-ProbeTree (Join-Path $root 'bone-probe-state\original') $baseline
Assert-Test $true 'Original plugin and original log preserved'
Put-Text (Join-Path $live 'plugin.log') 'A runtime log'
$a=@(Get-ProbeTree $live)
Expect-Failure { Invoke-ProbeSwitch $root $kit B -ProcessReader $noProcesses -TestFault after-displace } 'Injected move failure'
Assert-ProbeTree $live $a;Assert-Test $true 'Rollback after displacement retains A and log'
Expect-Failure { Invoke-ProbeSwitch $root $kit B -ProcessReader $noProcesses -TestFault after-install } 'Injected post-install failure'
Assert-ProbeTree $live $a;Assert-Test $true 'Rollback after install retains A and log'
Invoke-ProbeSwitch $root $kit B -ProcessReader $noProcesses | Out-Null
Assert-Test ((Get-Content -LiteralPath (Join-Path $live 'mhp2g_zh_cn.prx') -Raw) -eq 'synthetic-B') 'A to B switch'
$logs=@(Get-ChildItem -LiteralPath (Join-Path $root 'bone-probe-state\history') -Recurse -Filter plugin.log)
Assert-Test (@($logs | Where-Object {(Get-Content -LiteralPath $_.FullName -Raw) -eq 'A runtime log'}).Count -ge 1) 'A runtime log archived'
Invoke-ProbeSwitch $root $kit restore -ProcessReader $noProcesses | Out-Null
Assert-ProbeTree $live $baseline;Assert-Test $true 'Restoration matches original files and log'
Invoke-ProbeSwitch $root $kit restore -ProcessReader $noProcesses | Out-Null
Assert-ProbeTree $live $baseline;Assert-Test $true 'Repeated restore is harmless'
Invoke-ProbeSwitch $root $kit A -ProcessReader $noProcesses | Out-Null
Assert-Test ((Get-Content -LiteralPath (Join-Path $live 'mhp2g_zh_cn.prx') -Raw) -eq 'synthetic-A') 'Reinstall after restore'
$bFile=Join-Path $kit 'stages\B\PSP\PLUGINS\mhp2g_zh_cn\mhp2g_zh_cn.prx'
Put-Text $bFile 'tampered'
Expect-Failure { Invoke-ProbeSwitch $root $kit B -ProcessReader $noProcesses } 'Tampered kit refused'
Assert-Test ((Get-Content -LiteralPath (Join-Path $live 'mhp2g_zh_cn.prx') -Raw) -eq 'synthetic-A') 'Tamper refusal leaves active plugin'
Assert-Test ((Get-Content -LiteralPath (Join-Path $root 'memstick\PSP\SAVEDATA\sentinel.bin') -Raw) -eq 'keep save') 'Save sentinel unchanged'
Assert-Test ((Get-Content -LiteralPath (Join-Path $root 'memstick\PSP\PLUGINS\other\sentinel.bin') -Raw) -eq 'keep other plugin') 'Other plugin unchanged'
$emptyRoot=Join-Path $FixtureRoot 'empty-target';New-Item -ItemType Directory -Path $emptyRoot | Out-Null
$kit2=Join-Path $FixtureRoot 'kit2';Make-Kit $kit2
Invoke-ProbeSwitch $emptyRoot $kit2 A -ProcessReader $noProcesses | Out-Null
Invoke-ProbeSwitch $emptyRoot $kit2 restore -ProcessReader $noProcesses | Out-Null
Assert-Test (!(Test-Path -LiteralPath (Join-Path $emptyRoot 'memstick\PSP\PLUGINS\mhp2g_zh_cn'))) 'Previously absent plugin removed on restore'
Expect-Failure { Resolve-Child $root '..\escape' } 'Path traversal refused'
$linked=Join-Path $FixtureRoot 'linked-target'
New-Item -ItemType Junction -Path $linked -Target $emptyRoot | Out-Null
Expect-Failure { Invoke-ProbeSwitch $linked $kit2 A -ProcessReader $noProcesses } 'Directory junction refused'
$pilot=Join-Path $FixtureRoot 'pilot-kit';Make-Kit $pilot 'p2g-pilot-kit-v1' 'pilot' 'pilot-1'
Expect-Failure { Invoke-ProbeSwitch $root $pilot B -ProcessReader $noProcesses } 'Pilot B cannot reuse bone A'
Invoke-ProbeSwitch $root $pilot A -ProcessReader $noProcesses | Out-Null
Assert-Test ((Get-Content -LiteralPath (Join-Path $live 'texts.bin') -Raw) -eq 'synthetic-text-pilot-1') 'Pilot text installed with PRX'
Invoke-ProbeSwitch $root $pilot B -ProcessReader $noProcesses | Out-Null
Assert-Test ((Get-Content -LiteralPath (Join-Path $live 'zh-cn.pgf') -Raw) -eq 'synthetic-font-pilot-1') 'Pilot PGF installed with PRX'
$update=Join-Path $FixtureRoot 'pilot-update';Make-Kit $update 'p2g-pilot-kit-v1' 'pilot' 'pilot-2'
Expect-Failure { Invoke-ProbeSwitch $root $update B -ProcessReader $noProcesses } 'Updated pilot B requires updated A'
Invoke-ProbeSwitch $root $update A -ProcessReader $noProcesses | Out-Null
Invoke-ProbeSwitch $root $update B -ProcessReader $noProcesses | Out-Null
Assert-Test ((Get-Content -LiteralPath (Join-Path $live 'texts.bin') -Raw) -eq 'synthetic-text-pilot-2') 'Updated translations switch as one package'
$trial=Join-Path $FixtureRoot 'known-text-trial';Make-Kit $trial 'p2g-pilot-kit-v1' 'known-text' 'trial-1'
$previousManifest=Read-ProbeJson (Join-Path $update 'stages\B\manifest.json')
Copy-Item -LiteralPath (Join-Path $update 'stages\B') -Destination (Join-Path $trial 'stages\P') -Recurse
$trialManifest=Read-ProbeJson (Join-Path $trial 'kit.json')
$trialManifest | Add-Member NoteProperty trialPredecessor ([pscustomobject]@{buildId='wrong-build';files=$previousManifest.files})
$trialFiles=[ordered]@{}
foreach ($entry in @(Get-ProbeTree $trial | Where-Object path -ne 'kit.json')) { $trialFiles[$entry.path]=@{sha256=$entry.sha256;bytes=$entry.bytes} }
$trialManifest.files=$trialFiles
Write-ProbeJson (Join-Path $trial 'kit.json') $trialManifest
Expect-Failure { Invoke-ProbeSwitch $root $trial B -ProcessReader $noProcesses } 'Trial refuses a different predecessor build'
$trialManifest.trialPredecessor.buildId=$previousManifest.probe.buildId
$trialManifest.trialPredecessor.files.'texts.bin'.sha256='invalid'
Write-ProbeJson (Join-Path $trial 'kit.json') $trialManifest
Expect-Failure { Invoke-ProbeSwitch $root $trial B -ProcessReader $noProcesses } 'Trial refuses changed predecessor files'
$previousManifest=Read-ProbeJson (Join-Path $update 'stages\B\manifest.json')
$trialManifest.trialPredecessor.files=$previousManifest.files
Write-ProbeJson (Join-Path $trial 'kit.json') $trialManifest
Invoke-ProbeSwitch $root $trial B -ProcessReader $noProcesses | Out-Null
Assert-Test ((Get-Content -LiteralPath (Join-Path $live 'texts.bin') -Raw) -eq 'synthetic-text-trial-1') 'Trial accepts the exact reviewed predecessor without repeating A'
Invoke-ProbeSwitch $root $trial P -ProcessReader $noProcesses | Out-Null
Assert-Test ((Get-Content -LiteralPath (Join-Path $live 'texts.bin') -Raw) -eq 'synthetic-text-pilot-2') 'P returns to the bundled accepted pilot'
Invoke-ProbeSwitch $root $trial B -ProcessReader $noProcesses | Out-Null
Assert-Test ((Get-Content -LiteralPath (Join-Path $live 'texts.bin') -Raw) -eq 'synthetic-text-trial-1') 'Trial can be reapplied after returning to the pilot'
Invoke-ProbeSwitch $root $update restore -ProcessReader $noProcesses | Out-Null
Assert-ProbeTree $live $baseline;Assert-Test $true 'Pilot restore preserves initial pre-bone baseline'
$report=@{status='passed';testCount=$script:passed.Count;tests=$script:passed;gameStarted=$false;fixtureRoot=$FixtureRoot}
Write-ProbeJson (Join-Path $FixtureRoot 'report.json') $report
$report | ConvertTo-Json -Depth 5
