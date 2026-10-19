#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { readJson } from './equipment-evidence.mjs'
import { analyzePilotRows } from './analyze-pilot-log.mjs'

const failures = new Set(['config_error','version_mismatch','source_mismatch','source_timeout','jump_region_mismatch',
  'target_changed','original_mismatch','invalid_pointer','log_write_failed'])
const known = new Set(['start','config_ok','source_waiting','source_ok','installed','waiting_target','first_match','first_replace','summary','log_limit',...failures])
const pilotEvents = new Set(['font_metrics','font_summary','text_summary','font_error','font_init_missed'])
const fail = reason => ({ status:'failed', reason, runtimeAccepted:false, displayAccepted:false })
const pending = reason => ({ status:'incomplete', reason, runtimeAccepted:false, displayAccepted:false })

export function analyzeProbeLog(text, manifest) {
  const expected = manifest.probe
  if (!expected || expected.format !== 1) return fail('包清单缺少受支持的探针版本')
  if (!text) return pending('没有启动日志：尚未运行、插件未加载或日志不可写，需要核对')
  if (Buffer.byteLength(text) > 256*1024) return fail('日志超过单轮上限，可能混入旧日志')
  if (!text.endsWith('\n')) return pending('日志末行不完整，不能确认本轮结果')
  const rows = []
  for (const line of text.trimEnd().split(/\r?\n/)) {
    if (!line.startsWith('P2GPROBE/1 ')) return fail('混入旧格式或未知日志')
    const tokens = line.slice(11).split(' '), row = {}
    for (const token of tokens) {
      const match = /^([a-z_]+)=([A-Za-z0-9_:.-]+)$/.exec(token)
      if (!match || Object.hasOwn(row,match[1])) return fail('日志字段损坏或重复')
      row[match[1]]=match[2]
    }
    if (!(known.has(row.event) || (expected.pilot && pilotEvents.has(row.event))) || row.build !== expected.buildId || row.mode !== String(expected.mode) ||
        row.target !== `${expected.table}:${expected.index}`) return fail('日志与当前包版本、模式或目标不一致')
    if (!row.run || Number(row.seq) !== rows.length+1 || (rows.length && row.run !== rows[0].run)) return fail('运行标识或事件序号不连续，可能混入多轮日志')
    rows.push(row)
  }
  if (rows[0]?.event !== 'start' || rows.filter(x => x.event === 'start').length !== 1) return pending('缺少唯一启动记录')
  const error = rows.find(x => failures.has(x.event))
  if (error) return fail(`探针拒绝或运行异常：${error.event}`)
  if (rows.some(x => x.event === 'log_limit')) return pending('本轮日志已达上限，需要冷启动重新采集')
  if (expected.pilot) {
    if (!Array.isArray(manifest.keys) || !manifest.keys.length || new Set(manifest.keys).size!==manifest.keys.length) return fail('缺少小样原生键清单')
    const error=rows.find(r=>r.event==='font_error' || r.event==='font_init_missed')
    if (error) return fail(`字体阶段未通过：${error.event}`)
    return analyzePilotRows(rows,manifest)
  }
  const order = ['start','config_ok','source_waiting','source_ok','installed','waiting_target']
  if (!order.every((e,i) => rows[i]?.event === e)) return pending('加载／挂接阶段记录不完整')
  let last
  for (const row of rows.filter(x => x.event === 'summary')) {
    const keys = ['calls','selected','replaced','mismatch','invalid'], counts = {}
    for (const key of keys) {
      if (!/^\d+$/.test(row[key]??'') || Number(row[key]) > 0xffffffff) return fail('计数格式无效')
      counts[key]=Number(row[key])
      if (last && counts[key]<last[key]) return fail('计数倒退，日志不可信')
    }
    if (counts.selected > counts.calls || counts.replaced+counts.mismatch > counts.selected || counts.invalid > counts.mismatch) return fail('计数关系无效')
    last=counts
  }
  if (!last) return pending('缺少计数摘要：操作后需等待至少 6 秒再退出')
  if (last.mismatch || last.invalid) return fail('目标原文或指针校验失败')
  if (!last.selected) return {...pending('尚未命中骨刃，等待用户操作指定装备'),counts:last}
  if (!rows.some(x => x.event === 'first_match')) return pending('缺少首次命中记录')
  if (expected.mode===0 && last.replaced!==0) return fail('原样转发模式出现替换计数')
  if (expected.mode===1 && (!last.replaced || !rows.some(x => x.event==='first_replace'))) return pending('目标已命中，但没有替换成功证据')
  return {status:'passed',reason: expected.mode===0 ? '日志满足原样转发条件，仍需用户确认游戏操作正常' : '日志记录目标替换，仍需用户确认画面标记及操作正常',
    buildId:expected.buildId,run:rows[0].run,counts:last,runtimeAccepted:false,displayAccepted:false}
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const [logFile,manifestFile]=process.argv.slice(2)
  if (!logFile || !manifestFile) throw new Error('Usage: analyze-probe-log.mjs <plugin.log> <stage-manifest.json>')
  const result=analyzeProbeLog(fs.existsSync(logFile)?fs.readFileSync(logFile,'utf8'):'',readJson(manifestFile))
  console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='passed'?0:result.status==='failed'?1:2
}
