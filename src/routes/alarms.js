const express = require('express');
const router = express.Router();
const validateDeviceId = require('../middleware/validateDeviceId');
const firestore = require('../services/firestore');

router.use(validateDeviceId);

// ---------------------------------------------------------------------
// UTIL
// ---------------------------------------------------------------------
function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// ---------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------
router.get('/:device_id', async (req, res) => {
  try {
    const alarms = await firestore.getByDeviceId('alarms', req.params.device_id);
    res.json(alarms);
  } catch (err) {
    console.error('Erro GET /alarms:', err);
    res.status(500).json({ error: 'Erro ao buscar alarmes' });
  }
});

// ---------------------------------------------------------------------
// POST (CRIAR ALARME)
// ---------------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const {
      medication,
      time,
      frequency,
      dosage,
      dosage_value,
      dosage_unit,
      days,
      fcm_token
    } = req.body;

    // ---------------------------------------------------------------
    // DOSAGEM (compatível com antigo + novo formato)
    // ---------------------------------------------------------------
    const finalDosage =
      dosage ||
      (dosage_value != null && dosage_unit
        ? `${dosage_value} ${dosage_unit}`
        : null);

    // ---------------------------------------------------------------
    // VALIDAÇÕES
    // ---------------------------------------------------------------
    if (!medication || !time || !frequency || !finalDosage) {
      return res.status(400).json({
        error:
          'Campos obrigatórios: medication, time, frequency, dosage (ou dosage_value + dosage_unit)',
      });
    }

    // valida dosagem (1 a 100)
    if (
      dosage_value &&
      (Number(dosage_value) < 1 || Number(dosage_value) > 100)
    ) {
      return res.status(400).json({
        error: 'Dosagem deve estar entre 1 e 100',
      });
    }

    // ---------------------------------------------------------------
    // TRATAMENTO DOS DIAS
    // ---------------------------------------------------------------
    let daysFormatted;

    if (Array.isArray(days)) {
      daysFormatted = days;
    } else {
      switch (days) {
        case 'todos':
          daysFormatted = [0, 1, 2, 3, 4, 5, 6];
          break;
        case 'semana':
          daysFormatted = [1, 2, 3, 4, 5];
          break;
        case 'fds':
          daysFormatted = [0, 6];
          break;
        default:
          daysFormatted = [];
      }
    }

    // ---------------------------------------------------------------
    // REGRA: intervalo mínimo de 1h
    // ---------------------------------------------------------------
    const existingAlarms = await firestore.getByDeviceId(
      'alarms',
      req.deviceId
    );

    const sameMedication = existingAlarms.filter(
      (a) => a.medication === medication
    );

    const newMinutes = timeToMinutes(time);

    for (const alarm of sameMedication) {
      const diff = Math.abs(timeToMinutes(alarm.time) - newMinutes);

      if (diff < 60) {
        return res.status(422).json({
          error: `Intervalo mínimo de 1h entre alarmes do mesmo medicamento. Conflito com ${alarm.time}`,
        });
      }
    }

    // ---------------------------------------------------------------
    // SALVAR
    // ---------------------------------------------------------------
    const id = await firestore.create('alarms', {
      device_id: req.deviceId,
      medication,
      time,
      frequency,
      dosage: finalDosage,
      dosage_value: dosage_value ? Number(dosage_value) : null,
      dosage_unit: dosage_unit || null,
      days: daysFormatted,
      fcm_token: fcm_token || null,
      active: true,
    });

    res.status(201).json({ id });
  } catch (err) {
    console.error('Erro POST /alarms:', err);
    res.status(500).json({ error: 'Erro ao criar alarme' });
  }
});

// ---------------------------------------------------------------------
// PUT (ATUALIZAR)
// ---------------------------------------------------------------------
router.put('/:id', async (req, res) => {
  try {
    const alarm = await firestore.getById('alarms', req.params.id);

    if (!alarm || alarm.device_id !== req.deviceId) {
      return res.status(404).json({ error: 'Alarme não encontrado' });
    }

    await firestore.update('alarms', req.params.id, req.body);

    res.json({ message: 'Alarme atualizado' });
  } catch (err) {
    console.error('Erro PUT /alarms:', err);
    res.status(500).json({ error: 'Erro ao atualizar alarme' });
  }
});

// ---------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const alarm = await firestore.getById('alarms', req.params.id);

    if (!alarm || alarm.device_id !== req.deviceId) {
      return res.status(404).json({ error: 'Alarme não encontrado' });
    }

    await firestore.remove('alarms', req.params.id);

    res.json({ message: 'Alarme removido' });
  } catch (err) {
    console.error('Erro DELETE /alarms:', err);
    res.status(500).json({ error: 'Erro ao remover alarme' });
  }
});

module.exports = router;