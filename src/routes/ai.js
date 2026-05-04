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

    // Se a IA identificar um medicamento na conversa, pesquisa a bula e salva/atualiza no histórico
    if (result.medication_referenced) {
      try {
        const existingHistory = await firestore.getByDeviceId('medication_history', req.deviceId);

        // Normaliza o nome para comparação (sem acentos, minúsculo)
        const normalize = (str) =>
          str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        const medNameNormalized = normalize(result.medication_referenced);

        const alreadySaved = existingHistory.find(
          (entry) => normalize(entry.name || '') === medNameNormalized
        );

        // Verifica se a entrada existente está com dados incompletos
        const hasCompleteData = (entry) =>
          entry &&
          entry.active_ingredient &&
          entry.active_ingredient.trim() !== '' &&
          Array.isArray(entry.indications) &&
          entry.indications.length > 0;

        // Pesquisa a bula completa (usada tanto para criar quanto para atualizar)
        async function fetchBulaData() {
          try {
            const bulaResult = await aiService.researchMedication(result.medication_referenced);
            return {
              name: result.medication_referenced.charAt(0).toUpperCase() + result.medication_referenced.slice(1),
              active_ingredient: bulaResult.principio_ativo || '',
              dosage: '',
              indications: bulaResult.indicacoes || [],
              contraindications: bulaResult.contraindicacoes || [],
              disclaimer: 'Esta informação é um resumo automático da bula e não substitui consulta médica.',
            };
          } catch (bulaErr) {
            console.error('Erro ao pesquisar bula via chat:', bulaErr.message);
            return {
              name: result.medication_referenced.charAt(0).toUpperCase() + result.medication_referenced.slice(1),
              active_ingredient: '',
              dosage: '',
              indications: [],
              contraindications: [],
              disclaimer: 'Esta informação não substitui orientação médica. Consulte um profissional de saúde.',
            };
          }
        }

        if (alreadySaved && hasCompleteData(alreadySaved)) {
          // Já existe com dados completos — pula
          console.log(`Medicamento "${result.medication_referenced}" já existe com bula completa (id: ${alreadySaved.id}). Pulando.`);
        } else if (alreadySaved && !hasCompleteData(alreadySaved)) {
          // Existe mas com dados vazios — atualiza com bula completa
          const bulaData = await fetchBulaData();
          await firestore.update('medication_history', alreadySaved.id, {
            name: bulaData.name,
            active_ingredient: bulaData.active_ingredient,
            dosage: bulaData.dosage,
            indications: bulaData.indications,
            contraindications: bulaData.contraindications,
            disclaimer: bulaData.disclaimer,
            source: 'chat',
          });
          console.log(`Medicamento "${result.medication_referenced}" atualizado com bula completa (id: ${alreadySaved.id}).`);
        } else {
          // Não existe — cria com bula completa
          const bulaData = await fetchBulaData();
          await saveMedicationHistory(req.deviceId, bulaData, 'chat');
          console.log(`Medicamento "${result.medication_referenced}" salvo no histórico via chat.`);
        }
      } catch (historyErr) {
        console.error('Erro ao verificar/salvar histórico de medicamento:', historyErr);
      }
    }

    // -----------------------------------------------------------------
    // Se a IA detectou pedido de alarme, cria no Firestore
    // -----------------------------------------------------------------
    let alarmCreated = null;

    if (result.alarm_data) {
      try {
        const { medication, time, frequency, days } = result.alarm_data;

        // Valida campos mínimos extraídos pela IA
        if (medication && time) {
          // Formata os dias (mesma lógica do alarms.js)
          let daysFormatted;
          switch (days) {
            case 'semana': daysFormatted = [1, 2, 3, 4, 5]; break;
            case 'fds': daysFormatted = [0, 6]; break;
            default: daysFormatted = [0, 1, 2, 3, 4, 5, 6]; // "todos"
          }

          // Verifica regra de intervalo mínimo de 1h
          const existingAlarms = await firestore.getByDeviceId('alarms', req.deviceId);
          const sameMed = existingAlarms.filter(
            (a) => a.medication?.toLowerCase() === medication.toLowerCase()
          );

          const timeToMinutes = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
          };
          const newMinutes = timeToMinutes(time);

          const conflict = sameMed.find(
            (a) => Math.abs(timeToMinutes(a.time) - newMinutes) < 60
          );

          if (conflict) {
            console.log(`Alarme de "${medication}" conflita com ${conflict.time}. Não criado.`);
            // Atualiza a resposta para informar o conflito
            result.response = `Não consegui criar o lembrete porque já existe um alarme de ${medication} às ${conflict.time}, e o intervalo mínimo é de 1 hora. Se quiser, me peça para criar em outro horário.`;
          } else {
            const alarmId = await firestore.create('alarms', {
              device_id: req.deviceId,
              medication: medication.charAt(0).toUpperCase() + medication.slice(1),
              time,
              frequency: frequency || '24h',
              dosage: '',
              dosage_value: null,
              dosage_unit: null,
              days: daysFormatted,
              fcm_token: null,
              active: true,
            });

            alarmCreated = { id: alarmId, medication, time, frequency: frequency || '24h' };
            console.log(`Alarme criado via chat: ${medication} às ${time} (id: ${alarmId})`);
          }
        } else {
          console.log('ALARM_DATA incompleto (falta medication ou time). Alarme não criado.');
        }
      } catch (alarmErr) {
        console.error('Erro ao criar alarme via chat:', alarmErr);
      }
    }

    res.json({
      ...result,
      alarm_created: alarmCreated,
    });
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
