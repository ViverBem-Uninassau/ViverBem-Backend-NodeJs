// src/services/firestore.js
const admin = require('firebase-admin');

let db;

function getDb() {
  if (!db) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
    db = admin.firestore();
  }
  return db;
}

// Busca TODOS os documentos de uma coleção (usado pelo scheduler)
async function getAll(collection) {
  const snapshot = await getDb().collection(collection).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Busca documentos filtrados por device_id (usado pelas rotas)
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
