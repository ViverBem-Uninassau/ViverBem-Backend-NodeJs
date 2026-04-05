// src/services/scheduler.js
const cron = require('node-cron');
const firestore = require('./firestore');
const fcm = require('./fcm');

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

async function checkAndSendAlarms() {
  const currentTime = getCurrentTime();
  const alarms = await firestore.getAll('alarms');

  for (const alarm of alarms) {
    if (!alarm.active || alarm.time !== currentTime) continue;
    if (!alarm.fcm_token) continue;

    await fcm.sendPushNotification(
      alarm.fcm_token,
      'Hora do medicamento!',
      `${alarm.medication} — tome agora.`
    );
  }
}

async function checkMissedDoses() {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const doses = await firestore.getAll('dose_history');

  const pending = doses.filter(d =>
    d.status === 'pending' &&
    d.created_at > fifteenMinAgo &&
    (d.attempts || 0) < 3
  );

  for (const dose of pending) {
    const alarm = await firestore.getById('alarms', dose.alarm_id);
    if (!alarm || !alarm.fcm_token) continue;

    await fcm.sendPushNotification(
      alarm.fcm_token,
      'Você tomou o medicamento?',
      `${dose.medication} — confirme ou adie.`
    );

    await firestore.update('dose_history', dose.id, {
      attempts: (dose.attempts || 0) + 1,
    });
  }
}

function startScheduler() {
  cron.schedule('* * * * *', checkAndSendAlarms);
  cron.schedule('*/15 * * * *', checkMissedDoses);
  console.log('Scheduler iniciado.');
}

module.exports = { startScheduler, checkAndSendAlarms, checkMissedDoses };
