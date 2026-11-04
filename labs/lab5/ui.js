(function(){
'use strict';
const E=ScadaEngine,S=E.create();
const $=id=>document.getElementById(id),css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const f1=(x,d=1)=>Number(x).toFixed(d);
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
let running=true,sel='TT101',lastReal=performance.now(),acc=0;
function toast(m){const t=$('toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',3500)}
function fmtT(s){s=Math.floor(s);return String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function val(g,d=1){if(g.q==='bad')return '???';if(g.type==='di')return g.val?'ON':'OFF';return f1(g.val,d)}
function setup(c){const r=c.getBoundingClientRect();const k=devicePixelRatio||1;if(r.width<10)return null;c.width=Math.round(r.width*k);c.height=Math.round(c.getAttribute('height')*r.width/c.getAttribute('width')*k);const g=c.getContext('2d');g.setTransform(k,0,0,k,0,0);return{g,w:r.width,h:c.height/k}}
function axes(g,w,h,m,x0,x1,y0,y1,nx,ny,xl){
  g.strokeStyle=css('--bd');g.fillStyle=css('--mut');g.font='11px system-ui';g.lineWidth=1;g.textAlign='right';
  for(let i=0;i<=ny;i++){const v=y0+(y1-y0)*i/ny,y=h-m.b-(h-m.t-m.b)*i/ny;g.beginPath();g.moveTo(m.l,y);g.lineTo(w-m.r,y);g.stroke();g.fillText(f1(v,y1-y0<8?1:0),m.l-4,y+4)}
  g.textAlign='center';for(let i=0;i<=nx;i++){const v=x0+(x1-x0)*i/nx,x=m.l+(w-m.l-m.r)*i/nx;g.fillText(xl(v),x,h-m.b+14)}}
/* tabs */
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('main>section').forEach(s=>s.classList.toggle('on',s.id===b.dataset.t));draw(true)});
$('run').onclick=()=>{running=true;lastReal=performance.now()};$('pause').onclick=()=>{running=false};
$('rst').onclick=()=>{S.reset();S.raw=S.raw;buildFace();$('ta').value=20;document.querySelectorAll('[data-f]').forEach(c=>c.checked=false);$('supp').checked=false;draw(true)};

/* ---------- 1. sinoptic ---------- */
const BOX=[['TT101',365,150],['SP101',365,100],['LT101',365,230],['FT101',300,6],['PT101',545,290],['HTR101',195,350],['P101',20,345],['FLARE101',690,115],['TRIP101',365,300]];
const tb=$('tb');
BOX.forEach(([n,x,y])=>{const g=S.tag(n);const e=document.createElementNS('http://www.w3.org/2000/svg','g');e.setAttribute('class','tagbox');e.setAttribute('data-n',n);e.setAttribute('transform','translate('+x+','+y+')');
  e.innerHTML='<rect width="100" height="40" rx="5"/><text class="nm" x="6" y="13">'+n+'</text><text class="v" x="6" y="32"></text>';e.onclick=()=>{sel=n;buildFace();draw(true)};tb.appendChild(e)});
function alarmOf(n){let w=null;for(const a of S.alarmList())if(a.tag===n&&(!w||a.pr<w.pr))w=a;return w}
function updSyn(){
  $('lvl').setAttribute('y',327-2.57*S.L);$('lvl').setAttribute('height',2.57*S.L);
  $('coil').setAttribute('stroke',S.htr?'var(--bad)':'var(--mut)');
  $('pump').setAttribute('fill',S.pump?'var(--ok)':'var(--svgbg)');$('pf').setAttribute('opacity',S.pump?1:0);
  $('gas').setAttribute('y',268-68*S.P/40);$('gas').setAttribute('height',68*S.P/40);
  $('flame').setAttribute('opacity',S.flare?1:0);
  tb.querySelectorAll('.tagbox').forEach(e=>{const n=e.dataset.n,g=S.tag(n),a=alarmOf(n);
    e.setAttribute('class','tagbox q-'+g.q+(n===sel?' sel':'')+(a?' a'+a.pr:'')+(a&&a.st==='A'?' blink':''));
    e.querySelector('.v').textContent=val(g)+(g.unit||g.u?' '+g.u:'')});
}
function alTable(){
  const L=S.alarmList();$('alcnt').textContent='· active: '+L.length+' · ultimele 10 min: '+S.alarmHist.length+' (țintă ≤ 2)';
  $('altab').innerHTML='<tr><th>P</th><th>Ora</th><th>Tag</th><th>Alarmă</th><th>Val.</th><th>Stare</th><th></th></tr>'+(L.length?L.map(a=>'<tr class="'+(a.st==='A'||a.st==='R'?'unack':'')+'"><td class="pri'+a.pr+'">'+a.pr+'</td><td>'+fmtT(a.t0)+'</td><td>'+a.key+'</td><td>'+esc(a.text)+'</td><td>'+f1(a.val)+' '+a.u+'</td><td>'+({A:'activă, neconf.',AA:'activă, confirmată',R:'revenită, neconf.'}[a.st])+'</td><td>'+(a.st!=='AA'?'<button class="b s" data-ack="'+a.key+'">Conf.</button>':'')+'</td></tr>').join(''):'<tr><td colspan="7" class="mut">Nicio alarmă activă</td></tr>');
  $('altab').querySelectorAll('[data-ack]').forEach(b=>b.onclick=()=>{S.ack(b.dataset.ack);draw(true)});
}
$('ackall').onclick=()=>{S.ackAll();draw(true)};
$('supp').onchange=e=>{S.suppressLow=e.target.checked;if(S.suppressLow)delete S.alarms['TT101.L']};
document.querySelectorAll('[data-f]').forEach(c=>c.onchange=()=>{S.faults[c.dataset.f]=c.checked});
$('ta').oninput=e=>{S.Ta=+e.target.value;$('v_ta').textContent=S.Ta+' °C'};
function buildFace(){
  const g=S.tag(sel);let h='<div class="kv"><div><span>'+g.n+'</span><b id="fv"></b></div><div><span>Calitate / vârstă</span><b id="fq"></b></div></div><div class="mut" style="font-size:13px">'+g.d+' · sursă '+g.dev+'</div>';
  if(g.type==='ai'){h+='<table style="margin-top:8px"><tr><th>Limită</th><th>Valoare</th></tr>'+['LL','L','H','HH'].map(k=>'<tr><td>'+k+'</td><td><input type="number" step="any" style="width:90px" data-al="'+k+'" value="'+(g.al[k]!==undefined?g.al[k]:'')+'" placeholder="–"></td></tr>').join('')+'<tr><td>bandă moartă ('+g.u+')</td><td><input type="number" step="any" style="width:90px" data-al="db" value="'+(g.al.db||0)+'"></td></tr><tr><td>întârziere (s)</td><td><input type="number" step="1" style="width:90px" data-al="delay" value="'+(g.al.delay||0)+'"></td></tr></table><small>LL/L sunt limite inferioare, H/HH superioare. Alarma revine când valoarea depășește limita cu banda moartă.</small>'}
  if(g.n==='SP101')h+='<div class="inl" style="margin-top:8px"><input type="number" id="spin" value="'+S.SP+'" step="0.5" style="width:90px"><button class="b s" id="spw">Scrie consemn</button></div><small>Se scrie prin Modbus FC06 în HR0 (×10). Domeniul acceptat: 15…60 °C.</small>';
  if(g.n==='HTR101'||g.n==='P101'){const heat=g.n==='HTR101';h+='<div class="inl" style="margin-top:8px"><select id="md" style="width:auto"><option value="auto">AUTO (reglare locală)</option><option value="man">MANUAL</option></select><button class="b s n" id="mc">Comandă ON/OFF</button></div><small>În manual, comanda se transmite prin FC05. Termostatul de siguranță oprește oricum încălzitorul la 48 °C.</small>';}
  $('face').innerHTML=h;
  $('face').querySelectorAll('[data-al]').forEach(i=>i.onchange=()=>{const k=i.dataset.al;if(i.value==='')delete g.al[k];else g.al[k]=+i.value});
  if($('spw'))$('spw').onclick=()=>{const r=S.write('SP101',+$('spin').value);if(!r.ok)toast('Scriere eșuată: '+r.err)};
  if($('md')){const heat=g.n==='HTR101';$('md').value=heat?S.htrMode:S.pumpMode;$('md').onchange=e=>{const r=S.write(g.n,e.target.value);if(!r.ok){toast('Scriere eșuată: '+r.err);$('md').value=heat?S.htrMode:S.pumpMode;return}if(heat)S.htrMode=e.target.value;else S.pumpMode=e.target.value};
    $('mc').onclick=()=>{const r=S.write(g.n,'cmd');if(!r.ok){toast('Scriere eșuată: '+r.err);return}if(heat){S.htrMan=!S.htrMan;if(S.htrMode!=='man'){S.htrMode='man';$('md').value='man'}}else{S.pumpMan=!S.pumpMan;if(S.pumpMode!=='man'){S.pumpMode='man';$('md').value='man'}}}}
}
function updFace(){const g=S.tag(sel);$('fv').textContent=val(g,2)+' '+(g.u||'');$('fq').innerHTML='<span class="'+({good:'ok',stale:'warn',bad:'bad'}[g.q])+'">'+g.q+'</span> · '+(g.age==null?'–':f1(g.age,1)+' s')}
function trend(){
  const o=setup($('trend'));if(!o)return;const{g,w,h}=o;g.clearRect(0,0,w,h);const m={l:42,r:40,t:10,b:22};
  const W=+$('trw').value,R=S.raw,n=R.t.length;if(n<2)return;const t1=R.t[n-1],t0=Math.max(0,t1-W);
  let i0=0;while(i0<n&&R.t[i0]<t0)i0++;
  const grp=$('trg').value;const cfg={T:{a:['TT101',15,55,'--bad'],b:['SP101',15,55,'--warn']},L:{a:['LT101',0,100,'--ac']},P:{a:['PT101',0,40,'--ac'],b:['FT101',0,15,'--ok']}}[grp];
  const [na,la,ha]=cfg.a;axes(g,w,h,m,t0,t0+W,la,ha,6,5,v=>Math.round(v/60)+'m');
  const X=t=>m.l+(w-m.l-m.r)*(t-t0)/W;
  const draw1=(nm,lo,hi,col,right)=>{const Y=v=>h-m.b-(h-m.t-m.b)*(Math.max(lo,Math.min(hi,v))-lo)/(hi-lo);g.strokeStyle=css(col);g.lineWidth=1.8;g.beginPath();for(let i=i0;i<n;i++){const x=X(R.t[i]),y=Y(R[nm][i]);i===i0?g.moveTo(x,y):g.lineTo(x,y)}g.stroke();if(right){g.fillStyle=css(col);g.textAlign='left';for(let i=0;i<=5;i++)g.fillText(f1(lo+(hi-lo)*i/5,0),w-m.r+4,h-m.b-(h-m.t-m.b)*i/5+4)}};
  const ya=v=>h-m.b-(h-m.t-m.b)*(Math.max(la,Math.min(ha,v))-la)/(ha-la);
  const tg=S.tag(na);g.setLineDash([4,4]);for(const k of ['LL','L','H','HH'])if(tg.al[k]!==undefined&&tg.al[k]>=la&&tg.al[k]<=ha){g.strokeStyle=css(k.length===2?'--bad':'--warn');g.lineWidth=1;g.beginPath();g.moveTo(m.l,ya(tg.al[k]));g.lineTo(w-m.r,ya(tg.al[k]));g.stroke()}g.setLineDash([]);
  draw1(na,la,ha,cfg.a[3],false);if(cfg.b)draw1(cfg.b[0],cfg.b[1],cfg.b[2],cfg.b[3],grp==='P');
  g.fillStyle=css('--mut');g.textAlign='left';g.fillText(na+(cfg.b?' / '+cfg.b[0]:'')+'  (linii punctate: limite de alarmă)',m.l+4,m.t+10);
}

/* ---------- 2. rețea ---------- */
function devUI(){
  $('devs').innerHTML=S.devs.map(d=>'<div class="row"><label><span><b>'+d.id+'</b> '+d.name.split('·')[1]+'</span><b id="dp_'+d.id+'"></b></label><div class="inl"><span class="mut" style="font-size:12px">scan</span><input type="range" min="100" max="5000" step="100" value="'+d.scan+'" data-sc="'+d.id+'" style="flex:1"><b id="ds_'+d.id+'">'+d.scan+' ms</b></div></div>').join('');
  $('devs').querySelectorAll('[data-sc]').forEach(i=>i.oninput=()=>{const d=S.devs.find(x=>x.id===i.dataset.sc);d.scan=+i.value;$('ds_'+d.id).textContent=d.scan+' ms'});
}
const bind=(id,fn)=>{$(id).oninput=()=>fn(+$(id).value)};
$('baud').onchange=e=>{S.bus.baud=+e.target.value};bind('ex',v=>{S.bus.extra=v;$('v_ex').textContent=v});bind('to',v=>{S.bus.timeout=v;$('v_to').textContent=v+' ms'});bind('rt',v=>{S.bus.retries=v;$('v_rt').textContent=v});
function updNet(){
  S.devs.forEach(d=>{const e=$('dp_'+d.id);if(e)e.innerHTML='<span class="'+(d.err>=3?'bad':d.err>0?'warn':'ok')+'">'+(d.err>=3?'FĂRĂ RĂSPUNS':d.err>0?'eroare':'OK')+'</span> · perioadă '+Math.round((d.period||d.scan/1000)*1000)+' ms · cereri '+d.tx});
  const cyc=S.bus.cycle,ld=S.bus.load;
  $('busout').innerHTML='<div><span>Timp ciclu</span><b>'+f1(cyc,0)+' ms</b></div><div><span>Încărcare magistrală</span><b class="'+(ld>0.8?'bad':ld>0.5?'warn':'ok')+'">'+f1(ld*100,0)+' %</b></div><div><span>Tranzacție n=5</span><b>'+f1(((8+5+10)*11/S.bus.baud*1000)+8,1)+' ms</b></div><div><span>Disponibilitate RTU1 / RTU2</span><b>'+['RTU1','RTU2'].map(k=>{const a=S.devAvail&&S.devAvail[k];return a&&a[1]?f1(100*a[0]/a[1],0)+'%':'–'}).join(' / ')+'</b></div>';
  $('qtab').innerHTML='<tr><th>Tag</th><th>Sursă</th><th>Valoare</th><th>Calitate</th><th>Vârstă</th></tr>'+S.tags.map(g=>'<tr><td>'+g.n+'</td><td>'+g.dev+'</td><td>'+val(g,2)+' '+g.u+'</td><td class="'+({good:'ok',stale:'warn',bad:'bad'}[g.q])+'">'+g.q+'</td><td>'+(g.age==null?'–':f1(g.age,1)+' s')+'</td></tr>').join('');
  $('frames').textContent=S.log.slice(0,14).join('\n');
}

/* ---------- 3. editor ---------- */
let W=[],mode='edit',selW=null,wid=1;
try{const j=localStorage.getItem('aspi_l5_screen');if(j)W=JSON.parse(j)}catch(e){}
W.forEach(w=>{wid=Math.max(wid,w.id+1)});
const save=()=>{try{localStorage.setItem('aspi_l5_screen',JSON.stringify(W))}catch(e){}};
const TAGS=S.tags.map(t=>t.n);
const tagOpts=cur=>'<option value="">(nelegat)</option>'+TAGS.map(n=>'<option'+(n===cur?' selected':'')+'>'+n+'</option>').join('');
const DEF={text:{text:'Titlu'},value:{tag:'',label:''},bar:{tag:''},lamp:{tag:''},alarm:{tag:''},setp:{tag:''},btn:{tag:'',label:'Buton',act:'ackall'}};
function addW(type,x,y,extra){const w=Object.assign({id:wid++,type,x:x??30+(W.length%6)*20,y:y??30+(W.length%6)*24},JSON.parse(JSON.stringify(DEF[type])),extra||{});W.push(w);selW=w.id;save();return w}
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{addW(b.dataset.add);renderEd();props()});
$('mEdit').onclick=()=>{mode='edit';renderEd()};$('mRun').onclick=()=>{mode='run';renderEd()};
$('edClr').onclick=()=>{W=[];selW=null;save();renderEd();props()};
$('edEx').onclick=()=>{W=[];wid=1;addW('text',20,14,{text:'Fermentator – ecran operator'});addW('value',30,60,{tag:'TT101',label:'Temperatură'});addW('value',30,100,{tag:'FT101',label:'Debit biogaz'});addW('bar',250,50,{tag:'LT101'});addW('lamp',320,60,{tag:'HTR101'});addW('text',350,62,{text:'Încălzitor'});addW('alarm',30,150,{tag:'TT101'});addW('setp',30,200,{tag:'SP101'});addW('btn',30,260,{label:'Confirmă toate',act:'ackall'});selW=null;save();renderEd();props()};
$('edExp').onclick=()=>{$('edjson').value=JSON.stringify(W)};
$('edImp').onclick=()=>{try{const a=JSON.parse($('edjson').value);if(!Array.isArray(a))throw 0;W=a;wid=Math.max(0,...W.map(w=>w.id))+1;selW=null;save();renderEd();props()}catch(e){toast('JSON invalid')}};
function wHTML(w){
  const g=w.tag?S.tag(w.tag):null;const unb=(['value','bar','lamp','setp','alarm'].includes(w.type))&&!g;
  switch(w.type){
   case'text':return esc(w.text);
   case'value':return (w.label?esc(w.label)+': ':'')+(g?'<b>'+val(g,1)+' '+(g.u||'')+'</b>':'<i>nelegat</i>');
   case'bar':return g?'<i style="height:'+(g.q==='bad'?0:Math.max(0,Math.min(100,100*(g.val-g.lo)/(g.hi-g.lo))))+'%;background:'+(alarmOf(g.n)?(alarmOf(g.n).pr===1?'var(--bad)':'var(--warn)'):'var(--liq)')+'"></i>':'<small>nelegat</small>';
   case'lamp':return '';
   case'alarm':return g?(alarmOf(g.n)?'<span class="pri'+alarmOf(g.n).pr+'">● ALARMĂ '+g.n+'</span>':'<span class="mut">○ '+g.n+' normal</span>'):'<i>nelegat</i>';
   case'setp':return g?esc(g.n)+' <input type="number" step="0.5" style="width:70px" value="'+S.SP+'" '+(mode==='edit'?'disabled':'')+'> <button class="b s" '+(mode==='edit'?'disabled':'')+'>OK</button>':'<i>nelegat</i>';
   case'btn':return '<button class="b s" '+(mode==='edit'?'disabled':'')+'>'+esc(w.label)+'</button>';
  }
}
function renderEd(){
  const ed=$('ed');ed.innerHTML='';
  $('mEdit').className='b'+(mode==='edit'?'':' n');$('mRun').className='b'+(mode==='run'?'':' n');
  W.forEach(w=>{const e=document.createElement('div');const g=w.tag?S.tag(w.tag):null;
    e.className='w'+(w.type==='lamp'?' lamp':'')+(w.type==='bar'?' barw':'')+(mode==='edit'?' edit':'')+(w.id===selW&&mode==='edit'?' sel':'')+((['value','bar','lamp','setp','alarm'].includes(w.type)&&!g)?' unb':'');
    e.style.left=w.x+'px';e.style.top=w.y+'px';e.dataset.id=w.id;e.innerHTML=wHTML(w);
    if(w.type==='lamp'&&g){e.style.background=(g.q!=='bad'&&g.val)?'var(--ok)':'var(--svgbg)'}
    if(mode==='edit'){let d=null;e.onpointerdown=ev=>{selW=w.id;d={x:ev.clientX-w.x,y:ev.clientY-w.y};e.setPointerCapture(ev.pointerId);props();ed.querySelectorAll('.w').forEach(x=>x.classList.toggle('sel',+x.dataset.id===w.id))};
      e.onpointermove=ev=>{if(!d)return;w.x=Math.max(0,Math.min(ed.clientWidth-30,Math.round((ev.clientX-d.x)/10)*10));w.y=Math.max(0,Math.min(ed.clientHeight-20,Math.round((ev.clientY-d.y)/10)*10));e.style.left=w.x+'px';e.style.top=w.y+'px'};
      e.onpointerup=()=>{d=null;save()}}
    else{
      if(w.type==='setp'){const b=e.querySelector('button'),i=e.querySelector('input');if(b)b.onclick=()=>{const r=S.write(w.tag,+i.value);if(!r.ok)toast('Scriere eșuată: '+r.err);else toast('Consemn scris: '+i.value+' °C')}}
      if(w.type==='btn'){const b=e.querySelector('button');b.onclick=()=>{if(w.act==='ackall'){S.ackAll()}else if(w.act==='sp+'){S.write('SP101',S.SP+1)}else if(w.act==='sp-'){S.write('SP101',S.SP-1)}}}}
    ed.appendChild(e)});
}
function liveEd(){ // actualizare valori în modul rulare (fără a reconstrui câmpurile de editare)
  if(mode!=='run')return;const ed=$('ed');
  W.forEach(w=>{if(!['value','bar','lamp','alarm'].includes(w.type))return;const e=ed.querySelector('[data-id="'+w.id+'"]');if(!e)return;const g=w.tag?S.tag(w.tag):null;
    if(w.type==='lamp'){if(g)e.style.background=(g.q!=='bad'&&g.val)?'var(--ok)':'var(--svgbg)'}else e.innerHTML=wHTML(w)});
}
function props(){
  const w=W.find(x=>x.id===selW);if(!w||mode!=='edit'){$('props').innerHTML='<span class="mut">Selectați un element în modul Editare.</span>';return}
  let h='<div class="row"><label>Tip <b>'+w.type+'</b></label></div>';
  if(w.type==='text')h+='<div class="row"><label>Text</label><input type="text" id="pp_text" value="'+esc(w.text)+'"></div>';
  if(['value','bar','lamp','setp','alarm'].includes(w.type))h+='<div class="row"><label>Tag asociat</label><select id="pp_tag">'+tagOpts(w.tag)+'</select></div>';
  if(w.type==='value')h+='<div class="row"><label>Etichetă</label><input type="text" id="pp_label" value="'+esc(w.label||'')+'"></div>';
  if(w.type==='btn')h+='<div class="row"><label>Text buton</label><input type="text" id="pp_label" value="'+esc(w.label)+'"></div><div class="row"><label>Acțiune</label><select id="pp_act"><option value="ackall">Confirmă toate alarmele</option><option value="sp+">Consemn +1 °C</option><option value="sp-">Consemn −1 °C</option></select></div>';
  h+='<div class="row"><button class="b r s" id="pp_del">Șterge elementul</button></div>';
  $('props').innerHTML=h;
  const up=(id,k)=>{const e=$(id);if(e)e.oninput=e.onchange=()=>{w[k]=e.value;save();renderEd()}};up('pp_text','text');up('pp_tag','tag');up('pp_label','label');up('pp_act','act');if($('pp_act'))$('pp_act').value=w.act;
  $('pp_del').onclick=()=>{W=W.filter(x=>x!==w);selW=null;save();renderEd();props()};
}
function check(){
  const has=(t,f)=>W.some(w=>w.type===t&&(!f||f(w)));
  const items=[
   ['Cel puțin o valoare numerică legată de un tag',has('value',w=>S.tag(w.tag))],
   ['O bară legată de LT101',has('bar',w=>w.tag==='LT101')],
   ['O lampă legată de HTR101 sau P101',has('lamp',w=>w.tag==='HTR101'||w.tag==='P101')],
   ['Un indicator de alarmă legat de un tag analogic cu limite',has('alarm',w=>{const g=S.tag(w.tag);return g&&g.type==='ai'})],
   ['Un câmp de consemn legat de SP101',has('setp',w=>w.tag==='SP101')],
   ['Un buton de confirmare a alarmelor',has('btn',w=>w.act==='ackall')],
   ['Niciun element nelegat (cu roșu)',W.length>0&&W.every(w=>!['value','bar','lamp','setp','alarm'].includes(w.type)||S.tag(w.tag))],
   ['Ecranul are un titlu (text)',has('text')]];
  $('chk').innerHTML=items.map(([t,y])=>'<li class="'+(y?'y':'')+'">'+t+'</li>').join('');return items;
}
$('chkb').onclick=check;

