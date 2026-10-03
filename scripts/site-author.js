/* Shared site authoring. Each page keeps its own saved choices and second drawing layer. */
(() => {
  for (const source of document.querySelectorAll('[data-site-authoring-config]')) {
    initPage(JSON.parse(source.textContent));
  }

  function initPage(embedded) {
  const pageId = embedded.page;
  const page = document.getElementById(pageId);
  if (!page) return;
  const pageLabel = page.dataset.siteTitle || pageId.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  const assets = embedded.assets;
  const assetById = new Map(assets.map(item => [item.id, item]));
  const anchors = [...page.querySelectorAll('[id][data-section]'), page];
  const anchorById = new Map(anchors.map(item => [item.id, item]));
  const sketchImages = new Map([...page.querySelectorAll('[data-site-sketch-key]')].map(item => [item.dataset.siteSketchKey, item]));
  const sketchTargets = new Map([...anchorById, ...sketchImages]);
  const texts = new Map([...page.querySelectorAll('[data-site-text]')].map(item => [item.dataset.siteText, item]));
  const images = new Map([...page.querySelectorAll('[data-site-image]')].map(item => [item.dataset.siteImage, item]));
  const originalTexts = new Map([...texts].map(([key, item]) => [key, item.innerText]));
  const originalMarkup = new Map([...texts].map(([key, item]) => [key, item.innerHTML]));
  const originals = new Map([...images].map(([key, item]) => [key, {
    src: item.dataset.siteOriginalSrc || item.getAttribute('src'), asset: item.dataset.asset, width: item.style.width,
    height: item.style.height, fit: item.style.objectFit, position: item.style.objectPosition,
    transform: item.style.transform,
    lightbox: item.closest('button[data-lightbox]')?.dataset.lightbox,
    href: item.closest('a[href]')?.getAttribute('href'),
  }]));
  let state = embedded.state;
  let selected = null;
  let mode = 'select';
  let dirty = false;
  let draft = null;
  let activePointer = null;
  let saveTag = null;
  const undoStack = [];
  const local = false;
  const editing = local && new URLSearchParams(location.search).get('edit') === '1';
  const svgNS = 'http://www.w3.org/2000/svg';

  function cleanState(value) {
    return {version: 2, texts: value?.texts || {}, images: value?.images || {},
      sections: value?.sections || {}, strokes: value?.strokes || []};
  }
  state = cleanState(state);
  const plane = document.createElement('div');
  plane.className = 'site-sketch-plane layer2';
  plane.setAttribute('aria-hidden', 'true');
  page.append(plane);
  const canvases = new Map();
  for (const [key] of sketchTargets) {
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 1000 1000');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('site-sketch-svg');
    plane.append(svg);
    canvases.set(key, svg);
  }

  function placeCanvases() {
    const root = page.getBoundingClientRect();
    for (const [key, anchor] of sketchTargets) {
      const rect = anchor.getBoundingClientRect();
      const svg = canvases.get(key);
      Object.assign(svg.style, {left: `${rect.left - root.left}px`, top: `${rect.top - root.top}px`,
        width: `${rect.width}px`, height: `${rect.height}px`});
    }
  }
  function strokeSegments(stroke) {
    if (!stroke.samples) return [{d: stroke.d, width: stroke.width}];
    const samples = stroke.samples;
    if (samples.length === 1) {
      const [x, y, width] = samples[0];
      return [{d: `M ${x} ${y} L ${x} ${y}`, width}];
    }
    return samples.slice(1).map((sample, index) => {
      const previous = samples[index];
      return {d: `M ${previous[0]} ${previous[1]} L ${sample[0]} ${sample[1]}`,
        width: Math.round((previous[2] + sample[2]) * 50) / 100};
    });
  }
  function segmentNode(stroke, segment) {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', segment.d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', stroke.color);
    path.setAttribute('stroke-width', String(segment.width));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    return path;
  }
  function pathNode(stroke) {
    const group = document.createElementNS(svgNS, 'g');
    for (const segment of strokeSegments(stroke)) group.append(segmentNode(stroke, segment));
    return group;
  }
  function paint() {
    for (const svg of canvases.values()) svg.replaceChildren();
    for (const stroke of state.strokes) canvases.get(stroke.anchor || stroke.section)?.append(pathNode(stroke));
  }
  function apply() {
    for (const [key, node] of texts) {
      if (Object.hasOwn(state.texts, key)) {
        if (node.textContent !== state.texts[key]) node.textContent = state.texts[key];
      } else if (node.innerHTML !== originalMarkup.get(key)) node.innerHTML = originalMarkup.get(key);
    }
    for (const [key, node] of images) {
      const setting = state.images[key] || {};
      const original = originals.get(key);
      const replacement = assetById.get(setting.replacement);
      if (replacement) { node.src = replacement.url; node.removeAttribute('data-asset'); }
      else if (original.asset) { node.dataset.asset = original.asset; if (original.src) node.src = original.src; }
      else if (original.src) node.src = original.src;
      const button = node.closest('button');
      if (button && original.lightbox) {
        if (replacement) { button.removeAttribute('data-lightbox'); button.onclick = () => window.open(replacement.url, '_blank', 'noopener'); }
        else { button.dataset.lightbox = original.lightbox; button.onclick = null; }
      }
      const link = node.closest('a[href]');
      if (link && original.href) link.href = replacement?.url || original.href;
      node.style.width = setting.width ? `${setting.width}%` : original.width;
      node.style.height = setting.height ? `${setting.height}px` : original.height;
      node.style.objectFit = setting.fit || original.fit;
      node.style.objectPosition = (setting.x != null || setting.y != null)
        ? `${setting.x ?? 50}% ${setting.y ?? 50}%` : original.position;
      node.style.transform = (setting.moveX != null || setting.moveY != null)
        ? `translate(${setting.moveX ?? 0}%, ${setting.moveY ?? 0}%)` : original.transform;
    }
    for (const anchor of anchors) {
      const setting = state.sections[anchor.id] || {};
      anchor.style.backgroundColor = setting.background || '';
      anchor.style.setProperty('--site-author-text', setting.text || 'inherit');
      anchor.style.setProperty('--site-author-font', setting.font || 'inherit');
      anchor.classList.toggle('site-color-override', !!setting.text);
      anchor.classList.toggle('site-font-override', !!setting.font);
    }
    paint();
    requestAnimationFrame(placeCanvases);
  }
  apply();
  addEventListener('resize', placeCanvases);
  addEventListener('load', placeCanvases);
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(placeCanvases);
    sketchTargets.forEach(anchor => observer.observe(anchor));
  }
  document.fonts?.ready.then(placeCanvases);
  if (!local) return;

  const launch = document.createElement('a');
  launch.className = 'site-edit-launch';
  launch.href = `/?edit=1#${pageId}`;
  launch.textContent = `Edit ${pageLabel} ↗`;
  document.body.append(launch);
  let panel = null;
  let capture = null;
  const routeVisibility = () => {
    const active = page.classList.contains('active');
    launch.hidden = editing || !active;
    if (panel) panel.hidden = !active;
    if (capture) capture.hidden = !active || mode === 'select';
    if (active) requestAnimationFrame(placeCanvases);
  };
  addEventListener('hashchange', () => setTimeout(routeVisibility, 20));
  setTimeout(routeVisibility, 20);
  fetch(`/__site/authoring/${pageId}`).then(response => {
    if (!response.ok) throw Error('Local edit service unavailable');
    saveTag = response.headers.get('ETag');
    return response.json();
  }).then(saved => {
    if (!dirty) { state = cleanState(saved); apply(); if (panel) renderTools(); }
  }).catch(() => { if (editing) console.warn(`${pageLabel} edits need the local review server to save.`); });
  if (!editing) return;

  panel = document.createElement('aside');
  panel.className = 'site-editor';
  panel.setAttribute('aria-label', `${pageLabel} page editor`);
  panel.innerHTML = `
    <div class="site-editor-top"><div><b>${pageLabel} / edit</b><small>Page choices + your second layer</small></div><div class="site-editor-top-actions"><button type="button" id="site-minimize-${pageId}">Hide tools</button><a href="/#${pageId}">Preview ↗</a></div></div>
    <div class="site-editor-modes"><button type="button" data-mode="select" aria-pressed="true">Select</button><button type="button" data-mode="draw" aria-pressed="false">Draw</button><button type="button" data-mode="erase" aria-pressed="false">Erase</button></div>
    <p class="site-editor-hint">Select text, an image, or a section. Draw across photographs and margins. The pen eraser or Erase mode removes a touched stroke.</p>
    <div class="site-editor-field"><label for="site-section-choice-${pageId}">Section</label><select id="site-section-choice-${pageId}"></select></div>
    <div id="site-editor-tools-${pageId}"></div>
    <div class="site-editor-field"><label for="site-sketch-choice-${pageId}">Drawing attached to</label><select id="site-sketch-choice-${pageId}"></select></div>
    <div class="site-editor-actions"><button type="button" id="site-undo-${pageId}">Undo stroke <span aria-hidden="true">↶</span></button><button type="button" id="site-export-${pageId}">Export drawing SVG</button></div>
    <div class="site-editor-bottom"><button type="button" id="site-save-${pageId}">Save changes</button><span id="site-status-${pageId}" role="status">Ready</span></div>`;
  document.body.append(panel);
  document.body.classList.add('site-editing');
  const $ = selector => panel.querySelector(selector.startsWith('#site-') ? `${selector}-${pageId}` : selector);
  $('#site-minimize').onclick = () => {
    const hidden = panel.classList.toggle('is-minimized');
    $('#site-minimize').textContent = hidden ? 'Show tools' : 'Hide tools';
  };
  const sectionChoice = $('#site-section-choice');
  sectionChoice.innerHTML = anchors.map(item => `<option value="${item.id}">${item.dataset.section || item.dataset.siteRootLabel}</option>`).join('');
  const sketchChoice = $('#site-sketch-choice');
  for (const [key, node] of sketchTargets) {
    const label = node.tagName === 'IMG' ? `Image · ${node.alt || key}` : `Section · ${node.dataset.section || node.dataset.siteRootLabel}`;
    sketchChoice.append(new Option(label, key));
  }
  const toolArea = $('#site-editor-tools');
  const status = $('#site-status');
  const palette = [
    ['Paper', '#f1eee7'], ['Background black', '#0d0d0c'], ['Ink', '#171715'], ['Muted', '#aaa69d'],
    ['Technical blue', '#294b8d'], ['Author red', '#963746'], ['Stone', '#a69b89'],
  ];
  let brushColor = '#f1eee7';
  let brushWidth = 3;
  function changed() { dirty = true; status.textContent = 'Unsaved changes'; }
  function currentSection() { return anchorById.get(sectionChoice.value) || anchors[0]; }
  function setSelected(kind, key) {
    selected = {kind, key};
    const id = kind === 'section' ? key : key.split('.')[0];
    sectionChoice.value = id;
    page.querySelectorAll('[data-site-selected]').forEach(node => node.removeAttribute('data-site-selected'));
    const node = kind === 'text' ? texts.get(key) : kind === 'image' ? images.get(key) : anchorById.get(key);
    node?.setAttribute('data-site-selected', '');
    sketchChoice.value = kind === 'image' ? node?.dataset.siteSketchKey : id;
    renderTools();
  }
  function field(label, control) { return `<div class="site-editor-field"><label>${label}</label>${control}</div>`; }
  function colorControl(id, value) {
    const choices = palette.map(([name, color]) =>
      `<button type="button" class="site-color-swatch" data-color="${color}" style="--swatch:${color}" title="${name}" aria-label="${name}" aria-pressed="${value.toLowerCase() === color}"></button>`).join('');
    return `<div class="site-color-row"><input id="${id}-${pageId}" type="color" value="${value}" aria-label="Custom colour">${choices}</div>`;
  }
  function bindColorControl(id) {
    const input = $('#' + id);
    const row = input.closest('.site-color-row');
    row.querySelectorAll('[data-color]').forEach(button => {
      button.onclick = () => { input.value = button.dataset.color; input.dispatchEvent(new Event('input', {bubbles: true})); };
    });
    input.addEventListener('input', () => row.querySelectorAll('[data-color]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.color === input.value.toLowerCase()))));
  }
  function renderTools() {
    if (mode === 'draw') {
      toolArea.innerHTML = field('Stroke colour', colorControl('site-brush-color', brushColor)) +
        field(`Base line weight / ${brushWidth}px`, `<input id="site-brush-weight-${pageId}" type="range" min="0.5" max="20" step="0.5" value="${brushWidth}">`) +
        '<p class="site-editor-pen-hint">Pen pressure varies the width. Mouse and touch use the base weight.</p>';
      $('#site-brush-color').oninput = event => { brushColor = event.target.value; };
      bindColorControl('site-brush-color');
      $('#site-brush-weight').oninput = event => { brushWidth = Number(event.target.value); renderTools(); };
      return;
    }
    if (mode === 'erase') {
      toolArea.innerHTML = '<p class="site-editor-pen-hint">Touch any line to remove that whole stroke. Ctrl+Z restores it. The back of a supported digital pen also works while Draw is selected.</p>';
      return;
    }
    if (!selected) { toolArea.innerHTML = '<p class="site-editor-empty">Choose something on the page to edit it.</p>'; return; }
    if (selected.kind === 'text') {
      const node = texts.get(selected.key);
      toolArea.innerHTML = field('Text', `<textarea id="site-text-value-${pageId}" rows="7"></textarea>`) +
        `<button class="site-reset" id="site-reset-text-${pageId}" type="button">Use original text</button>`;
      $('#site-text-value').value = state.texts[selected.key] ?? originalTexts.get(selected.key);
      $('#site-text-value').oninput = event => { state.texts[selected.key] = event.target.value; node.textContent = event.target.value; changed(); };
      $('#site-reset-text').onclick = () => { delete state.texts[selected.key]; node.innerHTML = originalMarkup.get(selected.key); renderTools(); changed(); };
      return;
    }
    if (selected.kind === 'image') {
      const setting = state.images[selected.key] || {};
      toolArea.innerHTML = field('Image', `<select id="site-image-choice-${pageId}"><option value="">Original image</option></select>`) +
        field(`Width / ${setting.width || 100}%`, `<input id="site-image-width-${pageId}" type="range" min="40" max="100" value="${setting.width || 100}">`) +
        field('Height in pixels / blank = original', `<input id="site-image-height-${pageId}" type="number" min="100" max="1200" placeholder="Original">`) +
        field('Fit', `<select id="site-image-fit-${pageId}"><option value="">Original</option><option value="contain">Contain</option><option value="cover">Cover</option></select>`) +
        field(`Move left/right / ${setting.moveX ?? 0}%`, `<input id="site-image-move-x-${pageId}" type="range" min="-50" max="50" value="${setting.moveX ?? 0}">`) +
        field(`Move up/down / ${setting.moveY ?? 0}%`, `<input id="site-image-move-y-${pageId}" type="range" min="-50" max="50" value="${setting.moveY ?? 0}">`) +
        field(`Horizontal focus / ${setting.x ?? 50}%`, `<input id="site-image-x-${pageId}" type="range" min="0" max="100" value="${setting.x ?? 50}">`) +
        field(`Vertical focus / ${setting.y ?? 50}%`, `<input id="site-image-y-${pageId}" type="range" min="0" max="100" value="${setting.y ?? 50}">`) +
        `<button class="site-reset" id="site-reset-image-${pageId}" type="button">Use original image settings</button>`;
      const choice = $('#site-image-choice');
      const groups = new Map();
      for (const asset of assets) {
        const groupName = asset.kind || 'Other';
        if (!groups.has(groupName)) {
          const group = document.createElement('optgroup');
          group.label = groupName;
          choice.append(group);
          groups.set(groupName, group);
        }
        groups.get(groupName).append(new Option(asset.label, asset.id));
      }
      choice.value = setting.replacement || '';
      $('#site-image-height').value = setting.height || '';
      $('#site-image-fit').value = setting.fit || '';
      for (const [id, prop, transform] of [
        ['site-image-choice','replacement',value=>value], ['site-image-width','width',Number],
        ['site-image-height','height',value=>value ? Number(value) : null], ['site-image-fit','fit',value=>value],
        ['site-image-move-x','moveX',Number], ['site-image-move-y','moveY',Number],
        ['site-image-x','x',Number], ['site-image-y','y',Number]]) {
        $('#' + id).oninput = event => {
          const next = state.images[selected.key] ||= {};
          const value = transform(event.target.value);
          if (value === '' || value === null) delete next[prop]; else next[prop] = value;
          apply(); changed();
        };
      }
      $('#site-reset-image').onclick = () => { delete state.images[selected.key]; apply(); renderTools(); changed(); };
      return;
    }
    const setting = state.sections[selected.key] || {};
    toolArea.innerHTML = field('Background', colorControl('site-section-bg', setting.background || '#f1eee7')) +
      field('Text colour', colorControl('site-section-text', setting.text || '#171715')) +
      field('Font', `<select id="site-section-font-${pageId}"><option value="">Original</option><option value="Inter, sans-serif">Inter</option><option value="Noto Sans Display, sans-serif">Display</option><option value="IBM Plex Mono, monospace">Mono</option></select>`) +
      `<button class="site-reset" id="site-reset-section-${pageId}" type="button">Use original style</button>`;
    $('#site-section-font').value = setting.font || '';
    for (const [id, prop] of [['site-section-bg','background'], ['site-section-text','text'], ['site-section-font','font']]) {
      $('#' + id).oninput = event => { (state.sections[selected.key] ||= {})[prop] = event.target.value; apply(); changed(); };
    }
    bindColorControl('site-section-bg');
    bindColorControl('site-section-text');
    $('#site-reset-section').onclick = () => { delete state.sections[selected.key]; apply(); renderTools(); changed(); };
  }

  page.addEventListener('click', event => {
    if (mode !== 'select') return;
    const text = event.target.closest('[data-site-text]');
    const image = event.target.closest('[data-site-image]');
    const section = event.target.closest('[id][data-section], [data-site-root-label]');
    if (!section || !page.contains(section)) return;
    if (!image && !text && event.target.closest('a, button, input, select, textarea, model-viewer')) return;
    event.preventDefault();
    event.stopPropagation();
    if (image) setSelected('image', image.dataset.siteImage);
    else if (text) setSelected('text', text.dataset.siteText);
    else setSelected('section', section.id);
  }, true);
  sectionChoice.onchange = () => {
    const anchor = currentSection();
    setSelected('section', anchor.id);
    anchor.scrollIntoView({behavior: 'smooth', block: 'start'});
  };

  capture = document.createElement('div');
  capture.className = 'site-draw-capture';
  capture.hidden = true;
  document.body.append(capture);
  function setMode(next) {
    mode = next;
    capture.hidden = mode === 'select' || !page.classList.contains('active');
    capture.classList.toggle('is-eraser', mode === 'erase');
    panel.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    renderTools();
  }
  panel.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => setMode(button.dataset.mode));
  function point(event, anchor) {
    const rect = anchor.getBoundingClientRect();
    return [Math.round((event.clientX - rect.left) / rect.width * 10000) / 10,
      Math.round((event.clientY - rect.top) / rect.height * 10000) / 10];
  }
  function targetFor(event) {
    const image = [...sketchImages.values()].find(node => {
      const rect = node.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
    if (image) return {key: image.dataset.siteSketchKey, node: image};
    const section = startAnchor(event);
    return section ? {key: section.id, node: section} : null;
  }
  function startAnchor(event) {
    return anchors.find(anchor => {
      const rect = anchor.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
  }
  function isPenEraser(event) {
    return event.pointerType === 'eraser' ||
      (event.pointerType === 'pen' && (event.button === 5 || (event.buttons & 32) !== 0));
  }
  function distanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const fraction = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    return Math.hypot(px - ax - fraction * dx, py - ay - fraction * dy);
  }
  function eraseAt(event) {
    for (let index = state.strokes.length - 1; index >= 0; index--) {
      const stroke = state.strokes[index];
      const anchor = sketchTargets.get(stroke.anchor || stroke.section);
      if (!anchor) continue;
      const rect = anchor.getBoundingClientRect();
      const coordinates = stroke.samples || (stroke.d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
        .reduce((points, value, coordinateIndex, values) => {
          if (coordinateIndex % 2 === 0) points.push([value, values[coordinateIndex + 1], stroke.width]);
          return points;
        }, []);
      const points = coordinates.map(([x, y, width]) => [rect.left + x * rect.width / 1000,
        rect.top + y * rect.height / 1000, width]);
      const hit = points.some((point, pointIndex) => {
        const previous = points[Math.max(0, pointIndex - 1)];
        return distanceToSegment(event.clientX, event.clientY, previous[0], previous[1], point[0], point[1])
          <= 12 + Math.max(previous[2], point[2]) / 2;
      });
      if (!hit) continue;
      state.strokes.splice(index, 1);
      undoStack.push({type: 'remove', stroke, index});
      paint();
      changed();
      break;
    }
  }
  capture.onpointerdown = event => {
    if (document.body.classList.contains('no-layer2')) return;
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if (mode === 'erase' || isPenEraser(event)) {
      event.preventDefault();
      capture.setPointerCapture(event.pointerId);
      activePointer = {id: event.pointerId, action: 'erase'};
      eraseAt(event);
      return;
    }
    if (mode !== 'draw' || event.button !== 0) return;
    const target = targetFor(event);
    if (!target) return;
    event.preventDefault();
    capture.setPointerCapture(event.pointerId);
    const section = startAnchor(event);
    sectionChoice.value = section.id;
    sketchChoice.value = target.key;
    const [x,y] = point(event, target.node);
    const pen = event.pointerType === 'pen';
    const pressure = pen && event.pressure > 0 ? event.pressure : .5;
    const firstWidth = pen ? Math.max(.5, Math.min(30, brushWidth * (.25 + 1.5 * pressure))) : brushWidth;
    const stroke = {section: section.id, anchor: target.key, color: brushColor, width: brushWidth, samples: [[x, y, Math.round(firstWidth * 100) / 100]]};
    state.strokes.push(stroke);
    const group = pathNode(stroke);
    canvases.get(target.key).append(group);
    draft = {pointerId: event.pointerId, anchor: target.key, pen, stroke, group};
    activePointer = {id: event.pointerId, action: 'draw'};
    undoStack.push({type: 'add', stroke});
    changed();
  };
  function appendSample(event) {
    if (!draft || event.pointerId !== draft.pointerId) return false;
    const anchor = sketchTargets.get(draft.anchor);
    const [x, y] = point(event, anchor);
    const samples = draft.stroke.samples;
    const last = samples.at(-1);
    const targetWidth = draft.pen && event.pressure > 0
      ? Math.max(.5, Math.min(30, brushWidth * (.25 + 1.5 * event.pressure)))
      : draft.pen ? last[2] : brushWidth;
    const width = draft.pen ? last[2] * .55 + targetWidth * .45 : targetWidth;
    if (Math.hypot(x - last[0], y - last[1]) < 1.5 && Math.abs(width - last[2]) < .2) return false;
    if (samples.length >= 2500) return false;
    const measured = Math.round(width * 100) / 100;
    samples.push([x, y, measured]);
    if (samples.length === 2) draft.group.replaceChildren();
    draft.group.append(segmentNode(draft.stroke, {d: `M ${last[0]} ${last[1]} L ${x} ${y}`,
      width: Math.round((last[2] + measured) * 50) / 100}));
    return true;
  }
  capture.onpointermove = event => {
    if (activePointer?.id !== event.pointerId) return;
    if (activePointer.action === 'erase') { eraseAt(event); return; }
    if (!draft) return;
    const events = event.getCoalescedEvents?.() || [event];
    for (const sample of events) appendSample(sample);
  };
  capture.onpointerup = event => {
    if (activePointer?.id !== event.pointerId) return;
    if (draft) appendSample(event);
    draft = null;
    activePointer = null;
  };
  capture.onpointercancel = event => {
    if (activePointer?.id === event.pointerId) { draft = null; activePointer = null; }
  };
  function undo() {
    const operation = undoStack.pop();
    if (!operation) return;
    if (operation.type === 'add') {
      const index = state.strokes.indexOf(operation.stroke);
      if (index !== -1) state.strokes.splice(index, 1);
    } else state.strokes.splice(Math.min(operation.index, state.strokes.length), 0, operation.stroke);
    paint();
    changed();
  }
  $('#site-undo').onclick = undo;
  $('#site-export').onclick = () => {
    const targetKey = sketchChoice.value;
    const target = sketchTargets.get(targetKey);
    const selectedStrokes = state.strokes.filter(stroke => (stroke.anchor || stroke.section) === targetKey);
    const xs = [0,1000], ys = [0,1000];
    selectedStrokes.forEach(stroke => {
      if (stroke.samples) {
        for (const [x, y] of stroke.samples) { xs.push(x); ys.push(y); }
      } else {
        const coordinates = (stroke.d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        xs.push(...coordinates.filter((_, index) => index % 2 === 0));
        ys.push(...coordinates.filter((_, index) => index % 2 === 1));
      }
    });
    const x0 = Math.min(...xs)-12, y0 = Math.min(...ys)-12;
    const width = Math.max(...xs)-x0+12, height = Math.max(...ys)-y0+12;
    const paths = selectedStrokes.flatMap(stroke => strokeSegments(stroke).map(segment =>
      `<path d="${segment.d}" fill="none" stroke="${stroke.color}" stroke-width="${segment.width}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`)).join('');
    const source = `<svg xmlns="${svgNS}" viewBox="${x0} ${y0} ${width} ${height}" preserveAspectRatio="none">${paths}</svg>`;
    const url = URL.createObjectURL(new Blob([source], {type: 'image/svg+xml'}));
    const link = document.createElement('a'); link.href = url; link.download = `${pageId}-layer2-${targetKey}.svg`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `Exported ${target?.alt || target?.dataset.section || target?.dataset.siteRootLabel || targetKey} sketch`;
  };
  async function save() {
    status.textContent = 'Saving…';
    try {
      if (!saveTag) throw Error('Saved page is still loading. Try again in a moment.');
      const response = await fetch(`/__site/authoring/${pageId}`, {method: 'POST', headers: {'Content-Type':'application/json', 'If-Match': saveTag}, body: JSON.stringify(state)});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Save failed');
      saveTag = response.headers.get('ETag');
      dirty = false;
      status.textContent = result.sketchAssets ? `Saved · ${result.sketchAssets} SVG sketch ${result.sketchAssets === 1 ? 'asset' : 'assets'}` : 'Saved';
    } catch (error) { status.textContent = `Save failed: ${error.message}`; }
  }
  $('#site-save').onclick = save;
  addEventListener('keydown', event => {
    if (!page.classList.contains('active') || !(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 's') { event.preventDefault(); save(); }
    if (key === 'z' && !event.shiftKey && !event.target.closest('input, textarea, select, [contenteditable]')) {
      event.preventDefault(); undo();
    }
  });
  addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  setSelected('section', anchors[0].id);
  routeVisibility();
  }
})();
