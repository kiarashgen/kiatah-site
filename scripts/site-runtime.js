/* Load a project's media and expensive viewers when the reader reaches them. */
(() => {
  const modules = [...document.querySelectorAll('script[data-lazy-module]')];
  const observed = new WeakSet();
  const mediaObserved = new WeakSet();
  function loadMedia(media) {
    if (media.dataset.siteSrc && !media.getAttribute('src')) media.src = media.dataset.siteSrc;
    if (media.dataset.siteSrcset && !media.getAttribute('srcset')) media.srcset = media.dataset.siteSrcset;
    if (media.dataset.sitePoster && !media.getAttribute('poster')) media.poster = media.dataset.sitePoster;
  }
  const mediaObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      loadMedia(entry.target); mediaObserver.unobserve(entry.target);
    }
  }, {rootMargin:'500px'});
  const moduleObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const script of modules.filter(s => s.dataset.lazyTarget === entry.target.dataset.runtimeTarget)) {
        if (script.dataset.loading) continue;
        script.dataset.loading = 'true';
        import(script.dataset.lazyModule).then(() => {script.dataset.loaded = 'true';}).catch(error => {
          delete script.dataset.loading;
          console.error('Project viewer could not load', error);
          const message = entry.target.querySelector('.whv-loading,[data-builder-status]');
          if (message) message.textContent = 'The interactive model could not load. Refresh to try again.';
        });
      }
    }
  }, {rootMargin:'250px'});

  function hydrateActivePage() {
    const page = document.querySelector('main > .page.active');
    if (!page) return;
    for (const media of page.querySelectorAll('img[data-site-src],video[data-site-poster]')) {
      if (mediaObserved.has(media)) continue;
      mediaObserver.observe(media); mediaObserved.add(media);
    }
    const first = page.querySelector('img');
    if (first && first.getBoundingClientRect().top < innerHeight) {
      first.loading = 'eager'; first.fetchPriority = 'high'; loadMedia(first);
    }
    for (const script of modules) {
      for (const target of document.querySelectorAll(script.dataset.lazyTarget)) {
        if (observed.has(target)) continue;
        target.dataset.runtimeTarget = script.dataset.lazyTarget;
        moduleObserver.observe(target); observed.add(target);
      }
    }
  }
  let pending = false;
  function scheduleHydration() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {pending = false; hydrateActivePage();});
  }
  addEventListener('site:route', hydrateActivePage);
  addEventListener('hashchange', scheduleHydration);
  new MutationObserver(scheduleHydration).observe(document.querySelector('main'), {childList:true,subtree:true});
  hydrateActivePage();
})();
