const prisma = require('../config/db');
const { decrypt, encrypt } = require('../utils/encryption');
const { Resend } = require('resend');

// Initialize Resend Client
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : { emails: { send: async () => ({ id: 'mock_email_id' }) } }; // Sandbox Mock fallback

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

    // 6. Deliver automatically via Resend API
    try {
      await resend.emails.send({
        from: 'rewards@elevateiq.shop',
        to: emailUsed,
        subject: `Your ${reward.name} Activation Core Delivered!`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1a1535;">
            <h2>🎉 Reward Activation Delivered Successfully</h2>
            <p>Thank you for participating in our cyber portal. Your secure reward key is detailed below:</p>
            <div style="background: #f4f3ff; border: 1px solid #7c5cfc; padding: 15px; border-radius: 8px; margin: 20px 0; font-family: monospace; font-size: 16px; font-weight: bold; color: #5b35e8;">
              ${decryptedPayload}
            </div>
            <p><strong>Verification details:</strong></p>
            <ul>
              <li><strong>Category:</strong> ${category}</li>
              <li><strong>Username/Handle:</strong> ${extraField1}</li>
              <li><strong>Invoice Index:</strong> ${claim.id}</li>
            </ul>
            <p style="font-size: 11px; color: #9b93c4; margin-top: 30px;">
              Riwaayat is an independent community platform and is not affiliated with third-party brands or services referenced on the platform.
            </p>
          </div>
        `
      });
      console.log(`[Resend] Successfully sent reward email to ${emailUsed}`);
    } catch (mailErr) {
      console.warn('[Resend] Mail delivery skipped or failed:', mailErr.message);
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
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, error: 'Promo code is required.' });
  }

  try {
    const cleanedCode = code.replace(/-/g, '').toUpperCase();
    
    // Look up code (handle exact, clean, or lowercase inputs)
    const codeStock = await prisma.redeemCode.findFirst({
      where: {
        OR: [
          { code: code.toUpperCase() },
          { code: cleanedCode }
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

module.exports = { getRewardsCatalog, redeemReward, verifyPromoCode, syncBotCode };
