(() => {
  const page = document.querySelector('#eeg.neuro-case');
  if (!page) return;
  const dialog = page.querySelector('.neuro-inspector');
  const image = dialog?.querySelector('img');
  const scroller = dialog?.querySelector('.neuro-inspector-scroll');
  if (!dialog || !image || !scroller) return;
  let scale = 1;
  function size() { image.style.width = (scale * 100) + '%'; }
  page.querySelectorAll('[data-neuro-open]').forEach(button => {
    button.addEventListener('click', () => {
      const source = button.getAttribute('data-neuro-open');
      const original = button.querySelector('img');
      if (!source) return;
      image.src = source;
      image.alt = original?.alt || 'Complete source image';
      scale = window.innerWidth <= 700 ? 2.4 : 1;
      size();
      dialog.showModal();
      scroller.scrollTo(0, 0);
    });
  });
  dialog.querySelector('[data-neuro-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-neuro-fit]').addEventListener('click', () => { scale = 1; size(); scroller.scrollTo(0, 0); });
  dialog.querySelector('[data-neuro-smaller]').addEventListener('click', () => { scale = Math.max(1, scale / 1.4); size(); });
  dialog.querySelector('[data-neuro-larger]').addEventListener('click', () => { scale = Math.min(5, scale * 1.4); size(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
})();
