import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultSummary, resultColorWash } from '../color-web/app/result-summary.mjs';

test('legacy uses saved results even when old answers cannot be rescored', () => {
  const record = { legacy:true, mbtiResult:'ISFP', colorResult:{primary:['green']}, answers:[{answer:'C. 舊答案'}] };
  const before = JSON.stringify(record), summary = resultSummary(record);
  assert.equal(summary.mbti, 'ISFP'); assert.deepEqual(summary.matched.map(c=>c.key), ['green']);
  assert.equal(JSON.stringify(record), before);
});
test('legacy summary text fallback and ties retain all colors without fabrication', () => {
  assert.deepEqual(resultSummary({legacy:true,result:'ISFP - green',answers:[]}).matched.map(c=>c.key),['green']);
  assert.deepEqual(resultSummary({legacy:true,mbtiResult:'ENFJ',colorResult:{primary:['yellow','red','yellow','invalid']}}).matched.map(c=>c.key),['red','yellow']);
  assert.equal(resultSummary({legacy:true,result:'已完成'}),null);
  assert.deepEqual(resultSummary({legacy:true,mbtiResult:'ISFP'}).matched,[]);
});
test('new results preserve the existing scoring contract and generic surveys are not classified', () => {
  assert.equal(resultSummary({survey:{resultType:'color-mbti'},answers:Array(20).fill(2)}).mbti,'ISTP');
  assert.equal(resultSummary({survey:{resultType:'receipt'},answers:[0]}),null);
});
test('color wash reflects all saved proportions and never invents missing legacy ratios',()=>{
 const summary=resultSummary({survey:{resultType:'color-mbti'},answers:[...Array(6).fill(0),...Array(6).fill(1),...Array(5).fill(2),...Array(3).fill(3)]});
 assert.deepEqual(summary.counts,[6,6,5,3]);assert.deepEqual(summary.matched.map(c=>c.key),['red','yellow']);
 const wash=resultColorWash(summary);for(const share of ['0.3','0.25','0.15'])assert.ok(wash.includes(`data-share="${share}"`));
 assert.equal(resultColorWash(resultSummary({legacy:true,mbtiResult:'ISFP',scores:{green:10}})),'');
 const old=resultSummary({legacy:true,mbtiResult:'ISFP',scores:{red:0,yellow:0,green:10,blue:0}});
 assert.deepEqual(old.counts,[0,0,10,0]);assert.equal((resultColorWash(old).match(/data-color=/g)||[]).length,1);
 assert.equal(resultSummary({legacy:true,mbtiResult:'ISFP',scores:{red:NaN,yellow:1,green:1,blue:1}}).counts,null);
});
