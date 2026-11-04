(function(){
'use strict';
const $=id=>document.getElementById(id);
const f1=(x,d=1)=>Number(x).toFixed(d);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const load=(k,d)=>{try{const j=localStorage.getItem(k);return j?JSON.parse(j):d}catch(e){return d}};
function toast(m){const t=$('toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',3000)}
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('main>section').forEach(s=>s.classList.toggle('on',s.id===b.dataset.t));if(b.dataset.t==='t1')layout()});

/* ---------- proces simplificat (fermentator) ---------- */
function Proc(){
  this.t=0;this.T=22;this.Ta=20;this.L=60;this.P=8;this.SP=38;this.band=1;this.mode=0;this.htr=false;this.pump=false;this.F=0;this.flare=false;this.stuck=false;
}
Proc.prototype.step=function(dt){
  const on=this.mode===1?true:this.mode===2?false:(this.T<this.SP-this.band/2?true:this.T>this.SP+this.band/2?false:this.htr);
  this.htr=this.stuck?true:on;
  if(this.T>48)this.htr=false;
  if(this.L<50)this.pump=true;else if(this.L>80)this.pump=false;
  this.T+=dt*((8000*(this.htr?1:0)-120*(this.T-this.Ta))/3e5);
  this.L=Math.max(0,Math.min(100,this.L+dt*((this.pump?0.2:0)-0.02)));
  this.F=12*Math.exp(-Math.pow((this.T-38)/6,2))*this.L/100;
  if(this.P>30)this.flare=true;else if(this.P<25)this.flare=false;
  this.P=Math.max(0,Math.min(40,this.P+dt*0.004*(this.F-(4+(this.flare?20:0)))));
  this.t+=dt;
};
const pr=new Proc();
const TAGS={TT101:{u:'°C',g:()=>pr.T,d:1,lo:0,hi:100},SP101:{u:'°C',g:()=>pr.SP,d:1,lo:15,hi:60},LT101:{u:'%',g:()=>pr.L,d:1,lo:0,hi:100},PT101:{u:'mbar',g:()=>pr.P,d:1,lo:0,hi:40},FT101:{u:'m³/h',g:()=>pr.F,d:1,lo:0,hi:15},HTR101:{u:'',g:()=>pr.htr?1:0,d:0,lo:0,hi:1,bool:1},P101:{u:'',g:()=>pr.pump?1:0,d:0,lo:0,hi:1,bool:1}};
const TN=Object.keys(TAGS);
/* alarme */
const ALD=[{k:'TT101.H',tag:'TT101',txt:'Temperatură ridicată',pr:2,on:()=>pr.T>41,clr:()=>pr.T<40.5,v:()=>pr.T},
 {k:'PT101.H',tag:'PT101',txt:'Presiune gazometru ridicată',pr:1,on:()=>pr.P>33,clr:()=>pr.P<32,v:()=>pr.P},
 {k:'LT101.L',tag:'LT101',txt:'Nivel scăzut',pr:2,on:()=>pr.L<25,clr:()=>pr.L>27,v:()=>pr.L}];
const AL={}; // k -> {st:'A'|'AA'|'R',t0}
function alStep(){for(const d of ALD){const a=AL[d.k];if(!a){if(d.on())AL[d.k]={k:d.k,txt:d.txt,pr:d.pr,tag:d.tag,st:'A',t0:pr.t,v:d.v()}}else{a.v=d.v();if(a.st!=='R'&&d.clr()){if(a.st==='AA')delete AL[d.k];else a.st='R'}else if(a.st==='R'&&d.on())a.st='A'}}}
const alList=()=>Object.values(AL).sort((a,b)=>a.pr-b.pr||b.t0-a.t0);
const alAck=()=>{for(const k of Object.keys(AL)){const a=AL[k];if(a.st==='A')a.st='AA';else if(a.st==='R')delete AL[k]}};
function fmtT(s){s=Math.floor(s);return String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}

/* ================= 1. CONSTRUCTOR DE PANOU ================= */
const THEMES={gray:{bg:'#d9dde2',fg:'#1a1a1a',el:'#eef0f3',acc:'#2b3a4a',bar:'#5d7a99',on:'#2e9e5a',off:'#9aa3ad',head:'#2b3a4a',headfg:'#ffffff'},
 dark:{bg:'#1c2128',fg:'#e6edf3',el:'#2a323c',acc:'#3b4755',bar:'#4aa3ff',on:'#3ec47e',off:'#55606d',head:'#0d1117',headfg:'#e6edf3'},
 blue:{bg:'#1f4fd8',fg:'#6fa0ff',el:'#2c5fe8',acc:'#16379b',bar:'#ffd400',on:'#00e676',off:'#7a8fd6',head:'#16379b',headfg:'#ffffff'}};
