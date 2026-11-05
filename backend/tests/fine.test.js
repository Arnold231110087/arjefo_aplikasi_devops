const test = require('node:test');
const assert = require('node:assert');
const { calculateFine, daysLate, FINE_PER_DAY } = require('../src/utils/fine');

test('tidak ada denda bila dikembalikan sebelum jatuh tempo', () => {
  assert.strictEqual(calculateFine('2026-01-10', '2026-01-08'), 0);
});

test('tidak ada denda bila dikembalikan tepat di hari jatuh tempo', () => {
  assert.strictEqual(calculateFine('2026-01-10', '2026-01-10'), 0);
});

test('denda dihitung per hari keterlambatan', () => {
  assert.strictEqual(daysLate('2026-01-10', '2026-01-13'), 3);
  assert.strictEqual(calculateFine('2026-01-10', '2026-01-13'), 3 * FINE_PER_DAY);
});

test('melewati pergantian bulan', () => {
  assert.strictEqual(daysLate('2026-01-30', '2026-02-02'), 3);
});
