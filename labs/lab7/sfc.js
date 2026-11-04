/* Motor SFC/GRAFCET + instalație simulată (lucrarea 7). Rulează în browser și în Node (teste). */
(function(root){
'use strict';
const SFC={};
SFC.OUTS=['XV101','XV102','M101','EH101','HL101'];
SFC.defaultModel=function(){return{
 params:{SP:37,HOLD:20},
 fault:'S9',
 steps:[
  {id:'S0',name:'Repaus',act:'',tmax:0},
  {id:'S1',name:'Umplere',act:'XV101 = 1',tmax:24},
  {id:'S2',name:'Încălzire',act:'M101 = 1\nEH101 = TT101 < SP',tmax:60},
  {id:'S3',name:'Menținere',act:'M101 = 1\nEH101 = TT101 < SP - 0.5',tmax:0},
  {id:'S4',name:'Golire',act:'XV102 = 1\nM101 = 1',tmax:60},
  {id:'S9',name:'Avarie',act:'HL101 = 1',tmax:0}],
 trans:[
  {from:'*',to:'S9',cond:'ES101'},
  {from:'S0',to:'S1',cond:'PB101 && !LSL101'},
  {from:'S1',to:'S2',cond:'LSH101'},
  {from:'S2',to:'S3',cond:'TT101 >= SP'},
  {from:'S3',to:'S4',cond:'t >= HOLD'},
  {from:'S1',to:'S4',cond:'PB102'},
  {from:'S2',to:'S4',cond:'PB102'},
  {from:'S3',to:'S4',cond:'PB102'},
  {from:'S4',to:'S0',cond:'!LSL101'},
  {from:'S9',to:'S0',cond:'PB102 && !ES101'}]};};

function parseActs(txt){const r=[];String(txt||'').split('\n').forEach((l,i)=>{l=l.trim();if(!l||l.startsWith('//'))return;
 const m=l.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);r.push(m?{name:m[1],expr:m[2].replace(/;$/,'').trim()}:{err:'linia '+(i+1)+': «'+l+'» nu are forma NUME = expresie'});});return r;}
SFC.parseActs=parseActs;
const FN={};
function fn(expr){if(!FN[expr])FN[expr]=new Function('v','with(v){return ('+expr+');}');return FN[expr];}
function ev(expr,v){return fn(expr)(v);}
SFC.INPUTS=['PB101','PB102','ES101','LSL101','LSH101','TT101'];

/* validare model */
SFC.validate=function(m){
 const er=[],ids=m.steps.map(s=>s.id);
 const seen={};ids.forEach(i=>{if(!/^\w+$/.test(i))er.push('Identificator de pas invalid: «'+i+'»');if(seen[i])er.push('Pas duplicat: '+i);seen[i]=1;});
 if(!ids.includes(m.fault))er.push('Pasul de avarie «'+m.fault+'» nu există');
 const v={t:0};SFC.INPUTS.forEach(k=>v[k]=0);SFC.OUTS.forEach(k=>v[k]=0);Object.assign(v,m.params);
 m.steps.forEach(s=>{parseActs(s.act).forEach(a=>{if(a.err){er.push(s.id+' – '+a.err);return;}
   if(!SFC.OUTS.includes(a.name))er.push(s.id+': ieșirea «'+a.name+'» nu este în lista I/E ('+SFC.OUTS.join(', ')+')');
   try{ev(a.expr,v);}catch(e){er.push(s.id+': expresie invalidă «'+a.expr+'» ('+e.message+')');}});});
 m.trans.forEach((t,i)=>{if(t.from!=='*'&&!ids.includes(t.from))er.push('Tranziția '+(i+1)+': pas sursă inexistent «'+t.from+'»');
   if(!ids.includes(t.to))er.push('Tranziția '+(i+1)+': pas destinație inexistent «'+t.to+'»');
   try{ev(t.cond,v);}catch(e){er.push('Tranziția '+(i+1)+': condiție invalidă «'+t.cond+'» ('+e.message+')');}});
 /* atenționări structurale */
 const wr=[];
 ids.forEach((id,i)=>{if(i>0&&id!==m.fault&&!m.trans.some(t=>t.to===id))wr.push('Pasul '+id+' nu poate fi atins (nicio tranziție nu duce la el)');
   if(id!==m.fault&&!m.trans.some(t=>t.from===id||t.from==='*'))wr.push('Pasul '+id+' nu are tranziție de ieșire (blocaj)');});
 const out={};m.steps.forEach(s=>parseActs(s.act).forEach(a=>{if(a.name)out[a.name]=(out[a.name]||0)+1;}));
 return{errors:er,warnings:wr};};

/* instalația: rezervor cu umplere, agitator, încălzitor, golire */
function Plant(){this.L=0;this.T=20;this.Tamb=20;}
Plant.prototype.step=function(dt,o){
 this.L+=(o.XV101?4:0)*dt-(o.XV102?6:0)*dt;this.L=Math.max(0,Math.min(100,this.L));
 const heat=o.EH101&&this.L>1?60/(this.L+15):0;const mix=o.M101?1:0.55;
 this.T+=(heat*mix-0.012*(this.T-this.Tamb))*dt;};
SFC.Plant=Plant;

/* rulare: un ciclu de scanare = dt secunde simulate */
function Run(m,faults){this.m=m;this.p=new Plant();this.faults=faults||{};this.step=m.steps[0].id;this.t=0;this.time=0;
 this.btn={PB101:0,PB102:0,ES101:0};this.out={};SFC.OUTS.forEach(k=>this.out[k]=0);this.frozen=null;this.log=[];this.inp={};this.nTrans=0;}
Run.prototype.sense=function(){const p=this.p,f=this.faults,i={};
 i.LSL101=f.lslStuck?1:(p.L>5?1:0);i.LSH101=f.lshStuck?0:(p.L>=90?1:0);
 if(f.ttFrozen){if(this.frozen===null)this.frozen=p.T;i.TT101=this.frozen;}else{this.frozen=null;i.TT101=p.T;}
 Object.assign(i,this.btn);return i;};
Run.prototype.tick=function(dt){
 const m=this.m,i=this.sense();this.inp=i;const v=Object.assign({t:this.t},m.params,i);
 /* tranziții: întâi cele globale, apoi ale pasului activ */
 const cur=m.steps.find(s=>s.id===this.step);let go=null;
 for(const t of m.trans){if(t.from==='*'&&t.to!==this.step){let r=false;try{r=!!ev(t.cond,v);}catch(e){}if(r){go=t.to;break;}}}
 if(!go){for(const t of m.trans){if(t.from===this.step){let r=false;try{r=!!ev(t.cond,v);}catch(e){}if(r){go=t.to;break;}}}}
 if(!go&&cur&&cur.tmax>0&&this.t>cur.tmax&&this.step!==m.fault)go=m.fault;
 if(go&&go!==this.step){this.log.push({time:this.time,from:this.step,to:go});this.step=go;this.t=0;this.nTrans++;}
 /* ieșiri (acțiuni nememorate: se resetează la fiecare ciclu) */
 const o={};SFC.OUTS.forEach(k=>o[k]=0);
 const st=m.steps.find(s=>s.id===this.step);
 if(st)parseActs(st.act).forEach(a=>{if(a.name){try{o[a.name]=ev(a.expr,Object.assign({t:this.t},m.params,i))?1:0;}catch(e){o[a.name]=0;}}});
 this.out=o;this.p.step(dt,o);this.t+=dt;this.time+=dt;};
SFC.Run=Run;

/* scenariu headless */
SFC.runScenario=function(m,sc){
 const r=new Run(m,Object.assign({},sc.faults||{}));const dt=0.1,N=Math.round((sc.duration||200)/dt);const ev2=(sc.events||[]).map(e=>Object.assign({},e));
 const tr={samples:[],visited:[],maxT:0,r:r,inv:[]};tr.visited.push(r.step);
 for(let k=0;k<N;k++){
  ev2.forEach(e=>{if(!e.done&&r.time>=e.t-1e-9){e.done=1;if(e.set)Object.assign(r.btn,e.set);if(e.faults)Object.assign(r.faults,e.faults);}});
  const before=r.step;r.tick(dt);if(r.step!==before)tr.visited.push(r.step);
  tr.maxT=Math.max(tr.maxT,r.p.T);
  if(r.out.EH101&&(!r.out.M101||!r.inp.LSL101))tr.inv.push(r.time);
  if(k%10===0)tr.samples.push({t:r.time,step:r.step,L:r.p.L,T:r.p.T,out:Object.assign({},r.out)});}
 tr.final=r.step;tr.L=r.p.L;tr.T=r.p.T;tr.out=r.out;tr.log=r.log;return tr;};

/* teste automate (aceleași în Python) */
const P=function(t,v){return{t:t,set:v};};
SFC.TESTS=[
 {id:'T1',name:'Șarjă normală',desc:'START → umplere → încălzire → menținere → golire → repaus',
  sc:{duration:220,events:[P(1,{PB101:1}),P(2,{PB101:0})]},
  chk:function(tr,m){const e=[];const want=['S0','S1','S2','S3','S4','S0'];if(tr.visited.join()!==want.join())e.push('secvență '+tr.visited.join('→')+' în loc de '+want.join('→'));
   if(tr.final!=='S0')e.push('nu a revenit în S0 (pas final '+tr.final+')');
   if(tr.maxT<m.params.SP)e.push('temperatura maximă '+tr.maxT.toFixed(1)+' < SP');if(tr.maxT>m.params.SP+2)e.push('depășire '+(tr.maxT-m.params.SP).toFixed(1)+' °C > 2 °C');
   if(tr.L>5)e.push('rezervor neîncheiat la golire, nivel '+tr.L.toFixed(0)+' %');
   const l3=tr.log.find(x=>x.from==='S3');const l2=tr.log.find(x=>x.to==='S3');if(l2&&l3&&(l3.time-l2.time)<m.params.HOLD-0.5)e.push('menținerea a durat '+(l3.time-l2.time).toFixed(1)+' s, sub HOLD = '+m.params.HOLD+' s');return e;}},
 {id:'T2',name:'Senzor de nivel maxim blocat',desc:'LSH101 rămâne 0: umplerea trebuie oprită de timeout, în avarie',
  sc:{duration:120,faults:{lshStuck:true},events:[P(1,{PB101:1}),P(2,{PB101:0})]},
  chk:function(tr,m){const e=[];if(tr.final!==m.fault)e.push('pas final '+tr.final+', așteptat '+m.fault);if(tr.out.XV101)e.push('XV101 rămâne comandat în avarie');
   if(tr.L>=99.9)e.push('rezervorul a ajuns la '+tr.L.toFixed(0)+' % (preaplin)');return e;}},
 {id:'T3',name:'Oprire de urgență în încălzire',desc:'ES101 la t = 30 s: toate ieșirile 0 într-o secundă',
  sc:{duration:50,events:[P(1,{PB101:1}),P(2,{PB101:0}),P(30,{ES101:1})]},
  chk:function(tr,m){const e=[];if(tr.final!==m.fault)e.push('pas final '+tr.final+', așteptat '+m.fault);['XV101','XV102','M101','EH101'].forEach(k=>{if(tr.out[k])e.push(k+' rămâne activ');});return e;}},
 {id:'T4',name:'Senzor de temperatură înghețat',desc:'TT101 rămâne la valoarea inițială: încălzirea trebuie oprită de timeout, sub limita de 60 °C',
  sc:{duration:200,events:[P(1,{PB101:1}),P(2,{PB101:0}),{t:5,faults:{ttFrozen:true}}]},
  chk:function(tr,m){const e=[];if(tr.final!==m.fault)e.push('pas final '+tr.final+', așteptat '+m.fault);if(tr.out.EH101)e.push('EH101 rămâne activ');if(tr.maxT>60)e.push('temperatura a urcat la '+tr.maxT.toFixed(1)+' °C, peste limita de 60 °C a rezervorului');return e;}},
 {id:'T5',name:'Repornire interzisă din avarie',desc:'după ES101 eliberat, START nu pornește șarja; doar RESET (PB102) readuce în S0',
  sc:{duration:40,events:[P(0.5,{ES101:1}),P(5,{ES101:0}),P(8,{PB101:1}),P(9,{PB101:0}),{t:20,set:{PB102:1}},{t:21,set:{PB102:0}}]},
  chk:function(tr,m){const e=[];const at=tr.samples.find(s=>s.t>=15);if(!at||at.step!==m.fault)e.push('la t = 15 s pasul este '+(at?at.step:'?')+', așteptat '+m.fault);if(tr.final!=='S0')e.push('după RESET pasul este '+tr.final+', așteptat S0');return e;}},
 {id:'T6',name:'Oprire controlată în menținere',desc:'PB102 la t = 55 s: golește și revine în repaus, fără avarie',
  sc:{duration:140,events:[P(1,{PB101:1}),P(2,{PB101:0}),P(55,{PB102:1}),P(56,{PB102:0})]},
  chk:function(tr,m){const e=[];if(tr.visited.includes(m.fault))e.push('a intrat în avarie');if(tr.final!=='S0')e.push('pas final '+tr.final+', așteptat S0');if(!tr.visited.includes('S4'))e.push('nu a trecut prin golire (S4)');return e;}},
 {id:'T7',name:'Interblocare încălzitor',desc:'în toate momentele EH101 ⇒ (M101 și LSL101): fără agitator sau fără lichid nu se încălzește',
  sc:{duration:220,events:[P(1,{PB101:1}),P(2,{PB101:0})]},
  chk:function(tr){const e=[];if(tr.inv.length)e.push('încălzitor activ fără agitator/lichid la '+tr.inv.length+' cicluri, prima dată la t = '+tr.inv[0].toFixed(1)+' s');return e;}}];
SFC.runTests=function(m){const res=[];SFC.TESTS.forEach(T=>{let tr,e;try{tr=SFC.runScenario(m,T.sc);e=T.chk(tr,m);}catch(x){e=['eroare la rulare: '+x.message];}res.push({id:T.id,name:T.name,desc:T.desc,ok:e.length===0,errs:e,tr:tr});});return res;};

/* generare cod */
function ids(expr,fnc){return expr.replace(/\b([A-Za-z_]\w*)\b/g,(a,b)=>fnc(b));}
function toSclExpr(e){let s=e.replace(/&&/g,' AND ').replace(/\|\|/g,' OR ').replace(/!=/g,'<>').replace(/===?/g,'=').replace(/!(?!=)/g,'NOT ');
 s=ids(s,n=>['AND','OR','NOT','TRUE','FALSE'].includes(n)?n:'#'+n);return s.replace(/\s+/g,' ').trim();}
function isReal(n){return /^(TT|LT|PT|FT|SP|HOLD|t)/.test(n)&&!/^(TRUE)/.test(n);}
SFC.usedNames=function(m){const ins=new Set(),outs=new Set(),pars=Object.keys(m.params);
 const scan=e=>{(e.match(/\b[A-Za-z_]\w*\b/g)||[]).forEach(n=>{if(n==='t'||pars.includes(n))return;if(SFC.OUTS.includes(n))return;ins.add(n);});};
 m.trans.forEach(t=>scan(t.cond));m.steps.forEach(s=>parseActs(s.act).forEach(a=>{if(a.expr)scan(a.expr);}));
 SFC.OUTS.forEach(o=>outs.add(o));return{ins:[...ins],outs:[...outs],pars:pars};};
SFC.toSCL=function(m){
 const u=SFC.usedNames(m),idx={};m.steps.forEach((s,i)=>idx[s.id]=i);
 const L=[];const A=s=>L.push(s);
 A('// Generat de aplicația lucrării 7 (editor SFC). Verificați în TIA Portal înainte de utilizare.');
 A('FUNCTION_BLOCK "FB_Sequencer"');A('{ S7_Optimized_Access := \'TRUE\' }');A('VAR_INPUT');
 u.ins.forEach(n=>A('   '+n+' : '+(isReal(n)?'Real':'Bool')+';'));u.pars.forEach(n=>A('   '+n+' : Real := '+m.params[n].toFixed(1)+';  // parametru'));A('END_VAR');
 A('VAR_OUTPUT');u.outs.forEach(n=>A('   '+n+' : Bool;'));A('   Step : Int;');A('END_VAR');
 A('VAR');A('   tEntry : DInt;');A('   tMs : DInt;');A('   t : Real;');A('   prevStep : Int;');A('END_VAR');A('');
 A('BEGIN');A('// 1. timpul în pasul curent (secunde), din ceasul de sistem');
 A('#tMs := TIME_TO_DINT(TIME_TCK()) - #tEntry;');A('#t := DINT_TO_REAL(#tMs) / 1000.0;');A('');
 A('// 2. tranziții globale (au prioritate), apoi tranzițiile pasului activ');
 m.trans.filter(t=>t.from==='*').forEach(t=>{A('IF ('+toSclExpr(t.cond)+') AND #Step <> '+idx[t.to]+' THEN #Step := '+idx[t.to]+'; END_IF;  // → '+t.to);});
 A('CASE #Step OF');
 m.steps.forEach((s,i)=>{const T=m.trans.filter(t=>t.from===s.id);const tm=s.tmax>0&&s.id!==m.fault;
  A('   '+i+': // '+s.id+' '+s.name);
  T.forEach((t,k)=>A('      '+(k?'ELS':'')+'IF '+toSclExpr(t.cond)+' THEN #Step := '+idx[t.to]+'; // → '+t.to));
  if(tm)A('      '+(T.length?'ELS':'')+'IF #t > '+s.tmax.toFixed(1)+' THEN #Step := '+idx[m.fault]+'; // timeout → '+m.fault);
  if(T.length||tm)A('      END_IF;');});
 A('END_CASE;');A('');A('// 3. la schimbarea pasului se repornește cronometrul pasului');
 A('IF #Step <> #prevStep THEN');A('   #tEntry := TIME_TO_DINT(TIME_TCK());');A('   #prevStep := #Step;');A('   #t := 0.0;');A('END_IF;');A('');
 A('// 4. ieșiri: acțiuni nememorate, implicit FALSE');u.outs.forEach(n=>A('#'+n+' := FALSE;'));
 A('CASE #Step OF');
 m.steps.forEach((s,i)=>{const a=parseActs(s.act).filter(x=>x.name);if(!a.length)return;A('   '+i+': // '+s.id+' '+s.name);
  a.forEach(x=>{const r=x.expr.trim();A('      #'+x.name+' := '+(r==='1'?'TRUE':r==='0'?'FALSE':toSclExpr(r))+';');});});
 A('END_CASE;');A('END_FUNCTION_BLOCK');return L.join('\n');};
SFC.toCpp=function(m){
 const u=SFC.usedNames(m),idx={};m.steps.forEach((s,i)=>idx[s.id]=i);const L=[];const A=s=>L.push(s);
 const cx=e=>e.replace(/===/g,'==').trim();
 A('// ---- nucleu generat de editorul SFC (lucrarea 7) ----');
 A('int step = 0;');A('unsigned long tEntry = 0;');A('float t = 0;');
 u.pars.forEach(n=>A('float '+n+' = '+m.params[n].toFixed(1)+'f;'));
 A('');A('void seqScan() {');A('  t = (millis() - tEntry) / 1000.0f;');A('  int next = step;');
 m.trans.filter(t=>t.from==='*').forEach(t=>A('  if (('+cx(t.cond)+') && step != '+idx[t.to]+') next = '+idx[t.to]+';  // → '+t.to));
 A('  if (next == step) {');A('    switch (step) {');
 m.steps.forEach((s,i)=>{const T=m.trans.filter(t=>t.from===s.id);const tm=s.tmax>0&&s.id!==m.fault;if(!T.length&&!tm)return;
  A('      case '+i+':  // '+s.id+' '+s.name);
  T.forEach((t,k)=>A('        '+(k?'else ':'')+'if ('+cx(t.cond)+') next = '+idx[t.to]+';  // → '+t.to));
  if(tm)A('        '+(T.length?'else ':'')+'if (t > '+s.tmax.toFixed(1)+'f) next = '+idx[m.fault]+';  // timeout');
  A('        break;');});
 A('    }');A('  }');
 A('  if (next != step) { step = next; tEntry = millis(); t = 0; }');
 u.outs.forEach(n=>A('  '+n+' = false;'));A('  switch (step) {');
 m.steps.forEach((s,i)=>{const a=parseActs(s.act).filter(x=>x.name);if(!a.length)return;A('    case '+i+':  // '+s.id+' '+s.name);
  a.forEach(x=>A('      '+x.name+' = '+(x.expr.trim()==='1'?'true':x.expr.trim()==='0'?'false':'('+cx(x.expr)+')')+';'));A('      break;');});
 A('  }');A('}');
 return{code:L.join('\n'),ins:u.ins,outs:u.outs};};
if(typeof module!=='undefined'&&module.exports)module.exports=SFC;else root.SFC=SFC;
})(typeof window!=='undefined'?window:globalThis);
