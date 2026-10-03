const ns = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('route-drawing');
const model = document.getElementById('route-model');
const modelNote = document.getElementById('route-model-note');
const readout = document.getElementById('route-readout');
const condition = document.getElementById('route-condition');
const doorIds = ['17468', '19504'];
const labels = {'17468':'Bedroom / corridor', '19504':'Corridor / office'};
const make = (tag, attributes = {}) => {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
};
let route, manifest;
let state = 'open';

const sx = x => 48 + (x + .5) * 5.5;
const sy = y => 73 + (116 - y) * 5.5 + 2.75;
const worldToGrid = (value, axis) => (value - manifest.grid.origin_m[axis]) / manifest.grid.pitch_m;
const point = (worldX, worldY) => [sx(worldToGrid(worldX,0)), sy(worldToGrid(worldY,1))];

function markDoor(id) {
  const door = manifest.doors[id];
  const [x,y] = point(door.center_m[0],door.center_m[1]);
  const closed = state === id;
  const color = closed ? '#a04046' : '#2d4f88';
  const xLabel = Math.min(710,x+23);
  const yLabel = y-18;
  const g = make('g', {'aria-label':`Door #${id}, ${labels[id]}${closed?', closed':''}`});
  g.append(make('circle',{cx:x,cy:y,r:closed?14:9,fill:closed?'#a04046':'#f8f6f1',stroke:color,'stroke-width':closed?3:2}));
  if (closed) {
    g.append(make('path',{d:`M ${x-5} ${y-5} L ${x+5} ${y+5} M ${x+5} ${y-5} L ${x-5} ${y+5}`,fill:'none',stroke:'#fff','stroke-width':2.2,'stroke-linecap':'round'}));
    g.append(make('line',{x1:x+14,y1:y-6,x2:xLabel-5,y2:yLabel+4,stroke:color,'stroke-width':2}));
    const backing = make('rect',{x:xLabel-5,y:yLabel-15,width:170,height:27,fill:'#f8f6f1',stroke:color});
    const text = make('text',{x:xLabel+3,y:yLabel+3,fill:color,'font-size':13,'font-family':'monospace','font-weight':'bold'});
    text.textContent = `#${id} CLOSED`;
    g.append(backing,text);
  } else {
    const number = make('text',{x,y:y+4,'text-anchor':'middle',fill:color,'font-size':11,'font-family':'monospace','font-weight':'bold'});
    number.textContent=id==='17468'?'1':'2';
    g.append(number);
  }
  svg.append(g);
}

function draw() {
  if (!route || !manifest) return;
  svg.replaceChildren();
  svg.append(make('image', {href:'media/v2/ifc-voxel-base.svg',x:0,y:0,width:900,height:700}));
  const first = route.path_grid[0], last = route.path_grid.at(-1);
  if (state === 'open') {
    const points = route.path_grid.map(([x,y]) => `${sx(x)},${sy(y)}`).join(' ');
    svg.append(make('polyline', {points,fill:'none',stroke:'#294b8d','stroke-width':5,'stroke-linejoin':'round','stroke-linecap':'round'}));
    readout.textContent = `${route.distance_m.toFixed(2)} m`;
    condition.textContent = 'Saved open route / 0.10 m pitch / 0.20 m body radius';
    model.src = 'media/ifc-cutaway.glb';
    model.alt = 'Source-derived cutaway with the saved open bedroom-to-office route';
    modelNote.textContent = 'Open state / saved 10.78 m route';
    svg.setAttribute('aria-label','Saved open grid route from bedroom to office; doors 1 and 2 are marked');
  } else {
    readout.textContent = 'Disconnected';
    condition.textContent = `Saved result / ${labels[state].toLowerCase()} door #${state} closed / same pitch and body radius`;
    model.src = `media/v8/${manifest.doors[state].model}`;
    model.alt = `Source-derived cutaway with door #${state} highlighted closed and no route drawn`;
    modelNote.textContent = `Door #${state} closed / source door mesh highlighted / no route found`;
    svg.setAttribute('aria-label',`Bedroom and office grid cells disconnected when door #${state} is closed; door position marked`);
  }
  svg.append(make('circle', {cx:sx(first[0]),cy:sy(first[1]),r:10,fill:'#294b8d',stroke:'#f8f6f1','stroke-width':2}));
  svg.append(make('circle', {cx:sx(last[0]),cy:sy(last[1]),r:10,fill:'#a34e61',stroke:'#f8f6f1','stroke-width':2}));
  doorIds.forEach(markDoor);
}

for (const [id, value] of [['door-open','open'],['door-one','17468'],['door-two','19504']]) {
  document.getElementById(id).addEventListener('click', () => {
    state = value;
    for (const [other, target] of [['door-open','open'],['door-one','17468'],['door-two','19504']]) {
      document.getElementById(other).setAttribute('aria-pressed', String(state === target));
    }
    draw();
  });
}

Promise.all([
  fetch('media/ifc-selected-route.json').then(response => response.json()),
  fetch('media/v8/door-states.json').then(response => response.json())
]).then(([selected,states]) => {route=selected;manifest=states;draw();})
  .catch(error => {readout.textContent = `Route unavailable: ${error.message}`;});
