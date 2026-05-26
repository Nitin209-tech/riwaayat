// ─── ANTI-NUKE PROTECTION SYSTEM (OLYMPUS-STYLE) ────────────────────
// Tracks destructive actions per user with rolling time windows.
// Only permanent whitelist / extra owners can bypass protection.

const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const db = require('../database');
const whitelist = require('./whitelist');

// In-memory action counters: Map<guildId, Map<userId, { action: string, timestamps: number[] }[]>>
const actionCounters = new Map();

// All protected action types
const PROTECTED_ACTIONS = [
  'channelCreate', 'channelDelete',
  'roleCreate', 'roleDelete',
  'webhookCreate',
  'emojiCreate', 'emojiDelete',
  'ban', 'kick',
  'botAdd',
  'timeout',
  'massMention',
  'permissionEdit',
  'vanityEdit',
  'serverUpdate'
];

const DEFAULT_THRESHOLD = 3;
const DEFAULT_WINDOW = 10000; // 10 seconds
const DEFAULT_PUNISHMENT = 'stripAndBan'; // stripAndBan | strip | ban | kick

// ─── SETTINGS ───────────────────────────────────────────────────────

function isAntiNukeEnabled(guildId) {
  return db.getSetting('antinukeEnabled', false, guildId);
}

function setAntiNukeEnabled(enabled, guildId) {
  db.setSetting('antinukeEnabled', enabled, guildId);
}

function isActionProtected(action, guildId) {
  return db.getSetting(`antinuke_${action}`, true, guildId);
}

function setActionProtected(action, enabled, guildId) {
  db.setSetting(`antinuke_${action}`, enabled, guildId);
}

function getThreshold(guildId) {
  return db.getSetting('antinukeThreshold', DEFAULT_THRESHOLD, guildId);
}

function setThreshold(val, guildId) {
  db.setSetting('antinukeThreshold', val, guildId);
}

function getWindow(guildId) {
  return db.getSetting('antinukeWindow', DEFAULT_WINDOW, guildId);
}

function getPunishment(guildId) {
  return db.getSetting('antinukePunishment', DEFAULT_PUNISHMENT, guildId);
}

function setPunishment(val, guildId) {
  db.setSetting('antinukePunishment', val, guildId);
}

function getLogChannel(guildId) {
  return db.getSetting('antinukeLogChannel', null, guildId);
}

function setLogChannel(channelId, guildId) {
  db.setSetting('antinukeLogChannel', channelId, guildId);
}

// ─── ACTION TRACKING ────────────────────────────────────────────────

function recordAction(guildId, userId, action) {
  if (!actionCounters.has(guildId)) {
    actionCounters.set(guildId, new Map());
  }
  const guildMap = actionCounters.get(guildId);

  if (!guildMap.has(userId)) {
    guildMap.set(userId, {});
  }
  const userActions = guildMap.get(userId);

  if (!userActions[action]) {
    userActions[action] = [];
  }

  const now = Date.now();
  userActions[action].push(now);

  // Clean old timestamps outside window
  const window = getWindow(guildId);
  userActions[action] = userActions[action].filter(t => now - t < window);

  return userActions[action].length;
}

function getActionCount(guildId, userId, action) {
  const guildMap = actionCounters.get(guildId);
  if (!guildMap) return 0;
  const userActions = guildMap.get(userId);
  if (!userActions || !userActions[action]) return 0;

  const now = Date.now();
  const window = getWindow(guildId);
  userActions[action] = userActions[action].filter(t => now - t < window);
  return userActions[action].length;
}

function clearActions(guildId, userId) {
  const guildMap = actionCounters.get(guildId);
  if (guildMap) guildMap.delete(userId);
}

// ─── PUNISHMENT ─────────────────────────────────────────────────────

