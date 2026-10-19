(function () {
  'use strict';
  const A = window.Arith;
  const I = window.I18n;
  const t = I.t;
  const $ = id => document.getElementById(id);
  const MAX_LEN = 12;
  const MAX_DISTINCT = 6;
  const EXAMPLES = ['ABRAKADABRA', 'ACABAAADBA', 'MISSISSIPPI', 'ANANAS', 'TOBEORNOT'];

  const el = {
    text: $('text'), lang: $('lang'), examples: $('examples'), message: $('message'),
    prev: $('prev'), next: $('next'), all: $('all'), undo: $('undo'), auto: $('auto'), reset: $('reset'),
    model: $('model'), number: $('number'), precision: $('precision'), length: $('length'), roundNote: $('roundNote'),
    decoded: $('decoded'), strips: $('strips'),
    showEnc: $('showEnc'), encBox: $('encBox'), encTable: $('encTable'), encFinal: $('encFinal'), encNumber: $('encNumber'),
  };

  const state = {
    mode: 'build',
    arr: null,
    model: null,
    enc: null,     // Codierung: Zwischenintervalle und Zahl
    dec: null,     // Decodierung der Zahl: Schritte mit Teilintervallen
    k: 0,          // Anzahl bereits bestimmter Zeichen
    wrong: null,   // {row, i}: zuletzt falsch angeklicktes Teilintervall
    msg: null,
  };

  const SVGNS = 'http://www.w3.org/2000/svg';
  let rounded = false;

  const lab = s => s.replace(/ /g, '␣');
  const total = () => state.arr.length;
  const complete = () => state.arr && state.k === total();

  function mk(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function svg(tag, attrs, text) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function setMsg(key, params, kind) { state.msg = { key, params, kind: kind || '' }; }

  // Zahl als Text; gerundete Werte werden mit ≈ gekennzeichnet, wenn mark gesetzt ist.
  function num(f, digits, mark) {
    const r = A.fmt(f, digits);
    if (!r.exact) rounded = true;
    return (mark && !r.exact ? '≈' : '') + r.text;
  }

  function digitsFor(subs) {
    let w = null;
    for (const s of subs) {
      const d = A.sub(s.hi, s.lo);
      if (!w || A.cmp(d, w) < 0) w = d;
    }
    const ratio = Number(w.d) / Number(w.n);
    return Math.max(3, Math.min(25, Math.ceil(Math.log10(ratio)) + 2));
  }

  function hintMsg() {
    if (state.mode === 'build') {
      setMsg('hintBuild', { i: state.k + 1, n: total(), x: state.enc.number.text });
    } else {
      setMsg('hintShow', { x: state.enc.number.text });
    }
  }

  function reset() {
    state.k = 0;
    state.wrong = null;
    if (state.arr) hintMsg();
  }

  function setText() {
    const arr = Array.from(el.text.value);
    state.arr = null; state.model = null; state.enc = null; state.dec = null;
    const distinct = new Set(arr).size;
    if (!arr.length) setMsg('hintEmpty');
    else if (arr.length > MAX_LEN) setMsg('errTooLong', { n: MAX_LEN }, 'error');
    else if (distinct > MAX_DISTINCT) setMsg('errTooMany', { n: MAX_DISTINCT }, 'error');
    else if (distinct < 2) setMsg('errTooFew', null, 'error');
    else {
      state.arr = arr;
      state.model = A.model(arr);
      state.enc = A.encode(arr, state.model);
      state.dec = A.decode(state.enc.number.value, state.model, arr.length);
    }
    reset();
    render();
  }

  // Beschreibung des bestimmten Zeichens in Schritt i (0-basiert).
  function chosenInfo(i) {
    const st = state.dec.steps[i];
    const s = st.subs[st.idx];
    const d = digitsFor(st.subs);
    return { c: lab(s.char), a: num(s.lo, d, true), b: num(s.hi, d, true), x: state.enc.number.text };
  }

  function advance() {
    if (complete()) return;
    state.k++;
    state.wrong = null;
  }

  function finishOrHint(key, i) {
    if (complete()) setMsg('done', { text: state.dec.text }, 'ok');
    else setMsg(key, chosenInfo(i), 'ok');
  }

  // ---- Selbst decodieren ----
  function onChoose(row, i) {
    if (state.mode !== 'build' || complete() || row !== state.k) return;
    const st = state.dec.steps[row];
    if (i === st.idx) {
      advance();
      finishOrHint('okBuild', row);
    } else {
      const s = st.subs[i];
      const d = digitsFor(st.subs);
      const side = A.cmp(state.enc.number.value, s.lo) < 0 ? t('left') : t('right');
      state.wrong = { row, i };
      setMsg('errChoice', { c: lab(s.char), a: num(s.lo, d, true), b: num(s.hi, d, true), x: state.enc.number.text, side }, 'error');
    }
    render();
  }

  function undo() {
    if (state.mode !== 'build' || state.k === 0) return;
    state.k--;
    state.wrong = null;
    hintMsg();
    render();
  }

  function autoComplete() {
    if (!state.arr || complete()) return;
    state.k = total();
    state.wrong = null;
    setMsg('allDone', { n: total(), text: state.dec.text }, 'ok');
    render();
  }

  // ---- Anzeigen ----
  function showNext() {
    if (!state.arr || complete()) return;
    advance();
    if (complete()) setMsg('done', { text: state.dec.text }, 'ok');
    else setMsg('stepShow', Object.assign({ i: state.k }, chosenInfo(state.k - 1)), 'ok');
    render();
  }

  function showPrev() {
    if (!state.arr || state.k === 0) return;
    state.k--;
    if (state.k === 0) hintMsg();
    else setMsg('stepShow', Object.assign({ i: state.k }, chosenInfo(state.k - 1)), 'ok');
    render();
  }

  function showAll() {
    if (!state.arr || complete()) return;
    state.k = total();
    setMsg('allDone', { n: total(), text: state.dec.text }, 'ok');
    render();
  }

  // ---- Darstellung ----
  function renderModel() {
    el.model.replaceChildren();
    if (!state.model) return;
    const table = document.createElement('table');
    const head = mk('tr');
    ['tableChar', 'tableCount', 'tableProb', 'tableRange'].forEach(k => head.appendChild(mk('th', '', t(k))));
    table.appendChild(head);
    for (const s of state.model.symbols) {
      const tr = mk('tr');
      tr.append(mk('td', 'mono', lab(s.char)), mk('td', 'mono', s.count),
        mk('td', 'mono', `${s.count}/${state.model.N} = ${num(s.p, 4, true)}`),
        mk('td', 'mono', `[${num(s.lo, 4, true)}; ${num(s.hi, 4, true)})`));
      table.appendChild(tr);
    }
    el.model.appendChild(table);
  }

  function renderStrips() {
    el.strips.replaceChildren();
    if (!state.arr) return;
    const rows = complete() ? total() : state.k + 1;
    const W = Math.max(520, el.strips.clientWidth - 2);
    const x0 = 60, x1 = W - 60, P = 120, TOP = 54, BOT = 80;
    const s = svg('svg', { width: W, height: rows * P, viewBox: `0 0 ${W} ${rows * P}` });
    const build = state.mode === 'build';
    const xnum = state.enc.number.value;

    for (let r = 0; r < rows; r++) {
      const st = state.dec.steps[r];
      const y = r * P;
      const decided = r < state.k;
      const px = f => x0 + (x1 - x0) * A.ratio(f, st.lo, st.hi);
      const digits = digitsFor(st.subs);

      if (decided && r + 1 < rows) {
        const a = px(st.subs[st.idx].lo), b = px(st.subs[st.idx].hi);
        s.appendChild(svg('path', { class: 'conn', d: `M${a} ${y + BOT} L${x0} ${y + P + TOP} M${b} ${y + BOT} L${x1} ${y + P + TOP}` }));
      }

      st.subs.forEach((sub, i) => {
        const xa = px(sub.lo), xb = px(sub.hi);
        const active = build && r === state.k && !complete();
        const cls = ['seg'];
        if (decided && i === st.idx) cls.push('chosen');
        if (active) cls.push('pick');
        if (state.wrong && state.wrong.row === r && state.wrong.i === i) cls.push('wrong');
        const rect = svg('rect', { class: cls.join(' '), x: xa, y: y + TOP, width: xb - xa, height: BOT - TOP });
        if (active) rect.addEventListener('click', () => onChoose(r, i));
        s.appendChild(rect);
        s.appendChild(svg('text', { class: 'segchar', x: (xa + xb) / 2, y: y + TOP + 15 }, lab(sub.char)));
      });

      const bounds = [st.subs[0].lo, ...st.subs.map(x => x.hi)];
      const lastEnd = [-1e9, -1e9, -1e9];
      bounds.forEach(f => {
        const x = px(f);
        s.appendChild(svg('line', { class: 'tick', x1: x, x2: x, y1: y + TOP - 6, y2: y + BOT + 4 }));
        const label = num(f, digits);
        const w = label.length * 7.2;
        let lvl = lastEnd.findIndex(e => x - w / 2 > e + 4);
        if (lvl < 0) lvl = 2;
        lastEnd[lvl] = x + w / 2;
        s.appendChild(svg('text', { class: 'tlabel', x, y: y + 44 - lvl * 14 }, label));
      });

      const xd = x0 + (x1 - x0) * A.ratio(xnum, st.lo, st.hi);
      if (decided) s.appendChild(svg('circle', { class: 'dot', cx: xd, cy: y + BOT - 6, r: 4 }));

      const rowText = t('strip', { i: r + 1 }) + (decided ? ' → ' + lab(st.subs[st.idx].char) : '');
      s.appendChild(svg('text', { class: 'rowlabel', x: x0, y: y + BOT + 24 }, rowText));
    }
    el.strips.appendChild(s);
  }

  function renderDecoded() {
    el.decoded.replaceChildren();
    if (!state.arr) return;
    el.decoded.appendChild(mk('span', '', t('decodedSoFar') + ' '));
    for (let i = 0; i < state.k; i++) el.decoded.appendChild(mk('span', 'chip', lab(state.dec.steps[i].subs[state.dec.steps[i].idx].char)));
  }

  function renderEncoding() {
    el.encBox.hidden = !el.showEnc.checked;
    if (!el.showEnc.checked || !state.enc) return;
    const enc = state.enc;
    const d = Math.min(25, enc.number.digits + 3);
    const table = document.createElement('table');
    const head = mk('tr');
    ['encStep', 'tableChar', 'encLow', 'encHigh'].forEach(k => head.appendChild(mk('th', '', t(k))));
    table.appendChild(head);
    const add = (a, b, c, e) => { const tr = mk('tr'); tr.append(mk('td', '', a), mk('td', 'mono', b), mk('td', 'mono', c), mk('td', 'mono', e)); table.appendChild(tr); };
    add(t('encStart'), '', '0', '1');
    enc.steps.forEach((s, i) => add(i + 1, lab(s.char), num(s.lo, d, true), num(s.hi, d, true)));
    el.encTable.replaceChildren(table);
    el.encFinal.textContent = t('encFinal', { a: num(enc.lo, d, true), b: num(enc.hi, d, true) });
    el.encNumber.textContent = t('encNumber', { x: enc.number.text, k: enc.number.digits });
  }

  function render() {
    rounded = false;
    const has = !!state.arr;
    const build = state.mode === 'build';
    const done = complete();
    el.prev.hidden = el.next.hidden = el.all.hidden = build;
    el.undo.hidden = !build;
    el.auto.hidden = !build;
    el.prev.disabled = !has || state.k === 0;
    el.next.disabled = !has || done;
    el.all.disabled = !has || done;
    el.undo.disabled = !has || state.k === 0;
    el.auto.disabled = !has || done;
    el.reset.disabled = !has;

    el.number.textContent = has ? state.enc.number.text : '';
    el.length.textContent = has ? `(${total()} ${t('lengthUnit')})` : '';
    el.precision.textContent = has ? t('precision', { k: state.enc.number.digits }) : '';
    document.getElementById('task').hidden = !has;
    el.message.textContent = state.msg ? t(state.msg.key, state.msg.params) : '';
    el.message.className = 'message ' + (state.msg ? state.msg.kind : '');

    renderModel();
    renderDecoded();
    renderStrips();
    renderEncoding();
    el.roundNote.hidden = !rounded;
  }

  function fillExamples() {
    el.examples.replaceChildren();
    const first = mk('option', '', t('examplePick'));
    first.value = '';
    el.examples.appendChild(first);
    EXAMPLES.forEach((ex, i) => {
      const o = mk('option', '', (i + 1) + ') ' + t('ex' + (i + 1)));
      o.value = String(i);
      el.examples.appendChild(o);
    });
  }

  function applyI18n() {
    fillExamples();
    document.documentElement.lang = I.getLang();
    document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(e => { e.placeholder = t(e.dataset.i18nPlaceholder); });
  }

  // ---- Ereignisse ----
  const fit = () => {
    const focused = document.activeElement === el.text;
    el.text.wrap = focused ? 'soft' : 'off';
    el.text.style.height = '';
    if (focused) el.text.style.height = el.text.scrollHeight + 2 + 'px';
  };
  el.text.addEventListener('input', () => {
    if (/[\r\n]/.test(el.text.value)) {
      const pos = el.text.selectionStart;
      el.text.value = el.text.value.replace(/[\r\n]/g, '');
      el.text.setSelectionRange(pos - 1, pos - 1);
    }
    fit();
    setText();
  });
  el.text.addEventListener('focus', fit);
  el.text.addEventListener('blur', () => { fit(); el.text.scrollTop = 0; el.text.scrollLeft = 0; });
  el.text.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });

  el.examples.addEventListener('change', ev => {
    const i = ev.target.value;
    if (i === '') return;
    el.text.value = EXAMPLES[Number(i)];
    ev.target.value = '';
    fit();
    setText();
  });

  document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => {
    state.mode = r.value;
    reset();
    render();
  }));
  el.lang.addEventListener('change', () => { I.setLang(el.lang.value); applyI18n(); if (state.arr && state.k === 0) hintMsg(); render(); });
  el.prev.addEventListener('click', showPrev);
  el.next.addEventListener('click', showNext);
  el.all.addEventListener('click', showAll);
  el.undo.addEventListener('click', undo);
  el.auto.addEventListener('click', autoComplete);
  el.reset.addEventListener('click', () => { reset(); render(); });
  el.showEnc.addEventListener('change', render);
  window.addEventListener('resize', renderStrips);

  applyI18n();
  setText();
})();
