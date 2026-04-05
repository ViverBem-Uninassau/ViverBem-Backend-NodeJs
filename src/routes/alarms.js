// src/routes/alarms.js
const express = require('express');
const router = express.Router();
const validateDeviceId = require('../middleware/validateDeviceId');
const firestore = require('../services/firestore');

router.use(validateDeviceId);

// Retorna minutos totais de um horário HH:MM
function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

router.get('/:device_id', async (req, res) => {
  try {
    const alarms = await firestore.getByDeviceId('alarms', req.params.device_id);
    res.json(alarms);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar alarmes' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { medication, time, frequency, dosage, fcm_token } = req.body;
    if (!medication || !time || !frequency || !dosage) {
      return res.status(400).json({ error: 'Campos obrigatórios: medication, time, frequency, dosage' });
    }

    // RN03: intervalo mínimo de 1h entre alarmes do mesmo medicamento
    const existingAlarms = await firestore.getByDeviceId('alarms', req.deviceId);
    const sameMedication = existingAlarms.filter(a => a.medication === medication);
    const newMinutes = timeToMinutes(time);

    for (const alarm of sameMedication) {
      const diff = Math.abs(timeToMinutes(alarm.time) - newMinutes);
      if (diff < 60) {
        return res.status(422).json({
          error: `Intervalo mínimo de 1h entre alarmes do mesmo medicamento. Conflito com alarme das ${alarm.time}.`,
        });
      }
    }

    const id = await firestore.create('alarms', {
      device_id: req.deviceId,
      medication,
      time,
      frequency,
      dosage,
      fcm_token: fcm_token || null,
      active: true,
    });

    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar alarme' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const alarm = await firestore.getById('alarms', req.params.id);
    if (!alarm || alarm.device_id !== req.deviceId) {
      return res.status(404).json({ error: 'Alarme não encontrado' });
    }
    await firestore.update('alarms', req.params.id, req.body);
    res.json({ message: 'Alarme atualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar alarme' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const alarm = await firestore.getById('alarms', req.params.id);
    if (!alarm || alarm.device_id !== req.deviceId) {
      return res.status(404).json({ error: 'Alarme não encontrado' });
    }
    await firestore.remove('alarms', req.params.id);
    res.json({ message: 'Alarme removido' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover alarme' });
  }
});

module.exports = router;
