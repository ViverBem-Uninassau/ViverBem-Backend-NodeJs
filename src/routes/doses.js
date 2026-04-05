// src/routes/doses.js
const express = require('express');
const router = express.Router();
const validateDeviceId = require('../middleware/validateDeviceId');
const firestore = require('../services/firestore');

router.use(validateDeviceId);

router.post('/confirm', async (req, res) => {
  try {
    const { alarm_id, medication } = req.body;
    if (!alarm_id || !medication) {
      return res.status(400).json({ error: 'Campos obrigatórios: alarm_id, medication' });
    }
    const id = await firestore.create('dose_history', {
      device_id: req.deviceId,
      alarm_id,
      medication,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao confirmar dose' });
  }
});

router.post('/skip', async (req, res) => {
  try {
    const { alarm_id, medication } = req.body;
    if (!alarm_id || !medication) {
      return res.status(400).json({ error: 'Campos obrigatórios: alarm_id, medication' });
    }
    const id = await firestore.create('dose_history', {
      device_id: req.deviceId,
      alarm_id,
      medication,
      status: 'missed',
      confirmed_at: null,
    });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar dose pulada' });
  }
});

// GET /history/:device_id
router.get('/:device_id', async (req, res) => {
  try {
    const doses = await firestore.getByDeviceId('dose_history', req.params.device_id);
    res.json(doses);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

module.exports = router;
