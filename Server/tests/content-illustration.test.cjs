const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assertUniqueIllustrations}=require('../services/contentIllustration');
const registry=require('../data/contentIllustrations.json');
test('sync preflight accepts distinct assets and rejects repeated images or a forged hash',()=>{
 const contents=registry.map(({imageUrl})=>({imageUrl}));
 assert.doesNotThrow(()=>assertUniqueIllustrations(contents));
 assert.throws(()=>assertUniqueIllustrations([contents[0],contents[0]]),{status:400});
 // Altering registry metadata cannot make an unrelated file pass integrity checks.
 const original=registry[1];
 registry[1]={...registry[0],imageUrl:original.imageUrl};
 try { assert.throws(()=>assertUniqueIllustrations(contents.slice(0,2)),{status:400}); }
 finally { registry[1]=original; }
});
