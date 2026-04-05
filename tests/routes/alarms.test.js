// tests/routes/alarms.test.js
const request = require('supertest');
const app = require('../../src/app');

jest.mock('../../src/services/firestore', () => ({
  getByDeviceId: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));

const firestore = require('../../src/services/firestore');
const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';

beforeEach(() => jest.clearAllMocks());

test('GET /alarms/:device_id retorna lista de alarmes', async () => {
  firestore.getByDeviceId.mockResolvedValue([
    { id: 'alarm1', medication: 'Dipirona', time: '08:00', frequency: 'daily', active: true },
  ]);

  const res = await request(app)
    .get(`/alarms/${DEVICE_ID}`)
    .set('x-device-id', DEVICE_ID);

  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].medication).toBe('Dipirona');
});

test('POST /alarms cria um alarme', async () => {
  firestore.getByDeviceId.mockResolvedValue([]);
  firestore.create.mockResolvedValue('novo-alarm-id');

  const res = await request(app)
    .post('/alarms')
    .set('x-device-id', DEVICE_ID)
    .send({ medication: 'Amoxicilina', time: '12:00', frequency: 'daily', dosage: '500mg' });

  expect(res.status).toBe(201);
  expect(res.body.id).toBe('novo-alarm-id');
});

test('POST /alarms rejeita se há alarme do mesmo medicamento em menos de 1h', async () => {
  firestore.getByDeviceId.mockResolvedValue([
    { id: 'alarm1', medication: 'Amoxicilina', time: '12:00' },
  ]);

  const res = await request(app)
    .post('/alarms')
    .set('x-device-id', DEVICE_ID)
    .send({ medication: 'Amoxicilina', time: '12:30', frequency: 'daily', dosage: '500mg' });

  expect(res.status).toBe(422);
  expect(res.body.error).toMatch(/intervalo mínimo/i);
});

test('DELETE /alarms/:id remove o alarme', async () => {
  firestore.getById.mockResolvedValue({ id: 'alarm1', device_id: DEVICE_ID });
  firestore.remove.mockResolvedValue();

  const res = await request(app)
    .delete('/alarms/alarm1')
    .set('x-device-id', DEVICE_ID);

  expect(res.status).toBe(200);
});

test('DELETE /alarms/:id retorna 404 se alarme não existe', async () => {
  firestore.getById.mockResolvedValue(null);

  const res = await request(app)
    .delete('/alarms/inexistente')
    .set('x-device-id', DEVICE_ID);

  expect(res.status).toBe(404);
});

test('PUT /alarms/:id atualiza alarme do próprio dispositivo', async () => {
  firestore.getById.mockResolvedValue({ id: 'alarm1', device_id: DEVICE_ID });
  firestore.update.mockResolvedValue();

  const res = await request(app)
    .put('/alarms/alarm1')
    .set('x-device-id', DEVICE_ID)
    .send({ time: '09:00' });

  expect(res.status).toBe(200);
  expect(firestore.update).toHaveBeenCalledWith('alarms', 'alarm1', { time: '09:00' });
});

test('PUT /alarms/:id retorna 404 se alarme pertence a outro dispositivo', async () => {
  firestore.getById.mockResolvedValue({ id: 'alarm1', device_id: 'outro-device-id' });

  const res = await request(app)
    .put('/alarms/alarm1')
    .set('x-device-id', DEVICE_ID)
    .send({ time: '09:00' });

  expect(res.status).toBe(404);
});
