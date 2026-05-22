const { createCanvas, loadImage } = require('@napi-rs/canvas');

async function main() {
  const targetPath = 'C:\\Users\\nitin\\.gemini\\antigravity\\brain\\6a281bcc-3456-43d4-90ce-7e4b171c6b9f\\media__1779381961700.png';
  const img = await loadImage(targetPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  console.log('--- Hex Dump of row y = 123 from x = 80 to 160 ---');
  let rowStr = '';
  for (let x = 80; x < 160; x++) {
    const p = ctx.getImageData(x, 123, 1, 1).data;
    const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
    
    // Character representations for quick visual understanding:
    // '#' for dark gray/neutral (#1A1A1E), '.' for slightly different, letters/symbols for text/badges
    let symbol = ' ';
    if (hex === '#1A1A1E') {
      symbol = ' ';
    } else if (hex.startsWith('#2') || hex.startsWith('#3')) {
      symbol = '.';
    } else {
      symbol = 'X';
    }
    console.log(`x = ${x}: ${hex} [${symbol}]`);
  }
}

main().catch(console.error);
