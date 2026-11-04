(function(){
'use strict';
const $=id=>document.getElementById(id);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmt=(x,d)=>Number(x).toFixed(d);
function engF(f){return f>=1000?fmt(f/1000,2)+' kHz':f>=1?fmt(f,2)+' Hz':fmt(f*1000,1)+' mHz'}

/* ---------- taburi ---------- */
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
  document.querySelectorAll('main>section').forEach(s=>s.classList.toggle('on',s.id===b.dataset.t));
  redrawAll();
});
function canvasSetup(c){const r=c.getBoundingClientRect();const k=window.devicePixelRatio||1;if(r.width<10)return null;c.width=Math.round(r.width*k);c.height=Math.round(c.getAttribute('height')*r.width/c.getAttribute('width')*k);const g=c.getContext('2d');g.setTransform(k,0,0,k,0,0);return {g,w:r.width,h:c.height/k}}
function axes(g,w,h,m,xl,yl,x0,x1,y0,y1,nx,ny){
  g.strokeStyle=css('--bd');g.fillStyle=css('--mut');g.lineWidth=1;g.font='11px system-ui';g.textAlign='right';
  for(let i=0;i<=ny;i++){const v=y0+(y1-y0)*i/ny,y=h-m.b-(h-m.t-m.b)*i/ny;g.beginPath();g.moveTo(m.l,y);g.lineTo(w-m.r,y);g.stroke();g.fillText(fmt(v,y1-y0<10?1:0),m.l-4,y+4)}
  g.textAlign='center';
  for(let i=0;i<=nx;i++){const v=x0+(x1-x0)*i/nx,x=m.l+(w-m.l-m.r)*i/nx;g.fillText(xl(v),x,h-m.b+14)}
  if(yl){g.save();g.translate(11,m.t+(h-m.t-m.b)/2);g.rotate(-Math.PI/2);g.textAlign='center';g.fillText(yl,0,0);g.restore()}
}