let P=load('aspi_l6_panel',null)||{size:[800,480],theme:'gray',tplH:true,tplN:true,pages:[{id:'p1',name:'Proces',els:[]}],cur:'p1'};
let mode='edit',selE=null,eid=1;
const PX_MM=5.2;
P.pages.forEach(p=>p.els.forEach(e=>{eid=Math.max(eid,e.id+1)}));
const curPage=()=>P.pages.find(p=>p.id===P.cur)||P.pages[0];
const DEF={text:{w:180,h:34,text:'Text',size:20},value:{w:230,h:44,tag:'TT101',label:'Temperatură',size:22},bar:{w:44,h:170,tag:'LT101'},lamp:{w:40,h:40,tag:'HTR101'},button:{w:130,h:56,label:'Buton',act:'goto',target:'',size:18},input:{w:260,h:56,tag:'SP101',label:'Consemn',min:15,max:60,confirm:true,size:20},alarmlist:{w:460,h:200,size:15}};
function addEl(type){const pg=curPage();const el=Object.assign({id:eid++,type,x:20+(pg.els.length%5)*16,y:(P.tplH?50:10)+(pg.els.length%5)*20},JSON.parse(JSON.stringify(DEF[type])));pg.els.push(el);selE=el.id;savePanel();render();props()}
const savePanel=()=>save('aspi_l6_panel',P);
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addEl(b.dataset.add));
function layout(){const w=$('pwrap').clientWidth;const s=Math.min(1,w/P.size[0]);$('panel').style.transform='scale('+s+')';$('pwrap').style.height=(P.size[1]*s)+'px';return s}
function pageBar(){
  $('pgbar').innerHTML=P.pages.map(p=>'<button class="b '+(p.id===P.cur?'':'n')+' s" data-pg="'+p.id+'">'+esc(p.name)+'</button>').join('')+'<button class="b g s" id="pgAdd">+ pagină</button>'+(P.pages.length>1?'<button class="b r s" id="pgDel">− pagina curentă</button>':'');
  $('pgbar').querySelectorAll('[data-pg]').forEach(b=>b.onclick=()=>{P.cur=b.dataset.pg;selE=null;savePanel();render();props()});
  $('pgAdd').onclick=()=>{const id='p'+(Math.max(0,...P.pages.map(p=>+p.id.slice(1)))+1);P.pages.push({id,name:'Pagina '+P.pages.length+1,els:[]});P.cur=id;savePanel();render();props()};
  if($('pgDel'))$('pgDel').onclick=()=>{P.pages=P.pages.filter(p=>p.id!==P.cur);P.cur=P.pages[0].id;selE=null;savePanel();render();props()};
}
function valStr(t,dec){const g=TAGS[t];if(!g)return '???';if(g.bool)return g.g()?'ON':'OFF';return f1(g.g(),dec??g.d)+(g.u?' '+g.u:'')}
function elHTML(e,th){
  const g=e.tag?TAGS[e.tag]:null;
  switch(e.type){
   case'text':return esc(e.text);
   case'value':return '<span style="opacity:.85">'+esc(e.label||'')+(e.label?': ':'')+'</span>&nbsp;<b data-v="'+e.id+'">'+(g?valStr(e.tag):'nelegat')+'</b>';
   case'bar':return g?'<i data-b="'+e.id+'" style="background:'+th.bar+';height:'+(100*(g.g()-g.lo)/(g.hi-g.lo))+'%"></i>':'';
   case'lamp':return '';
   case'button':return esc(e.label);
   case'input':return '<span>'+esc(e.label||e.tag)+'</span><input type="number" step="0.5" '+(mode==='edit'?'disabled':'')+' value="'+f1(g?g.g():0,1)+'" data-i="'+e.id+'"><b style="font-size:.8em">'+(g?g.u:'')+'</b>'+(e.confirm?'<button class="pbtn" data-ok="'+e.id+'" style="margin-left:2px;padding:0 8px;height:80%;background:'+th.acc+';color:#fff" '+(mode==='edit'?'disabled':'')+'>OK</button>':'');
   case'alarmlist':return '<div style="width:100%;height:100%;overflow:auto;text-align:left;font-size:'+(e.size||15)+'px;padding:4px" data-al="'+e.id+'"></div>';
  }
}
function render(){
  const P_=$('panel'),th=THEMES[P.theme],pg=curPage(),[W,H]=P.size;
  P_.style.width=W+'px';P_.style.height=H+'px';P_.style.background=th.bg;P_.style.color=th.fg;P_.innerHTML='';
  $('psize').value=W+'x'+H;$('ptheme').value=P.theme;$('tplH').checked=P.tplH;$('tplN').checked=P.tplN;
  $('mEdit').className='b'+(mode==='edit'?'':' n');$('mRun').className='b'+(mode==='run'?'':' n');
  pageBar();
  pg.els.forEach(e=>{const d=document.createElement('div');d.className='pe'+(e.type==='button'?' pbtn':'')+(e.type==='bar'?' pbar':'')+(e.type==='lamp'?' plamp':'')+(e.type==='input'?' pinp':'')+(mode==='edit'?' edit':'')+(mode==='edit'&&e.id===selE?' sel':'');
    d.style.cssText+=';left:'+e.x+'px;top:'+e.y+'px;width:'+e.w+'px;height:'+e.h+'px;font-size:'+(e.size||18)+'px;'+(e.type==='button'||e.type==='input'||e.type==='bar'||e.type==='alarmlist'||e.type==='lamp'?'background:'+th.el+';':'');
    if(e.type==='button')d.style.background=th.acc,d.style.color='#fff';
    d.dataset.id=e.id;d.innerHTML=elHTML(e,th);P_.appendChild(d);
    if(mode==='edit'){let dr=null;d.onpointerdown=ev=>{if(ev.target.tagName==='INPUT')return;selE=e.id;const s=layout();dr={x:ev.clientX/s-e.x,y:ev.clientY/s-e.y,s};d.setPointerCapture(ev.pointerId);props();P_.querySelectorAll('.pe').forEach(x=>x.classList.toggle('sel',+x.dataset.id===e.id))};
      d.onpointermove=ev=>{if(!dr)return;e.x=Math.max(0,Math.min(W-e.w,Math.round((ev.clientX/dr.s-dr.x)/5)*5));e.y=Math.max(0,Math.min(H-e.h,Math.round((ev.clientY/dr.s-dr.y)/5)*5));d.style.left=e.x+'px';d.style.top=e.y+'px'};
      d.onpointerup=()=>{dr=null;savePanel()}}
    else{
      if(e.type==='button')d.onclick=()=>{if(e.act==='goto'&&e.target){P.cur=e.target;render()}else if(e.act==='ack')alAck();else if(e.act==='sp+')pr.SP=Math.min(60,pr.SP+0.5);else if(e.act==='sp-')pr.SP=Math.max(15,pr.SP-0.5)};
      if(e.type==='input'){const inp=d.querySelector('input'),ok=d.querySelector('[data-ok]');const commit=()=>{const v=+inp.value;if(e.tag!=='SP101'){toast('Tag-ul nu este inscriptibil');return}
        const lo=e.min!==''&&e.min!=null?+e.min:15,hi=e.max!==''&&e.max!=null?+e.max:60;if(!(v>=lo&&v<=hi)){toast('Valoare în afara limitelor ('+lo+'…'+hi+')');inp.value=f1(pr.SP,1);return}pr.SP=v;toast('Consemn scris: '+f1(v,1)+' °C')};
        if(ok)ok.onclick=commit;else inp.onchange=commit}}
  });
  if(P.tplH){const h=document.createElement('div');h.className='phead';h.style.cssText='height:40px;background:'+th.head+';color:'+th.headfg+';font-size:18px';h.innerHTML='<span>'+esc(pg.name)+'</span><div class="palm" id="palm"></div><span id="pclk" style="font-variant-numeric:tabular-nums"></span>';P_.appendChild(h);$('palm').onclick=()=>{if(mode==='run'){alAck();const al=P.pages.find(p=>p.els.some(e=>e.type==='alarmlist'));if(al){P.cur=al.id;render()}}}}
  if(P.tplN){const n=document.createElement('div');n.className='pnav';n.style.cssText='height:60px;background:'+th.head;n.innerHTML=P.pages.map(p=>'<div data-go="'+p.id+'" style="background:'+(p.id===P.cur?th.acc:th.el)+';color:'+(p.id===P.cur?'#fff':th.fg)+';font-size:18px">'+esc(p.name)+'</div>').join('');P_.appendChild(n);n.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(mode==='run'){P.cur=b.dataset.go;render()}else{P.cur=b.dataset.go;selE=null;render();props()}})}
  layout();live();
}
function live(){
  if(mode!=='run'&&!P.tplH)return;
  const th=THEMES[P.theme],pg=curPage(),Pn=$('panel');
  pg.els.forEach(e=>{const d=Pn.querySelector('[data-id="'+e.id+'"]');if(!d)return;const g=e.tag?TAGS[e.tag]:null;
    if(e.type==='value'&&g){const b=d.querySelector('[data-v]');if(b)b.textContent=valStr(e.tag)}
    if(e.type==='bar'&&g){const i=d.querySelector('[data-b]');if(i){i.style.height=(100*(g.g()-g.lo)/(g.hi-g.lo))+'%';const a=alList().find(x=>x.tag===e.tag);i.style.background=a?'#d23c3c':th.bar}}
    if(e.type==='lamp'&&g)d.style.background=g.g()?th.on:th.off;
    if(e.type==='alarmlist'){const box=d.querySelector('[data-al]');const L=alList();box.innerHTML='<table style="width:100%;border-collapse:collapse;color:inherit"><tr style="opacity:.7"><td>Ora</td><td>Alarmă</td><td>Val.</td><td>Stare</td></tr>'+(L.length?L.map(a=>'<tr style="'+(a.st!=='AA'?'font-weight:700;':'')+'"><td>'+fmtT(a.t0)+'</td><td style="color:'+(a.pr===1?'#d23c3c':'#e08a00')+'">'+esc(a.txt)+'</td><td>'+f1(a.v)+'</td><td>'+({A:'neconf.',AA:'confirmată',R:'revenită'}[a.st])+'</td></tr>').join(''):'<tr><td colspan="4">Nicio alarmă activă</td></tr>')+'</table><button class="pbtn" id="alAck" style="margin-top:6px;padding:6px 12px;background:'+th.acc+';color:#fff;border:0">Confirmă toate</button>';const b=$('alAck');if(b)b.onclick=()=>{if(mode==='run')alAck()}}
    if(e.type==='input'){const inp=d.querySelector('input');if(inp&&document.activeElement!==inp&&g)inp.value=f1(g.g(),1)}});
  const pa=$('palm');if(pa){const L=alList();const un=L.filter(a=>a.st!=='AA');const top=un[0]||L[0];if(top){pa.className='palm'+(top.st==='A'?' act':'');pa.style.background=top.pr===1?'#d23c3c':'#e08a00';pa.style.color='#fff';pa.textContent='▲ '+fmtT(top.t0)+'  '+top.txt+' ('+f1(top.v)+')'+(L.length>1?'  +'+(L.length-1):'')}else{pa.className='palm';pa.style.background='rgba(255,255,255,.12)';pa.style.color=th.headfg;pa.textContent='Fără alarme active'}}
  const ck=$('pclk');if(ck)ck.textContent=fmtT(pr.t);
}
function props(){
  const pg=curPage(),e=pg.els.find(x=>x.id===selE);
  if(!e||mode!=='edit'){$('props').innerHTML='<div class="row"><label>Numele paginii</label><input type="text" id="pgn" value="'+esc(pg.name)+'"></div><span class="mut">Selectați un element în modul Editare.</span>';$('pgn').oninput=()=>{pg.name=$('pgn').value;savePanel();render()};return}
  const tagSel=cur=>'<select id="pp_tag"><option value="">(nelegat)</option>'+TN.map(n=>'<option'+(n===cur?' selected':'')+'>'+n+'</option>').join('')+'</select>';
  let h='<div class="row"><label>Tip <b>'+e.type+'</b></label></div>';
  if(e.type==='text')h+='<div class="row"><label>Text</label><input type="text" id="pp_text" value="'+esc(e.text)+'"></div>';
  if(['value','bar','lamp','input'].includes(e.type))h+='<div class="row"><label>Tag</label>'+tagSel(e.tag)+'</div>';
  if(['value','input','button'].includes(e.type))h+='<div class="row"><label>Etichetă</label><input type="text" id="pp_label" value="'+esc(e.label||'')+'"></div>';
  if(e.type==='button')h+='<div class="row"><label>Acțiune</label><select id="pp_act"><option value="goto">Mergi la pagina…</option><option value="ack">Confirmă alarmele</option><option value="sp+">Consemn +0,5</option><option value="sp-">Consemn −0,5</option></select></div><div class="row"><label>Pagina țintă</label><select id="pp_target"><option value="">–</option>'+P.pages.map(p=>'<option value="'+p.id+'"'+(p.id===e.target?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></div>';
  if(e.type==='input')h+='<div class="row"><label>Limite min / max</label><div class="inl"><input type="number" id="pp_min" style="width:80px" value="'+(e.min??'')+'"><input type="number" id="pp_max" style="width:80px" value="'+(e.max??'')+'"></div></div><div class="row"><label><span><input type="checkbox" id="pp_conf" '+(e.confirm?'checked':'')+'> cu buton de confirmare (OK)</span></label></div>';
  h+='<div class="row"><label>Lățime / înălțime (px)</label><div class="inl"><input type="number" id="pp_w" style="width:80px" value="'+e.w+'"><input type="number" id="pp_h" style="width:80px" value="'+e.h+'"></div></div>';
  h+='<div class="row"><label>Mărime font</label><input type="number" id="pp_size" style="width:80px" value="'+(e.size||18)+'"></div><div class="row"><button class="b r s" id="pp_del">Șterge elementul</button></div>';
  $('props').innerHTML=h;
  const bindv=(id,k,num)=>{const x=$(id);if(!x)return;x.oninput=x.onchange=()=>{e[k]=x.type==='checkbox'?x.checked:(num?(x.value===''?'':+x.value):x.value);savePanel();render()}};
  bindv('pp_text','text');bindv('pp_tag','tag');bindv('pp_label','label');bindv('pp_act','act');bindv('pp_target','target');bindv('pp_min','min',1);bindv('pp_max','max',1);bindv('pp_conf','confirm');bindv('pp_w','w',1);bindv('pp_h','h',1);bindv('pp_size','size',1);
  if($('pp_act'))$('pp_act').value=e.act;$('pp_del').onclick=()=>{pg.els=pg.els.filter(x=>x!==e);selE=null;savePanel();render();props()};
}
$('mEdit').onclick=()=>{mode='edit';render();props()};$('mRun').onclick=()=>{mode='run';selE=null;render();props()};
$('psize').onchange=e=>{P.size=e.target.value.split('x').map(Number);savePanel();render()};
$('ptheme').onchange=e=>{P.theme=e.target.value;savePanel();render()};$('tplH').onchange=e=>{P.tplH=e.target.checked;savePanel();render()};$('tplN').onchange=e=>{P.tplN=e.target.checked;savePanel();render()};
$('pClr').onclick=()=>{P={size:P.size,theme:P.theme,tplH:true,tplN:true,pages:[{id:'p1',name:'Proces',els:[]}],cur:'p1'};savePanel();selE=null;render();props()};
$('pExp').onclick=()=>{$('pjson').value=JSON.stringify(P)};
$('pImp').onclick=()=>{try{const a=JSON.parse($('pjson').value);if(!a.pages||!a.size)throw 0;P=a;eid=1;P.pages.forEach(p=>p.els.forEach(e=>{eid=Math.max(eid,e.id+1)}));savePanel();render();props()}catch(e){toast('JSON invalid')}};
$('pEx').onclick=()=>{
  const mk=(type,o)=>Object.assign({id:eid++,type},JSON.parse(JSON.stringify(DEF[type])),o);
  P={size:P.size,theme:'gray',tplH:true,tplN:true,cur:'p1',pages:[
   {id:'p1',name:'Proces',els:[mk('value',{x:30,y:60,label:'Temperatură',tag:'TT101'}),mk('value',{x:30,y:120,label:'Debit biogaz',tag:'FT101'}),mk('value',{x:30,y:180,label:'Presiune',tag:'PT101'}),mk('bar',{x:400,y:60,tag:'LT101'}),mk('text',{x:450,y:90,text:'Nivel LT101',size:18}),mk('lamp',{x:30,y:250,tag:'HTR101'}),mk('text',{x:80,y:254,text:'Încălzitor',size:18}),mk('lamp',{x:260,y:250,tag:'P101'}),mk('text',{x:310,y:254,text:'Pompă',size:18})]},
   {id:'p2',name:'Alarme',els:[mk('alarmlist',{x:20,y:60,w:640,h:280,size:17}),mk('button',{x:660,y:60,label:'Confirmă',act:'ack'})]},
   {id:'p3',name:'Setări',els:[mk('input',{x:30,y:70,w:340,label:'Consemn T (°C)',tag:'SP101',min:15,max:60,confirm:true}),mk('button',{x:30,y:150,w:120,label:'−0,5',act:'sp-',size:22}),mk('button',{x:170,y:150,w:120,label:'+0,5',act:'sp+',size:22})]}]};
  selE=null;savePanel();render();props()};
/* evaluare */
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
const contrast=(a,b)=>{const la=lum(a),lb=lum(b);return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05)};
function evaluate(){
  const [W,H]=P.size,items=[];const th=THEMES[P.theme];
  const inter=[];P.pages.forEach(p=>p.els.forEach(e=>{if(e.type==='button'||e.type==='input')inter.push(Math.min(e.w,e.h)/PX_MM)}));
  if(P.tplN)inter.push(Math.min(60,(W/P.pages.length-4))/PX_MM);
  const minT=inter.length?Math.min(...inter):null;
  items.push(['Ținte tactile ≥ 10 mm (cel mai mic element: '+(minT==null?'–':f1(minT,1)+' mm')+')',minT!=null&&minT>=10]);
  items.push(['Linie de alarmă vizibilă pe toate paginile (antet activ)',P.tplH]);
  // navigare
  const first=P.pages[0].id;const edges={};P.pages.forEach(p=>{edges[p.id]=new Set(P.tplN?P.pages.map(x=>x.id):[]);p.els.forEach(e=>{if(e.type==='button'&&e.act==='goto'&&e.target)edges[p.id].add(e.target)})});
  const dist={[first]:0},q=[first];while(q.length){const u=q.shift();edges[u].forEach(v=>{if(dist[v]===undefined){dist[v]=dist[u]+1;q.push(v)}})}
  const reach=P.pages.every(p=>dist[p.id]!==undefined),depth=reach?Math.max(...Object.values(dist)):null;
  items.push(['Orice pagină se atinge din prima în ≤ 3 atingeri (adâncime: '+(depth==null?'pagini inaccesibile':depth)+')',reach&&depth<=3]);
  const cons=P.tplN||P.pages.slice(1).every(p=>p.els.some(e=>e.type==='button'&&e.act==='goto'&&e.target===first));
  items.push(['Navigare consecventă (bară comună sau buton „înapoi” pe fiecare pagină)',cons]);
  items.push(['Există o pagină cu lista de alarme și confirmare',P.pages.some(p=>p.els.some(e=>e.type==='alarmlist'))]);
  items.push(['Cel mult 12 elemente pe pagină',P.pages.every(p=>p.els.length<=12)]);
  const cr=contrast(th.fg,th.bg);items.push(['Contrast text/fundal ≥ 4,5 (temă: '+f1(cr,1)+':1)',cr>=4.5]);
  let ov=0;const top=P.tplH?40:0,bot=H-(P.tplN?60:0);
  P.pages.forEach(p=>{p.els.forEach((a,i)=>{if(a.y<top||a.y+a.h>bot)ov++;p.els.slice(i+1).forEach(b=>{if(a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h)ov++})})});
  items.push(['Fără suprapuneri între elemente și șablon ('+ov+' conflicte)',ov===0]);
  const vals=P.pages.flatMap(p=>p.els.filter(e=>e.type==='value'));
  items.push(['Valorile au etichetă (unitatea se afișează automat)',vals.length>0&&vals.every(e=>e.label&&e.tag)]);
  const ins=P.pages.flatMap(p=>p.els.filter(e=>e.type==='input'));
  items.push(['Există câmp pentru SP101, cu limite valide și confirmare',ins.some(e=>e.tag==='SP101')&&ins.every(e=>e.min!==''&&e.max!==''&&e.min!=null&&+e.min<+e.max&&e.confirm)]);
  const ov1=P.pages.some(p=>p.els.some(e=>e.type==='value'&&e.tag==='TT101')&&p.els.some(e=>e.type==='bar'&&e.tag==='LT101'));
  items.push(['O pagină de proces cu TT101 (valoare) și LT101 (bară)',ov1]);
  items.push(['Stări afișate și prin text/formă, nu numai culoare (există text lângă lămpi)',P.pages.every(p=>p.els.filter(e=>e.type==='lamp').every(l=>p.els.some(t=>t.type==='text'&&Math.abs(t.y-l.y)<30&&t.x>=l.x&&t.x-l.x<140)))&&P.pages.some(p=>p.els.some(e=>e.type==='lamp'))]);
  const ok=items.filter(x=>x[1]).length;
  $('chk').innerHTML=items.map(([t,y])=>'<li class="'+(y?'y':'n')+'">'+t+'</li>').join('');
  const sc=Math.round(100*ok/items.length);
  $('score').innerHTML='<div><span>Scor ergonomic</span><b class="'+(sc>=90?'ok':sc>=60?'warn':'bad')+'">'+sc+' %</b></div><div><span>Țintă minimă</span><b>'+(minT==null?'–':f1(minT,1)+' mm')+'</b></div><div><span>Adâncime navigare</span><b>'+(depth==null?'–':depth)+'</b></div>';
  return {items,sc};
}
$('chkb').onclick=evaluate;

/* ================= 2. ERGONOMIE ================= */
function contrastUI(){const f=$('cfg').value,b=$('cbg').value,r=contrast(f,b);$('cview').style.color=f;$('cview').style.background=b;
  $('cout').innerHTML='<div><span>Raport</span><b>'+f1(r,2)+' : 1</b></div><div><span>Text normal (4,5)</span><b class="'+(r>=4.5?'ok':'bad')+'">'+(r>=4.5?'DA':'NU')+'</b></div><div><span>Text mare (3)</span><b class="'+(r>=3?'ok':'bad')+'">'+(r>=3?'DA':'NU')+'</b></div><div><span>Nivel AAA (7)</span><b class="'+(r>=7?'ok':'bad')+'">'+(r>=7?'DA':'NU')+'</b></div>'}
$('cfg').oninput=$('cbg').oninput=contrastUI;
const PAL=[['Text negru pe gri deschis','#1a1a1a','#d9dde2'],['Alarmă roșie pe gri deschis','#d23c3c','#d9dde2'],['Alarmă roșie pe alb','#c62828','#ffffff'],['Galben pe alb','#e6c200','#ffffff'],['Verde pe gri deschis','#1e9e5a','#d9dde2'],['Alb pe roșu (banner alarmă)','#ffffff','#d23c3c'],['Albastru deschis pe albastru','#6fa0ff','#1f4fd8'],['Text deschis pe fundal închis','#e6edf3','#1c2128']];
$('isa').innerHTML='<tr><th>Pereche</th><th>Raport</th><th>4,5:1</th></tr>'+PAL.map(([n,f,b])=>{const r=contrast(f,b);return '<tr><td><span class="sw" style="width:22px;height:16px;background:'+b+';border-color:'+f+'"></span>'+n+'</td><td>'+f1(r,1)+'</td><td class="'+(r>=4.5?'ok':'bad')+'">'+(r>=4.5?'da':'nu')+'</td></tr>'}).join('');
$('cb').onchange=e=>{$('cbview').style.filter=e.target.value==='none'?'none':'url(#f_'+e.target.value+')'};
contrastUI();
/* Fitts */
function fittsUI(){const D=+$('fD').value,W=+$('fW').value;$('v_D').textContent=D+' px';$('v_W').textContent=W+' px';const id=Math.log2(D/W+1);$('fout').innerHTML='<div><span>Indice de dificultate</span><b>'+f1(id,2)+' biți</b></div><div><span>Timp estimat</span><b>'+f1(0.1+0.15*id,2)+' s</b></div><div><span>Țintă ≈ în mm (5,2 px/mm)</span><b>'+f1(W/PX_MM,1)+'</b></div>'}
$('fD').oninput=$('fW').oninput=fittsUI;fittsUI();
let fs=null;
$('fstart').onclick=()=>{const box=$('fitt');const w=box.clientWidth,D=Math.min(400,w-120);const seq=[];[20,40,80].forEach(W=>{for(let i=0;i<6;i++)seq.push(W)});fs={seq,i:0,res:{20:[],40:[],80:[]},D,w};$('fres').textContent='';nextT()};
function nextT(){const box=$('fitt');box.innerHTML='';if(fs.i>=fs.seq.length){const rows=[20,40,80].map(W=>{const a=fs.res[W],m=a.reduce((x,y)=>x+y,0)/a.length/1000,id=Math.log2(fs.D/W+1);return 'W = '+W+' px: măsurat '+f1(m,2)+' s · estimat '+f1(0.1+0.15*id,2)+' s (ID '+f1(id,2)+' biți)'});$('fres').innerHTML=rows.join('<br>')+'<br>D = '+fs.D+' px. Primul timp din fiecare grup include deplasarea inițială.';fitState=fs;fs=null;return}
  const W=fs.seq[fs.i],left=fs.i%2===0,x=left?(fs.w-fs.D)/2-W/2:(fs.w+fs.D)/2-W/2;const t=document.createElement('div');t.className='tg';t.style.cssText='width:'+W+'px;height:'+W+'px;left:'+x+'px;top:'+(130-W/2)+'px';box.appendChild(t);const t0=performance.now();t.onclick=()=>{fs.res[W].push(performance.now()-t0);fs.i++;nextT()}}
let fitState=null;
/* anomalia */
const QTY=[['TT101','°C',36,40],['PT101','mbar',15,30],['LT101','%',50,80],['FT101','m³/h',6,11],['pH',' ',6.8,7.4],['Turație','rpm',55,65],['Debit A','L/min',10,14],['Debit B','L/min',10,14],['Nivel N2','%',40,70],['Vibrații','mm/s',0.5,2.5],['Tensiune','V',380,410],['Curent','A',8,14]];
const RB=['#e57373','#f06292','#ba68c8','#7986cb','#4fc3f7','#4db6ac','#81c784','#dce775','#ffd54f','#ffb74d','#a1887f','#90a4ae'];
let an=null;const ares={rainbow:[],hp:[]};
$('astart').onclick=()=>{an={n:0,style:$('stl').value,anom:-1,t0:0};$('ares').textContent='';anTrial()};
function anTrial(){
  if(an.n>=6){const m=a=>a.length?f1(a.reduce((x,y)=>x+y,0)/a.length/1000,2)+' s':'–';$('ares').innerHTML='Medii: colorat '+m(ares.rainbow)+' ('+ares.rainbow.length+' probe) · sobru '+m(ares.hp)+' ('+ares.hp.length+' probe)';$('aview').innerHTML='<span class="mut">Test încheiat. Rulați și celălalt stil.</span>';an=null;return}
  an.anom=Math.floor(Math.random()*12);
  const hp=an.style==='hp';
  $('aview').innerHTML='<div class="mut" style="margin-bottom:6px">Atingeți valoarea care iese din domeniul normal (proba '+(an.n+1)+'/6)</div>'+QTY.map((q,i)=>{const span=q[3]-q[2];const out=i===an.anom;const v=out?(Math.random()<0.5?q[2]-span*(0.2+Math.random()*0.4):q[3]+span*(0.2+Math.random()*0.4)):q[2]+span*(0.1+0.8*Math.random());
    const bg=hp?(out?'#d23c3c':'#f1f3f5'):RB[i],fg=hp?(out?'#fff':'#222'):'#111';
    return '<span class="cell" data-a="'+i+'" style="background:'+bg+';color:'+fg+'"><span style="font-size:11px;font-weight:400">'+q[0]+'</span><br>'+f1(v,q[3]<3?2:1)+' '+q[1]+'<br><span style="font-size:10px;font-weight:400">norm '+q[2]+'–'+q[3]+'</span></span>'}).join('');
  an.t0=performance.now();
  $('aview').querySelectorAll('[data-a]').forEach(c=>c.onclick=()=>{if(+c.dataset.a===an.anom){ares[an.style].push(performance.now()-an.t0);an.n++;anTrial()}else{toast('Nu este aceasta; căutați în continuare')}})}

/* ================= 3. LCD ================= */
const L={st:'HOME',cur:0,edit:null,codeD:[0,0,0,0],codeI:0,locked:true,last:performance.now(),wake:true,msg:null,msgT:0,presses:0,t0:performance.now(),ackd:false,sw:0,alArm:false};
const MI=['Consemn','Histerezis','Mod','Alarma H','Info'];const MODES=['Auto','Man ON','Man OFF'];
const alH={v:41};
function lpad(s){s=String(s);return (s+' '.repeat(16)).slice(0,16)}
function lcdLines(){
  const now=performance.now();
  if(L.msg&&now<L.msgT)return [lpad(L.msg[0]),lpad(L.msg[1])];
  switch(L.st){
   case 'HOME':{const al=pr.T>alH.v;const l2=al&&!L.ackd?(Math.floor(now/500)%2?'!ALARMA T RIDIC.':'                '):('Releu:'+(pr.htr?'ON ':'OFF')+' '+MODES[pr.mode]);return [lpad('T='+f1(pr.T)+'C SP='+f1(pr.SP)),lpad(al&&L.ackd?'Alarma confirmata':l2)]}
   case 'MENU':return [lpad('MENIU        '+(L.cur+1)+'/'+MI.length),lpad('>'+MI[L.cur])];
   case 'EDIT':{const it=MI[L.cur];const s=it==='Mod'?MODES[L.edit]:f1(L.edit)+(it==='Histerezis'?' C':' C');return [lpad(it),lpad('<'+' '.repeat(Math.floor((14-s.length)/2))+s+' '.repeat(Math.ceil((14-s.length)/2))+'>')]}
   case 'CODE':return [lpad('Cod acces:'),lpad('  '+L.codeD.map((d,i)=>i===L.codeI?'['+d+']':' '+d+' ').join(''))];
   case 'INFO':return [lpad('Info  proces'),lpad('t='+fmtT(pr.t))];
  }
}
function lcdDraw(){const ls=lcdLines();$('lcd').textContent=ls.join('\n');$('lcd').className=(performance.now()-L.last>30000)?'off':''}
function lcdKey(k){
  const now=performance.now();L.presses++;
  if(now-L.last>30000){L.last=now;return}   // prima apăsare doar aprinde iluminarea
  L.last=now;
  switch(L.st){
   case'HOME':if(k==='O'){const al=pr.T>alH.v;if(al&&!L.ackd){L.ackd=true;break}if(L.locked&&$('lcode').checked){L.st='CODE';L.codeD=[0,0,0,0];L.codeI=0}else{L.st='MENU';L.cur=0}}break;
   case'CODE':if(k==='U')L.codeD[L.codeI]=(L.codeD[L.codeI]+1)%10;else if(k==='D')L.codeD[L.codeI]=(L.codeD[L.codeI]+9)%10;else if(k==='O'){if(L.codeI<3)L.codeI++;else{if(L.codeD.join('')==='1234'){L.locked=false;L.st='MENU';L.cur=0}else{L.msg=['Cod gresit',''];L.msgT=now+1000;L.st='HOME'}}}else if(k==='B'){if(L.codeI>0)L.codeI--;else L.st='HOME'}break;
   case'MENU':if(k==='U')L.cur=(L.cur+MI.length-1)%MI.length;else if(k==='D')L.cur=(L.cur+1)%MI.length;else if(k==='B')L.st='HOME';else if(k==='O'){const it=MI[L.cur];if(it==='Info')L.st='INFO';else{L.st='EDIT';L.edit=it==='Consemn'?pr.SP:it==='Histerezis'?pr.band:it==='Mod'?pr.mode:alH.v}}break;
   case'EDIT':{const it=MI[L.cur];const st=it==='Histerezis'?0.1:0.5;if(k==='U'||k==='D'){const s=k==='U'?1:-1;if(it==='Mod')L.edit=(L.edit+s+3)%3;else L.edit=Math.round((L.edit+s*st)*10)/10;if(it==='Consemn')L.edit=Math.max(15,Math.min(60,L.edit));if(it==='Histerezis')L.edit=Math.max(0.2,Math.min(5,L.edit));if(it==='Alarma H')L.edit=Math.max(30,Math.min(48,L.edit))}
     else if(k==='O'){if(it==='Consemn')pr.SP=L.edit;else if(it==='Histerezis')pr.band=L.edit;else if(it==='Mod')pr.mode=L.edit;else alH.v=L.edit;L.msg=['Salvat!',''];L.msgT=now+900;L.st='MENU'}else if(k==='B')L.st='MENU';break}
   case'INFO':if(k==='B'||k==='O')L.st='MENU';break;
  }
}
const KM={U:'kU',D:'kD',O:'kO',B:'kB'};let rep=null;
Object.entries(KM).forEach(([k,id])=>{const b=$(id);const stop=()=>{clearTimeout(rep);clearInterval(rep)};
  b.onpointerdown=ev=>{ev.preventDefault();lcdKey(k);if(k==='U'||k==='D'){let t=performance.now();rep=setTimeout(function r(){lcdKey(k);L.presses--;rep=setTimeout(r,performance.now()-t>2500?50:140)},500)}};b.onpointerup=b.onpointerleave=stop});
document.addEventListener('keydown',e=>{if(!document.getElementById('t3').classList.contains('on')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;const m={ArrowUp:'U',ArrowDown:'D',Enter:'O',Escape:'B',ArrowLeft:'B'}[e.key];if(m){e.preventDefault();lcdKey(m)}});
$('lreset').onclick=()=>{L.presses=0;L.t0=performance.now()};
$('lfsm').textContent='HOME ──OK──► [alarmă? confirmă]\n  │                │\n  │          cod activ și blocat?\n  │             da │        │ nu\n  │               CODE      │\n  │        cod 1234 corect  │\n  ▼                ▼        ▼\n MENU ◄────────────────────┘\n  │ OK            ▲ BACK\n  ▼               │\n EDIT / INFO ─────┘\n\nTimeout 20 s: orice stare ─► HOME + blocare\nIluminare: stinsă după 30 s; prima apăsare doar o aprinde';
function lcdOut(){const sec=(performance.now()-L.t0)/1000;$('lout').innerHTML='<div><span>Temperatură</span><b>'+f1(pr.T)+' °C</b></div><div><span>Releu</span><b>'+(pr.htr?'ON':'OFF')+'</b></div><div><span>Atingeri</span><b>'+L.presses+'</b></div><div><span>Timp de la resetare</span><b>'+f1(sec,0)+' s</b></div>'}

/* ================= 4. UTILIZABILITATE ================= */
const U={rows:load('aspi_l6_rows',[]),task:null,var:'A',scr:'home',alarm:true,sp:38,pres:21.4,clicks:0,back:0,t0:0,tlx:load('aspi_l6_tlx',[])};
const TASKS={1:'Confirmați alarma activă (temperatură ridicată).',2:'Setați consemnul de temperatură la 40,0 °C și salvați.',3:'Aflați presiunea din gazometru și introduceți valoarea în câmpul de răspuns de mai jos.'};
function uRender(){
  const m=$('mock'),A=U.var==='A';let body='',nav='';
  const btn=(l,go,extra)=>'<button data-go="'+go+'" '+(extra||'')+'>'+l+'</button>';
  const alm=U.alarm?'<div class="alm" data-alm="1">▲ Temperatură ridicată (41,7 °C)'+(A?'':' — atingeți pentru confirmare')+'</div>':'';
  const top='<div class="top"><span>Stația de biogaz</span><span>'+U.var+'</span></div>';
  if(A){
    switch(U.scr){
     case'home':body='<b>Meniu principal</b><br>'+btn('Proces','proces')+btn('Alarme','alarme')+btn('Setări','setari');break;
     case'proces':body='<b>Proces</b><br>Temperatură: 38,2 °C<br>Nivel: 62 %<br>'+btn('Gazometru','gaz')+btn('Înapoi','home','data-back="1"');break;
     case'gaz':body='<b>Gazometru</b><br>Presiune: '+f1(U.pres)+' mbar<br>'+btn('Înapoi','proces','data-back="1"');break;
     case'alarme':body='<b>Alarme</b><br>'+(U.alarm?'1. Temperatură ridicată (neconfirmată)<br>'+btn('Confirmă','ack'):'Nicio alarmă activă<br>')+btn('Înapoi','home','data-back="1"');break;
     case'setari':body='<b>Setări</b><br>'+btn('Regulator','reg')+btn('Rețea','net')+btn('Înapoi','home','data-back="1"');break;
     case'net':body='<b>Rețea</b><br>Adresa RTU: 1, 9600 baud<br>'+btn('Înapoi','setari','data-back="1"');break;
     case'reg':body='<b>Regulator</b><br>'+btn('Consemn','consemn')+btn('Histerezis','hist')+btn('Înapoi','setari','data-back="1"');break;
     case'hist':body='<b>Histerezis</b><br>±0,5 °C<br>'+btn('Înapoi','reg','data-back="1"');break;
     case'consemn':body='<b>Consemn</b><br>Valoare: <b>'+f1(U.sp)+' °C</b><br>'+btn('−','dec')+btn('+','inc')+'<br>'+btn('Salvează','save')+btn('Înapoi','reg','data-back="1"');break;
    }
    m.innerHTML=top+alm+'<div class="body">'+body+'</div>';
  }else{
    nav='<div style="display:flex;gap:4px;padding:6px;background:#c7ccd3">'+btn('Proces','proces')+btn('Alarme','alarme')+btn('Consemn','consemn')+'</div>';
    switch(U.scr){
     case'home':case'proces':body='<b>Proces</b><br>Temperatură: 38,2 °C · Consemn: '+f1(U.sp)+' °C<br>Nivel: 62 % · Debit: 8,9 m³/h<br>Presiune gazometru: '+f1(U.pres)+' mbar';break;
     case'alarme':body='<b>Alarme</b><br>'+(U.alarm?'1. Temperatură ridicată (neconfirmată)<br>'+btn('Confirmă','ack'):'Nicio alarmă activă');break;
     case'consemn':body='<b>Consemn</b><br>Valoare: <b>'+f1(U.sp)+' °C</b> '+btn('−','dec')+btn('+','inc')+'<br>'+btn('Salvează','save');break;
    }
    m.innerHTML=top+alm+nav+'<div class="body">'+body+'</div>';
  }
  m.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(!U.task)return;U.clicks++;if(b.dataset.back)U.back++;const g=b.dataset.go;
    if(g==='ack'){U.alarm=false}else if(g==='dec')U.sp=Math.round((U.sp-0.5)*10)/10;else if(g==='inc')U.sp=Math.round((U.sp+0.5)*10)/10;else if(g==='save'){U.saved=U.sp;uCheck()}else U.scr=g;
    uRender();uCheck()});
  const a=m.querySelector('[data-alm]');if(a)a.onclick=()=>{if(!U.task)return;U.clicks++;if(!A){U.alarm=false;uRender();uCheck()}};
}
function uCheck(){
  if(!U.task)return;let ok=false;
  if(U.task===1)ok=!U.alarm;else if(U.task===2)ok=U.saved===40;
  if(ok)uFinish(true)}
