const http = require('https');

http.get('https://riwaayat-production.up.railway.app/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Railway Status:', data));
}).on('error', err => console.error('Error:', err.message));
