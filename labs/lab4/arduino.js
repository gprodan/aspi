/*
 * mini-Arduino: compilator pentru un subset de C++ Arduino -> JavaScript (generatoare)
 * + placă virtuală (Uno) cu proces termic (fermentator), Serial, Timer1 (CTC), întreruperi externe.
 * Folosit în Lucrarea 4 (ASPI, MSP2101). Rulează în browser și în Node (pentru teste).
 */
(function (root) {
'use strict';

/* ---------------- tipuri ---------------- */
const RANK = { bool: 1, char: 1, sbyte: 1, byte: 1, int: 1, uint: 2, long: 3, ulong: 4, float: 5 };
const INTS = ['bool', 'char', 'sbyte', 'byte', 'int', 'uint', 'long', 'ulong'];
const isInt = t => INTS.includes(t);
function promote(a, b) {
  const ra = RANK[a] || 1, rb = RANK[b] || 1;
  const m = Math.max(ra, rb);
  if (m === 5) return 'float';
  if (m === 4) return 'ulong';
  if (m === 3) return 'long';
  if (m === 2) return (ra === 3 || rb === 3) ? 'long' : 'uint';
  return 'int';
}
function wrap(js, ty) {
  switch (ty) {
    case 'int': return '((' + js + ')<<16>>16)';
    case 'uint': return '((' + js + ')&65535)';
    case 'long': return '((' + js + ')|0)';
    case 'ulong': return '((' + js + ')>>>0)';
    case 'byte': return '((' + js + ')&255)';
    case 'sbyte': case 'char': return '((' + js + ')<<24>>24)';
    case 'bool': return '((' + js + ')?1:0)';
    default: return '(' + js + ')';
  }
}

/* ---------------- lexer ---------------- */
function lex(src, errs) {
  const T = [], macros = {};
  let i = 0, line = 1; const n = src.length;
  const push = (t, v, extra) => T.push(Object.assign({ t, v, line }, extra));
  let atLineStart = true;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; atLineStart = true; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const seg = src.slice(i, e < 0 ? n : e + 2); line += (seg.match(/\n/g) || []).length; i = e < 0 ? n : e + 2; continue; }
    if (c === '#' && atLineStart) {
      let e = src.indexOf('\n', i); if (e < 0) e = n;
      const ln = src.slice(i + 1, e).trim();
      let m;
      if ((m = /^define\s+([A-Za-z_]\w*)(\([^)]*\))?\s*(.*)$/.exec(ln))) {
        if (m[2]) errs.push('Linia ' + line + ': macro-urile cu parametri nu sunt acceptate (folosiți o funcție)');
        else macros[m[1]] = m[3];
      } else if (!/^include\b/.test(ln)) errs.push('Linia ' + line + ': directivă nesuportată: #' + ln.split(/\s/)[0]);
      i = e; continue;
    }
    atLineStart = false;
    let m; const rest = src.slice(i, i + 64);
    if ((m = /^0[xX][0-9a-fA-F]+([uUlL]*)/.exec(rest))) { push('num', parseInt(m[0], 16), { suf: m[1].toUpperCase() }); i += m[0].length; continue; }
    if ((m = /^0[bB][01]+([uUlL]*)/.exec(rest))) { push('num', parseInt(m[0].slice(2).replace(/[uUlL]/g, ''), 2), { suf: m[1].toUpperCase() }); i += m[0].length; continue; }
    if ((m = /^(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?([fFuUlL]*)/.exec(rest)) && /[0-9.]/.test(c)) {
      const isF = /[.eE]/.test(m[1] + (m[2] || '')) || /f/i.test(m[3]);
      push('num', parseFloat(m[1] + (m[2] || '')), { flt: isF, suf: m[3].toUpperCase() }); i += m[0].length; continue;
    }
    if ((m = /^[A-Za-z_]\w*/.exec(rest))) { push('id', m[0]); i += m[0].length; continue; }
    if (c === '"') { let j = i + 1, s = ''; while (j < n && src[j] !== '"' && src[j] !== '\n') { if (src[j] === '\\') { const x = src[j + 1]; s += x === 'n' ? '\n' : x === 't' ? '\t' : x === 'r' ? '\r' : x; j += 2; } else s += src[j++]; } if (src[j] !== '"') errs.push('Linia ' + line + ': șir de caractere neînchis'); push('str', s); i = j + 1; continue; }
    if (c === "'") { let j = i + 1, ch; if (src[j] === '\\') { const x = src[j + 1]; ch = x === 'n' ? 10 : x === 't' ? 9 : x === 'r' ? 13 : x === '0' ? 0 : x.charCodeAt(0); j += 2; } else ch = src.charCodeAt(j++); if (src[j] !== "'") errs.push('Linia ' + line + ': caracter invalid'); push('chr', ch); i = j + 1; continue; }
    if ((m = /^(<<=|>>=|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|==|!=|<=|>=|&&|\|\||<<|>>|[-+*\/%=<>!&|^~?:;,.(){}\[\]])/.exec(rest))) { push('op', m[0]); i += m[0].length; continue; }
    errs.push('Linia ' + line + ': caracter necunoscut „' + c + '”'); i++;
  }
  // expandare macro-uri (un singur nivel, de câteva ori)
  const out = [];
  function expand(tok, depth) {
    if (tok.t === 'id' && Object.prototype.hasOwnProperty.call(macros, tok.v) && depth < 6) {
      const sub = lex(macros[tok.v], []).toks;
      sub.forEach(s => { s.line = tok.line; expand(s, depth + 1); });
    } else out.push(tok);
  }
  T.forEach(t => expand(t, 0));
  return { toks: out };
}

