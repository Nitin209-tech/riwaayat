const { createCanvas, loadImage } = require('@napi-rs/canvas');

async function main() {
  const targetPath = 'C:\\Users\\nitin\\.gemini\\antigravity\\brain\\6a281bcc-3456-43d4-90ce-7e4b171c6b9f\\media__1779381961700.png';
  const img = await loadImage(targetPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // We want to detect the bounding box of non-background pixels for the avatars
  // The first avatar is around x=0..60, y=0..60
  // Let's find all pixels in x=0..60, y=0..60 that are not '#1A1A1E'
  let minX = 999, maxX = -1, minY = 999, maxY = -1;
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 60; x++) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
      if (hex !== '#1A1A1E') {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`First avatar bounds: x = ${minX}..${maxX} (width: ${maxX - minX + 1}), y = ${minY}..${maxY} (height: ${maxY - minY + 1})`);

  // Let's do the second avatar around y=110..160
  minX = 999; maxX = -1; minY = 999; maxY = -1;
  for (let y = 110; y < 160; y++) {
    for (let x = 0; x < 60; x++) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
      if (hex !== '#1A1A1E') {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`Second avatar bounds: x = ${minX}..${maxX} (width: ${maxX - minX + 1}), y = ${minY}..${maxY} (height: ${maxY - minY + 1})`);

  // Let's do the third avatar around y=280..340
  minX = 999; maxX = -1; minY = 999; maxY = -1;
  for (let y = 280; y < 340; y++) {
    for (let x = 0; x < 60; x++) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
      if (hex !== '#1A1A1E') {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`Third avatar bounds: x = ${minX}..${maxX} (width: ${maxX - minX + 1}), y = ${minY}..${maxY} (height: ${maxY - minY + 1})`);

  // Let's find the exact bounds of the embed box (it's `#242429` background)
  let embedMinX = 999, embedMaxX = -1, embedMinY = 999, embedMaxY = -1;
  for (let y = 140; y < 300; y++) {
    for (let x = 40; x < 600; x++) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
      if (hex === '#242429') {
        if (x < embedMinX) embedMinX = x;
        if (x > embedMaxX) embedMaxX = x;
        if (y < embedMinY) embedMinY = y;
        if (y > embedMaxY) embedMaxY = y;
      }
    }
  }
  console.log(`Embed box bounds: x = ${embedMinX}..${embedMaxX} (width: ${embedMaxX - embedMinX + 1}), y = ${embedMinY}..${embedMaxY} (height: ${embedMaxY - embedMinY + 1})`);

  // Let's find the golden mention row bounds: it has background `#2D241C`
  let mentionMinX = 999, mentionMaxX = -1, mentionMinY = 999, mentionMaxY = -1;
  for (let y = 50; y < 110; y++) {
    for (let x = 0; x < img.width; x++) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
      if (hex === '#2D241C') {
        if (x < mentionMinX) mentionMinX = x;
        if (x > mentionMaxX) mentionMaxX = x;
        if (y < mentionMinY) mentionMinY = y;
        if (y > mentionMaxY) mentionMaxY = y;
      }
    }
  }
  console.log(`Mention row bounds: x = ${mentionMinX}..${mentionMaxX} (width: ${mentionMaxX - mentionMinX + 1}), y = ${mentionMinY}..${mentionMaxY} (height: ${mentionMaxY - mentionMinY + 1})`);

  // Let's check the golden stripe at x=0
  for (let y = mentionMinY; y <= mentionMaxY; y++) {
    const p = ctx.getImageData(0, y, 1, 1).data;
    const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
    console.log(`Stripe color at (0, ${y}): ${hex}`);
  }
}

main().catch(console.error);
