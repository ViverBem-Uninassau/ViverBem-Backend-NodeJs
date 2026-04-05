// tests/routes/emergency.test.js
const request = require('supertest');
const app = require('../../src/app');

jest.mock('../../src/services/firestore', () => ({
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));

const firestore = require('../../src/services/firestore');
const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';

beforeEach(() => jest.clearAllMocks());

test('POST /emergency-contact cadastra contato', async () => {
  firestore.create.mockResolvedValue(DEVICE_ID);

  const res = await request(app)
    .post('/emergency-contact')
    .set('x-device-id', DEVICE_ID)
    .send({ name: 'Maria', phone: '81999999999', alert_type: 'sms' });

  expect(res.status).toBe(201);
  expect(firestore.create).toHaveBeenCalledWith('emergency_contacts', expect.objectContaining({
    name: 'Maria',
    phone: '81999999999',
  }));
});

test('POST /emergency-contact retorna 400 sem campos obrigatórios', async () => {
  const res = await request(app)
    .post('/emergency-contact')
    .set('x-device-id', DEVICE_ID)
    .send({ name: 'Maria' });

  expect(res.status).toBe(400);
});

test('DELETE /emergency-contact/:device_id remove contato', async () => {
  firestore.getById.mockResolvedValue({ id: DEVICE_ID, device_id: DEVICE_ID });
  firestore.remove.mockResolvedValue();

  const res = await request(app)
    .delete(`/emergency-contact/${DEVICE_ID}`)
    .set('x-device-id', DEVICE_ID);

  expect(res.status).toBe(200);
});

test('DELETE /emergency-contact/:device_id retorna 404 se não existe', async () => {
  firestore.getById.mockResolvedValue(null);

  const res = await request(app)
    .delete(`/emergency-contact/${DEVICE_ID}`)
    .set('x-device-id', DEVICE_ID);

  expect(res.status).toBe(404);
});
