const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('artwork is reused within a release, code revalidates and private APIs never enter the cache',async()=>{
 const handlers={}, stored=new Map(), fetched=[];
 const cache={match:async r=>stored.get(r.url),put:async(r,v)=>stored.set(r.url,v)};
 const base='https://colorlab-start.onrender.com';
 vm.runInNewContext(fs.readFileSync('scripts/static-service-worker.js','utf8'),{
  self:{location:{origin:base},addEventListener:(event,fn)=>handlers[event]=fn},URL,
  caches:{open:async()=>cache,match:async r=>stored.get(r.url)},
  fetch:async r=>{fetched.push(r.url);return new Response('new content',{status:200});}
 });
 const read=async path=>{let response;handlers.fetch({request:new Request(base+path),respondWith:p=>response=p});return response;};
 const image=base+'/assets/characters/red.webp';stored.set(image,new Response('current release artwork'));
 assert.equal(await (await read('/assets/characters/red.webp')).text(),'current release artwork');
 assert.equal(fetched.length,0);
 assert.equal(await (await read('/app/app.js')).text(),'new content');assert.equal(fetched.length,1);
 assert.equal(await read('/api/explore/records'),undefined);assert.equal(fetched.length,1);
 stored.delete(image);assert.equal(await (await read('/assets/characters/red.webp')).text(),'new content');
 assert.equal(fetched.length,2);
});
