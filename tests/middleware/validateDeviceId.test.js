// tests/middleware/validateDeviceId.test.js
const validateDeviceId = require('../../src/middleware/validateDeviceId');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('rejeita requisição sem X-Device-ID', () => {
  const req = { headers: {} };
  const res = mockRes();
  const next = jest.fn();

  validateDeviceId(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'X-Device-ID header inválido ou ausente' });
  expect(next).not.toHaveBeenCalled();
});

test('rejeita X-Device-ID que não é UUID válido', () => {
  const req = { headers: { 'x-device-id': 'nao-e-um-uuid' } };
  const res = mockRes();
  const next = jest.fn();

  validateDeviceId(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'X-Device-ID header inválido ou ausente' });
  expect(next).not.toHaveBeenCalled();
});

test('aceita UUID válido e chama next()', () => {
  const req = { headers: { 'x-device-id': '550e8400-e29b-41d4-a716-446655440000' } };
  const res = mockRes();
  const next = jest.fn();

  validateDeviceId(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(req.deviceId).toBe('550e8400-e29b-41d4-a716-446655440000');
});
