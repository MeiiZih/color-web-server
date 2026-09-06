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

function animate(node, frames, duration = 1900) {
  if (!node) return null;
  return node.animate(frames, { duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'none' });
}

function prepareFlame(button) {
  // Only the flame tip above the face articulates; the face and body stay intact.
  const svg = button.querySelector('svg');
  const head = svg.querySelector('.character-head');
  const originalClip = svg.querySelector('clipPath[id$="-head"]');
  const clip = originalClip.cloneNode(true);
  clip.id += '-flame';
  clip.querySelector('rect').setAttribute('height', '264');
  svg.querySelector('defs').append(clip);
  originalClip.querySelector('rect').setAttribute('y', '244');
  originalClip.querySelector('rect').setAttribute('height', '576');
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.classList.add('companion-flame-tip');
  const clipped = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  clipped.setAttribute('clip-path', `url(#${clip.id})`);
  clipped.append(head.querySelector('image').cloneNode(true));
  group.append(clipped);
  head.prepend(group);
  // An outer wrapper keeps the click burst additive to the ongoing idle timeline.
  const burst = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  burst.classList.add('companion-flame-burst');
  group.before(burst); burst.append(group);
}

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
    animations.push(animate(button.querySelector('.companion-flame-burst'), [
      {transform:'none',offset:0},
      {transform:'scale(1.025,.95) skewX(-2deg)',offset:.12},
      {transform:'scale(.96,1.19) skewX(5deg)',offset:.32},
      {transform:'scale(1.025,1.06) skewX(-4deg)',offset:.49},
      {transform:'scale(.98,1.12) skewX(3deg)',offset:.64},
      {transform:'scale(1.01,.99) skewX(-1deg)',offset:.83},
      {transform:'none',offset:1}
    ]));
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
