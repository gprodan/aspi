(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KEY='aspi_l7';
const clone=o=>JSON.parse(JSON.stringify(o));
function exIO(){return[
 {tag:'PB101',type:'DI',desc:'Buton START (contact NO)',unit:'',min:'',max:''},
 {tag:'PB102',type:'DI',desc:'Buton STOP / RESET (contact NO)',unit:'',min:'',max:''},
 {tag:'ES101',type:'DI',desc:'Oprire de urgență (în program 1 = apăsată)',unit:'',min:'',max:''},
 {tag:'LSL101',type:'DI',desc:'Senzor nivel minim (1 = lichid peste prag)',unit:'',min:'',max:''},
 {tag:'LSH101',type:'DI',desc:'Senzor nivel maxim (1 = rezervor plin)',unit:'',min:'',max:''},
 {tag:'TT101',type:'AI',desc:'Temperatură rezervor (Pt100 + traductor 4–20 mA)',unit:'°C',min:0,max:100},
 {tag:'XV101',type:'DO',desc:'Electrovană de umplere',unit:'',min:'',max:''},
 {tag:'XV102',type:'DO',desc:'Electrovană de golire',unit:'',min:'',max:''},
 {tag:'M101',type:'DO',desc:'Contactor agitator',unit:'',min:'',max:''},
 {tag:'EH101',type:'DO',desc:'Contactor rezistență de încălzire',unit:'',min:'',max:''},
 {tag:'HL101',type:'DO',desc:'Lampă de avarie',unit:'',min:'',max:''}];}
let S={io:exIO(),model:SFC.defaultModel(),chk:{}};
try{const r=JSON.parse(localStorage.getItem(KEY)||'null');if(r&&r.io&&r.model&&r.model.steps)S=Object.assign(S,r);}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function dl(name,txt,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:type||'text/plain;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('main>section').forEach(s=>s.classList.toggle('on',s.id===b.dataset.t));if(b.dataset.t==='t3')drawSfc();if(b.dataset.t==='t1')renderV();});

/* ---------- 1. modelul în V ---------- */
const PH=[
 {id:'L1',t:'Cerințe',s:'URS',sh:'Cerințe',x:10,y:20,pair:'R4',
  what:['Descrierea procesului și a scopului (de ce se automatizează)','Cerințe numerotate, fiecare testabil (ex. „C7: la ES101 toate ieșirile se opresc în ≤ 1 s”)','Criterii de acceptare și cerințe de siguranță'],
  chk:['Fiecare cerință are un număr și o valoare măsurabilă','Sunt definite stările de avarie și ce se întâmplă în ele','Beneficiarul a semnat lista de cerințe'],
  tool:'Document de cerințe (Word/Markdown), versionat în Git.',err:'Cerințe vagi („încălzire rapidă”) care nu se pot testa niciodată.'},
 {id:'L2',t:'Specificație funcțională',s:'FS',sh:'Specificație',x:70,y:88,pair:'R3',
  what:['Schema tehnologică (P&ID) și lista de semnale I/E','Secvența de funcționare ca GRAFCET, modurile (manual/automat)','Matrice cauză–efect pentru avarii și interblocări'],
  chk:['Există lista I/E cu tag-uri unice (fila 2)','Secvența este desenată ca GRAFCET, cu tranziții complete (fila 3)','Fiecare avarie are efect, acțiune și mod de resetare'],
  tool:'Aplicația acestei lucrări: lista I/E și editorul GRAFCET.',err:'Tranziții incomplete: pasul poate rămâne blocat dacă un senzor nu răspunde.'},
 {id:'L3',t:'Proiectare detaliată',s:'DS',sh:'Proiectare',x:130,y:156,pair:'R2',
  what:['Arhitectura programului: blocuri FB/FC, baze de date, apeluri din OB1','Convenții de nume și adrese, structura HMI','Comunicații (Modbus/Profinet), parametri și valori inițiale'],
  chk:['Programul este împărțit în blocuri cu o singură responsabilitate','Convenția de nume este scrisă și aplicată','Parametrii (SP, timpi) sunt într-un singur loc'],
  tool:'TIA Portal: arborele de proiect, bibliotecă de blocuri tip.',err:'Un singur bloc de 2000 de linii; același semnal comandat din mai multe locuri.'},
 {id:'L4',t:'Implementare',s:'cod',sh:'Implementare',x:190,y:224,pair:'R1',
  what:['Programare în SCL/LAD și C++ (Arduino)','Comentarii care explică de ce, nu ce','Versionare cu Git, revizuire de cod între colegi'],
  chk:['Codul se compilează fără avertismente','Fiecare modificare este un commit cu mesaj clar','Altcineva a citit codul înainte de test'],
  tool:'SCL generat din GRAFCET (fila 3), Git, TIA Portal, Arduino IDE.',err:'Un contor incrementat la fiecare ciclu pentru că nu s-a detectat frontul.'},
 {id:'R1',t:'Test unitar',s:'bloc',sh:'Test unitar',x:385,y:224,pair:'L4',
  what:['Fiecare bloc se testează izolat cu intrări forțate','Simulare software (PLCSIM) sau model în Python (SIL)','Teste automate repetabile'],
  chk:['Testele rulează cu o singură comandă','Sunt acoperite stările normale și cele de avarie','Rezultatele sunt salvate în depozit'],
  tool:'Fila 4 și sil/test_sequencer.py (Python, unittest).',err:'Se testează doar drumul fericit; defectele de senzor nu sunt încercate.'},
 {id:'R2',t:'Test de integrare',s:'sistem',sh:'Integrare',x:445,y:156,pair:'L3',
  what:['Programul se leagă la intrările/ieșirile reale sau la o instalație simulată (HIL)','Verificarea cablării, a scalării și a comunicațiilor','HMI și SCADA citesc aceleași semnale'],
  chk:['Fiecare intrare a fost forțată și citită corect în PLC','Scalarea analogică a fost verificată în două puncte','Sensul fiecărui senzor (NO/NC) este confirmat'],
  tool:'S7-1215C + comutatoare/LED-uri; Arduino Uno cu sketch-ul 09.',err:'Contact NC citit ca NO: oprirea de urgență nu funcționează și nimeni nu observă.'},
 {id:'R3',t:'Test de acceptare în fabrică',s:'FAT',sh:'Acceptare',x:505,y:88,pair:'L2',
  what:['Verificarea funcțiilor față de specificația funcțională, împreună cu beneficiarul','Procedură de test cu rezultate semnate','Lista deficiențelor și a termenelor de remediere'],
  chk:['Fiecare funcție din FS are un caz de test','Toate avariile au fost provocate cel puțin o dată','Deficiențele sunt înregistrate cu responsabil'],
  tool:'Matricea de trasabilitate cerință → test (în raport).',err:'Funcții descrise în specificație dar niciodată încercate.'},
 {id:'R4',t:'Punere în funcțiune',s:'SAT',sh:'Pornire',x:565,y:20,pair:'L1',
  what:['Pornirea pe instalația reală, în siguranță și treptat','Reglarea parametrilor, instruirea operatorilor','Documentația „as-built” și predarea'],
  chk:['Programul de pe instalație este exact cel testat (aceeași versiune)','Copie de siguranță a proiectului este predată','Operatorii au fost instruiți pe scenarii de avarie'],
  tool:'Git tag (ex. v1.0), copie a proiectului, procedură de pornire.',err:'Se modifică programul „pe loc” fără a fi reînregistrat în depozit.'}];
let vsel='L1';
function renderV(){
 let g='';
 const by={};PH.forEach(p=>by[p.id]=p);
 [['L1','R4'],['L2','R3'],['L3','R2'],['L4','R1']].forEach(([a,b])=>{g+='<line x1="'+(by[a].x+125)+'" y1="'+(by[a].y+23)+'" x2="'+by[b].x+'" y2="'+(by[b].y+23)+'" stroke="currentColor" stroke-dasharray="4 4" opacity=".35"/>';});
 PH.forEach(p=>{const done=p.chk.every((_,i)=>S.chk[p.id+i]);g+='<g class="vph'+(p.id===vsel?' sel':'')+(done?' done':'')+'" data-id="'+p.id+'"><rect x="'+p.x+'" y="'+p.y+'" width="125" height="46" rx="8"/><text x="'+(p.x+62)+'" y="'+(p.y+20)+'" text-anchor="middle">'+esc(p.sh)+'</text><text x="'+(p.x+62)+'" y="'+(p.y+36)+'" text-anchor="middle" style="font-weight:400;font-size:11px">'+esc(p.s)+'</text></g>';});
 g+='<text x="350" y="300" text-anchor="middle" fill="currentColor" opacity=".6" font-size="12">specificare și proiectare ↘ · ↗ verificare și validare</text>';
 $('vsvg').innerHTML=g;
 $('vsvg').querySelectorAll('.vph').forEach(e=>e.onclick=()=>{vsel=e.dataset.id;renderV();});
 const p=by[vsel];
 $('vdet').innerHTML='<h3>'+esc(p.t)+' <small>('+esc(p.s)+')</small></h3><b>Livrabile</b><ul>'+p.what.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><b>Verificări înainte de a trece mai departe</b><ul style="margin:4px 0;padding:0">'+p.chk.map((x,i)=>'<li style="list-style:none"><label><input type="checkbox" data-k="'+p.id+i+'"'+(S.chk[p.id+i]?' checked':'')+'> '+esc(x)+'</label></li>').join('')+'</ul><p><b>În acest laborator:</b> '+esc(p.tool)+'</p><p><b>Eroare tipică:</b> <span class="warn">'+esc(p.err)+'</span></p><p><small>Perechea fazei: <b>'+esc(by[p.pair].t)+'</b></small></p>';
 $('vdet').querySelectorAll('input[data-k]').forEach(c=>c.onchange=()=>{S.chk[c.dataset.k]=c.checked;save();renderV();});
 let n=0,tot=0;PH.forEach(q=>q.chk.forEach((_,i)=>{tot++;if(S.chk[q.id+i])n++;}));const pc=Math.round(100*n/tot);$('vprog').textContent=pc+' %';$('vbar').style.width=pc+'%';
}
$('vreset').onclick=()=>{S.chk={};save();renderV();};
(function(){const c=[['Cerințe',1],['Specificație',3],['Proiectare',6],['Implementare',10],['Test unitar',15],['Integrare',25],['FAT',40],['Exploatare',100]];$('vcost').innerHTML=c.map(([n,v])=>'<div class="bar"><span style="width:110px">'+n+'</span><i style="width:'+Math.max(4,v*3)+'px"></i><b>×'+v+'</b></div>').join('');})();

/* ---------- 2. lista I/E ---------- */
const PRE={PB:'DI',ES:'DI',LS:'DI',TT:'AI',LT:'AI',PT:'AI',FT:'AI',XV:'DO',M:'DO',EH:'DO',HL:'DO',HA:'DO',FV:'AO',TV:'AO'};
const CAP={DI:14,DO:10,AI:2,AO:0},ACAP={DI:6,DO:6,AI:6,AO:0};
function addrs(){const c={DI:0,DO:0,AI:0,AO:0};return S.io.map(s=>{const n=c[s.type]++;let a='',p='';
 if(s.type==='DI'){a='%I'+(n<8?'0.'+n:'1.'+(n-8));p=n<6?String(2+n):'–';}
 else if(s.type==='DO'){a='%Q'+(n<8?'0.'+n:'1.'+(n-8));p=n<6?String(8+n):'–';}
 else if(s.type==='AI'){a='%IW'+(64+2*n);p=n<6?'A'+n:'–';}
 else{a='%QW'+(64+2*n);p='–';}
 return{a:a,p:p,n:n};});}
function ioChecks(){const r=[],c={DI:0,DO:0,AI:0,AO:0},seen={};
 S.io.forEach(s=>{c[s.type]++;const L=s.tag;
  if(!/^[A-Z]{1,4}\d{3}$/.test(L))r.push(['bad',L+': tag-ul nu respectă forma LITERE+3 cifre (ex. TT101)']);
  if(seen[L])r.push(['bad',L+': tag duplicat']);seen[L]=1;
  const pf=(L.match(/^[A-Z]+/)||[''])[0];const exp=PRE[pf];if(exp&&exp!==s.type)r.push(['warn',L+': prefixul '+pf+' este de obicei '+exp+', aici '+s.type]);
  if(!s.desc)r.push(['warn',L+': fără descriere']);
  if(s.type==='AI'||s.type==='AO'){if(!(Number(s.max)>Number(s.min)))r.push(['bad',L+': domeniul inginerie nu este definit (min < max)']);if(!s.unit)r.push(['warn',L+': fără unitate de măsură']);}});
 ['DI','DO','AI','AO'].forEach(t=>{if(c[t]>CAP[t])r.push(['warn',t+': '+c[t]+' semnale, CPU 1215C are '+CAP[t]+' pe placă; este nevoie de un modul de semnal (SM)']);if(c[t]>ACAP[t])r.push(['warn',t+': '+c[t]+' semnale, Arduino Uno are '+ACAP[t]+' pini disponibili în schema propusă']);});
 const u=SFC.usedNames(S.model);const tags=S.io.map(s=>s.tag);
 u.ins.concat(u.outs).forEach(n=>{if(!tags.includes(n))r.push(['bad','Modelul GRAFCET folosește «'+n+'», care nu există în lista I/E']);});
 tags.forEach(n=>{if(!u.ins.concat(u.outs).includes(n))r.push(['warn','«'+n+'» din lista I/E nu este folosit de modelul GRAFCET']);});
 return r;}
function renderIO(){
 const ad=addrs();let h='<tr><th>#</th><th>Tag</th><th>Tip</th><th>Descriere</th><th>Unit.</th><th>Min</th><th>Max</th><th>PLC</th><th>Uno</th><th></th></tr>';
 S.io.forEach((s,i)=>{const an=s.type==='AI'||s.type==='AO';h+='<tr><td>'+(i+1)+'</td><td><input type="text" data-i="'+i+'" data-f="tag" value="'+esc(s.tag)+'" style="width:84px"></td><td><select data-i="'+i+'" data-f="type" style="width:64px">'+['DI','DO','AI','AO'].map(t=>'<option'+(t===s.type?' selected':'')+'>'+t+'</option>').join('')+'</select></td><td><input type="text" data-i="'+i+'" data-f="desc" value="'+esc(s.desc)+'" style="min-width:230px"></td><td><input type="text" data-i="'+i+'" data-f="unit" value="'+esc(s.unit)+'" style="width:50px"'+(an?'':' disabled')+'></td><td><input type="number" data-i="'+i+'" data-f="min" value="'+esc(s.min)+'" style="width:64px"'+(an?'':' disabled')+'></td><td><input type="number" data-i="'+i+'" data-f="max" value="'+esc(s.max)+'" style="width:64px"'+(an?'':' disabled')+'></td><td><code>'+ad[i].a+'</code></td><td><code>'+ad[i].p+'</code></td><td><button class="b r s" data-del="'+i+'">×</button></td></tr>';});
 $('ioT').innerHTML=h;
 $('ioT').querySelectorAll('[data-f]').forEach(e=>e.onchange=()=>{const s=S.io[+e.dataset.i];const f=e.dataset.f;s[f]=(f==='min'||f==='max')?(e.value===''?'':Number(e.value)):(f==='tag'?e.value.trim().toUpperCase():e.value);save();if(f==='type')renderIO();else renderIOout();});
 $('ioT').querySelectorAll('[data-del]').forEach(e=>e.onclick=()=>{S.io.splice(+e.dataset.del,1);save();renderIO();});
 renderIOout();}
function renderIOout(){
 const ad=addrs(),ck=ioChecks();
 $('ioChk').innerHTML=ck.length?'<ul class="chk">'+ck.map(c=>'<li class="'+(c[0]==='bad'?'n':'')+'"><span class="'+(c[0]==='bad'?'bad':'warn')+'">'+esc(c[1])+'</span></li>').join('')+'</ul>':'<span class="ok">✔ Lista este coerentă: convenția de nume, adresele, capacitatea CPU și modelul GRAFCET se potrivesc.</span>';
 let p='// Tabela de etichete PLC (nume, adresă, tip)\n',a='// Definiții pentru Arduino Uno\n';
 S.io.forEach((s,i)=>{const t=s.type==='DI'||s.type==='DO'?'Bool':'Int';const nm=(s.type==='AI'||s.type==='AO')?s.tag+'_raw':s.tag;
  p+=('"'+nm+'"').padEnd(14)+ad[i].a.padEnd(7)+t.padEnd(5)+'// '+s.desc+(s.unit?' ['+s.unit+' '+s.min+'…'+s.max+']':'')+'\n';
  if(ad[i].p!=='–')a+='#define '+(s.tag+'_PIN').padEnd(11)+' '+ad[i].p+(s.type==='DI'?'   // INPUT_PULLUP, activ pe 0':s.type==='DO'?'   // OUTPUT':'   // analogic')+'\n';});
 $('ioPlc').textContent=p;$('ioArd').textContent=a;
 const ais=S.io.filter(s=>s.type==='AI');const sel=$('scSel');const cur=sel.value;sel.innerHTML=ais.map(s=>'<option>'+esc(s.tag)+'</option>').join('');if(ais.some(s=>s.tag===cur))sel.value=cur;renderSc();}
function renderSc(){
 const s=S.io.find(x=>x.tag===$('scSel').value&&x.type==='AI');if(!s){$('scV').textContent='–';$('scQ').textContent='–';$('scCode').textContent='// nu există intrare analogică';return;}
 const c420=$('sc420').checked,r0=c420?5530:0,raw=+$('scR').value;$('scRv').textContent=raw;
 const mn=Number(s.min)||0,mx=Number(s.max)||0;const v=raw<r0?NaN:mn+(mx-mn)*(raw-r0)/(27648-r0);
 $('scV').textContent=isNaN(v)?'sub domeniu (defect fir?)':v.toFixed(2)+' '+(s.unit||'');$('scQ').textContent=((mx-mn)/(27648-r0)).toFixed(4)+' '+(s.unit||'')+'/pas';
 $('scCode').textContent='#'+s.tag+' := SCALE_X(\n   MIN := '+mn.toFixed(1)+', MAX := '+mx.toFixed(1)+',\n   VALUE := NORM_X(\n      MIN := '+r0+', MAX := 27648,\n      VALUE := "'+s.tag+'_raw"));';}
$('scSel').onchange=renderSc;$('scR').oninput=renderSc;$('sc420').onchange=renderSc;
$('ioAdd').onclick=()=>{S.io.push({tag:'',type:'DI',desc:'',unit:'',min:'',max:''});save();renderIO();};
$('ioEx').onclick=()=>{S.io=exIO();save();renderIO();};
$('ioClr').onclick=()=>{S.io=[];save();renderIO();};
$('ioCsv').onclick=()=>{const ad=addrs();let t='tag;tip;descriere;unitate;min;max;adresa_PLC;pin_Uno\n';S.io.forEach((s,i)=>{t+=[s.tag,s.type,s.desc,s.unit,s.min,s.max,ad[i].a,ad[i].p].join(';')+'\n';});dl('lista_IO.csv','﻿'+t,'text/csv;charset=utf-8');};

/* ---------- 3. editor GRAFCET ---------- */
let M=S.model;
function syncParams(){$('pSP').value=M.params.SP;$('pHOLD').value=M.params.HOLD;$('pFault').innerHTML=M.steps.map(s=>'<option'+(s.id===M.fault?' selected':'')+'>'+esc(s.id)+'</option>').join('');}
function renderModel(){
 let h='<tr><th>Id</th><th>Nume</th><th>Acțiuni</th><th>t max [s]</th><th></th></tr>';
 M.steps.forEach((s,i)=>{h+='<tr><td><input type="text" data-s="'+i+'" data-f="id" value="'+esc(s.id)+'" style="width:52px"></td><td><input type="text" data-s="'+i+'" data-f="name" value="'+esc(s.name)+'" style="width:110px"></td><td><textarea data-s="'+i+'" data-f="act" rows="'+Math.max(1,(s.act||'').split('\n').length)+'" style="min-width:210px">'+esc(s.act)+'</textarea></td><td><input type="number" data-s="'+i+'" data-f="tmax" value="'+s.tmax+'" style="width:60px"></td><td><button class="b r s" data-sd="'+i+'">×</button></td></tr>';});
 $('stT').innerHTML=h;
 const opts=(v,star)=>(star?'<option'+(v==='*'?' selected':'')+'>*</option>':'')+M.steps.map(s=>'<option'+(s.id===v?' selected':'')+'>'+esc(s.id)+'</option>').join('');
 let t='<tr><th>Din</th><th>În</th><th>Condiție</th><th></th></tr>';
 M.trans.forEach((x,i)=>{t+='<tr><td><select data-t="'+i+'" data-f="from" style="width:62px">'+opts(x.from,1)+'</select></td><td><select data-t="'+i+'" data-f="to" style="width:62px">'+opts(x.to)+'</select></td><td><input type="text" data-t="'+i+'" data-f="cond" value="'+esc(x.cond)+'" style="min-width:230px;font:12px ui-monospace,Consolas,monospace"></td><td><button class="b r s" data-td="'+i+'">×</button></td></tr>';});
 $('trT').innerHTML=t;
 $('stT').querySelectorAll('[data-f]').forEach(e=>e.onchange=()=>{const s=M.steps[+e.dataset.s],f=e.dataset.f;s[f]=f==='tmax'?(Number(e.value)||0):e.value;if(f==='id'||f==='act')renderModel();modelChanged();});
 $('trT').querySelectorAll('[data-f]').forEach(e=>e.onchange=()=>{M.trans[+e.dataset.t][e.dataset.f]=e.value;modelChanged();});
 $('stT').querySelectorAll('[data-sd]').forEach(e=>e.onclick=()=>{M.steps.splice(+e.dataset.sd,1);renderModel();modelChanged();});
 $('trT').querySelectorAll('[data-td]').forEach(e=>e.onclick=()=>{M.trans.splice(+e.dataset.td,1);renderModel();modelChanged();});
 syncParams();}
function modelChanged(){S.model=M;save();const v=SFC.validate(M);
 $('mChk').innerHTML=(v.errors.length?'<ul class="chk">'+v.errors.map(e=>'<li class="n"><span class="bad">'+esc(e)+'</span></li>').join('')+'</ul>':'<span class="ok">✔ Modelul este valid.</span>')+(v.warnings.length?'<ul class="chk">'+v.warnings.map(e=>'<li><span class="warn">'+esc(e)+'</span></li>').join('')+'</ul>':'');
 syncParams();simReset();genShow();if(typeof renderIOout==='function')renderIOout();}
$('pSP').onchange=()=>{M.params.SP=Number($('pSP').value)||0;modelChanged();};
$('pHOLD').onchange=()=>{M.params.HOLD=Number($('pHOLD').value)||0;modelChanged();};
$('pFault').onchange=()=>{M.fault=$('pFault').value;modelChanged();};
$('stAdd').onclick=()=>{let n=1;while(M.steps.some(s=>s.id==='S'+n))n++;M.steps.push({id:'S'+n,name:'Pas nou',act:'',tmax:0});renderModel();modelChanged();};
$('trAdd').onclick=()=>{M.trans.push({from:M.steps[0].id,to:M.steps[0].id,cond:'0'});renderModel();modelChanged();};
$('mEx').onclick=()=>{M=S.model=SFC.defaultModel();renderModel();modelChanged();};
$('mJson').onclick=()=>dl('model_grafcet.json',JSON.stringify(M,null,1),'application/json');

function drawSfc(){
 const st=M.steps,n=st.length,gap=92,W=470,x0=130,H=40+n*gap;let g='';
 const idx={};st.forEach((s,i)=>idx[s.id]=i);
 const act=run?run.step:null;
 st.forEach((s,i)=>{const y=24+i*gap;const cls='step'+(s.id===act?' act':'')+(s.id===M.fault?' fl':'');
  g+='<g class="'+cls+'"><rect x="'+x0+'" y="'+y+'" width="130" height="44" rx="'+(i===0?3:6)+'"'+(i===0?' stroke-width="3"':'')+'/>'+(i===0?'<rect x="'+(x0-4)+'" y="'+(y-4)+'" width="138" height="52" rx="4" fill="none" stroke="currentColor" opacity=".5"/>':'')+'<text class="n" x="'+(x0+65)+'" y="'+(y+19)+'" text-anchor="middle">'+esc(s.id)+'</text><text x="'+(x0+65)+'" y="'+(y+35)+'" text-anchor="middle" style="font-weight:400">'+esc(s.name)+'</text></g>';
  const a=SFC.parseActs(s.act).filter(x=>x.name);const th=Math.max(26,a.length*15+10);
  if(a.length||s.tmax){g+='<g class="sacts"><line x1="'+(x0+130)+'" y1="'+(y+22)+'" x2="'+(x0+150)+'" y2="'+(y+22)+'" stroke="currentColor"/><rect x="'+(x0+150)+'" y="'+(y+22-th/2)+'" width="190" height="'+th+'"/>'+a.map((x,k)=>'<text x="'+(x0+158)+'" y="'+(y+22-th/2+16+k*15)+'">'+esc(x.name+' = '+x.expr)+'</text>').join('')+(a.length?'':'<text x="'+(x0+158)+'" y="'+(y+26)+'">(fără acțiuni)</text>')+'</g>';}
  if(s.tmax>0&&s.id!==M.fault)g+='<text x="'+(x0-8)+'" y="'+(y+26)+'" text-anchor="end" class="tcond" style="fill:var(--warn)">t&gt;'+s.tmax+' s ↪ '+esc(M.fault)+'</text>';
  if(i<n-1&&st[i+1].id!==M.fault){const t=M.trans.filter(x=>x.from===s.id&&x.to===st[i+1].id)[0];const yb=y+44+(gap-44)/2;
   g+='<line x1="'+(x0+65)+'" y1="'+(y+44)+'" x2="'+(x0+65)+'" y2="'+(y+gap)+'" stroke="currentColor"/>';
   if(t)g+='<g class="tbar"><line x1="'+(x0+53)+'" y1="'+yb+'" x2="'+(x0+77)+'" y2="'+yb+'"/></g><text class="tcond" x="'+(x0+86)+'" y="'+(yb+4)+'">'+esc(t.cond)+'</text>';
   else g+='<text class="tcond" x="'+(x0+86)+'" y="'+(yb+4)+'" style="fill:var(--bad)">(fără tranziție)</text>';}});
 const svg=$('sfcSvg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.style.maxHeight=Math.min(H*1.3,760)+'px';svg.innerHTML=g;
 const chain=new Set();st.forEach((s,i)=>{if(i<n-1&&st[i+1].id!==M.fault)chain.add(s.id+'>'+st[i+1].id);});
 const others=M.trans.filter(t=>t.from==='*'||!chain.has(t.from+'>'+t.to));
 $('sfcX').innerHTML='<b>Alte tranziții:</b> '+(others.map(t=>'<code>'+esc(t.from)+' → '+esc(t.to)+'</code> : '+esc(t.cond)).join(' &nbsp;·&nbsp; ')||'–');}

/* simulare */
let run=null,running=false,acc=0,hist=[],pulses=[];
function simReset(){run=new SFC.Run(M,{lshStuck:$('fLsh').checked,lslStuck:$('fLsl').checked,ttFrozen:$('fTt').checked});run.btn.ES101=$('bEs').checked?1:0;hist=[];pulses=[];$('sLog').textContent='';logN=0;simShow();}
let logN=0;
function simShow(){if(!run)return;$('kStep').textContent=run.step;$('kT').textContent=run.t.toFixed(1)+' s';$('kL').textContent=run.p.L.toFixed(0)+' %';$('kTT').textContent=run.p.T.toFixed(1)+' °C';
 $('kLamps').innerHTML=SFC.OUTS.map(k=>'<span style="margin-right:10px"><span class="lamp'+(k==='HL101'?' red':'')+(run.out[k]?' on':'')+'"></span>'+k+'</span>').join('')+'<span><span class="lamp'+(run.inp.LSL101?' on':'')+'"></span>LSL <span class="lamp'+(run.inp.LSH101?' on':'')+'"></span>LSH</span>';
 while(logN<run.log.length){const l=run.log[logN++];$('sLog').textContent+=l.time.toFixed(1).padStart(7)+' s   '+l.from+' → '+l.to+'\n';}
 $('sLog').scrollTop=1e6;
 drawChart($('cv'),[{pts:hist.map(h=>[h.t,h.T]),c:'#4aa3ff'},{pts:hist.map(h=>[h.t,h.L]),c:'#1e9e5a'}],{sp:M.params.SP,win:150,ymax:100});drawSfc();}
function drawChart(cv,ser,o){const c=cv.getContext('2d'),W=cv.width,H=cv.height,pl=34,pb=18;c.clearRect(0,0,W,H);const fg=getComputedStyle(document.body).color;
 c.strokeStyle=fg;c.globalAlpha=.25;c.fillStyle=fg;c.font='11px system-ui';
 for(let v=0;v<=o.ymax;v+=25){const y=H-pb-(H-pb-6)*v/o.ymax;c.beginPath();c.moveTo(pl,y);c.lineTo(W-4,y);c.stroke();c.globalAlpha=.7;c.fillText(v,4,y+4);c.globalAlpha=.25;}
 c.globalAlpha=1;const tmax=Math.max(o.win||0,...ser.map(s=>s.pts.length?s.pts[s.pts.length-1][0]:0));const t0=o.fixed?0:Math.max(0,tmax-(o.win||tmax));const X=t=>pl+(W-pl-6)*(t-t0)/((o.fixed?tmax:(o.win||tmax))||1),Y=v=>H-pb-(H-pb-6)*v/o.ymax;
 if(o.sp!=null){c.setLineDash([4,4]);c.strokeStyle='#e08a00';c.beginPath();c.moveTo(pl,Y(o.sp));c.lineTo(W-4,Y(o.sp));c.stroke();c.setLineDash([]);}
 ser.forEach(s=>{c.strokeStyle=s.c;c.lineWidth=2;c.beginPath();let f=1;s.pts.forEach(p=>{if(p[0]<t0)return;const x=X(p[0]),y=Y(p[1]);if(f){c.moveTo(x,y);f=0;}else c.lineTo(x,y);});c.stroke();});
 c.fillStyle=fg;c.globalAlpha=.7;c.fillText(t0.toFixed(0)+' s',pl,H-4);c.fillText(tmax.toFixed(0)+' s',W-40,H-4);c.globalAlpha=1;
 if(o.marks)o.marks.forEach(m=>{const x=X(m.t);c.strokeStyle='#8b9bb0';c.globalAlpha=.6;c.beginPath();c.moveTo(x,6);c.lineTo(x,H-pb);c.stroke();c.globalAlpha=1;c.fillStyle=fg;c.fillText(m.l,x+2,14);});}
setInterval(()=>{if(!running||!run)return;acc+=Number($('sSpd').value)*0.05;let k=0;
 while(acc>=0.1&&k<400){acc-=0.1;k++;pulses=pulses.filter(p=>{if(run.time>=p.until){run.btn[p.n]=0;return false;}return true;});run.tick(0.1);if(Math.round(run.time*10)%5===0)hist.push({t:run.time,T:run.p.T,L:run.p.L});}
 simShow();},50);
$('sRun').onclick=()=>{running=!running;$('sRun').textContent=running?'❚❚ Pauză':'▶ Pornește';$('sRun').className='b '+(running?'n':'g');};
$('sRst').onclick=simReset;
function pulse(n){if(!run)return;run.btn[n]=1;pulses.push({n:n,until:run.time+1.5});}
$('bStart').onclick=()=>pulse('PB101');$('bStop').onclick=()=>pulse('PB102');
$('bEs').onchange=()=>{if(run)run.btn.ES101=$('bEs').checked?1:0;};
$('fLsh').onchange=$('fLsl').onchange=$('fTt').onchange=()=>{if(run)Object.assign(run.faults,{lshStuck:$('fLsh').checked,lslStuck:$('fLsl').checked,ttFrozen:$('fTt').checked});};
/* generare cod */
let gMode='scl';
function genShow(){const v=SFC.validate(M);if(v.errors.length){$('gOut').textContent='// Corectați erorile modelului pentru a genera cod.';return;}
 $('gOut').textContent=gMode==='scl'?SFC.toSCL(M):SFC.toCpp(M).code;}
$('gScl').onclick=()=>{gMode='scl';genShow();};$('gCpp').onclick=()=>{gMode='cpp';genShow();};
$('gCopy').onclick=()=>{const t=$('gOut').textContent;if(navigator.clipboard)navigator.clipboard.writeText(t).catch(()=>{});};
$('gDl').onclick=()=>dl(gMode==='scl'?'FB_Sequencer.scl':'seq_core.ino',$('gOut').textContent);

/* ---------- 4. testare ---------- */
let TR=null;
function runTests(){TR=SFC.runTests(M);const ok=TR.filter(r=>r.ok).length;
 $('tSum').innerHTML='<span class="'+(ok===TR.length?'ok':'bad')+'">'+ok+' / '+TR.length+' teste trecute</span>';
 $('tT').innerHTML='<tr><th>Test</th><th>Scenariu</th><th>Rezultat</th><th>Detalii</th></tr>'+TR.map((r,i)=>'<tr data-i="'+i+'" style="cursor:pointer"><td><b>'+r.id+'</b> '+esc(r.name)+'</td><td><small>'+esc(r.desc)+'</small></td><td><span class="badge '+(r.ok?'ok':'no')+'">'+(r.ok?'trecut':'căzut')+'</span></td><td class="'+(r.ok?'':'bad')+'">'+esc(r.errs.join('; '))+'</td></tr>').join('');
 $('tT').querySelectorAll('tr[data-i]').forEach(e=>e.onclick=()=>plotTest(+e.dataset.i));
 plotTest(0);}
function plotTest(i){const r=TR[i];if(!r||!r.tr)return;const sm=r.tr.samples;
 drawChart($('tCv'),[{pts:sm.map(s=>[s.t,s.T]),c:'#4aa3ff'},{pts:sm.map(s=>[s.t,s.L]),c:'#1e9e5a'}],{sp:M.params.SP,ymax:100,fixed:1,marks:r.tr.log.map(l=>({t:l.time,l:l.to}))});
 $('tTitle').textContent=r.id+' – '+r.name+' · albastru: temperatură, verde: nivel; liniile verticale: tranziții.';}
$('tRun').onclick=runTests;
const MUT=[
 ['M1','Fără timeout la umplere',m=>{const s=m.steps.find(x=>x.id==='S1');if(!s)return 0;s.tmax=0;return 1;}],
 ['M2','Încălzire fără agitator',m=>{const s=m.steps.find(x=>x.id==='S2');if(!s||!/M101/.test(s.act))return 0;s.act=s.act.split('\n').filter(l=>!/^M101/.test(l.trim())).join('\n');return 1;}],
 ['M3','START fără verificarea rezervorului gol',m=>{const t=m.trans.find(x=>x.from==='S0'&&x.to==='S1');if(!t)return 0;t.cond='PB101';return 1;}],
 ['M4','Menținere sărită (t ≥ 0)',m=>{const t=m.trans.find(x=>x.from==='S3'&&x.to==='S4'&&/HOLD/.test(x.cond));if(!t)return 0;t.cond='t >= 0';return 1;}],
 ['M5','Fără oprire de urgență',m=>{const n=m.trans.length;m.trans=m.trans.filter(x=>x.from!=='*');return n!==m.trans.length?1:0;}],
 ['M6','Resetare automată din avarie',m=>{const t=m.trans.find(x=>x.from===m.fault&&x.to==='S0');if(!t)return 0;t.cond='!ES101';return 1;}],
 ['M7','Încălzitor fără termostat în menținere',m=>{const s=m.steps.find(x=>x.id==='S3');if(!s)return 0;s.act='M101 = 1\nEH101 = 1';return 1;}],
 ['M8','Golire fără condiție de nivel',m=>{const t=m.trans.find(x=>x.from==='S4'&&x.to==='S0');if(!t)return 0;t.cond='t >= 5';return 1;}]];
$('mRun').onclick=()=>{let h='<tr><th>Mutant</th>'+SFC.TESTS.map(t=>'<th>'+t.id+'</th>').join('')+'<th>Concluzie</th></tr>';let kill=0,tot=0;
 MUT.forEach(([id,nm,f])=>{const m=clone(M);if(!f(m)){h+='<tr><td><b>'+id+'</b> '+esc(nm)+'</td><td colspan="'+(SFC.TESTS.length+1)+'"><small>nu se poate aplica pe modelul curent</small></td></tr>';return;}
  tot++;const rs=SFC.runTests(m);const det=rs.some(r=>!r.ok);if(det)kill++;
  h+='<tr><td><b>'+id+'</b> '+esc(nm)+'</td>'+rs.map(r=>'<td>'+(r.ok?'<span class="mut">·</span>':'<b class="bad" title="'+esc(r.errs.join('; '))+'">✖</b>')+'</td>').join('')+'<td>'+(det?'<span class="ok">detectat</span>':'<span class="bad"><b>scăpat</b>: lipsește un test</span>')+'</td></tr>';});
 $('mT').innerHTML=h;$('mSum').innerHTML='<span class="'+(kill===tot?'ok':'warn')+'">'+kill+' / '+tot+' defecte detectate</span>';};
const BUGS=[
 {code:'IF #Pornit THEN\n   #tonIntarziere(IN := #Senzor, PT := T#5s);\nEND_IF;\n#Alarma := #tonIntarziere.Q;',
  q:'Alarma întârziată nu se stinge corect când Pornit devine FALSE. De ce?',
  o:['TON trebuie apelat doar o dată pe oră','Instanța TON se execută doar când Pornit = TRUE, deci își păstrează ultima stare','PT trebuie dat în milisecunde'],a:1,
  ex:'Un temporizator trebuie apelat în fiecare ciclu; condiția se dă la intrarea IN, nu printr-un IF în jurul apelului.'},
 {code:'IF #TT101 = 37.0 THEN\n   #Pas := 3;\nEND_IF;',
  q:'Tranziția către menținere nu apare niciodată. Care este cauza cea mai probabilă?',
  o:['Egalitatea exactă dintre un REAL măsurat și o constantă aproape niciodată nu este adevărată','37.0 nu este o constantă validă în SCL','Pas trebuie să fie de tip Real'],a:0,
  ex:'Mărimile analogice zgomotoase se compară cu ≥ sau ≤ (eventual cu histerezis), niciodată cu =.'},
 {code:'#Temp10 := #TT101_raw * 100 / 27648;   // Int',
  q:'La temperaturi mari rezultatul este negativ sau absurd. De ce?',
  o:['Împărțirea la 27648 nu este permisă','Produsul raw × 100 depășește 32767 (limita Int) înainte de împărțire','Variabila ar trebui declarată Bool'],a:1,
  ex:'Pentru raw = 27648 produsul este 2 764 800. Se folosește DInt sau Real pentru calcule intermediare (sau NORM_X/SCALE_X).'},
 {code:'IF #LSH101 THEN\n   #Contor := #Contor + 1;\nEND_IF;',
  q:'Contorul numără mii de umpleri la o singură umplere. Ce lipsește?',
  o:['Detecția frontului crescător (R_TRIG sau memorarea valorii precedente)','Un temporizator TON de 1 s','Conversia lui LSH101 în Int'],a:0,
  ex:'Condiția este adevărată în fiecare ciclu de scanare. Contorizarea cere front: IF #LSH101 AND NOT #LSH101_prev.'},
 {code:'// Rețea 1 (FB_Umplere)\n#XV101 := #Umple;\n// Rețea 7 (FB_Alarme)\n#XV101 := FALSE;',
  q:'Electrovana nu se deschide niciodată, deși Umple = TRUE. De ce?',
  o:['Ieșirea este comandată din două locuri: ultima atribuire din ciclu câștigă','XV101 trebuie să fie de tip Int','Alarmele nu pot comanda ieșiri'],a:0,
  ex:'O ieșire se comandă dintr-un singur loc. Dacă mai multe funcții cer comanda, se combină explicit (OR/AND, prioritate) într-un singur punct.'}];
(function(){$('bugs').innerHTML=BUGS.map((b,i)=>'<div style="margin-bottom:14px"><pre class="code">'+esc(b.code)+'</pre><p style="margin:6px 0"><b>'+(i+1)+'.</b> '+esc(b.q)+'</p>'+b.o.map((o,j)=>'<label class="opt"><input type="radio" name="bg'+i+'" value="'+j+'"> '+esc(o)+'</label>').join('')+'<button class="b s" data-b="'+i+'">Verifică</button> <span id="bgr'+i+'"></span></div>').join('');
 $('bugs').querySelectorAll('button[data-b]').forEach(e=>e.onclick=()=>{const i=+e.dataset.b,sel=document.querySelector('input[name=bg'+i+']:checked');const r=$('bgr'+i);if(!sel){r.innerHTML='<span class="warn">alegeți un răspuns</span>';return;}
  r.innerHTML=(+sel.value===BUGS[i].a?'<span class="ok">✔ Corect. </span>':'<span class="bad">✖ Nu. </span>')+'<small>'+esc(BUGS[i].ex)+'</small>';});})();

/* ---------- 5. desfășurare ---------- */
const EX=[
 '<b>A1 – Modelul în V.</b> În fila 1 parcurgeți fazele și bifați verificările pentru un proiect propus de dumneavoastră. Pentru fiecare fază scrieți un livrabil concret și o eroare pe care ar prinde-o.',
 '<b>A2 – Lista I/E.</b> În fila 2 încărcați exemplul. Adăugați un senzor analogic de nivel LT101 (0–100 %, 4–20 mA) și un buton de pornire manuală a agitatorului. Citiți avertismentele (capacitate CPU 1215C, pini Uno) și propuneți o soluție. Calculați cu scalerul valoarea pentru codul brut 20000 și rezoluția.',
 '<b>A3 – GRAFCET.</b> În fila 3 rulați șarja (START) și observați diagrama. Adăugați un pas S5 „Clătire” (XV101 timp de 5 s) între golire și repaus, cu tranzițiile necesare; verificați modelul și rulați din nou.',
 '<b>A4 – Defecte.</b> Bifați pe rând LSH101 blocat, LSL101 blocat, TT101 înghețat și ES101. Descrieți comportamentul și momentul avariei.',
 '<b>A5 – Testare.</b> În fila 4 rulați cele 7 teste. Setați timeout-ul de umplere la 60 s și rulați din nou: ce test pică și de ce? Stabiliți o valoare justificată pentru t max.',
 '<b>A6 – Mutanți.</b> Rulați mutanții. Pentru mutantul scăpat M3 (START cu rezervorul plin) scrieți un test nou (descriere, intrări, rezultat așteptat).',
 '<b>A7 – Depanare.</b> Rezolvați cele 5 fragmente de cod din fila 4.',
 '<b>B – Program PLC (S7-1215C).</b> Generați SCL din fila 3 și salvați-l ca <code>FB_Sequencer.scl</code> (există și varianta din <code>plc/</code>). În TIA Portal: importați sursa externă (Add new external file → Generate blocks from source), creați DB-ul de instanță, apelați FB-ul în OB1 cu semnalele din lista I/E, încărcați în CPU sau în PLCSIM și testați cu tabelul de observare, forțând LSL/LSH/ES. Comparați secvența cu simularea web. <small>Pașii nu au fost verificați pe echipamentul laboratorului.</small>',
 '<b>C – Arduino.</b> Încărcați <code>arduino/09_sequencer_sfc</code>. START/STOP/ES/LSL/LSH sunt întrerupătoare către GND, LM35 pe A0 (sau potențiometru), ieșirile sunt LED-uri. Urmăriți pașii în monitorul serial (9600) și provocați o avarie.',
 '<b>D – Test automat în Python.</b> Rulați <code>python sil/test_sequencer.py</code>. Scenariile sunt aceleași cu cele din fila 4. Comparați rezultatele și explicați de ce un model software poate înlocui, în prima fază, instalația reală.',
 '<b>E – Git.</b> Inițializați un depozit în <code>docs/</code>: <code>git init</code>, primul commit cu <code>lista_IO.csv</code> și specificația, o ramură pentru modificarea A3, un commit cu mesaj clar, <code>git diff</code>, îmbinare și <code>git tag v1.0</code>. Completați <code>CHANGELOG.md</code>.'];
$('ex').innerHTML=EX.map(x=>'<li style="margin-bottom:8px">'+x+'</li>').join('');
const Q=['Care sunt fazele modelului în V și ce verifică fiecare fază din dreapta?','De ce o cerință trebuie să fie testabilă? Dați un exemplu bun și unul prost.','Ce conține o listă I/E și la ce folosește convenția de nume?','Care este diferența dintre un pas, o tranziție și o acțiune într-un GRAFCET?','De ce fiecare pas cu așteptare are un timeout către starea de avarie?','Ce este o acțiune nememorată și cum se traduce în SCL?','Ce înseamnă testarea prin mutații și ce arată un mutant „scăpat”?','De ce o ieșire se comandă dintr-un singur loc al programului?','Ce aduce versionarea cu Git unui proiect de automatizare?'];
$('qs').innerHTML=Q.map(x=>'<li>'+x+'</li>').join('');
$('rep').onclick=()=>{if(!TR)runTests();const ad=addrs();let t='RAPORT – Lucrarea 7: Dezvoltarea aplicațiilor de automatizare\nGenerat: '+new Date().toLocaleString('ro-RO')+'\n\n== Lista I/E ==\n';
 S.io.forEach((s,i)=>{t+=[s.tag,s.type,ad[i].a,ad[i].p,s.desc,s.unit?s.unit+' '+s.min+'…'+s.max:''].join(' | ')+'\n';});
 t+='\n== Model GRAFCET ==\n'+JSON.stringify(M,null,1)+'\n\n== Teste ==\n';TR.forEach(r=>{t+=r.id+' '+r.name+': '+(r.ok?'trecut':'CĂZUT – '+r.errs.join('; '))+'\n';});
 t+='\n== Mutanți ==\n';MUT.forEach(([id,nm,f])=>{const m=clone(M);if(!f(m)){t+=id+' '+nm+': nu se poate aplica\n';return;}const rs=SFC.runTests(m);const bad=rs.filter(r=>!r.ok).map(r=>r.id);t+=id+' '+nm+': '+(bad.length?'detectat de '+bad.join(','):'SCĂPAT')+'\n';});
 let n=0,tot=0;PH.forEach(q=>q.chk.forEach((_,i)=>{tot++;if(S.chk[q.id+i])n++;}));t+='\n== Checklist model în V ==\n'+n+' / '+tot+' verificări bifate\n';
 dl('raport_lucrarea7.txt',t);};
/* inițializare */
renderV();renderIO();renderModel();modelChanged();runTests();
window.__l7={S:S,get M(){return M;},runTests:runTests,get run(){return run;},simReset:simReset,pulse:pulse};
})();
