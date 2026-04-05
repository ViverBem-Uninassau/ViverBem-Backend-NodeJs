// server.js
require('dotenv').config();
const app = require('./src/app');
const { startScheduler } = require('./src/services/scheduler');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Node API rodando na porta ${PORT}`);
  startScheduler();
});
