import { esc } from './ui.mjs';

// Chart contract: category comparisons only; all scales start at zero.
// Source is the existing protected /api/admin/data-stats aggregation, not a new extract.
const number = value => new Intl.NumberFormat('zh-TW').format(value);
const isCount = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const colorNames = { red:'紅色', yellow:'黃色', green:'綠色', blue:'藍色' };
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
  const max = Math.max(1,...series.rows.map(row => row.count));
  return `<figure class="statistics-chart statistics-${id}" aria-labelledby="statistics-${id}-title">
    <figcaption><h2 id="statistics-${id}-title">${title}</h2><p>${subtitle}</p></figcaption>
    ${!series.valid ? '<p class="statistics-empty" role="status">此項統計暫時無法顯示，請更新資料後再試。</p>' : !series.total ? '<p class="statistics-empty">目前沒有可顯示的紀錄。</p>' : `
    <div class="statistics-axis" aria-hidden="true"><span>0</span><span>${number(max)} ${unit}</span></div>
    <ol class="statistics-bars">${series.rows.map((row,index) => {
      const color = colors && Object.hasOwn(colorNames,row.label) ? row.label : '';
      const label = color ? colorNames[color] : row.label;
      return `<li${color ? ` data-color="${color}"` : ''}>
        <div class="statistics-bar-label"><span id="statistics-${id}-${index}">${esc(label)}</span><strong>${number(row.count)} <small>${unit}</small></strong></div>
        <meter min="0" max="${max}" value="${row.count}" aria-labelledby="statistics-${id}-${index}" aria-valuetext="${number(row.count)} ${unit}">${number(row.count)} ${unit}</meter>
      </li>`;
    }).join('')}</ol>`}
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
      ${chart('colors','主要色彩出現次數','同一份測驗可能有多個主色；次數不等於測驗份數。',colors,{colors:true,unit:'次'})}
      ${chart('surveys','問卷完成分布',surveys.valid && surveys.rows.length === 1 ? '目前的已保存紀錄來自 1 種問卷。' : '依問卷名稱比較已保存的完成份數。',surveys)}
    </div>
    <footer class="statistics-source"><p><strong>資料範圍</strong> 歷來已保存的原始測驗紀錄；不重複計入同步副本，不含僅存在裝置的訪客紀錄。</p><p><strong>資料來源</strong> ColorLab 管理後台測驗統計　<span>讀取時間：${timestamp}（台灣時間）</span></p></footer>
  </section>`;
}
