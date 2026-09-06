// Convert approved generated illustrations to small, project-owned web assets.
const sharp = require('sharp');
const path = require('node:path');
const source = 'C:/Users/Yan/.codex/generated_images/019fabbd-b387-7b02-ac3f-2bc0595d2bb5';
const images = { support:'exec-a3f2c8cc-7ef2-4a00-bb74-29c906e9dcfd.png', workshop:'exec-492be5ef-71b5-4800-8e72-53d3b52ca581.png', reading:'exec-cf403141-e36e-4c7b-ae16-d50ad95ada21.png', research:'exec-3f984bd0-f3c6-43b4-b9ed-a88bce368b4a.png' };
Promise.all(Object.entries(images).map(async ([name,file]) => {
  const target = path.join(__dirname,'../color-web/assets/images',`content-${name}.webp`);
  const info = await sharp(path.join(source,file)).resize({width:900,withoutEnlargement:true}).webp({quality:78}).toFile(target);
  console.log(`${name}: ${info.width}x${info.height}, ${info.size} bytes`);
})).catch(error => {console.error(error.message);process.exitCode=1;});
