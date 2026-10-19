#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildProbe } from './build-probe.mjs'
import { verifyEquipmentEvidence, encodeConfig, crc32, sha256 } from './equipment-evidence.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
const version = 'bone-probe-v1'
function fileMap(root) {
  const result={}
  function visit(relative) {
    for (const name of fs.readdirSync(path.join(root,relative)).sort()) {
      const key=relative?`${relative}/${name}`:name, file=path.join(root,key), stat=fs.lstatSync(file)
      assert(!stat.isSymbolicLink(),'Unexpected symlink')
      if (stat.isDirectory()) visit(key)
      else result[key]={sha256:sha256(fs.readFileSync(file)),bytes:stat.size}
    }
  }
  visit('');return result
}
function instructions(builds) {
  return `骨刃装备探针 ${version}\r\n\r\n` +
`用途：验证骨刃的文本查询与外置 ASCII 字符串返回，不是中文补丁。\r\n` +
`只使用 D:\\MH\\ppsspp\\p2g-zh-pilot-v1 内的独立模拟器。\r\n` +
`本工具不会启动、停止或操作模拟器，不修改 ISO、存档及其他插件。\r\n\r\n` +
`第一轮 A 原样转发：\r\n` +
`1. 自己关闭独立测试游戏和模拟器。双击 01-install-A.cmd，确认显示 Completed: A。\r\n` +
`2. 从独立测试目录启动 PPSSPP，冷启动游戏并正常读档。不要加载即时存档。\r\n` +
`3. 在房间装备箱查看骨刃（ボーンブレイド）。退出详情再打开，共三次。顺便查看另一件装备。\r\n` +
`4. 等待至少 6 秒后正常退出游戏，告诉开发者 A 已运行以及是否正常。\r\n` +
`5. 开发者只读收集日志；A 应显示原名称、selected>0、replaced=0、mismatch=0。确认通过后再做 B。\r\n\r\n` +
`第二轮 B 标记替换：\r\n` +
`1. 关闭独立测试模拟器，双击 02-switch-B.cmd，确认 Completed: B。\r\n` +
`2. 冷启动、正常读档，重复骨刃详情三次与另一件装备检查，等待 6 秒后退出。\r\n` +
`3. 骨刃应出现 P2G-BONE-BLADE-PROBE-OK；若名称被截断，反馈实际显示，不把计数当成画面通过。\r\n` +
`4. 再次冷启动重复关键步骤，验证重开；前一轮日志自动保留为 plugin.previous.log。\r\n` +
`5. 告诉开发者结果，由开发者核对 replaced>0、mismatch=0 和日志版本。\r\n\r\n` +
`还原：关闭独立测试模拟器，双击 03-restore.cmd，冷启动检查原名称。\r\n` +
`还原恢复首次安装本工具前的插件目录（可能包含旧探针）；原先没有该插件则移除本次插件。\r\n` +
`备份与切换前日志：独立测试目录\\bone-probe-state\\。不要手动删除或修改其中内容。\r\n` +
`当前日志：独立测试目录\\memstick\\PSP\\PLUGINS\\mhp2g_zh_cn\\plugin.log。\r\n` +
`A build=${builds.A.probe.buildId}\r\nB build=${builds.B.probe.buildId}\r\n\r\n` +
`任何错误、没有骨刃、没有日志或游戏异常：停止该轮，保留错误文本与日志。不要改存档补装备。\r\n` +
`无日志无法区分未运行、插件未加载和日志不可写；未命中仅表示缺少目标操作证据。\r\n` +
`脚本拒绝运行中的模拟器、无法识别的进程、损坏包及目录链接；不会替你关闭程序。\r\n` +
`若系统安全策略拒绝脚本，反馈提示，不修改系统级策略。\r\n` +
`所有产物仅供这次本地测试，不包含原 ISO、个人存档、完整研究输入；不要公开上传。\r\n`
}

