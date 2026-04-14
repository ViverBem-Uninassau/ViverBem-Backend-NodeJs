const http = require('http');

const data = JSON.stringify({
  medication: 'Amoxicilina',
  time: '12:00',
  frequency: 'daily',
  dosage: '500mg',
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/alarms',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'x-device-id': '550e8400-e29b-41d4-a716-446655440000',
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log('BODY', body);
    process.exit(res.statusCode === 201 ? 0 : 1);
  });
});

req.on('error', err => {
  console.error('REQUEST ERROR', err);
  process.exit(1);
});
req.write(data);
req.end();
