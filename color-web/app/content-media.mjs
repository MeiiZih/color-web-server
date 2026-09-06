// Reviewed on 2026-09-06 against the linked official page. No runtime scraping.
// Only replace our old generic placeholders; a later admin-supplied image wins.
import { canonicalContentKey, dedicatedIllustrationFor } from './content-illustrations.mjs';
const official = {
  '1980.org.tw/news_show.php?news_id=830': ['https://www.1980.org.tw/userfiles/圖-不必透過打分數找安全感！.png', '臺南張老師中心'],
  '1980.org.tw/news_show.php?news_id=832': ['https://1980.org.tw/userfiles/高雄「張老師」中心：情緒失控前，先讓自己停下來—從親密關係暴力談壓力與情緒管理_圖片檔.jpg', '高雄張老師中心'],
  'mohw.gov.tw/cp-16-85046-1.html': ['https://www.mohw.gov.tw/Public/Images/202601/0582601091021b6459.jpeg', '衛生福利部'],
  'tpa-tw.org/2026submission-registration': ['https://static.wixstatic.com/media/a3371c_212a82079f6c46ebb2d9e708c0eb263d~mv2.jpg', '台灣心理學會（官方消息列表）']
};
const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mediaFor(item) {
  const generic = !item.imageUrl || /\/colorlab-(support|discovery)\.svg$/.test(item.imageUrl);
  const source = generic && official[canonicalContentKey(item.link)];
  const theme = item.contentKind === 'paper' ? ['研究筆記','blue'] : item.contentKind === 'workshop' ? ['自我照顧','yellow'] : /公會|學會/.test(item.sourceName || '') ? ['心理知識','green'] : ['傾聽與支持','red'];
  const generated = /^\/assets\/images\/posts\/[a-z0-9-]+\.webp$/.test(item.imageUrl || '');
  const illustration = generated ? item.imageUrl : dedicatedIllustrationFor(item.link);
  return { imageUrl: source ? source[0] : generic ? '' : item.imageUrl, credit: generated ? 'ColorLab AI 主題示意・非官方海報' : source ? `圖片來源：${source[1]}` : generic ? '' : item.sourceName ? `圖片來源：${item.sourceName}` : '', theme, illustration };
}
export function contentMedia(item, mode = 'card') {
  const { imageUrl, credit, theme, illustration } = item.media;
  const caption = credit || (imageUrl ? '資訊圖片' : illustration ? 'ColorLab AI 主題示意・非官方海報' : '圖片尚未提供');
  const cover = illustration ? `<img class="topic-illustration" src="${escape(illustration)}" alt="" loading="${mode === 'poster' ? 'eager' : 'lazy'}" decoding="async" width="900" height="600"><small class="illustration-label">AI 主題示意</small>` : `<small class="media-unavailable">${imageUrl ? '圖片載入中' : '圖片尚未提供'}</small>`;
  return `<span data-credit="${escape(caption)}" data-has-illustration="${Boolean(illustration)}" class="content-media media-${mode} tone-${theme[1]}${imageUrl ? ' has-source' : ''}"><span class="media-cover">${cover}</span>${imageUrl ? `<img class="source-thumbnail" src="${escape(imageUrl)}" alt="${escape(caption)}" loading="${mode === 'poster' ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer">` : ''}<span class="media-credit">${escape(imageUrl ? '原圖載入中' : caption)}</span></span>`;
}
// Load/error do not bubble. Capture handles cards AND subsequently opened dialogs.
document.addEventListener('load', event => {
  if (!event.target.matches?.('.source-thumbnail')) return;
  const wrapper = event.target.closest('.content-media');
  wrapper.classList.add('image-ready');
  wrapper.querySelector('.media-credit').textContent = wrapper.dataset.credit;
}, true);
document.addEventListener('error', event => {
  if (!event.target.matches?.('.source-thumbnail,.topic-illustration')) return;
  const wrapper = event.target.closest('.content-media');
  if (event.target.matches('.topic-illustration')) {
    wrapper.dataset.hasIllustration = 'false';
    wrapper.querySelector('.media-cover').innerHTML = '<small class="media-unavailable">圖片暫時無法載入，仍可查看原文</small>';
    if (!wrapper.classList.contains('image-ready')) wrapper.querySelector('.media-credit').textContent = '圖片暫時無法載入';
    return;
  }
  wrapper.classList.remove('has-source','image-ready');
  const hasIllustration = wrapper.dataset.hasIllustration === 'true';
  wrapper.querySelector('.media-credit').textContent = hasIllustration ? 'ColorLab AI 主題示意・原圖暫時無法載入' : '圖片暫時無法載入，仍可查看原文';
  if (!hasIllustration) wrapper.querySelector('.media-cover').innerHTML = '<small class="media-unavailable">圖片暫時無法載入，仍可查看原文</small>';
  event.target.remove();
}, true);
