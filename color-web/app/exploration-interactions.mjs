import { resultSummary } from './result-summary.mjs';
import { esc } from './ui.mjs';

const moods = [
  ['有精神', '把這份精神留給今天想做的一件小事。'],
  ['想慢一點', '可以慢慢來，這裡沒有需要趕上的進度。'],
  ['想安靜一下', '留一點不被打擾的時間，也是一種照顧。'],
  ['還說不上來', '不用急著命名，先留意此刻的自己就好。']
];
const moodScenes = [['yellow','lift'],['green','sway'],['blue','float'],['red','ponder']];
function moodScene(index) {
  const [color,motion]=moodScenes[index];
  return `<div class="mood-vignette mood-${motion}" aria-hidden="true"><span class="mood-orbit"></span><span class="mood-ground"></span><img src="/assets/characters/${color}.webp" width="88" height="124" alt="" decoding="async"><i></i><i></i><i></i></div>`;
}
export function reflectionView(kind, record) {
  if(kind==='mood') return `<section class="reflection-panel mood-panel" data-reflection><div class="mood-choice"><span class="eyebrow">A MOMENT TO CHECK IN</span><h2>此刻的你，<br>想用哪一句形容？</h2><div class="reflection-options">${moods.map(([label],index)=>`<button type="button" aria-pressed="false" data-mood="${index}">${label}</button>`).join('')}</div></div><div class="mood-response"><div class="mood-scene"><div class="mood-welcome" aria-hidden="true">${moodScenes.map(([color])=>`<img src="/assets/characters/${color}.webp" width="48" height="72" alt="" decoding="async">`).join('')}</div></div></div></section>`;
  const summary = record && resultSummary(record);
  if (kind === 'resonance' && !summary?.matched.length) return '';
  const options=summary.matched.map(c=>[c.key,c.description]).concat([['none','目前沒有特別共鳴'],['other','其他']]);
  return `<section class="reflection-panel" data-reflection data-record-id="${esc(record.id)}"><span class="eyebrow">IN YOUR OWN WORDS</span><h2>哪一句，讓你想到自己？</h2><div class="reflection-options">${options.map(([key,label])=>`<button type="button" aria-pressed="${record.reflection?.choice===key}" data-choice="${key}" ${key==='other'?`aria-expanded="${record.reflection?.choice==='other'}"`:''}>${esc(label)}</button>`).join('')}</div><form class="reflection-other" ${record.reflection?.choice==='other'?'':'hidden'}><label>你的想法<textarea name="text" required maxlength="500" rows="3" placeholder="寫下你的想法…">${esc(record.reflection?.text||'')}</textarea></label><button class="button secondary" type="submit">送出回覆</button></form></section>`;
}
export function bindExplorationInteractions(root, {saveReflection}={}) {
  const welcome=root.querySelector('.mood-welcome');
  if(welcome&&!welcome.hasAttribute('data-entered')) {
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){welcome.setAttribute('data-entered','');observer.disconnect();}},{threshold:.2});
    observer.observe(welcome);
  }
  root.querySelectorAll('[data-reflection]').forEach(panel => {
    const form=panel.querySelector('.reflection-other');
    async function save(button,text) {
      if(panel.getAttribute('aria-busy')==='true')return;
      panel.querySelector('.reflection-error')?.remove();
      panel.setAttribute('aria-busy','true');panel.querySelectorAll('button,textarea').forEach(el=>el.disabled=true);
      try {
        if(!saveReflection)throw new Error('目前無法儲存回饋，請稍後重試。');
        await saveReflection(panel.dataset.recordId,button.dataset.choice,text);
        panel.querySelectorAll('[data-choice]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
        form.hidden=button.dataset.choice!=='other';
        panel.querySelector('[data-choice="other"]').setAttribute('aria-expanded',String(!form.hidden));
      } catch(error) {
        const message=document.createElement('p');message.className='reflection-error';message.setAttribute('role','alert');message.textContent=error.message||'回饋未儲存，請再試一次。';panel.append(message);
      } finally {panel.removeAttribute('aria-busy');panel.querySelectorAll('button,textarea').forEach(el=>el.disabled=false);}
    }
    form?.addEventListener('submit',event=>{
      event.preventDefault();const input=form.elements.text;
      input.setCustomValidity(input.value.trim()?'':'請先填寫你的想法。');
      if(form.reportValidity())save(panel.querySelector('[data-choice="other"]'),input.value.trim());
    });
    form?.elements.text.addEventListener('input',()=>form.elements.text.setCustomValidity(''));
    panel.querySelectorAll('[data-choice],[data-mood]').forEach(button => button.addEventListener('click', async event => {
      button.toggleAttribute('data-pointer-focus',event.detail>0);
      if(button.hasAttribute('data-choice')) {
        if(panel.getAttribute('aria-busy')==='true')return;
        if(button.dataset.choice==='other'){form.hidden=false;button.setAttribute('aria-expanded','true');form.elements.text.focus();return;}
        await save(button);
        return;
      }
      panel.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
      if(button.hasAttribute('data-mood')) panel.querySelector('.mood-scene').innerHTML=moodScene(Number(button.dataset.mood));
    }));
  });
}
