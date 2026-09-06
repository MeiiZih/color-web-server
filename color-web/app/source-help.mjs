// Reviewed alternatives, not guessed redirects or declarations that a source is expired.
export function sourceHelp(value) {
  let url;
  try { url = new URL(value); } catch { return ''; }
  if (url.hostname.replace(/^www\./,'') === 'life1995.org.tw') {
    const youth = url.searchParams.get('iid') === '169';
    return `<aside class="source-help"><p>總會網站若暫時無法開啟，可使用以下官方管道。原始公告仍保留，服務時間以官方最新說明為準。</p><a class="button secondary" href="${youth ? 'https://page.line.me/093wgvxu?openQrModal=true' : 'https://www.1995.org.tw/volunteer.php'}" target="_blank" rel="noopener noreferrer">${youth ? '總會官方 LINE 服務窗口' : '新北生命線協談說明'}</a></aside>`;
  }
  if (url.hostname === 'www.nature.com' && url.pathname === '/articles/s41562-026-02415-6') return '<aside class="source-help"><p>期刊頁若停在 Cookie 檢查，可先閱讀同篇研究的 PubMed 摘要。摘要不等於完整論文。</p><a class="button secondary" href="https://pubmed.ncbi.nlm.nih.gov/41772060/" target="_blank" rel="noopener noreferrer">閱讀 PubMed 研究摘要</a></aside>';
  return '';
}
