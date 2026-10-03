const $=id=>document.getElementById(id);
const suits=['♠','♥','♦','♣'],ranks=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const cardName=n=>`${ranks[n%13]}${suits[Math.floor(n/13)]}`;
const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winner(b){for(const [a,c,d] of lines)if(b[a]&&b[a]===b[c]&&b[c]===b[d])return b[a];return b.every(Boolean)?3:0}
function forward(weights,board){let x=board.map(v=>Number(v===1)).concat(board.map(v=>Number(v===2)));for(let layer=1;layer<=3;layer++){let matrix=weights[`fc${layer}.weight`],bias=weights[`fc${layer}.bias`];x=matrix.map((row,i)=>{let v=row.reduce((sum,w,j)=>sum+w*x[j],bias[i]);return layer<3?Math.max(0,v):v})}return x}
function exactValue(b,turn){const w=winner(b);if(w)return w===2?1:w===1?-1:0;const vals=[];for(let i=0;i<9;i++)if(!b[i]){b[i]=turn;vals.push(exactValue(b,turn===1?2:1));b[i]=0}return turn===2?Math.max(...vals):Math.min(...vals)}
let replay,network,board=Array(9).fill(0),mode='raw',last=-1,ended=false;
let hokmRevealed=false;
let comparison=null;
const hokmMoments=[
  {index:2,title:'Follow the lead',detail:'P2 · three legal spades'},
  {index:25,title:'Trump the lead',detail:'P3 · no hearts remain'},
  {index:39,title:'Finish the deal',detail:'Team 1 reaches seven'}
];
function renderHokmMoments(){
  if(!replay)return;
  const root=$('hokm-moments');
  root.replaceChildren(...hokmMoments.map(({index,title,detail})=>{
    const event=replay.events[index],button=document.createElement('button');
    button.type='button';button.dataset.step=String(index);
    button.setAttribute('aria-label',`Saved action ${index+1}: ${title}. ${detail}.`);
    const number=document.createElement('small');number.textContent=String(index+1).padStart(2,'0');
    const heading=document.createElement('strong');heading.textContent=title;
    const note=document.createElement('span');note.textContent=`${detail} · ${cardName(event.action)}`;
    button.append(number,heading,note);
    button.addEventListener('click',()=>{hokmRevealed=false;$('hokm-step').value=index;renderHokm()});
    return button;
  }));
}
function hokmCard(card,kind=''){
  const el=document.createElement('span');
  el.className=`hokm-card ${[1,2].includes(Math.floor(card/13))?'red':''} ${kind}`.trim();
  el.textContent=cardName(card);
  return el;
}
function renderHokmLogic(e){
  const lead=e.trick_before[0];
  const scored=[...e.q_legal].sort((a,b)=>b.q-a.q);
  const makeStage=(index,title,content,extra='')=>{
    const stage=document.createElement('div');stage.className=`hokm-logic-stage ${extra}`;
    const number=document.createElement('small');number.textContent=String(index).padStart(2,'0');
    const heading=document.createElement('strong');heading.textContent=title;
    const body=document.createElement('div');body.className='hokm-logic-content';
    if(typeof content==='string')body.textContent=content;else body.append(content);
    stage.append(number,heading,body);return stage;
  };
  const trick=document.createElement('div');trick.className='hokm-logic-cards';
  if(e.trick_before.length){
    e.trick_before.forEach((card,i)=>{const item=hokmCard(card);item.title=`Play ${i+1} in this trick`;trick.append(item)});
  }else{const note=document.createElement('span');note.textContent='P'+e.player+' leads';trick.append(note)}
  const legal=document.createElement('div');legal.className='hokm-logic-cards';
  e.legal.forEach(card=>legal.append(hokmCard(card,card===e.action?'chosen':'')));
  const ranking=document.createElement('div');ranking.className='hokm-logic-rank';
  scored.slice(0,Math.min(5,scored.length)).forEach(({card,q})=>{
    const item=document.createElement('span');item.className=card===e.action?'chosen':'';
    const label=document.createElement('b');label.textContent=cardName(card);
    const value=document.createElement('em');value.textContent=q.toFixed(2);
    item.append(label,value);ranking.append(item);
  });
  const chosen=document.createElement('div');chosen.className='hokm-logic-choice';chosen.append(hokmCard(e.action,'chosen'));
  const raw=document.createElement('span');raw.textContent=`Unmasked top ${cardName(e.q_raw_argmax)} · ${e.legal.includes(e.q_raw_argmax)?'legal':e.hand.includes(e.q_raw_argmax)?'follow-suit excludes it':'outside this hand'}`;chosen.append(raw);
  const stages=[
    makeStage(1,lead===undefined?'Opening lead':`Lead suit ${suits[Math.floor(lead/13)]}`,trick),
    makeStage(2,`${e.legal.length} of ${e.hand.length} legal`,legal),
    makeStage(3,'Score legal cards',ranking),
    makeStage(4,`P${e.player} chooses`,chosen,'is-result')
  ];
  $('hokm-logic').replaceChildren(...stages);
}
function renderHokm(){
  if(!replay)return;
  const index=Number($('hokm-step').value),e=replay.events[index];
  $('hokm-moments').querySelectorAll('button').forEach(button=>button.classList.toggle('active',Number(button.dataset.step)===index));
  const trickStart=index-e.trick_before.length;
  const currentTrick=replay.events.slice(trickStart,trickStart+4);
  $('hokm-count').textContent=`${String(index+1).padStart(2,'0')} / ${replay.events.length}`;
  $('hokm-trick-number').textContent=`TRICK ${String(Math.floor(index/4)+1).padStart(2,'0')} / 10`;
  $('hokm-state').textContent=`P${e.player} / TEAM ${e.team} ${hokmRevealed?'HAS PLAYED':'TO PLAY'}`;
  $('hokm-trump').textContent=suits[replay.trump];
  const score=hokmRevealed?e.score_after:e.score_before;
  $('hokm-team0').textContent=score[0];
  $('hokm-team1').textContent=score[1];
  const visibleMoves=replay.events.slice(0,index+(hokmRevealed?1:0));
  const hands=replay.initial_hands.map(cards=>cards.filter(card=>!visibleMoves.some(move=>move.action===card)));
  const handRows=hands.map((cards,player)=>{
    const row=document.createElement('div');
    row.className=`hokm-hand-row ${player===e.player?'is-playing':''}`;
    row.dataset.seat=String(player);
    const label=document.createElement('div');label.className='hokm-seat';
    label.innerHTML=`<b>P${player}</b><small>TEAM ${player%2}</small>`;
    const deck=document.createElement('div');deck.className='hokm-hand-cards';
    for(const card of [...cards].sort((a,b)=>a-b)){
      const kind=player===e.player&&!hokmRevealed?(card===e.action?'chosen':e.legal.includes(card)?'legal':'masked'):'';
      const item=hokmCard(card,kind);
      item.title=player===e.player?(card===e.action?'Saved choice':e.legal.includes(card)?'Legal':'Unavailable under follow-suit rule'):`Player ${player} stored hand`;
      deck.append(item);
    }
    const tally=document.createElement('small');tally.className='hokm-hand-count';tally.textContent=`${cards.length} CARDS`;
    row.append(label,deck,tally);return row;
  });
  $('hokm-hands').replaceChildren(...handRows);
  $('hokm-timeline').replaceChildren(...Array.from({length:10},(_,trick)=>{
    const final=replay.events[trick*4+3];
    const button=document.createElement('button');
    button.type='button';
    button.className=`hokm-timeline-step ${trick===Math.floor(index/4)?'active':''}`;
    button.setAttribute('aria-current',trick===Math.floor(index/4)?'step':'false');
    const complete=trick*4+3<index||(trick*4+3===index&&hokmRevealed);
    const current=trick===Math.floor(index/4);
    button.setAttribute('aria-label',complete?`Trick ${trick+1}; won by player ${final.trick_winner}, team ${final.trick_winner%2}`:`Trick ${trick+1}; ${current?'in progress':'not yet shown'}`);
    button.innerHTML=`<span>${String(trick+1).padStart(2,'0')}</span><strong>${complete?`TEAM ${final.trick_winner%2}`:current?'IN PLAY':'·'}</strong>`;
    button.addEventListener('click',()=>{hokmRevealed=false;$('hokm-step').value=trick*4;renderHokm()});
    return button;
  }));
  const played=currentTrick.map((move,offset)=>{
    const slot=document.createElement('div');
    slot.className=`hokm-trick-slot ${trickStart+offset===index?'current':''}`;
    slot.dataset.seat=String(move.player);
    const label=document.createElement('small');label.textContent=`P${move.player} · ${offset===0?'LEAD':String(offset+1).padStart(2,'0')}`;
    if(trickStart+offset<index||(hokmRevealed&&trickStart+offset===index)){slot.append(label,hokmCard(move.action));}
    else {const empty=document.createElement('span');empty.className='hokm-card pending';empty.textContent='·';slot.append(label,empty);}
    return slot;
  });
  const center=document.createElement('div');center.className='hokm-trick-center';
  const centerLabel=document.createElement('small');centerLabel.textContent='ONE TRICK · FOUR SEATS';
  const centerResult=document.createElement('strong');
  centerResult.textContent=hokmRevealed&&e.trick_winner!==null?`P${e.trick_winner} WINS`:`P${e.player} ${hokmRevealed?'PLAYED':'TO PLAY'}`;
  center.append(centerLabel,centerResult);
  $('hokm-trick-cards').replaceChildren(...played,center);
  $('hokm-trick-status').textContent=hokmRevealed&&e.trick_winner!==null?`P${e.trick_winner} WINS`:`${e.trick_before.length+(hokmRevealed?1:0)} / 4 PLAYED`;
  $('hokm-choice').textContent=`Saved choice · P${e.player} ${hokmRevealed?'played':'will play'} ${cardName(e.action)}`;
  renderHokmLogic(e);
  $('hokm-reveal').textContent=hokmRevealed?'Return to decision':'Reveal selected play';
  $('hokm-reveal').setAttribute('aria-pressed',String(hokmRevealed));
  const sorted=[...e.q_legal].sort((a,b)=>b.q-a.q),lo=Math.min(...sorted.map(x=>x.q)),hi=Math.max(...sorted.map(x=>x.q));
  $('hokm-bars').replaceChildren(...sorted.map(x=>{const row=document.createElement('div');row.className=`q-bar ${x.card===e.action?'active':''}`;const label=document.createElement('span'),bar=document.createElement('i'),value=document.createElement('span');label.textContent=cardName(x.card);bar.style.width=`${Math.max(5,100*(x.q-lo)/(hi-lo||1))}%`;value.textContent=x.q.toFixed(2);row.append(label,bar,value);return row}));
}
function choose(position,scores,rule){
  const legal=position.map((v,i)=>v?-1:i).filter(i=>i>=0);
  const rank=(i,j)=>scores[j]-scores[i]||i-j;
  const raw=[...legal].sort(rank)[0];
  if(rule==='block')for(const side of [2,1]){
    const found=legal.find(i=>{const next=position.slice();next[i]=side;return winner(next)===side});
    if(found!==undefined)return {move:found,raw,reason:side===2?'Immediate winning cell':'Immediate X win blocked'};
  }
  if(rule==='exact'){
    const values=legal.map(i=>{const next=position.slice();next[i]=2;return [i,exactValue(next,1)]});
    const best=Math.max(...values.map(x=>x[1]));
    const move=values.filter(x=>x[1]===best).map(x=>x[0]).sort(rank)[0];
    return {move,raw,reason:`Exact game value ${best===1?'win':best===0?'draw':'loss'}; raw score breaks ties`};
  }
  return {move:raw,raw,reason:'Highest legal checkpoint output'};
}
function renderXoDemo(){
  // This legal position is reachable via X4, O5, X6, O8, X7.
  const position=[0,0,0,1,2,1,1,2,0],scores=forward(network,position);
  const makeBoard=(state,chosen=-1)=>{
    const grid=document.createElement('div');grid.className='xo-demo-board';
    state.forEach((value,i)=>{
      const cell=document.createElement('span');cell.className=`${value===1?'x':value===2?'o':''} ${i===chosen?'chosen':''}`;
      cell.textContent=value===1?'X':value===2?'O':'·';
      cell.setAttribute('aria-label',`Cell ${i+1}: ${value===1?'X':value===2?'O':'empty'}${i===chosen?', selected move':''}`);
      grid.append(cell);
    });return grid;
  };
  const start=document.createElement('div');start.className='xo-demo-case xo-demo-start';
  const startTitle=document.createElement('span');startTitle.className='xo-demo-index';startTitle.textContent='ONE FIXED POSITION';
  const startHead=document.createElement('strong');startHead.textContent='O to move';
  const startNote=document.createElement('small');startNote.textContent='X4 · O5 · X6 · O8 · X7';
  start.append(startTitle,startHead,makeBoard(position),startNote);
  const labels={raw:'Highest output',block:'Win / block',exact:'Exact game value'};
  const cards=Object.entries(labels).map(([rule,label],j)=>{
    const choice=choose(position,scores,rule),result=position.slice();result[choice.move]=2;
    const value=exactValue(result.slice(),1);
    const card=document.createElement('div');card.className=`xo-demo-case xo-demo-${rule}`;
    const tag=document.createElement('span');tag.className='xo-demo-index';tag.textContent=`RULE ${String(j+1).padStart(2,'0')}`;
    const head=document.createElement('strong');head.textContent=label;
    const note=document.createElement('small');
    const outcome=value===1?'O can force a win':value===0?'Draw with exact play':'X can force a win';
    note.textContent=`O → cell ${choice.move+1} · ${rule==='block'?'wins now':outcome}`;
    card.append(tag,head,makeBoard(result,choice.move),note);
    card.setAttribute('aria-label',`${label}. O chooses cell ${choice.move+1}. ${rule==='block'?'O wins immediately.':outcome+'.'}`);
    return card;
  });
  const footer=document.createElement('p');footer.className='xo-demo-foot';
  footer.textContent='Same board and network output in all three cases. The exact-value rule optimizes the eventual result and uses checkpoint score to break ties; it need not take the fastest win.';
  $('xo-demo').replaceChildren(start,...cards,footer);
}
function renderEvaluation(data){
  const root=$('game-eval-distribution');
  const rows=data.matchups.map(matchup=>{
    const wins=Array(80).fill(0),exposures=Array(80).fill(0);
    for(const outcome of matchup.outcomes){
      wins[outcome.deal_index]+=outcome.win;
      exposures[outcome.deal_index]++;
    }
    if(exposures.some(n=>n!==8)||wins.reduce((a,b)=>a+b,0)!==matchup.focal_wins){
      throw new Error(`Evaluation record inconsistent: ${matchup.title}`);
    }
    const histogram=Array(9).fill(0);
    wins.forEach(n=>histogram[n]++);
    const row=document.createElement('div');row.className='game-eval-row';
    const label=document.createElement('div');label.className='game-eval-label';
    const heading=document.createElement('strong');heading.textContent=matchup.title;
    const total=document.createElement('span');total.textContent=`${matchup.focal_wins} / ${matchup.games}`;
    const interval=document.createElement('small');
    const percent=Math.round(1000*matchup.focal_wins/matchup.games)/10;
    interval.textContent=`${percent.toFixed(1)}% wins · deal-cluster 95% interval ${(100*matchup.deal_cluster_bootstrap_95[0]).toFixed(1)}–${(100*matchup.deal_cluster_bootstrap_95[1]).toFixed(1)}%`;
    label.append(heading,total,interval);
    const chart=document.createElement('div');chart.className='game-eval-histogram';
    chart.setAttribute('role','img');
    chart.setAttribute('aria-label',`${matchup.title}: number of deals with zero through eight focal wins: ${histogram.join(', ')}.`);
    histogram.forEach((count,score)=>{
      const column=document.createElement('div');column.className='game-eval-column';
      const bar=document.createElement('span');bar.className='game-eval-bar';bar.style.height=`${100*count/40}%`;
      bar.title=`${count} of 80 deals: ${score} wins out of 8`;
      const countLabel=document.createElement('b');countLabel.textContent=count||'';
      const scoreLabel=document.createElement('small');scoreLabel.textContent=String(score);
      column.append(countLabel,bar,scoreLabel);chart.append(column);
    });
    row.append(label,chart);return row;
  });
  const axis=document.createElement('p');axis.className='game-eval-axis';
  axis.textContent='Horizontal scale: focal wins per deal, from 0 to 8 · Bar height: number of the 80 deals';
  root.replaceChildren(...rows,axis);
}
function renderGame(){
  $('xo-board').replaceChildren(...board.map((v,i)=>{
    const b=document.createElement('button');b.type='button';b.textContent=v===1?'X':v===2?'O':'';
    b.setAttribute('aria-label',`Cell ${i+1}${v?', '+b.textContent:''}`);
    b.disabled=!!v||ended;b.className=i===last?'last':'';
    b.addEventListener('click',()=>play(i));return b;
  }));
  const input=comparison?.position||board;
  $('xo-inputs').replaceChildren(...[1,2].map((side)=>{
    const row=document.createElement('div');row.className='xo-input-row';
    const label=document.createElement('strong');label.textContent=`${side===1?'X':'O'} / CELLS 1–9`;
    const bits=document.createElement('div');bits.className='xo-bits';
    input.forEach((value,i)=>{const bit=document.createElement('span');bit.className=value===side?'on':'';bit.textContent=value===side?'1':'0';bit.title=`Cell ${i+1}: ${value===side?'1':'0'}`;bits.append(bit)});
    row.append(label,bits);return row;
  }));
  if(!comparison){$('xo-scores').replaceChildren();$('xo-policy-comparison').hidden=true;$('xo-policy-comparison').replaceChildren();return}
  const {position,raw}=comparison, legal=position.map((v,i)=>v?-1:i).filter(i=>i>=0);
  const ranking=[...legal].sort((a,b)=>raw[b]-raw[a]||a-b);
  const lo=Math.min(...legal.map(i=>raw[i])),hi=Math.max(...legal.map(i=>raw[i]));
  $('xo-scores').replaceChildren(...raw.map((value,i)=>{
    const cell=document.createElement('div');
    cell.className=`xo-score-cell ${position[i]?'occupied':''} ${i===last?'selected':''} ${i===ranking[0]?'raw-best':''}`;
    cell.title=`Cell ${i+1}: raw checkpoint output ${value.toFixed(3)}${position[i]?' (occupied; excluded)':''}`;
    const number=document.createElement('span');number.textContent=`CELL ${String(i+1).padStart(2,'0')}`;
    const mark=document.createElement('b');mark.textContent=position[i]===1?'X':position[i]===2?'O':i===last?'O':'';
    const magnitude=document.createElement('strong');magnitude.textContent=`${(value/1e6).toFixed(2)}m`;
    const note=document.createElement('small');note.textContent=position[i]?'MASKED':i===last?'SELECTED':i===ranking[0]?'RAW TOP':`RANK ${ranking.indexOf(i)+1}`;
    const bar=document.createElement('i');bar.style.width=`${position[i]?0:Math.max(8,100*(value-lo)/(hi-lo||1))}%`;
    cell.append(number,mark,magnitude,note,bar);return cell;
  }));
  const labels={raw:'Highest output',block:'Win / block first',exact:'Exact game value'};
  $('xo-policy-comparison').hidden=false;
  $('xo-policy-comparison').replaceChildren(...Object.keys(labels).map(rule=>{
    const choice=choose(position,raw,rule),result=position.slice();result[choice.move]=2;
    const card=document.createElement('button');card.type='button';card.className=`xo-policy-card ${rule===mode?'active':''}`;
    card.setAttribute('aria-pressed',String(rule===mode));card.setAttribute('aria-label',`${labels[rule]}; O chooses cell ${choice.move+1}. ${choice.reason}`);
    const head=document.createElement('strong');head.textContent=labels[rule];
    const grid=document.createElement('span');grid.className='xo-policy-mini';
    result.forEach((value,i)=>{const square=document.createElement('span');square.className=i===choice.move?'chosen':'';square.textContent=value===1?'X':value===2?'O':'';grid.append(square)});
    const caption=document.createElement('small');caption.textContent=`O → CELL ${choice.move+1} · ${choice.reason}`;
    card.append(head,grid,caption);card.addEventListener('click',()=>activateMode(rule));return card;
  }));
}
function activateMode(next){mode=next;if(comparison)applyPolicy();else renderGame()}
function applyPolicy(){
  if(!comparison)return;
  const choice=choose(comparison.position,comparison.raw,mode);
  board=comparison.position.slice();board[choice.move]=2;last=choice.move;
  const result=winner(board);ended=!!result;
  $('xo-status').textContent=result===3?'Draw':result===1?'X wins':result===2?'O wins':'Your move / X';
  $('xo-explain').textContent=`Same board · same saved checkpoint outputs. Raw top: cell ${choice.raw+1}. ${choice.reason}. ${mode==='raw'?'':'Rule chooses '}Cell ${choice.move+1}.`;
  renderGame();
}
function play(i){
  if(ended||board[i]||!network)return;
  board[i]=1;
  const result=winner(board);
  if(result){comparison=null;ended=true;$('xo-status').textContent=result===3?'Draw':'X wins';$('xo-explain').textContent='The X move ended this game.';renderGame();return}
  const position=board.slice();comparison={position,raw:forward(network,position)};
  applyPolicy();
}
function reset(){board=Array(9).fill(0);comparison=null;last=-1;ended=false;$('xo-status').textContent='Your move / X';$('xo-explain').textContent='Place X to compare three O decisions from the same position.';renderGame()}
$('hokm-step').addEventListener('input',()=>{hokmRevealed=false;renderHokm()});
$('hokm-reveal').addEventListener('click',()=>{hokmRevealed=!hokmRevealed;renderHokm()});
for(const [id,delta] of [['hokm-prev',-1],['hokm-next',1],['hokm-prev-trick',-4],['hokm-next-trick',4]])$(''+id).addEventListener('click',()=>{hokmRevealed=false;$('hokm-step').value=Math.max(0,Math.min(39,Number($('hokm-step').value)+delta));renderHokm()});
$('xo-reset').addEventListener('click',reset);
Promise.all([fetch('media/hokm-replay.json').then(r=>r.json()),fetch('media/xo-networks.json').then(r=>r.json()),fetch('media/hokm-evaluation.json').then(r=>r.json())]).then(([h,x,e])=>{replay=h;network=x['2'];renderHokmMoments();renderHokm();renderXoDemo();reset();renderEvaluation(e)}).catch(err=>{$('hokm-choice').textContent=`Source data unavailable: ${err.message}`});
