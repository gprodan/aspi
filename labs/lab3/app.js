(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fx=(v,d)=>(Number.isFinite(v)?v.toFixed(d):'–');
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('main>section').forEach(s=>s.classList.toggle('on',s.id===b.dataset.t));redrawAll();});
function dl(name,txt){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
const kv=(el,a)=>{$(el).innerHTML=a.map(x=>'<div><span>'+x[0]+'</span><b'+(x[2]?' class="'+x[2]+'"':'')+'>'+x[1]+'</b></div>').join('');};
let seed=12345;function rnd(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
function gauss(){let u=0,v=0;while(!u)u=rnd();v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
/* grafic generic */
function chart(cv,ser,o){o=o||{};const c=cv.getContext('2d'),W=cv.width,H=cv.height,pl=40,pb=20,pt=8,pr=18;c.clearRect(0,0,W,H);
 const fg=getComputedStyle(document.body).color;let x0=o.x0,x1=o.x1,y0=o.y0,y1=o.y1;
 if(x0==null){x0=Infinity;x1=-Infinity;ser.forEach(s=>s.p.forEach(q=>{x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);}));}
 if(y0==null){y0=Infinity;y1=-Infinity;ser.forEach(s=>s.p.forEach(q=>{y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}));const m=(y1-y0)*.08||1;y0-=m;y1+=m;}
 const X=x=>pl+(W-pl-pr)*(x-x0)/((x1-x0)||1),Y=y=>H-pb-(H-pb-pt)*(y-y0)/((y1-y0)||1);
 c.font='11px system-ui';c.fillStyle=fg;c.strokeStyle=fg;
 const ny=4;for(let i=0;i<=ny;i++){const v=y0+(y1-y0)*i/ny,y=Y(v);c.globalAlpha=.2;c.beginPath();c.moveTo(pl,y);c.lineTo(W-pr,y);c.stroke();c.globalAlpha=.7;c.fillText(Math.abs(v)>=100?v.toFixed(0):v.toFixed(1),2,y+4);}
 const nx=5;for(let i=0;i<=nx;i++){const v=x0+(x1-x0)*i/nx;c.globalAlpha=.7;c.fillText(Math.abs(v)>=100?v.toFixed(0):v.toFixed(1),X(v)-8,H-5);}
 c.globalAlpha=1;
 (o.vlines||[]).forEach(v=>{c.setLineDash([4,4]);c.strokeStyle='#8b9bb0';c.beginPath();c.moveTo(X(v),pt);c.lineTo(X(v),H-pb);c.stroke();c.setLineDash([]);});
 ser.forEach(s=>{c.strokeStyle=s.c;c.lineWidth=s.w||2;c.setLineDash(s.d?[5,4]:[]);c.beginPath();s.p.forEach((q,i)=>{const x=X(q[0]),y=Y(q[1]);i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();});c.setLineDash([]);
 if(o.legend){let x=pl+8;o.legend.forEach(l=>{c.fillStyle=l[1];c.fillRect(x,pt+2,14,4);c.fillStyle=fg;c.globalAlpha=.85;c.fillText(l[0],x+18,pt+8);x+=c.measureText(l[0]).width+40;c.globalAlpha=1;});}
 return{X:X,Y:Y};}
const COL={a:'#4aa3ff',b:'#1e9e5a',c:'#e08a00',d:'#d23c3c',e:'#8b6ad6'};

/* ---------- 1. senzori ---------- */
const SENS=[
 {n:'Pt100 + traductor 4–20 mA (0…100 °C)',u:'°C',lo:0,hi:100,sig:'mA'},
 {n:'Traductor de presiune 4–20 mA (0…10 bar)',u:'bar',lo:0,hi:10,sig:'mA'},
 {n:'Traductor de nivel 4–20 mA (0…5 m)',u:'m',lo:0,hi:5,sig:'mA'},
 {n:'LM35 (0…100 °C, 10 mV/°C)',u:'°C',lo:0,hi:100,sig:'V',vlo:0,vhi:1},
 {n:'Potențiometru de nivel (0…100 %, 0…5 V)',u:'%',lo:0,hi:100,sig:'V',vlo:0,vhi:5},
 {n:'Traductor de turație 0–10 V (0…1000 rpm)',u:'rpm',lo:0,hi:1000,sig:'V',vlo:0,vhi:10},
 {n:'Termocuplu K (0…400 °C, ≈ 41 µV/°C)',u:'°C',lo:0,hi:400,sig:'mV',vlo:0,vhi:16.4}];
$('sSel').innerHTML=SENS.map((s,i)=>'<option value="'+i+'">'+esc(s.n)+'</option>').join('');
let sLast={};
function renderSens(){const s=SENS[+$('sSel').value],fr=+$('sX').value/100,v=s.lo+(s.hi-s.lo)*fr,brk=$('sBreak').checked;$('sXv').textContent=fx(v,s.hi>=100?1:2)+' '+s.u;
 const span=s.hi-s.lo,rows=[['Mărime',fx(v,s.hi>=100?1:2)+' '+s.u]];let msg='',note='';
 if(s.sig==='mA'){const I=brk?0:4+16*fr;rows.push(['Semnal',fx(I,2)+' mA']);
  const V=I*0.25;rows.push(['Pe rezistor 250 Ω',fx(V,3)+' V']);
  const a=Math.round(V/5*1023);rows.push(['Arduino 10 biți',a+' / 1023']);rows.push(['Rezoluție Arduino',fx(span/819,3)+' '+s.u+'/pas']);
  const q=brk?0:Math.round(5530+(27648-5530)*fr);rows.push(['S7-1200 (4–20 mA)',q+' / 27648']);rows.push(['Rezoluție S7 (nominal)',fx(span/22118,4)+' '+s.u+'/pas']);
  if(brk)msg='<span class="bad">I &lt; 3,6 mA: defect de buclă detectat (codul sub 5530 este semnalizat ca depășire inferioară)</span>';else msg='<span class="ok">Semnal în domeniul 4–20 mA</span>';
  note='Zeroul „viu” de 4 mA permite diagnoza firului rupt; tensiunea de 1…5 V pe rezistorul de 250 Ω utilizează 82 % din domeniul ADC-ului de 5 V.';sLast={I:I};}
 else if(s.sig==='V'){const V=brk?0:s.vlo+(s.vhi-s.vlo)*fr;rows.push(['Semnal',fx(V,3)+' V']);
  const vin=s.vhi>5?V/2:V;if(s.vhi>5)rows.push(['După divizor 2:1',fx(vin,3)+' V']);
  rows.push(['Arduino 10 biți (ref. 5 V)',Math.round(vin/5*1023)+' / 1023']);const used=(s.vhi>5?s.vhi/2:s.vhi)/5*1023;rows.push(['Rezoluție Arduino',fx(span/used,3)+' '+s.u+'/pas']);
  const q=Math.round(V/10*27648);rows.push(['S7-1200 (0–10 V)',q+' / 27648']);rows.push(['Domeniu folosit',fx(100*(s.vhi-s.vlo)/10,0)+' % din 0…10 V']);
  msg=brk?'<span class="warn">0 V este o valoare validă (mărime minimă): lipsa semnalului nu se poate deosebi de zero</span>':'<span class="ok">Semnal în domeniu</span>';
  note=s.vhi<=1?'LM35 ocupă doar 20 % din domeniul ADC-ului de 5 V: rezoluție slabă. Se folosește referința internă de 1,1 V (analogReference(INTERNAL)) sau un amplificator.':'Un semnal de tensiune este sensibil la perturbații și căderi pe fir; pentru distanțe mari se preferă bucla de curent.';}
 else{const mV=brk?0:s.vlo+(s.vhi-s.vlo)*fr;rows.push(['Semnal',fx(mV,2)+' mV']);rows.push(['Intrare directă ADC','nu este posibilă']);rows.push(['Soluție','amplificator cu compensare de joncțiune rece (ex. AD8495) sau modul pentru termocuplu']);
  msg='<span class="warn">Semnal de ordinul milivolților: cere amplificare și compensarea joncțiunii reci</span>';note='Termocuplul măsoară diferența dintre joncțiunea caldă și cea rece; fără compensare, citirea este eronată cu temperatura bornelor.';}
 kv('sKv',rows);$('sMsg').innerHTML=msg;$('sNote').textContent=note;}
$('sSel').onchange=$('sX').oninput=$('sBreak').onchange=renderSens;
/* Pt100 */
const A_=3.9083e-3,B_=-5.775e-7,C_=-4.183e-12;
const rPt=T=>100*(1+A_*T+B_*T*T+(T<0?C_*(T-100)*T*T*T:0));
function tPt(R){let T=(R/100-1)/A_;for(let i=0;i<30;i++){const f=rPt(T)-R,h=1e-3,d=(rPt(T+h)-rPt(T-h))/(2*h);T-=f/d;}return T;}
function renderWire(){const T=+$('wT').value,rl=+$('wR').value,dd=+$('wD').value;$('wTv').textContent=T+' °C';$('wRv').textContent=fx(rl,2)+' Ω';$('wDv').textContent=fx(dd,2)+' Ω';
 const R=rPt(T),rows=[['2 fire',R+2*rl],['3 fire',R+dd],['4 fire',R]];
 $('wTb').innerHTML='<tr><th>Legare</th><th>R măsurată</th><th>T afișată</th><th>Eroare</th></tr>'+rows.map(r=>{const t=tPt(r[1]);return'<tr><td>'+r[0]+'</td><td>'+fx(r[1],2)+' Ω</td><td>'+fx(t,2)+' °C</td><td class="'+(Math.abs(t-T)>0.5?'bad':'ok')+'">'+fx(t-T,2)+' °C</td></tr>';}).join('')+'<tr><td colspan="4"><small>R(Pt100) la '+T+' °C = '+fx(R,2)+' Ω; sensibilitate ≈ '+fx(rPt(T+1)-R,3)+' Ω/°C</small></td></tr>';}
$('wT').oninput=$('wR').oninput=$('wD').oninput=renderWire;
/* calibrare */
function renderCal(){const r1=+$('c1r').value,m1=+$('c1m').value,r2=+$('c2r').value,m2=+$('c2m').value,x=+$('cX').value;$('cXv').textContent=fx(x,1);
 const g=(r2-r1)/(m2-m1),o=r1-g*m1;kv('cKv',[['Câștig corecție',fx(g,4)],['Decalaj',fx(o,3)],['Citire brută',fx(x,2)],['Valoare corectată',fx(g*x+o,2)],['Eroare brută la mijloc',fx((m1+m2)/2-(r1+r2)/2,2)]]);
 $('cCode').textContent='float corecteaza(float x) {\n  return '+fx(g,4)+'f * x + ('+fx(o,3)+'f);\n}';}
['c1r','c1m','c2r','c2m'].forEach(i=>$(i).oninput=renderCal);$('cX').oninput=renderCal;
/* zgomot */
let noiseData=null;
function genNoise(){seed=777;const n=200,s=+$('nS').value||0;noiseData={x:[],r:[]};for(let i=0;i<n;i++){const t=i<100?50:70;noiseData.x.push(t);noiseData.r.push(t+s*gauss());}renderNoise();}
function renderNoise(){if(!noiseData)return;const a=Math.min(1,Math.max(0.01,+$('nA').value)),m=$('nM').value,r=noiseData.r,f=[];
 if(m==='ema'){let y=r[0];r.forEach(x=>{y+=a*(x-y);f.push(y);});}else{r.forEach((x,i)=>{const w=r.slice(Math.max(0,i-4),i+1).sort((p,q)=>p-q);f.push(w[Math.floor(w.length/2)]);});}
 const sd=arr=>{const sl=arr.slice(40,95);const mu=sl.reduce((p,q)=>p+q,0)/sl.length;return Math.sqrt(sl.reduce((p,q)=>p+(q-mu)*(q-mu),0)/sl.length);};
 let d=0;for(let i=100;i<200;i++){if(f[i]>=50+0.632*20){d=i-100;break;}}
 chart($('nCv'),[{p:r.map((v,i)=>[i,v]),c:'#8b9bb0',w:1},{p:f.map((v,i)=>[i,v]),c:COL.a},{p:noiseData.x.map((v,i)=>[i,v]),c:COL.c,d:1,w:1}],{legend:[['brut','#8b9bb0'],['filtrat',COL.a],['valoarea reală',COL.c]]});
 const s0=sd(r),s1=sd(f);kv('nKv',[['σ brut',fx(s0,2)],['σ filtrat',fx(s1,2)],['reducere',s1>0?'×'+fx(s0/s1,1):'–'],['întârziere (63 %)',d+' eșantioane']]);}
$('nGo').onclick=genNoise;$('nS').onchange=genNoise;$('nA').oninput=$('nM').onchange=renderNoise;

/* ---------- 2. actuatoare ---------- */
const VF={lin:x=>x,eq:x=>Math.pow(50,x-1),qo:x=>Math.sqrt(x)};
const inst=(f,b)=>f/Math.sqrt(b+(1-b)*f*f);
function renderValve(){const b=+$('vB').value,x=+$('vX').value;$('vBv').textContent=fx(b,2);$('vXv').textContent=x+' %';
 const mk=f=>{const p=[];for(let i=0;i<=100;i+=2)p.push([i,100*inst(f(i/100),b)]);return p;};
 chart($('vCv'),[{p:mk(VF.lin),c:COL.a},{p:mk(VF.eq),c:COL.b},{p:mk(VF.qo),c:COL.c},{p:[[0,0],[100,100]],c:'#8b9bb0',d:1,w:1}],{x0:0,x1:100,y0:0,y1:100,vlines:[x],legend:[['liniară',COL.a],['procent egal',COL.b],['deschidere rapidă',COL.c]]});
 const g=f=>{const h=.05,x1=Math.min(1,x/100+h),x0=Math.max(0,x/100-h);return 100*(inst(f(x1),b)-inst(f(x0),b))/(100*(x1-x0));};
 kv('vKv',[['Q liniară',fx(100*inst(VF.lin(x/100),b),1)+' %'],['Q procent egal',fx(100*inst(VF.eq(x/100),b),1)+' %'],['Q desch. rapidă',fx(100*inst(VF.qo(x/100),b),1)+' %'],['câștig liniară',fx(g(VF.lin),2)],['câștig proc. egal',fx(g(VF.eq),2)],['câștig desch. rapidă',fx(g(VF.qo),2)]]);}
$('vB').oninput=$('vX').oninput=renderValve;
function renderPwm(){const d=+$('pD').value,P=+$('pP').value,W=+$('pW').value;$('pDv').textContent=d+' %';$('pPv').textContent=P+' s';$('pWv').textContent=W+' W';
 const p=[];for(let k=0;k<3;k++){p.push([k*P,0],[k*P,1],[k*P+P*d/100,1],[k*P+P*d/100,0],[(k+1)*P,0]);}
 chart($('pCv'),[{p:p,c:COL.a}],{x0:0,x1:3*P,y0:-0.1,y1:1.2});
 const sw=3600/P,life=+$('pDev').value,days=life/(2*sw*24);
 kv('pKv',[['Puterea medie',fx(W*d/100,0)+' W'],['Comutări / oră',fx(2*sw,0)],['Durata de viață',life>=1e9?'practic nelimitată':(days<1?fx(days*24,1)+' h':fx(days,0)+' zile')],['Timp pornit',fx(P*d/100,1)+' s']]);}
$('pD').oninput=$('pP').oninput=$('pW').oninput=$('pDev').onchange=renderPwm;
function renderVfd(){const f=+$('fF').value,r=f/50;$('fFv').textContent=f+' Hz';
 const pc=[],pv=[];for(let q=20;q<=100;q+=2){pv.push([q,100*Math.pow(q/100,3)]);pc.push([q,100*(0.45+0.55*q/100)]);}
 chart($('fCv'),[{p:pc,c:COL.d},{p:pv,c:COL.b}],{x0:20,x1:100,y0:0,y1:100,vlines:[100*r],legend:[['strangulare',COL.d],['convertizor',COL.b]]});
 const pt=100*(0.45+0.55*r),pvv=100*r*r*r;
 kv('fKv',[['Turația',fx(100*r,0)+' %'],['Debit Q',fx(100*r,0)+' %'],['Înălțime H',fx(100*r*r,0)+' %'],['Putere cu convertizor',fx(pvv,0)+' %'],['Putere cu strangulare',fx(pt,0)+' %'],['Economie',fx(pt-pvv,0)+' puncte %','ok']]);}
$('fF').oninput=renderVfd;

/* ---------- 3. reglare ---------- */
function simLoop(P){
 const dt=0.1,N=Math.round((P.tend||600)/dt),dly=Math.max(0,Math.round(P.L/dt));const buf=new Array(dly+1).fill(0);
 seed=4242;let y=0,I=0,dF=0,ymPrev=0,relay=0,first=true;const o={t:[],sp:[],y:[],ym:[],u:[]};
 for(let k=0;k<N;k++){const t=k*dt;
  const sp=P.openloop?0:(t<10?0:t<300?50:P.sp2);
  const ym=y+(P.sg?P.sg*gauss():0);if(first){ymPrev=ym;first=false;}
  let u=0;
  if(P.openloop){u=t<10?0:P.du;}
  else{const e=sp-ym;
   if(P.mode==='ON/OFF'){if(ym<sp-P.hy/2)relay=1;else if(ym>sp+P.hy/2)relay=0;u=(P.sat?P.umax:100)*relay;}
   else if(P.mode==='P'){u=P.kp*e;if(P.sat)u=Math.min(P.umax,Math.max(0,u));}
   else{let D=0;if(P.mode==='PID'&&P.td>0){const al=dt/(P.td/10+dt);dF+=al*(-P.kp*P.td*(ym-ymPrev)/dt-dF);D=dF;}
    const Iinc=P.ti>0?P.kp*e*dt/P.ti:0;const un=P.kp*e+I+D;
    if(P.sat&&P.aw){if(!((un>=P.umax&&Iinc>0)||(un<=0&&Iinc<0)))I+=Iinc;}else I+=Iinc;
    u=P.kp*e+I+D;if(P.sat)u=Math.min(P.umax,Math.max(0,u));}}
  ymPrev=ym;
  buf.push(u);const ud=buf.shift();
  const d=(!P.openloop&&t>=500)?P.dist:0;
  y+=((P.K*(ud+d)-y)/P.T)*dt;
  o.t.push(t);o.sp.push(sp);o.y.push(y);o.ym.push(ym);o.u.push(u);}
 return o;}
function metrics(o,P){const N=o.t.length,i0=100,i1=3000;let mx=-1e9;for(let i=i0;i<i1;i++)mx=Math.max(mx,o.y[i]);
 const os=Math.max(0,(mx-50)/50*100);let ts=NaN,last=i0;for(let i=i0;i<i1;i++)if(Math.abs(o.y[i]-50)>1)last=i;ts=last>=i1-1?NaN:(o.t[last]-10);
 let iae=0;for(let i=i0;i<i1;i++)iae+=Math.abs(o.sp[i]-o.y[i])*0.1;
 let dev=0;for(let i=5000;i<N;i++)dev=Math.max(dev,Math.abs(o.y[i]-P.sp2));let rec=NaN,l2=5000;for(let i=5000;i<N;i++)if(Math.abs(o.y[i]-P.sp2)>1)l2=i;rec=l2>=N-1?NaN:(o.t[l2]-500);
 let ess=Math.abs(o.y[2990]-50);
 const dir=Math.sign(P.sp2-50)||1;let ext=dir>0?-1e9:1e9;for(let i=3000;i<5000;i++)ext=dir>0?Math.max(ext,o.y[i]):Math.min(ext,o.y[i]);
 const os2=Math.abs(P.sp2-50)>0?Math.max(0,dir*(ext-P.sp2))/Math.abs(P.sp2-50)*100:0;let l3=3000;for(let i=3000;i<5000;i++)if(Math.abs(o.y[i]-P.sp2)>1)l3=i;const ts2=l3>=4999?NaN:(o.t[l3]-300);
 return{os2:os2,ts2:ts2,os:os,ts:ts,iae:iae,dev:dev,rec:rec,ess:ess};}
function parsP(){return{K:+$('K').value,T:Math.max(1,+$('T').value),L:Math.max(0,+$('L').value),sg:+$('sg').value,mode:$('mode').value,kp:+$('kp').value,ti:+$('ti').value,td:+$('td').value,hy:+$('hy').value,aw:$('aw').checked,sat:$('sat').checked,umax:Math.max(1,+$('umax').value||100),sp2:+$('sp2').value,dist:+$('dist').value};}
let lastM=null,lastP=null;
function renderLoop(){const P=parsP();const o=simLoop(P);const m=metrics(o,P);lastM=m;lastP=P;
 chart($('rCv'),[{p:o.t.map((t,i)=>[t,o.sp[i]]),c:COL.c,d:1,w:1.5},{p:o.t.map((t,i)=>[t,o.ym[i]]),c:'#8b9bb0',w:1},{p:o.t.map((t,i)=>[t,o.y[i]]),c:COL.a}],{x0:0,x1:600,vlines:[10,300,500],legend:[['consemn',COL.c],['măsurat','#8b9bb0'],['mărime reglată',COL.a]]});
 chart($('uCv'),[{p:o.t.map((t,i)=>[t,o.u[i]]),c:COL.b}],{x0:0,x1:600,legend:[['comandă u [%]',COL.b]]});
 kv('rKv',[['Depășire',fx(m.os,1)+' %',m.os>25?'warn':''],['Timp de stabilire (±1)',Number.isFinite(m.ts)?fx(m.ts,0)+' s':'nu se stabilește','' ],['IAE (treaptă)',fx(m.iae,0)],['Eroare staționară',fx(m.ess,2)],['Depășire, a doua treaptă',fx(m.os2,1)+' %',m.os2>25?'warn':''],['Stabilire, a doua treaptă',Number.isFinite(m.ts2)?fx(m.ts2,0)+' s':'nu se stabilește'],['Abatere maximă perturbație',fx(m.dev,1)],['Recuperare',Number.isFinite(m.rec)?fx(m.rec,0)+' s':'nu revine']]);}
['K','T','L','sg','mode','kp','ti','td','hy','aw','sat','umax','sp2','dist'].forEach(i=>{$(i).oninput=$(i).onchange=renderLoop;});
let est=null;
function tune(kind){const K=est?est.K:+$('K').value,T=est?est.T:+$('T').value,L=Math.max(0.5,est?est.L:+$('L').value);
 if(kind==='pi'){$('mode').value='PI';$('kp').value=fx(0.9*T/(K*L),2);$('ti').value=fx(3.33*L,1);$('td').value=0;}
 if(kind==='pid'){$('mode').value='PID';$('kp').value=fx(1.2*T/(K*L),2);$('ti').value=fx(2*L,1);$('td').value=fx(0.5*L,1);}
 if(kind==='imc'){$('mode').value='PI';$('kp').value=fx(T/(K*(L+L)),2);$('ti').value=fx(T,1);$('td').value=0;}
 renderLoop();}
$('zn1').onclick=()=>tune('pi');$('zn2').onclick=()=>tune('pid');$('imc').onclick=()=>tune('imc');
function ident(){const P=parsP();P.openloop=true;P.du=+$('idu').value||20;P.tend=Math.max(150,Math.round(8*P.T+P.L+40));const o=simLoop(P);
 const n=o.t.length,i10=100,sm=o.ym.map((v,i)=>{let s=0,c=0;for(let j=Math.max(0,i-5);j<=Math.min(n-1,i+5);j++){s+=o.ym[j];c++;}return s/c;});
 let yf=0;for(let i=n-100;i<n;i++)yf+=sm[i];yf/=100;const y0=sm[50];const dy=yf-y0;
 const cross=f=>{const tg=y0+f*dy;for(let i=i10;i<n;i++)if(sm[i]>=tg){return o.t[i]-10;}return NaN;};
 const t28=cross(0.283),t63=cross(0.632);const T=1.5*(t63-t28),L=t63-T,K=dy/P.du;
 est={K:K,T:T,L:L};
 chart($('iCv'),[{p:o.t.map((t,i)=>[t,o.ym[i]]),c:'#8b9bb0',w:1},{p:o.t.map((t,i)=>[t,sm[i]]),c:COL.a},{p:[[10+t28,y0],[10+t28,y0+0.283*dy]],c:COL.c,w:3},{p:[[10+t63,y0],[10+t63,y0+0.632*dy]],c:COL.d,w:3}],{vlines:[10]});
 kv('iKv',[['K estimat',fx(K,2)+' (real '+fx(P.K,2)+')'],['T estimat',fx(T,1)+' s (real '+fx(P.T,0)+')'],['L estimat',fx(L,1)+' s (real '+fx(P.L,1)+')'],['t28,3 / t63,2',fx(t28,1)+' / '+fx(t63,1)+' s']]);}
$('idr').onclick=ident;$('idn').onclick=()=>{ident();$('iCv').scrollIntoView({behavior:'smooth',block:'center'});};

/* ---------- 5. desfășurare ---------- */
const EX=[
 '<b>A1 – Lanțul de măsurare.</b> În fila 1 alegeți traductorul 4–20 mA de temperatură. Pentru 25, 50 și 75 % din domeniu notați curentul, codul Arduino și codul S7. Verificați manual: la 50 % curentul este 12 mA și codul S7 este 16589. Simulați firul rupt și explicați de ce un semnal de tensiune nu poate semnaliza același defect.',
 '<b>A2 – Rezoluția.</b> Comparați LM35 și potențiometrul pe Arduino: câte unități fizice corespund unui pas? Ce se schimbă dacă referința ADC devine 1,1 V pentru LM35?',
 '<b>A3 – Pt100.</b> La 100 °C și 1,2 Ω pe fir, calculați eroarea cu 2 fire (≈ 6,3 °C), apoi verificați în aplicație. Care este eroarea la 3 fire dacă diferența dintre fire este 0,05 Ω?',
 '<b>A4 – Calibrare.</b> Cu citirile 1,8 la 0 °C și 101,9 la 100 °C calculați corecția; ce eroare rămâne la 50 °C dacă traductorul este neliniar cu 0,3 °C la mijloc?',
 '<b>A5 – Filtrare.</b> Variați α între 0,05 și 0,5 pentru σ = 1,5. Alegeți valoarea care reduce zgomotul de cel puțin 3 ori cu întârziere sub 15 eșantioane și comparați cu mediana pe 5.',
 '<b>A6 – Valve.</b> În fila 2 ridicați caracteristicile instalate pentru β = 1; 0,5 și 0,1. Ce caracteristică intrinsecă păstrează câștigul cel mai constant la β mic? Explicați.',
 '<b>A7 – Încălzire.</b> Pentru o rezistență de 1000 W cu perioadă de 10 s și factor 35 %, calculați puterea medie și numărul de comutări pe oră. Câte zile rezistă contactorul? Ce perioadă alegeți cu SSR?',
 '<b>A8 – Regulatoare.</b> În fila 3 rulați pe rând ON/OFF, P, PI și PID pe procesul K = 1,5, T = 40, L = 6. Completați tabelul de metrici (depășire, timp de stabilire, IAE, eroare staționară, abatere la perturbație).',
 '<b>A9 – Windup.</b> Cu PI (Kp = 1,2; Ti = 25) limitați ieșirea la 30 % (actuator subdimensionat: consemnul de 50 nu poate fi atins) și setați consemnul final la 40. Comparați, cu și fără anti-windup, depășirea și timpul de stabilire la a doua treaptă.',
 '<b>A10 – Identificare și acordare.</b> Rulați identificarea cu σ = 0 și apoi σ = 1; comparați K, T, L estimate cu cele reale. Acordați PI cu ZN și cu IMC și comparați răspunsurile.',
 '<b>B – Reactorul 3D.</b> În fila 4 acordați regulatorul de nivel (Kp, Ki, Kd) pentru nivel țintă 60 % cu valva de golire la 20 %; apoi măriți perturbația la 60 %. Notați parametrii și comportarea.',
 '<b>C – PLC.</b> Importați <code>plc/FB_PI.scl</code> în TIA Portal și apelați-l dintr-un OB cu întrerupere ciclică de 100 ms; comparați cu PID_Compact (pașii sunt în <code>plc/README.md</code>). <small>Neverificat pe CPU-ul laboratorului.</small>',
 '<b>D – Python.</b> Rulați <code>python python/identificare_pid.py</code>: simulează procesul, identifică K, T, L, calculează acordurile și afișează metricile pentru fiecare metodă. Comparați cu fila 3.',
 '<b>E – Arduino (opțional).</b> Cu sketch-urile din lucrarea 4 (<code>03_senzori_histerezis</code>, <code>06_pi_regulator</code>) reglați temperatura unui LM35 încălzit cu un tranzistor sau releu; comparați ON/OFF și PI.'];
$('ex').innerHTML=EX.map(x=>'<li style="margin-bottom:8px">'+x+'</li>').join('');
const Q=['Care sunt elementele subsistemului de I/E dintre proces și PLC?','De ce semnalul 4–20 mA este preferat în industrie? Ce indică un curent sub 3,6 mA?','De ce se folosesc 3 sau 4 fire la Pt100?','Ce este calibrarea în două puncte și ce erori nu poate corecta?','Ce compromis există la alegerea constantei unui filtru?','Cum influențează autoritatea valvei caracteristica instalată?','De ce se comandă o rezistență cu PWM lent și nu cu ON/OFF rapid?','Ce spun legile de afinitate despre puterea unei pompe la jumătate de turație?','Ce este fenomenul de windup și cum se evită?','Cum se obțin parametrii FOPDT dintr-un răspuns la treaptă și ce reprezintă L?'];
$('qs').innerHTML=Q.map(x=>'<li>'+x+'</li>').join('');
$('rep').onclick=()=>{const m=lastM,P=lastP;let t='RAPORT – Lucrarea 3: Senzori, actuatoare, regulatoare\nGenerat: '+new Date().toLocaleString('ro-RO')+'\n\n';
 t+='== Lanț de măsurare ==\n'+SENS[+$('sSel').value].n+' la '+$('sXv').textContent+'\n'+[...$('sKv').querySelectorAll('div')].map(d=>d.innerText.replace(/\n/g,': ')).join('\n')+'\n\n';
 t+='== Calibrare ==\n'+$('cCode').textContent+'\n\n== Valvă ==\nβ = '+$('vB').value+', deschidere '+$('vX').value+' %\n'+[...$('vKv').querySelectorAll('div')].map(d=>d.innerText.replace(/\n/g,': ')).join('\n')+'\n\n';
 t+='== Regulator ==\n'+JSON.stringify(P)+'\n'+(m?['depășire '+fx(m.os,1)+' %','timp de stabilire '+fx(m.ts,0)+' s','IAE '+fx(m.iae,0),'eroare staționară '+fx(m.ess,2),'abatere perturbație '+fx(m.dev,1),'recuperare '+fx(m.rec,0)+' s'].join('\n'):'')+'\n';
 if(est)t+='\nIdentificare: K = '+fx(est.K,2)+', T = '+fx(est.T,1)+' s, L = '+fx(est.L,1)+' s\n';dl('raport_lucrarea3.txt',t);};
function redrawAll(){renderSens();renderWire();renderCal();renderNoise();renderValve();renderPwm();renderVfd();renderLoop();}
genNoise();redrawAll();ident();
window.__l3={simLoop:simLoop,metrics:metrics,get est(){return est;},tPt:tPt,rPt:rPt};
})();
