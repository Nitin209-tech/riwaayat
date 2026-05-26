// ─── AUTOMOD SYSTEM ─────────────────────────────────────────────────
// Per-guild configurable moderation: anti-link, anti-spam, anti-upload,
// anti-mass-mention, anti-badwords, anti-invite.

const { PermissionFlagsBits } = require('discord.js');
const db = require('../database');
const whitelist = require('./whitelist');

// In-memory spam tracker: Map<guildId, Map<userId, number[]>>
const spamTracker = new Map();

const MODULES = ['antilink', 'antispam', 'antiupload', 'antimassmention', 'antibadwords', 'antiinvite'];
const PUNISHMENTS = ['delete', 'warn', 'timeout', 'kick'];

// ─── SETTINGS ───────────────────────────────────────────────────────

function isModuleEnabled(mod, guildId) {
  return db.getSetting(`automod_${mod}`, false, guildId);
}

function setModuleEnabled(mod, enabled, guildId) {
  db.setSetting(`automod_${mod}`, enabled, guildId);
}

function getModulePunishment(mod, guildId) {
  return db.getSetting(`automod_${mod}_punishment`, 'delete', guildId);
}

function setModulePunishment(mod, punishment, guildId) {
  db.setSetting(`automod_${mod}_punishment`, punishment, guildId);
}

function getExemptRoles(mod, guildId) {
  const list = db.getSetting(`automod_${mod}_exempt`, [], guildId);
  return Array.isArray(list) ? list : [];
}

function addExemptRole(mod, roleId, guildId) {
  const list = getExemptRoles(mod, guildId);
  if (list.includes(roleId)) return false;
  list.push(roleId);
  db.setSetting(`automod_${mod}_exempt`, list, guildId);
  return true;
}

