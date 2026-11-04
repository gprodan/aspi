/* Lucrarea 5 – motor SCADA: proces (fermentator biogaz), rețea de achiziție Modbus, alarme, istoric.
   UMD, testabil în Node. Timp simulat în secunde; pas 0,25 s. */
(function(root){
'use strict';
function crc16(b){let c=0xFFFF;for(const x of b){c^=x;for(let k=0;k<8;k++)c=(c&1)?(c>>1)^0xA001:c>>1}return c}
const hex=a=>a.map(x=>x.toString(16).padStart(2,'0').toUpperCase()).join(' ');
function withCrc(a){const c=crc16(a);return a.concat([c&255,c>>8])}
const DT=0.25;
function create(){
  let seed=987654321;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  const gauss=()=>Math.sqrt(-2*Math.log(rnd()+1e-12))*Math.cos(2*Math.PI*rnd());
  const S={t:0,T:22,Ta:20,L:60,P:5,vol:0,htrE:0,F:0,flare:false,htr:false,pump:false,trip:false,
    SP:38,htrMode:'auto',htrMan:false,pumpMode:'auto',pumpMan:false,
    faults:{sensStuck:false,sensDrift:false,commR1:false,commR2:false,flareStuck:false,htrStuck:false},
    stuckVal:null,drift:0,suppressLow:false,
    bus:{baud:9600,extra:0,timeout:300,retries:1,cycle:0,load:0},
    log:[],events:[],alarms:{},alarmHist:[],writes:[]};
  /* ---------- tag-uri ---------- */
  const T=(n,d,u,lo,hi,dev,type,al)=>({n,d,u,lo,hi,dev,type,val:0,ts:-1,q:'bad',al:al||{}});
  S.tags=[
   T('TT101','Temperatură fermentator','°C',0,100,'RTU1','ai',{L:30,H:41,HH:45,db:0.5,delay:30}),
   T('FT101','Debit biogaz','m³/h',0,15,'RTU1','ai',{db:0.2,delay:0}),
   T('SP101','Consemn temperatură','°C',15,60,'RTU1','ao',{}),
   T('HTR101','Încălzitor (stare)','','','','RTU1','di',{}),
   T('TRIP101','Termostat siguranță 48 °C','','','','RTU1','di',{}),
   T('LT101','Nivel fermentator','%',0,100,'RTU2','ai',{LL:15,L:25,H:90,HH:95,db:2,delay:10}),
   T('PT101','Presiune gazometru','mbar',0,40,'RTU2','ai',{H:33,HH:37,db:1,delay:5}),
   T('P101','Pompă alimentare (stare)','','','','RTU2','di',{}),
   T('FLARE101','Torță (stare)','','','','RTU2','di',{})];
  S.tag=n=>S.tags.find(x=>x.n===n);
  /* ---------- dispozitive (rețea de achiziție) ---------- */
  S.devs=[
   {id:'RTU1',name:'RTU1 · Arduino Uno (RS-485, Modbus RTU, adresa 1)',addr:1,scan:1000,n:5,next:0,err:0,ok:true,lastOk:-1,tx:0,cache:{}},
   {id:'RTU2',name:'RTU2 · Arduino Uno (RS-485, Modbus RTU, adresa 2)',addr:2,scan:1000,n:4,next:0,err:0,ok:true,lastOk:-1,tx:0,cache:{}}];
  const txMs=n=>((8+5+2*n)*11/S.bus.baud*1000)+8;
  function meas(){
    let tt=S.T+0.08*gauss()+S.drift;
    if(S.faults.sensStuck){if(S.stuckVal===null)S.stuckVal=tt;tt=S.stuckVal}else S.stuckVal=null;
    return {TT101:tt,FT101:Math.max(0,S.F+0.05*gauss()),SP101:S.SP,HTR101:S.htr?1:0,TRIP101:S.trip?1:0,
            LT101:S.L+0.15*gauss(),PT101:Math.max(0,S.P+0.05*gauss()),P101:S.pump?1:0,FLARE101:S.flare?1:0};
  }
  function devFault(d){return d.id==='RTU1'?S.faults.commR1:S.faults.commR2}
  function addLog(s){S.log.unshift(s);if(S.log.length>40)S.log.pop()}
  function frameTxt(d,ok,m){
    const rd=[d.addr,4,0,0,0,d.n-0];const req=withCrc(rd);
    const resp=ok?withCrc([d.addr,4,d.n*2].concat(Array.from({length:d.n*2},(_,i)=>Math.floor((m[d.id==='RTU1'?['TT101','FT101','SP101','HTR101','TRIP101'][i>>1]:['LT101','PT101','P101','FLARE101'][i>>1]]||0)*10)>>((i&1)?0:8)&255))):null;
    return (S.t.toFixed(1)+' s  '+d.id+'  TX '+hex(req)+'  →  '+(ok?'RX '+hex(resp):'FĂRĂ RĂSPUNS (timeout '+S.bus.timeout+' ms ×'+(1+S.bus.retries)+')'));
  }
  function cycleTime(){
    let c=0;for(const d of S.devs){c+=devFault(d)?S.bus.timeout*(1+S.bus.retries):txMs(d.n)}
    c+=S.bus.extra*txMs(2);return c}
  function poll(){
    S.bus.cycle=cycleTime();
    let util=0;for(const d of S.devs)util+=(devFault(d)?0:txMs(d.n))/Math.max(d.scan,S.bus.cycle);util+=S.bus.extra*txMs(2)/Math.max(1000,S.bus.cycle);S.bus.load=Math.min(1,util);
    const m=meas();
    for(const d of S.devs){
      const per=Math.max(d.scan,S.bus.cycle)/1000;
      if(S.t<d.next)continue;
      d.next=S.t+per;
      const bad=devFault(d);
      d.tx++;
      if(bad){d.err++;d.ok=false;addLog(frameTxt(d,false,m))}
      else{
        d.err=0;d.ok=true;d.lastOk=S.t;d.cache=m;
        for(const g of S.tags)if(g.dev===d.id){g.val=m[g.n];g.ts=S.t}
        addLog(frameTxt(d,true,m));
      }
      d.period=per;
    }
    for(const g of S.tags){
      const d=S.devs.find(x=>x.id===g.dev);
      const per=d.period||1;
      g.q=d.err>=3?'bad':(g.ts<0?'bad':(S.t-g.ts>3*per?'stale':'good'));
      g.age=g.ts<0?null:S.t-g.ts;
    }
    S.devAvail=S.devAvail||{RTU1:[0,0],RTU2:[0,0]};
    for(const d of S.devs){S.devAvail[d.id][1]++;if(d.err<3)S.devAvail[d.id][0]++}
  }
  /* ---------- proces + control local (PLC/RTU) ---------- */
  function process(){
    if(S.T>48)S.trip=true;else if(S.T<46)S.trip=false;
    let cmd;
    if(S.htrMode==='man')cmd=S.htrMan;else{if(S.T<S.SP-0.5)S.htrAuto=true;else if(S.T>S.SP+0.5)S.htrAuto=false;cmd=!!S.htrAuto}
    if(S.faults.htrStuck)cmd=true;
    S.htr=S.trip?false:cmd;
    if(S.pumpMode==='man')S.pump=S.pumpMan;else{if(S.L<50)S.pumpAuto=true;else if(S.L>80)S.pumpAuto=false;S.pump=!!S.pumpAuto}
    S.T+=DT*((8000*(S.htr?1:0)-120*(S.T-S.Ta))/3e5);
    S.L+=DT*((S.pump?0.2:0)-0.02);S.L=Math.max(0,Math.min(100,S.L));
    S.F=12*Math.exp(-Math.pow((S.T-38)/6,2))*(S.L/100);
    if(S.P>30&&!S.faults.flareStuck)S.flare=true;else if(S.P<25||S.faults.flareStuck)S.flare=false;
    const cons=4+(S.flare?20:0);
    S.P+=DT*0.004*(S.F-cons);S.P=Math.max(0,Math.min(40,S.P));
    if(S.faults.sensDrift)S.drift+=DT*0.01;
    S.vol+=S.F/3600*DT;S.htrE+=S.htr?8*DT/3600:0;
  }
  /* ---------- alarme ---------- */
  const PR={LL:1,HH:1,L:2,H:2,COMM:2,TRIP:1};
  function ev(s){S.events.unshift(S.t.toFixed(0).padStart(5)+' s  '+s);if(S.events.length>300)S.events.pop()}
  function alarmCond(key){ // returnează {on, off} pentru logica cu histerezis
    return null}
  function alarms(){
    const defs=[];
    for(const g of S.tags){
      if(g.type!=='ai'||g.q==='bad')continue;
      for(const lv of ['LL','L','H','HH']){
        if(g.al[lv]===undefined)continue;
        if(lv==='L'&&g.n==='TT101'&&S.suppressLow)continue;
        const lim=g.al[lv],db=g.al.db||0,lowSide=lv==='L'||lv==='LL';
        defs.push({key:g.n+'.'+lv,tag:g.n,lv,pr:PR[lv],lim,
          on:lowSide?g.val<lim:g.val>lim,clear:lowSide?g.val>lim+db:g.val<lim-db,delay:g.al.delay||0,val:g.val,u:g.u,text:g.d+(lowSide?' scăzută':' ridicată')+(lv.length===2?' (urgentă)':'')});
      }
    }
    for(const d of S.devs)defs.push({key:d.id+'.COMM',tag:d.id,lv:'COMM',pr:2,lim:0,on:d.err>=3,clear:d.err===0,delay:0,val:d.err,u:'',text:'Pierdere comunicație cu '+d.id});
    const trip=S.tag('TRIP101');
    defs.push({key:'TRIP101.TRIP',tag:'TRIP101',lv:'TRIP',pr:1,lim:0,on:trip.val===1&&trip.q!=='bad',clear:trip.val===0,delay:0,val:trip.val,u:'',text:'Termostat de siguranță declanșat (48 °C)'});
    for(const df of defs){
      let a=S.alarms[df.key];
      if(!a){
        if(df.on){
          const p=S.pend||(S.pend={});
          if(p[df.key]===undefined)p[df.key]=S.t;
          if(S.t-p[df.key]>=df.delay){
            a=S.alarms[df.key]={key:df.key,tag:df.tag,lv:df.lv,pr:df.pr,text:df.text,t0:S.t,st:'A',val:df.val,u:df.u,lim:df.lim,n:1};
            S.alarmHist.push(S.t);ev('ALARMĂ P'+df.pr+' '+df.key+' – '+df.text+' ('+df.val.toFixed(1)+' '+df.u+')');
          }
        }else if(S.pend)delete S.pend[df.key];
      }else{
        a.val=df.val;
        if(a.st!=='R'&&df.clear){a.st=a.st==='A'?'R':'RA';a.tR=S.t;ev('REVENIRE '+df.key+(a.st==='RA'?'':' (neconfirmată)'));if(a.st==='RA')delete S.alarms[df.key]}
        else if(a.st==='R'&&df.on){a.st='A';a.n++}
      }
    }
    // alarme pentru tag-uri devenite „bad": rămân active până la revenire
    S.alarmHist=S.alarmHist.filter(x=>S.t-x<600);
  }
  S.ack=key=>{const a=S.alarms[key];if(!a)return;ev('CONFIRMARE '+key);if(a.st==='A')a.st='AA';else if(a.st==='R')delete S.alarms[key]};
  S.ackAll=()=>Object.keys(S.alarms).forEach(k=>S.ack(k));
  S.alarmList=()=>Object.values(S.alarms).sort((a,b)=>a.pr-b.pr||b.t0-a.t0);
  /* ---------- scrieri din SCADA ---------- */
  S.write=(name,val)=>{
    const g=S.tag(name),d=g&&S.devs.find(x=>x.id===g.dev);
    if(!g)return {ok:false,err:'tag inexistent'};
    if(devFault(d)){ev('SCRIERE EȘUATĂ '+name+': '+d.id+' nu răspunde');return {ok:false,err:d.id+' nu răspunde (timeout)'}}
    if(name==='SP101'){if(!(val>=15&&val<=60)){ev('SCRIERE REFUZATĂ SP101='+val+' (excepția 03: valoare ilegală)');return {ok:false,err:'excepția Modbus 03: valoare ilegală (15…60 °C)'}}S.SP=val;ev('SCRIERE SP101 = '+val+' °C');return {ok:true}}
    ev('SCRIERE '+name+' = '+val);return {ok:true};
  };
  /* ---------- istoric brut (1 s) ---------- */
  S.raw={t:[],TT101:[],LT101:[],PT101:[],FT101:[],SP101:[],htr:[]};
  function record(){
    if(Math.floor(S.t)!==Math.floor(S.t-DT)||S.raw.t.length===0){
      const r=S.raw;if(r.t.length>=14400)for(const k in r)r[k].shift();
      r.t.push(Math.floor(S.t));r.TT101.push(S.T);r.LT101.push(S.L);r.PT101.push(S.P);r.FT101.push(S.F);r.SP101.push(S.SP);r.htr.push(S.htr?1:0);
    }
  }
  S.step=function(n){for(let i=0;i<(n||1);i++){S.t+=DT;process();poll();alarms();record()}};
  S.reset=function(){const f=create();Object.keys(S).forEach(k=>delete S[k]);Object.assign(S,f)};
  return S;
}
/* ---------- compresie istoric ---------- */
function compress(t,v,mode,param){
  const idx=[0],vals=[v[0]];
  if(mode==='periodic'){for(let i=1;i<t.length;i++)if(t[i]-t[idx[idx.length-1]]>=param){idx.push(i);vals.push(v[i])}}
  else if(mode==='deadband'){let last=v[0];for(let i=1;i<t.length;i++)if(Math.abs(v[i]-last)>=param){idx.push(i);vals.push(v[i]);last=v[i]}}
  else if(mode==='swing'){ // fereastră rotativă (swinging door): toleranță ±param față de dreapta memorată
    let a=0,va=v[0],smin=-Infinity,smax=Infinity;
    for(let i=1;i<t.length;i++){
      const dt=t[i]-t[a];if(dt<=0)continue;
      const lo=(v[i]-param-va)/dt,hi=(v[i]+param-va)/dt;
      const nmin=Math.max(smin,lo),nmax=Math.min(smax,hi);
      if(nmin>nmax){ // fereastra s-a închis: memorăm punctul precedent pe dreapta mediană
        const pi=i-1,sl=(smin+smax)/2,pv=va+sl*(t[pi]-t[a]);
        idx.push(pi);vals.push(pv);a=pi;va=pv;
        const d2=t[i]-t[a];smin=(v[i]-param-va)/d2;smax=(v[i]+param-va)/d2;
      }else{smin=nmin;smax=nmax}
    }
  }
  if(idx[idx.length-1]!==t.length-1){idx.push(t.length-1);vals.push(v[t.length-1])}
  const rec=new Array(t.length);let k=0;
  for(let i=0;i<t.length;i++){while(k<idx.length-2&&t[idx[k+1]]<=t[i])k++;const i0=idx[k],i1=idx[k+1];const w=i1===i0?0:(t[i]-t[i0])/(t[i1]-t[i0]);rec[i]=vals[k]+(vals[k+1]-vals[k])*Math.min(1,Math.max(0,w))}
  let me=0;for(let i=0;i<t.length;i++)me=Math.max(me,Math.abs(rec[i]-v[i]));
  return {idx,vals,rec,maxErr:me,ratio:t.length/idx.length};
}
const api={create,compress,crc16,DT};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ScadaEngine=api;
})(typeof self!=='undefined'?self:this);
