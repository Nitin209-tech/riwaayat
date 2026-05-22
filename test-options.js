const http = require('https');
const options = {
  hostname: 'riwaayat-production.up.railway.app',
  port: 443,
  path: '/api/rewards/verify-code',
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://riwaayat-roan.vercel.app',
    'Access-Control-Request-Method': 'POST'
  }
};
const req = http.request(options, res => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
});
req.on('error', error => console.error(error));
req.end();
