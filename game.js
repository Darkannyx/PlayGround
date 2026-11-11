(() => {
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const W = 1600, H = 1100;
  const icons = { berry:'🫐', shell:'🐚', flower:'🌼', seed:'🌱', wood:'🪵' };
  const labels = { berry:'Blueberry', shell:'Seashell', flower:'Wildflower', seed:'Flower seed', wood:'Driftwood' };
  const player = { x:790, y:560, dir:0, moving:false, walk:0 };
  const keys = new Set();
  let vw=innerWidth, vh=innerHeight, dpr=1, last=performance.now(), clockMinutes=480;
  let toastTimer, saveTimer, gameStarted=false, soundOn=false, audioCtx=null;
  const defaultState = { coins:24, inventory:{}, collected:[], greeted:false, questDone:false, planted:0, day:1, time:480 };
  let state = loadState();
  const objects = [
    {id:'mabel',type:'npc',x:825,y:438,name:'Mabel'},
    {id:'berry1',type:'berry',x:635,y:364},{id:'berry2',type:'berry',x:1015,y:360},{id:'berry3',type:'berry',x:1100,y:660},{id:'berry4',type:'berry',x:478,y:605},{id:'berry5',type:'berry',x:1270,y:520},
    {id:'shell1',type:'shell',x:245,y:724},{id:'shell2',type:'shell',x:395,y:852},{id:'shell3',type:'shell',x:1200,y:866},{id:'shell4',type:'shell',x:1380,y:768},
    {id:'flower1',type:'flower',x:555,y:445},{id:'flower2',type:'flower',x:1195,y:405},{id:'flower3',type:'flower',x:670,y:800},
    {id:'seed',type:'seed',x:942,y:515},
    {id:'home',type:'home',x:740,y:257,name:'Your cottage'},
    {id:'bench',type:'bench',x:1060,y:500,name:'Meadow bench'},
    {id:'garden',type:'garden',x:935,y:678,name:'Garden patch'}
  ];
  const trees = [
    [300,310,1.1],[430,260,.9],[550,280,1.15],[660,220,.85],[930,250,1],[1080,275,1.15],[1220,310,.9],[1370,370,1.1],
    [330,455,.85],[440,470,1.1],[520,550,.85],[620,660,1],[740,755,.9],[850,825,1],[1035,770,1.05],[1170,680,.85],[1300,600,1.1],[1435,590,.9],
    [310,590,.9],[470,760,1],[555,890,.9],[1100,900,.95],[1320,880,1.05],[1460,810,.95]
  ];
  const flowers = [[365,365,'#f4d683'],[393,385,'#f0a7a0'],[580,340,'#fff0c1'],[690,390,'#f4d683'],[1140,335,'#f0a7a0'],[1315,450,'#fff0c1'],[490,535,'#f4d683'],[700,730,'#f0a7a0'],[1045,625,'#fff0c1'],[1225,760,'#f4d683'],[520,845,'#f0a7a0'],[925,850,'#fff0c1']];
  function loadState(){ try{return {...defaultState,...JSON.parse(localStorage.getItem('willowBaySave')||'{}'),inventory:JSON.parse(localStorage.getItem('willowBaySave')||'{}').inventory||{},collected:JSON.parse(localStorage.getItem('willowBaySave')||'{}').collected||[]};}catch{return {...defaultState,inventory:{},collected:[]};} }
  function save(){state.time=clockMinutes;try{localStorage.setItem('willowBaySave',JSON.stringify(state));$('save-note').classList.add('show');clearTimeout(saveTimer);saveTimer=setTimeout(()=>$('save-note').classList.remove('show'),1200);}catch{}updateUI();}
  function resize(){vw=innerWidth;vh=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(vw*dpr);canvas.height=Math.floor(vh*dpr);canvas.style.width=vw+'px';canvas.style.height=vh+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
  addEventListener('resize',resize);resize();
  function inventoryTotal(){return Object.values(state.inventory).reduce((a,b)=>a+b,0);}
  function updateUI(){
    $('coins').textContent=state.coins; $('inv-total').textContent=`${inventoryTotal()} item${inventoryTotal()===1?'':'s'}`;
    const slots=['berry','shell','flower','seed','wood'];
    $('inventory').innerHTML=slots.map(k=>state.inventory[k]?`<div class="slot" title="${labels[k]}">${icons[k]}<span class="qty">${state.inventory[k]}</span></div>`:`<div class="slot empty">·</div>`).join('');
    const done=state.greeted?Math.min(1+(inventoryTotal()>=3?1:0)+(state.questDone?1:0),3):0;
    $('quest-count').textContent=state.questDone?'3 / 3':`${done} / 3`;$('quest-progress').style.width=`${state.questDone?100:done/3*100}%`;
    $('quest-title').textContent=state.questDone?'A lovely first day':state.greeted?'A little island offering':'A warm welcome';
    $('quest-hint').textContent=state.questDone?'Mabel is always happy to see you. Go explore!':state.greeted?(inventoryTotal()>=3?'Bring three little finds back to Mabel.':'Gather any 3 things from around the island.'):'Say hello to Mabel, then gather a few things.';
    $('day-label').textContent=`${['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'][(state.day-1)%7]} · DAY ${state.day}`;
  }
  function say(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200);}
  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function nearest(){let best=null,dist=Infinity;for(const o of objects){if(state.collected.includes(o.id))continue;const d=distance(player,o);if(d<dist&&d<74){best=o;dist=d;}}return best;}
  function interactionLabel(o){if(!o)return '';if(o.type==='npc')return 'Talk to Mabel';if(o.type==='home')return 'Go inside';if(o.type==='bench')return 'Take a rest';if(o.type==='garden')return state.inventory.seed?'Plant a seed':'Tend the garden';return `Pick up ${labels[o.type]||'item'}`;}
  function interact(){const o=nearest();if(!o)return;
    if(o.type==='npc'){talk();return;}
    if(o.type==='home'){openModal('🏡','Your cozy cottage','A little place to call your own. The kettle is warm, and the window looks out over the meadow.',[['Take a nap','sleep'],['Close','close']]);return;}
    if(o.type==='bench'){openModal('🪑','A moment to yourself','You sit for a while and listen to the breeze move through the grass. Rest restores your energy (which is mostly a feeling here).',[['Lovely','close']]);return;}
    if(o.type==='garden'){
      if(state.inventory.seed){state.inventory.seed--;state.planted++;save();say('You planted a little flower. Something lovely will grow.');}
      else say(state.planted?'Your little garden is growing happily.':'Mabel might have a seed for you.');return;
    }
    state.collected.push(o.id);state.inventory[o.type]=(state.inventory[o.type]||0)+1;save();playChime();say(`${labels[o.type]} tucked into your pocket!`);
  }
  function talk(){
    if(!state.greeted){state.greeted=true;state.inventory.seed=(state.inventory.seed||0)+1;save();openModal('🐰','Mabel says hello!','“Oh, a new face! I’m Mabel. This island is quieter than it looks—there are little treasures all over. Here, take a flower seed for your garden.”',[['I’ll explore!','close']]);return;}
    if(!state.questDone&&inventoryTotal()>=3){state.questDone=true;state.coins+=35;save();openModal('🌷','A lovely little haul','Mabel smiles at your finds. “You have a good eye! Here, a few shells for your pocket. I hope this feels like home.”',[['Thank you!','close']]);return;}
    openModal('🐰','Mabel','“The best days are the ones where nothing much happens. Have you found a favorite spot yet?”',[['Let’s chat later','close'],['Trade 3 berries · +12 shells','trade']]);
  }
  function doTrade(){if((state.inventory.berry||0)<3){closeModal();say('You need 3 blueberries to trade.');return;}state.inventory.berry-=3;state.coins+=12;save();closeModal();say('Mabel traded you 12 shells. What a deal!');}
  function openModal(icon,title,copy,actions){const card=$('modal-card');card.innerHTML=`<button class="modal-close" aria-label="Close">×</button><div class="modal-icon">${icon}</div><h2>${title}</h2><p>${copy}</p><div class="modal-actions">${actions.map(([label,action],i)=>`<button class="${i?'secondary':''}" data-action="${action}">${label}</button>`).join('')}</div>`;$('modal-backdrop').classList.add('show');card.querySelector('.modal-close').onclick=closeModal;card.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{if(b.dataset.action==='sleep')sleep();else if(b.dataset.action==='trade')doTrade();else closeModal();});}
  function closeModal(){$('modal-backdrop').classList.remove('show');}
  function sleep(){closeModal();clockMinutes=480;state.day++;player.x=790;player.y=560;objects.filter(o=>o.type==='berry'||o.type==='shell'||o.type==='flower').forEach(o=>{if(state.collected.includes(o.id))state.collected=state.collected.filter(id=>id!==o.id);});save();say('A new day, and fresh little things to find.');}
  function playChime(){if(!soundOn)return;try{audioCtx=audioCtx||new AudioContext();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.value=660;gain.gain.setValueAtTime(.08,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.35);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+.36);}catch{}}
  function path(){ctx.beginPath();ctx.moveTo(-50,506);ctx.bezierCurveTo(240,470,300,480,465,525);ctx.bezierCurveTo(590,560,660,525,790,540);ctx.bezierCurveTo(930,560,990,620,1130,600);ctx.bezierCurveTo(1270,580,1390,510,1660,550);}
  function drawWorld(){
    // Ocean and island silhouette
    ctx.fillStyle='#78bdc0';ctx.fillRect(0,0,W,H);
    for(let i=0;i<34;i++){const x=(i*167+38)%W,y=(i*293+70)%H;ctx.strokeStyle=`rgba(235,249,220,${.12+(i%3)*.035})`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+20,y-5,x+42,y+1);ctx.stroke();}
    ctx.fillStyle='#a1cf9d';ctx.beginPath();ctx.moveTo(150,0);ctx.bezierCurveTo(45,180,105,300,65,415);ctx.bezierCurveTo(10,555,90,730,40,890);ctx.bezierCurveTo(15,1005,180,1090,330,1100);ctx.lineTo(1600,1100);ctx.lineTo(1600,80);ctx.bezierCurveTo(1400,65,1340,-30,1200,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#a9d4a0';ctx.beginPath();ctx.ellipse(850,560,694,510,-.03,0,Math.PI*2);ctx.fill();
    // patches of grass
    for(let i=0;i<160;i++){const x=(i*139+83)%W,y=(i*223+41)%H;if(x<100||x>1500||y<30||y>1070)continue;ctx.fillStyle=i%3?'#8fbd88':'#b0d49e';ctx.globalAlpha=.2;ctx.beginPath();ctx.ellipse(x,y,18+(i%5)*4,8+(i%4)*2,-.4,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    // Sandy coast coves
    ctx.fillStyle='#e6d39e';ctx.beginPath();ctx.moveTo(130,660);ctx.quadraticCurveTo(185,680,255,690);ctx.quadraticCurveTo(310,720,372,755);ctx.quadraticCurveTo(430,820,480,910);ctx.quadraticCurveTo(360,875,290,840);ctx.quadraticCurveTo(205,800,145,780);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(1110,915);ctx.quadraticCurveTo(1190,845,1240,805);ctx.quadraticCurveTo(1340,745,1430,720);ctx.quadraticCurveTo(1400,830,1350,900);ctx.quadraticCurveTo(1290,980,1180,1015);ctx.closePath();ctx.fill();
    // footpaths
    ctx.lineCap='round';path();ctx.strokeStyle='#c9b986';ctx.lineWidth=92;ctx.stroke();ctx.strokeStyle='#e6d7a9';ctx.lineWidth=76;ctx.stroke();
    ctx.beginPath();ctx.moveTo(790,540);ctx.bezierCurveTo(765,420,760,350,770,260);ctx.strokeStyle='#c9b986';ctx.lineWidth=55;ctx.stroke();ctx.strokeStyle='#e6d7a9';ctx.lineWidth=43;ctx.stroke();
    ctx.beginPath();ctx.moveTo(925,610);ctx.quadraticCurveTo(930,680,940,730);ctx.strokeStyle='#c9b986';ctx.lineWidth=50;ctx.stroke();ctx.strokeStyle='#e6d7a9';ctx.lineWidth=38;ctx.stroke();
    // pond
    ctx.fillStyle='#7fc3c5';ctx.beginPath();ctx.ellipse(1370,258,145,95,-.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d9e2a6';ctx.lineWidth=10;ctx.stroke();ctx.strokeStyle='#e8f0cd';ctx.lineWidth=2;for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(1360+i*8,250+i*5,25+i*18,7+i*5,-.2,0,Math.PI*2);ctx.stroke();}
    // home + garden before trees
    drawHouse();drawGarden();
    flowers.forEach(([x,y,color],i)=>drawFlower(x,y,color,.7+(i%3)*.1));
    trees.forEach(([x,y,s],i)=>drawTree(x,y,s,i));
    objects.forEach(o=>{if(state.collected.includes(o.id))return;if(['npc','home','garden','bench'].includes(o.type))return;drawPickup(o);});
    drawBench();drawNPC();drawPlayer();
  }
  function drawTree(x,y,s,i){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#648552';ctx.globalAlpha=.18;ctx.beginPath();ctx.ellipse(5,13,39,20,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#926e4e';ctx.fillRect(-6,-18,12,30);ctx.fillStyle='#658d62';ctx.beginPath();ctx.arc(-17,-29,24,0,Math.PI*2);ctx.arc(15,-31,26,0,Math.PI*2);ctx.arc(0,-48,27,0,Math.PI*2);ctx.fill();ctx.fillStyle=i%3===0?'#84aa70':'#91b97c';ctx.beginPath();ctx.arc(-13,-38,17,0,Math.PI*2);ctx.arc(12,-48,17,0,Math.PI*2);ctx.arc(4,-22,14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f0dfa0';ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(-20,-48,4,0,Math.PI*2);ctx.arc(10,-61,3,0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawFlower(x,y,color,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#56875f';ctx.fillRect(-1,0,2,9);ctx.fillStyle=color;for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.arc(Math.cos(a)*4,Math.sin(a)*4,3.2,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#e9b65a';ctx.beginPath();ctx.arc(0,0,2.4,0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawHouse(){ctx.save();ctx.translate(740,253);ctx.fillStyle='#738456';ctx.globalAlpha=.2;ctx.beginPath();ctx.ellipse(0,40,77,32,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#f0d7a8';ctx.fillRect(-54,-16,108,68);ctx.fillStyle='#c97562';ctx.beginPath();ctx.moveTo(-70,-12);ctx.lineTo(0,-65);ctx.lineTo(70,-12);ctx.closePath();ctx.fill();ctx.fillStyle='#e69a72';ctx.beginPath();ctx.moveTo(-70,-12);ctx.lineTo(0,-65);ctx.lineTo(-2,-12);ctx.closePath();ctx.fill();ctx.fillStyle='#dcae77';ctx.fillRect(-14,14,28,38);ctx.fillStyle='#7b9b8a';ctx.fillRect(-43,2,17,19);ctx.fillRect(27,2,17,19);ctx.strokeStyle='#fff0c8';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-34,3);ctx.lineTo(-34,21);ctx.moveTo(27,11);ctx.lineTo(44,11);ctx.stroke();ctx.fillStyle='#f0dfa6';ctx.fillRect(31,-54,13,28);ctx.fillStyle='#fff2ca';ctx.font='11px DM Sans';ctx.textAlign='center';ctx.fillText('HOME',0,72);ctx.restore();}
  function drawGarden(){ctx.save();ctx.translate(935,678);ctx.fillStyle='#90775a';ctx.beginPath();ctx.roundRect(-41,-22,82,44,12);ctx.fill();ctx.fillStyle='#b49b6a';ctx.beginPath();ctx.roundRect(-36,-17,72,34,10);ctx.fill();for(let i=0;i<Math.max(3,state.planted);i++){drawFlower(-20+(i%4)*13,-4+Math.floor(i/4)*9,'#f0a7a0',.7);}ctx.restore();}
  function drawPickup(o){ctx.save();ctx.translate(o.x,o.y);ctx.fillStyle='#405542';ctx.globalAlpha=.15;ctx.beginPath();ctx.ellipse(0,8,14,6,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;if(o.type==='berry'){ctx.fillStyle='#547d54';ctx.beginPath();ctx.ellipse(0,-4,12,9,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#466f4a';ctx.beginPath();ctx.ellipse(-5,-1,8,7,-.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#729451';ctx.beginPath();ctx.arc(-5,-14,2,0,Math.PI*2);ctx.arc(4,-12,2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#728e55';ctx.beginPath();ctx.arc(1,-12,2,0,Math.PI*2);ctx.fill();}else if(o.type==='shell'){ctx.fillStyle='#efcba7';ctx.beginPath();ctx.ellipse(0,1,12,8,-.25,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d59e82';ctx.lineWidth=1;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(0,1);ctx.quadraticCurveTo(i*5,-5,i*7,-6);ctx.stroke();}}else if(o.type==='flower'){drawFlower(0,-5,'#f0a7a0',1.25);}else if(o.type==='seed'){ctx.fillStyle='#826c4d';ctx.beginPath();ctx.ellipse(0,0,7,10,-.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9bb477';ctx.beginPath();ctx.ellipse(-3,-8,4,8,-.8,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function drawNPC(){ctx.save();ctx.translate(825,438);ctx.fillStyle='#405542';ctx.globalAlpha=.15;ctx.beginPath();ctx.ellipse(0,11,15,7,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#ead6bb';ctx.beginPath();ctx.ellipse(0,-2,13,15,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(-6,-23,4,13,-.2,0,Math.PI*2);ctx.ellipse(6,-23,4,13,.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ddaaa0';ctx.beginPath();ctx.ellipse(-6,-22,1.8,8,0,0,Math.PI*2);ctx.ellipse(6,-22,1.8,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4b4c42';ctx.beginPath();ctx.arc(-4,-4,1.5,0,Math.PI*2);ctx.arc(4,-4,1.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#bd796b';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,3,0,Math.PI);ctx.stroke();ctx.fillStyle='#a6bf9a';ctx.beginPath();ctx.ellipse(0,7,11,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff4d8';ctx.font='10px DM Sans';ctx.textAlign='center';ctx.fillText('Mabel',0,-44);ctx.restore();}
  function drawBench(){ctx.save();ctx.translate(1060,500);ctx.fillStyle='#4c684b';ctx.globalAlpha=.18;ctx.beginPath();ctx.ellipse(0,10,26,9,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#9e7554';ctx.fillRect(-24,-8,48,8);ctx.fillRect(-24,-18,48,8);ctx.fillStyle='#785b44';ctx.fillRect(-20,-2,5,16);ctx.fillRect(15,-2,5,16);ctx.restore();}
  function drawPlayer(){ctx.save();ctx.translate(player.x,player.y);ctx.fillStyle='#405542';ctx.globalAlpha=.18;ctx.beginPath();ctx.ellipse(0,10,13,7,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;const bounce=player.moving?Math.sin(player.walk)*2:0;ctx.translate(0,bounce);ctx.fillStyle='#d89d78';ctx.beginPath();ctx.arc(0,-8,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#526e57';ctx.beginPath();ctx.arc(0,-12,11,Math.PI,Math.PI*2);ctx.lineTo(10,-6);ctx.lineTo(-9,-7);ctx.closePath();ctx.fill();ctx.fillStyle='#f0e2bd';ctx.beginPath();ctx.ellipse(0,5,10,11,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5e765e';ctx.fillRect(-8,13,6,5);ctx.fillRect(3,13,6,5);ctx.fillStyle='#39453d';ctx.beginPath();ctx.arc(player.dir===1?4:-3,-8,1.2,0,Math.PI*2);ctx.fill();ctx.restore();}
  function camera(){return {x:Math.max(0,Math.min(W-vw,player.x-vw/2)),y:Math.max(0,Math.min(H-vh,player.y-vh/2))};}
  function tick(now){const dt=Math.min(.04,(now-last)/1000);last=now;if(gameStarted&&!$('modal-backdrop').classList.contains('show'))move(dt);clockMinutes+=dt*1.1;if(clockMinutes>=1200){clockMinutes=480;state.day++;}draw();updateClock();requestAnimationFrame(tick);}
  function move(dt){let dx=0,dy=0;if(keys.has('ArrowLeft')||keys.has('a')||keys.has('left'))dx--;if(keys.has('ArrowRight')||keys.has('d')||keys.has('right'))dx++;if(keys.has('ArrowUp')||keys.has('w')||keys.has('up'))dy--;if(keys.has('ArrowDown')||keys.has('s')||keys.has('down'))dy++;const mag=Math.hypot(dx,dy);player.moving=!!mag;if(mag){dx/=mag;dy/=mag;const speed=190;player.x=Math.max(150,Math.min(1490,player.x+dx*speed*dt));player.y=Math.max(105,Math.min(1010,player.y+dy*speed*dt));player.dir=dx>=0?1:-1;player.walk+=dt*12;}}
  function draw(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,vw,vh);const c=camera();ctx.save();ctx.translate(-c.x,-c.y);drawWorld();ctx.restore();const o=nearest(), el=$('interaction');if(o&&gameStarted&&!$('modal-backdrop').classList.contains('show')){el.classList.add('show');$('interaction-label').textContent=interactionLabel(o);el.style.left=`${Math.max(95,Math.min(vw-95,player.x-c.x))}px`;el.style.top=`${Math.max(80,player.y-c.y-57)}px`;}else el.classList.remove('show');const loc=player.y>780?'SEASHELL COVE':player.x>1120?'POND PATH':player.y<360?'COTTAGE LANE':'CLOVER MEADOW';$('location').textContent=loc;}
  function updateClock(){const m=Math.floor(clockMinutes),h=Math.floor(m/60),mm=m%60;$('clock').textContent=`${String(h%12||12).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
  addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();if(key==='e'||key===' '){if(!$('modal-backdrop').classList.contains('show'))interact();return;}if(key==='escape')closeModal();keys.add(key);});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  document.querySelectorAll('[data-dir]').forEach(btn=>{const dir=btn.dataset.dir;btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);keys.add(dir);});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,()=>keys.delete(dir)));});$('touch-use').addEventListener('pointerdown',e=>{e.preventDefault();interact();});
  $('start-btn').onclick=()=>{gameStarted=true;$('welcome').classList.add('hidden');say('The island is yours. Take it slow.');};$('quest-toggle').onclick=()=>{$('quest-card').classList.toggle('collapsed');$('quest-toggle').textContent=$('quest-card').classList.contains('collapsed')?'+':'−';};$('sound-btn').onclick=()=>{soundOn=!soundOn;$('sound-btn').innerHTML=`♫ <span>sound ${soundOn?'on':'off'}</span>`;if(soundOn)playChime();};$('modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop')closeModal();});
  updateUI();clockMinutes=state.time||480;requestAnimationFrame(tick);
})();
