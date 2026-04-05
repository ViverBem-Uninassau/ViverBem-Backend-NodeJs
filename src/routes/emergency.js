// src/routes/emergency.js
const express = require('express');
const router = express.Router();
const validateDeviceId = require('../middleware/validateDeviceId');
const firestore = require('../services/firestore');

router.use(validateDeviceId);

router.post('/', async (req, res) => {
  try {
    const { name, phone, alert_type } = req.body;
    if (!name || !phone || !alert_type) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, phone, alert_type' });
    }
    const id = await firestore.create('emergency_contacts', {
      device_id: req.deviceId,
      name,
      phone,
      alert_type,
    });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar contato' });
  }
});

router.put('/:device_id', async (req, res) => {
  try {
    await firestore.update('emergency_contacts', req.params.device_id, req.body);
    res.json({ message: 'Contato atualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar contato' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const contact = await firestore.getById('emergency_contacts', req.params.id);
    if (!contact || contact.device_id !== req.deviceId) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }
    await firestore.remove('emergency_contacts', req.params.id);
    res.json({ message: 'Contato removido' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover contato' });
  }
});

module.exports = router;
