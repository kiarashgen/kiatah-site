/* Source curve inspection for the Gereh / Dome Studies case. */
(() => {
  const canvas = document.getElementById('dm-canvas');
  const fallback = document.getElementById('dm-viewer-fallback');
  if (!canvas || !fallback) return;
  const context = canvas.getContext('2d');
  const state = { curves: null, azimuth: Math.PI / 5, elevation: 0.57, zoom: 1, dragging: false, x: 0, y: 0 };

  function render() {
    if (!state.curves) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.fillStyle = '#111416';
    context.fillRect(0, 0, width, height);
    const ca = Math.cos(state.azimuth), sa = Math.sin(state.azimuth);
    const ce = Math.cos(state.elevation), se = Math.sin(state.elevation);
    const projected = state.curves.map(curve => curve.map(([x, y, z]) => [
      ca * x + sa * y,
      se * (-sa * x + ca * y) + ce * z,
      ca * y - sa * x,
      z
    ]));
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const curve of projected) for (const point of curve) {
      xmin = Math.min(xmin, point[0]); xmax = Math.max(xmax, point[0]);
      ymin = Math.min(ymin, point[1]); ymax = Math.max(ymax, point[1]);
    }
    const scale = Math.min(width * .84 / Math.max(xmax - xmin, 1), height * .82 / Math.max(ymax - ymin, 1)) * state.zoom;
    const midX = (xmin + xmax) / 2, midY = (ymin + ymax) / 2;
    const ordered = projected.map(curve => ({ curve, depth: curve.reduce((sum, p) => sum + p[2], 0) / curve.length }));
    ordered.sort((a, b) => a.depth - b.depth);
    context.lineWidth = Math.max(.65, dpr * .72);
    context.lineJoin = 'round';
    for (const item of ordered) {
      const curve = item.curve;
      const high = curve.reduce((sum, point) => sum + point[3], 0) / curve.length > 22;
      context.strokeStyle = high ? 'rgba(159,190,225,.72)' : 'rgba(237,232,220,.65)';
      context.beginPath();
      curve.forEach((point, index) => {
        const px = width / 2 + (point[0] - midX) * scale;
        const py = height / 2 - (point[1] - midY) * scale;
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      });
      context.stroke();
    }
  }

  const views = { axon: [Math.PI / 5, .57], plan: [0, Math.PI / 2], front: [0, 0] };
  document.querySelectorAll('[data-dome-view]').forEach(button => button.addEventListener('click', () => {
    [state.azimuth, state.elevation] = views[button.dataset.domeView];
    document.querySelectorAll('[data-dome-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    render();
  }));
  canvas.addEventListener('pointerdown', event => {
    state.dragging = true; state.x = event.clientX; state.y = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!state.dragging) return;
    state.azimuth += (event.clientX - state.x) * .008;
    state.elevation = Math.max(-.2, Math.min(1.55, state.elevation + (event.clientY - state.y) * .006));
    state.x = event.clientX; state.y = event.clientY;
    document.querySelectorAll('[data-dome-view]').forEach(item => item.setAttribute('aria-pressed', 'false'));
    render();
  });
  const stopDrag = () => { state.dragging = false; };
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  canvas.addEventListener('wheel', event => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    state.zoom = Math.max(.7, Math.min(2.6, state.zoom * (event.deltaY > 0 ? .92 : 1.08)));
    render();
  }, { passive: false });
  new ResizeObserver(render).observe(canvas);
  fetch('/assets/projects/domes/models/gereh3d-lines.json')
    .then(response => { if (!response.ok) throw new Error('Source line data unavailable'); return response.json(); })
    .then(data => {
      state.curves = data.curves;
      canvas.hidden = false;
      fallback.hidden = true;
      render();
    })
    .catch(() => { fallback.hidden = false; canvas.hidden = true; });
})();
