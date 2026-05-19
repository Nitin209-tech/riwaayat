const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = Buffer.from(
  (process.env.ENCRYPTION_SECRET || 'cyber-riwaayat-premium-security-secret-key-32-change-me').substring(0, 32),
  'utf-8'
);

/**
 * Encrypt cleartext string into secure AES-256-GCM payload.
 */
function encrypt(text) {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(12); // GCM standard IV size
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:encrypted:tag
    return `${iv.toString('hex')}:${encrypted}:${tag}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    return '';
  }
}

/**
 * Decrypt secure payload back to original cleartext.
 */
function decrypt(encryptedPayload) {
  if (!encryptedPayload) return '';
  try {
    const [ivHex, encryptedHex, tagHex] = encryptedPayload.split(':');
    if (!ivHex || !encryptedHex || !tagHex) return encryptedPayload; // Fail gracefully if not encrypted
    
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.warn('Decryption failed, returning input:', err.message);
    return encryptedPayload;
  }
}

module.exports = { encrypt, decrypt };
