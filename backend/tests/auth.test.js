// Unit test middleware autentikasi
const test = require('node:test');
const assert = require('node:assert');
const { signToken, authRequired, adminOnly } = require('../src/middleware/auth');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

test('menolak request tanpa token', () => {
  const res = mockRes();
  let called = false;
  authRequired({ headers: {} }, res, () => { called = true; });
  assert.strictEqual(called, false);
  assert.strictEqual(res.statusCode, 401);
});

test('menerima token valid dan mengisi req.user', () => {
  const token = signToken({ id: 7, name: 'Budi', email: 'budi@mail.com', role: 'member' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  let called = false;
  authRequired(req, mockRes(), () => { called = true; });
  assert.strictEqual(called, true);
  assert.strictEqual(req.user.id, 7);
});

test('adminOnly menolak member biasa', () => {
  const res = mockRes();
  adminOnly({ user: { role: 'member' } }, res, () => {});
  assert.strictEqual(res.statusCode, 403);
});
