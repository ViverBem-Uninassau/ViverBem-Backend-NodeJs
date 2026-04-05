// tests/services/scheduler.test.js
const { checkAndSendAlarms } = require('../../src/services/scheduler');

jest.mock('../../src/services/firestore', () => ({
  getAll: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
}));

jest.mock('../../src/services/fcm', () => ({
  sendPushNotification: jest.fn(),
}));

const firestore = require('../../src/services/firestore');
const fcm = require('../../src/services/fcm');

beforeEach(() => jest.clearAllMocks());

test('dispara notificação para alarme cujo horário bate com agora', async () => {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  firestore.getAll.mockResolvedValue([
    { id: 'a1', device_id: 'dev1', medication: 'Dipirona', time, active: true, fcm_token: 'token123', frequency: 'daily' },
  ]);

  await checkAndSendAlarms();

  expect(fcm.sendPushNotification).toHaveBeenCalledWith(
    'token123',
    'Hora do medicamento!',
    'Dipirona — tome agora.'
  );
});

test('não dispara notificação para alarme inativo', async () => {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  firestore.getAll.mockResolvedValue([
    { id: 'a1', device_id: 'dev1', medication: 'Dipirona', time, active: false, fcm_token: 'token123', frequency: 'daily' },
  ]);

  await checkAndSendAlarms();

  expect(fcm.sendPushNotification).not.toHaveBeenCalled();
});

test('não dispara notificação para alarme sem fcm_token', async () => {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  firestore.getAll.mockResolvedValue([
    { id: 'a1', device_id: 'dev1', medication: 'Dipirona', time, active: true, fcm_token: null, frequency: 'daily' },
  ]);

  await checkAndSendAlarms();

  expect(fcm.sendPushNotification).not.toHaveBeenCalled();
});