/* ---------- 1. Timer1 / PWM ---------- */
const FCPU=16e6;
const PSBITS={1:'(1 << CS10)',8:'(1 << CS11)',64:'(1 << CS11) | (1 << CS10)',256:'(1 << CS12)',1024:'(1 << CS12) | (1 << CS10)'};
function tfreq(){return Math.pow(10,-1+$('f').value/100*5)}
function t1(){
  let f=tfreq();f=+f.toPrecision(3);$('v_f').textContent=engF(f);
  const ps=+$('ps').value,ocr=Math.round(FCPU/(ps*f)-1),ok=ocr>=1&&ocr<=65535;
  const fa=FCPU/(ps*(ocr+1)),err=(fa-f)/f*100,res=ps/16;
  $('tm_out').innerHTML=
   '<div><span>OCR1A calculat</span><b class="'+(ok?'':'bad')+'">'+(ok?ocr:(ocr>65535?ocr+' > 65535':ocr))+'</b></div>'+
   '<div><span>Frecvență reală</span><b>'+(ok?engF(fa):'—')+'</b></div>'+
   '<div><span>Eroare</span><b class="'+(Math.abs(err)<0.1?'ok':'warn')+'">'+(ok?fmt(err,3)+' %':'—')+'</b></div>'+
   '<div><span>Rezoluția timerului</span><b>'+(res>=1?fmt(res,2)+' µs':fmt(res*1000,0)+' ns')+'</b></div>'+
   '<div><span>Perioada</span><b>'+(ok?fmt(1/fa*1000,3)+' ms':'—')+'</b></div>'+
   '<div><span>Stare</span><b class="'+(ok?'ok':'bad')+'">'+(ok?'valid':(ocr>65535?'depășește 16 biți: mărește divizorul':'prea rapid pentru acest divizor'))+'</b></div>';
  $('tm_code').textContent=
'volatile unsigned int ticks = 0;\n\nISR(TIMER1_COMPA_vect) {\n  ticks++;                 // cât mai scurt!\n}\n\nvoid setup() {\n  noInterrupts();\n  TCCR1A = 0;\n  TCCR1B = 0;\n  TCNT1  = 0;\n  OCR1A  = '+(ok?ocr:'???')+';          // '+(ok?engF(fa):'')+'\n  TCCR1B |= (1 << WGM12);  // mod CTC\n  TCCR1B |= '+PSBITS[ps]+';  // prescaler '+ps+'\n  TIMSK1 |= (1 << OCIE1A); // întrerupere la comparație\n  interrupts();\n}';
  // osc2
  const o=canvasSetup($('osc2'));if(!o)return;const {g,w,h}=o;g.clearRect(0,0,w,h);
  const m={l:40,r:8,t:8,b:20};const tspan=ok?4/fa:1;
  axes(g,w,h,m,v=>fmt(v*1000,tspan*1000<10?2:1)+' ms','',0,tspan,0,5,4,1);
  g.strokeStyle=css('--ac');g.lineWidth=2;g.beginPath();let lv=0;g.moveTo(m.l,h-m.b);
  for(let k=0;k<=4;k++){const x=m.l+(w-m.l-m.r)*k/4;lv=k%2;const y=lv?m.t:h-m.b;const yp=lv?h-m.b:m.t;g.lineTo(x,yp);g.lineTo(x,y)}
  g.stroke();
}
function pwm(){
  const v=+$('pw').value,fr=+$('pwpin').value,d=v/255;
  $('v_pw').textContent=v;
  $('pw_out').innerHTML='<div><span>Factor de umplere</span><b>'+fmt(d*100,1)+' %</b></div><div><span>Tensiune medie</span><b>'+fmt(5*d,2)+' V</b></div><div><span>Frecvență PWM</span><b>'+fr+' Hz</b></div><div><span>Perioadă</span><b>'+fmt(1000/fr,2)+' ms</b></div>';
  const o=canvasSetup($('osc'));if(!o)return;const {g,w,h}=o;g.clearRect(0,0,w,h);
  const m={l:40,r:8,t:8,b:20};const per=1/fr,span=3*per;
  axes(g,w,h,m,x=>fmt(x*1000,1)+' ms','V',0,span,0,5,3,5);
  const X=t=>m.l+(w-m.l-m.r)*t/span,Y=u=>h-m.b-(h-m.t-m.b)*u/5;
  g.strokeStyle=css('--ac');g.lineWidth=2;g.beginPath();g.moveTo(X(0),Y(5));
  for(let k=0;k<3;k++){const t0=k*per;if(d>0){g.lineTo(X(t0),Y(5));g.lineTo(X(t0+d*per),Y(5))}if(d<1){g.lineTo(X(t0+d*per),Y(0));g.lineTo(X(t0+per),Y(0))}else g.lineTo(X(t0+per),Y(5));if(k<2)g.lineTo(X(t0+per),Y(d>0?5:0))}
  g.stroke();
  g.setLineDash([5,4]);g.strokeStyle=css('--warn');g.beginPath();g.moveTo(m.l,Y(5*d));g.lineTo(w-m.r,Y(5*d));g.stroke();g.setLineDash([]);
}
$('f').value=50;
['f','ps'].forEach(i=>$(i).oninput=t1);['pw','pwpin'].forEach(i=>$(i).oninput=pwm);
$('autops').onclick=()=>{const f=+tfreq().toPrecision(3);let best=1024;for(const p of [1,8,64,256,1024]){const o=FCPU/(p*f)-1;if(o>=1&&o<=65535){best=p;break}}$('ps').value=best;t1()};

