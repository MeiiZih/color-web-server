// Quiz-only greetings. No answer, score, storage or question state is consulted.
const replies = {
  red: '嗨！我在這裡。', yellow: '跳一下，跟你打招呼！',
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

function greet(button) {
  const cast = button.closest('.companion-cast');
  // One greeting per stage; repeated taps don't stack, restart or teleport a pose.
  if (activeCasts.has(cast)) return;
  const key = button.dataset.companion;
  const reply = cast.querySelector('.companion-reply');
  reply.textContent = replies[key];
  // Use the reserved strip above this character; never overlay the question.
  const placeReply = () => {
    const half = reply.offsetWidth / 2;
    reply.style.left = `${Math.max(half, Math.min(cast.clientWidth - half, button.offsetLeft + button.offsetWidth / 2))}px`;
    reply.style.top = `${Math.max(0, button.offsetTop - reply.offsetHeight - 8)}px`;
  };
  placeReply();
  window.addEventListener('resize', placeReply);
  reply.classList.add('is-visible');
  const animations = [];
  let timer;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.removeEventListener('resize', placeReply);
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
    button.addEventListener('click', () => greet(button));
  });
}