function uFinish(ok){const s=(performance.now()-U.t0)/1000;U.rows.push({v:U.var,t:U.task,s:+s.toFixed(1),clk:U.clicks,err:U.back+(U.wrong||0),ok});save('aspi_l6_rows',U.rows);U.task=null;$('utask').innerHTML='<b class="ok">Sarcină încheiată: '+f1(s)+' s, '+U.clicks+' atingeri.</b>';$('mock').style.opacity=.5;uTable()}
$('ustart').onclick=()=>{U.var=$('uv').value;U.task=+$('ut').value;U.scr='home';U.alarm=U.task===1;U.sp=38;U.saved=null;U.pres=Math.round((15+Math.random()*15)*10)/10;U.clicks=0;U.back=0;U.wrong=0;U.t0=performance.now();$('mock').style.opacity=1;
  $('utask').innerHTML='<b>Sarcina '+U.task+':</b> '+TASKS[U.task]+(U.task===3?'<div class="inl" style="margin-top:6px"><input type="number" step="0.1" id="uans" style="width:90px"><button class="b s" id="uok">Răspund</button></div>':'');
  if(U.task===3)$('uok').onclick=()=>{const v=+$('uans').value;if(Math.abs(v-U.pres)<0.06)uFinish(true);else{U.wrong++;toast('Valoare greșită')}};uRender()};
