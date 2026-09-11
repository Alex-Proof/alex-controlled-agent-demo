import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDiscount } from './discount.js';

test('zieht einen prozentualen Rabatt vom Preis ab', () => {
  assert.equal(applyDiscount(100, 20), 80);
  assert.equal(applyDiscount(50, 10), 45);
});

test('Grenzfaelle: 0 % und 100 % Rabatt', () => {
  assert.equal(applyDiscount(100, 0), 100);
  assert.equal(applyDiscount(100, 100), 0);
});

test('wirft einen TypeError, wenn price keine Zahl ist', () => {
  assert.throws(() => applyDiscount('100', 20), TypeError);
  assert.throws(() => applyDiscount(null, 20), TypeError);
  assert.throws(() => applyDiscount(undefined, 20), TypeError);
  assert.throws(() => applyDiscount({}, 20), TypeError);
});

test('wirft einen TypeError, wenn percent keine Zahl ist', () => {
  assert.throws(() => applyDiscount(100, '20'), TypeError);
  assert.throws(() => applyDiscount(100, null), TypeError);
  assert.throws(() => applyDiscount(100, undefined), TypeError);
  assert.throws(() => applyDiscount(100, {}), TypeError);
});

test('wirft einen RangeError bei negativem Preis', () => {
  assert.throws(() => applyDiscount(-1, 20), RangeError);
});

test('wirft einen RangeError bei ungueltigem Rabatt (negativ, > 100, NaN)', () => {
  assert.throws(() => applyDiscount(100, -5), RangeError);
  assert.throws(() => applyDiscount(100, 101), RangeError);
  assert.throws(() => applyDiscount(100, NaN), RangeError);
  assert.throws(() => applyDiscount(NaN, 20), RangeError);
});
