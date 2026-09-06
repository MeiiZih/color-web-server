const test = require('node:test');
const assert = require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const view=import(pathToFileURL(path.resolve(__dirname,'../color-web/app/statistics-view.mjs')));
const readAt=new Date('2026-09-06T16:00:00Z');
test('empty is a truthful zero, not fabricated chart data',async()=>{
  const {statisticsView}=await view;
  const html=statisticsView({totalParticipants:0,mbtiStats:[],colorStats:[],testTypeStats:[]},{readAt});
  assert.equal((html.match(/目前沒有可顯示的紀錄/g)||[]).length,3);
  assert.equal((html.match(/<meter /g)||[]).length,0);
  assert.match(html,/<strong>0<\/strong>/);assert.doesNotMatch(html,/NaN|Infinity/);
});
test('overview reconciles with survey counts; color remains occurrences',async()=>{
  const {statisticsView}=await view;
  const html=statisticsView({totalParticipants:2,mbtiStats:[{_id:'ISFP',count:2},{_id:'ENFJ',count:1}],colorStats:[{_id:'green',count:3},{_id:'yellow',count:2}],testTypeStats:[{_id:'問卷甲',count:2},{_id:'問卷乙',count:1}]},{readAt});
  assert.match(html,/<strong>3<\/strong><span>份/);assert.match(html,/<strong>2<\/strong><span>組/);
  assert.match(html,/共 3 份有 MBTI 分類的紀錄/);assert.match(html,/次數不等於測驗份數/);
  assert.match(html,/min="0" max="3" value="3"/);assert.match(html,/aria-valuetext="3 次"/);
  assert.match(html,/datetime="2026-09-06T16:00:00.000Z"/);assert.match(html,/不重複計入同步副本/);
});
test('single survey stays a single category; labels escaped; input untouched',async()=>{
  const {statisticsView}=await view;
  const stats={totalParticipants:1,mbtiStats:[{_id:'<img src=x onerror=alert(1)>',count:1}],colorStats:[{_id:'red" onclick="bad',count:1}],testTypeStats:[{_id:'<script>bad</script>',count:1}]};
  const before=JSON.stringify(stats),html=statisticsView(stats,{readAt});
  assert.equal(JSON.stringify(stats),before);assert.match(html,/已保存紀錄來自 1 種問卷/);
  assert.doesNotMatch(html,/<script>|<img |onclick="bad/);assert.match(html,/&lt;script&gt;bad/);
  assert.equal((html.match(/<meter /g)||[]).length,3);
});
test('missing or invalid counts show unavailable rather than invented zero',async()=>{
  const {statisticsView}=await view;
  const html=statisticsView({totalParticipants:-2,testTypeStats:[{_id:'Q',count:Infinity}],mbtiStats:[{count:'5'}],colorStats:null},{readAt});
  assert.equal((html.match(/暫時無法顯示/g)||[]).length,3);
  assert.equal((html.match(/<strong>—<\/strong>/g)||[]).length,2);
  assert.doesNotMatch(html,/NaN|Infinity/);
});
test('duplicate categories aggregate before sizing and sorting',async()=>{
  const {statisticsView}=await view;
  const html=statisticsView({totalParticipants:1,mbtiStats:[{_id:'ISFP',count:1},{_id:'ISFP',count:2}],colorStats:[],testTypeStats:[{_id:'Q',count:3}]},{readAt});
  assert.match(html,/max="3" value="3"/);assert.equal((html.match(/>ISFP<\/span>/g)||[]).length,1);
});
