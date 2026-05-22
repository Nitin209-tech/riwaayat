const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');

async function main() {
  const filePath = 'C:\\Users\\nitin\\.gemini\\antigravity\\brain\\6a281bcc-3456-43d4-90ce-7e4b171c6b9f\\media__1779381961700.png';
  const img = await loadImage(filePath);
  
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imgData.data;

  console.log('--- USERNAME COLOR ANALYSIS ---');
  
  // 1. Scan for Count's username color (around y=137, count's name is on the left)
  // Let's print out some non-dark colors around y = 137, x = 45 to 110
  console.log("Count's Name Row (y=137):");
  for (let x = 45; x < 120; x++) {
    const idx = (137 * img.width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    if (r > 40 || g > 40 || b > 40) {
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      console.log(`  X = ${x.toString().padStart(2, ' ')}: RGB(${r}, ${g}, ${b}) / Hex: ${hex}`);
    }
  }

  // 2. Scan for hamdabird's username color (around y=20, top message)
  console.log("hamdabird's Name Row (y=20):");
  for (let x = 45; x < 120; x++) {
    const idx = (20 * img.width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    if (r > 40 || g > 40 || b > 40) {
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      console.log(`  X = ${x.toString().padStart(2, ' ')}: RGB(${r}, ${g}, ${b}) / Hex: ${hex}`);
    }
  }
}

main().catch(console.error);
