import { icon } from './ui.mjs';
import { bindPdfReturn } from './navigation-state.mjs';
document.querySelector('.text-button').innerHTML = icon('back') + ' 測驗紀錄';
bindPdfReturn(document.querySelector('.text-button'));
document.querySelector('#download').innerHTML = icon('download') + ' 下載 PDF';
document.querySelector('#share').innerHTML = icon('arrow') + ' 分享／儲存到檔案';
document.querySelector('#original').innerHTML = icon('eye') + ' 開啟原始 PDF';
const status = document.querySelector('#pdf-status');
const path = new URLSearchParams(location.search).get('file');
const valid = /^\/test\/detailed-reports\/[EI][NS][FT][JP]-(?:blue|green|red|yellow)(?:-(?:blue|green|red|yellow))*\.pdf$/;
if (!valid.test(path || '')) {
  status.textContent = '找不到這份文件，請從測驗紀錄重新開啟。';
  document.querySelector('.pdf-toolbar').hidden = true;
} else {
  const filename = 'ColorLab-' + path.split('/').pop();
  document.querySelector('#download').href = path;
  document.querySelector('#download').download = filename;
  document.querySelector('#original').href = path;
  let sharedFile;
  // The same small original file backs rendering, direct download and iOS sharing.
  const loadFile = fetch(path).then(async response => {
    if (!response.ok || !response.headers.get('content-type')?.includes('pdf')) throw new Error('文件讀取失敗');
    const buffer = await response.arrayBuffer();
    sharedFile = new File([buffer], filename, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [sharedFile] })) document.querySelector('#share').hidden = false;
    return new Uint8Array(buffer);
  });
  document.querySelector('#share').addEventListener('click', async () => {
    try { await navigator.share({ files: [sharedFile], title: 'ColorLab 完整報告書' }); }
    catch (error) { if (error.name !== 'AbortError') status.textContent = '此裝置無法分享檔案，請開啟原始 PDF 後儲存。'; }
  });
  try {
    const [pdfjs, data] = await Promise.all([import('/vendor/pdfjs/pdf.mjs'), loadFile]);
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
    const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    status.textContent = `共 ${pdf.numPages} 頁 · 向下滑動閱讀完整內容`;
    const pages = document.querySelector('#pdf-pages');
    let queue = Promise.resolve();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        queue = queue.then(async () => {
          const page = await pdf.getPage(Number(entry.target.dataset.page));
          const initial = page.getViewport({ scale: 1 });
          const scale = Math.min(2, devicePixelRatio || 1) * entry.target.clientWidth / initial.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          canvas.setAttribute('aria-label', `第 ${entry.target.dataset.page} 頁；文字閱讀可開啟原始 PDF`);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          entry.target.replaceChildren(canvas);
          page.cleanup();
        }).catch(() => { entry.target.textContent = '此頁讀取失敗，請重新整理或開啟原始 PDF。'; });
      }
    }, { rootMargin: '400px' });
    for (let i = 1; i <= pdf.numPages; i++) {
      const sheet = document.createElement('section');
      sheet.className = 'pdf-sheet'; sheet.dataset.page = i; sheet.textContent = `第 ${i} 頁`;
      pages.append(sheet); observer.observe(sheet);
    }
  } catch { status.textContent = '預覽未能完成，請重新整理或按「開啟原始 PDF」。'; }
}
