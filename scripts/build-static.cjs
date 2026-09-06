const fs = require('node:fs/promises');
const path = require('node:path');
const { frontendTarget } = require('../Server/services/frontendRoutes');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'static-dist');
const backend = process.env.COLORLAB_API_ORIGIN || 'https://color-web-server-jprj.onrender.com';
if (!/^https:\/\/[a-z\d.-]+(?::\d+)?$/i.test(backend)) throw new Error('COLORLAB_API_ORIGIN must be an HTTPS origin');
const inject = `<script>window.COLORLAB_STATIC=true;window.COLORLAB_API_ORIGIN=${JSON.stringify(backend)};</script><script src="/js/static-connection.js"></script>`;

async function main() {
  await fs.mkdir(output, { recursive: true });
  await fs.cp(path.join(root, 'color-web'), output, { recursive: true });
  await fs.cp(path.join(root, 'launcher-site/colorlab-mark.svg'), path.join(output, 'colorlab-mark.svg'));
  await fs.cp(path.join(root, 'Server/node_modules/pdfjs-dist/legacy/build'), path.join(output, 'vendor/pdfjs'), { recursive: true });
  const html = await fs.readFile(path.join(root, 'color-web/app/index.html'), 'utf8');
  await fs.writeFile(path.join(output, 'index.html'), html);
  async function injectHtml(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await injectHtml(file);
      else if (entry.name.endsWith('.html') && file !== path.join(output, 'app/pdf.html')) {
        let source = await fs.readFile(file, 'utf8');
        const relative = path.relative(output, file).split(path.sep).join('/');
        if (relative !== 'index.html' && frontendTarget('/' + relative)) {
          const target = frontendTarget('/' + relative);
          source = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ColorLab</title><style>body{margin:0;background:#fcf8f4;color:#393435;font:16px system-ui;padding:32px}</style><script data-legacy-redirect>location.replace((${frontendTarget.toString()})(location.pathname,location.search));</script></head><body><p>正在開啟 ColorLab…</p><noscript><a href="${target}">ColorLab 新版網站</a></noscript></body></html>`;
          await fs.writeFile(file, source);
          continue;
        }
        await fs.writeFile(file, source.replace(/<head([^>]*)>/i, `<head$1>${inject}`));
      }
    }
  }
  await injectHtml(output);
  // Wake UI cannot gate itself through static-connection.js.
  let wake = await fs.readFile(path.join(root, 'launcher-site/index.html'), 'utf8');
  wake = wake.replace("const SERVER_ORIGIN = 'https://color-web-server-jprj.onrender.com';", `const SERVER_ORIGIN = ${JSON.stringify(backend)};`)
    .replace('const destination = `${SERVER_ORIGIN}${safePath}`;', 'const destination = new URL(safePath, location.origin).href;');
  await fs.writeFile(path.join(output, 'wake.html'), wake);
  const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.webmanifest'), 'utf8'));
  manifest.start_url = '/app/';
  manifest.shortcuts = [{ name: '全部測驗', url: '/app/#surveys' }, { name: '測驗紀錄', url: '/app/#history' }];
  await fs.writeFile(path.join(output, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
  await fs.copyFile(path.join(root, 'scripts/static-service-worker.js'), path.join(output, 'service-worker.js'));
  console.log(`Static frontend built: ${output}\nBackend: ${backend}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