/* ---------- 2. ADC / senzori ---------- */
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function gauss(r){return Math.sqrt(-2*Math.log(r()+1e-12))*Math.cos(2*Math.PI*r())}
let adSeed=7;
const ntcR=T=>10000*Math.exp(3950*(1/(T+273.15)-1/298.15));
const ntcT=R=>1/(1/298.15+Math.log(R/10000)/3950)-273.15;
function adcOf(sn,T,vref){
  const V=sn==='lm35'?0.01*T:5*ntcR(T)/(10000+ntcR(T));
  return Math.max(0,Math.min(1023,Math.round(V/vref*1023)));
}
function tOf(sn,a,vref){
  if(sn==='lm35')return a*vref/1023*100;
  const V=a*vref/1023;if(V>=4.999)return NaN;const R=10000*V/(5-V);return ntcT(R);
}
function adc(){
  const sn=$('sn').value,Tr=+$('Tr').value,vref=+$('vr').value,nz=+$('nz').value,N=+$('nav').value;
  $('v_Tr').textContent=fmt(Tr,1)+' °C';$('v_nz').textContent=fmt(nz,2)+' °C';$('v_nav').textContent=N;
  $('vr').disabled=sn==='ds';
  const r=rng(adSeed),pts=[];
  const one=()=>{
    if(sn==='ds'){const raw=Tr+nz*0.15*gauss(r);return Math.round(raw/0.0625)*0.0625}
    let s=0,cnt=0;for(let i=0;i<N;i++){const a=adcOf(sn,Tr+nz*gauss(r),vref);s+=a;cnt++}
    const a=s/cnt;return tOf(sn,a,vref)};
  for(let i=0;i<30;i++)pts.push(one());
  const ok=pts.filter(x=>isFinite(x)),mean=ok.reduce((a,b)=>a+b,0)/Math.max(1,ok.length);
  const sd=Math.sqrt(ok.reduce((a,b)=>a+(b-mean)*(b-mean),0)/Math.max(1,ok.length));
  let step,a0;
  if(sn==='ds'){step=0.0625;a0='—'}
  else{a0=adcOf(sn,Tr,vref);const t1_=tOf(sn,a0,vref),t2_=tOf(sn,Math.min(1023,a0+1),vref);step=Math.abs(t2_-t1_)}
  const sat=sn!=='ds'&&(a0>=1023||a0<=0);
  $('ad_out').innerHTML=
   '<div><span>Cod ADC (fără zgomot)</span><b class="'+(sat?'bad':'')+'">'+a0+(sat?' saturat':'')+'</b></div>'+
   '<div><span>Pas de cuantizare</span><b>'+(isFinite(step)?fmt(step,3)+' °C':'—')+'</b></div>'+
   '<div><span>Media măsurătorilor</span><b>'+(ok.length?fmt(mean,2)+' °C':'—')+'</b></div>'+
   '<div><span>Eroare medie</span><b class="'+(Math.abs(mean-Tr)<0.2?'ok':'warn')+'">'+(ok.length?fmt(mean-Tr,2)+' °C':'—')+'</b></div>'+
   '<div><span>Abatere standard (30 citiri)</span><b>'+fmt(sd,3)+' °C</b></div>'+
   '<div><span>Teoretic σ/√N (zgomot)</span><b>'+fmt(sn==='ds'?nz*0.15:nz/Math.sqrt(N),3)+' °C</b></div>';
  $('ad_code').textContent=
sn==='lm35'?'int   a = analogRead(A0);            // 0…1023\nfloat V = a * Vref / 1023.0;         // Vref = '+vref+' V\nfloat T = V * 100.0;                 // LM35: 10 mV/°C\n// pas = Vref/1023/0.01 = '+fmt(vref/1023*100,3)+' °C per bit'
:sn==='ntc'?'int   a = analogRead(A2);\nfloat R = 10000.0 * a / (1023.0 - a); // divizor: NTC la GND, 10 kΩ la 5 V\nfloat T = 1.0 / (1.0/298.15 + log(R/10000.0)/3950.0) - 273.15;\n// sensibilitate neliniară: pas mic în zona 25…50 °C'
:'#include <OneWire.h>\n#include <DallasTemperature.h>\nOneWire ow(2); DallasTemperature ds(&ow);\nds.requestTemperatures();\nfloat T = ds.getTempCByIndex(0);   // 12 biți: 0,0625 °C\n// conversia durează ≈ 750 ms: nu folosiți delay(), ci millis()';
  const o=canvasSetup($('adc_ch'));if(!o)return;const {g,w,h}=o;g.clearRect(0,0,w,h);
  const m={l:44,r:10,t:10,b:22};const y0=Tr-3,y1=Tr+3;
  axes(g,w,h,m,v=>Math.round(v),'°C',0,30,y0,y1,6,6);
  const X=i=>m.l+(w-m.l-m.r)*i/29,Y=v=>h-m.b-(h-m.t-m.b)*(Math.max(y0,Math.min(y1,v))-y0)/(y1-y0);
  g.strokeStyle=css('--ok');g.lineWidth=2;g.beginPath();g.moveTo(m.l,Y(Tr));g.lineTo(w-m.r,Y(Tr));g.stroke();
  g.fillStyle=css('--ac');pts.forEach((v,i)=>{if(isFinite(v)){g.beginPath();g.arc(X(i),Y(v),3.2,0,7);g.fill()}});
}
['sn','Tr','vr','nz','nav'].forEach(i=>$(i).oninput=adc);
$('ntake').onclick=()=>{adSeed=(adSeed*7919+13)>>>0;adc()};

