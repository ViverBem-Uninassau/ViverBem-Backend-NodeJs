const cron = require('node-cron');
const { getAll, getById, update } = require('./firestore'); // ✅ IMPORT CORRETO
const fcm = require('./fcm');

// Pega hora atual no formato HH:MM
function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// 🔔 Verifica alarmes e dispara notificação
async function checkAndSendAlarms() {
  try {
    const currentTime = getCurrentTime();

    const alarms = await getAll('alarms'); // ✅ corrigido

    for (const alarm of alarms) {
      if (!alarm.active) continue;
      if (alarm.time !== currentTime) continue;
      if (!alarm.fcm_token) continue;

      await fcm.sendPushNotification(
        alarm.fcm_token,
        'Hora do medicamento!',
        `${alarm.medication} — tome agora.`
      );
    }

  } catch (err) {
    console.error('Erro checkAndSendAlarms:', err);
  }
}

// ⏰ Verifica doses não confirmadas
async function checkMissedDoses() {
  try {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const doses = await getAll('dose_history'); // ✅ corrigido

    const pending = doses.filter(d =>
      d.status === 'pending' &&
      d.created_at > fifteenMinAgo &&
      (d.attempts || 0) < 3
    );

    for (const dose of pending) {
      const alarm = await getById('alarms', dose.alarm_id); // ✅ corrigido
      if (!alarm || !alarm.fcm_token) continue;

      await fcm.sendPushNotification(
        alarm.fcm_token,
        'Você tomou o medicamento?',
        `${dose.medication} — confirme ou adie.`
      );

      await update('dose_history', dose.id, {
        attempts: (dose.attempts || 0) + 1,
      }); // ✅ corrigido
    }

  } catch (err) {
    console.error('Erro checkMissedDoses:', err);
  }
}

// 🚀 Inicia os cron jobs
function startScheduler() {
  cron.schedule('* * * * *', checkAndSendAlarms);     // a cada minuto
  cron.schedule('*/15 * * * *', checkMissedDoses);    // a cada 15 min
  console.log('Scheduler iniciado.');
}

module.exports = {
  startScheduler,
  checkAndSendAlarms,
  checkMissedDoses,
};