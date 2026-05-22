const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

function downloadFile(url, destName) {
  const destPath = path.join(fontsDir, destName);
  console.log(`Downloading ${url} to ${destPath}...`);
  
  const request = (targetUrl) => {
    https.get(targetUrl, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        console.log(`Redirecting to ${res.headers.location}...`);
        request(res.headers.location);
        return;
      }

      if (res.statusCode !== 200) {
        console.error(`Failed to download: Status Code ${res.statusCode}`);
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Successfully saved ${destName}`);
      });
    }).on('error', (err) => {
      console.error(`Error downloading ${destName}:`, err.message);
    });
  };

  request(url);
}

// Download Ubuntu Regular and Bold from Google Fonts
downloadFile('https://github.com/google/fonts/raw/main/ufl/ubuntu/Ubuntu-Regular.ttf', 'Inter-Regular.ttf');
downloadFile('https://github.com/google/fonts/raw/main/ufl/ubuntu/Ubuntu-Bold.ttf', 'Inter-Bold.ttf');

// Download Wumpus nitro gift card image locally
downloadFile('https://i.imgur.com/v8tT4dD.png', 'wumpus.png');