function uTable(){
  const mean=(v,k)=>{const r=U.rows.filter(x=>x.v===v&&x.ok);return r.length?f1(r.reduce((a,b)=>a+b[k],0)/r.length,1):'–'};
  $('utab').innerHTML='<tr><th>Int.</th><th>Sarc.</th><th>Timp (s)</th><th>Atingeri</th><th>Erori</th></tr>'+U.rows.map(r=>'<tr><td>'+r.v+'</td><td>'+r.t+'</td><td>'+r.s+'</td><td>'+r.clk+'</td><td>'+r.err+'</td></tr>').join('')+'<tr><td colspan="5" class="mut">Medii reușite — A: '+mean('A','s')+' s, '+mean('A','clk')+' atingeri · B: '+mean('B','s')+' s, '+mean('B','clk')+' atingeri</td></tr>'}
$('ucsv').onclick=()=>dl('utilizabilitate.csv','interfata;sarcina;timp_s;atingeri;erori;reusit\n'+U.rows.map(r=>[r.v,r.t,r.s,r.clk,r.err,r.ok?1:0].join(';')).join('\n'),'text/csv');
$('uclr').onclick=()=>{U.rows=[];U.tlx=[];save('aspi_l6_rows',U.rows);save('aspi_l6_tlx',U.tlx);uTable();$('tlxr').textContent=''};
const TLX=['Efort mental','Efort fizic','Presiune de timp','Performanță (100 = foarte slabă)','Efort depus','Frustrare'];
$('tlx').innerHTML=TLX.map((n,i)=>'<div class="row"><label>'+n+' <b id="tv'+i+'">50</b></label><input type="range" min="0" max="100" value="50" data-tl="'+i+'"></div>').join('');
document.querySelectorAll('[data-tl]').forEach(r=>r.oninput=()=>{$('tv'+r.dataset.tl).textContent=r.value});
$('tlxb').onclick=()=>{const v=[...document.querySelectorAll('[data-tl]')].map(r=>+r.value);const s=v.reduce((a,b)=>a+b,0)/6;U.tlx.push({v:$('tlxv').value,s});save('aspi_l6_tlx',U.tlx);
  const m=k=>{const a=U.tlx.filter(x=>x.v===k);return a.length?f1(a.reduce((x,y)=>x+y.s,0)/a.length,0):'–'};$('tlxr').innerHTML='Scor TLX brut (0–100, mai mic = mai bun): această evaluare '+f1(s,0)+' · medie A '+m('A')+' · medie B '+m('B')};
