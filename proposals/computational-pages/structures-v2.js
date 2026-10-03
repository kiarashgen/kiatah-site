const bridge = document.getElementById('bridge-model');
const bridgeLabel = document.getElementById('bridge-model-label');
document.querySelectorAll('[data-bridge-model]').forEach(button => button.addEventListener('click', () => {
  const displaced = button.dataset.bridgeModel === 'displacement';
  bridge.src = displaced ? 'media/v2/bridge-displacement-model.glb' : 'media/v2/bridge-force-sign-model.glb';
  bridge.alt = displaced ? 'Rotatable 3D displaced shape of the separate later truss' : 'Rotatable 3D signed member-force model of the separate later truss';
  bridgeLabel.textContent = displaced ? 'Displaced form / movement enlarged for visual reading; see data for scale and boundary conditions' : 'Axial force / blue: positive tension · red-brown: negative compression · neutral: near zero';
  document.getElementById('force-legend').hidden = displaced;
  document.querySelectorAll('[data-bridge-model]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
}));
document.querySelectorAll('[data-tower]').forEach(button => button.addEventListener('click', () => {
  const index = Number(button.dataset.tower);
  const image = document.getElementById('tower-large');
  image.src = `media/v2/tower-state-${index}.png`;
  image.alt = `Selected retained tower state ${String(index + 1).padStart(2, '0')}`;
  document.querySelectorAll('[data-tower]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
}));
