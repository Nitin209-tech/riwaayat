// ─── ANTI-BETRAY PROTECTION SYSTEM ──────────────────────────────────
// Monitors trusted/whitelisted users for unexpected permission escalation
// or suspicious bulk actions that indicate betrayal.

const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const db = require('../database');
const whitelist = require('./whitelist');

// Dangerous permissions that should trigger alerts
const DANGEROUS_PERMS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageWebhooks
];

// ─── SETTINGS ───────────────────────────────────────────────────────

function isAntiBetrayEnabled(guildId) {
  return db.getSetting('antibetrayEnabled', false, guildId);
}

function setAntiBetrayEnabled(enabled, guildId) {
  db.setSetting('antibetrayEnabled', enabled, guildId);
}

function getLogChannel(guildId) {
  return db.getSetting('antibetrayLogChannel', null, guildId);
}

function setLogChannel(channelId, guildId) {
  db.setSetting('antibetrayLogChannel', channelId, guildId);
}

// ─── DETECTION ──────────────────────────────────────────────────────

// Check if a member gained dangerous permissions
function checkPermissionGain(oldMember, newMember) {
  const oldPerms = oldMember.permissions.bitfield;
  const newPerms = newMember.permissions.bitfield;

  const gained = [];
  for (const perm of DANGEROUS_PERMS) {
    if (!(oldPerms & perm) && (newPerms & perm)) {
      gained.push(perm);
    }
  }

  return gained;
}

// Map permission bitfield to readable name
function permissionName(perm) {
  const names = {
    [PermissionFlagsBits.Administrator]: 'Administrator',
    [PermissionFlagsBits.ManageGuild]: 'Manage Server',
    [PermissionFlagsBits.ManageRoles]: 'Manage Roles',
    [PermissionFlagsBits.ManageChannels]: 'Manage Channels',
    [PermissionFlagsBits.BanMembers]: 'Ban Members',
    [PermissionFlagsBits.KickMembers]: 'Kick Members',
    [PermissionFlagsBits.ManageWebhooks]: 'Manage Webhooks'
  };
  return names[perm] || 'Unknown';
}

// ─── EVENT HANDLER ──────────────────────────────────────────────────

async function onGuildMemberUpdate(oldMember, newMember) {
  if (!isAntiBetrayEnabled(newMember.guild.id)) return;

  // Only monitor whitelisted / trusted users
  const userId = newMember.id;
  const isTracked = whitelist.isWhitelisted(userId, newMember.guild.id);
  if (!isTracked) return;

  // Master controller and guild owner are exempt
  if (whitelist.isMasterController(userId)) return;
  if (newMember.guild.ownerId === userId) return;

  const gained = checkPermissionGain(oldMember, newMember);
  if (gained.length === 0) return;

  const gainedNames = gained.map(p => permissionName(p)).join(', ');

  // Try to find who gave the permissions
  let executor = 'Unknown';
  try {
    const auditLogs = await newMember.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberRoleUpdate,
      limit: 1
    });
    const entry = auditLogs.entries.first();
    if (entry && entry.target?.id === userId && (Date.now() - entry.createdTimestamp < 5000)) {
      executor = `<@${entry.executor.id}>`;
    }
  } catch {}

  // Send alert to log channel
  const logChannelId = getLogChannel(newMember.guild.id);
  if (logChannelId) {
    const logChannel = newMember.guild.channels.cache.get(logChannelId);
    if (logChannel) {
      await logChannel.send({
        content: `**[ANTI-BETRAY]** Trusted user <@${userId}> gained dangerous permissions.\n` +
          `**Permissions Gained:** ${gainedNames}\n` +
          `**Granted By:** ${executor}\n` +
          `**Action:** Review immediately. If unauthorized, strip permissions.`
      }).catch(() => {});
    }
  }

  console.log(`[ANTI-BETRAY] ${newMember.user.tag} gained: ${gainedNames} in ${newMember.guild.name}`);
}

// Monitor role updates for dangerous permission additions
async function onRoleUpdate(oldRole, newRole) {
  if (!isAntiBetrayEnabled(newRole.guild.id)) return;

  const gained = [];
  for (const perm of DANGEROUS_PERMS) {
    if (!(oldRole.permissions.bitfield & perm) && (newRole.permissions.bitfield & perm)) {
      gained.push(perm);
    }
  }

  if (gained.length === 0) return;

  // Check if any whitelisted users have this role
  const members = newRole.members;
  const affectedWhitelisted = members.filter(m =>
    whitelist.isWhitelisted(m.id, newRole.guild.id) &&
    !whitelist.isMasterController(m.id) &&
    m.id !== newRole.guild.ownerId
  );

  if (affectedWhitelisted.size === 0) return;

  const gainedNames = gained.map(p => permissionName(p)).join(', ');
  const affectedList = affectedWhitelisted.map(m => `<@${m.id}>`).join(', ');

  let executor = 'Unknown';
  try {
    const auditLogs = await newRole.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleUpdate,
      limit: 1
    });
    const entry = auditLogs.entries.first();
    if (entry && (Date.now() - entry.createdTimestamp < 5000)) {
      executor = `<@${entry.executor.id}>`;
    }
  } catch {}

  const logChannelId = getLogChannel(newRole.guild.id);
  if (logChannelId) {
    const logChannel = newRole.guild.channels.cache.get(logChannelId);
    if (logChannel) {
      await logChannel.send({
        content: `**[ANTI-BETRAY]** Role \`${newRole.name}\` gained dangerous permissions.\n` +
          `**Permissions Added:** ${gainedNames}\n` +
          `**Modified By:** ${executor}\n` +
          `**Affected Trusted Users:** ${affectedList}\n` +
          `**Action:** Review immediately.`
      }).catch(() => {});
    }
  }
}

module.exports = {
  isAntiBetrayEnabled,
  setAntiBetrayEnabled,
  getLogChannel,
  setLogChannel,
  onGuildMemberUpdate,
  onRoleUpdate
};