/* ---------- 3. Mini-Arduino ---------- */
const PRE={
'Clipire LED cu millis()':{ref:40,src:`const int LED = 13;
unsigned long ultimul = 0;
bool aprins = false;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (millis() - ultimul >= 500) {      // fără delay(): programul nu se blochează
    ultimul = millis();
    aprins = !aprins;
    digitalWrite(LED, aprins);
    Serial.print("LED = ");
    Serial.println(aprins);
  }
  // aici pot rula alte sarcini
}
`},
'Capcane de tip (int, diviziune, overflow)':{ref:40,src:`void setup() {
  Serial.begin(9600);
  int a = 32767;
  a = a + 1;
  Serial.print("32767 + 1 = ");        Serial.println(a);
  Serial.print("7 / 2 = ");            Serial.println(7 / 2);
  Serial.print("7 / 2.0 = ");          Serial.println(7 / 2.0);
  int x = 1000;
  Serial.print("1000 * 100 (int) = "); Serial.println(x * 100);
  long y = 1000L * 100;
  Serial.print("1000L * 100 = ");      Serial.println(y);
  unsigned int u = 0;
  u = u - 1;
  Serial.print("0u - 1 = ");           Serial.println(u);
  byte b = 250;
  b = b + 10;
  Serial.print("byte 250 + 10 = ");    Serial.println(b);
  float f = 1 / 3;
  Serial.print("float f = 1/3 -> ");   Serial.println(f);
  Serial.print("10 / 4 * 2.0 = ");     Serial.println(10 / 4 * 2.0);
  Serial.print("analogRead(A0) * 5 / 1023 = ");
  Serial.println(analogRead(A0) * 5 / 1023);
  Serial.print("analogRead(A0) * 5.0 / 1023 = ");
  Serial.println(analogRead(A0) * 5.0 / 1023);
}

void loop() { }
`},
'Citire LM35 și NTC cu mediere':{ref:40,src:`float temperaturaLM35() {
  long s = 0;
  for (int i = 0; i < 16; i++) s += analogRead(A0);
  return (s / 16.0) * 5.0 / 1023.0 * 100.0;       // 10 mV/°C
}

float temperaturaNTC() {
  int a = analogRead(A2);
  float R = 10000.0 * a / (1023.0 - a);           // divizor cu 10 kΩ
  return 1.0 / (1.0 / 298.15 + log(R / 10000.0) / 3950.0) - 273.15;
}

unsigned long ultimul = 0;
float filtrat = 22;

void setup() { Serial.begin(9600); }

void loop() {
  if (millis() - ultimul >= 1000) {
    ultimul = millis();
    float t1 = temperaturaLM35();
    float t2 = temperaturaNTC();
    filtrat = 0.8 * filtrat + 0.2 * t1;           // filtru exponențial
    Serial.print("LM35="); Serial.print(t1, 2);
    Serial.print("  NTC="); Serial.print(t2, 2);
    Serial.print("  filtrat="); Serial.println(filtrat, 2);
  }
}
`},
'Termostat ON/OFF cu histerezis':{ref:38,src:`const int RELEU = 8;
const float SP = 38.0;        // valoarea dorită, °C
const float BANDA = 2.0;      // lățimea histerezisului, °C
float T = 0;
bool pornit = false;
unsigned long tPrint = 0;

float citesteT() {
  long s = 0;
  for (int i = 0; i < 16; i++) s += analogRead(A0);
  return (s / 16.0) * 5.0 / 1023.0 * 100.0;
}

void setup() {
  pinMode(RELEU, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  T = citesteT();
  if (T < SP - BANDA / 2) pornit = true;
  else if (T > SP + BANDA / 2) pornit = false;
  digitalWrite(RELEU, pornit);

  if (millis() - tPrint >= 5000) {
    tPrint = millis();
    Serial.print(millis() / 1000);
    Serial.print(" s   T=");   Serial.print(T, 1);
    Serial.print("   releu="); Serial.println(pornit);
  }
  delay(100);
}
`},
'Regulator P (PWM pe MOSFET)':{ref:40,src:`float SP = 40.0;
const float KP = 20.0;        // % comandă pe °C eroare
float T = 22;
unsigned long ultimul = 0;

float citesteT() {
  long s = 0;
  for (int i = 0; i < 16; i++) s += analogRead(A0);
  return (s / 16.0) * 5.0 / 1023.0 * 100.0;
}

void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (millis() - ultimul >= 1000) {          // perioada de eșantionare 1 s
    ultimul = millis();
    T = citesteT();
    float e = SP - T;
    float u = KP * e;                         // doar proporțional
    u = constrain(u, 0, 100);
    analogWrite(9, (int)(u * 2.55));
    Serial.print(millis() / 1000); Serial.print(";");
    Serial.print(T, 2);            Serial.print(";");
    Serial.println(u, 1);
  }
}
`},
'Regulator PI cu anti-windup și comandă serială':{ref:40,src:`// Trimiteți prin monitorul serial o valoare nouă, ex: 35 sau SP=42.5
float SP = 40.0;
const float KP = 15.0;        // %/°C
const float KI = 0.25;        // %/(°C·s)
const float TS = 1.0;         // s
float T = 22, I = 0, u = 0;
unsigned long ultimul = 0;

float citesteT() {
  long s = 0;
  for (int i = 0; i < 16; i++) s += analogRead(A0);
  return (s / 16.0) * 5.0 / 1023.0 * 100.0;
}

void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
  Serial.println("t;T;SP;u");
}

void loop() {
  if (Serial.available()) {
    float v = Serial.parseFloat();
    while (Serial.available()) Serial.read();   // golește restul liniei
    if (v >= 20 && v <= 60) {
      SP = v;
      Serial.print("SP nou = "); Serial.println(SP, 1);
    }
  }
  if (millis() - ultimul >= 1000) {
    ultimul = millis();
    T = 0.7 * T + 0.3 * citesteT();           // filtrare
    float e = SP - T;
    I = I + KI * e * TS;
    I = constrain(I, 0, 100);                 // anti-windup (limitarea integralei)
    u = constrain(KP * e + I, 0, 100);
    analogWrite(9, (int)(u * 2.55));
    Serial.print(millis() / 1000); Serial.print(";");
    Serial.print(T, 2);            Serial.print(";");
    Serial.print(SP, 1);           Serial.print(";");
    Serial.println(u, 1);
  }
}
`},
'Timer1 CTC: ISR la 1 Hz':{ref:40,src:`volatile bool tick = false;
volatile unsigned int secunde = 0;

ISR(TIMER1_COMPA_vect) {
  tick = true;               // ISR scurt: doar semnalizează
  secunde++;
}

void setup() {
  Serial.begin(9600);
  pinMode(13, OUTPUT);
  noInterrupts();
  TCCR1A = 0;
  TCCR1B = 0;
  TCNT1  = 0;
  OCR1A  = 15624;                          // 16 MHz / (1024 · 1 Hz) - 1
  TCCR1B |= (1 << WGM12);                  // CTC
  TCCR1B |= (1 << CS12) | (1 << CS10);     // prescaler 1024
  TIMSK1 |= (1 << OCIE1A);
  interrupts();
}

void loop() {
  if (tick) {
    tick = false;
    digitalWrite(13, !digitalRead(13));
    Serial.print("secunda "); Serial.print(secunde);
    Serial.print("  T="); Serial.println(analogRead(A0) * 5.0 / 1023.0 * 100.0, 1);
  }
}
`},
'Buton cu întrerupere (fără debounce)':{ref:40,src:`volatile unsigned int apasari = 0;
unsigned int afisat = 0;

void onButon() {
  apasari++;
}

void setup() {
  Serial.begin(9600);
  pinMode(2, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(2), onButon, FALLING);
  Serial.println("Apăsați butonul D2");
}

void loop() {
  if (apasari != afisat) {
    afisat = apasari;
    Serial.print("apăsări numărate = ");
    Serial.println(afisat);
  }
}
`},
'Buton cu întrerupere și debounce (millis)':{ref:40,src:`volatile unsigned int apasari = 0;
volatile unsigned long tUltim = 0;
unsigned int afisat = 0;

void onButon() {
  unsigned long acum = millis();
  if (acum - tUltim > 50) {          // ignoră săriturile contactului (<50 ms)
    apasari++;
    tUltim = acum;
  }
}

void setup() {
  Serial.begin(9600);
  pinMode(2, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(2), onButon, FALLING);
}

void loop() {
  if (apasari != afisat) {
    afisat = apasari;
    Serial.print("apăsări numărate = ");
    Serial.println(afisat);
  }
}
`}};
const pre=$('pre');Object.keys(PRE).forEach(k=>{const o=document.createElement('option');o.textContent=k;pre.appendChild(o)});
$('src').value=PRE['Termostat ON/OFF cu histerezis'].src;pre.value='Termostat ON/OFF cu histerezis';
function loadPre(){const p=PRE[pre.value];$('src').value=p.src;$('ref').value=p.ref;$('v_ref').textContent=p.ref+' °C';}
$('load').onclick=()=>{loadPre();run()};
pre.onchange=loadPre;
$('src').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const t=e.target,s=t.selectionStart;t.value=t.value.slice(0,s)+'  '+t.value.slice(t.selectionEnd);t.selectionStart=t.selectionEnd=s+2}});

