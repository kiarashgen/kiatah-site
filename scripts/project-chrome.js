/* Shared chapter state for the four standalone computational cases. */
(() => {
  const nav = document.querySelector('.portfolio-context');
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const sections = links.map(link => ({link, target: document.getElementById(link.hash.slice(1))}));
  let pending = false;
  function update() {
    pending = false;
    const readingLine = nav.getBoundingClientRect().bottom + 68;
    let active = sections[0];
    for (const section of sections) {
      if (section.target && section.target.getBoundingClientRect().top <= readingLine) active = section;
    }
    for (const section of sections) {
      if (section === active) section.link.setAttribute('aria-current', 'location');
      else section.link.removeAttribute('aria-current');
    }
  }
  function requestUpdate() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }
  window.addEventListener('scroll', requestUpdate, {passive: true});
  window.addEventListener('resize', requestUpdate);
  window.addEventListener('hashchange', requestUpdate);
  requestUpdate();
})();