/* ---------- 4. istoric ---------- */
const PARAM={periodic:{l:'Perioadă (s)',min:1,max:300,u:'s',f:v=>v},deadband:{l:'Bandă moartă',min:0.01,max:2,u:'',f:v=>v},swing:{l:'Toleranță',min:0.01,max:2,u:'',f:v=>v}};
function hpVal(){const m=$('hm').value;const s=+$('hp').value/100;return m==='periodic'?Math.round(1+s*299):+(0.01+s*s*1.99).toFixed(3)}
let hcache=null;
function hist(){
  const R=S.raw,n=R.t.length;$('hpl').textContent=PARAM[$('hm').value].l;const p=hpVal();$('v_hp').textContent=p+(PARAM[$('hm').value].u?' s':'');
  const o=setup($('hist'));if(!o)return;const{g,w,h}=o;g.clearRect(0,0,w,h);
  if(n<30){g.fillStyle=css('--mut');g.font='14px system-ui';g.fillText('Rulați simularea pentru a aduna date (minim 30 s).',20,40);$('hout').innerHTML='';return}
  const tag=$('hg').value,v=R[tag],t=R.t;const c=E.compress(t,v,$('hm').value,p);
  let lo=Infinity,hi=-Infinity;for(const x of v){lo=Math.min(lo,x);hi=Math.max(hi,x)}const pad=(hi-lo)*0.1||1;lo-=pad;hi+=pad;
  const m={l:46,r:10,t:10,b:22};axes(g,w,h,m,t[0],t[n-1],lo,hi,6,5,x=>Math.round(x/60)+'m');
  const X=x=>m.l+(w-m.l-m.r)*(x-t[0])/(t[n-1]-t[0]||1),Y=y=>h-m.b-(h-m.t-m.b)*(y-lo)/(hi-lo);
  g.strokeStyle=css('--mut');g.lineWidth=1;g.globalAlpha=.6;g.beginPath();for(let i=0;i<n;i++){i?g.lineTo(X(t[i]),Y(v[i])):g.moveTo(X(t[i]),Y(v[i]))}g.stroke();g.globalAlpha=1;
  g.strokeStyle=css('--ac');g.lineWidth=2.4;g.beginPath();for(let i=0;i<n;i++){i?g.lineTo(X(t[i]),Y(c.rec[i])):g.moveTo(X(t[i]),Y(c.rec[i]))}g.stroke();
  g.fillStyle=css('--bad');const step=Math.ceil(c.idx.length/250);c.idx.forEach((i,k)=>{if(k%step===0){g.beginPath();g.arc(X(t[i]),Y(c.vals[k]),2.6,0,7);g.fill()}});
  $('hout').innerHTML='<div><span>Eșantioane brute</span><b>'+n+'</b></div><div><span>Puncte arhivate</span><b>'+c.idx.length+'</b></div><div><span>Raport compresie</span><b>'+f1(c.ratio,1)+' : 1</b></div><div><span>Eroare maximă</span><b>'+f1(c.maxErr,3)+'</b></div>';
  hcache={tag,t,c};
  // raport
  const inb=(()=>{let k=-1;for(let i=0;i<n;i++)if(Math.abs(R.TT101[i]-R.SP101[i])<=1){k=i;break}if(k<0)return null;let ok=0;for(let i=k;i<n;i++)if(Math.abs(R.TT101[i]-R.SP101[i])<=1)ok++;return 100*ok/(n-k)})();
  const hOn=R.htr.reduce((a,b)=>a+b,0);
  const byp=[1,2].map(p=>Object.values(S.alarms).length);
  $('rep').innerHTML='<div><span>Durata înregistrată</span><b>'+fmtT(S.t)+'</b></div><div><span>Biogaz produs</span><b>'+f1(S.vol,2)+' m³</b></div><div><span>Energie încălzitor</span><b>'+f1(S.htrE,2)+' kWh</b></div><div><span>Timp în banda ±1 °C</span><b>'+(inb==null?'–':f1(inb,0)+' %')+'</b></div><div><span>Alarme (total)</span><b>'+S.events.filter(e=>e.includes('ALARMĂ')).length+'</b></div><div><span>T medie</span><b>'+f1(R.TT101.reduce((a,b)=>a+b,0)/n,1)+' °C</b></div><div><span>Comutări încălzitor</span><b>'+R.htr.reduce((a,b,i,A)=>a+(i&&b!==A[i-1]?1:0),0)+'</b></div><div><span>Disponibilitate RTU1</span><b>'+(S.devAvail?f1(100*S.devAvail.RTU1[0]/S.devAvail.RTU1[1],0)+' %':'–')+'</b></div>';
}
['hg','hm'].forEach(i=>$(i).onchange=()=>{hist()});$('hp').oninput=hist;
function dl(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'text/plain;charset=utf-8'}));a.download=name;a.click()}
$('dlcsv').onclick=()=>{if(!hcache){toast('Nu există date');return}const{tag,t,c}=hcache;dl('istoric_'+tag+'.csv','timp_s;'+tag+'\n'+c.idx.map((i,k)=>t[i]+';'+c.vals[k].toFixed(3)).join('\n'),'text/csv')};
function reportTxt(){return 'RAPORT DE TURĂ – Lucrarea 5 SCADA\nDurata: '+fmtT(S.t)+'\nBiogaz: '+f1(S.vol,2)+' m3\nEnergie încălzitor: '+f1(S.htrE,2)+' kWh\n\nEvenimente (ultimele 40):\n'+S.events.slice(0,40).reverse().join('\n')+'\n'}
$('dlrep').onclick=()=>dl('raport_tura.txt',reportTxt());
$('dl').onclick=()=>dl('referat_lucrarea5.txt','REFERAT – Lucrarea 5: Software și programare. SCADA\nNume/grupa: '+$('r_nm').value+'\nData: '+new Date().toLocaleString('ro-RO')+'\n\n== A1–A9 ==\n'+$('r_a').value+'\n\n== B și concluzii ==\n'+$('r_b').value+'\n\n== Ecran construit (JSON) ==\n'+JSON.stringify(W)+'\n\n'+reportTxt());

