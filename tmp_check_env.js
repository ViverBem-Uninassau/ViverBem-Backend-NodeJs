const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(process.cwd(), '.env');
const envResult = dotenv.config({ path: envPath });
console.log('cwd:', process.cwd());
console.log('.env path:', envPath);
console.log('dotenv error:', envResult.error ? envResult.error.message : 'none');
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const credentialsPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
  console.log('resolved credentials path:', credentialsPath);
  console.log('exists:', fs.existsSync(credentialsPath));
  if (fs.existsSync(credentialsPath)) {
    try {
      const content = fs.readFileSync(credentialsPath, 'utf8');
      const parsed = JSON.parse(content);
      console.log('project_id in credentials:', parsed.project_id);
      console.log('client_email in credentials:', parsed.client_email);
    } catch (err) {
      console.error('read error:', err.message);
    }
  }
}