async function punishUser(guild, userId, action, client) {
  const punishment = getPunishment(guild.id);
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  // Don't punish guild owner
  if (guild.ownerId === userId) return;

  const logChannelId = getLogChannel(guild.id);
  let logChannel = null;
  if (logChannelId) {
    logChannel = guild.channels.cache.get(logChannelId);
  }

  const logMsg = `**[ANTI-NUKE]** User <@${userId}> triggered \`${action}\` protection. Punishment: \`${punishment}\``;

  try {
    if (punishment === 'strip' || punishment === 'stripAndBan') {
      // Remove all roles
      const roles = member.roles.cache.filter(r => r.id !== guild.id);
      for (const [, role] of roles) {
        try {
          await member.roles.remove(role, 'Anti-Nuke: Suspicious activity detected');
        } catch {}
      }
    }

    if (punishment === 'ban' || punishment === 'stripAndBan') {
      await guild.members.ban(userId, {
        reason: `Anti-Nuke: Exceeded ${action} threshold`,
        deleteMessageSeconds: 0
      }).catch(() => {});
    }

    if (punishment === 'kick') {
      await member.kick('Anti-Nuke: Suspicious activity detected').catch(() => {});
    }

    if (logChannel) {
      await logChannel.send(logMsg).catch(() => {});
    }

    console.log(`[ANTI-NUKE] Punished ${member.user.tag} in ${guild.name} for ${action}`);
  } catch (err) {
    console.error(`[ANTI-NUKE] Failed to punish ${userId}:`, err.message);
  }

  // Clear their action counters
  clearActions(guild.id, userId);
}

// ─── MAIN CHECK FUNCTION ────────────────────────────────────────────
// Call this from event handlers. Returns true if action was blocked.

async function checkAction(guild, userId, action, client) {
  if (!isAntiNukeEnabled(guild.id)) return false;
  if (!isActionProtected(action, guild.id)) return false;

  // Bot itself always bypasses
  if (client && client.user && userId === client.user.id) return false;

  // Only permanent whitelist and extra owners bypass
  if (whitelist.canBypassProtection(userId)) return false;

  // Guild owner always bypasses
  if (guild.ownerId === userId) return false;

  const count = recordAction(guild.id, userId, action);
  const threshold = getThreshold(guild.id);

  if (count >= threshold) {
    await punishUser(guild, userId, action, client);
    return true; // Action was blocked/punished
  }

  return false;
}

// ─── AUDIT LOG HELPER ───────────────────────────────────────────────
// Fetches the most recent audit log entry for a given action type

async function getAuditExecutor(guild, auditType) {
  try {
    const auditLogs = await guild.fetchAuditLogs({ type: auditType, limit: 1 });
    const entry = auditLogs.entries.first();
    if (entry && (Date.now() - entry.createdTimestamp < 5000)) {
      return entry.executor?.id || null;
    }
  } catch {}
  return null;
}

// ─── EVENT HANDLERS ─────────────────────────────────────────────────

async function onChannelCreate(channel) {
  if (!channel.guild) return;
  const executorId = await getAuditExecutor(channel.guild, AuditLogEvent.ChannelCreate);
  if (executorId) {
    const blocked = await checkAction(channel.guild, executorId, 'channelCreate', channel.client);
    if (blocked) {
      try { await channel.delete('Anti-Nuke: Reverted unauthorized channel creation'); } catch {}
    }
  }
}

async function onChannelDelete(channel) {
  if (!channel.guild) return;
  const executorId = await getAuditExecutor(channel.guild, AuditLogEvent.ChannelDelete);
  if (executorId) {
    await checkAction(channel.guild, executorId, 'channelDelete', channel.client);
  }
}

async function onRoleCreate(role) {
  const executorId = await getAuditExecutor(role.guild, AuditLogEvent.RoleCreate);
  if (executorId) {
    const blocked = await checkAction(role.guild, executorId, 'roleCreate', role.client);
    if (blocked) {
      try { await role.delete('Anti-Nuke: Reverted unauthorized role creation'); } catch {}
    }
  }
}

async function onRoleDelete(role) {
  const executorId = await getAuditExecutor(role.guild, AuditLogEvent.RoleDelete);
  if (executorId) {
    await checkAction(role.guild, executorId, 'roleDelete', role.client);
  }
}

async function onGuildBanAdd(ban) {
  const executorId = await getAuditExecutor(ban.guild, AuditLogEvent.MemberBanAdd);
  if (executorId) {
    const blocked = await checkAction(ban.guild, executorId, 'ban', ban.client);
    if (blocked) {
      try { await ban.guild.members.unban(ban.user.id, 'Anti-Nuke: Reverted unauthorized ban'); } catch {}
    }
  }
}

async function onGuildMemberRemove(member) {
  // Check if it was a kick (not a leave)
  const executorId = await getAuditExecutor(member.guild, AuditLogEvent.MemberKick);
  if (executorId && executorId !== member.id) {
    await checkAction(member.guild, executorId, 'kick', member.client);
  }
}

async function onWebhookUpdate(channel) {
  if (!channel.guild) return;
  const executorId = await getAuditExecutor(channel.guild, AuditLogEvent.WebhookCreate);
  if (executorId) {
    await checkAction(channel.guild, executorId, 'webhookCreate', channel.client);
  }
}

