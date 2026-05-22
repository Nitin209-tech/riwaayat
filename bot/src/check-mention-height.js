const { createCanvas, loadImage } = require('@napi-rs/canvas');

async function main() {
  const targetPath = 'C:\\Users\\nitin\\.gemini\\antigravity\\brain\\6a281bcc-3456-43d4-90ce-7e4b171c6b9f\\media__1779381961700.png';
  const img = await loadImage(targetPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  console.log('--- Colors at x = 100 from y = 60 to 100 ---');
  for (let y = 60; y <= 100; y++) {
    const p = ctx.getImageData(100, y, 1, 1).data;
    const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
    console.log(`y = ${y}: ${hex}`);
  }
}

main().catch(console.error);
