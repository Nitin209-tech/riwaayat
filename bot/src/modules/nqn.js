// ─── NQN EMOJI SYSTEM ───────────────────────────────────────────────
// Detects :emoji_name: patterns in messages and resends via webhook
// with the user's avatar and display name, supporting cross-server emojis.

const { WebhookClient } = require('discord.js');
const db = require('../database');

// Webhook cache per channel to avoid repeated creation
const webhookCache = new Map();

function isNqnEnabled(guildId) {
  return db.getSetting('nqnEnabled', false, guildId);
}

function setNqnEnabled(enabled, guildId) {
  db.setSetting('nqnEnabled', enabled, guildId);
}

// Find emoji across all guilds the bot is in
function findEmoji(client, emojiName) {
  // Search all guilds the bot shares
  for (const guild of client.guilds.cache.values()) {
    const emoji = guild.emojis.cache.find(e => e.name.toLowerCase() === emojiName.toLowerCase());
    if (emoji) return emoji;
  }
  return null;
}

// Find emoji by ID (for out-of-server emoji support)
function findEmojiById(client, emojiId) {
  for (const guild of client.guilds.cache.values()) {
    const emoji = guild.emojis.cache.get(emojiId);
    if (emoji) return emoji;
  }
  return null;
}

// Get or create a webhook for the given channel
async function getWebhook(channel) {
  const cached = webhookCache.get(channel.id);
  if (cached) {
    try {
      // Verify webhook is still valid
      await cached.send({ content: 'test', flags: 64 }).catch(() => {});
      return cached;
    } catch {
      webhookCache.delete(channel.id);
    }
  }

  try {
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.owner?.id === channel.client.user.id && wh.name === 'NQN Emoji');

    if (!webhook) {
      webhook = await channel.createWebhook({
        name: 'NQN Emoji',
        reason: 'NQN emoji system webhook'
      });
    }

    const whClient = new WebhookClient({ id: webhook.id, token: webhook.token });
    webhookCache.set(channel.id, whClient);
    return whClient;
  } catch (err) {
    console.error('[NQN] Failed to get/create webhook:', err.message);
    return null;
  }
}

// Process a message for emoji replacement
async function processMessage(message) {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!isNqnEnabled(message.guild.id)) return;

  // Match :emoji_name: patterns (not already wrapped in <> which means it's a real Discord emoji)
  const emojiRegex = /(?<!<a?):([a-zA-Z0-9_]{2,32}):(?!\d+>)/g;
  const matches = [...message.content.matchAll(emojiRegex)];

  if (matches.length === 0) return;

  let newContent = message.content;
  let hasReplacements = false;

  for (const match of matches) {
    const emojiName = match[1];
    const emoji = findEmoji(message.client, emojiName);

    if (emoji) {
      const emojiString = emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
      newContent = newContent.replace(match[0], emojiString);
      hasReplacements = true;
    }
  }

  if (!hasReplacements) return;

  // Delete original message
  try {
    await message.delete();
  } catch (err) {
    console.error('[NQN] Failed to delete original message:', err.message);
    return; // Don't send webhook if we can't delete original
  }

  // Send via webhook with same username and avatar
  const webhook = await getWebhook(message.channel);
  if (!webhook) return;

  try {
    const member = message.member;
    await webhook.send({
      content: newContent,
      username: member?.displayName || message.author.displayName || message.author.username,
      avatarURL: message.author.displayAvatarURL({ dynamic: true, size: 256 }),
      allowedMentions: { parse: [] } // Prevent mention abuse through NQN
    });
  } catch (err) {
    console.error('[NQN] Failed to send webhook message:', err.message);
  }
}

// Cleanup webhook cache entry when channel is deleted
function cleanupChannel(channelId) {
  const cached = webhookCache.get(channelId);
  if (cached) {
    cached.destroy();
    webhookCache.delete(channelId);
  }
}

module.exports = {
  processMessage,
  cleanupChannel,
  isNqnEnabled,
  setNqnEnabled,
  findEmoji,
  findEmojiById
};
