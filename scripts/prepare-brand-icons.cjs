// Deterministic derivatives: the reviewed SVG is the single source.
const sharp = require('sharp');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'launcher-site/colorlab-mark.svg');
const destination = path.join(root, 'color-web/assets/icons');
(async () => {
  for (const size of [192, 512]) {
    await sharp(source).resize(size, size).png().toFile(path.join(destination, `icon-${size}.png`));
    const inset = Math.round(size * .12);
    const artwork = await sharp(source).resize(size - inset * 2).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: '#fffaf8' } })
      .composite([{ input: artwork, left: inset, top: inset }]).png().toFile(path.join(destination, `maskable-${size}.png`));
  }
  await sharp(source).resize(180, 180).png().toFile(path.join(destination, 'apple-touch-icon.png'));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