function dl(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'text/plain;charset=utf-8'}));a.download=name;a.click()}
$('dl').onclick=()=>{const ev=evaluate();dl('referat_lucrarea6.txt','REFERAT – Lucrarea 6: Interfețe om-mașină (HMI)\nNume/grupa: '+$('r_nm').value+'\nData: '+new Date().toLocaleString('ro-RO')+'\n\n== A1–A7 ==\n'+$('r_a').value+'\n\n== B–D și concluzii ==\n'+$('r_b').value+'\n\n== Evaluarea panoului ('+ev.sc+' %) ==\n'+ev.items.map(x=>(x[1]?'[x] ':'[ ] ')+x[0]).join('\n')+'\n\n== Panou (JSON) ==\n'+JSON.stringify(P)+'\n\n== Test de utilizabilitate (CSV) ==\ninterfata;sarcina;timp_s;atingeri;erori;reusit\n'+U.rows.map(r=>[r.v,r.t,r.s,r.clk,r.err,r.ok?1:0].join(';')).join('\n')+'\n\n== TLX ==\n'+U.tlx.map(x=>x.v+';'+f1(x.s,0)).join('\n')+'\n')};

/* ---------- buclă ---------- */
let lastT=performance.now(),lastP=0;
function frame(now){
  const dt=Math.min(100,now-lastT)/1000;lastT=now;
  const spd=document.getElementById('t3').classList.contains('on')?+$('lspd').value:20;
  const n=Math.max(1,Math.round(dt*spd/0.25));for(let i=0;i<n;i++){pr.step(0.25);alStep()}
  if(L.st!=='HOME'&&now-L.last>20000){L.st='HOME';L.locked=true}
  if(pr.T<=alH.v-0.5)L.ackd=false;
  if(now-lastP>150){lastP=now;const act=document.querySelector('main>section.on').id;if(act==='t1')live();if(act==='t3'){lcdDraw();lcdOut()}}
  requestAnimationFrame(frame)}
$('uv').onchange=()=>{};
render();props();uTable();uRender();$('mock').style.opacity=.6;$('utask').textContent='Alegeți interfața și sarcina, apoi apăsați „Pornește sarcina”.';
window.addEventListener('resize',layout);
requestAnimationFrame(frame);
window.__l6={P:()=>P,pr,evaluate,addEl,render,L,lcdKey,lcdLines,U,setMode:m=>{mode=m;render()},contrast,AL,alStep};
})();