function removeExemptRole(mod, roleId, guildId) {
  const list = getExemptRoles(mod, guildId);
  const idx = list.indexOf(roleId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  db.setSetting(`automod_${mod}_exempt`, list, guildId);
  return true;
}

function getExemptChannels(guildId) {
  const list = db.getSetting('automod_exemptChannels', [], guildId);
  return Array.isArray(list) ? list : [];
}

function addExemptChannel(channelId, guildId) {
  const list = getExemptChannels(guildId);
  if (list.includes(channelId)) return false;
  list.push(channelId);
  db.setSetting('automod_exemptChannels', list, guildId);
  return true;
}

function removeExemptChannel(channelId, guildId) {
  const list = getExemptChannels(guildId);
  const idx = list.indexOf(channelId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  db.setSetting('automod_exemptChannels', list, guildId);
  return true;
}

// Badwords
function getBadwords(guildId) {
  const list = db.getSetting('automod_badwords_list', [], guildId);
  return Array.isArray(list) ? list : [];
}

function addBadword(word, guildId) {
  const list = getBadwords(guildId);
  const lower = word.toLowerCase();
  if (list.includes(lower)) return false;
  list.push(lower);
  db.setSetting('automod_badwords_list', list, guildId);
  return true;
}

function removeBadword(word, guildId) {
  const list = getBadwords(guildId);
  const lower = word.toLowerCase();
  const idx = list.indexOf(lower);
  if (idx === -1) return false;
  list.splice(idx, 1);
  db.setSetting('automod_badwords_list', list, guildId);
  return true;
}

// Spam threshold
function getSpamThreshold(guildId) {
  return db.getSetting('automod_spam_threshold', 5, guildId); // 5 messages
}

function setSpamThreshold(val, guildId) {
  db.setSetting('automod_spam_threshold', val, guildId);
}

function getSpamWindow(guildId) {
  return db.getSetting('automod_spam_window', 5000, guildId); // 5 seconds
}

function setSpamWindow(val, guildId) {
  db.setSetting('automod_spam_window', val, guildId);
}

// Mass mention threshold
function getMassMentionThreshold(guildId) {
  return db.getSetting('automod_massmention_threshold', 5, guildId);
}

function setMassMentionThreshold(val, guildId) {
  db.setSetting('automod_massmention_threshold', val, guildId);
}

// Whitelisted link domains
function getWhitelistedDomains(guildId) {
  const list = db.getSetting('automod_whitelisted_domains', [], guildId);
  return Array.isArray(list) ? list : [];
}

function addWhitelistedDomain(domain, guildId) {
  const list = getWhitelistedDomains(guildId);
  if (list.includes(domain.toLowerCase())) return false;
  list.push(domain.toLowerCase());
  db.setSetting('automod_whitelisted_domains', list, guildId);
  return true;
}

// ─── EXEMPTION CHECK ────────────────────────────────────────────────

function isExempt(message, mod) {
  if (!message.guild) return true;
  if (message.author.bot) return true;

  // Whitelist/owner bypass
  if (whitelist.canBypassProtection(message.author.id)) return true;
  if (message.guild.ownerId === message.author.id) return true;

  // Exempt channels
  if (getExemptChannels(message.guild.id).includes(message.channel.id)) return true;

  // Exempt roles
  const exemptRoles = getExemptRoles(mod, message.guild.id);
  if (message.member && message.member.roles.cache.some(r => exemptRoles.includes(r.id))) return true;

  return false;
}

// ─── PUNISHMENT ─────────────────────────────────────────────────────

async function applyPunishment(message, mod, reason) {
  const punishment = getModulePunishment(mod, message.guild.id);

  try {
    // Always try to delete the offending message
    await message.delete().catch(() => {});

    switch (punishment) {
      case 'warn':
        await message.channel.send({
          content: `<@${message.author.id}> ${reason}`
        }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
        break;

      case 'timeout':
        if (message.member) {
          await message.member.timeout(60000, `AutoMod: ${reason}`).catch(() => {});
        }
        break;

      case 'kick':
        if (message.member) {
          await message.member.kick(`AutoMod: ${reason}`).catch(() => {});
        }
        break;

      case 'delete':
      default:
        // Already deleted above
        break;
    }
  } catch (err) {
    console.error(`[AUTOMOD] Punishment failed for ${mod}:`, err.message);
  }
}

// ─── CHECKS ─────────────────────────────────────────────────────────

function checkAntiLink(message) {
  if (!isModuleEnabled('antilink', message.guild.id)) return false;
  if (isExempt(message, 'antilink')) return false;

  const urlRegex = /https?:\/\/[^\s]+/gi;
  const urls = message.content.match(urlRegex);
  if (!urls) return false;

  // Check against whitelisted domains
  const whitelisted = getWhitelistedDomains(message.guild.id);
  const hasBlocked = urls.some(url => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return !whitelisted.some(d => hostname === d || hostname.endsWith('.' + d));
    } catch {
      return true;
    }
  });

  if (hasBlocked) {
    applyPunishment(message, 'antilink', 'Links are not allowed.');
    return true;
  }
  return false;
}

function checkAntiSpam(message) {
  if (!isModuleEnabled('antispam', message.guild.id)) return false;
  if (isExempt(message, 'antispam')) return false;

  const guildId = message.guild.id;
  const userId = message.author.id;

  if (!spamTracker.has(guildId)) spamTracker.set(guildId, new Map());
  const guildTracker = spamTracker.get(guildId);

  if (!guildTracker.has(userId)) guildTracker.set(userId, []);
  const timestamps = guildTracker.get(userId);

  const now = Date.now();
  const window = getSpamWindow(guildId);
  const threshold = getSpamThreshold(guildId);

  // Clean old entries
  while (timestamps.length > 0 && now - timestamps[0] > window) {
    timestamps.shift();
  }

  timestamps.push(now);

  if (timestamps.length >= threshold) {
    guildTracker.set(userId, []);
    applyPunishment(message, 'antispam', 'Slow down. You are sending messages too fast.');
    return true;
  }
  return false;
}

function checkAntiUpload(message) {
  if (!isModuleEnabled('antiupload', message.guild.id)) return false;
  if (isExempt(message, 'antiupload')) return false;

  if (message.attachments.size > 0) {
    applyPunishment(message, 'antiupload', 'File uploads are not allowed.');
    return true;
  }
  return false;
}

function checkAntiMassMention(message) {
  if (!isModuleEnabled('antimassmention', message.guild.id)) return false;
  if (isExempt(message, 'antimassmention')) return false;

  const threshold = getMassMentionThreshold(message.guild.id);

  if (message.mentions.users.size >= threshold || message.mentions.everyone) {
    applyPunishment(message, 'antimassmention', 'Mass mentions are not allowed.');
    return true;
  }
  return false;
}

function checkAntiBadwords(message) {
  if (!isModuleEnabled('antibadwords', message.guild.id)) return false;
  if (isExempt(message, 'antibadwords')) return false;

  const badwords = getBadwords(message.guild.id);
  if (badwords.length === 0) return false;

  const content = message.content.toLowerCase();
  const found = badwords.some(word => content.includes(word));

  if (found) {
    applyPunishment(message, 'antibadwords', 'Your message contained a blocked word.');
    return true;
  }
  return false;
}

function checkAntiInvite(message) {
  if (!isModuleEnabled('antiinvite', message.guild.id)) return false;
  if (isExempt(message, 'antiinvite')) return false;

  const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/gi;

  if (inviteRegex.test(message.content)) {
    applyPunishment(message, 'antiinvite', 'Discord invites are not allowed.');
    return true;
  }
  return false;
}

// ─── MAIN PROCESSOR ─────────────────────────────────────────────────

function processMessage(message) {
  if (!message.guild) return false;
  if (message.author.bot) return false;

  // Run all checks — stop on first match
  if (checkAntiInvite(message)) return true;
  if (checkAntiLink(message)) return true;
  if (checkAntiBadwords(message)) return true;
  if (checkAntiMassMention(message)) return true;
  if (checkAntiSpam(message)) return true;
  if (checkAntiUpload(message)) return true;

  return false;
}

// ─── STATUS ─────────────────────────────────────────────────────────

function getStatus(guildId) {
  const status = {};
  for (const mod of MODULES) {
    status[mod] = {
      enabled: isModuleEnabled(mod, guildId),
      punishment: getModulePunishment(mod, guildId)
    };
  }
  return status;
}

module.exports = {
  MODULES,
  PUNISHMENTS,
  processMessage,
  isModuleEnabled,
  setModuleEnabled,
  getModulePunishment,
  setModulePunishment,
  addExemptRole,
  removeExemptRole,
  getExemptRoles,
  addExemptChannel,
  removeExemptChannel,
  getExemptChannels,
  getBadwords,
  addBadword,
  removeBadword,
  getSpamThreshold,
  setSpamThreshold,
  getSpamWindow,
  setSpamWindow,
  getMassMentionThreshold,
  setMassMentionThreshold,
  addWhitelistedDomain,
  getWhitelistedDomains,
  getStatus
};
