const { loadImage } = require('@napi-rs/canvas');
const path = require('path');

async function main() {
  const targetPath = 'C:\\Users\\nitin\\.gemini\\antigravity\\brain\\6a281bcc-3456-43d4-90ce-7e4b171c6b9f\\media__1779381961700.png';
  try {
    const img = await loadImage(targetPath);
    console.log('Image dimensions:', img.width, 'x', img.height);
  } catch (err) {
    console.error('Error loading target image:', err);
  }
}

main();
