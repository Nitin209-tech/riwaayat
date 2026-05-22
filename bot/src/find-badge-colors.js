const { createCanvas, loadImage } = require('@napi-rs/canvas');

async function main() {
  const targetPath = 'C:\\Users\\nitin\\.gemini\\antigravity\\brain\\6a281bcc-3456-43d4-90ce-7e4b171c6b9f\\media__1779381961700.png';
  const img = await loadImage(targetPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  console.log('--- Scan for non-neutral colors in y = 115..135, x = 80..180 ---');
  for (let y = 115; y < 135; y++) {
    for (let x = 80; x < 180; x++) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
      // A pixel is non-neutral if R, G, B differ significantly
      const r = p[0], g = p[1], b = p[2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min > 30) { // Significant color saturation
        console.log(`Color at (${x}, ${y}): ${hex} (RGB: ${r}, ${g}, ${b})`);
      }
    }
  }
}

main().catch(console.error);
