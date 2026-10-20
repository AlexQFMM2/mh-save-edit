#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { preparePilot } from './prepare-pilot.mjs'
import { hash, decodeTextPackage } from './text-package.mjs'
import { crc32 } from './equipment-evidence.mjs'
import { pilotEvidence, pilotHeader } from './pilot-evidence.mjs'
import { prepareBatch } from './prepare-batch.mjs'
import { batchHeader } from './batch-evidence.mjs'
import { elfMemory, pluginMemoryMb } from './build-memory.mjs'

const source = path.dirname(fileURLToPath(import.meta.url))
const read = file => JSON.parse(fs.readFileSync(file))
export function fileMap(root) {
  const files={}
  function visit(relative) {
    for (const name of fs.readdirSync(path.join(root,relative)).sort()) {
      const key=relative?`${relative}/${name}`:name, file=path.join(root,key), stat=fs.lstatSync(file)
      assert(!stat.isSymbolicLink(), 'Unexpected symlink')
      if (stat.isDirectory()) visit(key)
      else files[key]={sha256:hash(fs.readFileSync(file)),bytes:stat.size}
    }
  }
  visit(''); return files
}
function run(command,args,env) {
  const result=spawnSync(command,args,{env,encoding:'utf8',maxBuffer:8*1024*1024})
  assert.equal(result.status,0,`${command} failed: ${result.stdout}\n${result.stderr}`)
  return result.stdout+result.stderr
}
function instructions(builds, batchCounts) {
  if (batchCounts) return `P2G 已知文本扩展试用 known-text-v1\r\n\r\n`+
    `本包只使用项目已有审阅及本轮逐项审校译文；不包含已否决的离线机翻草稿。\r\n`+
    `已审阅文本单元 ${batchCounts.authoredUnits}，其中原译文不同 ${batchCounts.changedUnits}；未译 ${batchCounts.untranslatedUnits}。\r\n`+
    `本包接入引用 ${batchCounts.runtimeBindings}；已有译文但待入口／结构处理引用 ${batchCounts.pendingBindings}。\r\n`+
    `已接入口中的审阅译文和配套字库已重建；覆盖量以上述计数为准。尚非整作全量汉化。\r\n`+
    `教程／训练／任务待接入口和来源未确认的标题等文字仍可能有日文。过滤词保持原样。\r\n\r\n`+
    `1. 关闭独立测试游戏，双击 02-chinese-B.cmd，再自行启动独立 PPSSPP 并冷启动日版游戏。\r\n`+
    `   不使用即时存档，不需要重新做已经通过的小样字体 A/B。A 只供缺项诊断。\r\n`+
    `2. 先看房间装备箱菜单、不同道具和装备的名称／说明，再看农场管理员、猫厨房与其他可访问菜单。\r\n`+
    `   留意错译、缺字、溢出、控制符和原有角色／猫名字；保存重开和更多场景可随后补测。\r\n`+
    `3. 退出后保留 memstick\\PSP\\PLUGINS\\mhp2g_zh_cn\\plugin.log，由开发者核对具体命中和错误。\r\n`+
    `4. 要退回本次切换前的已通过小样，双击 03-previous.cmd；要恢复工具首次安装前状态，双击 04-restore-original.cmd。均须冷启动。\r\n`+
    `   不手动删除 bone-probe-state；original 是最初备份，history 留存切换前版本；P 是本包自带的已通过小样。\r\n\r\n`+
    `本工具不启动／停止模拟器，不修改 ISO、存档、全局字体或应用数据库。仅供私有试用，不公开上传。\r\n`+
    `B build=${builds.B.probe.buildId}\r\nA build=${builds.A.probe.buildId}\r\n`
  return `P2G 中文小样 pilot-font-v1\r\n\r\n`+
    `仅使用 D:\\MH\\ppsspp\\p2g-zh-pilot-v1 内的独立 PPSSPP。\r\n`+
    `这是待验收包，不是已通过显示测试的汉化版。原 ISO、存档和模拟器全局字体不变。\r\n`+
    `先完成旧 bone-probe-v1 的 A/B 骨刃测试，并让开发者读取两轮日志。\r\n`+
    `不要使用即时存档；每轮关闭模拟器后切换，冷启动游戏。所有游戏操作由你完成。\r\n\r\n`+
    `1. 双击 01-font-check-A.cmd。A 只记录原版字体度量、加载并离线检查外置字库，仍显示日文。\r\n`+
    `   打开骨刃详情三次，等待至少 6 秒后退出。开发者检查 font_metrics 的 ready=1、active=0、无 font_error。\r\n`+
    `   如果 font_init_missed，先停止：当前加载时机未得到证据，不切 B。\r\n`+
    `2. A 核对通过后，双击 02-chinese-B.cmd，冷启动。先检查 9 件对象的名称和说明。\r\n`+
    `   回复药、药草、染色球、光辉甲虫、大名盾蟹的爪、骨刃、铁铳枪、毛皮兜帽、毛皮外套。\r\n`+
    `   铁铳枪的炮击 LV1 颜色需正确，说明不得截断、越界或出现字面量反斜杠 n。\r\n`+
    `3. 18 单元字体验证通过后，新角色醒来检查床边 NPC 的 5 页候选对白。\r\n`+
    `   资源页号 86 至 90 已提取；触发分支和实际完整页序仍待核验，不把相邻索引当成完整验收。\r\n`+
    `   不要为了凑齐对象修改存档，缺少对象直接反馈。\r\n`+
    `4. 同时检查其他日文、按钮符号、旧角色／随从名字、长文本与重复打开。\r\n`+
    `5. 正常保存并退出，冷启动读档重验。更新译文需要重新构建配套 PRX／文本／PGF，不能单独覆盖 texts.bin。\r\n`+
    `6. 双击 03-restore.cmd 后冷启动，确认恢复切换工具首次安装前的插件状态。\r\n\r\n`+
    `切换共用 bone-probe-state，保留原始备份及历史日志，不要手动删除。一次只启用一个插件。\r\n`+
    `日志：memstick\\PSP\\PLUGINS\\mhp2g_zh_cn\\plugin.log；前轮为 plugin.previous.log。\r\n`+
    `A build=${builds.A.probe.buildId}\r\nB build=${builds.B.probe.buildId}\r\n`+
    `出现错误／无中文／无日志时停止本轮，保留日志并反馈。日志成功不等于画面成功。\r\n`+
    `加载或容量失败会阻止译文；运行中发生字形错误后须冷启动恢复，不能热卸载仍有驻留字符串的插件。\r\n`+
    `源字体、许可和全部构建输入哈希在配套清单中。包只供私有测试，不公开上传。\r\n`
}

