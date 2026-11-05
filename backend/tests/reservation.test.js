const test = require('node:test');
const assert = require('node:assert');
const { holdUntil, queuePosition, HOLD_DAYS } = require('../src/utils/reservationQueue');

test('posisi antrean dihitung dari urutan masuk', () => {
  assert.strictEqual(queuePosition([12, 15, 20], 12), 1);
  assert.strictEqual(queuePosition([12, 15, 20], 20), 3);
});

test('reservasi yang tidak ada di antrean tidak punya posisi', () => {
  assert.strictEqual(queuePosition([12, 15], 99), null);
});

test('batas pengambilan = hari ini + HOLD_DAYS', () => {
  assert.strictEqual(HOLD_DAYS, 2);
  assert.strictEqual(holdUntil(new Date(2026, 0, 30)), '2026-02-01');
});
