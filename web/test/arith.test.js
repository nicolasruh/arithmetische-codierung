const test = require('node:test');
const assert = require('node:assert');
const A = require('../js/arith.js');

test('Beispiel der Folie: A=0.6 B=0.2 C=0.1 D=0.1, Nachricht ACD', () => {
  const mdl = A.model(Array.from('AAAAAABBCD'));
  assert.deepEqual(mdl.symbols.map(s => s.char), ['A', 'B', 'C', 'D']);
  const enc = A.encode(['A', 'C', 'D'], mdl);
  assert.equal(A.fmt(enc.lo, 6).text, '0.534');
  assert.equal(A.fmt(enc.hi, 6).text, '0.54');
  assert.equal(enc.number.text, '0.535');
  const dec = A.decode(enc.number.value, mdl, 3);
  assert.equal(dec.text, 'ACD');
  assert.equal(A.decode(A.frac(536n, 1000n), mdl, 3).text, 'ACD');
});

test('Encode/Decode ist verlustfrei, auch mit 12 Zeichen und 6 verschiedenen', () => {
  for (const text of ['ABRAKADABRA', 'MISSISSIPPI', 'TOBEORNOT', 'ABCDEFABCDEF', 'ABBA', 'AAAAAAAAAAAB']) {
    const arr = Array.from(text);
    const mdl = A.model(arr);
    const enc = A.encode(arr, mdl);
    assert.ok(A.cmp(enc.number.value, enc.lo) > 0 && A.cmp(enc.number.value, enc.hi) < 0);
    const dec = A.decode(enc.number.value, mdl, arr.length);
    assert.equal(dec.error, null);
    assert.equal(dec.text, text);
  }
});

test('Teilintervalle ueberdecken [0,1) lueckenlos', () => {
  const mdl = A.model(Array.from('MISSISSIPPI'));
  assert.equal(A.cmp(mdl.symbols[0].lo, A.frac(0n)), 0);
  assert.equal(A.cmp(mdl.symbols.at(-1).hi, A.frac(1n)), 0);
  for (let i = 1; i < mdl.symbols.length; i++) assert.equal(A.cmp(mdl.symbols[i].lo, mdl.symbols[i - 1].hi), 0);
});

test('fmt rundet und erkennt exakte Werte', () => {
  assert.deepEqual(A.fmt(A.frac(1n, 3n), 4), { text: '0.3333', exact: false });
  assert.deepEqual(A.fmt(A.frac(2n, 3n), 4), { text: '0.6667', exact: false });
  assert.deepEqual(A.fmt(A.frac(3n, 5n), 6), { text: '0.6', exact: true });
  assert.deepEqual(A.fmt(A.frac(1n), 6), { text: '1', exact: true });
  assert.deepEqual(A.fmt(A.frac(0n), 6), { text: '0', exact: true });
});

test('ratio liegt zwischen 0 und 1', () => {
  assert.equal(A.ratio(A.frac(1n, 2n), A.frac(0n), A.frac(1n)), 0.5);
});