export function buildPilot(options) {
  const {toolchain,nativeDirectory,localizationDirectory,reviewFile,evidenceDirectory,fontFile}=options
  const output=path.resolve(options.output)
  const requestedMemoryMb=pluginMemoryMb(fs.readFileSync(path.join(source,'prx/plugin.ini'),'utf8'))
  assert(!fs.existsSync(output),'Use a new output directory')
  fs.mkdirSync(path.dirname(output),{recursive:true})
  const temporary=fs.mkdtempSync(path.join(path.dirname(output),'.p2g-pilot-'))
  const env={...process.env,PSPDEV:path.resolve(toolchain),PATH:`${path.resolve(toolchain)}/bin:${process.env.PATH}`}
  try {
    const textDir=path.join(temporary,'texts'),fontDir=path.join(temporary,'font')
    if (options.batch) prepareBatch({...options.batch,nativeDirectory,output:textDir})
    else preparePilot({nativeDirectory,localizationDirectory,reviewFile,dialogueFile:path.join(evidenceDirectory,'dialogue-bind.json'),output:textDir})
    run('python3',[path.join(source,'build-font.py'),'--font',fontFile,'--characters',path.join(textDir,'characters.json'),'--output',fontDir],env)
    const prepared=read(path.join(textDir,'prepared.json')), font=read(path.join(fontDir,'font.json'))
    const textBytes=fs.readFileSync(path.join(textDir,'texts.bin')), pgfBytes=fs.readFileSync(path.join(fontDir,'zh-cn.pgf'))
    assert.equal(hash(pgfBytes),font.pgfSha256)
    assert.deepEqual(font.codepoints,prepared.codepoints)
    const rows=decodeTextPackage(textBytes)
    const evidence=pilotEvidence(evidenceDirectory,prepared)
    const sourceFiles=['equipment_main.c','pilot_core.c','pilot_core.h','pilot_font.c','pilot_font.h','pilot_io.c','pilot_io.h',
      'pilot_hook.c','pilot_hook.h','pilot_quest.c','pilot_quest.h','probe_core.c','probe_core.h','probe_log.c','probe_log.h','Makefile','plugin.ini']
    const sourceHashes=Object.fromEntries(sourceFiles.map(name=>[name,hash(fs.readFileSync(path.join(source,'prx',name)))]))
    const buildToolHashes=Object.fromEntries(['build-pilot.mjs','build-memory.mjs','prepare-pilot.mjs','prepare-batch.mjs','quest-bindings.mjs','batch-evidence.mjs','text-package.mjs','pilot-evidence.mjs','build-font.py','pgf_codec.py',
      'THIRD_PARTY_PGF.txt','windows/switch-core.ps1','windows/switch-probe.ps1'].map(name=>[name,hash(fs.readFileSync(path.join(source,name)))]))
    const compiler=run('psp-gcc',['--version'],env).trim()
    const builds={}, delivery=path.join(temporary,'delivery')
    for (const [stage,mode] of [['A',0],['B',1]]) {
      const build=path.join(temporary,'builds',stage),plugin=path.join(delivery,'stages',stage,'PSP/PLUGINS/mhp2g_zh_cn')
      fs.mkdirSync(build,{recursive:true});fs.mkdirSync(plugin,{recursive:true})
      for (const name of sourceFiles) fs.copyFileSync(path.join(source,'prx',name),path.join(build,name))
      const fingerprint=hash(JSON.stringify({sourceHashes,buildToolHashes,evidence,font,compiler,text:hash(textBytes),mode,
        ...(options.batch?{batch:{inputs:prepared.inputs,inspectionSha256:hash(fs.readFileSync(options.batch.inspectionFile))}}:{})})).slice(0,16)
      const buildId=`${options.batch?'known-text-v1':'pilot-font-v1'}-${stage}-${fingerprint}`
      let profile=pilotHeader(evidence,font,{textBytes:textBytes.length,textCrc:crc32(textBytes),pgfBytes:pgfBytes.length,pgfCrc:crc32(pgfBytes),mode,buildId})
      if (options.batch) {
        const extra=`\n#define PILOT_FIND_FIRST_WORDS {${evidence.find.words.slice(0,2).map(n=>`0x${n.toString(16)}u`).join(',')}}\n`+
          batchHeader(prepared,options.batch.inspectionFile,options.batch.resourcesFile)
        profile=profile.replace(/#endif\n$/,extra+'#endif\n')
      }
      fs.writeFileSync(path.join(build,'pilot_profile.h'),profile)
      fs.writeFileSync(path.join(build,'build.log'),run('make',['-C',build,'PILOT=1',...(options.batch?['BATCH=1',`BATCH_ROWS=${rows.length}`]:[])],env))
      const sections=run('psp-size',['-A',path.join(build,'mhp2g_zh_cn.elf')],env)
      fs.writeFileSync(path.join(build,'memory-sections.txt'),sections)
      const memory=elfMemory(fs.readFileSync(path.join(build,'mhp2g_zh_cn.elf')),requestedMemoryMb)
      for (const name of ['mhp2g_zh_cn.prx','plugin.ini']) fs.copyFileSync(path.join(build,name),path.join(plugin,name))
      fs.writeFileSync(path.join(plugin,'texts.bin'),textBytes);fs.writeFileSync(path.join(plugin,'zh-cn.pgf'),pgfBytes)
      fs.copyFileSync(path.join(fontDir,'OFL.txt'),path.join(plugin,'OFL.txt'))
      fs.copyFileSync(path.join(source,'THIRD_PARTY_PGF.txt'),path.join(plugin,'THIRD_PARTY_PGF.txt'))
      builds[stage]={schema:'p2g-pilot-build-v1',probe:{format:1,pilot:true,buildId,mode,table:0,index:0},
        memory,...(options.batch?{coverage:prepared.counts}:{}),
        files:fileMap(plugin),compiler,sourceHashes,buildToolHashes,profileSha256:hash(profile),textSha256:hash(textBytes),fontSha256:hash(pgfBytes),
        keys:rows.map(r=>`${r.member}:${r.table}:${r.index}`),runtimeAccepted:false,displayAccepted:false}
      fs.writeFileSync(path.join(delivery,'stages',stage,'manifest.json'),JSON.stringify(builds[stage],null,2)+'\n')
    }
    fs.mkdirSync(path.join(delivery,'scripts'))
    for (const name of ['switch-core.ps1','switch-probe.ps1']) fs.writeFileSync(path.join(delivery,'scripts',name),'\uFEFF'+fs.readFileSync(path.join(source,'windows',name),'utf8').replace(/^\uFEFF/,''))
    let predecessor
    if (options.batch) {
      assert(options.batch.previousStageDirectory,'Supply the accepted pilot stage for rollback')
      const previous=read(path.join(options.batch.previousStageDirectory,'manifest.json'))
      assert.equal(previous.probe.buildId,'pilot-font-v1-B-0b9a2f0386e58b67','Different accepted pilot')
      const previousPlugin=path.join(options.batch.previousStageDirectory,'PSP/PLUGINS/mhp2g_zh_cn')
      assert.deepEqual(fileMap(previousPlugin),previous.files,'Accepted pilot files changed')
      fs.cpSync(options.batch.previousStageDirectory,path.join(delivery,'stages/P'),{recursive:true})
      predecessor={buildId:previous.probe.buildId,files:previous.files}
    }
    const shortcuts=options.batch
      ? [['01-font-check-A.cmd','A'],['02-chinese-B.cmd','B'],['03-previous.cmd','P'],['04-restore-original.cmd','restore']]
      : [['01-font-check-A.cmd','A'],['02-chinese-B.cmd','B'],['03-restore.cmd','restore']]
    for (const [name,stage] of shortcuts)
      fs.writeFileSync(path.join(delivery,name),`@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\switch-probe.ps1" -Stage ${stage}\r\nset "probeExit=%errorlevel%"\r\npause\r\nexit /b %probeExit%\r\n`)
    fs.writeFileSync(path.join(delivery,'README.zh-CN.txt'),'\uFEFF'+instructions(builds,options.batch?prepared.counts:null))
    fs.copyFileSync(path.join(fontDir,'font.json'),path.join(delivery,'font-manifest.json'))
    if(options.batch) fs.writeFileSync(path.join(delivery,'coverage.json'),JSON.stringify({
      schema:'p2g-known-text-coverage-v1',counts:prepared.counts,
      connectedMembers:[15,4757,5369,5370,5371,5372],
      pending:prepared.pending,untranslated:prepared.untranslated,
      excludedUnits:prepared.counts.excludedUnits,runtimeAccepted:false,displayAccepted:false
    },null,2)+'\n')
    fs.writeFileSync(path.join(delivery,'version.json'),JSON.stringify({schema:'p2g-pilot-version-v1',sourceInputs:prepared.inputs,
      nativeEvidence:evidence.inputs,bootSha256:prepared.bootSha256,isoSha256:prepared.isoSha256,sourceHashes,buildToolHashes,
      textSha256:hash(textBytes),fontSha256:hash(pgfBytes),runtimeAccepted:false},null,2)+'\n')
    fs.writeFileSync(path.join(delivery,'kit.json'),JSON.stringify({schema:'p2g-pilot-kit-v1',version:options.batch?'known-text-v1':'pilot-font-v1',
      ...(predecessor?{trialPredecessor:predecessor}:{}),files:fileMap(delivery)},null,2)+'\n')
    fs.renameSync(temporary,output)
    return {output,delivery:path.join(output,'delivery'),builds}
  } finally {fs.rmSync(temporary,{recursive:true,force:true})}
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const [toolchain,nativeDirectory,localizationDirectory,reviewFile,evidenceDirectory,fontFile,output]=process.argv.slice(2)
  assert(output,'Usage: build-pilot.mjs <pspdev> <native-dir> <localization-dir> <review> <evidence-dir> <source-font> <new-output>')
  const result=buildPilot({toolchain,nativeDirectory,localizationDirectory,reviewFile,evidenceDirectory,fontFile,output})
  console.log(JSON.stringify({delivery:result.delivery,builds:Object.fromEntries(Object.entries(result.builds).map(([k,v])=>[k,v.probe]))},null,2))
}
