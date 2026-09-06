// Quiz-only greetings. No answer, score, storage or question state is consulted.
const replies = {
  red: '嗨！我在這裡。', yellow: '跟你揮揮手！',
  green: '我在，慢慢說。', blue: '一起鬆一口氣。'
};
const poses = {
  red: ['none', 'translateY(3px) scale(1.025,.98)', 'translate(-2px,-4px) rotate(-5deg)', 'translate(1px,-1px) rotate(2deg)', 'none'],
  yellow: ['none', 'translateY(2px) rotate(3deg)', 'translateY(-4px) rotate(-7deg)', 'translateY(-2px) rotate(3deg)', 'none'],
  green: ['none', 'translateY(2px)', 'translateX(5px) rotate(11deg)', 'translateY(3px) rotate(4deg)', 'none'],
  blue: ['none', 'scale(1.025,.975)', 'translateY(-4px) scale(.97,1.075)', 'translateY(1px) scale(1.03,.985)', 'none']
};
const timings = [0, .12, .4, .75, 1];
const activeCasts = new WeakMap();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const flames = new Set(), flameFor = new WeakMap();
let flameFrame = 0, flameLast = 0;

function animate(node, frames, duration = 1900) {
  if (!node) return null;
  return node.animate(frames, { duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'none' });
}

function prepareFlame(button) {
  // Three moving silhouettes behind the untouched artwork: never over the face.
  for (const stale of flames) if (!stale.button.isConnected) flames.delete(stale);
  const svg = button.querySelector('svg');
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.classList.add('companion-flame-burst');
  const paths = ['#ed7258','#f49a62','#ef5b50'].map(fill => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', fill); group.append(path); return path;
  });
  svg.insertBefore(group, svg.querySelector('g'));
  const flame = {button, paths, time:0, burst:Infinity, mobile:!!button.closest('.companion-mobile')};
  flames.add(flame); flameFor.set(button, flame); drawFlame(flame, 0);
  scheduleFlames();
}

function drawFlame(flame, energy) {
  [[130,505,385,95],[328,370,425,112],[502,465,365,94]].forEach(([x,y,h,w], i) => {
    const phase = flame.time * (1.9 + i*.19) + i*2.2;
    const sway = Math.sin(phase)*30 + Math.sin(phase*.61)*12;
    const height = h*(.94 + .065*Math.sin(phase+.8)) + energy*(90+i*15);
    const tipX = x+sway, tipY = y-height;
    // The tip and two shoulders move at different phases, so the contour curls.
    const curl = Math.sin(phase-1.1)*25;
    flame.paths[i].setAttribute('d', `M${x-w*.55} ${y} C${x-w*.9} ${y-height*.31} ${tipX+curl} ${y-height*.57} ${tipX} ${tipY} C${tipX+25} ${tipY+height*.22} ${x+w*.9+curl} ${y-height*.45} ${x+w*.6} ${y-height*.13} Q${x+w*.3} ${y+15} ${x-w*.55} ${y}Z`);
  });
}

function scheduleFlames() {
  if (!flameFrame && flames.size && !document.hidden && !reduced()) flameFrame = requestAnimationFrame(tickFlames);
}
function tickFlames(now) {
  flameFrame = 0;
  if (document.hidden || reduced()) { flameLast=0; return; }
  const elapsed = flameLast ? now-flameLast : 0;
  if (elapsed && elapsed < 32) { scheduleFlames(); return; }
  flameLast = now;
  const dt = Math.min(elapsed,64)/1000;
  const mobile = matchMedia('(max-width:767px)').matches;
  for (const flame of flames) {
    if (!flame.button.isConnected) { flames.delete(flame); continue; }
    if (flame.mobile !== mobile) continue;
    flame.time += dt; flame.burst += dt;
    const u = Math.min(1,flame.burst/1.9);
    const energy = Number.isFinite(u) ? Math.pow(Math.sin(Math.PI*u),1.4) : 0;
    drawFlame(flame, energy);
  }
  scheduleFlames();
}
document.addEventListener('visibilitychange', () => { flameLast=0; scheduleFlames(); });
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { flameLast=0; scheduleFlames(); });

