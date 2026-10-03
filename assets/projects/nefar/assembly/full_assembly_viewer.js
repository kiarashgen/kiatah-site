import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {toCreasedNormals} from './vendor/BufferGeometryUtils.js';
const [data,playback,sequence,geometry]=await Promise.all(['CELL_MODEL.json','FULL_PLAYBACK.json','FULL_SEQUENCE.json','geometry.json'].map(async p=>{const r=await fetch(p);if(!r.ok)throw Error(p+' HTTP '+r.status);return r.json()}));
if(new URLSearchParams(location.search).has('capture'))document.body.classList.add('capture');
const div=document.querySelector('#view'),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#F1EEE7');renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;div.appendChild(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.02,150);camera.up.set(0,0,1);const controls=new OrbitControls(camera,renderer.domElement);scene.add(new THREE.HemisphereLight(0xffffff,0xAAA69D,2.1));const light=new THREE.DirectionalLight(0xffffff,2.7);light.position.set(-1,-4,9);scene.add(light);const fill=new THREE.DirectionalLight(0xffffff,1.2);fill.position.set(4,6,5);scene.add(fill);
const colors={steel:'#5C5750',dark:'#171715',silver:'#AAA69D',timber:'#CBC5BB',post:'#294B8D',white:'#E7E2D8',blue:'#294B8D'};
const mat=(c,metal=.25)=>new THREE.MeshStandardMaterial({color:c,roughness:.6,metalness:metal});
function geo(v){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v.vertices,3));g.setIndex(v.faces);g.computeVertexNormals();return g}
function from(t){return new THREE.Matrix4().set(...t.flat())}
function transform(o,t){o.matrix.copy(t instanceof THREE.Matrix4?t:from(t));o.matrixAutoUpdate=false}
light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-8,right:8,top:7,bottom:-7,near:.1,far:25});light.shadow.bias=-.00015;light.shadow.normalBias=.004;
function mesh(g,c,parent=scene,flat=false){const m=new THREE.Mesh(g,mat(c));m.material.flatShading=flat;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function box(parent,d,p,c=colors.steel){const m=mesh(new THREE.BoxGeometry(...d),c,parent);m.position.set(...p);return m}
function cyl(parent,r,h,p,c=colors.silver,axis='z',sides=16){const m=mesh(new THREE.CylinderGeometry(r,r,h,sides),c,parent);if(axis==='z')m.rotation.x=Math.PI/2;if(axis==='x')m.rotation.z=Math.PI/2;m.position.set(...p);return m}
function bolt(parent,p,axis='z',r=.012){cyl(parent,r,.012,p,colors.silver,axis,6)}
function hollow(parent,d,p,c=colors.steel){const [x,y,z]=d,t=Math.min(x,y)*.15;box(parent,[t,y,z],[p[0]-(x-t)/2,p[1],p[2]],c);box(parent,[t,y,z],[p[0]+(x-t)/2,p[1],p[2]],c);box(parent,[x-2*t,t,z],[p[0],p[1]-(y-t)/2,p[2]],c);box(parent,[x-2*t,t,z],[p[0],p[1]+(y-t)/2,p[2]],c)}
const hardware={},boundsReport=[],proxy=new THREE.Group();scene.add(proxy);proxy.visible=false;
function envelope(name,d,build){const g=new THREE.Group();build(g,d);g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g);const e=1e-6;const ok=['x','y','z'].every((a,i)=>b.min[a]>=-d[i]/2-e&&b.max[a]<=d[i]/2+e);boundsReport.push({name,dimensions:d,display_min:b.min.toArray(),display_max:b.max.toArray(),contained:ok});if(!ok)throw Error(`Display part outside tested envelope: ${name} dims=${d} min=${b.min.toArray()} max=${b.max.toArray()}`);scene.add(g);hardware[name]=g;const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...d)),new THREE.LineBasicMaterial({color:'#294B8D',transparent:true,opacity:.65}));proxy.add(outline);g.userData.outline=outline;return g}
function rail(g,d){box(g,[d[0],d[1]*.88,.14],[0,0,-.015]);for(const y of [-.145,.145])box(g,[d[0],.038,.025],[0,y,.085],colors.silver);for(let x=-d[0]/2+.08;x<d[0]/2;x+=.45){bolt(g,[x,-.14,.094], 'z',.009);bolt(g,[x,.14,.094], 'z',.009)}for(let x=-d[0]/2+.03;x<d[0]/2-.025;x+=.07)box(g,[.03,.025,.035],[x,-.18,.04],colors.dark);for(let x=-d[0]/2+.35;x<d[0]/2-.15;x+=1.2){box(g,[.28,d[1]*.95,.025],[x,0,-.087]);bolt(g,[x-.1,.17,-.068], 'z',.012);bolt(g,[x+.1,-.17,-.068],'z',.012)}}
function rack(g,d){for(const x of [-1.45,0,1.45])for(const y of [-.35,.35])hollow(g,[.07,.07,.70],[x,y,-.035],colors.dark);for(const y of [-.35,.35])box(g,[3.5,.075,.075],[0,y,.335],colors.dark);for(const x of [-1.50,0,1.50])box(g,[.075,.80,.075],[x,0,.335],colors.dark);for(const y of [-.35,.35])box(g,[3.5,.045,.045],[0,y,-.22],colors.dark);box(g,[3.5,.82,.025],[0,0,.395],colors.silver)}
function tower(g,d){for(const x of [-.115,.115])hollow(g,[.10,.12,3.94],[x,-.035,0]);for(const x of [-.115,.115])box(g,[.03,.032,3.92],[x,.14,0],colors.silver);for(const z of [-1.93,1.93]){box(g,[.34,.34,.09],[0,0,z]);for(const x of [-.12,.12])bolt(g,[x,.12,z+.047],'z',.012)}for(let z=-1.93;z<1.93;z+=.07)box(g,[.036,.038,.028],[0,.13,z],colors.dark);for(let z=-1.82;z<1.86;z+=.15){box(g,[.09,.055,.06],[-.006,-.135,z],colors.dark);box(g,[.077,.012,.03],[-.006,-.164,z],colors.silver)}}
function platform(g,d){box(g,[d[0]*.95,d[1]*.95,.045],[0,0,d[2]/2-.026]);for(const y of [-d[1]*.36,d[1]*.36])box(g,[d[0]*.86,.055,d[2]*.60],[0,y,-.015],colors.dark);for(const x of [-d[0]*.30,d[0]*.30])for(const y of [-d[1]*.32,d[1]*.32]){cyl(g,.042,.033,[x,y,-d[2]*.25],colors.silver,'y');bolt(g,[x,y,d[2]/2-.006],'z',.014)}box(g,[.17,.17,.085],[-d[0]*.30,0,-.018],colors.dark);cyl(g,.058,.14,[-d[0]*.08,0,-.018],colors.dark,'x')}
function bridge(g,d){for(const x of [-d[0]*.36,d[0]*.36])box(g,[.09,d[1]*.97,.13],[x,0,-.005]);for(const y of [-d[1]*.39,0,d[1]*.39])box(g,[d[0]*.94,.07,.13],[0,y,-.005]);box(g,[d[0]*.95,d[1]*.95,.026],[0,0,.082],colors.dark);for(const x of [-d[0]*.35,d[0]*.35])for(const y of [-d[1]*.35,d[1]*.35])bolt(g,[x,y,.094])}
function cradle(g,d){box(g,[d[0]*.9,d[1]*.9,.025],[0,0,-d[2]/2+.015],colors.dark);hollow(g,[d[0]*.45,d[1]*.45,d[2]*.80],[0,0,0],colors.dark);box(g,[d[0],d[1],.025],[0,0,d[2]/2-.0125],colors.silver)}
function fixture(g,d,name){if(name.endsWith('foot')){box(g,[d[0],d[1],d[2]],[0,0,0],colors.dark);for(const x of [-.08,.08])for(const y of [-.08,.08])bolt(g,[x,y,d[2]/2-.006],'z',.011)}else if(name.endsWith('fixture_left')||name.endsWith('fixture_right')){box(g,[d[0]*.85,d[1],d[2]],[0,0,0],colors.blue);box(g,[.001,d[1]*.80,d[2]*.80],[name.endsWith('fixture_left')?d[0]/2-.0005:-d[0]/2+.0005,0,0],colors.dark)}else hollow(g,d,[0,0,0],colors.silver)}
function transverseBeam(g,d){
 for(const x of [-.16,.16]){hollow(g,[.08,d[1]*.98,.10],[x,0,-.01],colors.steel);box(g,[.025,d[1]*.96,.014],[x,0,.047],colors.silver);}
 for(const y of [-d[1]*.42,0,d[1]*.42])box(g,[d[0]*.91,.040,.10],[0,y,-.01],colors.steel);
 box(g,[d[0]*.90,d[1]*.99,.013],[0,0,.0665],colors.dark);
 for(let y=-d[1]*.45;y<d[1]*.46;y+=.045)box(g,[.045,.022,.026],[0,y,-.044],colors.silver);
 for(const x of [-.13,.13])for(const y of [-d[1]*.42,d[1]*.42])bolt(g,[x,y,.0675],'z',.007);
}
for(const w of data.world){const name=w.name,d=w.dimensions;let g;if(name==='floor'){g=envelope(name,d,(g,d)=>box(g,d,[0,0,0],'#E7E2D8'))}else{g=envelope(name,d,(g,d)=>w.kind==='transverse_slide'?transverseBeam(g,d): (w.kind==='mount_plate'||name.startsWith('cassette_'))?box(g,d,[0,0,0],colors.silver):w.kind==='rail'||w.kind==='outer_rail'?rail(g,d):w.kind==='rack'?rack(g,d):w.kind==='tower'?tower(g,d):['carriage','truck'].includes(w.kind)?platform(g,d):w.kind==='cantilever'?bridge(g,d):name.startsWith('rack_cradle')?cradle(g,d):/^Z0[123]-/.test(name)?box(g,d,[0,0,0],colors.silver):fixture(g,d,name))}g.position.set(...w.center);g.userData.outline.position.copy(g.position);g.quaternion.fromArray(w.quaternion_xyzw);g.userData.outline.quaternion.copy(g.quaternion)}

