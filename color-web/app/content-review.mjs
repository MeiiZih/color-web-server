import {esc,date,link,button} from './ui.mjs';
import {api,json} from './auth.mjs';
import {safeUrl} from './client.mjs';
import {mediaFor,contentMedia} from './content-media.mjs';
export function adminContentMedia(item={}){
 const media=mediaFor(item);
 return `<figure class="admin-content-media" aria-label="貼文圖片預覽">${contentMedia({...item,media:{...media,imageUrl:media.imageUrl?safeUrl(media.imageUrl,''):''}},'poster')}</figure>`;
}
const request=(path,options={})=>api('/api/admin/content-review'+path,{...options,role:'admin'});
const actions={add:'建議新增',update:'建議更正',remove:'建議下架'};
const states={pending:'待審核',approved:'已核准',rejected:'已略過',restored:'已恢復'};
const external=(url,label)=>`<a href="${esc(safeUrl(url,'#'))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
const detail=(title,c)=>`<section class="review-copy"><h4>${title}</h4>${c?`<strong>${esc(c.title)}</strong>${adminContentMedia(c)}<p>${esc(c.description)}</p><p class="hint">${esc(c.sourceName||'')} · ${c.type==='news'?'最新資訊':'一般資訊'}</p>${c.expiresAt?`<p class="hint">截止／下架時間：${date(c.expiresAt)}</p>`:''}`:'<p class="hint">尚未刊登</p>'}</section>`;
export async function reviewPage(){
 return `<div class="page-intro"><span class="eyebrow">COLORLAB / CONTENT DESK</span><h1>每週資訊待審</h1><p>先看來源，再決定留給大家的內容。未核准的建議不會公開。</p></div><section class="review-summary panel"><div><strong>你的內容編輯桌</strong><p class="hint">每週電腦、網路與 Codex 可執行時補跑一次，整理後同步到這裡並寄摘要信。</p></div><a class="button secondary" href="#content">查看首頁資訊</a></section><div class="review-tabs" role="group" aria-label="審核狀態">${Object.entries(states).map(([key,label])=>`<button type="button" class="button secondary" data-review-state="${key}" aria-pressed="${key==='pending'}">${label}</button>`).join('')}</div><div id="review-results" aria-live="polite"></div><details class="panel review-import"><summary>手動匯入已查核清單</summary><p class="hint">自動同步暫停時可使用；匯入只建立待審建議，不會發布。每週清單同步後不可覆寫。</p><label>選取清單 JSON<input type="file" accept="application/json,.json" data-review-file></label><p role="status" data-import-status></p></details>`;
}
export async function bindReview(root,{showDialog,modal,notify,setBusy=()=>{}}){
 let filter='pending',generation=0,busy=false;
 const results=root.querySelector('#review-results');
 async function load(){
  const seq=++generation;results.innerHTML='<p role="status">正在讀取待審清單…</p>';
  try{
   const data=await request('?status='+filter);if(seq!==generation||!results.isConnected)return;
   const latest=data.batches[0];
   results.innerHTML=`<div class="review-batch"><p><strong>${data.pending} 筆待審</strong>${latest?` · 最近整理：${esc(latest._id)} 當週`:' · 尚未收到每週清單'}</p>${latest?.sourceFailures?.length?`<details><summary>本週有 ${latest.sourceFailures.length} 個來源需留意</summary><ul>${latest.sourceFailures.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}</div>${filter==='pending'&&data.items.length?`<div class="review-actions"><label><input type="checkbox" data-select-all> 全選本頁待審</label><span data-selected-count>已選 0 筆</span><button type="button" class="button primary" data-decision="approve" disabled>核准所選</button><button type="button" class="button secondary" data-decision="reject" disabled>略過所選</button></div>`:''}<div class="review-list">${data.items.map(item=>`<article class="review-item" data-review-id="${esc(item._id)}"><div class="review-item-head">${filter==='pending'?`<label class="review-choice"><input type="checkbox" data-select-review value="${esc(item._id)}" aria-label="選取 ${esc(item.title)}"><span class="review-tag ${item.action}">${actions[item.action]}</span></label>`:`<span class="review-tag ${item.action}">${actions[item.action]} · ${states[item.status]}</span>`}<span class="hint">${esc(item.weekStart)} 當週</span></div><h2>${esc(item.title)}</h2><p>${esc(item.reason)}</p><p class="review-source">${external(item.sourceUrl,item.sourceName)} · 查核 ${esc(item.checkedAt)}</p><details><summary>查看刊登內容${item.action!=='add'?'與原內容對照':''}</summary><div class="review-comparison">${item.action!=='add'?detail('目前／原始內容',item.before):''}${item.action!=='remove'?detail('建議刊登內容',item.content):'<section class="review-copy"><h4>核准後</h4><p>從公開首頁下架，保留資料。可在已核准紀錄中恢復。</p></section>'}</div>${item.content?.registrationUrl?`<p>${external(item.content.registrationUrl,'主辦報名連結')}</p>`:''}</details>${item.status==='approved'&&item.action==='remove'?`<button type="button" class="button secondary" data-restore-review="${esc(item._id)}">恢復這筆資訊</button>`:''}${item.reviewedAt?`<p class="hint">處理時間：${date(item.reviewedAt)}</p>`:''}</article>`).join('')||`<section class="quiet-empty"><h2>${filter==='pending'?'目前沒有待審項目':'目前沒有這類紀錄'}</h2><p>${filter==='pending'?'新清單同步後會出現在這裡；已核准或略過的項目可由上方切換查看。':'切換其他狀態查看。'}</p></section>`}</div><p class="hint">每頁最多顯示 200 筆。過期活動即使恢復也不會重新公開，需更正日期後才會顯示。</p>`;
   const selected=()=>[...results.querySelectorAll('[data-select-review]:checked')].map(x=>x.value);
   function sync(){const n=selected().length;const count=results.querySelector('[data-selected-count]');if(count)count.textContent=`已選 ${n} 筆（單次最多 60 筆）`;results.querySelectorAll('[data-decision]').forEach(b=>b.disabled=!n||n>60||busy);const all=results.querySelector('[data-select-all]');if(all){all.checked=n===data.items.length;all.indeterminate=n>0&&n<data.items.length;}}
   results.querySelector('[data-select-all]')?.addEventListener('change',e=>{results.querySelectorAll('[data-select-review]').forEach((x,i)=>x.checked=e.target.checked&&i<60);sync();});
   results.querySelectorAll('[data-select-review]').forEach(x=>x.addEventListener('change',sync));
   results.querySelectorAll('[data-decision]').forEach(b=>b.onclick=()=>{
    const ids=selected(),decision=b.dataset.decision;const chosen=data.items.filter(i=>ids.includes(i._id));
    confirm(decision==='approve'?'核准這些資訊？':'略過這些建議？',`${decision==='approve'?'確認後將立即發布、更正或下架以下項目。':'略過不修改公開資訊，同一份建議不會重複加入。'}<ul>${chosen.map(i=>`<li>${actions[i.action]}：${esc(i.title)}</li>`).join('')}</ul>`,()=>request('/decide',json('POST',{ids,decision})),decision==='approve'?'確認核准並套用':'確認略過');
   });
   results.querySelectorAll('[data-restore-review]').forEach(b=>b.onclick=()=>confirm('恢復已下架資訊？','恢復後，尚未過期的資訊將重新出現在首頁。',()=>request('/'+b.dataset.restoreReview+'/restore',json('POST',{})),'確認恢復'));
  }catch(e){if(seq===generation&&results.isConnected){results.innerHTML=`<p role="alert">${esc(e.message)}</p><button type="button" class="button secondary" data-review-retry>重新載入</button>`;results.querySelector('button').onclick=load;}}
 }
 function confirm(title,body,task,label){
  if(busy)return;showDialog(title,`<div>${body}</div><form data-review-confirm><p role="alert" data-review-error></p><div class="actions"><button type="button" class="button secondary" data-review-cancel>取消</button><button type="submit" class="button primary">${label}</button></div></form>`);
  const form=modal.querySelector('form');form.querySelector('[data-review-cancel]').onclick=()=>modal.close();
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;setBusy(true);form.querySelectorAll('button').forEach(b=>b.disabled=true);form.setAttribute('aria-busy','true');
   try{const result=await task();modal.close();notify(result.status==='rejected'?'已略過所選建議，公開資訊未變更。':result.status==='restored'?'資訊已恢復；仍在有效期限內才會顯示。':'已核准並套用所選資訊。');await load();}
   catch(error){form.querySelector('[data-review-error]').textContent=error.message+' 若連線中斷，請重新載入確認狀態後再操作。';}
   finally{busy=false;setBusy(false);form.removeAttribute('aria-busy');form.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
 }
 root.querySelectorAll('[data-review-state]').forEach(b=>b.onclick=()=>{if(busy)return;filter=b.dataset.reviewState;root.querySelectorAll('[data-review-state]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));load();});
 root.querySelector('[data-review-file]').onchange=async e=>{const file=e.target.files[0];if(!file||busy)return;const status=root.querySelector('[data-import-status]');busy=true;e.target.disabled=true;try{if(file.size>200000)throw new Error('清單需小於 200 KB。');status.textContent='正在匯入待審清單…';const r=await request('/import',json('POST',JSON.parse(await file.text())));status.textContent=`清單已同步，新增 ${r.count} 筆待審建議。`;await load();}catch(error){status.textContent=error.message;}finally{busy=false;e.target.disabled=false;e.target.value='';}};
 await load();
}