/* ---------------- parser ---------------- */
const TYPE_WORDS = new Set(['int', 'long', 'short', 'char', 'byte', 'bool', 'boolean', 'float', 'double', 'void', 'unsigned', 'signed', 'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t', 'size_t', 'word']);
const QUAL = new Set(['const', 'volatile', 'static']);
function mapType(ws) {
  if (ws.includes('void')) return 'void';
  if (ws.includes('float') || ws.includes('double')) return 'float';
  if (ws.includes('unsigned')) return ws.includes('long') ? 'ulong' : ws.includes('char') ? 'byte' : 'uint';
  if (ws.includes('long') || ws.includes('int32_t')) return 'long';
  if (ws.includes('uint32_t')) return 'ulong';
  if (ws.includes('byte') || ws.includes('uint8_t')) return 'byte';
  if (ws.includes('uint16_t') || ws.includes('word') || ws.includes('size_t')) return 'uint';
  if (ws.includes('int8_t')) return 'sbyte';
  if (ws.includes('char')) return 'char';
  if (ws.includes('bool') || ws.includes('boolean')) return 'bool';
  return 'int';
}
function parse(toks) {
  let p = 0;
  const pk = (o = 0) => toks[p + o];
  const fail = (m, t) => { const tt = t || pk() || toks[toks.length - 1] || { line: 1 }; throw { line: tt.line, msg: m }; };
  const isOp = (v, o = 0) => { const t = pk(o); return t && t.t === 'op' && t.v === v; };
  const isId = (v, o = 0) => { const t = pk(o); return t && t.t === 'id' && (v === undefined || t.v === v); };
  const found = () => pk() ? ' (s-a găsit „' + (pk().v) + '”)' : ' (sfârșit de fișier)';
  const eat = v => { if (!isOp(v)) fail('se aștepta „' + v + '”' + found()); return toks[p++]; };
  function tryType() {
    const save = p; const ws = []; let cst = false;
    while (pk() && pk().t === 'id' && (TYPE_WORDS.has(pk().v) || QUAL.has(pk().v))) { if (QUAL.has(pk().v)) { if (pk().v === 'const') cst = true; } else ws.push(pk().v); p++; }
    if (!ws.length) { p = save; return null; }
    return { ty: mapType(ws), cst };
  }
  function unknownTypeAhead() { return pk() && pk().t === 'id' && !TYPE_WORDS.has(pk().v) && !QUAL.has(pk().v) && pk(1) && pk(1).t === 'id' && !TYPE_WORDS.has(pk(1).v) && pk(2) && pk(2).t === 'op' && ['=', ';', '[', ',', '('].includes(pk(2).v) && !['return', 'else', 'case', 'do', 'goto'].includes(pk().v); }

  /* expresii */
  function primary() {
    const t = pk(); if (!t) fail('expresie incompletă');
    if (t.t === 'num') { p++; let ty; if (t.flt) ty = 'float'; else if (t.suf.includes('U') && t.suf.includes('L')) ty = 'ulong'; else if (t.suf.includes('L') || t.v > 32767) ty = t.v > 2147483647 ? 'ulong' : 'long'; else if (t.suf.includes('U')) ty = 'uint'; else ty = 'int'; return { k: 'num', v: t.v, ty, line: t.line }; }
    if (t.t === 'chr') { p++; return { k: 'num', v: t.v, ty: 'char', line: t.line }; }
    if (t.t === 'str') { p++; return { k: 'str', v: t.v, line: t.line }; }
    if (isOp('(')) { p++; const e = expr(); eat(')'); return e; }
    if (t.t === 'id') {
      p++;
      if (isOp('.')) { // Serial.print(...)
        p++; const m = pk(); if (!m || m.t !== 'id') fail('se aștepta un nume după „.”'); p++;
        eat('('); const args = []; if (!isOp(')')) { do { args.push(expr()); } while (isOp(',') && p++); } eat(')');
        return { k: 'call', n: t.v + '.' + m.v, args, line: t.line };
      }
      if (isOp('(')) { p++; const args = []; if (!isOp(')')) { do { args.push(expr()); } while (isOp(',') && p++); } eat(')'); return { k: 'call', n: t.v, args, line: t.line }; }
      return { k: 'id', n: t.v, line: t.line };
    }
    fail('expresie neașteptată „' + t.v + '”', t);
  }
  function postfix() {
    let e = primary();
    for (;;) {
      if (isOp('[')) { p++; const i = expr(); eat(']'); e = { k: 'idx', a: e, i, line: e.line }; }
      else if (isOp('++') || isOp('--')) { const o = toks[p++].v; e = { k: 'post', op: o, e, line: e.line }; }
      else break;
    }
    return e;
  }
  function unary() {
    const t = pk();
    if (t && t.t === 'op') {
      if (['-', '+', '!', '~'].includes(t.v)) { p++; return { k: 'un', op: t.v, e: unary(), line: t.line }; }
      if (t.v === '++' || t.v === '--') { p++; return { k: 'pre', op: t.v, e: unary(), line: t.line }; }
      if (t.v === '(') { // cast?
        const save = p; p++; const ty = tryType();
        if (ty && isOp(')')) { p++; return { k: 'cast', ty: ty.ty, e: unary(), line: t.line }; }
        p = save;
      }
    }
    return postfix();
  }
  const lvl = (sub, ops) => function f() { let l = sub(); while (pk() && pk().t === 'op' && ops.includes(pk().v)) { const o = toks[p++]; l = { k: 'bin', op: o.v, l, r: sub(), line: o.line }; } return l; };
  const mul = lvl(unary, ['*', '/', '%']), add = lvl(mul, ['+', '-']), shf = lvl(add, ['<<', '>>']), rel = lvl(shf, ['<', '>', '<=', '>=']), eqa = lvl(rel, ['==', '!=']),
    band = lvl(eqa, ['&']), bxor = lvl(band, ['^']), bor = lvl(bxor, ['|']), land = lvl(bor, ['&&']), lor = lvl(land, ['||']);
  function cond() { const c = lor(); if (isOp('?')) { p++; const a = expr(); eat(':'); const b = cond(); return { k: 'cond', c, a, b, line: c.line }; } return c; }
  const ASG = ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='];
  function assign() { const l = cond(); if (pk() && pk().t === 'op' && ASG.includes(pk().v)) { const o = toks[p++]; return { k: 'asg', op: o.v, l, r: assign(), line: o.line }; } return l; }
  function expr() { let e = assign(); while (isOp(',') && false) { p++; } return e; }

  /* instrucțiuni */
  function block() { eat('{'); const b = []; while (!isOp('}')) { if (!pk()) fail('lipsește „}”'); b.push(stmt()); } eat('}'); return { k: 'block', b }; }
  function declarators(ty, cst) {
    const ds = [];
    do {
      const nt = pk(); if (!nt || nt.t !== 'id') fail('se aștepta un nume de variabilă' + found()); p++;
      let arr = null, init = null;
      if (isOp('[')) { p++; arr = isOp(']') ? { size: null } : { size: expr() }; eat(']'); }
      if (isOp('=')) {
        p++;
        if (isOp('{')) { p++; init = { list: [] }; if (!isOp('}')) { do { init.list.push(expr()); } while (isOp(',') && p++); } eat('}'); }
        else init = { e: expr() };
      }
      ds.push({ name: nt.v, arr, init, line: nt.line });
    } while (isOp(',') && p++);
    return { k: 'decl', ty, cst, ds, line: ds[0].line };
  }
  function stmt() {
    const t = pk();
    if (!t) fail('instrucțiune incompletă');
    if (isOp('{')) return block();
    if (isOp(';')) { p++; return { k: 'empty' }; }
    if (t.t === 'id') {
      switch (t.v) {
        case 'if': { p++; eat('('); const c = expr(); eat(')'); const a = stmt(); let b = null; if (isId('else')) { p++; b = stmt(); } return { k: 'if', c, a, b }; }
        case 'while': { p++; eat('('); const c = expr(); eat(')'); return { k: 'while', c, body: stmt() }; }
        case 'do': { p++; const body = stmt(); if (!isId('while')) fail('se aștepta „while”' + found()); p++; eat('('); const c = expr(); eat(')'); eat(';'); return { k: 'do', c, body }; }
        case 'for': { p++; eat('('); let init = null, c = null, inc = null;
          if (!isOp(';')) { const ty = tryType(); init = ty ? declarators(ty.ty, ty.cst) : { k: 'expr', e: expr() }; } eat(';');
          if (!isOp(';')) c = expr(); eat(';'); if (!isOp(')')) inc = expr(); eat(')'); return { k: 'for', init, c, inc, body: stmt() }; }
        case 'switch': { p++; eat('('); const e = expr(); eat(')'); eat('{'); const cs = [];
          while (!isOp('}')) { if (isId('case')) { p++; const v = expr(); eat(':'); cs.push({ v, b: [] }); } else if (isId('default')) { p++; eat(':'); cs.push({ v: null, b: [] }); } else { if (!cs.length) fail('instrucțiune în afara unui „case”'); cs[cs.length - 1].b.push(stmt()); } }
          eat('}'); return { k: 'switch', e, cs }; }
        case 'return': { p++; let e = null; if (!isOp(';')) e = expr(); eat(';'); return { k: 'return', e, line: t.line }; }
        case 'break': p++; eat(';'); return { k: 'break' };
        case 'continue': p++; eat(';'); return { k: 'continue' };
      }
    }
    const ty = tryType();
    if (ty) { const d = declarators(ty.ty, ty.cst); eat(';'); return d; }
    if (unknownTypeAhead()) fail('tip necunoscut sau nesuportat în simulator: „' + pk().v + '”');
    const e = expr(); eat(';'); return { k: 'expr', e };
  }
  /* nivel superior */
  const prog = { globals: [], funcs: [], isrs: [] };
  while (p < toks.length) {
    if (isId('ISR') && isOp('(', 1)) {
      p += 2; const v = pk(); if (!v || v.t !== 'id') fail('ISR cere un nume de vector'); p++; eat(')');
      prog.isrs.push({ vect: v.v, body: block(), line: v.line }); continue;
    }
    const ty = tryType();
    if (!ty) { if (unknownTypeAhead()) fail('tip necunoscut sau nesuportat în simulator: „' + pk().v + '”'); fail('declarație neașteptată „' + pk().v + '”'); }
    if (pk() && pk().t === 'id' && isOp('(', 1)) {
      const name = pk().v, line = pk().line; p += 2; const params = [];
      if (!isOp(')')) {
        if (isId('void') && isOp(')', 1)) p++;
        else do { const pt = tryType(); if (!pt) fail('se aștepta un tip de parametru' + found()); const pn = pk(); if (!pn || pn.t !== 'id') fail('se aștepta numele parametrului'); p++; if (isOp('[')) fail('parametrii de tip tablou nu sunt acceptați în simulator'); params.push({ ty: pt.ty, name: pn.v }); } while (isOp(',') && p++);
      }
      eat(')');
      if (isOp(';')) { p++; continue; }       // prototip
      prog.funcs.push({ name, ret: ty.ty, params, body: block(), line });
    } else { const d = declarators(ty.ty, ty.cst); eat(';'); prog.globals.push(d); }
  }
  return prog;
}

