const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const credentialsPath = path.resolve(process.cwd(), './credentials.json');

console.log('credentialsPath', credentialsPath);
if (!fs.existsSync(credentialsPath)) {
  console.error('credentials.json not found');
  process.exit(1);
}

const key = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
console.log('project_id', key.project_id);
console.log('client_email', key.client_email);

admin.initializeApp({
  credential: admin.credential.cert(key),
});

const db = admin.firestore();

db.collection('alarms').limit(1).get()
  .then(snapshot => {
    console.log('success, docs:', snapshot.size);
    process.exit(0);
  })
  .catch(err => {
    console.error('firestore error message:', err.message);
    console.error('error code:', err.code);
    console.error('error details:', err.details);
    console.error('error metadata:', err.metadata?.internalRepr ? JSON.stringify([...err.metadata.internalRepr], null, 2) : err.metadata);
    console.error('full error object:');
    console.dir(err, { depth: null });
    process.exit(1);
  });
