(() => {
  const base = '/assets/projects/residence-hell/technical/';
  let timer = null;
  const parts = () => ({
    frame: document.getElementById('rh2-frame'),
    range: document.getElementById('rh2-range'),
    count: document.getElementById('rh2-frame-count'),
    play: document.getElementById('rh2-play'),
  });
  const show = value => {
    const { frame, range, count } = parts();
    if (!frame || !range || !count) return;
    const n = Math.max(0, Math.min(112, Number(value)));
    range.value = String(n);
    frame.src = `${base}frames/frame-${String(n).padStart(3, '0')}.svg`;
    frame.alt = `Recorded C01 placement state ${n + 1} of 113`;
    count.textContent = `${String(n + 1).padStart(3, '0')} / 113`;
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    const { play } = parts();
    if (play) {
      play.textContent = 'Play';
      play.setAttribute('aria-pressed', 'false');
    }
  };
  document.addEventListener('click', event => {
    const id = event.target?.closest?.('button')?.id;
    const { range, play } = parts();
    if (!range) return;
    if (id === 'rh2-prev') { stop(); show(Number(range.value) - 1); }
    if (id === 'rh2-next') { stop(); show(Number(range.value) + 1); }
    if (id === 'rh2-play') {
      if (timer) { stop(); return; }
      if (Number(range.value) === 112) show(0);
      timer = setInterval(() => show((Number(parts().range?.value || 0) + 1) % 113), 320);
      play.textContent = 'Pause';
      play.setAttribute('aria-pressed', 'true');
    }
  });
  document.addEventListener('input', event => {
    if (event.target?.id === 'rh2-range') { stop(); show(event.target.value); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
})();
