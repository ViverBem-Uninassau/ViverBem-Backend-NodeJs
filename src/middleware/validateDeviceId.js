// src/middleware/validateDeviceId.js
const { validate: uuidValidate } = require('uuid');

function validateDeviceId(req, res, next) {
  const deviceId = req.headers['x-device-id'];
  if (!deviceId || !uuidValidate(deviceId)) {
    return res.status(400).json({ error: 'X-Device-ID header inválido ou ausente' });
  }
  req.deviceId = deviceId;
  next();
}

module.exports = validateDeviceId;
