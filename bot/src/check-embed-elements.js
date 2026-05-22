const { createCanvas, loadImage } = require('@napi-rs/canvas');

async function main() {
  const targetPath = 'C:\\Users\\nitin\\.gemini\\antigravity\\brain\\6a281bcc-3456-43d4-90ce-7e4b171c6b9f\\media__1779381961700.png';
  const img = await loadImage(targetPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // Scan for the blue button inside the embed (y = 161..275, x = 46..469)
  // Standard Discord blue button color is '#5865F2'
  let btnMinX = 999, btnMaxX = -1, btnMinY = 999, btnMaxY = -1;
  for (let y = 161; y < 275; y++) {
    for (let x = 46; x < 469; x++) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
      // Discord blue/blurple color matches: R=88, G=101, B=242
      if (p[0] > 70 && p[0] < 100 && p[1] > 90 && p[1] < 115 && p[2] > 230 && p[2] < 255) {
        if (x < btnMinX) btnMinX = x;
        if (x > btnMaxX) btnMaxX = x;
        if (y < btnMinY) btnMinY = y;
        if (y > btnMaxY) btnMaxY = y;
      }
    }
  }
  console.log(`Blue Button bounds: x = ${btnMinX}..${btnMaxX} (width: ${btnMaxX - btnMinX + 1}), y = ${btnMinY}..${btnMaxY} (height: ${btnMaxY - btnMinY + 1})`);

  // Scan for the Wumpus image bounding box (y = 161..275)
  // Wumpus has bright green, pink, and blue pixels. Let's find where they are.
  let wumpusMinX = 999, wumpusMaxX = -1, wumpusMinY = 999, wumpusMaxY = -1;
  for (let y = 161; y < 275; y++) {
    for (let x = 250; x < 469; x++) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
      // Green ribbon (e.g. #00E676) or pink box (e.g. #FF3366) or blue bg
      const isWumpusColor = (p[1] > 180 && p[0] < 100) || (p[0] > 180 && p[1] < 100 && p[2] > 100);
      if (isWumpusColor) {
        if (x < wumpusMinX) wumpusMinX = x;
        if (x > wumpusMaxX) wumpusMaxX = x;
        if (y < wumpusMinY) wumpusMinY = y;
        if (y > wumpusMaxY) wumpusMaxY = y;
      }
    }
  }
  console.log(`Wumpus bounds: x = ${wumpusMinX}..${wumpusMaxX} (width: ${wumpusMaxX - wumpusMinX + 1}), y = ${wumpusMinY}..${wumpusMaxY} (height: ${wumpusMaxY - wumpusMinY + 1})`);
}

main().catch(console.error);
