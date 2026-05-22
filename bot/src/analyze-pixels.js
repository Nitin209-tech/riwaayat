const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');

async function main() {
  const targetPath = 'C:\\Users\\nitin\\.gemini\\antigravity\\brain\\6a281bcc-3456-43d4-90ce-7e4b171c6b9f\\media__1779381961700.png';
  const img = await loadImage(targetPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  console.log(`Image size: ${img.width}x${img.height}`);

  // Sample vertical slice at x = 10 to see background colors
  console.log('--- Vertical background colors at x = 10 ---');
  let lastColor = '';
  for (let y = 0; y < img.height; y++) {
    const p = ctx.getImageData(10, y, 1, 1).data;
    const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
    if (hex !== lastColor) {
      console.log(`y = ${y}: ${hex}`);
      lastColor = hex;
    }
  }

  // Sample vertical slice at x = 200 (across usernames, text, embed, etc.)
  console.log('--- Vertical colors at x = 200 ---');
  lastColor = '';
  for (let y = 0; y < img.height; y++) {
    const p = ctx.getImageData(200, y, 1, 1).data;
    const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
    if (hex !== lastColor) {
      console.log(`y = ${y}: ${hex}`);
      lastColor = hex;
    }
  }

  // Let's sample specific spots to understand the colors
  // Spot 1: hamdabird username color (at y around 10-50, x around 70-120)
  // Let's find the non-background colors in the first row
  const rowColors = new Map();
  for (let x = 60; x < 200; x++) {
    const p = ctx.getImageData(x, 20, 1, 1).data;
    const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
    rowColors.set(hex, (rowColors.get(hex) || 0) + 1);
  }
  console.log('--- Colors around y=20 (first username row) ---', [...rowColors.entries()].filter(e => e[1] > 2));
}

main().catch(console.error);
