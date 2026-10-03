import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const stage = document.getElementById('force-viewport');
const caseButtons = [...document.querySelectorAll('[data-force-case]')];
const caseSelect = document.getElementById('force-case-select');
const caseLabel = document.getElementById('force-case-label');
const info = document.getElementById('force-detail');
const summary = document.getElementById('force-summary');
const reset = document.getElementById('force-reset');
const overlays = document.getElementById('force-boundaries');
const memberSelect = document.getElementById('force-member-select');
const extremes = document.getElementById('force-extremes');
const legendItems = [...document.querySelectorAll('[data-legend-for]')];
const modeButtons = [...document.querySelectorAll('[data-force-mode]')];
const canvasMessage = document.getElementById('force-canvas-message');
const data = await fetch('force-study-data.json').then(response => {
  if (!response.ok) throw Error('The declared force data could not be loaded.');
  return response.json();
}).catch(error => { canvasMessage.textContent = error.message; });

if (data) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x202223);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Rotatable declared frame model. Use the member list beside it to inspect force values with a keyboard.');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 200);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 14;
  controls.maxDistance = 90;
  controls.target.set(15, 2, 4);
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(12, -15, 35);
  scene.add(light, new THREE.AmbientLight(0xffffff, 1.2));
  const model = new THREE.Group();
  const boundaryGroup = new THREE.Group();
  scene.add(model, boundaryGroup);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const cylinder = new THREE.CylinderGeometry(.075, .075, 1, 8);
  let caseIndex = 1;
  let mode = 'force';
  let selectedIndex = -1;
  let memberMeshes = [];
  let pointerDown = null;

  function geometryLabel(record) {
    const label = record.id.startsWith('lower') ? 'Lower rise' : record.id.startsWith('higher') ? 'Higher rise' : 'Retained rise';
    const diameter = Math.round(record.section.diameter_cm * 10);
    const thickness = Math.round(record.section.thickness_cm * 10);
    return `${label} · Ø${diameter}×${thickness}`;
  }
  function formatForce(value) {
    return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)} kN`;
  }
  function endpointMove(record, index) {
    const [a, b] = record.edges[index];
    return Math.max(...[a, b].map(node => Math.hypot(...record.displacements_m[node]) * 1000));
  }
  function vec(coordinates) { return new THREE.Vector3(...coordinates); }
  function member(a, b, color, radius = .075) {
    const mid = a.clone().add(b).multiplyScalar(.5);
    const direction = b.clone().sub(a);
    const mesh = new THREE.Mesh(cylinder, new THREE.MeshStandardMaterial({ color, metalness: .08, roughness: .72 }));
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    mesh.scale.set(radius / .075, direction.length(), radius / .075);
    return mesh;
  }
  function clear(group) {
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      if (child.material) child.material.dispose();
      if (child.geometry !== cylinder && child.geometry) child.geometry.dispose();
    }
  }
  function showMember(index) {
    selectedIndex = index;
    if (memberSelect) memberSelect.value = index < 0 ? '' : String(index);
    memberMeshes.forEach((mesh, i) => {
      mesh.material.emissive.setHex(i === index ? 0xffffff : 0x000000);
      mesh.material.emissiveIntensity = i === index ? .35 : 0;
      const base = mode === 'force' ? .075 : .066;
      mesh.scale.x = mesh.scale.z = i === index ? (base * 1.9) / .075 : base / .075;
    });
    if (index < 0) {
      info.innerHTML = mode === 'force'
        ? '<span class="reg-index">Select a member in the 3D model</span><p>Orbit to read the two truss planes. Select a member to read its signed axial force and source curve.</p>'
        : '<span class="reg-index">Select a member in the 3D model</span><p>Blue shows the frame displaced ×250; grey shows the original. Select a member to read its larger endpoint movement.</p>';
      return;
    }
    const record = data.cases[caseIndex];
    const value = record.axial_force_kN[index];
    const sign = Math.abs(value) <= data.near_zero_threshold_kN ? 'Near zero' : value > 0 ? 'Tension' : 'Compression';
    info.replaceChildren();
    const label = document.createElement('span');
    label.className = 'reg-index';
    label.textContent = `Member ${String(index + 1).padStart(3, '0')} / ${mode === 'force' ? sign : 'endpoint movement'}`;
    const valueNode = document.createElement('strong');
    valueNode.textContent = mode === 'force' ? formatForce(value) : `${endpointMove(record, index).toFixed(2)} mm`;
    const id = document.createElement('small');
    id.textContent = `Source Rhino curve · ${record.source_curve_ids[index]}`;
    info.append(label, valueNode, id);
    if (mode === 'displacement') {
      const force = document.createElement('small');
      force.textContent = `Signed axial force in this member · ${formatForce(value)}`;
      info.append(force);
    }
  }
  function showCase() {
    clear(model);
    clear(boundaryGroup);
    const record = data.cases[caseIndex];
    if (memberSelect) {
      memberSelect.replaceChildren(new Option('Choose a member', ''));
      record.axial_force_kN.forEach((value, index) => {
        const reading = mode === 'force' ? formatForce(value) : `${endpointMove(record, index).toFixed(2)} mm`;
        memberSelect.add(new Option(`${String(index + 1).padStart(3, '0')} · ${reading}`, String(index)));
      });
    }
    const vertices = record.vertices_m.map(vec);
    const displaced = record.vertices_m.map((v, i) => vec(v).add(vec(record.displacements_m[i]).multiplyScalar(250)));
    memberMeshes = [];
    if (mode === 'displacement') {
      record.edges.forEach(([i, j]) => {
        const ghost = member(vertices[i], vertices[j], 0x777b7d, .036);
        ghost.material.transparent = true;
        ghost.material.opacity = .47;
        model.add(ghost);
      });
    }
    record.edges.forEach(([i, j], index) => {
      const value = record.axial_force_kN[index];
      const color = mode === 'displacement' ? 0x80a6d9 : Math.abs(value) <= data.near_zero_threshold_kN ? 0xa5a7a5 : value > 0 ? 0x4a82d6 : 0xc26a65;
      const mesh = member(mode === 'displacement' ? displaced[i] : vertices[i], mode === 'displacement' ? displaced[j] : vertices[j], color, mode === 'displacement' ? .066 : .075);
      mesh.userData.memberIndex = index;
      model.add(mesh);
      memberMeshes.push(mesh);
    });
    record.supports.forEach(support => {
      const point = vertices[support.node];
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 8), new THREE.MeshBasicMaterial({ color: 0xe8dfc7 }));
      marker.position.copy(point);
      boundaryGroup.add(marker);
    });
    record.loads.forEach(load => {
      const point = vertices[load.node];
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), point.clone().add(new THREE.Vector3(0, 0, .9)), .7, 0xe8dfc7, .22, .13);
      boundaryGroup.add(arrow);
    });
    boundaryGroup.visible = overlays.checked;
    caseButtons.forEach(button => {
      const selected = Number(button.dataset.forceCase) === caseIndex;
      button.closest('.sc-force-case')?.classList.toggle('is-selected', selected);
      if (button.closest('.sc-case-chooser')) {
        button.setAttribute('aria-pressed', String(selected));
      } else {
        button.textContent = selected ? 'Viewing in 3D ↗' : 'View in 3D ↗';
      }
      if (selected) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    if (caseSelect) caseSelect.value = String(caseIndex);
    if (caseLabel) caseLabel.textContent = `Case ${String(caseIndex + 1).padStart(2, '0')} · ${geometryLabel(record)}. ${mode === 'force' ? 'Positive is tension; negative is compression. Select a member to read its force and source curve.' : 'Drawn movement is ×250; grey is the undeformed frame. Select a member to read its endpoint movement.'}`;
    const topTension = Math.max(...record.axial_force_kN);
    const topCompression = Math.min(...record.axial_force_kN);
    if (extremes) {
      extremes.replaceChildren();
      const moves = record.edges.map((_, index) => endpointMove(record, index));
      const peakMove = Math.max(...moves);
      const shortcuts = mode === 'force'
        ? [[`Highest tension · ${formatForce(topTension)}`, record.axial_force_kN.indexOf(topTension)], [`Highest compression · ${formatForce(topCompression)}`, record.axial_force_kN.indexOf(topCompression)]]
        : [[`Largest endpoint movement · ${peakMove.toFixed(2)} mm`, moves.indexOf(peakMove)]];
      shortcuts.forEach(([label, index]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.addEventListener('click', () => showMember(index));
        extremes.append(button);
      });
    }
    legendItems.forEach(item => { item.hidden = item.dataset.legendFor !== mode; });
    renderer.domElement.setAttribute('aria-label', mode === 'force'
      ? 'Rotatable declared frame with signed axial force colours. Use the member list beside it to inspect values with a keyboard.'
      : 'Rotatable displaced frame in blue beside its grey original, movement enlarged 250 times. Use the member list to inspect endpoint movement with a keyboard.');
    summary.innerHTML = '';
    const line = document.createElement('p');
    line.textContent = mode === 'force'
      ? `${record.counts.tension} tension · ${record.counts.compression} compression · ${record.counts.near_zero} near zero | max ${formatForce(topTension)} / ${formatForce(topCompression)}`
      : `Maximum calculated displacement ${record.max_displacement_mm.toFixed(2)} mm. Drawn at ×250 to make movement visible; grey is the undeformed geometry.`;
    summary.append(line);
    showMember(-1);
  }
  function resetCamera() {
    if (stage.getBoundingClientRect().width < 500) camera.position.set(38, -43, 22);
    else camera.position.set(31, -21, 17);
    controls.target.set(15, 2, 3.8);
    controls.update();
  }
  caseButtons.forEach(button => button.addEventListener('click', () => {
    caseIndex = Number(button.dataset.forceCase);
    showCase();
  }));
  caseSelect?.addEventListener('change', () => {
    caseIndex = Number(caseSelect.value);
    showCase();
  });
  modeButtons.forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.forceMode;
    modeButtons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    showCase();
  }));
  overlays.addEventListener('change', () => { boundaryGroup.visible = overlays.checked; });
  memberSelect?.addEventListener('change', () => showMember(memberSelect.value === '' ? -1 : Number(memberSelect.value)));
  reset.addEventListener('click', resetCamera);
  renderer.domElement.addEventListener('pointerdown', event => { pointerDown = [event.clientX, event.clientY]; });
  renderer.domElement.addEventListener('pointerup', event => {
    if (!pointerDown || Math.hypot(event.clientX - pointerDown[0], event.clientY - pointerDown[1]) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(memberMeshes, false)[0];
    if (hit) showMember(hit.object.userData.memberIndex);
  });
  const resize = () => {
    const bounds = stage.getBoundingClientRect();
    const width = Math.max(100, bounds.width);
    const height = Math.max(100, bounds.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resetCamera();
  showCase();
  resize();
  canvasMessage.hidden = true;
  function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}