/* ---------------- compilator -> JS ---------------- */
const CONSTS = { HIGH: [1, 'int'], LOW: [0, 'int'], INPUT: [0, 'int'], OUTPUT: [1, 'int'], INPUT_PULLUP: [2, 'int'], LED_BUILTIN: [13, 'int'],
  A0: [14, 'int'], A1: [15, 'int'], A2: [16, 'int'], A3: [17, 'int'], A4: [18, 'int'], A5: [19, 'int'], true: [1, 'bool'], false: [0, 'bool'],
  PI: [Math.PI, 'float'], DEFAULT: [1, 'int'], INTERNAL: [3, 'int'], EXTERNAL: [0, 'int'], RISING: [3, 'int'], FALLING: [2, 'int'], CHANGE: [1, 'int'],
  BIN: [2, 'int'], OCT: [8, 'int'], DEC: [10, 'int'], HEX: [16, 'int'],
  CS10: [0, 'int'], CS11: [1, 'int'], CS12: [2, 'int'], WGM12: [3, 'int'], WGM13: [4, 'int'], WGM10: [0, 'int'], WGM11: [1, 'int'], OCIE1A: [1, 'int'], TOIE1: [0, 'int'] };
const REGS = { TCCR1A: 'byte', TCCR1B: 'byte', TIMSK1: 'byte', OCR1A: 'uint', TCNT1: 'uint' };
const MATHF = { sqrt: 'sqrt', log: 'log', log10: 'log10', exp: 'exp', sin: 'sin', cos: 'cos', tan: 'tan', floor: 'floor', ceil: 'ceil', radians: 'rad', degrees: 'deg' };