const robots={},tools={},toolBounds=[],jawObjects=[];
// Concept detail, contained in the collision-tested component envelopes.
// This is not catalogue CAD or a fabrication drawing.
function toolPart(g,p){
  const steel=colors.silver,dark=colors.dark,accent=colors.silver;
  if(p.half){
    const [x,y,z]=p.half;
    if(p.name==='carrier'){
      box(g,[2*x,2*y-.032,2*z-.015],[0,0,-.0075],dark);
      box(g,[2*x,.016,2*z*.72],[0,-y+.008,0],accent);
      box(g,[2*x,.016,2*z*.72],[0,y-.008,0],accent);
      for(const a of [-1,1]){
        cyl(g,.009,2*y-.018,[a*x*.65,0,z-.011],steel,'y',24);
        box(g,[.015,2*y-.02,.011],[a*x*.65,0,-z+.006],steel);
      }
      for(const a of [-1,1])for(const b of [-1,1])bolt(g,[a*x*.65,b*y*.78,z-.006],'z',.005);
    }else if(p.name==='transmission'){
      box(g,[2*x,2*y,2*z-.012],[0,0,-.006],accent);
      box(g,[2*x*.92,2*y*.93,.006],[0,0,z-.009],steel);
      for(const a of [-1,1])for(const b of [-1,1])bolt(g,[a*x*.63,b*y*.81,z-.006],'z',.005);
      box(g,[2*x*.70,.033,.001],[0,-y*.46,z-.0055],dark);
    }else{
      box(g,[2*x,2*y-.0032,2*z-.012],[0,0,-.006],steel);
      // Flush replaceable timber pads and transverse gripping ridges.
      for(const a of [-1,1])box(g,[2*x*.88,.0010,2*z*.86],[0,a*(y-.0009),0],dark);
      for(let a=-z*.72;a<z*.8;a+=.009)box(g,[2*x*.80,.0016,.002],[0,y-.0008,a],steel);
      for(const a of [-1,1])bolt(g,[a*x*.60,0,z-.006],'z',.004);
    }
  }else{
    const r=p.radius,h=p.length;
    if(p.name==='motor'){
      cyl(g,r*.91,h*.80,[0,0,0],dark,'z',40);
      for(let z=-h*.4+.007;z<h*.4-.006;z+=.013)cyl(g,r,.004,[0,0,z],accent,'z',40);
      cyl(g,r,h*.10,[0,0,-h*.45],steel,'z',40);
      cyl(g,r,h*.10-.006,[0,0,h*.45-.003],steel,'z',40);
      for(const a of [-1,1])for(const b of [-1,1])bolt(g,[a*r*.48,b*r*.48,h/2-.006],'z',.004);
    }else if(p.name==='master'){
      cyl(g,r,h-.012,[0,0,-.002],dark,'z',48);
      cyl(g,r,.004,[0,0,-h/2+.002],steel,'z',48);
      cyl(g,r,.004,[0,0,h/2-.006],steel,'z',48);
      for(let a=0;a<6;a++){const t=a*Math.PI/3;bolt(g,[r*.68*Math.cos(t),r*.68*Math.sin(t),h/2-.006],'z',.0045);}
    }else{
      cyl(g,r*.96,p.name==='plate'?h-.004:h,[0,0,p.name==='plate'?-.002:0],steel,'z',40);
      if(h>.015)for(const a of [-1,1])cyl(g,r,.003,[0,0,a*(h/2-.002)],dark,'z',40);
      if(p.name==='plate')for(let a=0;a<6;a++){const t=a*Math.PI/3;cyl(g,.004,.004,[r*.78*Math.cos(t),r*.78*Math.sin(t),h/2-.002],dark,'z',6);}
    }
  }
}