function prepareYellow(button) {
  // Crop only the outside forearm, not the head/torso wedge used by the old rig.
  // The stationary upper arm remains at the shoulder; the elbow has a filled overlap.
  const svg = button.querySelector('svg');
  const elbow = 'M286 306 H412 V430 H286 Z';
  svg.querySelector('mask path')?.setAttribute('d', elbow);
  svg.querySelector('clipPath[id$="-arm"] path')?.setAttribute('d', elbow);
  const arm = svg.querySelector('.character-arm');
  arm.style.transformOrigin = '311px 306px';
  const joint = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  joint.setAttribute('cx', '311'); joint.setAttribute('cy', '306');
  joint.setAttribute('rx', '18'); joint.setAttribute('ry', '19');
  joint.setAttribute('fill', '#858587');
  svg.insertBefore(joint, arm);
}

function greet(button) {
  const cast = button.closest('.companion-cast');
  // One greeting per stage; repeated taps don't stack, restart or teleport a pose.
  if (activeCasts.has(cast)) return;
  const key = button.dataset.companion;
  const reply = cast.querySelector('.companion-reply');
  reply.textContent = replies[key];
  reply.classList.add('is-visible');
  const animations = [];
  let timer;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    const flame = flameFor.get(button); if (flame) flame.burst=Infinity;
    animations.forEach(a => a?.cancel());
    clearTimeout(timer);
    button.classList.remove('is-greeting');
    cast.classList.remove('has-greeting');
    activeCasts.delete(cast);
    reply.classList.remove('is-visible');
    motion.removeEventListener('change', stop);
  };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  motion.addEventListener('change', stop, { once: true });
  activeCasts.set(cast, stop);
  button.classList.add('is-greeting');
  cast.classList.add('has-greeting');
  if (reduced()) {
    // A visible, spoken greeting is the response when motion is disabled.
    timer = setTimeout(stop, 2400);
    return;
  }
  const figure = button.querySelector('.report-character');
  animations.push(animate(figure, poses[key].map((transform, i) => ({transform, offset:timings[i]}))));
  const head = button.querySelector('.character-head');
  if (head) {
    const tilt = key === 'green' ? 'rotate(9deg) translateY(8px)' : key === 'red' ? 'rotate(-5deg)' : 'scale(1.025,1.035)';
    animations.push(animate(head, [{transform:'none'}, {transform:tilt,offset:.43}, {transform:'none',offset:.88}, {transform:'none'}]));
  }
  if (key === 'red') {
    flameFor.get(button).burst=0;
  }
  if (key === 'yellow') {
    animations.push(animate(button.querySelector('.character-arm'), [
      {transform:'none',offset:0}, {transform:'rotate(8deg)',offset:.12},
      {transform:'rotate(-113deg)',offset:.34}, {transform:'rotate(-74deg)',offset:.44},
      {transform:'rotate(-110deg)',offset:.54}, {transform:'rotate(-74deg)',offset:.64},
      {transform:'rotate(-106deg)',offset:.73}, {transform:'none',offset:1}
    ]));
  }
  const lids = [...button.querySelectorAll('.character-blink')];
  (key === 'red' ? lids.slice(0, 1) : lids).forEach(lid => {
    animations.push(animate(lid, [{opacity:0}, {opacity:1,offset:.32}, {opacity:1,offset:.54}, {opacity:0,offset:.65}, {opacity:0}]));
  });
  Promise.all(animations.filter(Boolean).map(a => a.finished.catch(() => {}))).then(stop);
}

export function bindCompanionInteractions(root = document) {
  root.querySelectorAll('button[data-companion]').forEach(button => {
    if (button.dataset.companionBound) return;
    button.dataset.companionBound = 'true';
    if (button.dataset.companion === 'red') prepareFlame(button);
    if (button.dataset.companion === 'yellow') prepareYellow(button);
    button.addEventListener('click', () => greet(button));
  });
}
