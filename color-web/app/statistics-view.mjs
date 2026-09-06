import { esc } from './ui.mjs';

// Chart contract: composition, at most five slices; counts and each denominator remain visible.
// Existing dashboard-native SVG, explicit ColorLab palette, numbered slices plus exact legend.
// Source is the existing protected /api/admin/data-stats aggregation, not a new extract.
const number = value => new Intl.NumberFormat('zh-TW').format(value);
const isCount = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const colorNames = { red:'紅色', yellow:'黃色', green:'綠色', blue:'藍色' };
const palette = ['#a84161','#7894b5','#83a08b','#d8b752','#a99f98'];
const colorPalette = {red:'#cf776e',yellow:'#d8b752',green:'#83a08b',blue:'#7894b5'};
const percent = (count,total) => `${new Intl.NumberFormat('zh-TW',{maximumFractionDigits:1}).format(count/total*100)}%`;
function rows(value) {
  const valid = Array.isArray(value) && value.every(row => row && isCount(row.count));
  if (!valid) return { valid:false, rows:[], total:null };
  const grouped = new Map();
  value.forEach(row => {
    const label = String(row._id ?? '').trim() || '未分類';
    grouped.set(label, (grouped.get(label) || 0) + row.count);
  });
  const list = [...grouped].map(([label,count]) => ({label,count})).sort((a,b) => b.count-a.count || a.label.localeCompare(b.label,'zh-TW'));
  const total = list.reduce((sum,row) => sum+row.count,0);
  return Number.isSafeInteger(total) ? {valid:true,rows:list,total} : {valid:false,rows:[],total:null};
}
function chart(id, title, subtitle, series, { colors=false, unit='份' } = {}) {
  const positive=series.rows.filter(row=>row.count>0);
  const grouped=positive.length>5;
  const slices=grouped ? [...positive.slice(0,4),{label:`其他 ${positive.length-4} 類`,count:positive.slice(4).reduce((sum,row)=>sum+row.count,0)}] : positive;
  const labelOf=row=>colors && Object.hasOwn(colorNames,row.label) ? colorNames[row.label] : row.label;
  let angle=-Math.PI/2;
  const svg=slices.map((row,index)=>{
    const start=angle,span=row.count/series.total*Math.PI*2;angle+=span;
    const point=a=>`${100+90*Math.cos(a)},${100+90*Math.sin(a)}`;
    const fill=colors && Object.hasOwn(colorPalette,row.label) ? colorPalette[row.label] : palette[index];
    const shape=slices.length===1 ? `<circle cx="100" cy="100" r="90" fill="${fill}"/>` : `<path d="M100,100 L${point(start)} A90,90 0 ${span>Math.PI?1:0},1 ${point(angle)} Z" fill="${fill}"/>`;
    const middle=start+span/2,r=slices.length===1?0:60;
    return `<g><title>${esc(labelOf(row))}：${number(row.count)} ${unit}，${percent(row.count,series.total)}</title>${shape}${span>=.2 ? `<text x="${100+r*Math.cos(middle)}" y="${100+r*Math.sin(middle)}">${index+1}</text>` : ''}</g>`;
  }).join('');
  return `<figure class="statistics-chart statistics-${id}" aria-labelledby="statistics-${id}-title">
    <figcaption><h2 id="statistics-${id}-title">${title}</h2><p>${subtitle}</p></figcaption>
    ${!series.valid ? '<p class="statistics-empty" role="status">此項統計暫時無法顯示，請更新資料後再試。</p>' : !series.total ? '<p class="statistics-empty">目前沒有可顯示的紀錄。</p>' : `
    <svg class="statistics-pie" viewBox="0 0 200 200" role="img" aria-label="${title}圓餅圖，共 ${number(series.total)} ${unit}；各分類數量及占比見下方圖例">${svg}</svg>
    <p class="statistics-denominator">占比分母：${number(series.total)} ${colors?'次色彩出現':`份${id==='mbti'?' MBTI 結果':'完成紀錄'}`} · 共 ${positive.length} 類</p>
    <ol class="statistics-legend">${slices.map((row,index)=>`<li><span class="statistics-legend-name"><i style="background:${colors && Object.hasOwn(colorPalette,row.label)?colorPalette[row.label]:palette[index]}">${index+1}</i><span>${esc(labelOf(row))}</span></span><span class="statistics-legend-value"><strong>${number(row.count)} <small>${unit}</small></strong><span>${percent(row.count,series.total)}</span></span></li>`).join('')}</ol>
    ${grouped || positive.length!==series.rows.length ? `<details class="statistics-breakdown"><summary>查看全部 ${series.rows.length} 類明細</summary><ul>${series.rows.map(row=>`<li><span>${esc(labelOf(row))}</span><strong>${number(row.count)} ${unit} · ${percent(row.count,series.total)}</strong></li>`).join('')}</ul></details>`:''}
    <p class="statistics-rounding">百分比四捨五入至小數一位。</p>`}
  </figure>`;
}

export function statisticsView(stats = {}, { readAt = new Date() } = {}) {
  const data = stats && typeof stats === 'object' ? stats : {};
  const mbti=rows(data.mbtiStats), colors=rows(data.colorStats), surveys=rows(data.testTypeStats);
  const participants=isCount(data.totalParticipants) ? data.totalParticipants : null;
  const validDate=readAt instanceof Date && Number.isFinite(readAt.getTime());
  const timestamp=validDate ? `<time datetime="${readAt.toISOString()}">${new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Taipei'}).format(readAt)}</time>` : '時間未提供';
  return `<section class="statistics-view" aria-label="測驗統計圖表">
    <div class="statistics-overview">
      <article class="statistics-metric"><h2>已保存測驗</h2><p><strong>${surveys.valid ? number(surveys.total) : '—'}</strong><span>份</span></p><span class="statistics-metric-note">全部問卷的原始完成紀錄</span></article>
      <article class="statistics-metric"><h2>參與識別數</h2><p><strong>${participants === null ? '—' : number(participants)}</strong><span>組</span></p><span class="statistics-metric-note">依帳號／訪客識別去重，非實際人數</span></article>
    </div>
    <div class="statistics-chart-grid">
      ${chart('mbti','MBTI 結果分布',`依完成紀錄計算${mbti.valid ? `，共 ${number(mbti.total)} 份有 MBTI 分類的紀錄` : ''}。`,mbti)}
      ${chart('colors','主要色彩出現次數占比','同一份測驗可能有多個主色；占比依色彩出現總次數計算，並非人數或測驗份數占比。',colors,{colors:true,unit:'次'})}
      ${chart('surveys','問卷完成分布',surveys.valid && surveys.rows.length === 1 ? '目前的已保存紀錄來自 1 種問卷。' : '依問卷名稱比較已保存的完成份數。',surveys)}
    </div>
    <footer class="statistics-source"><p><strong>資料範圍</strong> 歷來已保存的原始測驗紀錄；不重複計入同步副本，不含僅存在裝置的訪客紀錄。</p><p><strong>資料來源</strong> ColorLab 管理後台測驗統計　<span>讀取時間：${timestamp}（台灣時間）</span></p></footer>
  </section>`;
}
