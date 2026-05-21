const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

async function main() {
  // Dynamically register Inter fonts
  try {
    GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Inter-Regular.ttf'), 'gg sans');
    GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Inter-Bold.ttf'), 'gg sans bold');
  } catch (fontErr) {
    console.error('[Test] Font registration failed:', fontErr);
  }

  // Helpers to draw rounded rectangles
  function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // Draw a crisp native Gift Box emoji using Canvas path commands
  function drawGiftBox(ctx, x, y, size = 16) {
    ctx.save();
    // Red box base
    ctx.fillStyle = '#DD2E44'; // Twemoji red
    ctx.fillRect(x, y + size * 0.35, size, size * 0.65);

    // Dark red lid
    ctx.fillStyle = '#A0041E';
    ctx.fillRect(x - size * 0.05, y + size * 0.25, size * 1.1, size * 0.15);

    // Yellow vertical ribbon
    ctx.fillStyle = '#FFCC4D'; // Twemoji yellow
    ctx.fillRect(x + size * 0.4, y + size * 0.35, size * 0.2, size * 0.65);
    ctx.fillRect(x + size * 0.4, y + size * 0.25, size * 0.2, size * 0.15);

    // Yellow bow loops at top
    ctx.strokeStyle = '#FFCC4D';
    ctx.lineWidth = size * 0.15;
    ctx.beginPath();
    // Left loop
    ctx.arc(x + size * 0.3, y + size * 0.18, size * 0.15, 0, Math.PI * 2);
    // Right loop
    ctx.arc(x + size * 0.7, y + size * 0.18, size * 0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw a crisp native Gold Coin emoji
  function drawGoldCoin(ctx, x, y, size = 16) {
    ctx.save();
    const radius = size / 2;
    const cx = x + radius;
    const cy = y + radius;

    // Dark gold/orange border
    ctx.fillStyle = '#C87E0F';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Vibrant gold face
    ctx.fillStyle = '#F5B418';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Inner gold ring accent
    ctx.strokeStyle = '#FFD24D';
    ctx.lineWidth = radius * 0.15;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw a crisp native Brick emoji (for Minecraft MC Redeem Code)
  function drawBrickBlock(ctx, x, y, size = 16) {
    ctx.save();
    // Dark red brick base
    ctx.fillStyle = '#9B382B';
    ctx.fillRect(x, y, size, size);

    // Accent grout lines (grey-brown)
    ctx.strokeStyle = '#5E2018';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Horizontal splits
    ctx.moveTo(x, y + size * 0.33);
    ctx.lineTo(x + size, y + size * 0.33);
    ctx.moveTo(x, y + size * 0.66);
    ctx.lineTo(x + size, y + size * 0.66);

    // Vertical brick joints
    ctx.moveTo(x + size * 0.5, y);
    ctx.lineTo(x + size * 0.5, y + size * 0.33);

    ctx.moveTo(x + size * 0.25, y + size * 0.33);
    ctx.lineTo(x + size * 0.25, y + size * 0.66);
    ctx.moveTo(x + size * 0.75, y + size * 0.33);
    ctx.lineTo(x + size * 0.75, y + size * 0.66);

    ctx.moveTo(x + size * 0.5, y + size * 0.66);
    ctx.lineTo(x + size * 0.5, y + size);

    ctx.stroke();
    ctx.restore();
  }

  // Natively draw the white cloud on blue circle avatar
  function drawCloudAvatar(ctx, x, y, size) {
    ctx.save();
    // Soft blue background circle
    ctx.fillStyle = '#5865F2';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
    ctx.fill();

    // White puffy cloud
    ctx.fillStyle = '#FFFFFF';
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 32;

    ctx.beginPath();
    // Left bump
    ctx.arc(cx - 5 * r, cy + 2 * r, 4 * r, 0, Math.PI * 2);
    // Center-top bump
    ctx.arc(cx, cy - 2 * r, 6 * r, 0, Math.PI * 2);
    // Right bump
    ctx.arc(cx + 5 * r, cy + 2 * r, 4 * r, 0, Math.PI * 2);
    // Flat bottom rectangle
    ctx.rect(cx - 5 * r, cy, 10 * r, 4 * r);
    ctx.fill();
    ctx.restore();
  }

  // Draw grey curved Discord reply line and small cloud avatar
  function drawReply(ctx, y, text) {
    ctx.strokeStyle = '#4E5058';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Curves up and right from x = 36 (aligned with message left grid)
    ctx.moveTo(36, y + 10);
    ctx.quadraticCurveTo(36, y - 2, 46, y - 2);
    ctx.stroke();

    // Draw small 16x16 cloud avatar at x = 48
    drawCloudAvatar(ctx, 48, y - 10, 16);

    // Draw reply text next to avatar (removed raw arrow symbol)
    ctx.font = 'italic 12px "gg sans"';
    ctx.fillStyle = '#B5BAC1';
    ctx.fillText(text, 68, y + 2);
  }

  // Simulated target user details (Vouching user)
  const targetName = 'Weath3r_';
  
  // Create Canvas (Width = 905px, Height = 347px)
  const canvas = createCanvas(905, 347);
  const ctx = canvas.getContext('2d');

  // Fill Discord Midnight theme background
  ctx.fillStyle = '#1A1A1E';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Timestamps
  const timeBot = '7:00 PM';
  const timeUser = '7:37 PM';

  // --- 1. DRAW BOT PAYOUT BLOCK (Riwaayat APP) ---
  // Top reply line
  drawReply(ctx, 20, 'Message could not be loaded');

  // Bot avatar (Cloud logo drawn at 32x32 size)
  drawCloudAvatar(ctx, 6, 36, 32);

  // Username: "Riwaayat" (white, bold 15px)
  ctx.font = 'bold 15px "gg sans bold"';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Riwaayat', 48, 48);
  const botNameWidth = ctx.measureText('Riwaayat').width;

  // Blue APP Badge
  const badgeX = 48 + botNameWidth + 6;
  const badgeY = 37;
  ctx.fillStyle = '#5865F2';
  drawRoundedRect(ctx, badgeX, badgeY, 25, 14, 3);
  ctx.fill();

  ctx.font = 'bold 9px "gg sans bold"';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('APP', badgeX + 4, 47);

  // Bot Timestamp next to APP Badge
  ctx.font = '12px "gg sans"';
  ctx.fillStyle = '#949BA4';
  ctx.fillText(timeBot, badgeX + 25 + 8, 48);

  // Bot Message content: Reward Claimed Header
  ctx.font = 'bold 15px "gg sans bold"';
  ctx.fillStyle = '#FFFFFF';

  // Draw native crisp Gift Box emoji
  drawGiftBox(ctx, 48, 54, 16);
  
  // Draw header text
  ctx.fillText('REWARD CLAIMED — 50$ ROBLOX GIFTCARD', 70, 68);
  const headerTextWidth = ctx.measureText('REWARD CLAIMED — 50$ ROBLOX GIFTCARD').width;

  // Draw native crisp Gold Coin emoji
  drawGoldCoin(ctx, 70 + headerTextWidth + 6, 54, 16);

  // Redeem Code Row
  ctx.font = '15px "gg sans"';
  ctx.fillStyle = '#DBDEE1';
  ctx.fillText('REDEEM CODE = ', 48, 88);
  const codeLabelWidth = ctx.measureText('REDEEM CODE = ').width;

  // Draw code spoiler box next to it
  ctx.fillStyle = '#2E3035';
  drawRoundedRect(ctx, 48 + codeLabelWidth, 76, 240, 16, 3);
  ctx.fill();

  // Claim Website Row
  ctx.fillStyle = '#DBDEE1';
  ctx.fillText('CLAIM WEBSITE = ', 48, 108);
  const siteLabelWidth = ctx.measureText('CLAIM WEBSITE = ').width;

  // Draw website spoiler box
  ctx.fillStyle = '#2E3035';
  drawRoundedRect(ctx, 48 + siteLabelWidth, 96, 240, 16, 3);
  ctx.fill();

  // Spoiler Image Attachment Block
  const attachX = 48;
  const attachY = 122;
  const attachW = 460;
  const attachH = 110;

  // Draw dark rounded attachment rectangle
  ctx.fillStyle = '#2B2D31';
  drawRoundedRect(ctx, attachX, attachY, attachW, attachH, 8);
  ctx.fill();

  // Draw centered black capsule spoiler button
  const cx = attachX + attachW / 2;
  const cy = attachY + attachH / 2;
  const pillW = 76;
  const pillH = 28;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  drawRoundedRect(ctx, cx - pillW / 2, cy - pillH / 2, pillW, pillH, 14);
  ctx.fill();

  // "SPOILER" text inside pill
  ctx.font = 'bold 12px "gg sans bold"';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPOILER', cx, cy);

  // Restore defaults for standard rendering
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // --- 2. DRAW CONSECUTIVE BOT MESSAGE ("ARE WE LEGIT??") ---
  ctx.font = 'bold 16px "gg sans bold"';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('ARE WE LEGIT??', 48, 250);

  // --- 3. DRAW USER VOUCH BLOCK (Weath3r_) ---
  // User block y anchor starts at 276
  drawReply(ctx, 276, 'Original message was deleted');

  // User avatar placeholder (circle, warm color representing avatar)
  ctx.fillStyle = '#57F287'; // Bright legit-green avatar color for testing
  ctx.beginPath();
  ctx.arc(22, 308, 16, 0, Math.PI * 2, true);
  ctx.fill();

  // Username: "Weath3r_" in premium green role color
  ctx.font = 'bold 15px "gg sans bold"';
  ctx.fillStyle = '#57F287';
  ctx.fillText(targetName, 48, 304);
  const userNameWidth = ctx.measureText(targetName).width;

  // User Timestamp
  ctx.font = '12px "gg sans"';
  ctx.fillStyle = '#949BA4';
  ctx.fillText(timeUser, 48 + userNameWidth + 8, 304);

  // User Vouch Message lines: "Yes" and "Legit!"
  ctx.font = '15px "gg sans"';
  ctx.fillStyle = '#DBDEE1';
  ctx.fillText('Yes', 48, 322);
  ctx.fillText('Legit!', 48, 339);

  // Save rendering to test file
  const outPath = path.join(__dirname, '..', 'data', 'test-proof-result.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  console.log('Successfully saved same-to-same mock proof to:', outPath);
}

main().catch(console.error);
