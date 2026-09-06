const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('source alternatives are limited to reviewed sources and never echo input',async()=>{
 const {sourceHelp}=await import('../color-web/app/source-help.mjs');
 assert.match(sourceHelp('https://www.life1995.org.tw/?iid=169'),/page.line.me\/093wgvxu/);
 assert.match(sourceHelp('https://life1995.org.tw/'),/新北生命線協談說明/);
 assert.match(sourceHelp('https://www.nature.com/articles/s41562-026-02415-6'),/41772060/);
 for(const input of ['<script>alert(1)</script>','https://life1995.org.tw.evil.test','https://www.nature.com/articles/other']) assert.equal(sourceHelp(input),'');
});
test('character instances have unique SVG definitions and preserve the original images',async()=>{
 const {character}=await import('../color-web/app/character-art.mjs');
 const html=['red','yellow','green','blue','red'].map(character).join('');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const color of ['red','yellow','green','blue']) assert.match(character(color),new RegExp('/assets/characters/'+color+'\\.webp'));
 assert.equal(character('unknown'),'');
});
test('built PWA installs inside the static app and caches all new visual dependencies',()=>{
 const dir=path.resolve(__dirname,'../static-dist');
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.webmanifest')));
 assert.equal(manifest.start_url,'/app/');assert.equal(manifest.display,'standalone');
 assert.deepEqual(manifest.display_override,['standalone']);
 const worker=fs.readFileSync(path.join(__dirname,'static-service-worker.js'),'utf8');
 const cached=require('node:vm').runInNewContext(worker+';SHELL',{self:{addEventListener(){}}});
 for(const file of ['app/character-art.mjs','app/source-help.mjs','app/companion-interaction.mjs','app/content-illustrations.mjs','assets/images/survey-color-cover-20260906.webp',...['hotline-1925','lifeline-1995','teacher-1980','care-guide','psychology-columns','public-lectures','digital-research','inner-child','psychology-knowledge','youth-text','healthy-boundaries','relationship-pause','social-emotional-ai','counseling'].map(x=>'assets/images/posts/'+x+'-20260906.webp')]) {
  assert(fs.existsSync(path.join(dir,file)),file);assert(cached.includes('/'+file),file);
 }
});
