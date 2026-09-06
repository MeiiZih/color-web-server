import { request } from './client.mjs';
import { esc } from './ui.mjs';

// Explicit administrator action; loading this panel never copies records.
export function bindLegacyImport(root, refresh) {
  const heading = root.querySelector('.history-heading');
  if (!heading || root.querySelector('[data-legacy-import]')) return;
  const panel = document.createElement('section');
  panel.className = 'legacy-import';
  panel.dataset.legacyImport = '';
  panel.innerHTML = '<h2>找回以前的測驗</h2><p>查看同一信箱的舊會員紀錄，選擇要同步到管理員個人空間的結果。</p><ol><li>查看可同步的舊紀錄。</li><li>勾選要同步的測驗，再按確認。</li><li>完成後，依原始日期出現在此處。</li></ol><p>不覆蓋新測驗、不刪除會員原紀錄，重複同步也不會多一份。</p><button class="button secondary" data-preview>查看可同步的紀錄</button><p role="status" aria-live="polite" data-status></p><div data-candidates></div>';
  heading.after(panel);
  const preview = panel.querySelector('[data-preview]');
  const status = panel.querySelector('[data-status]');
  const container = panel.querySelector('[data-candidates]');
  preview.onclick = async () => {
    preview.disabled = true;
    status.textContent = '正在確認同信箱的舊紀錄…';
    container.replaceChildren();
    try {
      const result = await request('/api/explore/records/legacy-import');
      if (!panel.isConnected) return;
      status.textContent = result.pendingCount ? `找到 ${result.total} 份舊紀錄，其中 ${result.pendingCount} 份尚未同步。` : '目前沒有尚未同步的舊紀錄。';
      if (!result.pendingCount) return;
      container.innerHTML = `<form><div class="legacy-options">${result.candidates.map(record => `<label><input type="checkbox" name="record" value="${esc(record.sourceRecordId)}" ${record.alreadyImported ? 'disabled' : 'checked'}><span><strong>${esc(record.title || '舊測驗')}</strong><span>${esc(new Date(record.date).toLocaleDateString('zh-TW'))} · ${esc(record.result || '原始結果')}${record.alreadyImported ? ' · 已同步' : ''}</span></span></label>`).join('')}</div><p>保留當時的答案、結果及日期，不用新版題目重新計分。重複同步不會新增相同紀錄。</p><button class="button primary" type="submit">確認同步所選紀錄</button></form>`;
      const form = container.querySelector('form');
      form.onsubmit = async event => {
        event.preventDefault();
        const sourceRecordIds = [...form.querySelectorAll('input:checked:not(:disabled)')].map(input => input.value);
        if (!sourceRecordIds.length) { status.textContent = '請先選擇至少一份尚未同步的紀錄。'; return; }
        const submit = form.querySelector('button');
        if (submit.disabled) return;
        submit.disabled = true;
        preview.disabled = true;
        status.textContent = '正在同步，請稍候…';
        try {
          const saved = await request('/api/explore/records/legacy-import', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceRecordIds, snapshot: result.snapshot, confirm: true })
          });
          container.replaceChildren();
          status.textContent = `已同步 ${saved.imported} 份紀錄${saved.alreadyImported ? `，另 ${saved.alreadyImported} 份已存在` : ''}。`;
          try { await refresh(); }
          catch { status.textContent += ' 紀錄已保存，但清單更新失敗；請重新整理頁面查看。'; }
        } catch (error) {
          status.textContent = `${error.message} 若資料已變更，請重新查看可同步的紀錄。`;
          submit.disabled = false;
        } finally { preview.disabled = false; }
      };
    } catch (error) { status.textContent = error.message; }
    finally { preview.disabled = false; }
  };
}
