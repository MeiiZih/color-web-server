// Gesture-only feedback. No media fetch, timers delaying answers, or correctness cues.
export function createQuizFeedback(host = globalThis) {
  let context, active, lastSound = -Infinity, generation = 0;
  const animations = new WeakMap();
  const now = () => host.performance?.now?.() ?? Date.now();
  function stop() {
    generation++;
    if (active) {
      try { active.oscillator.stop(); active.oscillator.disconnect(); active.gain.disconnect(); } catch {}
      active = null;
    }
  }
  function animate(element, kind) {
    if (!element?.animate || host.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    try {
      animations.get(element)?.cancel();
      const motion = element.animate([{transform:'scale(.975)'},{transform:'scale(1.012)',offset:.55},{transform:'scale(1)'}],{duration:kind==='answer'?240:180,easing:'cubic-bezier(.22,1,.36,1)'});
      animations.set(element,motion);
      const check = kind==='answer' && element.querySelector?.('.option-check');
      check?.animate([{transform:'scale(.65)'},{transform:'scale(1.15)',offset:.65},{transform:'scale(1)'}],{duration:260,easing:'cubic-bezier(.22,1,.36,1)'});
    } catch { /* Motion is supplementary; state updates must remain usable. */ }
  }
  function play(kind, event, element) {
    if (!['answer','next','previous'].includes(kind) || !event?.isTrusted || !['change','click','submit'].includes(event.type) || host.navigator?.userActivation?.isActive===false) return false;
    animate(element,kind);
    const started=now();
    if (started-lastSound<160) return false;
    lastSound=started;
    try {
      const Audio=host.AudioContext || host.webkitAudioContext;
      if (!Audio) return false;
      context ||= new Audio();
      stop();
      const token=generation;
      const sound=()=>{
        if(token!==generation || now()-started>250 || context.state!=='running') return;
        try {
          const oscillator=context.createOscillator(), gain=context.createGain(), time=context.currentTime;
          oscillator.type='sine';
          oscillator.frequency.setValueAtTime(520,time);
          oscillator.frequency.exponentialRampToValueAtTime(440,time+.11);
          gain.gain.setValueAtTime(.0001,time);
          gain.gain.exponentialRampToValueAtTime(.025,time+.012);
          gain.gain.exponentialRampToValueAtTime(.0001,time+.13);
          oscillator.connect(gain); gain.connect(context.destination);
          const nodes={oscillator,gain};active=nodes;
          oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();if(active===nodes)active=null;};
          oscillator.start(time);oscillator.stop(time+.14);
        } catch { stop(); }
      };
      if(context.state==='running')sound();
      else Promise.resolve(context.resume()).then(sound).catch(()=>{});
      return true;
    } catch { return false; }
  }
  return {play,stop,dispose(){stop();try{context?.close()?.catch?.(()=>{});}catch{}context=null;}};
}