// Drafting grid and coordinate datum are annotations, not physical hardware.
const drafting=new THREE.Group();scene.add(drafting);
for(let x=-5;x<=3;x++){const pts=[new THREE.Vector3(x,-4,.003),new THREE.Vector3(x,4,.003)];drafting.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#CBC5BB',transparent:true,opacity:.16})));}
for(let y=-4;y<=4;y++){const pts=[new THREE.Vector3(-5,y,.003),new THREE.Vector3(3,y,.003)];drafting.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#CBC5BB',transparent:true,opacity:.16})));}
function tagLabel(text,pos){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#F1EEE7';ctx.fillRect(0,0,512,96);ctx.fillStyle='#171715';ctx.font='600 30px monospace';ctx.fillText(text,18,57);const texture=new THREE.CanvasTexture(canvas);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true,toneMapped:false}));label.position.set(...pos);label.scale.set(1.8,.338,1);drafting.add(label);return label;}
const armLabels={A:tagLabel('A / POSITION + HOLD',[-3.8,-3.25,4.35]),B:tagLabel('B / JOINING ACCESS',[-3.8,3.25,4.35])};
function fk(q,k){const poses={base_link:new THREE.Matrix4().makeTranslation(q[6],(k==='A'?-1:1)*(1.8-q[8]),q[7])},values=Object.fromEntries(q.slice(0,6).map((v,i)=>[`joint_${i+1}`,v]));const pending=data.kinematics.slice();while(pending.length){let changed=false;for(const j of pending.slice()){if(!poses[j.parent])continue;let value=values[j.name]||0;if(j.mimic)value=values[j.mimic.joint]*Number(j.mimic.multiplier||1)+Number(j.mimic.offset||0);const quat=new THREE.Quaternion().setFromEuler(new THREE.Euler(...j.rpy,'ZYX'));const origin=new THREE.Matrix4().compose(new THREE.Vector3(...j.xyz),quat,new THREE.Vector3(1,1,1));const motion=new THREE.Matrix4();if(j.type==='revolute')motion.makeRotationAxis(new THREE.Vector3(...j.axis),value);if(j.type==='prismatic')motion.makeTranslation(...j.axis.map(v=>v*value));poses[j.child]=poses[j.parent].clone().multiply(origin).multiply(motion);pending.splice(pending.indexOf(j),1);changed=true}if(!changed)throw Error('Disconnected URDF tree')}return poses}

// Source geometry is already in its surveyed final frame. Every active pose is
// expressed as a delta from that frame, so the complete model remains exact.
const steps=playback.steps, sequenceById=new Map(sequence.tasks.map(t=>[t.task_id,t]));
// One source member can be split into several site pieces. Credit it only
// after its last piece is installed, so the counter remains 0..155 exactly.
const sourceMemberships=steps.map(s=>s.index<=18?s.component_ids:sequenceById.get(s.id).source_component_ids);
const lastSourceStep=new Map();for(let i=0;i<steps.length;i++)for(const id of sourceMemberships[i])lastSourceStep.set(id,i);
const sourceIds=steps.map((_,i)=>sourceMemberships[i].filter(id=>lastSourceStep.get(id)===i));
const idsToStep=new Map();for(let i=0;i<steps.length;i++)for(const id of steps[i].component_ids)idsToStep.set(id,i);
const solids=[];for(const row of geometry){const solid=mesh(geo({vertices:row.position,faces:row.index}),row.metal?colors.silver:colors.timber,scene,true);solid.userData={id:row.id,task:row.task,metal:row.metal,step:idsToStep.get(row.id)};solid.matrixAutoUpdate=false;solids.push(solid)}
const baseMaterials={timber:mat(colors.timber),metal:mat(colors.silver),active:mat(colors.blue),ghost:mat(colors.blue)};
baseMaterials.ghost.transparent=true;baseMaterials.ghost.opacity=.56;baseMaterials.ghost.depthWrite=false;
for(const s of solids)s.material=s.userData.metal?baseMaterials.metal:baseMaterials.timber;
for(const k of ['A','B']){robots[k]={};for(const [name,v] of Object.entries(data.robot_meshes)){robots[k][name]=mesh(toCreasedNormals(geo(v),Math.PI/6),['cylinder','piston','link_6'].includes(name)?colors.dark:k==='A'?colors.white:colors.silver)}const root=new THREE.Group();scene.add(root);tools[k]=root;for(const p of data.tools[k]){const g=new THREE.Group();toolPart(g,p);g.position.set(...p.center);root.add(g)}}
const identity=new THREE.Matrix4(),earlyInverse=new Map();for(const s of steps.slice(0,18))earlyInverse.set(s.id,from(s.target_pose).invert());
const park={A:[Math.PI/2,-.5235988,-1.3962634,0,1.3962634,0,-4.85,.45,0],B:[-Math.PI/2,-.5235988,-1.3962634,0,1.3962634,0,2.8,.45,0]};
const pathGroup=new THREE.Group();scene.add(pathGroup);const pathMaterial=new THREE.LineBasicMaterial({color:colors.blue,transparent:true,opacity:.75});
const starts=[];let total=2;for(const s of steps){starts.push(total);total+=s.duration_s}const finish=total;total+=3;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),lerp=(a,b,u)=>a+(b-a)*u;
function pairAt(frames,u,key='u'){
 if(u<=0)return [frames[0],frames[0],0];if(u>=1)return [frames.at(-1),frames.at(-1),0];
 let lo=0,hi=frames.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(frames[m][key]<u)lo=m;else hi=m}
 return [frames[lo],frames[hi],clamp((u-frames[lo][key])/Math.max(1e-9,frames[hi][key]-frames[lo][key]),0,1)]
}
function mixQ(a,b,u){return a.map((v,i)=>lerp(v,b[i],u))}
function sampleQs(vertices,u){if(vertices.length===1)return vertices[0];let distances=[0];for(let i=1;i<vertices.length;i++){let d=0;for(let j=0;j<vertices[i].length;j++)d+=Math.pow((vertices[i][j]-vertices[i-1][j])*(j<6?.25:1),2);distances.push(distances.at(-1)+Math.sqrt(d))}const length=distances.at(-1);if(length<1e-9)return vertices[0];const x=u*length;let i=1;while(i<distances.length-1&&distances[i]<x)i++;return mixQ(vertices[i-1],vertices[i],clamp((x-distances[i-1])/Math.max(1e-9,distances[i]-distances[i-1]),0,1))}
function poseRobots(qs){for(const k of ['A','B']){const q=qs[k]||park[k],poses=fk(q,k),sign=k==='A'?-1:1;for(const [name,obj] of Object.entries(robots[k])){const pose=poses[name];if(pose)transform(obj,pose)}transform(tools[k],poses.tcp);const hardwarePositions={carriage:[q[6],sign*(1.8-q[8]),q[7]-.15],mount_plate:[q[6],sign*(1.8-q[8]),q[7]-.025],tower:[q[6],sign*3.15,2],cantilever:[q[6],sign*2.475,q[7]-.15],truck:[q[6],sign*2.65,.25],transverse_slide:[q[6],sign*(2.45-q[8]),q[7]-.15]};for(const [suffix,p] of Object.entries(hardwarePositions)){const g=hardware[k+'_'+suffix];if(g){g.position.set(...p);g.userData.outline.position.copy(g.position)}}}}
function setPath(step){pathGroup.clear();if(!step)return;let samples=[],arm='A';if(step.mode==='EARLIER_CHECKED_ROBOT_TASK'){arm='A';samples=step.early_frames.filter((_,i)=>i%Math.max(1,Math.floor(step.early_frames.length/100))===0).map(f=>f.q_by_arm.A)}else if(step.mode==='CHECKED_LOADED_ROBOT_ROUTE'){arm=step.physical_handler_side==='north'?'B':'A';samples=[...step.approach_q,...step.carried_q,...step.withdrawal_q]}if(samples.length<2)return;const pts=samples.map(q=>{const tcp=fk(q,arm).tcp;return new THREE.Vector3().setFromMatrixPosition(tcp)});pathGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),pathMaterial))}
const tmpPos=new THREE.Vector3(),tmpBox=new THREE.Box3(),installedCounts=[];let n=0;for(const ids of sourceIds){n+=ids.length;installedCounts.push(n)}
function activeOffset(step,u){if(step.mode==='CHECKED_GUIDED_ROOF_SLIDE'){const w=step.translation_waypoints_m;const a=w[0],b=w.at(-1);return new THREE.Matrix4().makeTranslation(lerp(a[0],b[0],u),lerp(a[1],b[1],u),lerp(a[2],b[2],u))}if(step.mode==='ILLUSTRATIVE_GUIDED_PLACEMENT'){const y=step.id.includes('NORTH')?1:step.id.includes('SOUTH')?-1:0;return new THREE.Matrix4().makeTranslation(0,y*(1-u)*.5,(1-u)*.28)}return identity}
function currentIndex(t){if(t<starts[0])return -1;if(t>=finish)return steps.length;let lo=0,hi=steps.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(starts[m]<=t)lo=m;else hi=m-1}return lo}
let elapsed=0,playing=false,lastStamp=0,lastStep=-999,cameraMode='whole',pathOn=true;
const $=id=>document.getElementById(id),seek=$('seek'),stepSelect=$('stepSelect');seek.max=total;
for(const [i,s] of steps.entries()){const o=document.createElement('option');o.value=i;o.textContent=`${String(i+1).padStart(2,'0')} · ${s.id}`;stepSelect.append(o)}
function apply(t){elapsed=clamp(t,0,total);const idx=currentIndex(elapsed),step=idx>=0&&idx<steps.length?steps[idx]:null,u=step?clamp((elapsed-starts[idx])/step.duration_s,0,1):0;if(idx!==lastStep){setPath(step);lastStep=idx}let qs={A:park.A,B:park.B},move=identity,phase='';
 if(step?.mode==='EARLIER_CHECKED_ROBOT_TASK'){const [a,b,v]=pairAt(step.early_frames,u);qs={A:mixQ(a.q_by_arm.A,b.q_by_arm.A,v),B:mixQ(a.q_by_arm.B,b.q_by_arm.B,v)};phase=a.phase;if(a.mode==='pickup')move=from(step.pickup_pose).multiply(earlyInverse.get(step.id));else{const holder=fk(qs.A,'A').tcp;move=holder.clone().multiply(from(step.member_to_tcp).invert()).multiply(earlyInverse.get(step.id))}}
 else if(step?.mode==='CHECKED_LOADED_ROBOT_ROUTE'){const holder=step.physical_handler_side==='north'?'B':'A';let q;if(u<.25){q=sampleQs(step.approach_q,u/.25);phase='PICKUP / CONTACT'}else if(u<.83){q=sampleQs(step.carried_q,(u-.25)/.58);phase='LOADED ROUTE / LANDING'}else{q=sampleQs(step.withdrawal_q,(u-.83)/.17);phase='RELEASE / WITHDRAWAL'}qs[holder]=q;const target=new THREE.Matrix4().makeTranslation(...step.target_centre_m),tcp=fk(q,holder).tcp;move=(u<.25?from(step.pickup_frame):u<.83?tcp.clone().multiply(from(step.relative_TCP).invert()):target).multiply(target.clone().invert())}
 else if(step){move=activeOffset(step,u);phase=step.mode==='CHECKED_GUIDED_ROOF_SLIDE'?'GUIDED PANEL SLIDE':'GUIDED PLACEMENT / ILLUSTRATIVE'}
 poseRobots(qs);for(const solid of solids){const i=solid.userData.step;solid.visible=i!==undefined&&(i<idx||i===idx);if(!solid.visible)continue;const active=i===idx;solid.matrix.copy(active?move:identity);solid.material=active?(step?.mode==='ILLUSTRATIVE_GUIDED_PLACEMENT'?baseMaterials.ghost:baseMaterials.active):(solid.userData.metal?baseMaterials.metal:baseMaterials.timber)}
 const count=idx<0?0:idx>=steps.length?155:installedCounts[idx-1]||0;const activeCount=idx>=0&&idx<steps.length?sourceIds[idx].length:0;const shown=count+(step&&u>.95?activeCount:0);$('count').textContent=`${shown} / 155`;$('stepCount').textContent=`${idx<0?0:idx>=steps.length?98:idx+1} / 98 placements`;stepSelect.value=String(clamp(idx,0,97));seek.value=String(elapsed);$('time').textContent=`${elapsed.toFixed(1)} / ${total.toFixed(1)} s`;
 $('title').textContent=step?`${step.id} · ${step.phase||'accepted early branch'}`:idx<0?'Empty site → complete structure':'Complete gable structure';$('status').textContent=step?`${String(idx+1).padStart(2,'0')}/98  ${phase||step.mode}  ·  ${step.truth}`:idx<0?'00/98  Empty site · 0 source members installed':'98/98  All 155 source members installed · physical construction unqualified';$('note').textContent=step?.truth||'The model shows installation order and exact final source geometry. Physical fixing, access, and transitions between robot jobs still require engineering qualification.';
 pathGroup.visible=pathOn&&!!step;if(cameraMode==='detail'&&step){const members=solids.filter(o=>o.userData.step===idx);if(members.length){tmpBox.makeEmpty();for(const m of members)tmpBox.expandByObject(m);tmpBox.getCenter(tmpPos);const target=tmpPos.clone(),position=target.clone().add(new THREE.Vector3(3.2,-4.3,2.4));camera.position.lerp(position,.06);controls.target.lerp(target,.06)}}
 renderer.render(scene,camera);return {time:elapsed,step:Math.min(idx+1,steps.length),id:step?.id||null,sourceMembers:shown,mode:step?.mode||null,phase};}