const B=new MiniArduino.Board();let running=false,paused=false,hist=[],lastSample=0,lastReal=0;
function cfg(){B.cfg.noise=+$('bn').value;B.cfg.Ta=+$('ta').value;B.cfg.bounce=$('bounce').checked;B.pot=+$('pot').value;
  $('v_bn').textContent=fmt(B.cfg.noise,2)+' °C';$('v_ta').textContent=B.cfg.Ta+' °C';$('v_pot').textContent=fmt(B.pot*5,2)+' V';$('v_ref').textContent=$('ref').value+' °C'}
['bn','ta','bounce','pot','ref'].forEach(i=>$(i).oninput=()=>{cfg();drawTrend()});
const ser=$('ser');
B.serialCb=s=>{ser.textContent+=s;if(ser.textContent.length>20000)ser.textContent=ser.textContent.slice(-15000);ser.scrollTop=ser.scrollHeight};
function run(){
  const r=B.load($('src').value);
  $('errs').innerHTML='';
  if(!r.ok){running=false;$('errs').innerHTML=r.errors.map(e=>'<div class="err">'+e.replace(/</g,'&lt;')+'</div>').join('');return}
  B.serialCb=s=>{ser.textContent+=s;if(ser.textContent.length>20000)ser.textContent=ser.textContent.slice(-15000);ser.scrollTop=ser.scrollHeight};
  cfg();B.T=B.cfg.Ta+2;B.peakT=B.T;hist=[];lastSample=0;ser.textContent='';running=true;paused=false;$('pause').textContent='⏸ Pauză';lastReal=performance.now();
}
$('run').onclick=run;
$('rst').onclick=()=>{if(running)run();else{B.reset();hist=[];ser.textContent='';drawTrend()}};
$('pause').onclick=()=>{if(!running)return;paused=!paused;$('pause').textContent=paused?'▶ Continuă':'⏸ Pauză';lastReal=performance.now()};
$('sclr').onclick=()=>{ser.textContent=''};
function send(){const v=$('sin').value;if(!v)return;B.serialInput(v+'\n');ser.textContent+='> '+v+'\n';$('sin').value=''}
$('ssend').onclick=send;$('sin').onkeydown=e=>{if(e.key==='Enter')send()};
[['b2',2],['b3',3]].forEach(([id,p])=>{const e=$(id);const dn=ev=>{ev.preventDefault();B.press(p,true)},up=()=>B.press(p,false);
  e.addEventListener('mousedown',dn);e.addEventListener('touchstart',dn);window.addEventListener('mouseup',up);window.addEventListener('touchend',up)});

