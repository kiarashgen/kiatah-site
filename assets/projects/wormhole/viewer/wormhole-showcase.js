// Wormhole-only interactions adapted from the original fabrication showcase.
// All catalogue records and media URLs come from the copied source catalogue.
const root = document.querySelector('#wormhole .wh-showcase');
if (root) {
  const $ = selector => root.querySelector(selector);
  const $$ = selector => [...root.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const response = await fetch('/assets/projects/wormhole/showcase-data.json');
  if (!response.ok) throw new Error(`Wormhole catalogue ${response.status}`);
  const data = await response.json();
  const assets = new Map(data.assets.map(asset => [asset.id, asset]));
  const models = new Map(data.models.map(model => [model.id, model]));
  const documents = new Map(data.documents.map(doc => [doc.id, doc]));
  const partRoot = $('#wh-interactive');
  let selectedPart = 0;
  let partLimit = 66;
  const photoNotes = {
    'photo-wormhole-cutting-frame': ['01 / CUTTING', 'Cutting the sheet parts from the project’s layouts.'],
    'photo-wormhole-assembly-frame': ['02 / ASSEMBLY', 'Sorting and joining the pieces at the work table.'],
    'photo-wormhole-daylight': ['03 / DISPLAY', 'The assembled surface within its black display frame.'],
  };
  function figure(asset) {
    const visual = asset.kind === 'Drawing' ? asset.files?.artwork_svg : asset.src;
    const note = photoNotes[asset.id];
    return `<figure class="asset-figure asset-${escape(asset.id)} ${asset.kind === 'Drawing' ? 'vector-figure' : 'photo-figure'}"><button type="button" data-asset="${escape(asset.id)}" aria-label="Inspect ${escape(asset.title)}"><div class="image-wrap"><img src="${escape(visual || asset.thumb)}" alt="${escape(asset.title)}" loading="lazy"><span class="inspect-indicator" aria-hidden="true">↗</span></div></button><figcaption>${escape(note?.[0] || `${asset.id} / ${asset.title}`)}</figcaption><p>${escape(note?.[1] || asset.caption)}</p></figure>`;
  }
  $$('[data-drawings]').forEach(element => {
    element.innerHTML = element.dataset.drawings.split(',').map(id => assets.get(id)).filter(Boolean).map(figure).join('');
  });
  $$('.photo-sequence').forEach(element => {
    element.innerHTML = element.dataset.assets.split(',').map(id => assets.get(id)).filter(Boolean).map(figure).join('');
  });

  const nativeTitles = { 'W04-native-flattening': 'W04 / inspect + flatten', 'SRC-0069-native-straight': '0069 / relaxation + mapping', 'SRC-0073-native-straight': '0073 / triangle → part' };
  $$('.native-browser').forEach(element => {
    const ids = ['SRC-0069-native-straight', 'SRC-0073-native-straight', 'W04-native-flattening'];
    element.innerHTML = `<div class="native-tabs" aria-label="Native definition">${ids.map((id, index) => `<button type="button" data-native-id="${id}" ${index === 0 ? 'class="active"' : ''}>${nativeTitles[id]}</button>`).join('')}</div><button type="button" class="native-frame" aria-label="Inspect native Grasshopper canvas"><img alt="Actual native Grasshopper canvas"><span class="inspect-indicator mono">OPEN AT FULL RESOLUTION ↗</span></button><div class="native-stage-list" aria-label="Canvas stage"></div><div class="native-caption"><p></p></div>`;
    const frame = element.querySelector('.native-frame');
    function selectDefinition(id) {
      const source = assets.get(`gh-${id}-native-full`);
      if (!source) return;
      frame.dataset.asset = source.id;
      frame.querySelector('img').src = source.thumb;
      element.querySelector('.native-caption p').textContent = source.caption;
      const stages = data.assets.filter(asset => asset.kind === 'Grasshopper' && asset.id.startsWith(`gh-${id}-native-`));
      element.querySelector('.native-stage-list').innerHTML = stages.map((asset, index) => `<button type="button" data-native-image="${escape(asset.id)}" ${index === 0 ? 'class="active"' : ''}>${index === 0 ? 'Full network' : escape(asset.title.split(' / ').pop())}</button>`).join('');
      element.querySelectorAll('[data-native-id]').forEach(button => button.classList.toggle('active', button.dataset.nativeId === id));
    }
    element.addEventListener('click', event => {
      const tab = event.target.closest('[data-native-id]');
      if (tab) return selectDefinition(tab.dataset.nativeId);
      const stage = event.target.closest('[data-native-image]');
      if (stage) {
        const asset = assets.get(stage.dataset.nativeImage);
        frame.dataset.asset = asset.id;
        frame.querySelector('img').src = asset.thumb;
        element.querySelectorAll('[data-native-image]').forEach(button => button.classList.toggle('active', button === stage));
      }
    });
    selectDefinition(ids[0]);
  });

  function profileSvg(part) {
    const xs = part.points.map(point => point[0]);
    const ys = part.points.map(point => point[1]);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const scale = Math.min(90 / (Math.max(...xs) - Math.min(...xs)), 62 / (Math.max(...ys) - Math.min(...ys)));
    return `<polyline points="${part.points.map(([x, y]) => `${(50 + (x - centerX) * scale).toFixed(2)},${(35 - (y - centerY) * scale).toFixed(2)}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>`;
  }
  function renderParts() {
    const term = $('#part-search').value.trim().toLowerCase();
    const found = data.parts.map((part, index) => ({ part, index })).filter(({ part }) => !term || part.id.toLowerCase().includes(term) || part.uuid.toLowerCase().includes(term));
    const shown = found.slice(0, partLimit);
    $('#part-grid').innerHTML = shown.map(({ part, index }) => `<button type="button" class="part-tile ${index === selectedPart ? 'active' : ''}" data-part="${index}" aria-label="Inspect ${part.id}"><svg viewBox="0 0 100 70" aria-hidden="true">${profileSvg(part)}</svg><span>${part.id}</span></button>`).join('');
    $('#part-result').textContent = `${shown.length} / ${found.length} PARTS`;
    $('#show-all-parts').hidden = shown.length >= found.length;
  }
  function selectPart(index, scroll = false) {
    selectedPart = (index + data.parts.length) % data.parts.length;
    partRoot.dispatchEvent(new CustomEvent('wh-select-part', { detail: selectedPart }));
    $$('.part-tile').forEach(button => button.classList.toggle('active', Number(button.dataset.part) === selectedPart));
    if (scroll) {
      location.hash = '#wormhole/wh-field';
      setTimeout(() => $('#part-id').scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
    }
  }
  partRoot.addEventListener('wh-part-selected', event => {
    selectedPart = event.detail;
    $$('.part-tile').forEach(button => button.classList.toggle('active', Number(button.dataset.part) === selectedPart));
  });
  $('#part-search').addEventListener('input', renderParts);
  $('#show-all-parts').addEventListener('click', () => { partLimit = 442; renderParts(); });
  $('#part-grid').addEventListener('click', event => {
    const tile = event.target.closest('[data-part]');
    if (tile) selectPart(Number(tile.dataset.part), true);
  });
  renderParts();

  const dialog = $('#inspector');
  const media = $('#inspect-media');
  let currentDocument = null;
  let currentAsset = null;
  let page = 0;
  let image = null;
  let scale = 1;
  let pan = { x: 0, y: 0 };
  let drag = null;
  function fitImage() {
    if (!image || !image.naturalWidth || !image.naturalHeight) return;
    scale = Math.min(media.clientWidth / image.naturalWidth, media.clientHeight / image.naturalHeight) * 0.94;
    pan = { x: (media.clientWidth - image.naturalWidth * scale) / 2, y: (media.clientHeight - image.naturalHeight * scale) / 2 };
    paintImage();
  }
  function paintImage() {
    if (!image) return;
    image.style.transform = `translate(${pan.x}px,${pan.y}px) scale(${scale})`;
    $('#zoom-label').textContent = `${Math.round(scale * 100)}%`;
  }
  function showImage(url) {
    media.innerHTML = '';
    image = document.createElement('img');
    image.alt = $('#inspect-title').textContent;
    image.onload = fitImage;
    image.src = url;
    media.append(image);
    $('#image-tools').hidden = false;
    $('#model-tools').hidden = true;
  }
  function showPage(index) {
    if (!currentDocument) return;
    page = Math.max(0, Math.min(currentDocument.pages.length - 1, index));
    showImage(currentDocument.pages[page]);
    $('#doc-position').textContent = `${page + 1} / ${currentDocument.pages.length}`;
    $('#doc-page').value = page + 1;
    $('#doc-page').max = currentDocument.pages.length;
    $('#doc-prev').disabled = page === 0;
    $('#doc-next').disabled = page === currentDocument.pages.length - 1;
  }
  function openInspector(id, localUrl = null, localTitle = null) {
    currentDocument = id?.startsWith('doc-') ? documents.get(id.slice(4)) : null;
    currentAsset = assets.get(id);
    const title = localTitle || currentDocument?.title || currentAsset?.title || 'Source image';
    $('#inspect-kicker').textContent = currentDocument ? 'DOCUMENT / ORIGINAL SHOWCASE' : currentAsset ? `${currentAsset.kind.toUpperCase()} / ${currentAsset.id}` : 'SOURCE RECORD';
    $('#inspect-title').textContent = title;
    $('#inspect-caption').textContent = currentAsset?.caption || (currentDocument ? `Full ${currentDocument.pages.length}-page source document.` : title);
    $('#inspect-source-text').textContent = currentAsset?.sources?.join(', ') || currentAsset?.source_id || 'See the source asset manifest for hash and path.';
    const files = currentDocument ? { pdf: currentDocument.pdf } : currentAsset?.files || {};
    $('#inspect-files').innerHTML = '';
    $('#document-tools').hidden = !currentDocument;
    $('#inspect-neighbours').hidden = Boolean(currentDocument || localUrl);
    $('#inspect-source').hidden = !currentAsset;
    if (currentDocument) showPage(0);
    else if (currentAsset?.kind === 'Model') {
      image = null;
      const model = models.get(currentAsset.id.replace(/^model-/, ''));
      media.innerHTML = model?.glb ? `<model-viewer src="${escape(model.glb)}" camera-controls auto-rotate shadow-intensity="0" exposure="0.75" alt="${escape(title)}" style="display:block;width:100%;height:100%;background:#171715"></model-viewer>` : `<img src="${escape(currentAsset.src)}" alt="${escape(title)}">`;
      $('#image-tools').hidden = true;
      $('#model-tools').hidden = !model?.glb;
    } else if (currentAsset?.kind === 'Video') {
      image = null;
      media.innerHTML = `<video controls playsinline preload="metadata" src="${escape(currentAsset.src)}" style="display:block;width:100%;height:100%;object-fit:contain;background:#0d0d0c"></video>`;
      $('#image-tools').hidden = true;
      $('#model-tools').hidden = true;
    } else showImage(localUrl || (currentAsset?.kind === 'Drawing' ? currentAsset.files?.artwork_svg : null) || currentAsset?.src || '');
    if (!dialog.open) dialog.showModal();
  }
  root.addEventListener('click', event => {
    const local = event.target.closest('[data-wh-local-image]');
    if (local) return openInspector(null, local.dataset.whLocalImage, local.dataset.whTitle);
    const asset = event.target.closest('[data-asset]');
    if (asset) openInspector(asset.dataset.asset);
  });
  $('#inspect-close').addEventListener('click', () => dialog.close());
  $('#doc-prev').addEventListener('click', () => showPage(page - 1));
  $('#doc-next').addEventListener('click', () => showPage(page + 1));
  $('#doc-page').addEventListener('change', event => showPage(Number(event.target.value) - 1));
  $('#zoom-fit').addEventListener('click', fitImage);
  $('#zoom-in').addEventListener('click', () => { scale *= 1.35; paintImage(); });
  $('#zoom-out').addEventListener('click', () => { scale /= 1.35; paintImage(); });
  $('#image-paper').addEventListener('click', () => media.classList.remove('dark'));
  $('#image-dark').addEventListener('click', () => media.classList.add('dark'));
  media.addEventListener('wheel', event => {
    if (!image) return;
    event.preventDefault();
    scale *= event.deltaY < 0 ? 1.14 : 1 / 1.14;
    paintImage();
  }, { passive: false });
  media.addEventListener('pointerdown', event => {
    if (!image) return;
    drag = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
    media.setPointerCapture(event.pointerId);
  });
  media.addEventListener('pointermove', event => {
    if (!drag) return;
    pan = { x: drag.px + event.clientX - drag.x, y: drag.py + event.clientY - drag.y };
    paintImage();
  });
  media.addEventListener('pointerup', () => { drag = null; });
  media.addEventListener('pointercancel', () => { drag = null; });
  function neighbour(direction) {
    if (!currentAsset) return;
    const list = data.assets;
    const index = list.findIndex(asset => asset.id === currentAsset.id);
    if (index >= 0) openInspector(list[(index + direction + list.length) % list.length].id);
  }
  $('#inspect-prev').addEventListener('click', () => neighbour(-1));
  $('#inspect-next').addEventListener('click', () => neighbour(1));
  $('#model-snapshot').hidden = true;
  $$('[data-inspect-view]').forEach(button => button.hidden = true);
  document.addEventListener('keydown', event => {
    if (!dialog.open || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
    if (event.key === 'ArrowRight') currentDocument ? showPage(page + 1) : neighbour(1);
    if (event.key === 'ArrowLeft') currentDocument ? showPage(page - 1) : neighbour(-1);
    if (event.key === '+' || event.key === '=') { scale *= 1.35; paintImage(); }
    if (event.key === '-') { scale /= 1.35; paintImage(); }
    if (event.key === '0') fitImage();
  });
  new ResizeObserver(() => { if (dialog.open && image) fitImage(); }).observe(media);
  window.WH_SHOWCASE_STATUS = { assets: data.assets.length, documents: data.documents.map(doc => doc.pages.length), parts: data.parts.length };
}