async function onEmojiCreate(emoji) {
  const executorId = await getAuditExecutor(emoji.guild, AuditLogEvent.EmojiCreate);
  if (executorId) {
    const blocked = await checkAction(emoji.guild, executorId, 'emojiCreate', emoji.client);
    if (blocked) {
      try { await emoji.delete('Anti-Nuke: Reverted unauthorized emoji creation'); } catch {}
    }
  }
}

async function onEmojiDelete(emoji) {
  const executorId = await getAuditExecutor(emoji.guild, AuditLogEvent.EmojiDelete);
  if (executorId) {
    await checkAction(emoji.guild, executorId, 'emojiDelete', emoji.client);
  }
}

async function onGuildMemberAdd(member) {
  // Detect bot additions
  if (member.user.bot) {
    const executorId = await getAuditExecutor(member.guild, AuditLogEvent.BotAdd);
    if (executorId) {
      const blocked = await checkAction(member.guild, executorId, 'botAdd', member.client);
      if (blocked) {
        try { await member.kick('Anti-Nuke: Unauthorized bot addition'); } catch {}
      }
    }
  }
}

async function onGuildMemberUpdate(oldMember, newMember) {
  // Check for timeout abuse
  if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
    const executorId = await getAuditExecutor(newMember.guild, AuditLogEvent.MemberUpdate);
    if (executorId) {
      await checkAction(newMember.guild, executorId, 'timeout', newMember.client);
    }
  }
}

async function onRoleUpdate(oldRole, newRole) {
  // Check for permission edits
  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
    const executorId = await getAuditExecutor(newRole.guild, AuditLogEvent.RoleUpdate);
    if (executorId) {
      await checkAction(newRole.guild, executorId, 'permissionEdit', newRole.client);
    }
  }
}

async function onGuildUpdate(oldGuild, newGuild) {
  // Check vanity URL changes
  if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
    const executorId = await getAuditExecutor(newGuild, AuditLogEvent.GuildUpdate);
    if (executorId) {
      await checkAction(newGuild, executorId, 'vanityEdit', newGuild.client);
    }
  }

  // General server update protection
  const executorId = await getAuditExecutor(newGuild, AuditLogEvent.GuildUpdate);
  if (executorId) {
    await checkAction(newGuild, executorId, 'serverUpdate', newGuild.client);
  }
}

// Mass mention check — call from messageCreate
async function checkMassMention(message) {
  if (!message.guild) return false;
  if (!isAntiNukeEnabled(message.guild.id)) return false;
  if (!isActionProtected('massMention', message.guild.id)) return false;
  if (whitelist.canBypassProtection(message.author.id)) return false;
  if (message.guild.ownerId === message.author.id) return false;

  const mentionThreshold = db.getSetting('antinukeMassMentionThreshold', 5, message.guild.id);

  if (message.mentions.users.size >= mentionThreshold || message.mentions.everyone) {
    const count = recordAction(message.guild.id, message.author.id, 'massMention');
    const threshold = getThreshold(message.guild.id);

    try { await message.delete(); } catch {}

    if (count >= threshold) {
      await punishUser(message.guild, message.author.id, 'massMention', message.client);
      return true;
    }
  }

  return false;
}

// ─── STATUS REPORT ──────────────────────────────────────────────────

function getStatus(guildId) {
  const enabled = isAntiNukeEnabled(guildId);
  const threshold = getThreshold(guildId);
  const punishment = getPunishment(guildId);
  const logChannel = getLogChannel(guildId);

  const actions = {};
  for (const action of PROTECTED_ACTIONS) {
    actions[action] = isActionProtected(action, guildId);
  }

  return { enabled, threshold, punishment, logChannel, actions };
}

module.exports = {
  PROTECTED_ACTIONS,
  isAntiNukeEnabled,
  setAntiNukeEnabled,
  isActionProtected,
  setActionProtected,
  getThreshold,
  setThreshold,
  getPunishment,
  setPunishment,
  getLogChannel,
  setLogChannel,
  checkAction,
  checkMassMention,
  getStatus,
  // Event handlers
  onChannelCreate,
  onChannelDelete,
  onRoleCreate,
  onRoleDelete,
  onGuildBanAdd,
  onGuildMemberRemove,
  onGuildMemberAdd,
  onGuildMemberUpdate,
  onWebhookUpdate,
  onEmojiCreate,
  onEmojiDelete,
  onRoleUpdate,
  onGuildUpdate
};
