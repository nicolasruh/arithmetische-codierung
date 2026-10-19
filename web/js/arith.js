// Arithmetische Codierung (ohne DOM). Exakte Bruchrechnung mit BigInt.
// Browser: global `Arith`, Node: module.exports.
(function (root) {
  'use strict';

  const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; };
  function frac(n, d = 1n) {
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    return { n: n / g, d: d / g };
  }
  const add = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
  const sub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
  const mul = (a, b) => frac(a.n * b.n, a.d * b.d);
  const div = (a, b) => frac(a.n * b.d, a.d * b.n);
  const cmp = (a, b) => { const x = a.n * b.d - b.n * a.d; return x < 0n ? -1 : x > 0n ? 1 : 0; };

  // Dezimaldarstellung mit hoechstens `digits` Nachkommastellen. exact=false: gerundet.
  function fmt(f, digits) {
    const p = 10n ** BigInt(digits);
    const scaled = f.n * p;
    let q = scaled / f.d;
    const r = scaled % f.d;
    const exact = r === 0n;
    if (!exact && 2n * r >= f.d) q += 1n;
    const ip = q / p;
    let fp = (q % p).toString().padStart(digits, '0');
    if (exact) fp = fp.replace(/0+$/, '');
    return { text: fp ? `${ip}.${fp}` : `${ip}`, exact };
  }

  // Wahrscheinlichkeit = Anzahl / Laenge; Zeichen alphabetisch (Codepoint) sortiert.
  function model(arr) {
    const counts = new Map();
    for (const c of arr) counts.set(c, (counts.get(c) || 0) + 1);
    const N = BigInt(arr.length);
    let cum = 0n;
    const symbols = [...counts.keys()].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).map(char => {
      const count = BigInt(counts.get(char));
      const s = { char, count: Number(count), p: frac(count, N), lo: frac(cum, N), hi: frac(cum + count, N) };
      cum += count;
      return s;
    });
    return { symbols, N: arr.length };
  }

  // Kuerzeste Dezimalzahl, die echt im Innern von (lo, hi) liegt.
  function shortestDecimal(lo, hi) {
    for (let k = 1; k <= 60; k++) {
      const p = 10n ** BigInt(k);
      const m = (lo.n * p) / lo.d + 1n;
      if (m * hi.d < hi.n * p) {
        return { value: frac(m, p), digits: k, text: '0.' + m.toString().padStart(k, '0') };
      }
    }
    return null;
  }

  function encode(arr, mdl) {
    let lo = frac(0n), hi = frac(1n);
    const steps = [];
    for (const ch of arr) {
      const s = mdl.symbols.find(x => x.char === ch);
      const w = sub(hi, lo);
      const nlo = add(lo, mul(w, s.lo));
      const nhi = add(lo, mul(w, s.hi));
      lo = nlo; hi = nhi;
      steps.push({ char: ch, lo, hi });
    }
    return { steps, lo, hi, number: shortestDecimal(lo, hi) };
  }

  // Schritte: {lo, hi, subs: [{char, lo, hi}], idx}
  function decode(x, mdl, n) {
    let lo = frac(0n), hi = frac(1n);
    const steps = [];
    let text = '';
    for (let i = 0; i < n; i++) {
      const w = sub(hi, lo);
      const subs = mdl.symbols.map(s => ({ char: s.char, lo: add(lo, mul(w, s.lo)), hi: add(lo, mul(w, s.hi)) }));
      const idx = subs.findIndex(s => cmp(x, s.lo) >= 0 && cmp(x, s.hi) < 0);
      if (idx < 0) return { steps, text, error: i };
      steps.push({ lo, hi, subs, idx });
      text += subs[idx].char;
      lo = subs[idx].lo; hi = subs[idx].hi;
    }
    return { steps, text, error: null };
  }

  // Position von f im Intervall [lo, hi] als Zahl zwischen 0 und 1 (nur fuer die Zeichnung).
  function ratio(f, lo, hi) {
    const t = div(sub(f, lo), sub(hi, lo));
    return Number((t.n * 1000000000n) / t.d) / 1e9;
  }

  const api = { frac, add, sub, mul, div, cmp, fmt, model, shortestDecimal, encode, decode, ratio };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Arith = api;
})(typeof self !== 'undefined' ? self : this);
