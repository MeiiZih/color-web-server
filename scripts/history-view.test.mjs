import {test} from 'node:test';
import assert from 'node:assert/strict';
import {historySelection,historyTests,dayKey} from '../color-web/app/history-view.mjs';
const records=Array.from({length:251},(_,i)=>({id:String(i),date:new Date(Date.UTC(2026,8,7-i)).toISOString()}));
const base={range:'all',size:'20',page:1};
test('test filter uses stable questionnaire identity, preserves legacy and retired surveys',()=>{
  const catalog=[{id:'color',title:'色彩測驗'}], date='2026-09-07';
  const rows=[{id:'1',date,title:'色彩測驗',legacy:true},{id:'2',date,surveyId:'color',survey:{title:'色彩測驗'}},{id:'3',date,surveyId:'stress',survey:{title:'壓力探索'}},{id:'4',date,surveyId:'retired',survey:{title:'已下架問卷'}}];
  assert.equal(historyTests(rows,catalog).length,3);
  assert.equal(historySelection(rows,{...base,test:'color'},new Date(),catalog).total,2);
  assert.equal(historySelection(rows,{...base,test:'retired'},new Date(),catalog).total,1);
  assert.equal(historySelection(rows,{...base,test:'missing'},new Date(),catalog).total,0);
  assert.equal(historySelection(rows,{...base,test:'all'},new Date(),catalog).total,4);
});
test('newest first, monthly grouping, all 251 and each page size',()=>{
  for(const size of ['20','50','100','150','all']){
    const v=historySelection([...records].reverse(),{...base,size});
    assert.equal(v.total,251);assert.equal(v.groups[0].records[0].id,'0');
    assert.equal(v.groups.flatMap(g=>g.records).length,size==='all'?251:Number(size));
  }
  assert.equal(historySelection(records,{...base,page:99}).page,13);
});
test('Taiwan midnight, calendar filters and inclusive custom dates',()=>{
  assert.equal(dayKey('2026-08-31T16:30:00Z'),'2026-09-01');
  const now=new Date('2026-09-07T02:00:00Z');
  assert.equal(historySelection(records,{...base,range:'month'},now).total,7);
  assert.equal(historySelection(records,{...base,range:'custom',from:'2026-09-05',to:'2026-09-07'},now).total,3);
  assert(historySelection(records,{...base,range:'custom',from:'2026-09-07',to:'2026-09-01'},now).invalidRange);
  assert.equal(historySelection(records,{...base,range:'half'},now).groups[0].key,'2026-09');
  assert.equal(historySelection(records,{...base,range:'year'},now).total,250);
});
