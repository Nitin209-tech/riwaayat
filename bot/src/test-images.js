const https = require('https');

const urls = [
  'https://discord.com/assets/2e946a362a26c8bfa30cf5a73e5108b5.svg',
  'https://discord.com/assets/5be29fcc0119e8be77efb33f3747b019.svg',
  'https://discord.com/assets/f809ec0de267bf0c2e3919e1f57e62a9.svg',
  'https://discord.com/assets/c502b4b455018617ba8e.svg',
  'https://discord.com/assets/8ffc5a7f71b9c7bf7c83f6f9661605e5.svg',
  'https://discord.com/assets/e92e21b71239c4d929be657e.svg'
];

urls.forEach(url => {
  https.get(url, (res) => {
    console.log(`${url} -> Status: ${res.statusCode}`);
  }).on('error', (err) => {
    console.log(`${url} -> Error: ${err.message}`);
  });
});
