// src/services/fcm.js
const admin = require('firebase-admin');

async function sendPushNotification(fcmToken, title, body) {
  const message = {
    notification: { title, body },
    token: fcmToken,
  };
  await admin.messaging().send(message);
}

module.exports = { sendPushNotification };
