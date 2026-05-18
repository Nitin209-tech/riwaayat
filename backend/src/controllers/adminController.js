const prisma = require('../config/db');
const { encrypt } = require('../utils/encryption');

/**
 * Generate secure redeem code and encrypt raw payload inside DB
 */
async function generateRedeemCode(req, res) {
  const { rewardId, code, cleartextPayload, maxUses, expiresAt } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!rewardId || !code || !cleartextPayload) {
    return res.status(400).json({ success: false, error: 'Incomplete parameters for code generation.' });
  }

  try {
    // Check if code already exists
    const existing = await prisma.redeemCode.findUnique({ where: { code: code.toUpperCase() } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Code value already active in stock registry.' });
    }

    // Encrypt cleartext payload using AES-256-GCM
    const encryptedPayload = encrypt(cleartextPayload);

    // Write to database
    const newCode = await prisma.redeemCode.create({
      data: {
        rewardId,
        code: code.toUpperCase().trim(),
        encryptedPayload,
        maxUses: parseInt(maxUses) || 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });

    // Write security audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ADMIN_CODE_GENERATE',
        ipAddress: ip,
        details: `Generated code ${newCode.code} mapping to reward ${rewardId}. Maximum uses: ${maxUses}`
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Cryptographic code generated and encrypted safely.',
      code: newCode
    });
  } catch (err) {
    console.error('Code generation failed:', err);
    return res.status(500).json({ success: false, error: 'Internal secure code creation failure' });
  }
}

/**
 * List visitor logs sessions (IP, Geo country, browser UA)
 */
async function getVisitorLogs(req, res) {
  try {
    const logs = await prisma.visitor.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, logs });
  } catch (err) {
    console.error('Visitor logs query failed:', err);
    return res.status(500).json({ success: false, error: 'Database session query failed' });
  }
}

/**
 * List security audit logs
 */
async function getAuditLogs(req, res) {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });
    return res.status(200).json({ success: true, logs });
  } catch (err) {
    console.error('Audit query failed:', err);
    return res.status(500).json({ success: false, error: 'Database audit query failed' });
  }
}

module.exports = { generateRedeemCode, getVisitorLogs, getAuditLogs };
