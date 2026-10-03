(() => {
  const byId = (id) => document.getElementById(id);
  const getEmbedded = (id, fallback) => {
    try { return JSON.parse(byId(id).textContent); } catch { return fallback; }
  };
  const assetBase = '/assets/projects/pavilion/computation/';

  // This is a browser for retained source material, not a Grasshopper solver.
  let study = 2;
  const showStudy = () => {
    const code = `v${String(study).padStart(2, '0')}`;
    byId('study-image').src = `${assetBase}saved-study-${code}.svg`;
    byId('study-image').alt = `Saved Rhino pavilion design study ${String(study).padStart(2, '0')}`;
    byId('study-count').textContent = `${String(study).padStart(2, '0')} / 14`;
    byId('study-name').textContent = study === 2 ? 'V02 / ORANGE + WHITE SOURCE CONFIGURATION' : `${code.toUpperCase()} / SAVED SOURCE CONFIGURATION`;
  };
  byId('study-prev').addEventListener('click', () => { study = study === 1 ? 14 : study - 1; showStudy(); });
  byId('study-next').addEventListener('click', () => { study = study === 14 ? 1 : study + 1; showStudy(); });
  document.querySelectorAll('[data-graph]').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-graph]').forEach((other) => {
      other.classList.toggle('active', other === tab);
      other.setAttribute('aria-selected', String(other === tab));
    });
    byId('graph-image').src = `${assetBase}graph-${tab.dataset.graph}.svg`;
    byId('graph-image').style.width = ({g03:'3408px',g02:'2300px',g04:'1200px'})[tab.dataset.graph];
    byId('graph-image').alt = `Source-connected Grasshopper nodes and wires for ${tab.dataset.graphTitle}`;
    byId('graph-label').textContent = `${tab.dataset.graphTitle.toUpperCase()} / SOURCE BRANCH`;
    byId('graph-viewport').scrollLeft = 0;
  }));
  document.querySelectorAll('[data-logic-branch]').forEach((link) => link.addEventListener('click', () => {
    document.querySelector(`[data-graph="${link.dataset.logicBranch}"]`)?.click();
  }));
  document.querySelectorAll('[data-base]').forEach((tab) => tab.addEventListener('click', () => {
    const code = tab.dataset.base;
    document.querySelectorAll('[data-base]').forEach((other) => {
      other.classList.toggle('active', other === tab);
      other.setAttribute('aria-selected', String(other === tab));
    });
    const assembled = byId('assembly-built');
    const exploded = byId('assembly-exploded');
    assembled.dataset.image = `assembly-b${code}`;
    exploded.dataset.image = `assembly-x${code}`;
    assembled.dataset.originalSrc = `/assets/projects/pavilion/assembly/assembly-b${code}.svg`;
    exploded.dataset.originalSrc = `/assets/projects/pavilion/assembly/assembly-x${code}.svg`;
    assembled.alt = `R06 B${code} source base shown assembled`;
    exploded.alt = `R06 B${code} source base parts separated for inspection`;
    byId('assembly-built-label').textContent = `B${code} / assembled source geometry`;
    byId('assembly-exploded-label').textContent = `X${code} / source parts separated for inspection`;
    applyImages();
  }));

  const params = new URLSearchParams(location.search);
  const orange = params.get('theme') === 'orange';
  document.body.classList.toggle('theme-orange', orange);
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const availableAssets = getEmbedded('pavilion-assets-data', []);
  const assetMap = Object.fromEntries(availableAssets.map((entry) => [entry.id, entry]));
  let authoring = getEmbedded('pavilion-authoring-data', {version: 1, strokes: [], images: {}, sections: {}});
  let copy = getEmbedded('pavilion-copy-data', {});
  authoring.strokes ||= [];
  authoring.images ||= {};
  authoring.sections ||= {};
  const sections = [...document.querySelectorAll('[data-authorable]')];
  const svgNS = 'http://www.w3.org/2000/svg';

  function applyCopy() {
    document.querySelectorAll('[data-copy]').forEach((el) => {
      const value = copy[el.dataset.copy];
      if (typeof value !== 'string') return;
      if (el.dataset.copy === 'title') {
        const bits = value.split('/');
        el.replaceChildren();
        const left = document.createElement('span'); left.textContent = bits[0]?.trim() || '';
        el.append(left);
        if (bits.length > 1) {
          const slash = document.createElement('span'); slash.className = 'slash'; slash.textContent = '/';
          const right = document.createElement('span'); right.textContent = bits.slice(1).join('/').trim();
          el.append(slash, right);
        }
      } else el.textContent = value;
    });
  }
  function applyImages() {
    document.querySelectorAll('[data-image]').forEach((img) => {
      const setting = authoring.images[img.dataset.image] || {};
      img.dataset.originalSrc ||= img.getAttribute('src');
      img.src = assetMap[setting.replacement]?.site_url || img.dataset.originalSrc;
      img.style.objectPosition = `${setting.x ?? 50}% ${setting.y ?? 50}%`;
      if (setting.height) img.style.height = `${setting.height}px`;
      else img.style.removeProperty('height');
    });
  }
  function applySections() {
    sections.forEach((section) => {
      const style = authoring.sections[section.dataset.authorable] || {};
      section.style.backgroundColor = style.background || '';
      section.style.color = style.text || '';
      section.style.fontFamily = style.font || '';
      if (style.font) section.style.setProperty('--heading-font', style.font);
      else section.style.removeProperty('--heading-font');
    });
  }
  function renderStrokes() {
    sections.forEach((section) => {
      let svg = section.querySelector(':scope > .annotation-svg');
      if (!svg) {
        svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', 'annotation-svg');
        svg.setAttribute('viewBox', '0 0 1000 1000');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true');
        section.append(svg);
      }
      svg.replaceChildren();
      authoring.strokes.filter((stroke) => stroke.section === section.dataset.authorable).forEach((stroke) => {
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', stroke.d);
        path.setAttribute('stroke', stroke.color);
        path.setAttribute('stroke-width', stroke.width);
        svg.append(path);
      });
    });
  }
  function applyAll() { applyCopy(); applyImages(); applySections(); renderStrokes(); }
  applyAll();
  if (!local) return;

  fetch('/__pavilion/edit').then((r) => r.ok ? r.json() : null).then((saved) => {
    if (!saved) return;
    copy = saved.copy;
    authoring = saved.authoring;
    authoring.strokes ||= [];
    authoring.images ||= {};
    authoring.sections ||= {};
    applyAll();
  }).catch(() => {});

  const editLink = document.createElement('a');
  editLink.className = 'editor-open';
  const editing = params.get('edit') === '1';
  editLink.href = location.pathname + (editing ? (orange ? '?theme=orange' : '') : (orange ? '?edit=1&theme=orange' : '?edit=1'));
  editLink.textContent = editing ? 'Preview page' : 'Edit this case';
  document.body.append(editLink);
  const themeLink = document.createElement('a');
  themeLink.className = 'theme-switch';
  themeLink.href = location.pathname + (orange ? (editing ? '?edit=1' : '') : (editing ? '?edit=1&theme=orange' : '?theme=orange'));
  themeLink.textContent = orange ? 'Current palette' : 'Orange page study';
  document.body.append(themeLink);
  if (!editing) return;

  const panel = document.createElement('aside');
  panel.className = 'editor-panel';
  panel.setAttribute('aria-label', 'Pavilion authoring tools');
  panel.innerHTML = `
    <h2>Page studio</h2><p class="editor-help">Draw on the page, then choose text, an image or a section to adjust it. Strokes can extend outside photographs.</p>
    <div class="editor-tools" role="group" aria-label="Editing mode"><button data-mode="select" class="active">Select</button><button data-mode="draw">Draw</button></div>
    <div class="editor-field"><label>Stroke colour <input id="editor-stroke" type="color" value="#b96542"></label><label>Line weight <input id="editor-weight" type="range" min="1" max="12" step="0.5" value="3"></label><output id="editor-weight-value">3 px</output></div>
    <div class="editor-selected" id="editor-selected">Select a text block, image or section.</div>
    <div class="editor-actions"><button id="editor-undo">Undo last stroke</button><button id="editor-save" class="save">Save changes</button></div>
    <p class="editor-status" id="editor-status" aria-live="polite">Your changes appear here immediately. Save to keep them.</p>`;
  document.body.append(panel);
  const capture = document.createElement('div'); capture.className = 'draw-capture'; document.body.append(capture);
  let mode = 'select';
  let currentStroke = null;
  const selectedBox = byId('editor-selected');
  const status = byId('editor-status');
  const setStatus = (message) => { status.textContent = message; };
  const escapeText = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sectionAt = (x, y) => sections.find((section) => {
    const rect = section.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  const pointIn = (section, event) => {
    const rect = section.getBoundingClientRect();
    return [Math.round((event.clientX - rect.left) / rect.width * 1000), Math.round((event.clientY - rect.top) / rect.height * 1000)];
  };
  function setMode(next) {
    mode = next;
    panel.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === next));
    capture.style.pointerEvents = next === 'draw' ? 'auto' : 'none';
    document.body.classList.toggle('is-drawing', next === 'draw');
    setStatus(next === 'draw' ? 'Draw with a mouse, pen or finger. Save when finished.' : 'Click text, an image or a section to edit.');
  }
  panel.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  panel.querySelector('#editor-weight').addEventListener('input', (event) => byId('editor-weight-value').textContent = `${event.target.value} px`);
  capture.addEventListener('pointerdown', (event) => {
    const section = sectionAt(event.clientX, event.clientY);
    if (!section) return;
    capture.setPointerCapture(event.pointerId);
    const [x,y] = pointIn(section,event);
    currentStroke = {section: section.dataset.authorable, color: byId('editor-stroke').value, width: Number(byId('editor-weight').value), points: [[x,y]]};
    authoring.strokes.push({section:currentStroke.section,color:currentStroke.color,width:currentStroke.width,d:`M ${x} ${y}`});
    renderStrokes();
  });
  capture.addEventListener('pointermove', (event) => {
    if (!currentStroke) return;
    const section = sections.find((item) => item.dataset.authorable === currentStroke.section);
    const point = pointIn(section,event);
    const last = currentStroke.points.at(-1);
    if (Math.hypot(point[0]-last[0],point[1]-last[1]) < 2) return;
    currentStroke.points.push(point);
    authoring.strokes.at(-1).d = `M ${currentStroke.points.map(([x,y]) => `${x} ${y}`).join(' L ')}`;
    renderStrokes();
  });
  const endStroke = () => { if (currentStroke) { currentStroke = null; setStatus('Stroke added. Save to keep it.'); } };
  capture.addEventListener('pointerup',endStroke); capture.addEventListener('pointercancel',endStroke);
  byId('editor-undo').addEventListener('click', () => { authoring.strokes.pop(); renderStrokes(); setStatus('Last stroke removed. Save to keep this change.'); });

  function selectText(el) {
    selectedBox.innerHTML = `<strong>Text / ${escapeText(el.dataset.copy)}</strong><textarea id="editor-text" rows="6"></textarea>`;
    const input = byId('editor-text'); input.value = copy[el.dataset.copy] || '';
    input.addEventListener('input', () => { copy[el.dataset.copy] = input.value; applyCopy(); });
  }
  function selectImage(el) {
    const key = el.dataset.image;
    const setting = authoring.images[key] || {};
    const original = assetMap[key];
    const choices = availableAssets.filter((entry) => original?.kind.includes('photograph') ? entry.kind.includes('photograph') : entry.kind === 'source vector');
    const options = choices.map((entry) => `<option value="${escapeText(entry.id)}">${escapeText(entry.id.replaceAll('-', ' '))}</option>`).join('');
    selectedBox.innerHTML = `<strong>Image / ${escapeText(key)}</strong><label>Use asset <select id="editor-replacement">${options}</select></label><label>Horizontal crop <input id="editor-x" type="range" min="0" max="100" value="${setting.x ?? 50}"></label><label>Vertical crop <input id="editor-y" type="range" min="0" max="100" value="${setting.y ?? 50}"></label><label>Image height, px <input id="editor-height" type="number" min="180" max="1100" step="10" placeholder="Layout default" value="${setting.height || ''}"></label><button id="editor-image-reset">Reset image layout</button>`;
    byId('editor-replacement').value = setting.replacement || key;
    const updateImage = (field, value) => {
      const next = authoring.images[key] ||= {};
      if (value === undefined) delete next[field];
      else next[field] = value;
      applyImages();
    };
    byId('editor-replacement').addEventListener('input', (event) => updateImage('replacement', event.target.value === key ? undefined : event.target.value));
    for (const [inputId,field] of [['editor-x','x'],['editor-y','y'],['editor-height','height']]) byId(inputId).addEventListener('input',(event) => updateImage(field, event.target.value === '' ? undefined : Number(event.target.value)));
    byId('editor-image-reset').addEventListener('click', () => { delete authoring.images[key]; applyImages(); selectImage(el); });
  }
  function selectSection(el) {
    const key = el.dataset.authorable;
    const setting = authoring.sections[key] ||= {};
    const rgb = (color, fallback) => /^#[0-9a-f]{6}$/i.test(color || '') ? color : fallback;
    selectedBox.innerHTML = `<strong>Section / ${escapeText(key)}</strong><label>Background <input id="editor-bg" type="color" value="${rgb(setting.background,'#ffffff')}"></label><label>Text colour <input id="editor-fg" type="color" value="${rgb(setting.text,'#171715')}"></label><label>Font <select id="editor-font"><option value="">Page default</option><option value="Inter, sans-serif">Inter</option><option value="Display, sans-serif">Display</option><option value="Plex, monospace">IBM Plex Mono</option></select></label><button id="editor-section-reset">Reset section style</button>`;
    byId('editor-font').value = setting.font || '';
    for (const [inputId,field] of [['editor-bg','background'],['editor-fg','text'],['editor-font','font']]) byId(inputId).addEventListener('input',(event) => { setting[field] = event.target.value; applySections(); });
    byId('editor-section-reset').addEventListener('click', () => { delete authoring.sections[key]; applySections(); selectSection(el); });
  }
  document.addEventListener('click', (event) => {
    if (mode !== 'select' || event.target.closest('.editor-panel,.editor-open,.site-header')) return;
    const text = event.target.closest('[data-copy]');
    const image = event.target.closest('[data-image]');
    const section = event.target.closest('[data-authorable]');
    if (text) selectText(text);
    else if (image) selectImage(image);
    else if (section) selectSection(section);
  });
  byId('editor-save').addEventListener('click', async () => {
    setStatus('Saving…');
    try {
      const response = await fetch('/__pavilion/edit', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({copy,authoring})});
      if (!response.ok) throw new Error((await response.text()).slice(0,180));
      setStatus('Saved to the pavilion source files. This page will open with your changes.');
    } catch (error) { setStatus(`Save failed: ${error.message}`); }
  });
  setMode('select');
})();
