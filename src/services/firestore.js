// src/services/firestore.js
const admin = require('firebase-admin');

let db;

function ensureFirebaseEnv() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return;
  }

  const missing = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
  ].filter(name => !process.env[name]);

  if (missing.length) {
    throw new Error(
      `FIREBASE configuration missing: ${missing.join(', ')}. ` +
      'Set these env vars, GOOGLE_APPLICATION_CREDENTIALS, or FIRESTORE_EMULATOR_HOST.'
    );
  }
}

function getDb() {
  if (!db) {
    if (!admin.apps.length) {
      if (process.env.FIRESTORE_EMULATOR_HOST) {
        admin.initializeApp();
      } else if (
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL)
      ) {
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            }),
          });
        } else {
          admin.initializeApp();
        }
      } else {
        ensureFirebaseEnv();
      }
    }
    db = admin.firestore();
  }
  return db;
}

async function getAll(collection) {
  const snapshot = await getDb().collection(collection).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getByDeviceId(collection, deviceId) {
  const snapshot = await getDb()
    .collection(collection)
    .where('device_id', '==', deviceId)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getById(collection, id) {
  const doc = await getDb().collection(collection).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function create(collection, data) {
  const ref = await getDb().collection(collection).add({
    ...data,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function update(collection, id, data) {
  await getDb().collection(collection).doc(id).update(data);
}

async function remove(collection, id) {
  await getDb().collection(collection).doc(id).delete();
}

module.exports = { getAll, getByDeviceId, getById, create, update, remove };
