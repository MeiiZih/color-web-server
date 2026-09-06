// The original report artwork stays unchanged. SVG layers articulate its body parts.
const cast = {
  red: { name:'紅', width:616, height:1198, split:820, face:'#edd1d0', eyes:[[255,583,20,23],[389,582,19,21]] },
  yellow: { name:'黃', width:392, height:598, split:290, face:'#f3fffa', eyes:[[166,134,10,11],[218,134,10,11]] },
  green: { name:'綠', width:854, height:1046, split:626, face:'#9bca73', eyes:[[342,343,54,56],[515,343,54,56]] },
  blue: { name:'藍', width:855, height:1197, split:752, face:'#538cc6', eyes:[[347,538,55,56],[542,537,55,56]] }
};
let serial = 0;
export function character(key) {
  const c = cast[key];
  if (!c) return '';
  const id = `character-${++serial}`;
  const img = `<image href="/assets/characters/${key}.webp" width="${c.width}" height="${c.height}"/>`;
  const arm = 'M250 225 L392 290 L392 410 L325 410 L246 290Z';
  const lids = c.eyes.map(([x,y,rx,ry]) => `<g class="character-blink"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c.face}"/><path d="M${x-rx*.65} ${y}q${rx*.65} ${ry*.35} ${rx*1.3} 0" fill="none" stroke="#172842" stroke-width="${Math.max(3,rx*.13)}" stroke-linecap="round"/></g>`).join('');
  const viewportWidth = c.height * .9;
  return `<span class="report-character articulated character-${key}" role="img" aria-label="${c.name}色報告角色" style="--character-ratio:.9;--character-delay:${-['red','yellow','green','blue'].indexOf(key)*3}s"><svg class="character-art" viewBox="${(c.width-viewportWidth)/2} 0 ${viewportWidth} ${c.height}" aria-hidden="true" focusable="false"><defs><clipPath id="${id}-head"><rect width="${c.width}" height="${c.split}"/></clipPath><clipPath id="${id}-legs"><rect y="${c.split}" width="${c.width}" height="${c.height-c.split}"/></clipPath><clipPath id="${id}-arm"><path d="${arm}"/></clipPath><mask id="${id}-body"><rect width="${c.width}" height="${c.height}" fill="white"/>${key==='yellow'?`<path d="${arm}" fill="black"/>`:''}</mask></defs>${key==='yellow'?`<g mask="url(#${id}-body)">${img}</g><g class="character-arm" style="transform-origin:260px 254px"><g clip-path="url(#${id}-arm)">${img}</g></g>${lids}`:`<g clip-path="url(#${id}-legs)">${img}</g><g class="character-head" style="transform-origin:${c.width/2}px ${c.split}px"><g clip-path="url(#${id}-head)">${img}</g>${lids}</g>`}</svg></span>`;
}
export const characterCast = () => `<div class="survey-characters" aria-label="四色角色陪你探索">${Object.keys(cast).map(character).join('')}</div>`;
// Keep the shared API for the app and wake screen, without a separate pause control.
export const motionToggle = () => '';
export function bindCharacterMotion(root = document) {
  delete document.documentElement.dataset.characterMotion;
  root.querySelectorAll('[data-character-toggle]').forEach(button => button.remove());
}
