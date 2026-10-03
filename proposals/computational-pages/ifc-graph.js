const q=id=>document.getElementById(id), svgNS='http://www.w3.org/2000/svg';
const svgEl=(name,props={})=>{const el=document.createElementNS(svgNS,name);for(const [key,value] of Object.entries(props))el.setAttribute(key,String(value));return el};
let graph,selectedId=8411;
const shortType=type=>({IFCOPENINGELEMENT:'OPENING',IFCBUILDINGSTOREY:'STOREY',IFCSTAIRFLIGHT:'STAIR RUN'}[type]||type.replace(/^IFC/,''));
const title=node=>node.type.replace(/^IFC/,'')+(node.name?` · ${node.name}`:'');
function drawNeighborhood(){
  if(!graph)return;
  const svg=q('ifc-neighborhood'), detail=q('ifc-entity-detail'),nodes=new Map(graph.nodes.map(n=>[n.id,n]));
  const center=nodes.get(selectedId);if(!center)return;
  const links=graph.edges.filter(e=>e.source===selectedId||e.target===selectedId);
  svg.replaceChildren();
  const centerX=430,centerY=210;
  svg.append(svgEl('circle',{cx:centerX,cy:centerY,r:73,fill:'#294b8d'}));
  let cLabel=svgEl('text',{x:centerX,y:centerY-4,'text-anchor':'middle',fill:'#fff','font-size':16,'font-family':'Inter','font-weight':600});cLabel.textContent=shortType(center.type);svg.append(cLabel);
  let cId=svgEl('text',{x:centerX,y:centerY+20,'text-anchor':'middle',fill:'#d9e4f4','font-size':12,'font-family':'Mono'});cId.textContent=`#${center.id}`;svg.append(cId);
  if(!links.length){const empty=svgEl('text',{x:430,y:345,'text-anchor':'middle',fill:'#69675f','font-size':15,'font-family':'Inter'});empty.textContent='No typed link in this selected extract';svg.append(empty)}
  const shown=links.slice(0,12);
  shown.forEach((edge,i)=>{
    const otherId=edge.source===selectedId?edge.target:edge.source,other=nodes.get(otherId);if(!other)return;
    const angle=(-Math.PI/2)+(i*2*Math.PI/shown.length),x=430+285*Math.cos(angle),y=210+145*Math.sin(angle);
    const line=svgEl('line',{x1:centerX,y1:centerY,x2:x,y2:y,stroke:'#a5a9ad','stroke-width':2});svg.append(line);
    const tag=svgEl('text',{x:(centerX+x)/2,y:(centerY+y)/2-7,'text-anchor':'middle',fill:'#294b8d','font-size':10,'font-family':'Mono'});tag.textContent=edge.kind==='HOSTS'?'HOSTS*':edge.kind;svg.append(tag);
    const group=svgEl('g',{tabindex:0,role:'button','aria-label':`Select ${title(other)}, entity ${other.id}`,class:'ifc-linked-node'});
    group.append(svgEl('circle',{cx:x,cy:y,r:42,fill:'#f6f4ef',stroke:'#9c9a94','stroke-width':1.5}));
    const name=svgEl('text',{x,y:y-2,'text-anchor':'middle',fill:'#222','font-size':10,'font-family':'Inter','font-weight':600});name.textContent=shortType(other.type);group.append(name);
    const id=svgEl('text',{x,y:y+15,'text-anchor':'middle',fill:'#69675f','font-size':9,'font-family':'Mono'});id.textContent=`#${other.id}`;group.append(id);
    group.addEventListener('click',()=>select(other.id));group.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select(other.id)}});svg.append(group);
  });
  detail.replaceChildren();
  const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent=`${center.type} / #${center.id}`;
  const heading=document.createElement('h3');heading.textContent=center.name||center.type;
  const guid=document.createElement('p');guid.className='mono';guid.textContent=`IFC GUID  ${center.guid}`;
  const list=document.createElement('div');list.className='ifc-links';
  links.forEach(edge=>{const other=nodes.get(edge.source===selectedId?edge.target:edge.source);if(!other)return;const button=document.createElement('button');button.type='button';const label=document.createElement('small');label.textContent=edge.kind==='HOSTS'?`DERIVED / HOSTS VIA OPENING #${edge.through_opening}`:`${edge.source===selectedId?'OUT':'IN'} / ${edge.kind} · RELATION #${edge.relation_id}`;const target=document.createElement('strong');target.textContent=`${other.type.replace(/^IFC/,'')} #${other.id}`;button.append(label,target);button.addEventListener('click',()=>select(other.id));list.append(button)});
  detail.append(eyebrow,heading,guid,list);
  if(links.length>12){const note=document.createElement('p');note.className='caption';note.textContent=`Diagram shows 12 of ${links.length} links. The list retains all links.`;detail.append(note)}
}
function select(id){selectedId=id;const type=q('ifc-type'),entity=q('ifc-entity');const node=graph.nodes.find(n=>n.id===id);if(type.value!=='all'&&node.type!==type.value){type.value='all';fillEntities()}entity.value=String(id);drawNeighborhood()}
function fillEntities(){const type=q('ifc-type').value,entity=q('ifc-entity');const records=graph.nodes.filter(n=>type==='all'||n.type===type);entity.replaceChildren(...records.map(n=>{const option=document.createElement('option');option.value=n.id;option.textContent=`${n.type.replace(/^IFC/,'')} #${n.id} · ${n.name||'Unnamed'}`;return option}));if(!records.some(n=>n.id===selectedId))selectedId=records[0].id;entity.value=String(selectedId);drawNeighborhood()}
fetch('media/ifc-graph.json').then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}).then(data=>{graph=data;const types=[...new Set(data.nodes.map(n=>n.type))];q('ifc-type').append(...types.map(t=>{const o=document.createElement('option');o.value=t;o.textContent=`${t.replace(/^IFC/,'')} (${data.nodes.filter(n=>n.type===t).length})`;return o}));q('ifc-graph-count').textContent=`${data.nodes.length} entities / ${data.edges.length-data.edge_counts.HOSTS} direct links / ${data.edge_counts.HOSTS} derived host links`;fillEntities();q('ifc-type').addEventListener('change',fillEntities);q('ifc-entity').addEventListener('change',e=>select(Number(e.target.value)))}).catch(e=>{q('ifc-entity-detail').textContent=`IFC graph unavailable: ${e.message}`});
