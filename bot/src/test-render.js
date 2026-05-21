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
    ctx.fillStyle = '#DD2E44'; // Twemoji red
    ctx.fillRect(x, y + size * 0.35, size, size * 0.65);

    ctx.fillStyle = '#A0041E'; // Dark red lid
    ctx.fillRect(x - size * 0.05, y + size * 0.25, size * 1.1, size * 0.15);

    ctx.fillStyle = '#FFCC4D'; // Twemoji yellow vertical ribbon
    ctx.fillRect(x + size * 0.4, y + size * 0.35, size * 0.2, size * 0.65);
    ctx.fillRect(x + size * 0.4, y + size * 0.25, size * 0.2, size * 0.15);

    ctx.strokeStyle = '#FFCC4D'; // Yellow bow loops at top
    ctx.lineWidth = size * 0.15;
    ctx.beginPath();
    ctx.arc(x + size * 0.3, y + size * 0.18, size * 0.15, 0, Math.PI * 2);
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

    ctx.fillStyle = '#C87E0F'; // Dark gold/orange border
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F5B418'; // Vibrant gold face
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFD24D'; // Inner gold ring accent
    ctx.lineWidth = radius * 0.15;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw a crisp native Brick emoji (for Minecraft MC Redeem Code)
  function drawBrickBlock(ctx, x, y, size = 16) {
    ctx.save();
    ctx.fillStyle = '#9B382B'; // Dark red brick base
    ctx.fillRect(x, y, size, size);

    ctx.strokeStyle = '#5E2018'; // Accent grout lines
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.33);
    ctx.lineTo(x + size, y + size * 0.33);
    ctx.moveTo(x, y + size * 0.66);
    ctx.lineTo(x + size, y + size * 0.66);

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
    ctx.fillStyle = '#5865F2'; // Soft blue background circle
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF'; // White puffy cloud
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 32;

    ctx.beginPath();
    ctx.arc(cx - 5 * r, cy + 2 * r, 4 * r, 0, Math.PI * 2);
    ctx.arc(cx, cy - 2 * r, 6 * r, 0, Math.PI * 2);
    ctx.arc(cx + 5 * r, cy + 2 * r, 4 * r, 0, Math.PI * 2);
    ctx.rect(cx - 5 * r, cy, 10 * r, 4 * r);
    ctx.fill();
    ctx.restore();
  }

  // Draw grey curved Discord reply line and small cloud avatar
  function drawReply(ctx, y, text) {
    ctx.strokeStyle = '#4E5058';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(36, y + 10);
    ctx.quadraticCurveTo(36, y - 2, 46, y - 2);
    ctx.stroke();

    drawCloudAvatar(ctx, 48, y - 10, 16);

    ctx.font = 'italic 12px "gg sans"';
    ctx.fillStyle = '#B5BAC1';
    ctx.fillText(text, 68, y + 2);
  }

  async function renderProof(prize, outFilename) {
    // Create Canvas (Width = 905px, Height = 347px)
    const canvas = createCanvas(905, 347);
    const ctx = canvas.getContext('2d');

    // Fill Discord Midnight theme background
    ctx.fillStyle = '#1A1A1E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const isNitroPrize = prize === 'nitro_basic' || prize === 'nitro_boost';

    if (isNitroPrize) {
      // --- AMOLED/MIDNIGHT CLASSIC NITRO CONVERSATION FLOW ---
      const time1 = '6:41 PM';
      const time2 = '6:42 PM';
      const time3 = '6:42 PM';
      const randomInvites = 4;
      const giftCode = 'A1B2C3D4E5F6G7H8';

      // Load wumpus image
      let wumpusImg = null;
      try {
        wumpusImg = await loadImage(path.join(__dirname, 'fonts', 'wumpus.png'));
      } catch (err) {
        console.error('Wumpus image load failed:', err.message);
      }

      // Template
      const template = {
        first: [
          `i have made like ${randomInvites} invites`,
          `@Count WHEN U PAY MY NITRO BASIC BITCH`,
          'HUH????'
        ],
        third: [
          'HAHAHAHAH GOOOD BOOY',
          'REAL THOUGH BTW'
        ]
      };

      // --- DRAW BLOCK 1 (Target User requesting) ---
      const block1StartY = 11;

      // Draw Avatar 1 (Warm Tone placeholder representing hamdabird)
      ctx.fillStyle = '#C9947A';
      ctx.beginPath();
      ctx.arc(22, block1StartY + 16, 16, 0, Math.PI * 2, true);
      ctx.fill();

      // Draw Username 1
      ctx.font = '15px "gg sans bold"';
      ctx.fillStyle = '#E1E1E3';
      ctx.fillText('hamdabird', 48, block1StartY + 14);
      const nameWidth1 = ctx.measureText('hamdabird').width;

      // Draw Timestamp 1
      ctx.font = '12px "gg sans"';
      ctx.fillStyle = '#949BA4';
      ctx.fillText(time1, 48 + nameWidth1 + 8, block1StartY + 14);

      // Draw Message lines with golden mention highlight support
      let currentY = block1StartY + 31;
      for (const line of template.first) {
        if (line.includes('@Count')) {
          const mentionStr = '@Count';
          const parts = line.split(mentionStr);
          const beforeStr = parts[0];
          const afterStr = parts[1];
          
          // Draw golden highlight background
          ctx.fillStyle = '#2D241C';
          ctx.fillRect(1, currentY - 9, 903, 17);
          
          // Draw golden vertical border
          ctx.fillStyle = '#B06B0A';
          ctx.fillRect(0, currentY - 9, 2, 17);
          
          let startXText = 48;
          ctx.font = '15px "gg sans"';
          ctx.fillStyle = '#DBDEE1';
          
          if (beforeStr) {
            ctx.fillText(beforeStr, startXText, currentY);
            startXText += ctx.measureText(beforeStr).width;
          }
          
          // Draw mention badge
          ctx.font = 'bold 15px "gg sans bold"';
          const badgeWidth = ctx.measureText(mentionStr).width + 8;
          ctx.fillStyle = 'rgba(88, 101, 242, 0.3)';
          drawRoundedRect(ctx, startXText, currentY - 8, badgeWidth, 15, 3);
          ctx.fill();
          
          ctx.fillStyle = '#E3E7FD';
          ctx.fillText(mentionStr, startXText + 4, currentY);
          
          startXText += badgeWidth;
          
          if (afterStr) {
            ctx.font = '15px "gg sans"';
            ctx.fillStyle = '#DBDEE1';
            ctx.fillText(afterStr, startXText, currentY);
          }
        } else {
          ctx.font = '15px "gg sans"';
          ctx.fillStyle = '#DBDEE1';
          ctx.fillText(line, 48, currentY);
        }
        currentY += 17;
      }

      // --- DRAW BLOCK 2 (Command Executor delivering prize) ---
      const block2StartY = currentY + 14;

      // Draw Avatar 2 (Deep Green placeholder representing Count)
      ctx.fillStyle = '#375A3B';
      ctx.beginPath();
      ctx.arc(22, block2StartY + 16, 16, 0, Math.PI * 2, true);
      ctx.fill();

      // Draw Username 2
      ctx.font = '15px "gg sans bold"';
      ctx.fillStyle = '#7396F1';
      ctx.fillText('Count', 48, block2StartY + 14);
      const execNameWidth = ctx.measureText('Count').width;

      // Draw Gift Role Icon (natively drawn) next to username
      drawGiftBox(ctx, 48 + execNameWidth + 4, block2StartY + 3, 11);

      // Draw BOT Tag Badge
      ctx.fillStyle = '#59595E';
      drawRoundedRect(ctx, 48 + execNameWidth + 20, block2StartY + 3, 16, 11, 2);
      ctx.fill();

      ctx.font = 'bold 8px "gg sans bold"';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('BOT', 48 + execNameWidth + 22, block2StartY + 11);

      // Draw Timestamp 2
      ctx.font = '12px "gg sans"';
      ctx.fillStyle = '#949BA4';
      ctx.fillText(time2, 48 + execNameWidth + 42, block2StartY + 14);

      // Draw Message text Line 1 (natively drawn Gift box emoji)
      drawGiftBox(ctx, 48, block2StartY + 19, 15);
      ctx.font = '15px "gg sans"';
      ctx.fillStyle = '#DBDEE1';
      ctx.fillText('Thank you for inviting users to my server!', 69, block2StartY + 31);
      
      let prefixText = '';
      let embedTitle = '';
      let embedDesc = '';

      if (prize === 'nitro_basic') {
        prefixText = 'Here is your Nitro Basic 1 Month: ';
        embedTitle = "You've been gifted a subscription!";
        embedDesc = "You've been gifted Nitro Basic for 1 month!";
      } else {
        prefixText = 'Here is your Nitro Boost 1 Month: ';
        embedTitle = "You've been gifted a subscription!";
        embedDesc = "You've been gifted Nitro Boost for 1 month!";
      }

      // Draw Message text Line 2
      ctx.fillText(prefixText, 48, block2StartY + 48);
      const prefixWidth = ctx.measureText(prefixText).width;

      // Draw Redacted Spoiler Box
      const codeText = `https://discord.gift/${giftCode}`;
      const spoilerWidth = ctx.measureText(codeText).width + 12;
      ctx.fillStyle = '#666770';
      drawRoundedRect(ctx, 48 + prefixWidth, block2StartY + 35, spoilerWidth, 16, 3);
      ctx.fill();

      // Draw Embed Card Box
      const embedY = block2StartY + 60;
      const embedW = 424;
      const embedH = 115;

      ctx.fillStyle = '#242429';
      drawRoundedRect(ctx, 46, embedY, embedW, embedH, 8);
      ctx.fill();

      ctx.strokeStyle = '#2C2C31';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, 45.5, embedY - 0.5, embedW + 1, embedH + 1, 8);
      ctx.stroke();

      // Title
      ctx.font = 'bold 13px "gg sans bold"';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(embedTitle, 56, embedY + 19);

      // Description
      ctx.font = '12px "gg sans"';
      ctx.fillStyle = '#DBDEE1';
      const descLines = embedDesc.split('\n');
      let descY = embedY + 36;
      for (const line of descLines) {
        ctx.fillText(line, 56, descY);
        descY += 16;
      }

      // Draw Button "Open Gift"
      ctx.fillStyle = '#5865F2';
      drawRoundedRect(ctx, 56, embedY + 69, 52, 20, 3);
      ctx.fill();

      ctx.font = 'bold 9px "gg sans bold"';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Open Gift', 61, embedY + 82);

      // Draw Expires text
      ctx.font = '11px "gg sans"';
      ctx.fillStyle = '#949BA4';
      ctx.fillText('Expires in 44 hours', 118, embedY + 82);

      // Draw Wumpus Nitro Graphic
      if (wumpusImg) {
        ctx.drawImage(wumpusImg, 303, embedY + 7, 114, 72);
      }

      // --- DRAW BLOCK 3 (Target User saying thankyou legit) ---
      const block3StartY = embedY + 115 + 16;

      // Draw Avatar 3
      ctx.fillStyle = '#C9947A';
      ctx.beginPath();
      ctx.arc(22, block3StartY + 16, 16, 0, Math.PI * 2, true);
      ctx.fill();

      // Draw Name
      ctx.font = '15px "gg sans bold"';
      ctx.fillStyle = '#E1E1E3';
      ctx.fillText('hamdabird', 48, block3StartY + 14);
      const nameWidth3 = ctx.measureText('hamdabird').width;

      // Draw Timestamp
      ctx.font = '12px "gg sans"';
      ctx.fillStyle = '#949BA4';
      ctx.fillText(time3, 48 + nameWidth3 + 8, block3StartY + 14);

      // Draw Message text lines
      ctx.font = '15px "gg sans"';
      ctx.fillStyle = '#DBDEE1';
      let currentY3 = block3StartY + 31;
      for (const line of template.third) {
        ctx.fillText(line, 48, currentY3);
        currentY3 += 17;
      }
    } else {
      // --- MODERN NON-NITRO (SPOILER-BASED) LAYOUT ---
      const timeBot = '7:00 PM';
      const timeUser = '7:37 PM';

      // --- 1. DRAW BOT PAYOUT BLOCK (Riwaayat APP) ---
      drawReply(ctx, 20, 'Message could not be loaded');

      // Bot avatar (Cloud logo fallback)
      drawCloudAvatar(ctx, 6, 36, 32);

      // Username: "Riwaayat" (white, bold 15px)
      ctx.font = 'bold 15px "gg sans bold"';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Riwaayat', 48, 48);
      const botNameWidth = ctx.measureText('Riwaayat').width;

      // Blue APP Badge next to name
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

      // Reward Claimed Header
      let headerText = '';
      let drawSecondEmoji = drawGoldCoin;

      if (prize === 'minecraft') {
        headerText = 'REWARD CLAIMED — MC REDEEM CODE';
        drawSecondEmoji = drawBrickBlock;
      } else if (prize === 'robux_50') {
        headerText = 'REWARD CLAIMED — 50$ ROBLOX GIFTCARD';
        drawSecondEmoji = drawGoldCoin;
      } else if (prize === 'robux_100') {
        headerText = 'REWARD CLAIMED — 100$ ROBLOX GIFTCARD';
        drawSecondEmoji = drawGoldCoin;
      } else {
        headerText = `REWARD CLAIMED — ${prize.replace('_', ' ').toUpperCase()}`;
        drawSecondEmoji = drawGoldCoin;
      }

      // Draw crisp native Gift Box emoji
      drawGiftBox(ctx, 48, 54, 16);

      // Draw header text
      ctx.font = 'bold 15px "gg sans bold"';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(headerText, 70, 68);
      const headerTextWidth = ctx.measureText(headerText).width;

      // Draw specific prize emoji at the end
      drawSecondEmoji(ctx, 70 + headerTextWidth + 6, 54, 16);

      // Redeem Code Row
      ctx.font = '15px "gg sans"';
      ctx.fillStyle = '#DBDEE1';
      ctx.fillText('REDEEM CODE = ', 48, 88);
      const codeLabelWidth = ctx.measureText('REDEEM CODE = ').width;

      // Draw code spoiler box
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

      // --- 2. CONSECUTIVE BOT MESSAGE ("ARE WE LEGIT??") ---
      ctx.font = 'bold 16px "gg sans bold"';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('ARE WE LEGIT??', 48, 250);

      // --- 3. DRAW USER VOUCH BLOCK ---
      const vouchStartY = 276;

      // User block reply line
      drawReply(ctx, vouchStartY, 'Original message was deleted');

      // User avatar
      ctx.fillStyle = '#57F287'; // Premium green fallback
      ctx.beginPath();
      ctx.arc(22, vouchStartY + 32, 16, 0, Math.PI * 2, true);
      ctx.fill();

      // Username in vibrant legit-green role color
      ctx.font = 'bold 15px "gg sans bold"';
      ctx.fillStyle = '#57F287';
      ctx.fillText('Weath3r_', 48, vouchStartY + 28);
      const userNameWidth = ctx.measureText('Weath3r_').width;

      // User Timestamp next to username
      ctx.font = '12px "gg sans"';
      ctx.fillStyle = '#949BA4';
      ctx.fillText(timeUser, 48 + userNameWidth + 8, vouchStartY + 28);

      // Vouch text lines
      ctx.font = '15px "gg sans"';
      ctx.fillStyle = '#DBDEE1';
      ctx.fillText('Yes', 48, vouchStartY + 46);
      ctx.fillText('Legit!', 48, vouchStartY + 63);
    }

    // Save rendering to test file
    const outPath = path.join(__dirname, '..', 'data', `${outFilename}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buffer);
    console.log(`Successfully saved same-to-same mock proof [${prize}] to:`, outPath);
  }

  // Generate both for verification
  await renderProof('robux_50', 'test-proof-result-robux');
  await renderProof('nitro_basic', 'test-proof-result-nitro');
}

main().catch(console.error);
