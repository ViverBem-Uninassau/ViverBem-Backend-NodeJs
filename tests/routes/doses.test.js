// tests/routes/doses.test.js
const request = require('supertest');
const app = require('../../src/app');

jest.mock('../../src/services/firestore', () => ({
  getByDeviceId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));

const firestore = require('../../src/services/firestore');
const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';

beforeEach(() => jest.clearAllMocks());

test('POST /doses/confirm registra dose como confirmada', async () => {
  firestore.create.mockResolvedValue('dose-id-1');

  const res = await request(app)
    .post('/doses/confirm')
    .set('x-device-id', DEVICE_ID)
    .send({ alarm_id: 'alarm1', medication: 'Dipirona' });

  expect(res.status).toBe(201);
  expect(firestore.create).toHaveBeenCalledWith('dose_history', expect.objectContaining({
    device_id: DEVICE_ID,
    alarm_id: 'alarm1',
    status: 'confirmed',
  }));
});

test('POST /doses/skip registra dose como pulada', async () => {
  firestore.create.mockResolvedValue('dose-id-2');

  const res = await request(app)
    .post('/doses/skip')
    .set('x-device-id', DEVICE_ID)
    .send({ alarm_id: 'alarm1', medication: 'Dipirona' });

  expect(res.status).toBe(201);
  expect(firestore.create).toHaveBeenCalledWith('dose_history', expect.objectContaining({
    status: 'missed',
  }));
});

test('GET /history/:device_id retorna histórico', async () => {
  firestore.getByDeviceId.mockResolvedValue([
    { id: 'd1', medication: 'Dipirona', status: 'confirmed' },
    { id: 'd2', medication: 'Dipirona', status: 'missed' },
  ]);

  const res = await request(app)
    .get(`/history/${DEVICE_ID}`)
    .set('x-device-id', DEVICE_ID);

  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(2);
});

test('POST /doses/confirm retorna 400 sem campos obrigatórios', async () => {
  const res = await request(app)
    .post('/doses/confirm')
    .set('x-device-id', DEVICE_ID)
    .send({ alarm_id: 'alarm1' }); // falta medication

  expect(res.status).toBe(400);
});
