export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const shapes = {
  home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  test: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/>',
  history: '<path d="M4 7a9 9 0 1 1-1 9M3 3v5h5M12 7v5l3 2"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>', arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', edit: '<path d="m4 16 12-12 4 4L8 20H4ZM13 7l4 4"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>'
};
export const icon = key => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[key] || shapes.arrow}</svg>`;
export const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '尚無紀錄';
export const button = (text, attrs = '', kind = 'secondary', symbol = '') => `<button type="button" class="button ${kind}" ${attrs}>${symbol ? icon(symbol) : ''}<span>${text}</span></button>`;
export const link = (href, text, kind = 'secondary', symbol = '') => `<a class="button ${kind}" href="${esc(href)}">${symbol ? icon(symbol) : ''}<span>${esc(text)}</span></a>`;
export const field = (name, label, value = '', options = '') => `<label class="field"><span>${esc(label)}</span><input name="${esc(name)}" value="${esc(value)}" ${options}></label>`;
export const area = (name, label, value = '', required = '') => `<label class="field"><span>${esc(label)}</span><textarea name="${esc(name)}" rows="4" ${required}>${esc(value)}</textarea></label>`;
export const select = (name, label, options, value = '') => `<label class="field"><span>${esc(label)}</span><select name="${esc(name)}">${options.map(([v, text]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
export function table(headers, rows) {
  return rows.length ? `<div class="data-list"><table><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td data-label="${esc(headers[i])}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="quiet-empty"><h2>目前沒有資料</h2><p>新增內容或調整搜尋條件後，資料會出現在這裡。</p></div>';
}
