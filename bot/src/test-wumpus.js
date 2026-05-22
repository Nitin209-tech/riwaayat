const https = require('https');

const urls = [
  'https://github.com/mew/discord-nitro-generator/raw/master/wumpus.png',
  'https://github.com/Anish-Shrestha/Discord-Nitro-Generator/raw/master/wumpus.png',
  'https://github.com/trollf/fake-nitro/raw/main/wumpus.png',
  'https://github.com/Prestige-Gaming/Discord-Nitro-Generator/raw/master/wumpus.png',
  'https://github.com/jakejarvis/clean-urls/raw/master/assets/images/wumpus.png',
  'https://github.com/Ares-x/Discord-Nitro-Generator/raw/master/wumpus.png',
  'https://github.com/Ares-x/Discord-Nitro-Generator/raw/main/wumpus.png'
];

urls.forEach(url => {
  https.get(url, (res) => {
    if (res.statusCode === 302 || res.statusCode === 301) {
      https.get(res.headers.location, (redirRes) => {
        console.log(`${url} -> Redirected Status: ${redirRes.statusCode}, Content-Length: ${redirRes.headers['content-length']}`);
      });
      return;
    }
    console.log(`${url} -> Status: ${res.statusCode}, Content-Length: ${res.headers['content-length']}`);
  }).on('error', (err) => {
    console.log(`${url} -> Error: ${err.message}`);
  });
});
