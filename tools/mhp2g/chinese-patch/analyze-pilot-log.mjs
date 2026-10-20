const result=(status,reason,extra={})=>({status,reason,...extra,runtimeAccepted:false,displayAccepted:false})
export function analyzePilotRows(rows,manifest) {
  const config=rows.findIndex(r=>r.event==='config_ok'),installed=rows.findIndex(r=>r.event==='installed')
  if (rows[0]?.event!=='start' || config<1 || installed<1 ||
      rows.filter(r=>r.event==='config_ok' || r.event==='installed').length!==2 ||
      !(installed===1 || (config===1 && installed===2)))
    return result('incomplete','小样包加载或挂接记录不完整')
  const metrics=rows.filter(r=>r.event==='font_metrics').at(-1)
  if (!metrics || metrics.ready!=='1') return result('incomplete','未取得字体初始化和完整字形预检成功证据')
  if (rows.indexOf(metrics)<Math.max(config,installed)) return result('failed','字体成功记录早于加载或挂接记录')
  if (metrics.active!==String(manifest.probe.mode)) return result('failed','字体选择模式与包不符')
  const integer=(value)=>/^\d+$/.test(value??'') && Number(value)<=0xffffffff
  if (!['width','height','ascender','pool_peak'].every(k=>integer(metrics[k])) || Number(metrics.pool_peak)>32768)
    return result('failed','字体度量或容量记录损坏')
  let info=0,image=0
  for (const r of rows.filter(r=>r.event==='font_summary')) {
    if (!['info','image','pool_used','pool_peak','pool_failures'].every(k=>integer(r[k])) ||
        Number(r.info)<info || Number(r.image)<image || Number(r.pool_used)>Number(r.pool_peak) || Number(r.pool_peak)>32768 || Number(r.pool_failures))
      return result('failed','字体调用或独立分配池出现错误')
    info=Number(r.info);image=Number(r.image)
  }
  const counts={}
  for (const r of rows.filter(r=>r.event==='text_summary')) {
    if (!manifest.keys.includes(r.key) || !integer(r.selected) || !integer(r.replaced) ||
        Number(r.replaced)>Number(r.selected) || Number(r.selected)<(counts[r.key]?.selected??0) ||
        Number(r.replaced)<(counts[r.key]?.replaced??0) || (!manifest.probe.mode && Number(r.replaced)))
      return result('failed','文本键或命中计数无效')
    counts[r.key]={selected:Number(r.selected),replaced:Number(r.replaced)}
  }
  const missing=manifest.keys.filter(k=>!(manifest.probe.mode?counts[k]?.replaced:counts[k]?.selected))
  if (manifest.probe.mode && (!info || !image)) return result('incomplete','尚无中文字体信息与绘制调用证据',{counts,missing})
  if (!manifest.probe.mode) return result('passed','字体预检日志通过；仍需确认原版画面与骨刃 A/B，才可进入中文阶段',{metrics,counts,missing})
  return result(missing.length?'incomplete':'passed',missing.length?'部分小样尚未命中，继续由用户操作确认':'小样日志覆盖全部键，仍需用户逐项确认显示、分页与冷启动',{metrics,counts,missing})
}