export function buildEquipmentKit({ toolchain, output, ...evidenceOptions }) {
  output=path.resolve(output)
  assert(!fs.existsSync(output),'Output exists; use a new version directory')
  const evidence=verifyEquipmentEvidence(evidenceOptions)
  const temporary=fs.mkdtempSync(path.join(path.dirname(output),'.bone-kit-'))
  try {
    const sourceHashes=fileMap(path.join(directory,'prx'))
    const {inputs,...profile}=evidence
    const builds={}, delivery=path.join(temporary,'delivery')
    fs.mkdirSync(path.join(temporary,'builds'))
    fs.mkdirSync(path.join(delivery,'stages'),{recursive:true})
    for (const [stage,mode] of [['A',0],['B',1]]) {
      const config=encodeConfig(evidence,mode), hookConfig=path.join(temporary,`config-${stage}.bin`)
      fs.writeFileSync(hookConfig,config)
      const fingerprint=sha256(JSON.stringify({profile,sourceHashes,mode,config:sha256(config)})).slice(0,16)
      const equipmentProfile={...profile,mode,configCrc:crc32(config),buildId:`${version}-${stage}-${fingerprint}`}
      const buildOutput=path.join(temporary,'builds',stage)
      builds[stage]=buildProbe({toolchain,output:buildOutput,hookConfig,equipmentProfile})
      fs.mkdirSync(path.join(delivery,'stages',stage))
      fs.cpSync(path.join(buildOutput,'PSP'),path.join(delivery,'stages',stage,'PSP'),{recursive:true,errorOnExist:true})
      fs.copyFileSync(path.join(buildOutput,'manifest.json'),path.join(delivery,'stages',stage,'manifest.json'))
    }
    fs.mkdirSync(path.join(delivery,'scripts'))
    for (const name of ['switch-core.ps1','switch-probe.ps1']) {
      // Windows PowerShell 5.1 needs a BOM for UTF-8 source, including future translated errors.
      fs.writeFileSync(path.join(delivery,'scripts',name),'\uFEFF'+fs.readFileSync(path.join(directory,'windows',name),'utf8').replace(/^\uFEFF/,''))
    }
    for (const [file,stage] of [['01-install-A.cmd','A'],['02-switch-B.cmd','B'],['03-restore.cmd','restore']]) {
      fs.writeFileSync(path.join(delivery,file),`@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\switch-probe.ps1" -Stage ${stage}\r\nset "probeExit=%errorlevel%"\r\npause\r\nexit /b %probeExit%\r\n`)
    }
    fs.writeFileSync(path.join(delivery,'README.zh-CN.txt'),'\uFEFF'+instructions(builds))
    const kit={schema:'p2g-equipment-probe-kit-v1',version,files:fileMap(delivery)}
    fs.writeFileSync(path.join(delivery,'kit.json'),JSON.stringify(kit,null,2)+'\n')
    fs.writeFileSync(path.join(temporary,'evidence.json'),JSON.stringify({inputs,profile,sourceHashes},null,2)+'\n')
    fs.writeFileSync(path.join(temporary,'offline-build.json'),JSON.stringify({status:'compiled',runtimeAccepted:false,displayAccepted:false,builds},null,2)+'\n')
    fs.renameSync(temporary,output)
    return {output,delivery:path.join(output,'delivery'),builds}
  } finally { fs.rmSync(temporary,{recursive:true,force:true}) }
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const [toolchain,output,nativeDirectory,localizationDirectory,liveFile,disassemblyFile]=process.argv.slice(2)
  assert(disassemblyFile,'Usage: build-equipment-probe.mjs <toolchain> <new-output> <native-dir> <localization-dir> <live-json> <disassembly-json>')
  const result=buildEquipmentKit({toolchain,output,nativeDirectory,localizationDirectory,liveFile,disassemblyFile})
  console.log(JSON.stringify({delivery:result.delivery,builds:Object.fromEntries(Object.entries(result.builds).map(([k,v])=>[k,v.probe]))},null,2))
}
