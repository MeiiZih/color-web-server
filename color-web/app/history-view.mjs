// Calendar groups use Taiwan dates, not the browser's locale or an approximate month length.
export const dayKey = value => Number.isFinite(new Date(value).getTime()) ? new Date(new Date(value).getTime()+8*3600000).toISOString().slice(0,10) : '';
export function historyTest(record, catalog = []) {
  const title=record.survey?.title||record.title||'未命名測驗';
  return {key:String(record.surveyId||record.survey?.id||catalog.find(s=>s.title===title)?.id||'legacy:'+title),title};
}
export function historyTests(records,catalog=[]){return [...new Map(records.map(r=>{const t=historyTest(r,catalog);return [t.key,t];})).values()].sort((a,b)=>a.title.localeCompare(b.title,'zh-TW'));}
export function historySelection(records, options, now = new Date(), catalog = []) {
  const today=dayKey(now), month=today.slice(0,7), year=today.slice(0,4);
  const [y,m,d]=today.split('-').map(Number), startMonth=new Date(Date.UTC(y,m-1-6,1));
  const lastDay=new Date(Date.UTC(startMonth.getUTCFullYear(),startMonth.getUTCMonth()+1,0)).getUTCDate();
  startMonth.setUTCDate(Math.min(d,lastDay));
  const halfYear=startMonth.toISOString().slice(0,10);
  const invalidRange=options.range==='custom'&&options.from&&options.to&&options.from>options.to;
  const matching=records.filter(r=>{
    if(options.test&&options.test!=='all'&&historyTest(r,catalog).key!==options.test)return false;
    const day=dayKey(r.date);
    if(invalidRange)return false;
    if(options.range==='month')return day.startsWith(month);
    if(options.range==='year')return day.startsWith(year);
    if(options.range==='half')return day>=halfYear&&day<=today;
    if(options.range==='custom')return !!day&&(!options.from||day>=options.from)&&(!options.to||day<=options.to);
    return true;
  }).sort((a,b)=>(new Date(b.date).getTime()||0)-(new Date(a.date).getTime()||0)||String(b.id).localeCompare(String(a.id)));
  const size=options.size==='all'?Math.max(1,matching.length):[20,50,100,150].includes(Number(options.size))?Number(options.size):20;
  const pages=Math.max(1,Math.ceil(matching.length/size)), page=Math.min(pages,Math.max(1,Number(options.page)||1));
  const shown=matching.slice((page-1)*size,page*size), groups=[];
  for(const record of shown){const key=dayKey(record.date).slice(0,7)||'未記錄日期';let group=groups.at(-1);if(group?.key!==key){group={key,records:[]};groups.push(group);}group.records.push(record);}
  return {groups,page,pages,total:matching.length,invalidRange};
}
