const { createCanvas, loadImage } = require('@napi-rs/canvas');

async function main() {
  const targetPath = 'C:\\Users\\nitin\\.gemini\\antigravity\\brain\\6a281bcc-3456-43d4-90ce-7e4b171c6b9f\\media__1779381961700.png';
  const img = await loadImage(targetPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  function findTextStartX(y, startX = 40, endX = 200) {
    for (let x = startX; x < endX; x++) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
      if (hex !== '#1A1A1E' && hex !== '#2D241C' && hex !== '#242429') {
        return { x, hex };
      }
    }
    return null;
  }

  console.log('Username 1 (y=20):', findTextStartX(20, 70));
  console.log('Message 1 Line 1 (y=40):', findTextStartX(40, 70));
  console.log('Message 1 Highlight (y=78):', findTextStartX(78, 70));
  console.log('Username 2 (y=120):', findTextStartX(120, 70));
  console.log('Message 2 Line 1 (y=137):', findTextStartX(137, 70));
}

main().catch(console.error);