function whole(){camera.position.set(7.7,-10.8,7.5);controls.target.set(-.75,0,1.35);controls.update();cameraMode='whole'}whole();
function resize(){const w=div.clientWidth,h=div.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera)}new ResizeObserver(resize).observe(div);resize();
$('whole').onclick=whole;$('detail').onclick=()=>cameraMode='detail';$('path').onclick=e=>{pathOn=!pathOn;e.target.setAttribute('aria-pressed',String(pathOn));apply(elapsed)};$('proxies').onclick=e=>{proxy.visible=!proxy.visible;e.target.setAttribute('aria-pressed',String(proxy.visible));apply(elapsed)};
$('play').onclick=e=>{playing=!playing;e.target.setAttribute('aria-pressed',String(playing));e.target.textContent=playing?'Pause':'Play';lastStamp=performance.now()};seek.oninput=()=>{playing=false;$('play').textContent='Play';$('play').setAttribute('aria-pressed','false');apply(Number(seek.value))};stepSelect.onchange=()=>{playing=false;$('play').textContent='Play';$('play').setAttribute('aria-pressed','false');apply(starts[Number(stepSelect.value)])};
const params=new URLSearchParams(location.search);if(params.has('step'))elapsed=starts[clamp(Number(params.get('step'))-1,0,97)];if(params.has('t'))elapsed=Number(params.get('t'));apply(elapsed);
window.fullAssemblyReview={apply,steps,starts,total,solids,scene,camera,renderer,geometryCount:geometry.length};
renderer.setAnimationLoop(now=>{if(playing){elapsed+=Math.min((now-lastStamp)/1000,.12)*Number($('speed').value);if(elapsed>=total){elapsed=total;playing=false;$('play').textContent='Play';$('play').setAttribute('aria-pressed','false')}}lastStamp=now;controls.update();apply(elapsed)});
