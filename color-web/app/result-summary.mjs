import { colors, scoreAnswers } from './model.mjs';

// Presentation only: historical results are authoritative, never rescore old answers.
export function resultSummary(record) {
  if (!record.legacy) {
    if (record.survey?.resultType !== 'color-mbti') return null;
    const scored = scoreAnswers(record.answers);
    return { mbti: scored.mbti, counts:scored.counts, matched: colors.filter((_, i) => scored.counts[i] === Math.max(...scored.counts)) };
  }
  const mbti = /^[EI][NS][FT][JP]$/.test(record.mbtiResult || '') ? record.mbtiResult : String(record.result || '').match(/\b[EI][NS][FT][JP]\b/)?.[0];
  const primary = record.colorResult?.primary;
  const keys = Array.isArray(primary) ? primary : primary ? [primary] : [];
  const fallback = keys.length ? [] : String(record.result || '').toLowerCase().match(/\b(red|yellow|green|blue)\b/g) || [];
  const matched = colors.filter(c => (keys.length ? keys : fallback).includes(c.key));
  const saved=colors.map(c=>record.scores?.[c.key]);
  const counts=saved.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)&&saved.reduce((a,b)=>a+b,0)>0?saved:null;
  return mbti || matched.length ? { mbti: mbti || '', matched,counts } : null;
}

// Coverage, not saturation, encodes the saved proportions; missing ratios stay neutral.
export function resultColorWash(summary) {
  const counts=summary?.counts,total=counts?.reduce((a,b)=>a+b,0);
  if(!total)return '';
  return `<div class="result-color-wash" aria-hidden="true">${colors.map((c,i)=>counts[i]>0?`<span style="flex:${counts[i]};--wash:${c.fill}" data-color="${c.key}" data-share="${counts[i]/total}"></span>`:'').join('')}</div>`;
}
