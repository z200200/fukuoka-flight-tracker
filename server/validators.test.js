import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCoordinate, validateIcao, validateCallsign, enforceMaxCacheSize } from './validators.js';

test('validateCoordinate accepts values within range', () => {
  const result = validateCoordinate('33.58', 'lat', -90, 90);
  assert.equal(result.valid, true);
  assert.equal(result.value, 33.58);
});

test('validateCoordinate rejects out-of-range values', () => {
  const result = validateCoordinate('200', 'lat', -90, 90);
  assert.equal(result.valid, false);
});

test('validateCoordinate rejects non-numeric values', () => {
  const result = validateCoordinate('abc', 'lat', -90, 90);
  assert.equal(result.valid, false);
});

test('validateIcao accepts 6 hex characters', () => {
  const result = validateIcao('7C1A2B');
  assert.equal(result.valid, true);
  assert.equal(result.value, '7c1a2b');
});

test('validateIcao rejects invalid codes', () => {
  assert.equal(validateIcao('xyz').valid, false);
  assert.equal(validateIcao('').valid, false);
  assert.equal(validateIcao(null).valid, false);
});

test('validateCallsign accepts 2-8 alphanumeric characters', () => {
  const result = validateCallsign('jal310');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'JAL310');
});

test('validateCallsign rejects invalid input', () => {
  assert.equal(validateCallsign('a').valid, false); // 太短
  assert.equal(validateCallsign('toolongcallsign').valid, false); // 太长
  assert.equal(validateCallsign('has space').valid, false); // 含空格
});

test('enforceMaxCacheSize evicts oldest entries beyond max size', () => {
  const cache = new Map([
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ]);
  enforceMaxCacheSize(cache, 2);
  assert.equal(cache.size, 2);
  assert.equal(cache.has('a'), false); // 最早插入的被淘汰
  assert.equal(cache.has('b'), true);
  assert.equal(cache.has('c'), true);
});

test('enforceMaxCacheSize is a no-op when under the limit', () => {
  const cache = new Map([['a', 1]]);
  enforceMaxCacheSize(cache, 5);
  assert.equal(cache.size, 1);
});
