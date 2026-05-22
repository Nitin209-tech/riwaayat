const { createCanvas, loadImage } = require('@napi-rs/canvas');

async function main() {
  const targetPath = 'C:\\Users\\nitin\\.gemini\\antigravity\\brain\\6a281bcc-3456-43d4-90ce-7e4b171c6b9f\\media__1779381961700.png';
  const img = await loadImage(targetPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // We find the circle of the first avatar by scanning for colors that are not the background '#1A1A1E'
  // and averaging their positions.
  function analyzeAvatar(yStart, yEnd, name) {
    let sumX = 0, sumY = 0, count = 0;
    let minX = 999, maxX = -1, minY = 999, maxY = -1;
    for (let y = yStart; y < yEnd; y++) {
      for (let x = 0; x < 45; x++) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
        if (hex !== '#1A1A1E' && hex !== '#2D241C') {
          sumX += x;
          sumY += y;
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (count > 0) {
      const centerX = sumX / count;
      const centerY = sumY / count;
      console.log(`${name}: center = (${centerX.toFixed(1)}, ${centerY.toFixed(1)}), bounds = [x: ${minX}..${maxX}, y: ${minY}..${maxY}], size = ${maxX - minX + 1}x${maxY - minY + 1}`);
    } else {
      console.log(`${name}: no avatar found`);
    }
  }

  analyzeAvatar(0, 70, 'Avatar 1');
  analyzeAvatar(100, 180, 'Avatar 2');
  analyzeAvatar(260, 347, 'Avatar 3');
}

main().catch(console.error);
