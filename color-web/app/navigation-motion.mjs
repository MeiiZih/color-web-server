// Paint first, then settle once. No timers, awaited exit, DOM cloning, or persistent styles.
export function createNavigationMotion(main) {
  const view=main.ownerDocument.defaultView;
  const reduced=view.matchMedia('(prefers-reduced-motion: reduce)');
  let paintedRoute=null, active=null;
  function cancel() { active?.cancel(); active=null; }
  function commit(route, { restored=false } = {}) {
    const changed=paintedRoute!==null && paintedRoute!==route;
    paintedRoute=route;
    cancel();
    if(!changed || restored || reduced.matches || main.ownerDocument.hidden)return null;
    // A transformed ancestor would relocate the quiz's fixed mobile action bar.
    // Keep quiz controls, characters, and form entirely still; only its top line settles.
    const quiz=String(route).replace(/^#/,'').split('/')[0]==='test';
    const target=quiz ? main.querySelector('.test-topline') : main;
    if(!target?.isConnected || typeof target.animate!=='function')return null;
    const baseline=view.getComputedStyle(target);
    const transform=baseline.transform==='none' ? '' : baseline.transform;
    const opacity=Number(baseline.opacity);
    const animation=target.animate([
      {transform:`translateY(6px) scale(.995) ${transform}`.trim(),opacity:opacity*.94},
      {transform:transform || 'none',opacity}
    ],{duration:190,easing:'cubic-bezier(.22,1,.36,1)',fill:'none'});
    active=animation;
    animation.onfinish=()=>{if(active===animation)active=null;};
    return animation;
  }
  const onPreference=()=>{if(reduced.matches)cancel();};
  const onVisibility=()=>{if(main.ownerDocument.hidden)cancel();};
  reduced.addEventListener('change',onPreference);
  main.ownerDocument.addEventListener('visibilitychange',onVisibility);
  view.addEventListener('pagehide',cancel);
  return {commit,cancel,destroy(){cancel();reduced.removeEventListener('change',onPreference);main.ownerDocument.removeEventListener('visibilitychange',onVisibility);view.removeEventListener('pagehide',cancel);}};
}