function compile(prog) {
  const funcSig = {}; prog.funcs.forEach(f => { funcSig[f.name] = f; });
  const out = []; let tmpN = 0, curTemps = null, curRet = 'void';
  const err = (m, line) => { throw { line: line || 0, msg: m }; };
  const globals = new Map();
  function lookup(name, scope) { for (let s = scope; s; s = s.up) if (s.m.has(name)) return s.m.get(name); return globals.get(name) || null; }
  const newScope = up => ({ m: new Map(), up });
  function cexpr(e, sc) {
    switch (e.k) {
      case 'num': return { js: e.v < 0 ? '(' + e.v + ')' : String(e.v), ty: e.ty, cv: e.v };
      case 'str': return { js: JSON.stringify(e.v), ty: 'str' };
      case 'id': {
        const v = lookup(e.n, sc);
        if (v) { if (v.arr) err('„' + e.n + '” este un tablou; folosiți indexul', e.line); return { js: v.js, ty: v.ty, cv: v.cv }; }
        if (Object.prototype.hasOwnProperty.call(CONSTS, e.n)) { const c = CONSTS[e.n]; return { js: String(c[0]), ty: c[1], cv: c[0] }; }
        if (REGS[e.n]) return { js: 'rt.R.' + e.n, ty: REGS[e.n], reg: true };
        err('„' + e.n + '” nu a fost declarat în acest domeniu', e.line);
      }
      case 'idx': {
        if (e.a.k !== 'id') err('indexarea se aplică doar variabilelor tablou', e.line);
        const v = lookup(e.a.n, sc); if (!v || !v.arr) err('„' + e.a.n + '” nu este tablou', e.line);
        const i = cexpr(e.i, sc);
        return { js: '(' + v.js + '[' + i.js + ']||0)', ty: v.ty, lv: v.js + '[' + i.js + ']' };
      }
      case 'un': {
        const a = cexpr(e.e, sc);
        if (e.op === '!') return { js: '(' + a.js + '?0:1)', ty: 'bool' };
        const ty = a.ty === 'float' ? 'float' : promote(a.ty, 'int');
        if (e.op === '-') return { js: wrap('-' + a.js, ty), ty };
        if (e.op === '~') return { js: wrap('~' + a.js, ty), ty };
        return a;
      }
      case 'cast': { const a = cexpr(e.e, sc); return { js: a.ty === 'float' && e.ty !== 'float' ? wrap('Math.trunc(' + a.js + ')', e.ty) : wrap(a.js, e.ty), ty: e.ty }; }
      case 'cond': { const c = cexpr(e.c, sc), a = cexpr(e.a, sc), b = cexpr(e.b, sc); const ty = a.ty === 'str' ? 'str' : promote(a.ty, b.ty); return { js: '(' + c.js + '?' + a.js + ':' + b.js + ')', ty }; }
      case 'bin': return cbin(e.op, cexpr(e.l, sc), cexpr(e.r, sc));
      case 'asg': {
        const l = cexpr(e.l, sc); const lv = l.lv || (l.reg ? l.js : (e.l.k === 'id' ? l.js : null));
        if (!lv) err('în stânga atribuirii trebuie să fie o variabilă', e.line);
        if (e.l.k === 'id') { const v = lookup(e.l.n, sc); if (v && v.cst) err('variabila „' + e.l.n + '” este constantă (const)', e.line); }
        let r = cexpr(e.r, sc);
        if (r.ty === 'str') err('șirurile de caractere nu pot fi atribuite variabilelor în simulator', e.line);
        if (e.op !== '=') r = cbin(e.op.slice(0, -1), l, r);
        return { js: '(' + lv + '=' + conv(r, l.ty) + ')', ty: l.ty };
      }
      case 'pre': case 'post': {
        const l = cexpr(e.e, sc); const lv = l.lv || (l.reg || e.e.k === 'id' ? l.js : null);
        if (!lv) err('++/-- se aplică doar variabilelor', e.line);
        const nv = conv({ js: l.js + (e.op === '++' ? '+1' : '-1'), ty: promote(l.ty, 'int') }, l.ty);
        if (e.k === 'pre') return { js: '(' + lv + '=' + nv + ')', ty: l.ty };
        const t = '_t' + (tmpN++); curTemps.push(t);
        return { js: '(' + t + '=' + l.js + ',' + lv + '=' + nv + ',' + t + ')', ty: l.ty };
      }
      case 'call': return ccall(e, sc);
    }
    err('expresie nesuportată', e.line);
  }
  const conv = (r, ty) => { if (r.ty === 'str') err('șir de caractere într-un context numeric'); if (r.ty === ty) return r.js; if (ty === 'float') return r.js; if (r.ty === 'float') return wrap('Math.trunc(' + r.js + ')', ty); return wrap(r.js, ty); };
  function cbin(op, a, b) {
    if (a.ty === 'str' || b.ty === 'str') err('operație cu șiruri de caractere nesuportată');
    const ty = promote(a.ty, b.ty), A = a.js, B = b.js;
    switch (op) {
      case '+': case '-': return { js: ty === 'float' ? '(' + A + op + B + ')' : wrap(A + op + B, ty), ty };
      case '*': return { js: ty === 'float' ? '(' + A + '*' + B + ')' : (ty === 'long' || ty === 'ulong') ? wrap('Math.imul(' + A + ',' + B + ')', ty) : wrap(A + '*' + B, ty), ty };
      case '/': return { js: ty === 'float' ? '(' + A + '/' + B + ')' : wrap('rt.idiv(' + A + ',' + B + ')', ty), ty };
      case '%': return { js: ty === 'float' ? '(' + A + '%' + B + ')' : wrap('rt.imod(' + A + ',' + B + ')', ty), ty };
      case '<': case '>': case '<=': case '>=': case '==': case '!=': return { js: '(' + A + (op === '==' ? '===' : op === '!=' ? '!==' : op) + B + '?1:0)', ty: 'bool' };
      case '&&': return { js: '(' + A + '&&' + B + '?1:0)', ty: 'bool' };
      case '||': return { js: '(' + A + '||' + B + '?1:0)', ty: 'bool' };
      case '&': case '|': case '^': return { js: wrap('(' + A + ')' + op + '(' + B + ')', ty), ty };
      case '<<': { const t2 = promote(a.ty, 'int'); return { js: wrap('(' + A + ')<<(' + B + ')', t2), ty: t2 }; }
      case '>>': { const t2 = promote(a.ty, 'int'); return { js: wrap('(' + A + ')' + (t2 === 'uint' || t2 === 'ulong' ? '>>>' : '>>') + '(' + B + ')', t2), ty: t2 }; }
    }
    err('operator nesuportat ' + op);
  }
  function ccall(e, sc) {
    const n = e.n, line = e.line, args = e.args;
    const need = k => { if (args.length !== k) err('funcția „' + n + '” cere ' + k + ' argumente (s-au dat ' + args.length + ')', line); };
    const A = () => args.map(a => cexpr(a, sc));
    if (funcSig[n]) {
      const f = funcSig[n]; need(f.params.length);
      const a = A(); return { js: '(yield* f_' + n + '(' + a.map((x, i) => conv(x, f.params[i].ty)).join(',') + '))', ty: f.ret === 'void' ? 'void' : f.ret };
    }
    switch (n) {
      case 'pinMode': case 'digitalWrite': case 'analogWrite': { need(2); const a = A(); return { js: 'rt.' + n + '(' + a[0].js + ',' + a[1].js + ')', ty: 'void' }; }
      case 'digitalRead': { need(1); return { js: 'rt.digitalRead(' + A()[0].js + ')', ty: 'int' }; }
      case 'analogRead': { need(1); return { js: 'rt.analogRead(' + A()[0].js + ')', ty: 'int' }; }
      case 'analogReference': { need(1); return { js: 'rt.analogReference(' + A()[0].js + ')', ty: 'void' }; }
      case 'delay': { need(1); return { js: '(yield* rt.delay(' + A()[0].js + '))', ty: 'void' }; }
      case 'delayMicroseconds': { need(1); return { js: 'rt.delayUs(' + A()[0].js + ')', ty: 'void' }; }
      case 'millis': need(0); return { js: 'rt.millis()', ty: 'ulong' };
      case 'micros': need(0); return { js: 'rt.micros()', ty: 'ulong' };
      case 'noInterrupts': case 'cli': return { js: 'rt.setIE(0)', ty: 'void' };
      case 'interrupts': case 'sei': return { js: 'rt.setIE(1)', ty: 'void' };
      case 'digitalPinToInterrupt': { need(1); return { js: 'rt.d2i(' + A()[0].js + ')', ty: 'int' }; }
      case 'attachInterrupt': { need(3); if (args[1].k !== 'id' || !funcSig[args[1].n]) err('al doilea argument al attachInterrupt trebuie să fie numele unei funcții', line); const a0 = cexpr(args[0], sc), a2 = cexpr(args[2], sc); return { js: 'rt.attach(' + a0.js + ',f_' + args[1].n + ',' + a2.js + ')', ty: 'void' }; }
      case 'detachInterrupt': { need(1); return { js: 'rt.detach(' + A()[0].js + ')', ty: 'void' }; }
      case 'abs': { need(1); const a = A()[0]; return { js: '(Math.abs(' + a.js + '))', ty: a.ty === 'float' ? 'float' : promote(a.ty, 'int') }; }
      case 'min': case 'max': { need(2); const a = A(); const ty = promote(a[0].ty, a[1].ty); return { js: 'Math.' + n + '(' + a[0].js + ',' + a[1].js + ')', ty }; }
      case 'constrain': { need(3); const a = A(); const ty = promote(promote(a[0].ty, a[1].ty), a[2].ty); return { js: 'Math.min(Math.max(' + a[0].js + ',' + a[1].js + '),' + a[2].js + ')', ty }; }
      case 'map': { need(5); const a = A(); return { js: wrap('rt.map(' + a.map(x => x.js).join(',') + ')', 'long'), ty: 'long' }; }
      case 'pow': { need(2); const a = A(); return { js: 'Math.pow(' + a[0].js + ',' + a[1].js + ')', ty: 'float' }; }
      case 'sq': { need(1); const a = A()[0]; return { js: a.ty === 'float' ? '(' + a.js + '*' + a.js + ')' : wrap(a.js + '*' + a.js, promote(a.ty, 'int')), ty: a.ty === 'float' ? 'float' : promote(a.ty, 'int') }; }
      case 'round': { need(1); return { js: wrap('Math.round(' + A()[0].js + ')', 'long'), ty: 'long' }; }
      case 'random': { if (args.length === 1) { const a = A(); return { js: 'rt.random(0,' + a[0].js + ')', ty: 'long' }; } need(2); const a = A(); return { js: 'rt.random(' + a[0].js + ',' + a[1].js + ')', ty: 'long' }; }
      case 'randomSeed': return { js: '0', ty: 'void' };
      case 'F': { need(1); return A()[0]; }
      case 'bitRead': { need(2); const a = A(); return { js: '((' + a[0].js + '>>>' + a[1].js + ')&1)', ty: 'int' }; }
      case 'Serial.begin': { need(1); return { js: 'rt.serialBegin(' + A()[0].js + ')', ty: 'void' }; }
      case 'Serial.print': case 'Serial.println': {
        const nl = n.endsWith('ln');
        if (args.length === 0) { if (!nl) err('Serial.print cere un argument', line); return { js: 'rt.serialPrint("",true,"str")', ty: 'void' }; }
        const a = A();
        return { js: 'rt.serialPrint(' + a[0].js + ',' + nl + ',"' + a[0].ty + '"' + (a[1] ? ',' + a[1].js : '') + ')', ty: 'void' };
      }
      case 'Serial.available': return { js: 'rt.serialAvailable()', ty: 'int' };
      case 'Serial.read': return { js: 'rt.serialRead()', ty: 'int' };
      case 'Serial.parseInt': return { js: 'rt.serialParse(false)', ty: 'long' };
      case 'Serial.parseFloat': return { js: 'rt.serialParse(true)', ty: 'float' };
      case 'Serial.flush': return { js: '0', ty: 'void' };
    }
    if (MATHF[n]) { need(1); const a = A()[0]; const f = MATHF[n]; return { js: f === 'rad' ? '(' + a.js + '*Math.PI/180)' : f === 'deg' ? '(' + a.js + '*180/Math.PI)' : 'Math.' + f + '(' + a.js + ')', ty: 'float' }; }
    err('funcția „' + n + '” nu este definită sau nu este suportată în simulator', line);
  }
  function constEval(e, sc) {
    const r = cexpr(e, sc); if (r.cv !== undefined) return r.cv;
    try { return Function('return ' + r.js)(); } catch (x) { err('dimensiunea tabloului trebuie să fie o constantă', e.line); }
  }
  function declare(d, sc, isGlobal) {
    const lines = [];
    for (const x of d.ds) {
      const jsn = 'v_' + x.name;
      if (sc.m.has(x.name) && !isGlobal) err('variabila „' + x.name + '” este deja declarată în acest bloc', x.line);
      if (x.arr) {
        let len = x.arr.size ? constEval(x.arr.size, sc) : (x.init && x.init.list ? x.init.list.length : 0);
        if (!(len > 0)) err('tablou fără dimensiune', x.line);
        const vals = x.init && x.init.list ? x.init.list.map(v => conv(cexpr(v, sc), d.ty)) : [];
        lines.push('let ' + jsn + '=rt.arr(' + len + ',[' + vals.join(',') + ']);');
        sc.m.set(x.name, { js: jsn, ty: d.ty, arr: true, cst: false });
        continue;
      }
      let init = '0', cv;
      if (x.init) { if (x.init.list) err('listă de inițializare la o variabilă simplă', x.line); const r = cexpr(x.init.e, sc); init = conv(r, d.ty); if (d.cst && r.cv !== undefined && r.ty !== 'str') cv = r.cv; }
      sc.m.set(x.name, { js: jsn, ty: d.ty, arr: false, cst: d.cst, cv });
      lines.push('let ' + jsn + '=' + init + ';');
    }
    return lines.join('');
  }
  const BUD = 'if(((++rt.c)&63)===0&&rt.over())yield 0;';
  function cstmt(s, sc) {
    switch (s.k) {
      case 'empty': return '';
      case 'block': { const ns = newScope(sc); return '{' + s.b.map(x => cstmt(x, ns)).join('') + '}'; }
      case 'decl': return declare(s, sc, false);
      case 'expr': return cexpr(s.e, sc).js + ';';
      case 'if': return 'if(' + cexpr(s.c, sc).js + '){' + cstmt(s.a, newScope(sc)) + '}' + (s.b ? 'else{' + cstmt(s.b, newScope(sc)) + '}' : '');
      case 'while': return 'while(' + cexpr(s.c, sc).js + '){' + BUD + cstmt(s.body, newScope(sc)) + '}';
      case 'do': return 'do{' + BUD + cstmt(s.body, newScope(sc)) + '}while(' + cexpr(s.c, sc).js + ');';
      case 'for': { const ns = newScope(sc); const init = s.init ? (s.init.k === 'decl' ? declare(s.init, ns, false) : cexpr(s.init.e, ns).js + ';') : ';'; 
        return '{' + init + 'for(;' + (s.c ? cexpr(s.c, ns).js : '') + ';' + (s.inc ? cexpr(s.inc, ns).js : '') + '){' + BUD + cstmt(s.body, newScope(ns)) + '}}'; }
      case 'switch': { const e = cexpr(s.e, sc); return 'switch(' + e.js + '){' + s.cs.map(c => (c.v ? 'case ' + cexpr(c.v, sc).js + ':' : 'default:') + '{' + c.b.map(x => cstmt(x, newScope(sc))).join('') + '}').join('') + '}'; }
      case 'return': { if (!s.e) return 'return;'; const r = cexpr(s.e, sc); if (curRet === 'void') err('funcție void care returnează o valoare', s.line); return 'return ' + conv(r, curRet) + ';'; }
      case 'break': return 'break;';
      case 'continue': return 'continue;';
    }
    err('instrucțiune nesuportată');
  }
  /* globale */
  const gscope = { m: globals, up: null };
  const gInit = []; prog.globals.forEach(g => { gInit.push(declare(g, gscope, true)); });
  out.push(gInit.join('\n'));
  function emitFunc(name, params, body, ret) {
    curTemps = []; curRet = ret; tmpN = 0;
    const sc = newScope(null); params.forEach(pp => sc.m.set(pp.name, { js: 'v_' + pp.name, ty: pp.ty, arr: false }));
    const code = cstmt(body, sc);
    return 'function* ' + name + '(' + params.map(pp => 'v_' + pp.name).join(',') + '){' + (curTemps.length ? 'let ' + curTemps.join(',') + ';' : '') + code + '}';
  }
  const seen = {};
  prog.funcs.forEach(f => { if (seen[f.name]) err('funcția „' + f.name + '” este definită de două ori', f.line); seen[f.name] = 1; out.push(emitFunc('f_' + f.name, f.params, f.body, f.ret)); });
  prog.isrs.forEach((r, i) => out.push(emitFunc('isr_' + i, [], r.body, 'void')));
  if (!funcSig.setup) err('lipsește funcția setup()', 1);
  if (!funcSig.loop) err('lipsește funcția loop()', 1);
  out.push('return {setup:f_setup,loop:f_loop,isr:{' + prog.isrs.map((r, i) => r.vect + ':isr_' + i).join(',') + '}};');
  return '"use strict";\n' + out.join('\n');
}

