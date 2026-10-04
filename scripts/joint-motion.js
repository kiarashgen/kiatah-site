(() => {
  const input = document.getElementById('ujMotionSlider');
  const image = document.getElementById('ujMotionImage');
  const count = document.getElementById('ujMotionCount');
  const title = document.getElementById('ujMotionTitle');
  if (!input || !image || !count || !title) return;

  const states = [
    {file: 'frame-neutral.png', count: '01 / 03', title: 'Open frame', alt: 'Source-geometry frame before deformation'},
    {file: 'frame-shear.png', count: '02 / 03', title: 'The field shifts', alt: 'The same source-geometry frame skewed with constant member lengths'},
    {file: 'frame-braced.png', count: '03 / 03', title: 'Opposing restraints', alt: 'Deformed frame with diagrammatic compression and tension paths'},
  ];
  states.forEach(({file}) => { const preload = new Image(); preload.src = `/assets/projects/joint/system/${file}`; });
  function show() {
    const state = states[Number(input.value)] || states[0];
    image.src = `/assets/projects/joint/system/${state.file}`;
    image.alt = state.alt;
    count.textContent = state.count;
    title.textContent = state.title;
  }
  input.addEventListener('input', show);
  show();
})();