/* ---------- buclă ---------- */
let lastDraw=0;
function draw(force){
  const now=performance.now();if(!force&&now-lastDraw<120)return;lastDraw=now;
  $('clk').textContent='timp simulat '+fmtT(S.t)+(running?'':' (pauză)');
  const act=document.querySelector('main>section.on').id;
  if(act==='t1'){updSyn();alTable();updFace();trend();$('evlog').textContent=S.events.slice(0,12).join('\n')}
  if(act==='t2')updNet();
  if(act==='t3')liveEd();
  if(act==='t4'&&(force||now-draw.h>1500)){hist();draw.h=now}
}
draw.h=0;
function frame(now){
  if(running){const dt=Math.min(100,now-lastReal)/1000*(+$('spd').value);acc+=dt/E.DT;const n=Math.min(2000,Math.floor(acc));acc-=n;S.step(n)}
  lastReal=now;draw(false);requestAnimationFrame(frame)}
$('v_ex').textContent=0;$('v_to').textContent='300 ms';$('v_rt').textContent=1;$('v_ta').textContent='20 °C';
devUI();buildFace();renderEd();check();hist();
S.step(4*5);
window.addEventListener('resize',()=>draw(true));
requestAnimationFrame(frame);
window.__l5={S,E,W:()=>W,addW,check,renderEd,setMode:m=>{mode=m;renderEd()},draw};
})();