function drawTrend(){
  const c=$('trend');const o=canvasSetup(c);if(!o)return;const {g,w,h}=o;g.clearRect(0,0,w,h);
  const m={l:40,r:36,t:10,b:22};const tmax=Math.max(600,hist.length?hist[hist.length-1].t:0),t0=Math.max(0,tmax-600),ref=+$('ref').value;
  axes(g,w,h,m,v=>Math.round(v)+'s','°C',t0,t0+600,15,65,6,5);
  const X=t=>m.l+(w-m.l-m.r)*(t-t0)/600,Y=v=>h-m.b-(h-m.t-m.b)*(Math.max(15,Math.min(65,v))-15)/50;
  g.setLineDash([5,4]);g.strokeStyle=css('--warn');g.lineWidth=1.3;g.beginPath();g.moveTo(m.l,Y(ref));g.lineTo(w-m.r,Y(ref));g.stroke();g.setLineDash([]);
  const vis=hist.filter(p=>p.t>=t0);
  if(vis.length>1){
    g.fillStyle=css('--ac');g.globalAlpha=.18;g.beginPath();g.moveTo(X(vis[0].t),h-m.b);vis.forEach(p=>g.lineTo(X(p.t),h-m.b-(h-m.t-m.b)*p.u*0.28));g.lineTo(X(vis[vis.length-1].t),h-m.b);g.fill();g.globalAlpha=1;
    g.strokeStyle=css('--bad');g.lineWidth=2;g.beginPath();vis.forEach((p,i)=>{i?g.lineTo(X(p.t),Y(p.T)):g.moveTo(X(p.t),Y(p.T))});g.stroke();
  }
  g.fillStyle=css('--mut');g.textAlign='left';g.fillText('— T (LM35)   ▒ comanda încălzitorului   - - referință',m.l+4,m.t+10);
}
function updKV(){
  const u=B.heaterU();
  $('b_out').innerHTML=
   '<div><span>Temperatura reală</span><b>'+fmt(B.T,2)+' °C</b></div>'+
   '<div><span>Încălzitor (D8/D9)</span><b>'+fmt(u*100,0)+' %</b></div>'+
   '<div><span>LED D13</span><b>'+(B.out[13]?'● aprins':'○ stins')+'</b></div>'+
   '<div><span>Timp simulat</span><b>'+fmt(B.t/1e6,0)+' s</b></div>'+
   '<div><span>Comutări releu D8</span><b>'+B.sw8+'</b></div>'+
   '<div><span>Supradepășire maximă</span><b>'+fmt(B.peakT,1)+' °C</b></div>'+
   '<div><span>ISR executate</span><b>'+B.stats.isr+'</b></div>'+
   '<div><span>Stare</span><b class="'+(B.halted?'bad':running?'ok':'')+'">'+(B.halted?'oprit':running?(paused?'pauză':'rulează'):'—')+'</b></div>';
  if(B.error&&!$('errs').textContent){$('errs').innerHTML='<div class="err">'+B.error+'</div>'}
}
function frame(now){
  if(running&&!paused&&!B.halted){
    const dt=Math.min(100,now-lastReal)*(+$('spd').value);lastReal=now;
    B.advance(dt,8);
    while(lastSample+1e6<=B.t){lastSample+=1e6;hist.push({t:lastSample/1e6,T:B.T,u:B.heaterU()});if(hist.length>7200)hist.shift()}
  }else lastReal=now;
  if(document.getElementById('t3').classList.contains('on')){drawTrend();updKV()}
  requestAnimationFrame(frame);
}

/* ---------- 4. referat ---------- */
$('dl').onclick=()=>{
  const t='REFERAT – Lucrarea 4: Programare microcontrolere. IDE Arduino\n'+'Nume/grupa: '+$('r_nm').value+'\nData: '+new Date().toLocaleString('ro-RO')+'\n\n== Rezultate A1–A8 ==\n'+$('r_a').value+'\n\n== Arduino real ==\n'+$('r_b').value+'\n\n== Sketch curent din simulator ==\n'+$('src').value+'\n\n== Ultimele rânduri din monitorul serial ==\n'+ser.textContent.split('\n').slice(-25).join('\n')+'\n';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain;charset=utf-8'}));a.download='referat_lucrarea4.txt';a.click();
};

function redrawAll(){t1();pwm();adc();drawTrend();updKV()}
window.addEventListener('resize',redrawAll);
loadPre();redrawAll();requestAnimationFrame(frame);
window.__lab4={B,run,PRE,get hist(){return hist}};
})();
