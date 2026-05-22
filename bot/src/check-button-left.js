const { createCanvas, loadImage } = require('@napi-rs/canvas');

async function main() {
  const targetPath = 'C:\\Users\\nitin\\.gemini\\antigravity\\brain\\6a281bcc-3456-43d4-90ce-7e4b171c6b9f\\media__1779381961700.png';
  const img = await loadImage(targetPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // Scan for the blue button strictly in x = 46..200
  let btnMinX = 999, btnMaxX = -1, btnMinY = 999, btnMaxY = -1;
  for (let y = 161; y < 275; y++) {
    for (let x = 46; x < 200; x++) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      // Discord blue/blurple color matches
      if (p[0] > 70 && p[0] < 100 && p[1] > 90 && p[1] < 115 && p[2] > 230 && p[2] < 255) {
        if (x < btnMinX) btnMinX = x;
        if (x > btnMaxX) btnMaxX = x;
        if (y < btnMinY) btnMinY = y;
        if (y > btnMaxY) btnMaxY = y;
      }
    }
  }
  console.log(`Blue Button bounds: x = ${btnMinX}..${btnMaxX} (width: ${btnMaxX - btnMinX + 1}), y = ${btnMinY}..${btnMaxY} (height: ${btnMaxY - btnMinY + 1})`);
}

main().catch(console.error);
