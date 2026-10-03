import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const $=id=>document.getElementById(id);
const state={step:0,playing:false,ghost:false,meshes:[],sequence:null,tasks:[],timer:null};
const viewport=$('canvas');
const scene=new THREE.Scene();scene.background=new THREE.Color('#e7ebee');
const camera=new THREE.PerspectiveCamera(38,1,.05,100);camera.up.set(0,0,1);camera.position.set(8,-10,8);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
viewport.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,0,2.4);controls.update();
scene.add(new THREE.HemisphereLight(0xffffff,0x718094,2.4));
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-5,-6,12);scene.add(sun);
const fill=new THREE.DirectionalLight(0xb7c9e1,1.0);fill.position.set(5,8,6);scene.add(fill);
const grid=new THREE.GridHelper(12,24,0xaeb9c4,0xc9d2da);grid.rotation.x=Math.PI/2;grid.position.z=-.06;scene.add(grid);
const mats={
  placed:new THREE.MeshStandardMaterial({color:0xb9bdbd,roughness:.86,metalness:0,side:THREE.DoubleSide,flatShading:true}),
  active:new THREE.MeshStandardMaterial({color:0x294b8d,roughness:.56,metalness:.08,side:THREE.DoubleSide,flatShading:true}),
  metal:new THREE.MeshStandardMaterial({color:0x294b8d,roughness:.4,metalness:.55,side:THREE.DoubleSide,flatShading:true}),
  ghost:new THREE.MeshStandardMaterial({color:0x7189aa,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}),
};
function fit(){camera.position.set(8,-10,8);controls.target.set(0,0,2.3);controls.update()}
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(viewport);
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}animate();
function groupTitle(r){return r.phase.replace(/^\d+\s*·\s*/,'')}
function populateList(){let group='';let box=null;
  for(const task of state.tasks){if(task.phase!==group){group=task.phase;box=document.createElement('div');box.className='taskgroup';
    const heading=document.createElement('div');heading.className='groupname';heading.textContent=group;box.appendChild(heading);$('tasklist').appendChild(box)}
    const button=document.createElement('button');button.className='task';button.dataset.step=task.step;
    const num=document.createElement('span');num.className='tasknum';num.textContent=String(task.step).padStart(2,'0');
    const wrap=document.createElement('span');const id=document.createElement('span');id.className='taskid';id.textContent=task.task_id;
    const mode=document.createElement('div');mode.className='taskmode';mode.textContent=task.robot_trajectory_file?'robot carried':'guided placement';
    wrap.append(id,mode);button.append(num,wrap);button.addEventListener('click',()=>setStep(task.step));box.appendChild(button)
  }
}
function appendLink(root,label,href){const a=document.createElement('a');a.href=href;a.textContent=label;root.appendChild(a)}
function setStep(step){state.step=Math.max(0,Math.min(state.tasks.length,Number(step)||0));$('seek').value=state.step;
  $('stepcount').textContent=`${String(state.step).padStart(2,'0')} / ${state.tasks.length}`;
  const current=state.tasks[state.step-1];$('phaselabel').textContent=current?`${current.phase.toUpperCase()} · STEP ${String(state.step).padStart(2,'0')}`:'ACCEPTED BASE CONDITION · 18 MEMBERS';
  $('mode').textContent=current?current.installation_mode.replaceAll('_',' '):'ACCEPTED PREFIX';
  $('tasktitle').textContent=current?current.task_id.replaceAll('-',' '):'Base condition: 18 members';
  $('mass').firstChild.textContent=current?`${current.mass_high_kg.toFixed(1)} kg`:'—';
  $('members').firstChild.textContent=current?String(current.source_component_ids.length):'18';
  $('status').textContent=current?(current.robot_trajectory_file?
    'Actual loaded robot path passed IK, collision and fine-edge replay in this assembly state. Site screws have nominal geometric paths.':
    current.family==='ROOF_COVER_PANEL'?
    'Guided placement with checked nominal fixing geometry. The roof-panel hand slide cleared source solids in the proposed assembly state.':
    'Guided placement with checked nominal fixing geometry; physical access and connection capacity remain to be qualified.'):
    '18 source members belong to the earlier accepted checkpoint. Advance to inspect each planned remaining site step.';
  const ops=$('operations');ops.replaceChildren();for(const operation of current?.required_operations||[]){const li=document.createElement('li');li.textContent=operation.replaceAll('_',' ').toLowerCase();ops.appendChild(li)}
  $('dependencies').textContent=current?(current.predecessor_task_ids.length?current.predecessor_task_ids.join(' · '):'Accepted lower-frame checkpoint'):'Previously accepted lower-frame checkpoint.';
  const evidence=$('evidence');evidence.replaceChildren();if(current){
    if(current.robot_trajectory_file)appendLink(evidence,'Computed loaded robot route ↗',current.robot_trajectory_file);
    if(current.offsite_joint_geometry_evidence)appendLink(evidence,'Offsite joint geometry ↗',
      current.offsite_joint_geometry_evidence==='section_connections_nominal_cleat_graph'?
      'evidence/section_connections.json':'evidence/'+current.offsite_joint_geometry_evidence+'.json');
    appendLink(evidence,'Site fixing geometry ↗','evidence/'+current.site_fixing_geometry_evidence+'.json');
    if(current.family==='ROOF_COVER_PANEL')appendLink(evidence,'Guided roof delivery clearance ↗','evidence/roof_guided_delivery_path_qa.json');
  }else appendLink(evidence,'Full sequence audit ↗','evidence/full_sequence_gate_audit.json');
  for(const item of state.meshes){const level=item.step;const active=level===state.step&&state.step>0;
    const placed=level===0||level<state.step||(state.step===state.tasks.length&&level===state.step);
    item.mesh.visible=active||placed||state.ghost;
    item.mesh.material=active?mats.active:placed?(item.metal?mats.metal:mats.placed):mats.ghost;
    item.mesh.renderOrder=active?2:placed?1:0;
  }
  for(const button of document.querySelectorAll('.task')){const n=Number(button.dataset.step);button.classList.toggle('active',n===state.step);button.classList.toggle('done',n<state.step)}
  history.replaceState(null,'',`?step=${state.step}`);
  window.__nefarState={loaded:true,step:state.step,total:state.tasks.length,visibleSolids:state.meshes.filter(x=>x.mesh.visible).length};
}
function stop(){state.playing=false;$('play').textContent='Play';if(state.timer)clearInterval(state.timer);state.timer=null}
$('prev').onclick=()=>{stop();setStep(state.step-1)};$('next').onclick=()=>{stop();setStep(state.step+1)};
$('seek').oninput=e=>{stop();setStep(e.target.value)};$('frame').onclick=fit;
$('ghost').onchange=e=>{state.ghost=e.target.checked;setStep(state.step)};
$('play').onclick=()=>{if(state.playing){stop();return}if(state.step>=state.tasks.length)setStep(0);state.playing=true;$('play').textContent='Pause';state.timer=setInterval(()=>{if(state.step>=state.tasks.length){stop();return}setStep(state.step+1)},650)};
window.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){stop();setStep(state.step+1)}if(e.key==='ArrowLeft'){stop();setStep(state.step-1)}});

try{
  const [sequence,geometry]=await Promise.all([fetch('FULL_SEQUENCE.json').then(r=>{if(!r.ok)throw Error('Sequence data unavailable');return r.json()}),fetch('geometry.json').then(r=>{if(!r.ok)throw Error('Geometry unavailable');return r.json()})]);
  state.sequence=sequence;state.tasks=sequence.tasks;const stepByTask=new Map(state.tasks.map(x=>[x.task_id,x.step]));
  for(const row of geometry){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(row.position,3));geo.setIndex(row.index);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,mats.placed);mesh.frustumCulled=false;scene.add(mesh);
    state.meshes.push({mesh,step:stepByTask.get(row.task)||0,metal:row.metal})}
  $('seek').max=state.tasks.length;populateList();setStep(new URLSearchParams(location.search).get('step')||0);resize();fit();
}catch(error){$('phaselabel').textContent='ASSET LOAD ERROR';$('status').textContent=String(error);window.__nefarError=String(error);console.error(error)}
