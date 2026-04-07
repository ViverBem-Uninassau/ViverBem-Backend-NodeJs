// src/routes/ai.js
const express = require('express');
const multer = require('multer');
const router = express.Router();
const validateDeviceId = require('../middleware/validateDeviceId');
const firestore = require('../services/firestore');
const aiService = require('../services/ai');

// Armazena imagem em memória (sem gravar em disco — compatível com Render)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // máximo 10 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas imagens são aceitas'));
    }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Salva um medicamento no histórico do dispositivo.
 * Mantém no máximo 15 entradas — remove a mais antiga se necessário.
 */
async function saveMedicationHistory(deviceId, medicationData, source) {
  const existing = await firestore.getByDeviceId('medication_history', deviceId);

  if (existing.length >= 15) {
    // Ordena do mais antigo para o mais recente e remove o primeiro
    const sorted = existing.sort((a, b) => {
      const aMs = a.created_at?.toMillis?.() ?? 0;
      const bMs = b.created_at?.toMillis?.() ?? 0;
      return aMs - bMs;
    });
    await firestore.remove('medication_history', sorted[0].id);
  }

  const id = await firestore.create('medication_history', {
    device_id: deviceId,
    name: medicationData.name,
    active_ingredient: medicationData.active_ingredient,
    dosage: medicationData.dosage,
    indications: medicationData.indications,
    contraindications: medicationData.contraindications,
    disclaimer: medicationData.disclaimer,
    source, // 'scan' | 'chat'
  });

  return id;
}

// ---------------------------------------------------------------------------
// POST /scan — recebe foto da embalagem, identifica medicamento
// ---------------------------------------------------------------------------
router.post('/scan', validateDeviceId, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Imagem obrigatória. Envie o campo "image" como multipart/form-data.' });
    }

    const result = await aiService.scanMedication(req.file.buffer);

    const historyId = await saveMedicationHistory(req.deviceId, result, 'scan');

    res.json({ id: historyId, ...result });
  } catch (err) {
    if (err.message === 'Apenas imagens são aceitas') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Erro em /scan:', err);
    res.status(500).json({ error: 'Erro ao processar imagem' });
  }
});

// ---------------------------------------------------------------------------
// POST /chat — recebe mensagem de voz (já transcrita) e responde
// ---------------------------------------------------------------------------
router.post('/chat', validateDeviceId, async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Campo obrigatório: message (string)' });
    }

    const result = await aiService.processChat(message.trim(), context || null);

    // Se a IA identificar um medicamento na conversa, salva no histórico
    if (result.medication_referenced) {
      await saveMedicationHistory(
        req.deviceId,
        {
          name: result.medication_referenced,
          active_ingredient: '',
          dosage: '',
          indications: [],
          contraindications: [],
          disclaimer: 'Esta informação não substitui orientação médica. Consulte um profissional de saúde.',
        },
        'chat'
      );
    }

    res.json(result);
  } catch (err) {
    console.error('Erro em /chat:', err);
    res.status(500).json({ error: 'Erro ao processar mensagem' });
  }
});

// ---------------------------------------------------------------------------
// GET /medication-history/:device_id — retorna histórico (máx 15, mais recentes)
// ---------------------------------------------------------------------------
router.get('/medication-history/:device_id', validateDeviceId, async (req, res) => {
  try {
    if (req.params.device_id !== req.deviceId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const history = await firestore.getByDeviceId('medication_history', req.deviceId);

    // Ordena do mais recente para o mais antigo e limita a 15
    const sorted = history
      .sort((a, b) => {
        const aMs = a.created_at?.toMillis?.() ?? 0;
        const bMs = b.created_at?.toMillis?.() ?? 0;
        return bMs - aMs;
      })
      .slice(0, 15);

    res.json(sorted);
  } catch (err) {
    console.error('Erro em /medication-history:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico de medicamentos' });
  }
});

module.exports = router;
