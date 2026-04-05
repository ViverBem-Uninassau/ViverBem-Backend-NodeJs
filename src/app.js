// src/app.js
const express = require('express');
const app = express();

app.use(express.json());

app.use('/alarms', require('./routes/alarms'));
app.use('/doses', require('./routes/doses'));
app.use('/history', require('./routes/doses'));
app.use('/emergency-contact', require('./routes/emergency'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno' });
});

module.exports = app;