function build(src) {
  const errs = [];
  const { toks } = lex(src, errs);
  if (errs.length) return { ok: false, errors: errs };
  try { const ast = parse(toks); const js = compile(ast); return { ok: true, js, errors: [] }; }
  catch (e) { if (e && e.msg) return { ok: false, errors: ['Linia ' + e.line + ': ' + e.msg] }; throw e; }
}

/* ---------------- placa virtuală ---------------- */
function Board() {
  this.cfg = { noise: 0.15, bounce: true, Ta: 20, vcc: 5.0 };
  this.reset();
}
const tnow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
Board.prototype.reset = function () {
  this.t = 0; this.wake = 0; this.c = 0; this.cLim = 1e18; this.dl = 1e18; this.halted = false; this.error = null; this.main = null; this.prog = null; this.ie = 1;
  this.mode = new Array(20).fill(0); this.out = new Array(20).fill(0); this.pwm = new Array(20).fill(-1);
  this.ref = 1; this.R = { TCCR1A: 0, TCCR1B: 0, TIMSK1: 0, OCR1A: 0, TCNT1: 0 };
  this.attached = {}; this.timerNext = 0; this.timerKey = ''; this.isrCount = 0; this.isrDropped = 0;
  this.btn = [0, 0, 0, 0];                // butoane 2 și 3 (index = pin), 1 = apăsat
  this.edges = {};                         // pin -> [{t,level}]
  this.lastLevel = { 2: 1, 3: 1 };
  this.pot = 0.5; this.serialOut = ''; this.serialIn = ''; this.baud = 0;
  this.T = 22; this.tPlant = 0; this.peakT = 22; this.ok = true;
  this.serialCb = null; this.rng = 12345;
  this.stats = { isr: 0, loops: 0 }; this.sw8 = 0;
};
Board.prototype.rnd = function () { this.rng = (this.rng * 1664525 + 1013904223) >>> 0; return this.rng / 4294967296; };
Board.prototype.gauss = function () { return Math.sqrt(-2 * Math.log(this.rnd() + 1e-12)) * Math.cos(2 * Math.PI * this.rnd()); };
Board.prototype.heaterU = function () { const r = this.out[8] ? 1 : 0; const p = this.pwm[9] >= 0 ? this.pwm[9] / 255 : (this.out[9] ? 1 : 0); return Math.max(r, p); };
Board.prototype.plantStep = function (dtS) {
  const u = this.heaterU(); const K = 45, tau = 120;
  const n = Math.max(1, Math.ceil(dtS / 0.05)); const h = dtS / n;
  for (let i = 0; i < n; i++) this.T += h * (K * u - (this.T - this.cfg.Ta)) / tau;
  if (this.T > this.peakT) this.peakT = this.T;
};
Board.prototype.load = function (src) {
  this.reset();
  const r = build(src); if (!r.ok) return r;
  const rt = this.makeRT();
  try { this.prog = new Function('rt', r.js)(rt); }
  catch (e) { return { ok: false, errors: ['Eroare la inițializare: ' + e.message] }; }
  const self = this;
  this.main = (function* () { yield* self.prog.setup(); for (;;) { yield* self.prog.loop(); self.stats.loops++; if (((++self.c) & 63) === 0 && self.over()) yield 0; } })();
  return { ok: true, errors: [] };
};
Board.prototype.over = function () { return this.c >= this.cLim || tnow() > this.dl; };
Board.prototype.makeRT = function () {
  const B = this;
  const rt = {
    R: B.R, get c() { return B.c; }, set c(v) { B.c = v; }, over: () => B.over(),
    arr: (n, init) => { const a = new Array(n).fill(0); init.forEach((v, i) => { a[i] = v; }); return a; },
    idiv: (a, b) => b === 0 ? 0 : Math.trunc(a / b), imod: (a, b) => b === 0 ? 0 : a % b,
    map: (x, a, b, c, d) => (b === a) ? 0 : Math.trunc((x - a) * (d - c) / (b - a) + c),
    random: (a, b) => a + Math.floor(B.rnd() * (b - a)),
    millis: () => Math.floor(B.t / 1000) >>> 0, micros: () => (Math.floor(B.t / 4) * 4) >>> 0,
    delay: function* (ms) { if (ms > 0) { B.wake = B.t + ms * 1000; yield 1; } },
    delayUs: us => { if (us > 0) B.t += us; },
    setIE: v => { B.ie = v; },
    pinMode: (p, m) => { if (p >= 0 && p < 20) { B.mode[p] = m; } },
    digitalWrite: (p, v) => { if (p >= 0 && p < 20) { if (p === 8 && (v ? 1 : 0) !== B.out[8]) B.sw8++; B.out[p] = v ? 1 : 0; B.pwm[p] = -1; } },
    analogWrite: (p, v) => { if (p < 0 || p > 19) return; v = Math.max(0, Math.min(255, v | 0)); if ([3, 5, 6, 9, 10, 11].includes(p)) { if (v === 0) { B.out[p] = 0; B.pwm[p] = -1; } else if (v === 255) { B.out[p] = 1; B.pwm[p] = -1; } else { B.pwm[p] = v; B.out[p] = 1; } } else { B.out[p] = v >= 128 ? 1 : 0; B.pwm[p] = -1; } },
    digitalRead: p => {
      if (p === 2 || p === 3) return B.levelAt(p, B.t);
      if (p >= 0 && p < 20 && B.mode[p] === 1) return B.out[p];
      return 0;
    },
    analogReference: m => { B.ref = m; },
    analogRead: p => { const a = p >= 14 ? p - 14 : p; return B.adc(a); },
    d2i: p => (p === 2 || p === 3) ? p : -1,
    attach: (p, fn, mode) => { if (p < 0) return; if (p < 2) p += 2; B.attached[p] = { fn, mode }; },
    detach: p => { delete B.attached[p < 2 ? p + 2 : p]; },
    serialBegin: b => { B.baud = b; },
    serialPrint: (v, nl, ty, arg) => {
      let s;
      if (ty === 'str') s = String(v);
      else if (ty === 'float') s = (arg === undefined ? 2 : arg) < 0 ? String(v) : (isFinite(v) ? Number(v).toFixed(arg === undefined ? 2 : arg) : (isNaN(v) ? 'nan' : (v > 0 ? 'inf' : '-inf')));
      else if (ty === 'char') s = (arg !== undefined && arg !== 10) ? Number(v).toString(arg) : String.fromCharCode(v & 255);
      else if (arg === 2 || arg === 8 || arg === 16) s = (v >>> 0 === v || v >= 0 ? v : (v >>> 0)).toString(arg).toUpperCase();
      else s = String(v);
      B.serialOut += s + (nl ? '\r\n' : ''); if (B.serialCb) B.serialCb(s + (nl ? '\r\n' : ''));
    },
    serialAvailable: () => B.serialIn.length,
    serialRead: () => { if (!B.serialIn.length) return -1; const c = B.serialIn.charCodeAt(0); B.serialIn = B.serialIn.slice(1); return c; },
    serialParse: fl => {
      const s = B.serialIn; let i = 0; while (i < s.length && !/[0-9+\-.]/.test(s[i])) i++;
      const m = (fl ? /^[+-]?(\d+\.?\d*|\.\d+)/ : /^[+-]?\d+/).exec(s.slice(i));
      if (!m) { B.serialIn = ''; return 0; }
      B.serialIn = s.slice(i + m[0].length); return fl ? parseFloat(m[0]) : parseInt(m[0], 10);
    },
  };
  return rt;
};
Board.prototype.adc = function (a) {
  const vref = this.ref === 3 ? 1.1 : this.cfg.vcc; let v;
  if (a === 0) { const T = this.T + this.cfg.noise * this.gauss(); v = 0.010 * T; }          // LM35: 10 mV/°C
  else if (a === 1) v = this.cfg.vcc * this.pot;                                                // potențiometru
  else if (a === 2) { const Tk = this.T + 273.15 + this.cfg.noise * this.gauss(); const R = 10000 * Math.exp(3950 * (1 / Tk - 1 / 298.15)); v = this.cfg.vcc * R / (10000 + R); } // NTC 10k la GND, 10k la Vcc
  else v = 0;
  return Math.max(0, Math.min(1023, Math.round(v / vref * 1023)));
};
Board.prototype.levelAt = function (p, t) {
  const e = this.edges[p]; if (!e || !e.length) return this.btn[p] ? 0 : 1;
  let lv = e[0].prev; for (const x of e) { if (x.t <= t) lv = x.level; else break; } return lv;
};
Board.prototype.press = function (p, down) {   // acțiune utilizator pe butonul de la pinul p
  if (this.btn[p] === (down ? 1 : 0)) return;
  this.btn[p] = down ? 1 : 0;
  const target = down ? 0 : 1; const prev = this.levelAt(p, this.t);
  const list = this.edges[p] || (this.edges[p] = []);
  const t0 = this.t;
  if (this.cfg.bounce) { let lv = target; for (let k = 0; k < 7; k++) { list.push({ t: t0 + k * 600 + 1, level: lv, prev }); lv = lv ? 0 : 1; } list.push({ t: t0 + 7 * 600, level: target, prev }); if (list[list.length - 2].level === target) list.pop(); }
  else list.push({ t: t0 + 1, level: target, prev });
  // asigură că ultimul nivel este „target”
  const last = list[list.length - 1]; if (last.level !== target) list.push({ t: last.t + 600, level: target, prev });
};
Board.prototype.stepTo = function (t1, frameDl) {
  // evenimente: muchii pe pinii 2/3 și Timer1
  const ev = [];
  for (const p of [2, 3]) {
    const e = this.edges[p]; if (!e) continue;
    for (const x of e) if (x.t > this.tEdge(p) && x.t <= t1) { const fromLv = x.pre === undefined ? null : x.pre; ev.push({ t: x.t, kind: 'pin', p, level: x.level }); }
  }
  // Timer1
  const tc = this.R.TCCR1B, ps = [0, 1, 8, 64, 256, 1024][tc & 7] || 0, ctc = (tc >> 3) & 1, en = (this.R.TIMSK1 >> 1) & 1;
  const key = [ps, ctc, en, this.R.OCR1A].join(',');
  if (key !== this.timerKey) { this.timerKey = key; this.timerNext = this.t + ((this.R.OCR1A + 1) * ps / 16); }
  if (ps && ctc && en && this.prog && this.prog.isr.TIMER1_COMPA_vect) {
    const per = (this.R.OCR1A + 1) * ps / 16; // µs
    let k = 0; while (this.timerNext <= t1 && k < 2000) { ev.push({ t: this.timerNext, kind: 'timer' }); this.timerNext += per; k++; }
    if (this.timerNext <= t1) { this.timerNext = t1 + per; this.isrDropped++; }
  }
  ev.sort((a, b) => a.t - b.t);
  for (const x of ev) {
    this.plantTo(x.t);
    if (x.kind === 'pin') {
      const prev = this.lastLevel[x.p]; this.lastLevel[x.p] = x.level; this.markEdge(x.p, x.t);
      const a = this.attached[x.p]; if (!a || !this.ie) continue;
      const rising = prev === 0 && x.level === 1, falling = prev === 1 && x.level === 0;
      if ((a.mode === 3 && rising) || (a.mode === 2 && falling) || (a.mode === 1 && (rising || falling)) || (a.mode === 0 && x.level === 0)) this.runISR(a.fn, x.t);
    } else if (this.ie) this.runISR(this.prog.isr.TIMER1_COMPA_vect, x.t);
  }
  this.t = Math.max(this.t, t1);
  this.plantTo(this.t);
};
Board.prototype.tEdge = function (p) { return (this.edgeDone && this.edgeDone[p]) || -1; };
Board.prototype.markEdge = function (p, t) { (this.edgeDone || (this.edgeDone = {}))[p] = t; };
Board.prototype.plantTo = function (t) { if (t > this.tPlant) { this.plantStep((t - this.tPlant) / 1e6); this.tPlant = t; } };
Board.prototype.runISR = function (fn, t) {
  const saveT = this.t; this.t = Math.max(this.t, t); this.stats.isr++;
  const g = fn(); let r, n = 0;
  try { while (!(r = g.next()).done) { if (++n > 10) { this.error = 'ISR blocat (delay() într-o rutină de întrerupere nu este permis)'; this.halted = true; break; } } }
  catch (e) { this.error = 'Eroare în ISR: ' + e.message; this.halted = true; }
  this.t = saveT;
};
Board.prototype.advance = function (dtMs, cpuMs) {
  if (!this.main || this.halted) return 0;
  const end = this.t + dtMs * 1000; const frameDl = tnow() + (cpuMs || 8); let done = 0;
  while (this.t < end && !this.halted) {
    const tPrev = this.t, t1 = Math.min(this.t + 1000, end);
    this.stepTo(t1);
    if (!this.halted && this.t >= this.wake) {
      this.dl = Math.min(frameDl, tnow() + 3); this.cLim = this.c + Math.max(1, Math.floor((t1 - tPrev) / 8));   // ~8 µs per iterație
      try { const r = this.main.next(); if (r.done) this.halted = true; }
      catch (e) { this.error = 'Eroare de execuție: ' + e.message; this.halted = true; }
    }
    done = this.t;
    if (tnow() > frameDl) break;
  }
  return Math.max(0, end - this.t) / 1000;   // ms rămase (întârziere)
};
Board.prototype.serialInput = function (s) { this.serialIn += s; };

const api = { build, Board, lex, parse, compile };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MiniArduino = api;
})(typeof self !== 'undefined' ? self : this);
