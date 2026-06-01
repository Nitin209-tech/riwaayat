const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const { Client, GatewayIntentBits, Partials, ActivityType, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ChannelType, PermissionFlagsBits, REST, Routes, SlashCommandBuilder, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
require('dotenv').config();
const db = require('./database');
const { decrypt } = require('./utils/encryption');
const { REWARDS, getRewardById, getRewardByCategory, emojiStr } = require('./rewards');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const whitelistModule = require('./modules/whitelist');
const nqnModule = require('./modules/nqn');
const antinukeModule = require('./modules/antinuke');
const antibetrayModule = require('./modules/antibetray');
const automodModule = require('./modules/automod');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

// ─── DIRECT DATABASE (POSTGRESQL) POOL CONNECTION ───────────────────
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

function getComponentImage(guildId, defaultUrl) {
  if (guildId === '1507448300008112179') {
    return 'https://cdn.discordapp.com/attachments/1508016269507563531/1508057501222961213/ChatGPT_Image_May_24_2026_01_18_34_AM.png?ex=6a14277e&is=6a12d5fe&hm=218ef2222c227533503d34519c066de6e0a00b439a940fa96124d586b4ea4709';
  }
  return defaultUrl;
}

// Global Map to track pending legit/vouch timeouts for ticket channels
const pendingVouches = new Map();

// Global Map to track pending 30-second ticket auto-close timeouts
const ticketCloseTimeouts = new Map();

// Helper to schedule a warning DM if a claimant doesn't vouch in 2 minutes
function startLegitTimeout(channelId, user, rewardLabel) {
  if (pendingVouches.has(channelId)) {
    clearTimeout(pendingVouches.get(channelId).timeout);
  }
  
  const timeout = setTimeout(async () => {
    if (!pendingVouches.has(channelId)) return;
    pendingVouches.delete(channelId);
    
    try {
      const warningContent = 
`⚠️ **LEGIT VERIFICATION PENDING!** ⚠️

Hello **${user.username}**, your recent claim for **${rewardLabel}** is successful, but your vouch verification is still **PENDING**! 😭

👉 **Please type "legit" or "working" in your ticket channel <#${channelId}> immediately!**
🛑 *If you do not complete this quick vouch verification within the next few minutes, your reward code/link processing will be suspended and hold locks will be applied.*

Thank you for verifying your claim! 🛡️✨`;
      await user.send({ content: warningContent });
      console.log(`[VOUCH_WARNING] Sent pending vouch warning DM to @${user.username}`);
    } catch (err) {
      console.warn(`[VOUCH_WARNING_FAILED] Could not send DM to @${user.username}:`, err.message);
    }
  }, 120000); // 2 minutes
  
  pendingVouches.set(channelId, { userId: user.id, timeout });
}

// Override db.saveDB to automatically write all updates to PostgreSQL as a backup
const originalSaveDB = db.saveDB;
db.saveDB = (data) => {
  originalSaveDB(data);
  pool.query(
    'INSERT INTO "_bot_backup" ("key", "data") VALUES (\'database\', $1) ON CONFLICT ("key") DO UPDATE SET "data" = $1',
    [JSON.stringify(data)]
  ).catch(err => console.error('[BACKUP] Failed to write database backup to Postgres:', err.message));
};

async function checkDirectDBHealth() {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1 as test');
      return { database: 'ONLINE', error: null };
    } finally {
      client.release();
    }
  } catch (err) {
    return { database: 'OFFLINE', error: err.message };
  }
}

async function pullRedemptionsDirectly() {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT * FROM "RedeemHistory" ORDER BY "claimedAt" DESC LIMIT 10');
      return res.rows;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Direct PostgreSQL pull failed:', err);
    throw err;
  }
}

// ─── STABLE HTTPS/HTTP SYNC BRIDGE ──────────────────────────────────
async function syncCodeToBackend(code, category) {
  // 1. Try Direct PostgreSQL sync first (most reliable, bypasses cloud NAT loopback/DNS issues)
  try {
    const client = await pool.connect();
    try {
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

      // Check if Reward exists
      const rewardRes = await client.query('SELECT id FROM "Reward" WHERE category = $1 LIMIT 1', [dbCategory]);
      let rewardId;
      if (rewardRes.rows.length > 0) {
        rewardId = rewardRes.rows[0].id;
      } else {
        const rId = require('crypto').randomUUID ? require('crypto').randomUUID() : require('crypto').randomBytes(16).toString('hex');
        const newRewardRes = await client.query(
          `INSERT INTO "Reward" (id, category, name, description, "inrPrice", "coinsCost", stock, "maxStock", "imageUrl", "isActive") 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [
            rId,
            dbCategory,
            `${dbCategory.charAt(0) + dbCategory.slice(1).toLowerCase()} Premium Package`,
            `Automatically created reward catalog package for ${dbCategory}`,
            'Rs.999',
            1000,
            100,
            500,
            'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?q=80&w=300',
            true
          ]
        );
        rewardId = newRewardRes.rows[0].id;
      }

      // Encrypt the code payload exactly like the backend
      const ALGORITHM = 'aes-256-gcm';
      const SECRET_KEY = Buffer.from(
        (process.env.ENCRYPTION_SECRET || 'cyber-riwaayat-premium-security-secret-key-32-change-me').substring(0, 32),
        'utf-8'
      );
      
      const iv = require('crypto').randomBytes(12);
      const cipher = require('crypto').createCipheriv(ALGORITHM, SECRET_KEY, iv);
      let encrypted = cipher.update(code, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');
      const encryptedPayload = `${iv.toString('hex')}:${encrypted}:${tag}`;

      // Create or update RedeemCode record
      const formattedCode = code.toUpperCase().trim();
      const existingCodeRes = await client.query('SELECT id FROM "RedeemCode" WHERE code = $1 LIMIT 1', [formattedCode]);
      if (existingCodeRes.rows.length > 0) {
        await client.query(
          'UPDATE "RedeemCode" SET "rewardId" = $1, "encryptedPayload" = $2, "usedCount" = 0 WHERE id = $3',
          [rewardId, encryptedPayload, existingCodeRes.rows[0].id]
        );
      } else {
        const cId = require('crypto').randomUUID ? require('crypto').randomUUID() : require('crypto').randomBytes(16).toString('hex');
        await client.query(
          `INSERT INTO "RedeemCode" (id, "rewardId", code, "encryptedPayload", "maxUses", "usedCount", "createdAt") 
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [cId, rewardId, formattedCode, encryptedPayload, 1, 0]
        );
      }

      console.log(`[DATABASE_SYNC_SUCCESS] Synchronized code ${formattedCode} directly via PostgreSQL.`);
      return; // Success, we are done!
    } finally {
      client.release();
    }
  } catch (dbErr) {
    console.error(`[DATABASE_SYNC_FAILED] Direct PostgreSQL sync failed: ${dbErr.message}. Falling back to HTTP sync...`);
  }

  // 2. HTTP Fallback Bridge
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
  let url;
  try {
    url = new URL(`${BACKEND_URL}/api/rewards/sync-bot-code`);
  } catch (e) {
    console.error(`[SYNC_CRASH] Invalid BACKEND_URL format: ${BACKEND_URL}`);
    return;
  }
  
  const payload = JSON.stringify({ code, category });
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'x-bot-token': BOT_TOKEN
    }
  };

  const httpLib = url.protocol === 'https:' ? https : http;
  
  const req = httpLib.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.success) {
          console.log(`[SYNC_SUCCESS] Synchronized code ${code} securely to database via HTTP fallback.`);
        } else {
          console.error(`[SYNC_FAILED] Sync fallback returned error:`, parsed.error);
        }
      } catch (e) {
        console.error(`[SYNC_ERROR] Response parsing crashed:`, data);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[SYNC_CRASH] HTTP sync transport failed completely:`, err.message);
  });

  req.write(payload);
  req.end();
}

// ─── STABLE HTTPS/HTTP REDEMPTIONS PULLER ───────────────────────────
function pullRedemptionsFromBackend() {
  return new Promise((resolve, reject) => {
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
    let url;
    try {
      url = new URL(`${BACKEND_URL}/api/rewards/pull-redemptions`);
    } catch (e) {
      return reject(new Error(`Invalid BACKEND_URL: ${BACKEND_URL}`));
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'x-bot-token': BOT_TOKEN
      }
    };

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success) {
            resolve(parsed.redemptions || []);
          } else {
            reject(new Error(parsed.error || 'Server error pulling redemptions.'));
          }
        } catch (e) {
          reject(new Error('Failed to parse redemptions payload.'));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

// ─── STABLE HTTPS/HTTP HEALTH CHECKER ───────────────────────────────
function checkHealthFromBackend() {
  return new Promise((resolve) => {
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
    let url;
    try {
      url = new URL(`${BACKEND_URL}/health`);
    } catch (e) {
      return resolve({ status: 'DOWN', database: 'OFFLINE', error: 'Invalid BACKEND_URL' });
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'GET'
    };

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ status: 'DOWN', database: 'OFFLINE', error: 'Failed to parse health check response.' });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ status: 'DOWN', database: 'OFFLINE', error: err.message });
    });

    req.end();
  });
}

// ─── GREET & WELCOME TELEMETRY DISPATCHER ───────────────────────────
async function triggerWelcomeAndGreets(member, inviterUser, inviterInvites) {
  // 1. Permanent Welcome Message
  const welcomeChannelId = db.getSetting('welcomeChannel', null, member.guild.id);
  if (welcomeChannelId) {
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId) || await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
    if (welcomeChannel) {
      let rawMsg = db.getSetting('welcomeMessage', null, member.guild.id);
      if (!rawMsg || typeof rawMsg !== 'string' || !rawMsg.trim()) {
        rawMsg = '<a:emoji_25:1504806993280503810> {user} **Joined;** Invited by **{inviter}** **( {invites} invites )** <a:love:1504576577839829204>';
      }
      const inviterText = inviterUser ? `@${inviterUser.username}` : 'Direct Join';

      const formatted = rawMsg
        .replace(/{user}/g, `${member}`)
        .replace(/{username}/g, member.user.username)
        .replace(/{inviter}/g, inviterText)
        .replace(/{invites}/g, inviterInvites.toString());

      await welcomeChannel.send({ content: formatted }).catch(err => console.error('[WELCOME_SEND_ERROR]', err.message));
    }
  }

  // 2. 5-Second Self-Deleting Greet Messages in Multiple Channels
  const greetChannels = db.getSetting('greetChannels', [], member.guild.id);
  if (Array.isArray(greetChannels) && greetChannels.length > 0) {
    let rawGreetMsg = db.getSetting('greetMessage', null, member.guild.id);
    if (!rawGreetMsg || typeof rawGreetMsg !== 'string' || !rawGreetMsg.trim()) {
      rawGreetMsg = '⚡ Welcome {user}! You were invited by {inviter}.';
    }
    const inviterText = inviterUser ? `@${inviterUser.username}` : 'Direct Join';

    const formattedGreet = rawGreetMsg
      .replace(/{user}/g, `${member}`)
      .replace(/{username}/g, member.user.username)
      .replace(/{inviter}/g, inviterText)
      .replace(/{invites}/g, inviterInvites.toString());

    for (const channelId of greetChannels) {
      const greetChannel = member.guild.channels.cache.get(channelId) || await member.guild.channels.fetch(channelId).catch(() => null);
      if (greetChannel) {
        greetChannel.send({ content: formattedGreet })
          .then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 5000);
          })
          .catch(err => console.error('[GREET_SEND_ERROR]', err.message));
      }
    }
  }
}

function getPaymentChannel(guild) {
  const configuredId = db.getSetting('paymentChannelId', null, guild.id);
  if (configuredId) {
    const channel = guild.channels.cache.get(configuredId);
    if (channel) return channel;
  }
  const fallbackNames = ['proof', 'proofs', 'payment', 'payments', 'payout', 'payouts'];
  const channel = guild.channels.cache.find(c => 
    fallbackNames.includes(c.name.toLowerCase()) && c.type === ChannelType.GuildText
  );
  return channel;
}

// ─── SLASH COMMAND DEFINITIONS ─────────────────────────────────────
const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Show all bot commands'),
  new SlashCommandBuilder().setName('invites').setDescription('Check your invite count'),
  new SlashCommandBuilder().setName('claim').setDescription('Claim a reward using your invites'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('View top inviters'),
  new SlashCommandBuilder().setName('panel')
    .setDescription('Unified Control Center & Admin Panel (Admin only)'),
  new SlashCommandBuilder().setName('sendfreegiftevent')
    .setDescription('Post the free gift event dropdown panel (Admin only)'),
  new SlashCommandBuilder().setName('sendticketpanel')
    .setDescription('Post the ticket creation panel (Admin only)'),
  new SlashCommandBuilder().setName('stock')
    .setDescription('Manage reward stock (Admin only)')
    .addSubcommand(sub => sub.setName('add')
      .setDescription('Add a code to stock')
      .addStringOption(opt => opt.setName('category').setDescription('Reward category')
        .setRequired(true)
        .addChoices(
          { name: '⛏ Minecraft Account (Credentials)', value: 'MINECRAFT_ACC' },
          { name: '⛏ MC Redeem Code', value: 'MINECRAFT_CODE' },
          { name: '💎 Nitro Basic', value: 'NITRO_BASIC' },
          { name: '🚀 Nitro Boost', value: 'NITRO_BOOST' },
          { name: '📺 YT 10K Subs', value: 'YT_10K' },
          { name: '📺 YT 30K Subs', value: 'YT_30K' },
          { name: '🎮 Roblox $50', value: 'ROBUX_50' },
          { name: '🎮 Roblox $100', value: 'ROBUX_100' },
          { name: '🔴 Valorant 2500 VP', value: 'VALORANT_2500' },
          { name: '🔥 Valorant 5000 VP', value: 'VALORANT_5000' },
          { name: '💎 Nitro Basic (1 Month)', value: 'NITRO_BASIC_1M' },
          { name: '🚀 Nitro Boost (1 Month)', value: 'NITRO_BOOST_1M' },
          { name: '💎 Nitro Basic (1 Year)', value: 'NITRO_BASIC_1Y' },
          { name: '🚀 Nitro Boost (1 Year)', value: 'NITRO_BOOST_1Y' },
          { name: '🎮 Roblox 450 Robux', value: 'ROBUX_450' },
          { name: '🎮 Roblox 1500 Robux', value: 'ROBUX_1500' },
          { name: '🎮 Roblox 4500 Robux', value: 'ROBUX_4500' }
        ))
      .addStringOption(opt => opt.setName('code').setDescription('The reward code/key').setRequired(true)))
    .addSubcommand(sub => sub.setName('generate')
      .setDescription('Auto-generate codes for stock')
      .addStringOption(opt => opt.setName('category').setDescription('Reward category')
        .setRequired(true)
        .addChoices(
          { name: '⛏ Minecraft Account (Credentials)', value: 'MINECRAFT_ACC' },
          { name: '⛏ MC Redeem Code', value: 'MINECRAFT_CODE' },
          { name: '💎 Nitro Basic', value: 'NITRO_BASIC' },
          { name: '🚀 Nitro Boost', value: 'NITRO_BOOST' },
          { name: '📺 YT 10K Subs', value: 'YT_10K' },
          { name: '📺 YT 30K Subs', value: 'YT_30K' },
          { name: '🎮 Roblox $50', value: 'ROBUX_50' },
          { name: '🎮 Roblox $100', value: 'ROBUX_100' },
          { name: '🔴 Valorant 2500 VP', value: 'VALORANT_2500' },
          { name: '🔥 Valorant 5000 VP', value: 'VALORANT_5000' },
          { name: '💎 Nitro Basic (1 Month)', value: 'NITRO_BASIC_1M' },
          { name: '🚀 Nitro Boost (1 Month)', value: 'NITRO_BOOST_1M' },
          { name: '💎 Nitro Basic (1 Year)', value: 'NITRO_BASIC_1Y' },
          { name: '🚀 Nitro Boost (1 Year)', value: 'NITRO_BOOST_1Y' },
          { name: '🎮 Roblox 450 Robux', value: 'ROBUX_450' },
          { name: '🎮 Roblox 1500 Robux', value: 'ROBUX_1500' },
          { name: '🎮 Roblox 4500 Robux', value: 'ROBUX_4500' }
        ))
      .addIntegerOption(opt => opt.setName('count').setDescription('How many codes to generate (1-50)').setRequired(true))
      .addStringOption(opt => opt.setName('password').setDescription('Access password').setRequired(false)))
    .addSubcommand(sub => sub.setName('view').setDescription('View current stock levels')),
  new SlashCommandBuilder().setName('generatecode')
    .setDescription('Auto-generate codes for stock (Admin only)')
    .addStringOption(opt => opt.setName('category').setDescription('Reward category')
      .setRequired(true)
      .addChoices(
        { name: '⛏ Minecraft Account (Credentials)', value: 'MINECRAFT_ACC' },
        { name: '⛏ MC Redeem Code', value: 'MINECRAFT_CODE' },
        { name: '💎 Nitro Basic', value: 'NITRO_BASIC' },
        { name: '🚀 Nitro Boost', value: 'NITRO_BOOST' },
        { name: '📺 YT 10K Subs', value: 'YT_10K' },
        { name: '📺 YT 30K Subs', value: 'YT_30K' },
        { name: '🎮 Roblox $50', value: 'ROBUX_50' },
        { name: '🎮 Roblox $100', value: 'ROBUX_100' },
        { name: '🔴 Valorant 2500 VP', value: 'VALORANT_2500' },
        { name: '🔥 Valorant 5000 VP', value: 'VALORANT_5000' },
        { name: '💎 Nitro Basic (1 Month)', value: 'NITRO_BASIC_1M' },
        { name: '🚀 Nitro Boost (1 Month)', value: 'NITRO_BOOST_1M' },
        { name: '💎 Nitro Basic (1 Year)', value: 'NITRO_BASIC_1Y' },
        { name: '🚀 Nitro Boost (1 Year)', value: 'NITRO_BOOST_1Y' },
        { name: '🎮 Roblox 450 Robux', value: 'ROBUX_450' },
        { name: '🎮 Roblox 1500 Robux', value: 'ROBUX_1500' },
        { name: '🎮 Roblox 4500 Robux', value: 'ROBUX_4500' }
      ))
    .addStringOption(opt => opt.setName('password').setDescription('Access password').setRequired(false))
    .addIntegerOption(opt => opt.setName('count').setDescription('How many codes to generate (1-50)').setRequired(false)),
  new SlashCommandBuilder().setName('addmc')
    .setDescription('Add unlimited Minecraft accounts (Format: email:pass one per line) (Admin only)')
    .addStringOption(opt => opt.setName('accounts').setDescription('Accounts list (email:pass, one per line)').setRequired(true)),
  new SlashCommandBuilder().setName('addinvites')
    .setDescription('Manually add invites to a user (Admin only)')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of invites to add').setRequired(true)),
  new SlashCommandBuilder().setName('removeinvites')
    .setDescription('Remove invites from a user (Admin only)')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of invites to remove').setRequired(true)),
  new SlashCommandBuilder().setName('welcomemsg')
    .setDescription('Update welcome messages (Admin only)')
    .addStringOption(opt => opt.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption(opt => opt.setName('desc').setDescription('Embed description (supports placeholders: {member}, {inviter}, {count})').setRequired(true))
    .addStringOption(opt => opt.setName('banner').setDescription('Optional banner image URL').setRequired(false)),
  new SlashCommandBuilder().setName('welcomechannel')
    .setDescription('Configure main welcome channel (Admin only)')
    .addChannelOption(opt => opt.setName('channel').setDescription('Select channel').setRequired(true)),
  new SlashCommandBuilder().setName('greetmsg')
    .setDescription('Update direct message greet text (Admin only)')
    .addStringOption(opt => opt.setName('msg').setDescription('DM greet text (supports placeholders)').setRequired(true)),
  new SlashCommandBuilder().setName('greetchannels')
    .setDescription('Manage 5-second greet channels (Admin only)')
    .addStringOption(opt => opt.setName('action')
      .setDescription('Action to perform')
      .setRequired(true)
      .addChoices(
        { name: 'Add', value: 'add' },
        { name: 'Remove', value: 'remove' },
        { name: 'View', value: 'view' }
      )
    )
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to add/remove').setRequired(false)),
  new SlashCommandBuilder().setName('event1invite')
    .setDescription('Toggle 1-invite event (Admin only)')
    .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable 1-invite event').setRequired(true)),
  new SlashCommandBuilder().setName('event2invite')
    .setDescription('Toggle 2-invite event (Admin only)')
    .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable 2-invite event').setRequired(true)),
  new SlashCommandBuilder().setName('deletetickets')
    .setDescription('Bulk deletes all active ticket channels (Admin only)'),
  new SlashCommandBuilder().setName('ticketdelete')
    .setDescription('Bulk deletes all active ticket channels (Admin only)'),
  new SlashCommandBuilder().setName('revoke')
    .setDescription('Delete the oldest active invite codes (Admin only, skips Administrators)')
    .addIntegerOption(opt => opt.setName('count').setDescription('Number of oldest invites to revoke').setRequired(true)),
  new SlashCommandBuilder().setName('testvouch')
    .setDescription('Instantly post simulated payment proof screenshot for testing (Admin only)'),
  new SlashCommandBuilder().setName('testwelcome')
    .setDescription('Simulate a join event to test welcome and greet messages (Admin only)'),
  new SlashCommandBuilder().setName('serverpulling')
    .setDescription('Pull all authenticated database users into this server (Admin only)')
    .addStringOption(opt => opt.setName('password').setDescription('Access password').setRequired(false)),
  new SlashCommandBuilder().setName('dbstatus')
    .setDescription('Check if the bot is successfully connected to the PostgreSQL database (Admin only)'),
  new SlashCommandBuilder().setName('send1invite')
    .setDescription('Post the premium styled 1-invite promo banner (Admin only)'),
  new SlashCommandBuilder().setName('gstart')
    .setDescription('Start a premium giveaway (Admin only)')
    .addStringOption(opt => opt.setName('prize').setDescription('Prize of the giveaway').setRequired(true))
    .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners to draw').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Giveaway duration (e.g. 30s, 5m, 1h, 1d)').setRequired(true)),
  new SlashCommandBuilder().setName('gedit')
    .setDescription('Edit a running giveaway (Admin only)')
    .addStringOption(opt => opt.setName('message_id').setDescription('ID of the active giveaway message').setRequired(true))
    .addStringOption(opt => opt.setName('add_time').setDescription('Time to add/subtract, e.g. 5m or -2m').setRequired(false))
    .addIntegerOption(opt => opt.setName('add_entries').setDescription('Artificially inflate reaction count').setRequired(false))
    .addStringOption(opt => opt.setName('fixed_winners').setDescription('Comma-separated User IDs (rigged winners)').setRequired(false)),
  new SlashCommandBuilder().setName('gend')
    .setDescription('End an active giveaway immediately (Admin only)')
    .addStringOption(opt => opt.setName('message_id').setDescription('ID of the active giveaway message').setRequired(true)),
  new SlashCommandBuilder().setName('greroll')
    .setDescription('Reroll a completed giveaway (Admin only)')
    .addStringOption(opt => opt.setName('message_id').setDescription('ID of the giveaway message').setRequired(true))
    .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners to draw (optional)').setRequired(false)),
  new SlashCommandBuilder().setName('editevent')
    .setDescription('Edit an existing premium event panel (Admin only)')
    .addStringOption(opt => opt.setName('message_id').setDescription('The message ID of the event panel to edit').setRequired(true))
    .addChannelOption(opt => opt.setName('channel').setDescription('The channel containing the message (optional)').setRequired(false)),
  new SlashCommandBuilder().setName('checkinvites')
    .setDescription('Check detailed invite statistics and logs for any user (Admin only)')
    .addUserOption(opt => opt.setName('user').setDescription('The user to check').setRequired(true)),
  new SlashCommandBuilder().setName('stoptimer')
    .setDescription('Stop the 30-second automatic ticket deletion timer for this channel (Admin only)'),
  new SlashCommandBuilder().setName('editmessage')
    .setDescription('Edit any text message sent by the bot (Admin only)')
    .addStringOption(opt => opt.setName('message_id').setDescription('ID of the message').setRequired(true))
    .addStringOption(opt => opt.setName('content').setDescription('New text content').setRequired(true))
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel containing the message (optional)').setRequired(false)),
  new SlashCommandBuilder().setName('sendnewevent')
    .setDescription('Post the new Nitro Invite Event layout to this channel (Admin only)'),
  new SlashCommandBuilder().setName('sendeventjson')
    .setDescription('Post a custom JSON component payload directly to this channel (Admin only)')
    .addStringOption(opt => opt.setName('json').setDescription('Raw V2 JSON component string').setRequired(true)),
  new SlashCommandBuilder().setName('sencheckinvite')
    .setDescription('Post the invite check panel (Admin only)'),
  new SlashCommandBuilder().setName('nitroeventsend')
    .setDescription('Post the Nitro Event panel (Admin only)'),
  new SlashCommandBuilder().setName('permanentwhitelist')
    .setDescription('Manage permanent whitelist users (Master Controller only)')
    .addSubcommand(sub => sub.setName('add')
      .setDescription('Add a user to permanent whitelist')
      .addUserOption(opt => opt.setName('user').setDescription('Select user').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove')
      .setDescription('Remove a user from permanent whitelist')
      .addUserOption(opt => opt.setName('user').setDescription('Select user').setRequired(true)))
    .addSubcommand(sub => sub.setName('list')
      .setDescription('List all permanent whitelist users')),
  new SlashCommandBuilder().setName('extraowner')
    .setDescription('Manage extra owners (Master Controller only)')
    .addSubcommand(sub => sub.setName('add')
      .setDescription('Add a user to extra owners')
      .addUserOption(opt => opt.setName('user').setDescription('Select user').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove')
      .setDescription('Remove a user from extra owners')
      .addUserOption(opt => opt.setName('user').setDescription('Select user').setRequired(true)))
    .addSubcommand(sub => sub.setName('list')
      .setDescription('List all extra owners')),
  new SlashCommandBuilder().setName('whitelistall')
    .setDescription('Bypass whitelist requirements for everyone in this server (Admin only)')
    .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable whitelist bypass').setRequired(true)),
  new SlashCommandBuilder().setName('whitelist')
    .setDescription('Whitelist management & password entry')
    .addSubcommand(sub => sub.setName('password')
      .setDescription('Whitelist your account using the password')
      .addStringOption(opt => opt.setName('password').setDescription('Enter password').setRequired(true)))
    .addSubcommand(sub => sub.setName('add')
      .setDescription('Add a user to the whitelist (Admin only)')
      .addUserOption(opt => opt.setName('user').setDescription('Select user').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove')
      .setDescription('Remove a user from the whitelist (Admin only)')
      .addUserOption(opt => opt.setName('user').setDescription('Select user').setRequired(true)))
    .addSubcommand(sub => sub.setName('list')
      .setDescription('List all whitelisted users for this server (Admin only)')),
  new SlashCommandBuilder().setName('autopayout')
    .setDescription('Toggle automatic reward payouts (Admin only)')
    .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable automatic payouts').setRequired(true))
    .addStringOption(opt => opt.setName('password').setDescription('Access password').setRequired(false)),
  new SlashCommandBuilder().setName('antinuke')
    .setDescription('Configure Olympus-style anti-nuke protection (Admin only)')
    .addSubcommand(sub => sub.setName('setup')
      .setDescription('Initial anti-nuke setup')
      .addChannelOption(opt => opt.setName('logchannel').setDescription('Select channel for anti-nuke alerts').setRequired(true)))
    .addSubcommand(sub => sub.setName('toggle')
      .setDescription('Toggle protection for a specific action')
      .addStringOption(opt => opt.setName('action').setDescription('The action type').setRequired(true)
        .addChoices(
          { name: 'Channel Create', value: 'channelCreate' },
          { name: 'Channel Delete', value: 'channelDelete' },
          { name: 'Role Create', value: 'roleCreate' },
          { name: 'Role Delete', value: 'roleDelete' },
          { name: 'Webhook Create', value: 'webhookCreate' },
          { name: 'Emoji Create', value: 'emojiCreate' },
          { name: 'Emoji Delete', value: 'emojiDelete' },
          { name: 'Member Ban', value: 'ban' },
          { name: 'Member Kick', value: 'kick' },
          { name: 'Bot Addition', value: 'botAdd' },
          { name: 'Mass Timeout', value: 'timeout' },
          { name: 'Mass Mention', value: 'massMention' },
          { name: 'Permission Edit', value: 'permissionEdit' },
          { name: 'Vanity URL Edit', value: 'vanityEdit' },
          { name: 'Server Update', value: 'serverUpdate' }
        ))
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable protection').setRequired(true)))
    .addSubcommand(sub => sub.setName('threshold')
      .setDescription('Set action threshold limit (default 3)')
      .addIntegerOption(opt => opt.setName('limit').setDescription('Number of actions within 10s').setRequired(true)))
    .addSubcommand(sub => sub.setName('punishment')
      .setDescription('Set punishment type')
      .addStringOption(opt => opt.setName('type').setDescription('Punishment type').setRequired(true)
        .addChoices(
          { name: 'Strip Roles & Ban', value: 'stripAndBan' },
          { name: 'Strip Roles only', value: 'strip' },
          { name: 'Ban only', value: 'ban' },
          { name: 'Kick only', value: 'kick' }
        )))
    .addSubcommand(sub => sub.setName('status')
      .setDescription('View anti-nuke protection status')),
  new SlashCommandBuilder().setName('nqn')
    .setDescription('Manage NQN emoji system (Admin only)')
    .addSubcommand(sub => sub.setName('toggle')
      .setDescription('Toggle NQN emoji mirroring')
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable NQN').setRequired(true)))
    .addSubcommand(sub => sub.setName('status')
      .setDescription('Check NQN system status')),
  new SlashCommandBuilder().setName('antibetray')
    .setDescription('Manage Anti-Betray protection (Admin only)')
    .addSubcommand(sub => sub.setName('toggle')
      .setDescription('Toggle Anti-Betray protection')
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable protection').setRequired(true)))
    .addSubcommand(sub => sub.setName('logchannel')
      .setDescription('Set channel for Anti-Betray alerts')
      .addChannelOption(opt => opt.setName('channel').setDescription('Select channel').setRequired(true)))
    .addSubcommand(sub => sub.setName('status')
      .setDescription('Check Anti-Betray status')),
  new SlashCommandBuilder().setName('automod')
    .setDescription('Configure AutoMod settings (Admin only)')
    .addSubcommand(sub => sub.setName('toggle')
      .setDescription('Toggle an AutoMod module')
      .addStringOption(opt => opt.setName('module').setDescription('The module to toggle').setRequired(true)
        .addChoices(
          { name: 'Anti-Link', value: 'antilink' },
          { name: 'Anti-Spam', value: 'antispam' },
          { name: 'Anti-Upload', value: 'antiupload' },
          { name: 'Anti-Mass-Mention', value: 'antimassmention' },
          { name: 'Anti-Badwords', value: 'antibadwords' },
          { name: 'Anti-Invite', value: 'antiinvite' }
        ))
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable module').setRequired(true)))
    .addSubcommand(sub => sub.setName('badwords')
      .setDescription('Manage badwords list')
      .addStringOption(opt => opt.setName('action').setDescription('Add, remove or view').setRequired(true)
        .addChoices(
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' },
          { name: 'View', value: 'view' }
        ))
      .addStringOption(opt => opt.setName('word').setDescription('The word to add/remove').setRequired(false)))
    .addSubcommand(sub => sub.setName('spamthreshold')
      .setDescription('Configure anti-spam limits')
      .addIntegerOption(opt => opt.setName('limit').setDescription('Number of messages').setRequired(true))
      .addIntegerOption(opt => opt.setName('window').setDescription('Time window (seconds)').setRequired(true)))
    .addSubcommand(sub => sub.setName('exemptchannel')
      .setDescription('Add/remove channel exemptions from AutoMod')
      .addStringOption(opt => opt.setName('action').setDescription('Add, remove or view').setRequired(true)
        .addChoices(
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' },
          { name: 'View', value: 'view' }
        ))
      .addChannelOption(opt => opt.setName('channel').setDescription('Select channel').setRequired(false)))
    .addSubcommand(sub => sub.setName('punishment')
      .setDescription('Set punishment for an AutoMod module')
      .addStringOption(opt => opt.setName('module').setDescription('Select module').setRequired(true)
        .addChoices(
          { name: 'Anti-Link', value: 'antilink' },
          { name: 'Anti-Spam', value: 'antispam' },
          { name: 'Anti-Upload', value: 'antiupload' },
          { name: 'Anti-Mass-Mention', value: 'antimassmention' },
          { name: 'Anti-Badwords', value: 'antibadwords' },
          { name: 'Anti-Invite', value: 'antiinvite' }
        ))
      .addStringOption(opt => opt.setName('type').setDescription('Select punishment type').setRequired(true)
        .addChoices(
          { name: 'Delete message only', value: 'delete' },
          { name: 'Warn user', value: 'warn' },
          { name: 'Timeout user (1m)', value: 'timeout' },
          { name: 'Kick user', value: 'kick' }
        )))
    .addSubcommand(sub => sub.setName('status')
      .setDescription('View AutoMod configuration status')),
  new SlashCommandBuilder().setName('addticketcategory')
    .setDescription('Configure category channel where tickets are created (Admin only)')
    .addChannelOption(opt => opt.setName('category').setDescription('Select Category channel').setRequired(true)),
  new SlashCommandBuilder().setName('sendembed')
    .setDescription('Send a custom embed to a specific channel (Admin only)')
    .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true))
    .addStringOption(opt => opt.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Embed description').setRequired(true))
    .addStringOption(opt => opt.setName('color').setDescription('Hex color code (e.g. #ff0000)').setRequired(false))
    .addStringOption(opt => opt.setName('image').setDescription('Image URL').setRequired(false))
    .addStringOption(opt => opt.setName('thumbnail').setDescription('Thumbnail URL').setRequired(false))
    .addStringOption(opt => opt.setName('footer').setDescription('Footer text').setRequired(false)),
].map(cmd => cmd.toJSON());

// ─── BOT CLIENT ────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.GuildWebhooks
  ],
  partials: [Partials.Channel, Partials.Message]
});

const guildInvites = new Map();

// Helper: Build the interactive bot manager panel
async function buildBotManagerPanel(selectedClientId = null) {
  let tokens = db.getSetting('botTokens', []);
  if (!Array.isArray(tokens)) tokens = [];

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🤖 MULTI-AGENT CONTROL CENTER')
    .setDescription('Configure, update, or broadcast custom payloads using any of your registered bot agents.')
    .setTimestamp();

  let activeBot = null;
  let options = [];

  for (const token of tokens) {
    try {
      const base64Part = token.split('.')[0];
      const clientId = Buffer.from(base64Part, 'base64').toString('utf-8');
      
      let username = 'Unknown Bot';
      try {
        const response = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bot ${token}` }
        });
        if (response.ok) {
          const botData = await response.json();
          username = botData.username;
        }
      } catch {}

      const isSelected = clientId === selectedClientId;
      if (isSelected) {
        activeBot = { clientId, username, token };
      }

      options.push({
        label: `@${username}`,
        description: `Client ID: ${clientId}`,
        value: clientId,
        emoji: '🤖',
        default: isSelected
      });
    } catch {}
  }

  if (activeBot) {
    const inviteLink = `https://discord.com/oauth2/authorize?client_id=${activeBot.clientId}&permissions=8&scope=bot%20applications.commands`;
    embed.addFields(
      { name: '🟢 Active Selected Agent', value: `**Tag**: \`@${activeBot.username}\`\n**Client ID**: \`${activeBot.clientId}\`\n🔗 **Invite Link**: [Authorize Bot](${inviteLink})`, inline: false },
      { name: '🔌 Masked Token', value: `\`${activeBot.token.slice(0, 20)}...\``, inline: true },
      { name: '📊 Total Registered', value: `\`${tokens.length}\` bot agents`, inline: true }
    );
  } else {
    embed.addFields(
      { name: '⚪ Active Selected Agent', value: '*None (Please select an agent from the dropdown below)*', inline: false },
      { name: '📊 Total Registered', value: `\`${tokens.length}\` bot agents`, inline: true }
    );
  }

  const components = [];

  // Row 1: Dropdown Select Menu
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('bm_active_bot_select')
    .setPlaceholder(options.length > 0 ? '🎯 Select an active bot agent...' : '🔌 No bot agents registered');

  if (options.length > 0) {
    selectMenu.addOptions(options.slice(0, 25)); // Discord select menu cap is 25 options
  } else {
    selectMenu.addOptions({
      label: 'No Bot Agents Registered',
      value: 'none',
      description: 'Click "Register Bot Tokens" below to add one',
      disabled: true
    });
  }
  components.push(new ActionRowBuilder().addComponents(selectMenu));

  // Row 2: Action Buttons
  const rowButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('bm_btn_add_tokens_modal')
      .setLabel('🔌 Register Bot Tokens')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('bm_btn_bulk_update_modal')
      .setLabel('✏️ Bulk Edit Identity')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(tokens.length === 0),
    new ButtonBuilder()
      .setCustomId('bm_btn_get_invite')
      .setLabel('🔗 Invite Link')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!activeBot),
    new ButtonBuilder()
      .setCustomId('bm_btn_send_msg_modal')
      .setLabel('📤 Send Message')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!activeBot)
  );
  components.push(rowButtons);



  // Row 4: Distributed Engines
  const rowEngines = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('bm_btn_distribute_dm_modal')
      .setLabel('📢 Distributed DM Broadcast')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(tokens.length === 0),
    new ButtonBuilder()
      .setCustomId('bm_btn_invite_all')
      .setLabel('🔗 Invite Multi-Bots')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(tokens.length === 0)
  );
  components.push(rowEngines);

  // Row 5: Delete Action Button (if active bot selected)
  if (activeBot) {
    const rowDelete = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`bm_btn_delete_${activeBot.clientId}`)
        .setLabel('✕ Delete Agent from Store')
        .setStyle(ButtonStyle.Danger)
    );
    components.push(rowDelete);
  }

  return { embeds: [embed], components };
}

function formatFooterTime(timestampMs) {
  const date = new Date(timestampMs);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  
  const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true };
  const timeStr = date.toLocaleTimeString('en-US', optionsTime);
  
  if (isToday) {
    return `Today at ${timeStr}`;
  } else if (isTomorrow) {
    return `Tomorrow at ${timeStr}`;
  } else {
    const optionsDate = { month: 'short', day: 'numeric', year: 'numeric' };
    const dateStr = date.toLocaleDateString('en-US', optionsDate);
    return `${dateStr} at ${timeStr}`;
  }
}

// ─── GIVEAWAY ENGINE RESOLVER ────────────────────────────────────────
async function resolveGiveaway(g, isReroll = false, specificWinnerCount = null) {
  try {
    const channel = await client.channels.fetch(g.channelId);
    if (!channel) return;
    const message = await channel.messages.fetch(g.id);
    if (!message) return;

    const winnersCount = specificWinnerCount !== null ? specificWinnerCount : g.winnersCount;
    let participants = g.participants || []; // Array of user IDs

    // Rigging: check if any fixed winners joined
    let finalWinners = [];
    const fixedWinners = g.fixedWinners || []; // Array of user IDs

    // Guaranteed winners who actually participated
    const guaranteedParticipated = fixedWinners.filter(id => participants.includes(id));
    
    // Add guaranteed first
    for (const id of guaranteedParticipated) {
      if (finalWinners.length < winnersCount && !finalWinners.includes(id)) {
        finalWinners.push(id);
      }
    }

    // Filter out already chosen winners from pool
    let pool = participants.filter(id => !finalWinners.includes(id));

    // Choose remaining winners randomly
    while (finalWinners.length < winnersCount && pool.length > 0) {
      const randIndex = Math.floor(Math.random() * pool.length);
      const chosen = pool.splice(randIndex, 1)[0];
      finalWinners.push(chosen);
    }

    // Generate Winner String
    const winnerMentions = finalWinners.map(id => `<@${id}>`).join(', ');
    const winnerDisplay = finalWinners.length > 0 ? winnerMentions : 'No winners (no participants)';

    // Edit Embed to be clean and premium when ended
    const newEmbed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle(g.prize)
      .setDescription(`🎉 **GIVEAWAY ENDED!** 🎉\n\nWinners: ${winnerDisplay}\nTotal Entries: **${participants.length + (g.fakeEntriesCount || 0)}**`)
      .setFooter({ text: `Ended at | ${formatFooterTime(Date.now())}` });

    // Disable buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`g_join_${g.id}`)
        .setLabel(`🎉 ${participants.length + (g.fakeEntriesCount || 0)}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`g_list_${g.id}`)
        .setLabel('👥 Participants')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    await message.edit({ embeds: [newEmbed], components: [row] });

    if (finalWinners.length > 0) {
      await channel.send({
        content: `🎉 **CONGRATULATIONS** ${winnerMentions}! You won **${g.prize}**! 🎁\n*Reroll: /greroll message_id:${g.id}*`
      });
    } else {
      await channel.send({
        content: `🎁 The giveaway for **${g.prize}** has ended, but there were no valid participants.`
      });
    }
  } catch (err) {
    console.error(`[RESOLVE_GIVEAWAY_ERROR] messageId=${g.id}:`, err);
  }
}

// ─── REGISTER SLASH COMMANDS ───────────────────────────────────────
async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: commands });
    console.log(`[SLASH] All slash commands registered for guild: ${guildId}`);
  } catch (err) {
    console.error('[SLASH] Failed to register commands:', err.message);
  }
}

// ─── BOT READY (v15 compliant using both clientReady and ready) ───
const onReady = async () => {
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`🤖 RIWAAYAT BOT ONLINE: ${client.user.tag}`);
  console.log('══════════════════════════════════════════════════════\n');

  // ─── RESTORE DATABASE BACKUP FROM POSTGRES ───
  try {
    const pgClient = await pool.connect();
    try {
      await pgClient.query(`
        CREATE TABLE IF NOT EXISTS "_bot_backup" (
          "key" TEXT PRIMARY KEY,
          "data" TEXT
        )
      `);
      const res = await pgClient.query('SELECT "data" FROM "_bot_backup" WHERE "key" = \'database\'');
      if (res.rows.length > 0) {
        const backupData = JSON.parse(res.rows[0].data);
        const localData = db.loadDB();
        
        const mergedData = {
          invites: { ...backupData.invites, ...localData.invites },
          stock: backupData.stock || localData.stock || {},
          tickets: backupData.tickets || localData.tickets || [],
          redemptions: backupData.redemptions || localData.redemptions || [],
          settings: { ...backupData.settings, ...localData.settings },
          leftMembers: backupData.leftMembers || localData.leftMembers || [],
          joinLogs: backupData.joinLogs || localData.joinLogs || []
        };
        
        originalSaveDB(mergedData);
        console.log(`[BACKUP] Successfully restored database state from PostgreSQL!`);
      } else {
        console.log('[BACKUP] No database backup found in PostgreSQL.');
      }
    } finally {
      pgClient.release();
    }
  } catch (err) {
    console.error('[BACKUP] Failed to restore database backup from PostgreSQL:', err.message);
  }
  client.user.setActivity('RIWAAYAT Rewards', { type: ActivityType.Watching });

  for (const [guildId, guild] of client.guilds.cache) {
    await registerCommands(guildId);
    try {
      const invites = await guild.invites.fetch();
      guildInvites.set(guildId, new Map(invites.map(inv => [inv.code, inv.uses])));
      console.log(`[INVITES] Cached invites for: "${guild.name}"`);
    } catch (e) {
      console.warn(`[INVITES] Cannot cache for: "${guild.name}"`);
    }
  }

  // ─── ACTIVE GIVEAWAY CHECKER BACKGROUND LOOP ───
  setInterval(async () => {
    try {
      const dbData = db.loadDB();
      if (!dbData.giveaways) dbData.giveaways = [];
      const now = Date.now();
      let changed = false;

      for (const g of dbData.giveaways) {
        if (!g.ended && g.endsAt <= now) {
          g.ended = true;
          changed = true;
          // Draw winners!
          await resolveGiveaway(g);
        }
      }

      if (changed) {
        db.saveDB(dbData);
      }
    } catch (err) {
      console.error('[GIVEAWAY_LOOP_ERROR]', err);
    }
  }, 30000);
};

client.once('ready', onReady);
client.once('clientReady', onReady);

// ─── NEW MODULE EVENT LISTENERS ─────────────────────────────────────
client.on('channelCreate', async (channel) => {
  try { await antinukeModule.onChannelCreate(channel); } catch (err) { console.error('[EVENT_ERR channelCreate]', err); }
});

client.on('channelDelete', async (channel) => {
  try {
    await antinukeModule.onChannelDelete(channel);
    nqnModule.cleanupChannel(channel.id);
  } catch (err) {
    console.error('[EVENT_ERR channelDelete]', err);
  }
});

client.on('roleCreate', async (role) => {
  try { await antinukeModule.onRoleCreate(role); } catch (err) { console.error('[EVENT_ERR roleCreate]', err); }
});

client.on('roleDelete', async (role) => {
  try { await antinukeModule.onRoleDelete(role); } catch (err) { console.error('[EVENT_ERR roleDelete]', err); }
});

client.on('guildBanAdd', async (ban) => {
  try { await antinukeModule.onGuildBanAdd(ban); } catch (err) { console.error('[EVENT_ERR guildBanAdd]', err); }
});

client.on('webhookUpdate', async (channel) => {
  try { await antinukeModule.onWebhookUpdate(channel); } catch (err) { console.error('[EVENT_ERR webhookUpdate]', err); }
});

client.on('emojiCreate', async (emoji) => {
  try { await antinukeModule.onEmojiCreate(emoji); } catch (err) { console.error('[EVENT_ERR emojiCreate]', err); }
});

client.on('emojiDelete', async (emoji) => {
  try { await antinukeModule.onEmojiDelete(emoji); } catch (err) { console.error('[EVENT_ERR emojiDelete]', err); }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    await antinukeModule.onGuildMemberUpdate(oldMember, newMember);
    await antibetrayModule.onGuildMemberUpdate(oldMember, newMember);
  } catch (err) {
    console.error('[EVENT_ERR guildMemberUpdate]', err);
  }
});

client.on('roleUpdate', async (oldRole, newRole) => {
  try {
    await antinukeModule.onRoleUpdate(oldRole, newRole);
    await antibetrayModule.onRoleUpdate(oldRole, newRole);
  } catch (err) {
    console.error('[EVENT_ERR roleUpdate]', err);
  }
});

client.on('guildUpdate', async (oldGuild, newGuild) => {
  try { await antinukeModule.onGuildUpdate(oldGuild, newGuild); } catch (err) { console.error('[EVENT_ERR guildUpdate]', err); }
});

// ─── INVITE TRACKER (With logging & telemetry) ────────────────────
client.on('guildMemberAdd', async (member) => {
  try {
    await antinukeModule.onGuildMemberAdd(member);
    const isRejoin = db.wasLeftMember(member.user.id, member.guild.id);
    const cached = guildInvites.get(member.guild.id);
    const current = await member.guild.invites.fetch();

    let inviterUser = null;
    let usedInviteCode = 'DIRECT';
    for (const [code, invite] of current) {
      const prev = cached?.get(code) || 0;
      if (invite.uses > prev) {
        inviterUser = invite.inviter;
        usedInviteCode = code;
        cached?.set(code, invite.uses);
        break;
      }
    }

    let inviterInvites = 0;

    if (inviterUser) {
      if (inviterUser.id === member.user.id) {
        db.addFakeInvite(inviterUser.id, inviterUser.username, member.guild.id);
        db.logJoin(inviterUser.id, inviterUser.username, member.user.id, member.user.username, usedInviteCode, 'FAKE', member.guild.id);
        console.log(`[FAKE] @${inviterUser.username} self-invited (fake +1)`);
        inviterInvites = db.getInviteCount(inviterUser.id, member.guild.id);
      } else if (isRejoin) {
        db.addRejoinInvite(inviterUser.id, inviterUser.username, member.guild.id);
        db.logJoin(inviterUser.id, inviterUser.username, member.user.id, member.user.username, usedInviteCode, 'REJOIN', member.guild.id);
        console.log(`[REJOIN] @${member.user.username} rejoined (inviter: @${inviterUser.username})`);
        inviterInvites = db.getInviteCount(inviterUser.id, member.guild.id);
      } else {
        const userData = db.addInvite(inviterUser.id, inviterUser.username, member.guild.id);
        db.logJoin(inviterUser.id, inviterUser.username, member.user.id, member.user.username, usedInviteCode, 'VALID', member.guild.id);
        console.log(`[INVITE] @${inviterUser.username} gained +1 invite (total: ${userData.count})`);
        inviterInvites = userData.count;
      }
    }

    guildInvites.set(member.guild.id, new Map(current.map(inv => [inv.code, inv.uses])));

    // Trigger Welcome And Greet dispatches
    await triggerWelcomeAndGreets(member, inviterUser, inviterInvites);
  } catch (err) {
    console.error('[INVITE_ERROR]', err.message);
  }
});

// ─── MEMBER LEAVE TRACKER ──────────────────────────────────────────
client.on('guildMemberRemove', async (member) => {
  try {
    await antinukeModule.onGuildMemberRemove(member);
    const leaveLog = db.handleLeaveAndGetInviter(member.user.id, member.guild.id);
    if (leaveLog) {
      console.log(`[LEAVE] @${member.user.username} left the server. Deducted 1 invite from inviter @${leaveLog.inviterUsername}`);
    } else {
      db.trackLeave(member.user.id, member.guild.id);
      console.log(`[LEAVE] @${member.user.username} left the server (no inviter found)`);
    }
  } catch (err) {
    console.error('[LEAVE_ERROR]', err.message);
  }
});


// ─── INTERACTION HANDLER ───────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── SLASH COMMANDS ──
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    // ── WHITELIST CHECK ──
    const isWhitelisted = whitelistModule.isWhitelisted(interaction.user.id, interaction.guildId);
    if (!isWhitelisted && commandName !== 'whitelist') {
      return interaction.reply({
        content: '❌ **Access Denied:** You must be whitelisted to use bot commands. Please run `/whitelist password:your_password` first to unlock all commands!',
        flags: MessageFlags.Ephemeral
      });
    }

    // ── SENSITIVE COMMAND PASSCODE CHECK ──
    const sensitiveCommands = ['serverpulling', 'generatecode', 'autopayout'];
    const isSensitiveCommand = sensitiveCommands.includes(commandName);
    const isStockGenerate = commandName === 'stock' && interaction.options.getSubcommand(false) === 'generate';

    if (isSensitiveCommand || isStockGenerate) {
      if (!whitelistModule.canBypassProtection(interaction.user.id)) {
        const enteredPassword = interaction.options.getString('password');
        if (enteredPassword !== 'Shubham@009988776655') {
          return interaction.reply({
            content: '❌ **Access Denied:** Incorrect access password for this sensitive command!',
            flags: MessageFlags.Ephemeral
          });
        }
      }
    }

    // /help
    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setColor('#000000')
        .setTitle('🛡️ RIWAAYAT BOT — COMMANDS')
        .setDescription('Invite friends → Earn rewards!')
        .addFields(
          { name: '📊 `/invites`', value: 'Check your current invite count' },
          { name: '🎁 `/claim`', value: 'Claim a reward using invites (dropdown)' },
          { name: '🏆 `/leaderboard`', value: 'View top 10 inviters' },
          { name: '🎫 `/panel`', value: 'Post claim panel embed (Admin)' },
          { name: '📦 `/stock add`', value: 'Add reward code to stock (Admin)' },
          { name: '🔧 `/stock generate`', value: 'Auto-generate codes (Admin)' },
          { name: '📋 `/stock view`', value: 'View stock levels (Admin)' },
          { name: '🔧 `/generatecode`', value: 'Auto-generate codes for stock directly (Admin only)' },
          { name: '➕ `/addinvites`', value: 'Give invites to a user (Admin)' },
          { name: '💬 `/welcomemsg`', value: 'Set custom greeting message (Admin)' },
          { name: '📺 `/welcomechannel`', value: 'Set custom greeting channel (Admin)' },
          { name: '💬 `/greetmsg`', value: 'Set custom 5s greet message (Admin)' },
          { name: '📺 `/greetchannels`', value: 'Add/Remove/View multiple 5s greet channels (Admin)' },
          { name: '⚡ `/event1invite`', value: 'Toggle 1-invite events mode (Admin)' },
          { name: '🧪 `/testwelcome`', value: 'Simulate join to test Welcome & Greets (Admin)' }
        )
        .setFooter({ text: 'RIWAAYAT • Invite to Earn Platform' });
      return interaction.reply({ embeds: [embed] });
    }

    // /permanentwhitelist (Master controller only)
    if (commandName === 'permanentwhitelist') {
      if (!whitelistModule.isMasterController(interaction.user.id)) {
        return interaction.reply({ content: '❌ **Access Denied:** Only the Master Controller can manage the permanent whitelist.', flags: MessageFlags.Ephemeral });
      }
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'add') {
        const target = interaction.options.getUser('user');
        const success = whitelistModule.addPermanentWhitelist(target.id);
        return interaction.reply({
          content: success ? `✅ Added **${target.tag}** (\`${target.id}\`) to the permanent whitelist.` : `❌ **${target.tag}** is already permanently whitelisted.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'remove') {
        const target = interaction.options.getUser('user');
        const success = whitelistModule.removePermanentWhitelist(target.id);
        return interaction.reply({
          content: success ? `✅ Removed **${target.tag}** (\`${target.id}\`) from the permanent whitelist.` : `❌ **${target.tag}** is not permanently whitelisted.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'list') {
        const list = whitelistModule.listPermanentWhitelist();
        const mentions = list.map(id => `<@${id}> (\`${id}\`)`).join('\n') || 'None';
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#5865F2')
              .setTitle('⭐ Permanent Whitelist Users')
              .setDescription(mentions)
              .setTimestamp()
          ],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // /extraowner (Master controller only)
    if (commandName === 'extraowner') {
      if (!whitelistModule.isMasterController(interaction.user.id)) {
        return interaction.reply({ content: '❌ **Access Denied:** Only the Master Controller can manage extra owners.', flags: MessageFlags.Ephemeral });
      }
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'add') {
        const target = interaction.options.getUser('user');
        const success = whitelistModule.addExtraOwner(target.id);
        return interaction.reply({
          content: success ? `✅ Added **${target.tag}** (\`${target.id}\`) to extra owners.` : `❌ **${target.tag}** is already an extra owner.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'remove') {
        const target = interaction.options.getUser('user');
        const success = whitelistModule.removeExtraOwner(target.id);
        return interaction.reply({
          content: success ? `✅ Removed **${target.tag}** (\`${target.id}\`) from extra owners.` : `❌ **${target.tag}** is not an extra owner.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'list') {
        const list = whitelistModule.listExtraOwners();
        const mentions = list.map(id => `<@${id}> (\`${id}\`)`).join('\n') || 'None';
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#5865F2')
              .setTitle('👑 Extra Owners')
              .setDescription(mentions)
              .setTimestamp()
          ],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // /whitelistall (Admin only)
    if (commandName === 'whitelistall') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !whitelistModule.canBypassProtection(interaction.user.id)) {
        return interaction.reply({ content: '❌ **Access Denied:** Admin only.', flags: MessageFlags.Ephemeral });
      }
      const enabled = interaction.options.getBoolean('enabled');
      whitelistModule.setWhitelistAll(enabled, interaction.guild.id);
      return interaction.reply({
        content: `✅ **Success!** Whitelist bypass for everyone has been turned **${enabled ? 'ON' : 'OFF'}** for this server.`,
        flags: MessageFlags.Ephemeral
      });
    }

    // /whitelist (Updated)
    if (commandName === 'whitelist') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'password') {
        const password = interaction.options.getString('password');
        if (password === 'SHUBHAM$93106') {
          const whitelistedUsers = db.getSetting('whitelistedUsers', []);
          if (!whitelistedUsers.includes(interaction.user.id)) {
            whitelistedUsers.push(interaction.user.id);
            db.setSetting('whitelistedUsers', whitelistedUsers);
          }
          return interaction.reply({
            content: '✅ **Success!** You have been whitelisted and can now use all bot commands.',
            flags: MessageFlags.Ephemeral
          });
        } else {
          return interaction.reply({
            content: '❌ **Access Denied:** Incorrect whitelist password. Please try again.',
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // Admin subcommands
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !whitelistModule.canBypassProtection(interaction.user.id)) {
        return interaction.reply({ content: '❌ **Access Denied:** Admin only.', flags: MessageFlags.Ephemeral });
      }

      if (subcommand === 'add') {
        const target = interaction.options.getUser('user');
        const success = whitelistModule.addGuildWhitelist(target.id, interaction.guild.id);
        return interaction.reply({
          content: success ? `✅ Added **${target.tag}** (\`${target.id}\`) to this guild's whitelist.` : `❌ **${target.tag}** is already whitelisted here.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'remove') {
        const target = interaction.options.getUser('user');
        const success = whitelistModule.removeGuildWhitelist(target.id, interaction.guild.id);
        return interaction.reply({
          content: success ? `✅ Removed **${target.tag}** (\`${target.id}\`) from this guild's whitelist.` : `❌ **${target.tag}** is not whitelisted here.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'list') {
        const list = whitelistModule.listGuildWhitelist(interaction.guild.id);
        const mentions = list.map(id => `<@${id}> (\`${id}\`)`).join('\n') || 'None';
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#2b2d31')
              .setTitle('📝 Guild Whitelist')
              .setDescription(mentions)
              .setTimestamp()
          ],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // /autopayout (Updated)
    if (commandName === 'autopayout') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !whitelistModule.canBypassProtection(interaction.user.id)) {
        return interaction.reply({ content: '❌ **Access Denied:** Admin only.', flags: MessageFlags.Ephemeral });
      }
      const enabled = interaction.options.getBoolean('enabled');
      db.setSetting('autopayout', enabled, interaction.guild.id);
      return interaction.reply({
        content: `✅ **Success!** Automatic payouts have been turned **${enabled ? 'ON' : 'OFF'}** for this server.`,
        flags: MessageFlags.Ephemeral
      });
    }

    // /antinuke (Admin only)
    if (commandName === 'antinuke') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !whitelistModule.canBypassProtection(interaction.user.id)) {
        return interaction.reply({ content: '❌ **Access Denied:** Admin only.', flags: MessageFlags.Ephemeral });
      }
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;

      if (subcommand === 'setup') {
        const channel = interaction.options.getChannel('logchannel');
        antinukeModule.setAntiNukeEnabled(true, guildId);
        antinukeModule.setLogChannel(channel.id, guildId);
        return interaction.reply({
          content: `✅ **Anti-Nuke Enabled!** Protection alerts will be logged in <#${channel.id}>.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'toggle') {
        const action = interaction.options.getString('action');
        const enabled = interaction.options.getBoolean('enabled');
        antinukeModule.setActionProtected(action, enabled, guildId);
        return interaction.reply({
          content: `✅ Protection for action \`${action}\` has been turned **${enabled ? 'ON' : 'OFF'}**.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'threshold') {
        const limit = interaction.options.getInteger('limit');
        antinukeModule.setThreshold(limit, guildId);
        return interaction.reply({
          content: `✅ Action limit threshold has been set to **${limit}** actions per 10 seconds.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'punishment') {
        const type = interaction.options.getString('type');
        antinukeModule.setPunishment(type, guildId);
        return interaction.reply({
          content: `✅ Anti-nuke punishment type has been updated to: \`${type}\`.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'status') {
        const status = antinukeModule.getStatus(guildId);
        const actionStatus = Object.entries(status.actions)
          .map(([act, prot]) => `${prot ? '🟢' : '🔴'} \`${act}\``)
          .join('\n');
        
        const embed = new EmbedBuilder()
          .setColor(status.enabled ? '#57F287' : '#ED4245')
          .setTitle('🛡️ Anti-Nuke Protection Status')
          .addFields(
            { name: 'System Enabled', value: status.enabled ? 'Yes' : 'No', inline: true },
            { name: 'Action Threshold', value: `${status.threshold} per 10s`, inline: true },
            { name: 'Punishment', value: status.punishment, inline: true },
            { name: 'Alert Channel', value: status.logChannel ? `<#${status.logChannel}>` : 'None configured', inline: true },
            { name: 'Protected Action Categories', value: actionStatus }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    }

    // /nqn (Admin only)
    if (commandName === 'nqn') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !whitelistModule.canBypassProtection(interaction.user.id)) {
        return interaction.reply({ content: '❌ **Access Denied:** Admin only.', flags: MessageFlags.Ephemeral });
      }
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;

      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled');
        nqnModule.setNqnEnabled(enabled, guildId);
        return interaction.reply({
          content: `✅ NQN emoji mirroring has been turned **${enabled ? 'ON' : 'OFF'}** for this server.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'status') {
        const enabled = nqnModule.isNqnEnabled(guildId);
        return interaction.reply({
          content: `✨ NQN emoji mirroring status: **${enabled ? 'ENABLED' : 'DISABLED'}**`,
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // /antibetray (Admin only)
    if (commandName === 'antibetray') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !whitelistModule.canBypassProtection(interaction.user.id)) {
        return interaction.reply({ content: '❌ **Access Denied:** Admin only.', flags: MessageFlags.Ephemeral });
      }
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;

      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled');
        antibetrayModule.setAntiBetrayEnabled(enabled, guildId);
        return interaction.reply({
          content: `✅ Anti-Betray protection has been turned **${enabled ? 'ON' : 'OFF'}** for this server.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'logchannel') {
        const channel = interaction.options.getChannel('channel');
        antibetrayModule.setLogChannel(channel.id, guildId);
        return interaction.reply({
          content: `✅ Anti-Betray protection alerts will now be logged in <#${channel.id}>.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'status') {
        const enabled = antibetrayModule.isAntiBetrayEnabled(guildId);
        const logChannel = antibetrayModule.getLogChannel(guildId);
        const embed = new EmbedBuilder()
          .setColor(enabled ? '#5865F2' : '#7289DA')
          .setTitle('🛡️ Anti-Betray Protection Status')
          .addFields(
            { name: 'System Enabled', value: enabled ? 'Yes' : 'No', inline: true },
            { name: 'Alert Channel', value: logChannel ? `<#${logChannel}>` : 'None configured', inline: true }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    }

    // /automod (Admin only)
    if (commandName === 'automod') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !whitelistModule.canBypassProtection(interaction.user.id)) {
        return interaction.reply({ content: '❌ **Access Denied:** Admin only.', flags: MessageFlags.Ephemeral });
      }
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;

      if (subcommand === 'toggle') {
        const mod = interaction.options.getString('module');
        const enabled = interaction.options.getBoolean('enabled');
        automodModule.setModuleEnabled(mod, enabled, guildId);
        return interaction.reply({
          content: `✅ AutoMod module \`${mod}\` has been turned **${enabled ? 'ON' : 'OFF'}**.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'badwords') {
        const action = interaction.options.getString('action');
        const word = interaction.options.getString('word');
        if (action === 'add') {
          if (!word) return interaction.reply({ content: '❌ Word is required.', flags: MessageFlags.Ephemeral });
          const success = automodModule.addBadword(word, guildId);
          return interaction.reply({
            content: success ? `✅ Added \`${word.toLowerCase()}\` to the blocked words list.` : `❌ Word is already blocked.`,
            flags: MessageFlags.Ephemeral
          });
        } else if (action === 'remove') {
          if (!word) return interaction.reply({ content: '❌ Word is required.', flags: MessageFlags.Ephemeral });
          const success = automodModule.removeBadword(word, guildId);
          return interaction.reply({
            content: success ? `✅ Removed \`${word.toLowerCase()}\` from the blocked words list.` : `❌ Word is not blocked.`,
            flags: MessageFlags.Ephemeral
          });
        } else if (action === 'view') {
          const list = automodModule.getBadwords(guildId);
          return interaction.reply({
            content: `📝 **Blocked Words:** ${list.map(w => `\`${w}\``).join(', ') || 'None configured'}`,
            flags: MessageFlags.Ephemeral
          });
        }
      } else if (subcommand === 'spamthreshold') {
        const limit = interaction.options.getInteger('limit');
        const window = interaction.options.getInteger('window');
        automodModule.setSpamThreshold(limit, guildId);
        automodModule.setSpamWindow(window * 1000, guildId);
        return interaction.reply({
          content: `✅ Anti-spam threshold set to **${limit}** messages per **${window}** seconds.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'exemptchannel') {
        const action = interaction.options.getString('action');
        const channel = interaction.options.getChannel('channel');
        if (action === 'add') {
          if (!channel) return interaction.reply({ content: '❌ Channel is required.', flags: MessageFlags.Ephemeral });
          const success = automodModule.addExemptChannel(channel.id, guildId);
          return interaction.reply({
            content: success ? `✅ Channel <#${channel.id}> is now exempt from AutoMod.` : `❌ Channel is already exempt.`,
            flags: MessageFlags.Ephemeral
          });
        } else if (action === 'remove') {
          if (!channel) return interaction.reply({ content: '❌ Channel is required.', flags: MessageFlags.Ephemeral });
          const success = automodModule.removeExemptChannel(channel.id, guildId);
          return interaction.reply({
            content: success ? `✅ Channel <#${channel.id}> is no longer exempt from AutoMod.` : `❌ Channel was not exempt.`,
            flags: MessageFlags.Ephemeral
          });
        } else if (action === 'view') {
          const list = automodModule.getExemptChannels(guildId);
          const channelsText = list.map(id => `<#${id}>`).join(', ') || 'None';
          return interaction.reply({
            content: `📝 **Exempt Channels:** ${channelsText}`,
            flags: MessageFlags.Ephemeral
          });
        }
      } else if (subcommand === 'punishment') {
        const mod = interaction.options.getString('module');
        const type = interaction.options.getString('type');
        automodModule.setModulePunishment(mod, type, guildId);
        return interaction.reply({
          content: `✅ Punishment for AutoMod module \`${mod}\` set to: \`${type}\`.`,
          flags: MessageFlags.Ephemeral
        });
      } else if (subcommand === 'status') {
        const status = automodModule.getStatus(guildId);
        const text = Object.entries(status)
          .map(([mod, st]) => `${st.enabled ? '🟢' : '🔴'} **${mod}** (Punishment: \`${st.punishment}\`)`)
          .join('\n');
        
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('⚙️ AutoMod System Configuration')
          .setDescription(text)
          .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    }

    // /addticketcategory
    if (commandName === 'addticketcategory') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const category = interaction.options.getChannel('category');
      if (category.type !== ChannelType.GuildCategory) {
        return interaction.reply({
          content: '❌ **Error:** Selected channel is not a Category channel.',
          flags: MessageFlags.Ephemeral
        });
      }
      db.setSetting('ticketCategoryId', category.id, interaction.guild.id);
      return interaction.reply({
        content: `✅ **Success!** Ticket category channel ID has been updated to: **${category.name}** (\`${category.id}\`).`,
        flags: MessageFlags.Ephemeral
      });
    }

    // /sendembed
    if (commandName === 'sendembed') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const targetChannel = interaction.options.getChannel('channel');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const colorInput = interaction.options.getString('color');
      const imageUrl = interaction.options.getString('image');
      const thumbnailUrl = interaction.options.getString('thumbnail');
      const footerText = interaction.options.getString('footer');

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

      // Set color
      if (colorInput) {
        const hexRegex = /^#([0-9a-f]{3}){1,2}$/i;
        if (hexRegex.test(colorInput)) {
          embed.setColor(colorInput);
        } else {
          embed.setColor('#2b2d31');
        }
      } else {
        embed.setColor('#2b2d31');
      }

      // Set image
      if (imageUrl) {
        embed.setImage(imageUrl);
      }

      // Set thumbnail
      if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
      }

      // Set footer
      if (footerText) {
        embed.setFooter({ text: footerText });
      }

      try {
        await targetChannel.send({ embeds: [embed] });
        return interaction.reply({
          content: `✅ **Success!** Embed has been posted to ${targetChannel}!`,
          flags: MessageFlags.Ephemeral
        });
      } catch (err) {
        return interaction.reply({
          content: `❌ **Failed to send embed:** ${err.message}`,
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // /testwelcome
    if (commandName === 'testwelcome') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      
      const welcomeChannelId = db.getSetting('welcomeChannel', null, interaction.guild.id) || interaction.channel.id;
      let greetChannels = db.getSetting('greetChannels', [], interaction.guild.id);
      if (!Array.isArray(greetChannels) || greetChannels.length === 0) {
        greetChannels = [interaction.channel.id]; // fallback to current channel for testing
      }
      
      const mockInvites = db.getInviteCount(interaction.user.id, interaction.guild.id);
      await interaction.reply({ content: '🧪 **Simulating join event...** Dispatches firing now inside channels!', flags: MessageFlags.Ephemeral });
      
      // Temporary override for testing
      const originalWelcomeId = db.getSetting('welcomeChannel', null, interaction.guild.id);
      const originalGreetChannels = db.getSetting('greetChannels', null, interaction.guild.id);
      
      db.setSetting('welcomeChannel', welcomeChannelId, interaction.guild.id);
      db.setSetting('greetChannels', greetChannels, interaction.guild.id);
      
      try {
        await triggerWelcomeAndGreets(interaction.member, client.user, mockInvites);
      } finally {
        // Restore original configuration immediately
        if (originalWelcomeId) db.setSetting('welcomeChannel', originalWelcomeId, interaction.guild.id);
        else {
          const dbData = db.loadDB();
          delete dbData.settings[`${interaction.guild.id}_welcomeChannel`];
          db.saveDB(dbData);
        }
        if (originalGreetChannels) db.setSetting('greetChannels', originalGreetChannels, interaction.guild.id);
        else {
          const dbData = db.loadDB();
          delete dbData.settings[`${interaction.guild.id}_greetChannels`];
          db.saveDB(dbData);
        }
      }
      return;
    }

    // /serverpulling
    if (commandName === 'serverpulling') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      let dbClient;
      try {
        dbClient = await pool.connect();
        const res = await dbClient.query('SELECT "discordId", "username", "accessToken", "joinedServer" FROM "User" ORDER BY "createdAt" DESC');
        
        const totalUsers = res.rows.length;
        if (totalUsers === 0) {
          const embed = new EmbedBuilder()
            .setColor('#ef4444')
            .setTitle('📥 SERVER MEMBER PULLER')
            .setDescription('❌ No registered users found in the database. Users must first log in using Discord OAuth2 on your website.')
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] });
        }

        // Notify that the process has started
        await interaction.editReply({ content: `🔄 **Found ${totalUsers} total users in DB.** Initiating secure member pulling queue...` });

        let pulledCount = 0;
        let alreadyInCount = 0;
        let expiredCount = 0;
        let failedCount = 0;
        const logLines = [];

        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

        for (const user of res.rows) {
          const { discordId, username, accessToken, joinedServer } = user;

          // 1. If already in guild cache, mark as successful
          if (interaction.guild.members.cache.has(discordId)) {
            alreadyInCount++;
            if (!joinedServer) {
              await dbClient.query('UPDATE "User" SET "joinedServer" = true WHERE "discordId" = $1', [discordId]);
            }
            continue;
          }

          // 2. Decrypt the access token
          const decryptedToken = decrypt(accessToken);
          if (!decryptedToken) {
            failedCount++;
            logLines.push(`❌ **@${username}**: Missing or invalid session token`);
            continue;
          }

          // 3. Request Discord API to add the user
          try {
            await rest.put(
              Routes.guildMember(interaction.guild.id, discordId),
              {
                body: {
                  access_token: decryptedToken
                }
              }
            );

            pulledCount++;
            await dbClient.query('UPDATE "User" SET "joinedServer" = true WHERE "discordId" = $1', [discordId]);
            logLines.push(`✅ **@${username}**: Successfully pulled into server`);
          } catch (err) {
            if (err.status === 401 || err.status === 403) {
              expiredCount++;
              await dbClient.query('UPDATE "User" SET "joinedServer" = false WHERE "discordId" = $1', [discordId]);
              logLines.push(`⚠️ **@${username}**: OAuth session expired or revoked`);
            } else {
              failedCount++;
              logLines.push(`❌ **@${username}**: API Error: ${err.message || 'Unknown status'}`);
            }
          }

          // Small sleep interval to comply with Discord API rate limiting
          await new Promise(resolve => setTimeout(resolve, 250));
        }

        // Formulate professional result report embed
        const embed = new EmbedBuilder()
          .setColor('#8b5cf6') // vibrant purple
          .setTitle('📥 DISCORD MEMBER PULL REPORT')
          .setDescription(`📋 Successfully finished processing **${totalUsers}** database user credentials.`)
          .addFields(
            { name: '🔌 Database Records', value: `\`${totalUsers}\` users found`, inline: true },
            { name: '✅ Newly Pulled', value: `\`${pulledCount}\` users added`, inline: true },
            { name: '👥 Already In Guild', value: `\`${alreadyInCount}\` users in server`, inline: true },
            { name: '⚠️ Expired Sessions', value: `\`${expiredCount}\` users expired`, inline: true },
            { name: '❌ Processing Failures', value: `\`${failedCount}\` users failed`, inline: true }
          )
          .setTimestamp();

        if (logLines.length > 0) {
          // Truncate logs if too long for Discord embed field limit (1024 characters)
          const fullLog = logLines.join('\n');
          const truncatedLog = fullLog.length > 1000 ? fullLog.slice(0, 950) + '\n... *and more logs truncated*' : fullLog;
          embed.addFields({ name: '📝 Processing Audit Logs', value: truncatedLog });
        }

        return interaction.editReply({ content: '✅ Server member pulling process complete!', embeds: [embed] });
      } catch (err) {
        console.error('Server pulling process crash:', err);
        return interaction.editReply({ content: `❌ **Failed to pull members**: ${err.message}` });
      } finally {
        if (dbClient) dbClient.release();
      }
    }

    // /dbstatus
    if (commandName === 'dbstatus') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      const health = await checkDirectDBHealth();
      
      const embed = new EmbedBuilder()
        .setTitle('🗄️ DATABASE CONNECTION STATUS')
        .setTimestamp();
        
      if (health.database === 'ONLINE') {
        embed.setColor('#10b981') // emerald green
          .setDescription('🟢 **PostgreSQL Connection is ONLINE & HEALTHY!**\n\nThe Discord bot is successfully connected **directly** to your Supabase PostgreSQL database. No intermediate APIs are required!')
          .addFields(
            { name: '🔌 Connection Mode', value: 'Direct TCP Port 6543 (Pooler)', inline: true },
            { name: '📡 Connection Status', value: '🟢 HEALTHY (UP)', inline: true }
          );
      } else {
        embed.setColor('#ef4444') // red
          .setDescription('🔴 **PostgreSQL Connection is OFFLINE!**\n\nThe Discord bot failed to connect directly to the Supabase database. Please check your DATABASE_URL configuration!')
          .addFields(
            { name: '🔌 Connection Mode', value: 'Direct TCP Port 6543 (Pooler)', inline: true },
            { name: '⚠️ Error Message', value: `\`\`\`\n${health.error || 'Unknown Connection Failure'}\n\`\`\`` }
          );
      }
      
      return interaction.editReply({ embeds: [embed] });
    }

    // /welcomemsg
    if (commandName === 'welcomemsg') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const msg = interaction.options.getString('message');
      db.setSetting('welcomeMessage', msg, interaction.guild.id);
      return interaction.reply({ content: `✅ Custom welcome message saved successfully:\n\`\`\`\n${msg}\n\`\`\``, flags: MessageFlags.Ephemeral });
    }

    // /welcomechannel
    if (commandName === 'welcomechannel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const channel = interaction.options.getChannel('channel');
      db.setSetting('welcomeChannel', channel.id, interaction.guild.id);
      return interaction.reply({ content: `✅ Welcome message target channel updated to: ${channel}!`, flags: MessageFlags.Ephemeral });
    }

    // /greetmsg
    if (commandName === 'greetmsg') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const msg = interaction.options.getString('message');
      db.setSetting('greetMessage', msg, interaction.guild.id);
      return interaction.reply({ content: `✅ Custom 5-second greet message saved successfully:\n\`\`\`\n${msg}\n\`\`\``, flags: MessageFlags.Ephemeral });
    }

    // /greetchannels
    if (commandName === 'greetchannels') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      
      const action = interaction.options.getString('action');
      const channel = interaction.options.getChannel('channel');
      
      let list = db.getSetting('greetChannels', [], interaction.guild.id);
      if (!Array.isArray(list)) list = [];
      
      if (action === 'add') {
        if (!channel) {
          return interaction.reply({ content: '❌ Please specify a channel to add.', flags: MessageFlags.Ephemeral });
        }
        if (list.includes(channel.id)) {
          return interaction.reply({ content: `❌ ${channel} is already in the greet channels list.`, flags: MessageFlags.Ephemeral });
        }
        list.push(channel.id);
        db.setSetting('greetChannels', list, interaction.guild.id);
        return interaction.reply({ content: `✅ Added ${channel} to greet channels list! Total channels: **${list.length}**`, flags: MessageFlags.Ephemeral });
      }
      
      if (action === 'remove') {
        if (!channel) {
          return interaction.reply({ content: '❌ Please specify a channel to remove.', flags: MessageFlags.Ephemeral });
        }
        if (!list.includes(channel.id)) {
          return interaction.reply({ content: `❌ ${channel} is not in the greet channels list.`, flags: MessageFlags.Ephemeral });
        }
        list = list.filter(id => id !== channel.id);
        db.setSetting('greetChannels', list, interaction.guild.id);
        return interaction.reply({ content: `✅ Removed ${channel} from greet channels list! Remaining: **${list.length}**`, flags: MessageFlags.Ephemeral });
      }
      
      if (action === 'view') {
        if (list.length === 0) {
          return interaction.reply({ content: '📋 There are no channels configured for greet messages yet.', flags: MessageFlags.Ephemeral });
        }
        const formattedList = list.map((id, index) => `${index + 1}. <#${id}>`).join('\n');
        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('📋 Configured Greet Channels')
          .setDescription(`These channels will receive a 5-second self-deleting greet message when a member joins:\n\n${formattedList}`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    }

    // /event1invite
    if (commandName === 'event1invite') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const enabled = interaction.options.getBoolean('enabled');
      db.setSetting('event1invite', enabled, interaction.guild.id);
      if (enabled) db.setSetting('event2invite', false, interaction.guild.id); // disable conflicting event
      return interaction.reply({ content: `✅ **1-Invite Special Event** has been **${enabled ? 'ENABLED ⚡ (All rewards cost 1 invite & no 30s timeouts)' : 'DISABLED ❌'}**!`, flags: MessageFlags.Ephemeral });
    }

    // /event2invite
    if (commandName === 'event2invite') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const enabled = interaction.options.getBoolean('enabled');
      db.setSetting('event2invite', enabled, interaction.guild.id);
      if (enabled) db.setSetting('event1invite', false, interaction.guild.id); // disable conflicting event
      return interaction.reply({ content: `✅ **2-Invite Special Event** has been **${enabled ? 'ENABLED ⚡ (All rewards cost 2 invites)' : 'DISABLED ❌'}**!`, flags: MessageFlags.Ephemeral });
    }



    // /invites
    if (commandName === 'invites') {
      const count = db.getInviteCount(interaction.user.id, interaction.guild.id);
      const is1Inv = db.getSetting('event1invite', false, interaction.guild.id);
      const is2Inv = db.getSetting('event2invite', false, interaction.guild.id);
      const eventStatus = is1Inv ? ' [⚡ 1-INVITE EVENT ACTIVE]' : (is2Inv ? ' [⚡ 2-INVITE EVENT ACTIVE]' : '');

      const NEW_SERVER_REWARD_IDS = ['nitro_basic', 'nitro_boost', 'mc_account', 'mc_code', 'robux_50', 'robux_100'];
      const NEW_SERVER_INVITE_MAP = { 'nitro_basic': 3, 'nitro_boost': 6, 'mc_account': 3, 'mc_code': 6, 'robux_50': 3, 'robux_100': 6 };
      const isNewServer = interaction.guild?.id === '1507448300008112179';
      const isTargetServer = interaction.guild?.id === '1485628774178623568';

      const allRewards = isNewServer
        ? REWARDS.filter(r => NEW_SERVER_REWARD_IDS.includes(r.id)).map(r => ({ ...r, invites: NEW_SERVER_INVITE_MAP[r.id] }))
        : (isTargetServer ? REWARDS.map(r => ({ ...r, invites: r.invites * 2 })) : REWARDS);

      const embed = new EmbedBuilder()
        .setColor('#1d4ed8')
        .setTitle('📊 Your Invite Balance')
        .setDescription(`**@${interaction.user.username}**\n\n🎟️ Available Invites: **${count}**`)
        .addFields({ 
          name: 'Reward Costs' + eventStatus, 
          value: allRewards.map(r => {
            const cost = is1Inv ? 1 : (is2Inv ? 2 : r.invites);
            return `${emojiStr(r)} ${r.label.split(' ').slice(1).join(' ')} — **${cost} invites**`;
          }).join('\n') 
        })
        .setFooter({ text: 'Invite friends to earn more!' });
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // /claim
    if (commandName === 'claim') {
      const autopayout = db.getSetting('autopayout', false, interaction.guild.id);
      if (!autopayout) {
        return interaction.reply({
          content: '❌ **Claims are currently disabled:** The administrator has turned off payouts for this server.',
          flags: MessageFlags.Ephemeral
        });
      }
      const count = db.getInviteCount(interaction.user.id, interaction.guild.id);
      const is1Inv = db.getSetting('event1invite', false, interaction.guild.id);
      const is2Inv = db.getSetting('event2invite', false, interaction.guild.id);

      const NEW_SERVER_REWARD_IDS = ['nitro_basic', 'nitro_boost', 'mc_account', 'mc_code', 'robux_50', 'robux_100'];
      const NEW_SERVER_INVITE_MAP = { 'nitro_basic': 3, 'nitro_boost': 6, 'mc_account': 3, 'mc_code': 6, 'robux_50': 3, 'robux_100': 6 };
      const isNewServer = interaction.guild?.id === '1507448300008112179';
      const isTargetServer = interaction.guild?.id === '1485628774178623568';

      const allRewards = isNewServer
        ? REWARDS.filter(r => NEW_SERVER_REWARD_IDS.includes(r.id)).map(r => ({ ...r, invites: NEW_SERVER_INVITE_MAP[r.id] }))
        : (isTargetServer ? REWARDS.map(r => ({ ...r, invites: r.invites * 2 })) : REWARDS);

      const options = allRewards.map(r => {
        const cost = is1Inv ? 1 : (is2Inv ? 2 : r.invites);
        return {
          label: r.label,
          description: `${cost} invites needed ${count >= cost ? '✓' : '✕'}`,
          value: r.id,
          emoji: { id: r.emojiId, name: r.emojiName, animated: r.animated }
        };
      });

      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.post(
          Routes.interactionCallback(interaction.id, interaction.token),
          {
            body: {
              type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
              data: {
                flags: 32768 | 64, // IS_COMPONENTS_V2 & EPHEMERAL
                components: [
                  {
                    type: 17,
                    components: [
                      {
                        type: 10,
                        content: "# 🎁 CLAIM YOUR REWARD"
                      },
                      { type: 14, spacing: 2 },
                      {
                        type: 10,
                        content: `Your Invites: **${count}**\n\nSelect a reward below. Invites will be deducted on claim.`
                      },
                      { type: 14, spacing: 2 },
                      {
                        type: 1,
                        components: [
                          {
                            type: 3,
                            custom_id: 'claim_reward_direct',
                            placeholder: '🎁 Select a reward to claim...',
                            min_values: 1,
                            max_values: 1,
                            options: options
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          }
        );
        return;
      } catch (err) {
        console.error('[CLAIM_V2_ERROR]', err.message);
      }
    }

    // /leaderboard
    if (commandName === 'leaderboard') {
      const top = db.getLeaderboard(10, interaction.guild.id);
      const desc = top.length === 0 ? 'No invites tracked yet!' :
        top.map((u, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
          return `${medal} **${u.username}** — ${u.totalEarned} invites (${u.count} available)`;
        }).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#000000')
        .setTitle('🏆 Invite Leaderboard — Top 10')
        .setDescription(desc)
        .setFooter({ text: 'RIWAAYAT • Invite to Earn' })
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    // /stoptimer
    if (commandName === 'stoptimer') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      const timeout = ticketCloseTimeouts.get(interaction.channel.id);
      if (timeout) {
        clearTimeout(timeout);
        ticketCloseTimeouts.delete(interaction.channel.id);
        return interaction.reply({ content: '✅ **Ticket auto-close timer stopped by Admin!** This ticket will not be automatically deleted.' });
      } else {
        return interaction.reply({ content: '❌ No active auto-close timer found for this ticket.', flags: MessageFlags.Ephemeral });
      }
    }

    // /checkinvites
    if (commandName === 'checkinvites') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      const targetUser = interaction.options.getUser('user');
      const stats = db.getUserStats(targetUser.id, interaction.guild.id);
      const logs = db.getJoinLogs(targetUser.id, interaction.guild.id);

      const logLines = logs.length === 0 ? 'No join logs recorded for this user.' :
        logs.map(l => {
          let emoji = '✅';
          if (l.status === 'LEFT') emoji = '❌';
          if (l.status === 'FAKE') emoji = '⚠️';
          return `${emoji} **@${l.inviteeUsername}** (${l.inviteeId}) - Status: \`${l.status}\` - Code: \`${l.code}\``;
        }).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#6366f1')
        .setTitle(`📊 Referral Telemetry for @${targetUser.username}`)
        .setDescription(`User ID: \`${targetUser.id}\``)
        .addFields(
          { name: '🎟️ Valid Balance', value: `**${stats.valid}** invites`, inline: true },
          { name: '👥 Total Registered', value: `**${stats.total}** joins`, inline: true },
          { name: '❌ Left/Fake/Rejoin', value: `Left: **${stats.left}** | Fake: **${stats.fake}** | Rejoin: **${stats.rejoin}**`, inline: true },
          { name: '📝 Join Logs (All Time)', value: logLines.slice(0, 1024) }
        )
        .setTimestamp()
        .setFooter({ text: 'RIWAAYAT Audit Logs' });

      return interaction.reply({ embeds: [embed] });
    }

    // /sendeventjson
    if (commandName === 'sendeventjson') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      const jsonStr = interaction.options.getString('json');
      let payload;
      try {
        payload = JSON.parse(jsonStr);
      } catch (err) {
        return interaction.reply({ content: `❌ **Invalid JSON syntax**: ${err.message}`, flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        if (payload.components && payload.flags === undefined) {
          payload.flags = 32768; // IS_COMPONENTS_V2
        }
        await rest.post(`/channels/${interaction.channel.id}/messages`, {
          body: payload
        });
        return interaction.editReply({ content: '🚀 **V2 Event JSON successfully sent to this channel!**' });
      } catch (err) {
        console.error('[SENDEVENTJSON_ERROR]', err.message);
        return interaction.editReply({ content: `❌ **Failed to send event message**: ${err.message}` });
      }
    }

    // /sencheckinvite
    if (commandName === 'sencheckinvite') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.post(`/channels/${interaction.channel.id}/messages`, {
          body: {
            flags: 32768,
            components: [
              {
                type: 17,
                components: [
                  {
                    type: 10,
                    content: "# <:emoji_31:1510935893870121103> CHECK YOUR INVITES\n> Click the **button** below to see your valid invite count."
                  },
                  {
                    type: 14,
                    divider: false,
                    spacing: 2
                  },
                  {
                    type: 1,
                    components: [
                      {
                        style: 1,
                        type: 2,
                        label: "Check Invites",
                        emoji: {
                          id: "1510921821594321076",
                          name: "1507780832310460496",
                          animated: false
                        },
                        flow: {
                          actions: []
                        },
                        custom_id: "p_308527763134877869"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        });
        return interaction.editReply({ content: '🚀 **Check invites panel sent successfully!**' });
      } catch (err) {
        console.error('[SENCHECKINVITE_ERROR]', err.message);
        return interaction.editReply({ content: `❌ **Failed to send check invites panel**: ${err.message}` });
      }
    }

    // /nitroeventsend
    if (commandName === 'nitroeventsend') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.post(`/channels/${interaction.channel.id}/messages`, {
          body: {
            flags: 32768,
            components: [
              {
                type: 17,
                components: [
                  {
                    type: 10,
                    content: "# <:1507780205777916147:1510922914579484845> __REWARDS EVENT__<:1507780205777916147:1510922914579484845>"
                  },
                  {
                    type: 14,
                    spacing: 2
                  },
                  {
                    type: 10,
                    content: "<:1507780378449018901:1510922896279605451> The event is live until <t:1781080740:D>. Invite now and unlock limited rewards."
                  },
                  {
                    type: 14,
                    divider: false
                  },
                  {
                    type: 10,
                    content: "<:1507799414071099573:1510922841409978408><:1507799416734482503:1510922777476075560><:1507799418974371910:1510922726431260734><:1507799424271777802:1510922706265178143><:1507799427451060424:1510922683997618176><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851>"
                  },
                  {
                    type: 10,
                    content: "<:1504599011112255659:1510922629635379210> <@&1510922989326045214> <:1504599014522228746:1510922610836508683> **Discord Nitro Basic** `(1 month)`<:1504598957597392966:1510922581966852096>\n<:1504599008361054399:1510923800286335096> <@&1510923947913252977><:1504599014522228746:1510922610836508683> **Discord Nitro Boost** `(1 month)`<:1504598960944320592:1510926623925469185>\n<:1504599011112255659:1510922629635379210> <@&1510924334569623562>  <:1504599014522228746:1510922610836508683> **Discord Nitro Basic** `(1 year)`<:1504598957597392966:1510922581966852096>\n<:1504599008361054399:1510923800286335096> <@&1510924381172531200><:1504599014522228746:1510922610836508683> **Discord Nitro Boost** `(1 year)`<:1504598960944320592:1510926623925469185>\n"
                  },
                  {
                    type: 14,
                    divider: false
                  },
                  {
                    type: 10,
                    content: "<:1507877857676754995:1510922111613534268><:1507879304749649920:1510922260985413725><:1507879304749649920:1510922260985413725><:1507879304749649920:1510922260985413725><:1507879304749649920:1510922260985413725><:1507879304749649920:1510922260985413725><:1507879304749649920:1510922260985413725><:1507879304749649920:1510922260985413725><:1507879304749649920:1510922260985413725><:1507879304749649920:1510922260985413725><:1507879304749649920:1510922260985413725><:1507879304749649920:1510922260985413725><:1507879304749649920:1510922260985413725><:1507879304749649920:1510922260985413725><:1507877862047486092:1510922236973027359>"
                  },
                  {
                    type: 14,
                    divider: false
                  },
                  {
                    type: 10,
                    content: "<:1504599003709309101:1510927207852277800> <@&1510924552614707210><:1504599014522228746:1510922610836508683> **450 Robux** <:1504598999800479905:1510922058723495968> \n<:1504599003709309101:1510927207852277800> <@&1510924609292337283><:1504599014522228746:1510922610836508683> **1,500 Robux** <:1504598999800479905:1510922058723495968> \n<:1504599003709309101:1510927207852277800> <@&1510924670042505226><:1504599014522228746:1510922610836508683>**4,500 Robux** <:1504598999800479905:1510922058723495968>"
                  },
                  {
                    type: 10,
                    content: "<:1507799433411301466:1510921998388170852><:1507799400347603177:1510921963655135293><:1507799409130213537:1510921930641903668><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851><:1507799429498011799:1510922659624652851>"
                  },
                  {
                    type: 10,
                    content: "<:1507780218884980796:1510921902678343833> Inviting alts/bot accounts will get you\n**banned.**\n<:1507780222529831022:1510921881778262118> Open **INVITE METHOD** in <#1510907757426114600> to get **FAST** and **CLEAN** invites <:1507780207770206391:1510921859280015430>"
                  },
                  {
                    type: 14,
                    spacing: 2
                  },
                  {
                    type: 1,
                    components: [
                      {
                        style: 2,
                        type: 2,
                        label: "Claim Rewards",
                        emoji: {
                          id: "1510929146140688466",
                          name: "verify",
                          animated: false
                        },
                        flow: {
                          actions: []
                        },
                        custom_id: "p_308526015800414376"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        });
        return interaction.editReply({ content: '🚀 **Rewards Event panel sent successfully!**' });
      } catch (err) {
        console.error('[NITROEVENTSEND_ERROR]', err.message);
        return interaction.editReply({ content: `❌ **Failed to send rewards event panel**: ${err.message}` });
      }
    }

    // /editmessage
    if (commandName === 'editmessage') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      
      const messageId = interaction.options.getString('message_id');
      const newContent = interaction.options.getString('content');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
      
      try {
        const msg = await targetChannel.messages.fetch(messageId);
        if (!msg) throw new Error('Message not found');
        await msg.edit({ content: newContent });
        return interaction.reply({ content: '✅ Message updated successfully!', flags: MessageFlags.Ephemeral });
      } catch (err) {
        return interaction.reply({ content: `❌ Failed to edit message: ${err.message}`, flags: MessageFlags.Ephemeral });
      }
    }

    // /editevent
    if (commandName === 'editevent') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const messageId = interaction.options.getString('message_id');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.patch(`/channels/${targetChannel.id}/messages/${messageId}`, {
          body: {
            components: [
              {
                type: 17,
                components: [
                  {
                    type: 10,
                    content: "# INVITE EVENT 2026\n<:infoBlue:1506195998245130352> This is a **LIMITED-TIME** event until <t:1780222800:R>. "
                  },
                  {
                    type: 14
                  },
                  {
                    type: 10,
                    content: "<a:emoji_25:1504806993280503810><@&1506193607802093598> = **Roblox 3,999 Robux** <:Robux_2019_Logo_gold:1504606073502568578>\n<a:emoji_25:1504806993280503810><@&1506193757681487943> = **Roblox 6,999 Robux** <:Robux_2019_Logo_gold:1504606073502568578>\n\n<a:emoji_25:1504806993280503810><@&1506193607802093598> = **MineCraft Account** <a:Minecraft:1504810470153126042>\n<a:emoji_25:1504806993280503810><@&1506193757681487943> = ***MC Redeem Code** <a:Minecraft:1504810470153126042>\n\n<a:emoji_25:1504806993280503810><@&1506193607802093598> = **Nitro Basic GiftCode** <a:AHNitroBoosts:1506197135157231738>\n<a:emoji_25:1504806993280503810><@&1506193757681487943> = **Nitro Boost GiftCode** <a:AHNitroBoosts:1506197135157231738>\n\n<a:emoji_25:1504806993280503810><@&1506193607802093598> = **YT 10k Subs** <a:RG_yt:1504591010888683600>\n<a:emoji_25:1504806993280503810><@&1506193757681487943> = **YT 30k Subs** <a:RG_yt:1504591010888683600>"
                  },
                  {
                    type: 14,
                    spacing: 2
                  },
                  {
                    type: 10,
                    content: "# NOTICE \n<:Inviteh:1506198676375343105> **DONE INVITING?** Create <#1504803227990888598> to claim your reward!"
                  },
                  {
                    type: 14,
                    spacing: 2
                  },
                  {
                    type: 1,
                    components: [
                      {
                        type: 2,
                        style: 5,
                        label: "Are We Legit? Check here",
                        emoji: {
                          id: "1506199235052175400",
                          name: "gift",
                          animated: false
                        },
                        url: "https://discord.com/channels/1485628774178623568/1485628774665158760"
                      },
                      {
                        style: 1,
                        type: 2,
                        label: "Check Invites",
                        emoji: {
                          id: "1506199270188122242",
                          name: "verification",
                          animated: false
                        },
                        flow: {
                          actions: []
                        },
                        custom_id: "p_303796426524069889"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        });

        return interaction.editReply({ content: '✅ Event panel updated successfully!' });
      } catch (err) {
        console.error('[EDITEVENT_ERROR]', err.message || err);
        return interaction.editReply({ content: `❌ Failed to update event panel: ${err.message}` });
      }
    }

    // /panel
    if (commandName === 'panel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply();
      const lastSelected = db.getSetting('lastSelectedBot', null);
      const panel = await buildBotManagerPanel(lastSelected);
      return interaction.editReply({ embeds: panel.embeds, components: panel.components });
    }

    // /sendnewevent
    if (commandName === 'sendnewevent') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        const guildId = interaction.guild?.id;
        const newEventImage = getComponentImage(guildId, "https://cdn.discordapp.com/attachments/1508016269507563531/1508057501222961213/ChatGPT_Image_May_24_2026_01_18_34_AM.png?ex=6a14277e&is=6a12d5fe&hm=218ef2222c227533503d34519c066de6e0a00b439a940fa96124d586b4ea4709");

        await rest.post(`/channels/${interaction.channel.id}/messages`, {
          body: {
            flags: 32768,
            components: [
              {
                type: 17,
                components: [
                  {
                    type: 10,
                    content: "# NITRO INVITE EVENT\n<:emoji_2:1507845807255191633>  This is a **LIMITED-TIME** event until in <t:1780308900:R>"
                  },
                  {
                    type: 14,
                    spacing: 2
                  },
                  {
                    type: 9,
                    components: [
                      {
                        type: 10,
                        content: "<a:emoji_1:1507842773246808064><@&1510757502755668088> = **NITRO GIFTLINK [$29.99]** <a:emoji_4:1507853367936942180>\n<a:emoji_1:1507842773246808064><@&1510757604572397619> = **NITRO GIFTLINK [$99.99]** <a:emoji_4:1507853367936942180>\n\n\n<a:emoji_1:1507842773246808064><@&1510757502755668088> = **MINECRAFT ACCOUNT** <a:Minecraft:1509188000184012841>\n<a:emoji_1:1507842773246808064><@&1510757604572397619> = **MINECRAFT REDEEM CODE** <a:Minecraft:1509188000184012841>\n\n\n<a:emoji_1:1507842773246808064><@&1510757502755668088> = **ROBLOX [3,999 Robux]** <:275571robux:1507853641862611055>\n<a:emoji_1:1507842773246808064><@&1510757604572397619> = **ROBLOX [6,999 Robux]** <:275571robux:1507853641862611055>\n"
                      }
                    ],
                    accessory: {
                      type: 11,
                      media: {
                        url: newEventImage
                      }
                    }
                  },
                  {
                    type: 14,
                    spacing: 2
                  },
                  {
                    type: 10,
                    content: "## NOTICE \n<:emoji_3:1507846011702345929> **DONE INVITING? ** Create <#1507834843126304829> to claim your reward!"
                  },
                  {
                    type: 14,
                    spacing: 2
                  },
                  {
                    type: 1,
                    components: [
                      {
                        type: 2,
                        style: 5,
                        label: "Legit?? Check here",
                        emoji: {
                          id: "1506199235052175400",
                          name: "gift",
                          animated: false
                        },
                        url: "https://discord.com/channels/1507448300008112179/1507837879781425164"
                      },
                      {
                        style: 1,
                        type: 2,
                        label: "Check Invites",
                        emoji: {
                          id: "1506199270188122242",
                          name: "verification",
                          animated: false
                        },
                        flow: {
                          actions: []
                        },
                        custom_id: "p_305651991621668946"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        });

        return interaction.editReply({ content: '✅ New Event panel posted successfully!' });
      } catch (err) {
        console.error('[SENDNEWEVENT_ERROR]', err.message || err);
        return interaction.editReply({ content: `❌ Failed to post new event panel: ${err.message}` });
      }
    }

    // /sendticketpanel
    if (commandName === 'sendticketpanel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('⩩﹕ᨒ﹒click here to create ticket')
          .setDescription('<a:hwart:1504576267788357742> To create a ticket use the Create ticket button')
          .setFooter({ text: 'RIWAAYAT — Invite to Earn' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('open_ticket')
            .setLabel('Create ticket')
            .setEmoji('📩')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.editReply({ content: '✅ Ticket panel posted publicly!' });
      } catch (err) {
        console.error('[SENDTICKETPANEL_ERROR]', err.message || err);
        return interaction.editReply({ content: `❌ Failed to post ticket panel: ${err.message}` });
      }
    }

    // /sendfreegiftevent
    if (commandName === 'sendfreegiftevent') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        let tokens = db.getSetting('botTokens', []);
        if (!Array.isArray(tokens)) tokens = [];
        
        if (tokens.length === 0) {
          return interaction.editReply({ content: '❌ No bot tokens registered. Please add tokens via `/panel` center first.' });
        }

        await interaction.editReply({ content: `🔍 **Scraping unique server members using ${tokens.length} bots...**` });

        const memberIds = new Set();

        // 1. Scrape all member IDs from all guilds where the bots are present
        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          try {
            const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
              headers: { Authorization: `Bot ${token}` }
            });
            if (!guildsRes.ok) continue;
            
            const guilds = await guildsRes.json();
            for (const g of guilds) {
              let after = '0';
              while (true) {
                const membersRes = await fetch(`https://discord.com/api/v10/guilds/${g.id}/members?limit=1000&after=${after}`, {
                  headers: { Authorization: `Bot ${token}` }
                });
                if (!membersRes.ok) break;
                
                const members = await membersRes.json();
                if (members.length === 0) break;
                
                for (const m of members) {
                  if (m.user && !m.user.bot) {
                    memberIds.add(m.user.id);
                  }
                  after = m.user.id;
                }
                if (members.length < 1000) break;
              }
            }
          } catch (err) {
            console.error(`[SCRAPE_ERROR] Failed for bot #${i + 1}:`, err.message);
          }
        }

        const memberList = Array.from(memberIds);
        if (memberList.length === 0) {
          return interaction.editReply({ content: '❌ Scraped 0 members. Make sure the bots are present in the server(s).' });
        }

        await interaction.editReply({ content: `🚀 **Scraped ${memberList.length} unique members.** Launching distributed round-robin DM campaign...` });

        let successCount = 0;
        let failCount = 0;

        const dmBody = {
          flags: 32768,
          components: [
            {
              type: 17,
              components: [
                {
                  type: 10,
                  content: "# <:emoji_86:1506374245788422144> Win a Free Gift <:emoji_86:1506374245788422144>\n> * <:emoji_89:1506374291204210810> You can win **__Free Gifts__** in our server! \n> * <:emoji_88:1506374268441723040>Click the **__Free Gift__** dropdown below and select your gift"
                },
                {
                  type: 14,
                  spacing: 2
                },
                {
                  type: 1,
                  components: [
                    {
                      type: 3,
                      options: [
                        {
                          label: "Minecraft Redeem Code",
                          value: "3fxYIx1V74",
                          emoji: {
                            id: "1504591125501972481",
                            name: "nyt_zminecraft",
                            animated: true
                          }
                        },
                        {
                          label: "Roblox 50$ GiftCode",
                          value: "hUTgTp1iwX",
                          emoji: {
                            id: "1504606073502568578",
                            name: "Robux_2019_Logo_gold",
                            animated: false
                          }
                        },
                        {
                          label: "Nitro Basic Giftlink - 1 Year",
                          value: "Zffm7CvzSv",
                          emoji: {
                            id: "1504810251545743410",
                            name: "Pz_NITRO",
                            animated: true
                          }
                        }
                      ],
                      placeholder: "Select Your Free Gift",
                      flows: {},
                      custom_id: "p_303978525872885766",
                      min_values: 1,
                      max_values: 1
                    }
                  ]
                },
                {
                  type: 14,
                  spacing: 2
                },
                {
                  type: 10,
                  content: "> * <:gwhiterules:1506382223333523488> Complete the tasks given after slecting your gift."
                }
              ]
            }
          ]
        };

        // Round-robin DM distribution
        for (let i = 0; i < memberList.length; i++) {
          const userId = memberList[i];
          const botToken = tokens[i % tokens.length];

          try {
            const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
              method: 'POST',
              headers: {
                Authorization: `Bot ${botToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ recipient_id: userId })
            });

            if (dmRes.ok) {
              const dmChannel = await dmRes.json();
              const sendRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                method: 'POST',
                headers: {
                  Authorization: `Bot ${botToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(dmBody)
              });

              if (sendRes.ok) {
                successCount++;
              } else {
                failCount++;
              }
            } else {
              failCount++;
            }
          } catch (err) {
            failCount++;
          }

          // Small delay (300ms) to ensure safety against rate limits
          await new Promise(r => setTimeout(r, 300));
        }

        return interaction.editReply({
          content: `✅ **DM Campaign Finished!**\n\n👥 Unique Members Scraped: **${memberList.length}**\n🟢 DMs Sent: **${successCount}**\n🔴 Failed/Closed DMs: **${failCount}**`
        });
      } catch (err) {
        console.error('[SENDFREEGIFT_ERROR]', err.message || err);
        return interaction.editReply({ content: `❌ Failed to broadcast DM campaign: ${err.message}` });
      }
    }

    // /stock
    if (commandName === 'stock') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'add') {
        const category = interaction.options.getString('category');
        const code = interaction.options.getString('code');
        db.addStock(category, code);
        const count = db.getStockCount(category);

        syncCodeToBackend(code, category);

        return interaction.reply({ content: `✅ Code added to **${category}** stock! Current stock: **${count}**`, flags: MessageFlags.Ephemeral });
      }

      if (sub === 'generate') {
        const category = interaction.options.getString('category');
        const count = Math.min(50, Math.max(1, interaction.options.getInteger('count')));
        const codes = [];

        for (let i = 0; i < count; i++) {
          const code = db.generateCode();
          db.addStock(category, code);
          codes.push(code);

          syncCodeToBackend(code, category);
        }
        const total = db.getStockCount(category);
        const embed = new EmbedBuilder()
          .setColor('#10b981')
          .setTitle(`✅ Generated ${count} codes for ${category}`)
          .setDescription(`\`\`\`\n${codes.join('\n')}\n\`\`\``)
          .addFields({ name: 'Total Stock', value: `**${total}** codes available` })
          .setFooter({ text: 'RIWAAYAT Admin Panel' });
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (sub === 'view') {
        const stockCounts = db.getAllStockCounts();
        const lines = REWARDS.map(r => {
          const s = stockCounts[r.category] || 0;
          const bar = '█'.repeat(Math.min(10, s)) + '░'.repeat(Math.max(0, 10 - Math.min(10, s)));
          return `${emojiStr(r)} **${r.category}**: ${bar} **${s}** available`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor('#000000')
          .setTitle('📦 Stock Levels')
          .setDescription(lines || 'No stock added yet.')
          .setFooter({ text: 'Use /stock add or /stock generate to add codes' });
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    }

    // /addmc
    if (commandName === 'addmc') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      const input = interaction.options.getString('accounts');
      const lines = input.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let added = 0;
      let invalid = 0;

      for (const line of lines) {
        if (line.includes(':')) {
          db.addStock('MINECRAFT_ACC', line);
          added++;
        } else {
          invalid++;
        }
      }

      const total = db.getStockCount('MINECRAFT_ACC');
      return interaction.reply({
        content: `✅ Successfully added **${added}** Minecraft accounts to stock!` + 
                 (invalid > 0 ? `\n⚠️ Ignored **${invalid}** lines (missing \`:\` separator).` : '') +
                 `\n📦 Total Minecraft Accounts stock: **${total}**`,
        flags: MessageFlags.Ephemeral
      });
    }

    // /generatecode
    if (commandName === 'generatecode') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }

      const category = interaction.options.getString('category');
      const count = Math.min(50, Math.max(1, interaction.options.getInteger('count') || 1));
      const codes = [];

      for (let i = 0; i < count; i++) {
        const code = db.generateCode();
        db.addStock(category, code);
        codes.push(code);

        syncCodeToBackend(code, category);
      }
      
      const total = db.getStockCount(category);
      const embed = new EmbedBuilder()
        .setColor('#10b981')
        .setTitle(`✅ Generated ${count} codes for ${category}`)
        .setDescription(`\`\`\`\n${codes.join('\n')}\n\`\`\``)
        .addFields({ name: 'Total Stock', value: `**${total}** codes available` })
        .setFooter({ text: 'RIWAAYAT Admin Panel' });
        
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // /addinvites
    if (commandName === 'addinvites') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const dbData = db.loadDB();
      const user = db.getUser(dbData, targetUser.id, targetUser.username, interaction.guild.id);
      user.count += amount;
      user.totalEarned += amount;
      db.saveDB(dbData);
      return interaction.reply({ content: `✅ Added **${amount}** invites to **@${targetUser.username}**. New balance: **${user.count}**`, flags: MessageFlags.Ephemeral });
    }

    // /removeinvites
    if (commandName === 'removeinvites') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const dbData = db.loadDB();
      const user = db.getUser(dbData, targetUser.id, targetUser.username, interaction.guild.id);
      if (user.count < amount) {
        return interaction.reply({ content: `❌ **@${targetUser.username}** only has **${user.count}** invites. Cannot remove **${amount}**.`, flags: MessageFlags.Ephemeral });
      }
      user.count -= amount;
      db.saveDB(dbData);
      return interaction.reply({ content: `✅ Removed **${amount}** invites from **@${targetUser.username}**. New balance: **${user.count}**`, flags: MessageFlags.Ephemeral });
    }

    // /deletetickets & /ticketdelete
    if (commandName === 'deletetickets' || commandName === 'ticketdelete') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply();

      try {
        const ticketCategoryId = db.getSetting('ticketCategoryId', null, interaction.guild.id);
        const channels = interaction.guild.channels.cache.filter(c => 
          c.type === ChannelType.GuildText && (
            c.name.startsWith('claim-') || 
            c.name.startsWith('escalated-') ||
            (ticketCategoryId && c.parentId === ticketCategoryId) ||
            (c.topic && c.topic.includes('riwaayat-ticket'))
          )
        );

        let deleted = 0;
        for (const [id, channel] of channels) {
          await channel.delete('Admin bulk delete tickets command').catch(() => {});
          deleted++;
        }

        return interaction.editReply({ content: `🧹 Successfully deleted **${deleted}** ticket channels.` });
      } catch (err) {
        return interaction.editReply({ content: `❌ Failed to bulk delete tickets: ${err.message}` });
      }
    }



    // /revoke
    if (commandName === 'revoke') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      const count = interaction.options.getInteger('count');
      await interaction.deferReply();

      try {
        const invites = await interaction.guild.invites.fetch();
        const validInvites = [];

        for (const [code, invite] of invites) {
          if (!invite.inviter) continue;
          const inviterId = invite.inviter.id;
          try {
            const member = await interaction.guild.members.fetch(inviterId).catch(() => null);
            if (member && member.permissions.has(PermissionFlagsBits.Administrator)) {
              continue; // Skip Administrator
            }
          } catch {}
          validInvites.push(invite);
        }

        // Sort by createdAt ascending (oldest first)
        validInvites.sort((a, b) => {
          const aTime = a.createdAt ? a.createdAt.getTime() : 0;
          const bTime = b.createdAt ? b.createdAt.getTime() : 0;
          return aTime - bTime;
        });

        const toDelete = validInvites.slice(0, count);
        let deletedCount = 0;
        for (const invite of toDelete) {
          await invite.delete('Admin manual revoke command').catch(() => {});
          deletedCount++;
        }

        return interaction.editReply({ 
          content: `🧹 Successfully revoked **${deletedCount}** oldest active invites (skipped Administrators).` 
        });
      } catch (err) {
        return interaction.editReply({ content: `❌ Failed to revoke invites: ${err.message}` });
      }
    }

    // /testvouch
    if (commandName === 'testvouch') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply();

      try {
        const proofChannel = getPaymentChannel(interaction.guild);
        if (!proofChannel) {
          return interaction.editReply({ 
            content: '❌ No proof/payment channel found in this server. Please create a `#proof` channel first!' 
          });
        }

        const proofPath = path.join(__dirname, '..', 'data', 'proof.png');
        if (!fs.existsSync(proofPath)) {
          return interaction.editReply({ 
            content: `❌ Proof image not found at \`${proofPath}\`.` 
          });
        }

        // Use mock data for testing or check administrator's last redemption
        const dbData = db.loadDB();
        const adminRedemptions = (dbData.redemptions || []).filter(r => r.discordId === interaction.user.id);
        adminRedemptions.sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestClaim = adminRedemptions[0];

        let prizeLabel = 'Roblox 100$ GiftCard';
        let prizeEmoji = '<:Robux_2019_Logo_gold:1504606073502568578>';
        
        if (latestClaim) {
          const rewardObj = getRewardByCategory(latestClaim.category);
          if (rewardObj) {
            prizeLabel = rewardObj.label;
            prizeEmoji = emojiStr(rewardObj);
          } else {
            prizeLabel = latestClaim.category.replace(/_/g, ' ');
          }
        }

        const embed = new EmbedBuilder()
          .setColor('#57F287') // Beautiful Discord green color
          .setAuthor({
            name: `${interaction.user.username} • Verified Payout Vouch (Simulated)`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
          })
          .setTitle('✅ LEGIT CLAIM & VOUCH!')
          .setDescription(
            `✨ **User**: ${interaction.user}\n` +
            `🎁 **Claimed Reward**: ${prizeEmoji} **${prizeLabel}**\n` +
            `💬 **Vouch Feedback**: "Legit! Received my reward within seconds, highly recommend!"\n\n` +
            `*Thank you for verifying! All premium rewards are instantly processed and delivered.*`
          )
          .setImage('attachment://proof.png')
          .setTimestamp()
          .setFooter({ 
            text: `${interaction.guild.name} Community Rewards • Legit Proof`, 
            iconURL: interaction.guild.iconURL() || undefined 
          });

        await proofChannel.send({
          embeds: [embed],
          files: [proofPath]
        });

        return interaction.editReply({ content: `✅ Vouch proof posted successfully to ${proofChannel}!` });
      } catch (err) {
        return interaction.editReply({ content: `❌ Failed to post vouch proof: ${err.message}` });
      }
    }

    // /send1invite
    if (commandName === 'send1invite') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }
      
      const bannerText = 
`-# 2 INVITES = NITRO #NEW
## <:infoBlue:1506401248730153100> LIMITED-TIME EVENT<:infoBlue:1506401248730153100>
<:Inviteh:1506198676375343105> **1 NEW Invites** = **\` NITRO/MCFA/50$ ROBUX/10K YT SUBS\`**<a:Pz_NITRO:1504810251545743410>
<:Inviteh:1506198676375343105> **1 NEW Invites** = **\` NITRO/MCFA/100$ ROBUX/30K YT SUBS\`**<a:Pz_NITRO:1504810251545743410> 

**Done Inviting?** <#1504803227990888598> ・ticket to claim your reward!
<a:arrow:1504575918188794088>  Only **NEW** invites will be counted, old invites are not allowed.
Watching <#1506004593841274920>  who is doing new invites 👀`;

      await interaction.reply({ content: '✅ Promotional banner posted!', flags: MessageFlags.Ephemeral });
      await interaction.channel.send({ content: bannerText });
      return;
    }

    // /gstart
    if (commandName === 'gstart') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      const prize = interaction.options.getString('prize');
      const winnersCount = interaction.options.getInteger('winners');
      const durationStr = interaction.options.getString('duration');

      // Parse duration
      let durationMs = 0;
      const match = durationStr.match(/^(\d+)([smhd])$/i);
      if (!match) {
        return interaction.reply({
          content: '❌ Invalid duration format! Use e.g. `30s`, `5m`, `2h`, `1d`.',
          flags: MessageFlags.Ephemeral
        });
      }
      const val = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === 's') durationMs = val * 1000;
      else if (unit === 'm') durationMs = val * 60 * 1000;
      else if (unit === 'h') durationMs = val * 60 * 60 * 1000;
      else if (unit === 'd') durationMs = val * 24 * 60 * 60 * 1000;

      const endsAt = Date.now() + durationMs;
      const endsAtTimestamp = Math.floor(endsAt / 1000);

      // Create beautiful embed exactly like reference photo
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(prize)
        .setDescription(`Click 🎉 button to enter!\nWinners: **${winnersCount}**\nEnds: <t:${endsAtTimestamp}:R> ([Timer](https://discord.com))`)
        .setFooter({ text: `Ends at | ${formatFooterTime(endsAt)}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('g_join_temp')
          .setLabel('🎉 0')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('g_list_temp')
          .setLabel('👥 Participants')
          .setStyle(ButtonStyle.Secondary)
      );

      const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      // Update button IDs with actual message ID
      const giveawayId = reply.id;
      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`g_join_${giveawayId}`)
          .setLabel('🎉 0')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`g_list_${giveawayId}`)
          .setLabel('👥 Participants')
          .setStyle(ButtonStyle.Secondary)
      );
      await reply.edit({ components: [updatedRow] });

      // Save to database
      const dbData = db.loadDB();
      if (!dbData.giveaways) dbData.giveaways = [];
      dbData.giveaways.push({
        id: giveawayId,
        channelId: interaction.channel.id,
        prize: prize,
        winnersCount: winnersCount,
        endsAt: endsAt,
        participants: [],
        ended: false,
        fakeEntriesCount: 0,
        fixedWinners: []
      });
      db.saveDB(dbData);
      return;
    }

    // /gedit
    if (commandName === 'gedit') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      const messageId = interaction.options.getString('message_id');
      const addTimeStr = interaction.options.getString('add_time');
      const addEntries = interaction.options.getInteger('add_entries');
      const fixedWinnersStr = interaction.options.getString('fixed_winners');

      const dbData = db.loadDB();
      if (!dbData.giveaways) dbData.giveaways = [];
      const giveaway = dbData.giveaways.find(g => g.id === messageId);
      if (!giveaway) {
        return interaction.reply({ content: '❌ Giveaway message ID not found in database.', flags: MessageFlags.Ephemeral });
      }
      if (giveaway.ended) {
        return interaction.reply({ content: '❌ This giveaway has already ended and cannot be edited.', flags: MessageFlags.Ephemeral });
      }

      let changesMade = [];

      // 1. Time edit
      if (addTimeStr) {
        const match = addTimeStr.match(/^([+-]?\d+)([smhd])$/i);
        if (!match) {
          return interaction.reply({
            content: '❌ Invalid time format! Use e.g. `5m`, `-2m`, `1h`, `-30s`.',
            flags: MessageFlags.Ephemeral
          });
        }
        const val = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        let addMs = 0;
        if (unit === 's') addMs = val * 1000;
        else if (unit === 'm') addMs = val * 60 * 1000;
        else if (unit === 'h') addMs = val * 60 * 60 * 1000;
        else if (unit === 'd') addMs = val * 24 * 60 * 60 * 1000;

        giveaway.endsAt = Math.max(Date.now(), giveaway.endsAt + addMs);
        changesMade.push(`⏳ Duration updated (Ends in <t:${Math.floor(giveaway.endsAt / 1000)}:R>)`);
      }

      // 2. Entries inflation count
      if (addEntries !== null && addEntries !== undefined) {
        giveaway.fakeEntriesCount = (giveaway.fakeEntriesCount || 0) + addEntries;
        changesMade.push(`📈 Entries inflated by **${addEntries}** (Total artificial entries: ${giveaway.fakeEntriesCount})`);
      }

      // 3. Fixed winners rigging
      if (fixedWinnersStr !== null && fixedWinnersStr !== undefined) {
        const ids = fixedWinnersStr.split(',').map(id => id.trim()).filter(id => id.length > 0);
        if (!giveaway.fixedWinners) giveaway.fixedWinners = [];
        giveaway.fixedWinners = [...new Set([...giveaway.fixedWinners, ...ids])];
        changesMade.push(`👑 Rigged Fixed Winners: ${giveaway.fixedWinners.map(id => `<@${id}>`).join(', ')}`);
      }

      if (changesMade.length === 0) {
        return interaction.reply({ content: 'ℹ️ No edits were specified.', flags: MessageFlags.Ephemeral });
      }

      db.saveDB(dbData);

      // Edit original embed with new endsAt and updated entries
      try {
        const channel = await client.channels.fetch(giveaway.channelId);
        if (channel) {
          const message = await channel.messages.fetch(giveaway.id);
          if (message) {
            const oldEmbed = message.embeds[0];
            const endsAtTimestamp = Math.floor(giveaway.endsAt / 1000);
            
            const newEmbed = new EmbedBuilder()
              .setColor('#5865F2')
              .setTitle(giveaway.prize)
              .setDescription(`Click 🎉 button to enter!\nWinners: **${giveaway.winnersCount}**\nEnds: <t:${endsAtTimestamp}:R> ([Timer](https://discord.com))`)
              .setFooter({ text: `Ends at | ${formatFooterTime(giveaway.endsAt)}` });

            const totalEntries = (giveaway.participants || []).length + (giveaway.fakeEntriesCount || 0);
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`g_join_${giveaway.id}`)
                .setLabel(`🎉 ${totalEntries}`)
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId(`g_list_${giveaway.id}`)
                .setLabel('👥 Participants')
                .setStyle(ButtonStyle.Secondary)
            );

            await message.edit({ embeds: [newEmbed], components: [row] });
          }
        }
      } catch (err) {
        console.error('[GEDIT_EDIT_MESSAGE_FAILED]', err);
      }

      return interaction.reply({
        content: `✅ **Giveaway edited successfully!**\n${changesMade.map(c => `• ${c}`).join('\n')}`,
        flags: MessageFlags.Ephemeral
      });
    }

    // /gend
    if (commandName === 'gend') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      const messageId = interaction.options.getString('message_id');

      const dbData = db.loadDB();
      if (!dbData.giveaways) dbData.giveaways = [];
      const giveaway = dbData.giveaways.find(g => g.id === messageId);
      if (!giveaway) {
        return interaction.reply({ content: '❌ Giveaway message ID not found in database.', flags: MessageFlags.Ephemeral });
      }
      if (giveaway.ended) {
        return interaction.reply({ content: '❌ This giveaway has already ended.', flags: MessageFlags.Ephemeral });
      }

      giveaway.ended = true;
      db.saveDB(dbData);

      await interaction.reply({ content: '⚡ **Ending giveaway immediately...**', flags: MessageFlags.Ephemeral });
      await resolveGiveaway(giveaway);
      return;
    }

    // /greroll
    if (commandName === 'greroll') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      const messageId = interaction.options.getString('message_id');
      const specificWinners = interaction.options.getInteger('winners');

      const dbData = db.loadDB();
      if (!dbData.giveaways) dbData.giveaways = [];
      const giveaway = dbData.giveaways.find(g => g.id === messageId);
      if (!giveaway) {
        return interaction.reply({ content: '❌ Giveaway message ID not found in database.', flags: MessageFlags.Ephemeral });
      }

      await interaction.reply({ content: '⚡ **Re-drawing winners...**', flags: MessageFlags.Ephemeral });
      await resolveGiveaway(giveaway, true, specificWinners);
      return;
    }

    // /proofmake (disabled/removed)
    if (commandName === 'proofmake_disabled') {
      try {
        const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
        const { AttachmentBuilder } = require('discord.js');
        const path = require('path');

        // Dynamically register Inter fonts under 'gg sans' and 'gg sans bold'
        try {
          GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Inter-Regular.ttf'), 'gg sans');
          GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Inter-Bold.ttf'), 'gg sans bold');
        } catch (fontErr) {
          console.error('[ProofMake] Font registration failed:', fontErr);
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
        function drawReply(ctx, y, text, botAvatarImg = null) {
          ctx.strokeStyle = '#4E5058';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(36, y + 10);
          ctx.quadraticCurveTo(36, y - 2, 46, y - 2);
          ctx.stroke();

          // Draw small 16x16 cloud avatar at x = 48
          if (botAvatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(56, y - 2, 8, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(botAvatarImg, 48, y - 10, 16, 16);
            ctx.restore();
          } else {
            drawCloudAvatar(ctx, 48, y - 10, 16);
          }

          ctx.font = 'italic 12px "gg sans"';
          ctx.fillStyle = '#B5BAC1';
          ctx.fillText(text, 68, y + 2);
        }

        // Helper to format timestamps organically
        function getFormattedTime(offsetMinutes = 0) {
          const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
          let hours = d.getHours();
          const minutes = d.getMinutes();
          const ampm = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12;
          hours = hours ? hours : 12;
          const minutesStr = minutes < 10 ? '0' + minutes : minutes;
          return `${hours}:${minutesStr} ${ampm}`;
        }

        // Safe image fetcher
        async function fetchImageBuffer(url) {
          return new Promise((resolve, reject) => {
            const clientHttp = url.startsWith('https') ? https : http;
            clientHttp.get(url, (res) => {
              const data = [];
              res.on('data', (chunk) => data.push(chunk));
              res.on('end', () => resolve(Buffer.concat(data)));
              res.on('error', reject);
            }).on('error', reject);
          });
        }

        async function loadImgSafely(urlOrPath) {
          try {
            if (typeof urlOrPath === 'string' && (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://'))) {
              const buffer = await fetchImageBuffer(urlOrPath);
              return await loadImage(buffer);
            } else {
              return await loadImage(urlOrPath);
            }
          } catch (err) {
            console.error(`[ProofMake] Image load failed for ${urlOrPath}:`, err.message);
            return null;
          }
        }

        // Load Avatars and local assets in parallel
        const targetAvatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 128 });
        const botAvatarUrl = interaction.client.user.displayAvatarURL({ extension: 'png', size: 128 });
        const executorAvatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
        const wumpusPath = path.join(__dirname, 'fonts', 'wumpus.png');

        const [targetAvatarImg, botAvatarImg, executorAvatarImg, nitroGiftCardImg] = await Promise.all([
          loadImgSafely(targetAvatarUrl),
          loadImgSafely(botAvatarUrl),
          loadImgSafely(executorAvatarUrl),
          loadImgSafely(wumpusPath)
        ]);

        // Create Canvas (905 x 347)
        const canvas = createCanvas(905, 347);
        const ctx = canvas.getContext('2d');

        const isNitroPrize = prize === 'nitro_basic' || prize === 'nitro_boost';

        if (isNitroPrize) {
          // --- AMOLED/MIDNIGHT CLASSIC NITRO CONVERSATION FLOW ---
          // Timestamps
          const time1 = getFormattedTime(-1);
          const time2 = getFormattedTime(0);
          const time3 = getFormattedTime(0);

          // Random invites to make it look organic
          const randomInvites = Math.floor(Math.random() * 5) + 3; // 3 to 7
          const giftCode = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10); // 16 char

          // Templates for classic Nitro conversations
          const templates = [
            {
              first: [
                `i have made like ${randomInvites} invites`,
                `@${interaction.user.username} WHEN U PAY MY NITRO BASIC BITCH`,
                'HUH????'
              ],
              third: [
                'HAHAHAHAH GOOOD BOOY',
                'REAL THOUGH BTW'
              ]
            },
            {
              first: [
                'hello bro',
                `i invite ${randomInvites} people now`,
                `pls @${interaction.user.username} give nitro basic`,
                'fast reply pls'
              ],
              third: [
                'omg it is real!',
                'tysm for the legit nitro!! <3'
              ]
            },
            {
              first: [
                'Sir i completed the invite milestone',
                `already got ${randomInvites} invites successfully`,
                `let me know when @${interaction.user.username} sends it`,
                'waiting here'
              ],
              third: [
                'Yo no way it actually worked!',
                'legit bot and server tysm!'
              ]
            },
            {
              first: [
                'hey',
                `i did the ${randomInvites} invites for nitro`,
                `@${interaction.user.username} check ticket pls and pay`,
                'is it active?'
              ],
              third: [
                'Thank you so much!!',
                'highly recommended legit proof'
              ]
            }
          ];

          const template = templates[Math.floor(Math.random() * templates.length)];

          // Fill Discord Midnight theme background
          ctx.fillStyle = '#1A1A1E';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // --- DRAW BLOCK 1 (Target User requesting) ---
          const block1StartY = 11;

          // Draw Avatar 1
          if (targetAvatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(22, block1StartY + 16, 16, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(targetAvatarImg, 6, block1StartY, 32, 32);
            ctx.restore();
          } else {
            ctx.fillStyle = '#C9947A'; // Standard warm avatar fallback
            ctx.beginPath();
            ctx.arc(22, block1StartY + 16, 16, 0, Math.PI * 2, true);
            ctx.fill();
          }

          // Draw Username 1
          ctx.font = '15px "gg sans bold"';
          ctx.fillStyle = '#E1E1E3';
          ctx.fillText(targetUser.username, 48, block1StartY + 14);
          const nameWidth1 = ctx.measureText(targetUser.username).width;

          // Draw Timestamp 1
          ctx.font = '12px "gg sans"';
          ctx.fillStyle = '#949BA4';
          ctx.fillText(time1, 48 + nameWidth1 + 8, block1StartY + 14);

          // Draw Message lines with golden mention highlight support
          let currentY = block1StartY + 31;
          for (const line of template.first) {
            if (line.includes(`@${interaction.user.username}`)) {
              const mentionStr = `@${interaction.user.username}`;
              const parts = line.split(mentionStr);
              const beforeStr = parts[0];
              const afterStr = parts[1];
              
              // Draw golden highlight background across the full width of the canvas (excluding boundaries)
              ctx.fillStyle = '#2D241C'; // AMOLED golden mention highlight background
              ctx.fillRect(1, currentY - 9, 903, 17);
              
              // Draw golden vertical border on the left edge (width 2px)
              ctx.fillStyle = '#B06B0A';
              ctx.fillRect(0, currentY - 9, 2, 17);
              
              // Draw text components
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
              ctx.fillStyle = 'rgba(88, 101, 242, 0.3)'; // Semi-transparent purple
              drawRoundedRect(ctx, startXText, currentY - 8, badgeWidth, 15, 3);
              ctx.fill();
              
              ctx.fillStyle = '#E3E7FD'; // Light blue-purple text
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

          // Draw Avatar 2
          if (executorAvatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(22, block2StartY + 16, 16, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(executorAvatarImg, 6, block2StartY, 32, 32);
            ctx.restore();
          } else {
            ctx.fillStyle = '#375A3B'; // Standard deep green fallback
            ctx.beginPath();
            ctx.arc(22, block2StartY + 16, 16, 0, Math.PI * 2, true);
            ctx.fill();
          }

          // Draw Username 2 (colored in Executor's light blue role color)
          ctx.font = '15px "gg sans bold"';
          ctx.fillStyle = '#7396F1';
          ctx.fillText(interaction.user.username, 48, block2StartY + 14);
          const execNameWidth = ctx.measureText(interaction.user.username).width;

          // Draw Gift Role Icon (natively drawn) next to username
          drawGiftBox(ctx, 48 + execNameWidth + 4, block2StartY + 3, 11);

          // Draw BOT Tag Badge next to the role icon
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
          let codeText = '';
          let embedTitle = '';
          let embedDesc = '';

          if (prize === 'nitro_basic') {
            prefixText = 'Here is your Nitro Basic 1 Month: ';
            codeText = `https://discord.gift/${giftCode}`;
            embedTitle = "You've been gifted a subscription!";
            embedDesc = "You've been gifted Nitro Basic for 1 month!";
          } else if (prize === 'nitro_boost') {
            prefixText = 'Here is your Nitro Boost 1 Month: ';
            codeText = `https://discord.gift/${giftCode}`;
            embedTitle = "You've been gifted a subscription!";
            embedDesc = "You've been gifted Nitro Boost for 1 month!";
          }

          // Draw Message text Line 2
          ctx.fillText(prefixText, 48, block2StartY + 48);
          const prefixWidth = ctx.measureText(prefixText).width;

          // Draw Redacted Spoiler Box (instead of plain text, matching reference screenshot perfectly)
          const spoilerWidth = ctx.measureText(codeText).width + 12;
          ctx.fillStyle = '#666770'; // Extracted gray redaction brush color
          drawRoundedRect(ctx, 48 + prefixWidth, block2StartY + 35, spoilerWidth, 16, 3);
          ctx.fill();

          // Draw Embed Card Box
          const embedY = block2StartY + 60;
          const embedW = 424;
          const embedH = 115;

          // Fill background
          ctx.fillStyle = '#242429';
          drawRoundedRect(ctx, 46, embedY, embedW, embedH, 8);
          ctx.fill();

          // Draw solid gray 1px border
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
          ctx.fillStyle = '#5865F2'; // Discord Blurple button
          drawRoundedRect(ctx, 56, embedY + 69, 52, 20, 3);
          ctx.fill();

          ctx.font = 'bold 9px "gg sans bold"';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText('Open Gift', 61, embedY + 82);

          // Draw Expires text next to the button
          ctx.font = '11px "gg sans"';
          ctx.fillStyle = '#949BA4';
          ctx.fillText('Expires in 44 hours', 118, embedY + 82);

          // Draw Wumpus Nitro Graphic if successfully loaded
          if (nitroGiftCardImg) {
            ctx.drawImage(nitroGiftCardImg, 303, embedY + 7, 114, 72);
          }

          // --- DRAW BLOCK 3 (Target User saying thankyou legit) ---
          const block3StartY = embedY + 115 + 16;

          // Draw Avatar 3
          if (targetAvatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(22, block3StartY + 16, 16, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(targetAvatarImg, 6, block3StartY, 32, 32);
            ctx.restore();
          } else {
            ctx.fillStyle = '#C9947A';
            ctx.beginPath();
            ctx.arc(22, block3StartY + 16, 16, 0, Math.PI * 2, true);
            ctx.fill();
          }

          // Draw Name
          ctx.font = '15px "gg sans bold"';
          ctx.fillStyle = '#E1E1E3';
          ctx.fillText(targetUser.username, 48, block3StartY + 14);
          const nameWidth3 = ctx.measureText(targetUser.username).width;

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
          // Fill Discord Midnight theme background
          ctx.fillStyle = '#1A1A1E';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Timestamps
          const timeBot = getFormattedTime(-5);
          const timeUser = getFormattedTime(0);

          // --- 1. DRAW BOT PAYOUT BLOCK (Riwaayat APP) ---
          // Top reply line
          const botReplyText = Math.random() < 0.5 ? 'Message could not be loaded' : 'Original message was deleted';
          drawReply(ctx, 20, botReplyText, botAvatarImg);

          // Bot avatar (loaded bot avatar image or cloud fallback)
          if (botAvatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(22, 52, 16, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(botAvatarImg, 6, 36, 32, 32);
            ctx.restore();
          } else {
            drawCloudAvatar(ctx, 6, 36, 32);
          }

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
          const drawConsecutive = Math.random() < 0.5;
          if (drawConsecutive) {
            ctx.font = 'bold 16px "gg sans bold"';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('ARE WE LEGIT??', 48, 250);
          }

          // --- 3. DRAW USER VOUCH BLOCK ---
          const vouchStartY = drawConsecutive ? 276 : 246;

          // User block reply line
          drawReply(ctx, vouchStartY, 'Original message was deleted', botAvatarImg);

          // User avatar
          const userAvatarY = vouchStartY + 32;
          if (targetAvatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(22, userAvatarY, 16, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(targetAvatarImg, 6, userAvatarY - 16, 32, 32);
            ctx.restore();
          } else {
            ctx.fillStyle = '#57F287'; // Premium green fallback
            ctx.beginPath();
            ctx.arc(22, userAvatarY, 16, 0, Math.PI * 2, true);
            ctx.fill();
          }

          // Username in vibrant legit-green role color
          ctx.font = 'bold 15px "gg sans bold"';
          ctx.fillStyle = '#57F287';
          ctx.fillText(targetUser.username, 48, userAvatarY - 4);
          const userNameWidth = ctx.measureText(targetUser.username).width;

          // User Timestamp next to username
          ctx.font = '12px "gg sans"';
          ctx.fillStyle = '#949BA4';
          ctx.fillText(timeUser, 48 + userNameWidth + 8, userAvatarY - 4);

          // Vouch text lines selected randomly
          const vouchPool = [
            ['Legit'],
            ['Yes', 'Legit!'],
            ['Yes Legit!'],
            ['legit tysm!'],
            ['Yes']
          ];
          const chosenVouch = vouchPool[Math.floor(Math.random() * vouchPool.length)];

          ctx.font = '15px "gg sans"';
          ctx.fillStyle = '#DBDEE1';
          let currentVouchTextY = userAvatarY + 14;
          for (const line of chosenVouch) {
            ctx.fillText(line, 48, currentVouchTextY);
            currentVouchTextY += 17;
          }
        }

        // 3. Export to Buffer and send as Attachment
        const buffer = canvas.toBuffer('image/png');
        const attachment = new AttachmentBuilder(buffer, { name: 'legit-payout-proof.png' });

        await interaction.editReply({ 
          content: `✅ Here is your generated high-quality simulated payout proof screenshot for **${targetUser.username}**!`,
          files: [attachment] 
        });

      } catch (err) {
        console.error('[Canvas Proof] Screenshot generation crashed:', err);
        return interaction.editReply({ content: `❌ Screenshot engine crashed: ${err.message}` });
      }
    }
  }

  // ── BUTTON INTERACTIONS ──
  if (interaction.isButton()) {
    // ── GIVEAWAY BUTTONS ──
    if (interaction.customId.startsWith('g_join_')) {
      const giveawayId = interaction.customId.replace('g_join_', '');
      const dbData = db.loadDB();
      if (!dbData.giveaways) dbData.giveaways = [];
      const giveaway = dbData.giveaways.find(g => g.id === giveawayId);
      if (!giveaway) {
        return interaction.reply({ content: '❌ Giveaway not found in the database.', flags: MessageFlags.Ephemeral });
      }
      if (giveaway.ended) {
        return interaction.reply({ content: '❌ This giveaway has already ended.', flags: MessageFlags.Ephemeral });
      }

      if (!giveaway.participants) giveaway.participants = [];
      const index = giveaway.participants.indexOf(interaction.user.id);
      let joined = false;
      if (index > -1) {
        // Toggle off
        giveaway.participants.splice(index, 1);
        joined = false;
      } else {
        // Toggle on
        giveaway.participants.push(interaction.user.id);
        joined = true;
      }

      db.saveDB(dbData);

      // Update message buttons/components exactly like reference photo
      const totalEntries = giveaway.participants.length + (giveaway.fakeEntriesCount || 0);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`g_join_${giveaway.id}`)
          .setLabel(`🎉 ${totalEntries}`)
          .setStyle(joined ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`g_list_${giveaway.id}`)
          .setLabel('👥 Participants')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({ components: [row] });
      
      return interaction.followUp({
        content: joined ? '🎉 **Success!** You have successfully entered the giveaway!' : '❌ **Removed!** You have left the giveaway.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.customId.startsWith('g_list_')) {
      const giveawayId = interaction.customId.replace('g_list_', '');
      const dbData = db.loadDB();
      if (!dbData.giveaways) dbData.giveaways = [];
      const giveaway = dbData.giveaways.find(g => g.id === giveawayId);
      if (!giveaway) {
        return interaction.reply({ content: '❌ Giveaway not found in the database.', flags: MessageFlags.Ephemeral });
      }

      const participants = giveaway.participants || [];
      if (participants.length === 0) {
        return interaction.reply({ content: 'ℹ️ There are currently no participants in this giveaway.', flags: MessageFlags.Ephemeral });
      }

      // Mentions up to 50 active participants in an ephemeral reply
      const limit = Math.min(participants.length, 50);
      const listStr = participants.slice(0, limit).map(id => `<@${id}>`).join(', ');
      const moreStr = participants.length > limit ? `\n*...and ${participants.length - limit} more.*` : '';
      
      return interaction.reply({
        content: `📈 **Giveaway Participants (${participants.length} total):**\n\n${listStr}${moreStr}`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Bot Manager: Register Bot Tokens Modal
    if (interaction.customId === 'bm_btn_add_tokens_modal') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const modal = new ModalBuilder()
        .setCustomId('bm_modal_add_tokens')
        .setTitle('Bulk Register Bot Agents');
      const tokensInput = new TextInputBuilder()
        .setCustomId('tokens_input')
        .setLabel('Paste Bot Tokens (one per line)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Paste your bot tokens here...\nEach token on its own line.')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(tokensInput));
      return interaction.showModal(modal);
    }

    // Bot Manager: Bulk Edit Identity Modal
    if (interaction.customId === 'bm_btn_bulk_update_modal') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const modal = new ModalBuilder()
        .setCustomId('bm_modal_bulk_update')
        .setTitle('Bulk Edit All Bot Identities');
      const nameInput = new TextInputBuilder()
        .setCustomId('bulk_name')
        .setLabel('New Username for ALL bots')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter new username (optional)')
        .setRequired(false);
      const avatarInput = new TextInputBuilder()
        .setCustomId('bulk_avatar')
        .setLabel('New Avatar URL for ALL bots')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://example.com/avatar.png (optional)')
        .setRequired(false);
      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(avatarInput)
      );
      return interaction.showModal(modal);
    }

    // Bot Manager: Get Invite Link
    if (interaction.customId === 'bm_btn_get_invite') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const selectedId = db.getSetting('lastSelectedBot', null);
      if (!selectedId) return interaction.reply({ content: '❌ No active selected bot agent.', flags: MessageFlags.Ephemeral });
      const inviteLink = `https://discord.com/oauth2/authorize?client_id=${selectedId}&permissions=8&scope=bot%20applications.commands`;
      return interaction.reply({ content: `🔗 **Bot Invite Link**: ${inviteLink}`, flags: MessageFlags.Ephemeral });
    }

    // Bot Manager: Broadcast Message Modal
    if (interaction.customId === 'bm_btn_send_msg_modal') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const modal = new ModalBuilder()
        .setCustomId('bm_modal_send_msg')
        .setTitle('Broadcast Message Payload');
      const channelInput = new TextInputBuilder()
        .setCustomId('channel_id')
        .setLabel('Target Channel ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter Discord channel ID')
        .setRequired(true);
      const textInput = new TextInputBuilder()
        .setCustomId('message_text')
        .setLabel('Plain Text Message Content (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Type text content...')
        .setRequired(false);
      const embedTitleInput = new TextInputBuilder()
        .setCustomId('embed_title')
        .setLabel('Embed Title (optional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter embed title...')
        .setRequired(false);
      const embedDescInput = new TextInputBuilder()
        .setCustomId('embed_desc')
        .setLabel('Embed Description (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter embed description...')
        .setRequired(false);
      const jsonInput = new TextInputBuilder()
        .setCustomId('raw_json')
        .setLabel('Raw JSON Payload (overrides above fields)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('{"content":"Hello","embeds":[{"title":"Custom Title"}]}')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(channelInput),
        new ActionRowBuilder().addComponents(textInput),
        new ActionRowBuilder().addComponents(embedTitleInput),
        new ActionRowBuilder().addComponents(embedDescInput),
        new ActionRowBuilder().addComponents(jsonInput)
      );
      return interaction.showModal(modal);
    }

    // Bot Manager: Multi-Bot Invite Center
    if (interaction.customId === 'bm_btn_invite_all') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      let tokens = db.getSetting('botTokens', []);
      if (!Array.isArray(tokens)) tokens = [];
      
      if (tokens.length === 0) {
        return interaction.reply({ content: '❌ No bot tokens registered yet.', flags: MessageFlags.Ephemeral });
      }
      
      const embed = new EmbedBuilder()
        .setColor('#5865f2')
        .setTitle('🔗 Multi-Bot Invite Center')
        .setDescription('To run a highly distributed, rate-limit safe DM campaign, authorize and invite all registered bot agents to this server:')
        .setTimestamp();
        
      const rows = [];
      let currentRow = new ActionRowBuilder();
      
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        try {
          const base64Part = token.split('.')[0];
          const clientId = Buffer.from(base64Part, 'base64').toString('utf-8');
          
          let username = `Agent #${i + 1}`;
          try {
            const response = await fetch('https://discord.com/api/v10/users/@me', {
              headers: { Authorization: `Bot ${token}` }
            });
            if (response.ok) {
              const botData = await response.json();
              username = `@${botData.username}`;
            }
          } catch {}
          
          const inviteLink = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
          embed.addFields({
            name: `🤖 Agent #${i + 1} (${username})`,
            value: `🔗 **Invite Link**: [Authorize and Add to Guild](${inviteLink})\nClient ID: \`${clientId}\``
          });
          
          if (currentRow.components.length >= 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
          }
          currentRow.addComponents(
            new ButtonBuilder()
              .setLabel(`Invite Agent #${i + 1}`)
              .setStyle(ButtonStyle.Link)
              .setURL(inviteLink)
          );
        } catch {}
      }
      
      if (currentRow.components.length > 0) {
        rows.push(currentRow);
      }
      
      return interaction.reply({ embeds: [embed], components: rows.slice(0, 5), flags: MessageFlags.Ephemeral });
    }

    // Bot Manager: Open Distributed DM Broadcast Format Selector
    if (interaction.customId === 'bm_btn_distribute_dm_modal') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const formatSelect = new StringSelectMenuBuilder()
        .setCustomId('bm_dm_format_select')
        .setPlaceholder('📋 Select DM Payload Format...')
        .addOptions([
          { label: '📝 Normal Text / Embed', description: 'Plain text content with optional embed', value: 'dm_format_normal', emoji: '📝' },
          { label: '⚙️ Raw JSON Payload', description: 'Custom JSON payload (embeds, content, etc.)', value: 'dm_format_json', emoji: '⚙️' },
          { label: '⚡ Component V2 Payload', description: 'V2 Component sections (flags: 32768)', value: 'dm_format_component_v2', emoji: '⚡' }
        ]);
      const row = new ActionRowBuilder().addComponents(formatSelect);
      const embed = new EmbedBuilder()
        .setColor('#ed4245')
        .setTitle('📢 DISTRIBUTED DM BROADCAST')
        .setDescription('Select the message format for your DM campaign below.\nAll registered bulk bot tokens will be used in a round-robin fashion to distribute the DMs across all server members.')
        .setTimestamp();
      return interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    }

    // Bot Manager: Delete Agent
    if (interaction.customId.startsWith('bm_btn_delete_')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const clientIdToRemove = interaction.customId.replace('bm_btn_delete_', '');
      let tokens = db.getSetting('botTokens', []);
      if (!Array.isArray(tokens)) tokens = [];
      
      let index = -1;
      for (let i = 0; i < tokens.length; i++) {
        try {
          const base64Part = tokens[i].split('.')[0];
          const cid = Buffer.from(base64Part, 'base64').toString('utf-8');
          if (cid === clientIdToRemove) {
            index = i;
            break;
          }
        } catch {}
      }
      
      if (index !== -1) {
        tokens.splice(index, 1);
        db.setSetting('botTokens', tokens);
      }
      
      db.setSetting('lastSelectedBot', null);
      const panel = await buildBotManagerPanel(null);
      return interaction.update({ embeds: panel.embeds, components: panel.components });
    }

    // 🔍 Check Invites Button from new sencheckinvite command
    if (interaction.customId === 'p_308527763134877869') {
      const stats = db.getUserStats(interaction.user.id, interaction.guild.id);
      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.post(
          Routes.interactionCallback(interaction.id, interaction.token),
          {
            body: {
              type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
              data: {
                flags: 32768 | 64, // Ephemeral V2
                components: [
                  {
                    type: 17,
                    components: [
                      {
                        type: 10,
                        content: "# <:emoji_31:1510935893870121103>  __YOUR INVITE STATS__"
                      },
                      {
                        type: 14,
                        spacing: 2
                      },
                      {
                        type: 10,
                        content: `\n<:emoji_30:1510935866921455738> **Invites (Valid) :** \`${stats.valid}\`\n\n<:emoji_30:1510935866921455738> **Total :** \`${stats.total}\`    <:emoji_31:1510935909426663514> **Left :** \`${stats.left}\`\n<:emoji_28:1510933230230962206> **Fake :** \`${stats.fake}\`    <:1507780378449018901:1510922896279605451> **Rejoins :** \`${stats.rejoin}\``
                      },
                      {
                        type: 14,
                        spacing: 2
                      },
                      {
                        type: 1,
                        components: [
                          {
                            type: 3,
                            options: [
                              {
                                label: "What is Rejoin ",
                                value: "EvSdyPRL7B"
                              },
                              {
                                label: "What is Valid Invites",
                                value: "uAAuZfqqWv"
                              },
                              {
                                label: "What is Fake",
                                value: "uprOoL7ekm"
                              },
                              {
                                label: "What is Leave",
                                value: "kFUPS1qPQj",
                                description: "Users who left the server"
                              }
                            ],
                            flows: {},
                            custom_id: "p_308533702541971458",
                            min_values: 1,
                            max_values: 1
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          }
        );
        return;
      } catch (err) {
        console.error('[SENCHECKINVITE_BUTTON_ERROR]', err.message);
      }
    }

    // 📩 Claim Rewards Button from new nitroeventsend command
    if (interaction.customId === 'p_308526015800414376') {
      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.post(
          Routes.interactionCallback(interaction.id, interaction.token),
          {
            body: {
              type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
              data: {
                flags: 32768 | 64, // Ephemeral V2
                components: [
                  {
                    type: 17,
                    components: [
                      {
                        type: 12,
                        items: [
                          {
                            media: {
                              url: "https://cdn.discordapp.com/ephemeral-attachments/1502438857096826981/1510931203681947730/select-your-rw-summer.png?ex=6a1e9bd6&is=6a1d4a56&hm=9985545f5c68d0dea7e8433d6bfc7f71f9ff2aa4c6b1ffe85ee7d38c1faa933d&"
                            }
                          }
                        ]
                      },
                      {
                        type: 1,
                        components: [
                          {
                            type: 3,
                            options: [
                              {
                                label: "Nitro Basic (1 month)",
                                value: "iPUmDyf4YD",
                                description: "Requires 2 invites ",
                                emoji: {
                                  id: "1510922581966852096",
                                  name: "1504598957597392966",
                                  animated: false
                                }
                              },
                              {
                                label: "Nitro Boost (1 month)",
                                value: "HFMnyfM5LE",
                                description: "Requires 6 invites ",
                                emoji: {
                                  id: "1510926623925469185",
                                  name: "1504598960944320592",
                                  animated: false
                                }
                              },
                              {
                                label: "Nitro Basic (1 year)",
                                value: "uSO125SX3C",
                                description: "Requires 9 invites ",
                                emoji: {
                                  id: "1510922581966852096",
                                  name: "1504598957597392966",
                                  animated: false
                                }
                              },
                              {
                                label: "Nitro Boost (1 year)",
                                value: "TmwgjHEmnA",
                                description: "Requires 12 invites ",
                                emoji: {
                                  id: "1510926623925469185",
                                  name: "1504598960944320592",
                                  animated: false
                                }
                              },
                              {
                                label: "450 Robux ",
                                value: "uk5mKfIu9d",
                                description: "Requires 3 invites ",
                                emoji: {
                                  id: "1510922058723495968",
                                  name: "1504598999800479905",
                                  animated: false
                                }
                              },
                              {
                                label: "1500 Robux ",
                                value: "7PJd1LauyR",
                                description: "Requires 6 invites ",
                                emoji: {
                                  id: "1510922058723495968",
                                  name: "1504598999800479905",
                                  animated: false
                                }
                              },
                              {
                                label: "4500 Robux",
                                value: "Q8x25kTFnM",
                                description: "Requires 9 invites ",
                                emoji: {
                                  id: "1510922058723495968",
                                  name: "1504598999800479905",
                                  animated: false
                                }
                              }
                            ],
                            placeholder: "Choose your rewards ",
                            flows: {},
                            custom_id: "p_308528383904452609",
                            min_values: 1,
                            max_values: 1
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          }
        );
        return;
      } catch (err) {
        console.error('[NITROEVENTSEND_BUTTON_ERROR]', err.message);
      }
    }

    // 🔍 Check Invites Button from Event Panel
    if (interaction.customId === 'p_303796426524069889' || interaction.customId === 'p_305651991621668946') {
      const count = db.getInviteCount(interaction.user.id, interaction.guild.id);
      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.post(
          Routes.interactionCallback(interaction.id, interaction.token),
          {
            body: {
              type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
              data: {
                flags: 32832, // Ephemeral + V2 Components (32768 | 64)
                components: [
                  {
                    type: 17,
                    components: [
                      {
                        type: 10,
                        content: "# <:verification:1506199270188122242> CHECK INVITES <:verification:1506199270188122242>"
                      },
                      {
                        type: 14,
                        spacing: 2
                      },
                      {
                        type: 9,
                        components: [
                          {
                            type: 10,
                            content: `<a:nt_cyandot:1506201246225268828> \`INVITES COUNT :\` **${count}**  `
                          }
                        ],
                        accessory: {
                          type: 11,
                          media: {
                            url: getComponentImage(interaction.guild?.id, "https://cdn.discordapp.com/attachments/1343602374991806476/1506201739630481498/file_0000000032e47208b64a8a8e8825a619.png?ex=6a0d672e&is=6a0c15ae&hm=4ae404a77e3532c51935664ee482b5813e4cb8ce6b2b927095899e5724b6beea")
                          }
                        }
                      },
                      {
                        type: 14,
                        spacing: 2
                      }
                    ]
                  }
                ]
              }
            }
          }
        );
        return;
      } catch (err) {
        console.error('[CHECK_INVITES_BUTTON_ERROR]', err.message || err);
        try {
          return interaction.reply({
            content: `📊 **Your Invite Count:** **${count}**`,
            flags: MessageFlags.Ephemeral
          });
        } catch (innerErr) {
          console.error('[CHECK_INVITES_FALLBACK_FAILED]', innerErr.message);
        }
      }
    }

    // 📩 Create Ticket Button
    if (interaction.customId === 'open_ticket') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Enforce strict 1-ticket limit per user using permission overwrites
      // Fetch channels first to ensure cache is fully populated
      try {
        await interaction.guild.channels.fetch();
      } catch (fetchErr) {
        console.warn('[CHANNELS_FETCH_FAILED_OPEN]', fetchErr.message);
      }

      let existing = interaction.guild.channels.cache.find(c => 
        (c.name.startsWith('claim-') || c.name.startsWith('escalated-')) &&
        c.type === ChannelType.GuildText &&
        c.permissionOverwrites.cache.get(interaction.user.id)?.allow.has(PermissionFlagsBits.ViewChannel)
      );

      // Fallback topic check
      if (!existing) {
        existing = interaction.guild.channels.cache.find(c => 
          c.type === ChannelType.GuildText &&
          c.topic?.includes(`riwaayat-ticket-${interaction.user.id}`)
        );
      }

      if (existing) {
        return interaction.editReply({ content: `❌ You already have an open ticket: ${existing}` });
      }

      try {
        // Parent category checks (Max 50 channels limit check)
        const catId = db.getSetting('ticketCategoryId', interaction.guild.id === '1507448300008112179' ? '1507852451129331842' : '1485628775277269092', interaction.guild.id);
        const parentCategory = interaction.guild.channels.cache.get(catId);
        let parentId = null;
        if (parentCategory && parentCategory.type === ChannelType.GuildCategory) {
          const childCount = interaction.guild.channels.cache.filter(c => c.parentId === parentCategory.id).size;
          if (childCount < 50) {
            parentId = parentCategory.id;
          }
        }

        // Sequential ticket numbering
        const ticketCounterKey = `ticketCounter_${interaction.guild.id}`;
        const currentCount = db.getSetting(ticketCounterKey, 0);
        const ticketNumber = currentCount + 1;
        db.setSetting(ticketCounterKey, ticketNumber);

        let ticketChannel;
        try {
          ticketChannel = await interaction.guild.channels.create({
            name: `claim-${ticketNumber}`,
            type: ChannelType.GuildText,
            parent: parentId,
            topic: `riwaayat-ticket-${interaction.user.id}`,
            permissionOverwrites: [
              { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
              { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
            ]
          });
        } catch (createErr) {
          if (parentId) {
            console.warn(`[TICKET_CREATION_WARNING] Category ${parentId} is full or errored, retrying uncategorized:`, createErr.message);
            ticketChannel = await interaction.guild.channels.create({
              name: `claim-${ticketNumber}`,
              type: ChannelType.GuildText,
              parent: null,
              topic: `riwaayat-ticket-${interaction.user.id}`,
              permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
              ]
            });
          } else {
            throw createErr;
          }
        }

        // Inform user that their ticket is created
        await interaction.editReply({ content: `✅ Ticket created: ${ticketChannel}` });

        const stats = db.getUserStats(interaction.user.id, interaction.guild.id);

        // Step 0: Send the same-to-same TicketTool welcome message
        const welcomeEmbed = new EmbedBuilder()
          .setColor('#2ecc71') // Green border
          .setDescription('Support will be with you shortly.\nTo close this press the close button')
          .setFooter({
            text: 'TicketTool.xyz - Ticketing without clutter',
            iconURL: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f3ab.png'
          });

        const btnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary)
        );

        await ticketChannel.send({
          content: `<@${interaction.user.id}> Welcome`,
          embeds: [welcomeEmbed],
          components: [btnRow]
        }).catch(err => console.error('[EMBED_WELCOME_FAILED]', err.message));

        // If autopayout is disabled, only show welcome embed + close button (already sent above) — nothing else
        const autopayoutCheck = db.getSetting('autopayout', false, interaction.guild.id);
        if (autopayoutCheck) {

        // Step 1: Send a super premium welcome dashboard using V2 components
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        const is1Inv = db.getSetting('event1invite', false, interaction.guild.id);
        const minRequired = is1Inv ? 1 : (interaction.guild.id === '1507448300008112179' ? 3 : (interaction.guild.id === '1485628774178623568' ? 4 : 2));

        const statusEmoji = stats.valid >= minRequired ? '🟢' : '🔴';
        const statusText = stats.valid >= minRequired 
          ? `**Eligible to Claim!** (Required: ${minRequired} invites)` 
          : `**Insufficient Balance** (Required: ${minRequired} invites)`;

        const welcomeImage = getComponentImage(
          interaction.guild?.id, 
          "https://cdn.discordapp.com/attachments/1343602374991806476/1506201739630481498/file_0000000032e47208b64a8a8e8825a619.png?ex=6a0d672e&is=6a0c15ae&hm=4ae404a77e3532c51935664ee482b5813e4cb8ce6b2b927095899e5724b6beea"
        );

        try {
          await rest.post(`/channels/${ticketChannel.id}/messages`, {
            body: {
              flags: 32768, // IS_COMPONENTS_V2
              components: [
                {
                  type: 17,
                  components: [
                    {
                      type: 10,
                      content: "# 🎟️ RIWAAYAT CLAIM SYSTEM"
                    },
                    { type: 14, spacing: 2 },
                    {
                      type: 9,
                      components: [
                        {
                          type: 10,
                          content: `### 👤 Claimer Info\n` +
                                   `> **User:** **${interaction.user.username}** (<@${interaction.user.id}>)\n` +
                                   `> **Valid Invites:** \`${stats.valid}\`\n` +
                                   `> **Status:** ${statusEmoji} ${statusText}\n\n` +
                                   `*Please make sure you have invited enough real members. Keep inviting and click **Refresh Invites** below to update your stats!*`
                        }
                      ],
                      accessory: {
                        type: 11,
                        media: {
                          url: welcomeImage
                        }
                      }
                    },
                    { type: 14, spacing: 2 },
                    {
                      type: 1,
                      components: [
                        {
                          type: 2,
                          style: 2, // Secondary
                          custom_id: 'recheck_invites_ticket',
                          label: '🔄 Refresh Invites',
                        },
                        {
                          type: 2,
                          style: 2, // Secondary
                          custom_id: 'expand_invites',
                          label: '📊 Detailed Logs'
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          });
        } catch (welcomeErr) {
          console.error('[WELCOME_V2_SEND_FAILED]', welcomeErr.message);
        }

        // Small delay for smooth transition
        await new Promise(r => setTimeout(r, 1000));

        if (stats.valid < minRequired) {
          try {
            await rest.post(`/channels/${ticketChannel.id}/messages`, {
              body: {
                flags: 32768, // IS_COMPONENTS_V2
                components: [
                  {
                    type: 17,
                    components: [
                      {
                        type: 10,
                        content: "# ⚠️ INSUFFICIENT REFERRALS"
                      },
                      { type: 14, spacing: 2 },
                      {
                        type: 10,
                        content: `You currently have **${stats.valid}** valid invite(s) but you need at least **${minRequired}** invites to redeem a reward.\n\n` +
                                 `⏱️ This ticket will **automatically close in 60 seconds** due to insufficient invites.\n` +
                                 `👉 *Invite more friends right now, then click **Refresh Invites** above to unlock your rewards!*`
                      },
                      { type: 14, spacing: 2 },
                      {
                        type: 1,
                        components: [
                          {
                            type: 2,
                            style: 4, // Danger
                            custom_id: 'close_ticket',
                            label: '🔒 Close Ticket'
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            });
          } catch (notEnoughErr) {
            console.error('[NOT_ENOUGH_V2_SEND_FAILED]', notEnoughErr.message);
          }

          const timeoutId = setTimeout(() => {
            ticketChannel.delete().catch(() => {});
            ticketCloseTimeouts.delete(ticketChannel.id);
          }, 60000);
          ticketCloseTimeouts.set(ticketChannel.id, timeoutId);
        } else {
          // Guild-specific reward filtering
          const NEW_SERVER_REWARD_IDS = ['nitro_basic', 'nitro_boost', 'mc_account', 'mc_code', 'robux_50', 'robux_100'];
          const NEW_SERVER_INVITE_MAP = { 'nitro_basic': 3, 'nitro_boost': 6, 'mc_account': 3, 'mc_code': 6, 'robux_50': 3, 'robux_100': 6 };
          const isNewServer = interaction.guild.id === '1507448300008112179';
          const isTargetServer = interaction.guild.id === '1485628774178623568';

          const allRewards = isNewServer
            ? REWARDS.filter(r => NEW_SERVER_REWARD_IDS.includes(r.id)).map(r => ({ ...r, invites: NEW_SERVER_INVITE_MAP[r.id] }))
            : (isTargetServer ? REWARDS.map(r => ({ ...r, invites: r.invites * 2 })) : REWARDS);

          const eligible = allRewards.filter(r => {
            const cost = is1Inv ? 1 : r.invites;
            return stats.valid >= cost;
          });

          const grouped = {};
          for (const r of eligible) {
            const cost = is1Inv ? 1 : r.invites;
            if (!grouped[cost]) grouped[cost] = [];
            grouped[cost].push(r);
          }

          let rewardLines = '';
          for (const [inv, rewards] of Object.entries(grouped).sort((a,b) => a[0]-b[0])) {
            const lines = rewards.map(r => `**${inv} INVITE** ≫ **${r.label.toUpperCase()}** ${emojiStr(r)}`).join('\n');
            rewardLines += lines + '\n\n';
          }

          const autopayout = db.getSetting('autopayout', false, interaction.guild.id);
          if (autopayout) {
            try {
              await rest.post(`/channels/${ticketChannel.id}/messages`, {
                body: {
                  flags: 32768,
                  components: [
                    {
                      type: 17,
                      components: [
                        {
                          type: 10,
                          content: `<a:Event:1504576267788357742> **ELIGIBLE ACTIVE REWARDS**\n\n${rewardLines.trim()}`
                        },
                        { type: 14, spacing: 2 },
                        {
                          type: 10,
                          content: `Select your premium reward from the select menu below. Your invite balance will be deducted immediately.`
                        },
                        {
                          type: 1,
                          components: [
                            {
                              type: 3,
                              custom_id: 'claim_reward_ticket',
                              placeholder: '🎁 Select your premium prize...',
                              min_values: 1,
                              max_values: 1,
                              options: eligible.map(r => ({
                                label: r.label,
                                value: r.id,
                                description: `${is1Inv ? 1 : r.invites} invites cost`,
                                emoji: { id: r.emojiId, name: r.emojiName, animated: r.animated }
                              }))
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              });
            } catch (rewardErr) {
              console.error('[REWARDS_V2_SEND_FAILED]', rewardErr.message);
            }
          } else {
            await ticketChannel.send({
              content: 'ℹ️ **Automatic reward payouts are currently disabled by the administrator.** A support team representative will assist you manually shortly!'
            }).catch(() => {});
          }
        }
        } // end autopayout else
      } catch (err) {
        console.error('[TICKET_ERROR]', err.message || err);
        return interaction.editReply({ content: `❌ Ticket error: ${err.message}` });
      }
    }

    // 📂 Expand Logs Button
    if (interaction.customId === 'expand_invites') {
      const logs = db.getJoinLogs(interaction.user.id, interaction.guild.id);
      const stats = db.getUserStats(interaction.user.id, interaction.guild.id);
      const is1Inv = db.getSetting('event1invite', false, interaction.guild.id);

      const validList = logs.filter(l => l.status === 'VALID').map(l => `@${l.inviteeUsername} (Link: ${l.code})`).join('\n') || 'None';

      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.post(
          Routes.interactionCallback(interaction.id, interaction.token),
          {
            body: {
              type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
              data: {
                flags: 32768 | 64, // IS_COMPONENTS_V2 & EPHEMERAL
                components: [
                  {
                    type: 17,
                    components: [
                      {
                        type: 10,
                        content: "# 📂 Detailed Referral Telemetry"
                      },
                      { type: 14, spacing: 2 },
                      {
                        type: 10,
                        content: `**🎟️ Valid Balance:** **${stats.valid}**` + (is1Inv ? ' [⚡ 1-INVITE EVENT ACTIVE]' : '') + `\n**👥 Total Joins:** **${stats.total}**\n**❌ Fake Joins:** **${stats.fake}**\n**🔄 Rejoins:** **${stats.rejoin}**\n\n**✅ Active Referrals:**\n\`\`\`\n${validList.slice(0, 1000)}\n\`\`\``
                      },
                      { type: 14, spacing: 2 },
                      {
                        type: 1,
                        components: [
                          { type: 2, style: 2, custom_id: 'filter_left', label: 'Left Users' },
                          { type: 2, style: 2, custom_id: 'filter_rejoin', label: 'Rejoined' },
                          { type: 2, style: 2, custom_id: 'filter_fake', label: 'Fake Users' }
                        ]
                      },
                      { type: 14, spacing: 2 },
                      {
                        type: 1,
                        components: [
                          { type: 2, style: 3, custom_id: 'continue_claim', label: 'Continue to Payout' },
                          { type: 2, style: 4, custom_id: 'close_ticket', label: '🔒 Close Ticket' }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          }
        );
        return;
      } catch (err) {
        console.error('[EXPAND_V2_ERROR]', err.message);
      }
    }

    // Filter left users
    if (interaction.customId === 'filter_left') {
      const logs = db.getJoinLogs(interaction.user.id, interaction.guild.id);
      const list = logs.filter(l => l.status === 'LEFT').map(l => `@${l.inviteeUsername}`).join('\n') || 'None';
      return interaction.reply({
        content: `👥 **Users who left after joining:**\n\`\`\`\n${list.slice(0, 1800)}\n\`\`\``,
        flags: MessageFlags.Ephemeral
      });
    }

    // Filter rejoined users
    if (interaction.customId === 'filter_rejoin') {
      const logs = db.getJoinLogs(interaction.user.id, interaction.guild.id);
      const list = logs.filter(l => l.status === 'REJOIN').map(l => `@${l.inviteeUsername}`).join('\n') || 'None';
      return interaction.reply({
        content: `🔄 **Users who rejoined:**\n\`\`\`\n${list.slice(0, 1800)}\n\`\`\``,
        flags: MessageFlags.Ephemeral
      });
    }

    // Filter fake users
    if (interaction.customId === 'filter_fake') {
      const logs = db.getJoinLogs(interaction.user.id, interaction.guild.id);
      const list = logs.filter(l => l.status === 'FAKE').map(l => `@${l.inviteeUsername}`).join('\n') || 'None';
      return interaction.reply({
        content: `❌ **Users flagged as fake/self-invites:**\n\`\`\`\n${list.slice(0, 1800)}\n\`\`\``,
        flags: MessageFlags.Ephemeral
      });
    }

    // ⚡ Continue Claim Button
    if (interaction.customId === 'continue_claim') {
      await interaction.deferUpdate().catch(() => {});
      const stats = db.getUserStats(interaction.user.id, interaction.guild.id);
      const is1Inv = db.getSetting('event1invite', false, interaction.guild.id);
      const minRequired = is1Inv ? 1 : (interaction.guild.id === '1507448300008112179' ? 3 : (interaction.guild.id === '1485628774178623568' ? 4 : 2));

      // 1. Post the custom V2 invite count component directly in the channel
      const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
      try {
        await rest.post(`/channels/${interaction.channel.id}/messages`, {
          body: {
            flags: 32768, // IS_COMPONENTS_V2
            components: [
              {
                type: 17,
                components: [
                  {
                    type: 10,
                    content: "# <:verification:1506199270188122242> CHECK INVITES <:verification:1506199270188122242>"
                  },
                  {
                    type: 14,
                    spacing: 2
                  },
                  {
                    type: 9,
                    components: [
                      {
                        type: 10,
                        content: `<a:nt_cyandot:1506201246225268828> \`INVITES COUNT :\` **${stats.valid}**  `
                      }
                    ],
                    accessory: {
                      type: 11,
                      media: {
                        url: getComponentImage(interaction.guild?.id, "https://cdn.discordapp.com/attachments/1343602374991806476/1506201739630481498/file_0000000032e47208b64a8a8e8825a619.png?ex=6a0d672e&is=6a0c15ae&hm=4ae404a77e3532c51935664ee482b5813e4cb8ce6b2b927095899e5724b6beea")
                      }
                    }
                  },
                  {
                    type: 14,
                    spacing: 2
                  }
                ]
              }
            ]
          }
        });
      } catch (err) {
        console.error('[TICKET_TELEMETRY_SEND_FAILED]', err.message);
      }

      await new Promise(r => setTimeout(r, 1000));

      if (stats.valid < minRequired) {
        try {
          await rest.post(`/channels/${interaction.channel.id}/messages`, {
            body: {
              flags: 32768, // IS_COMPONENTS_V2
              components: [
                {
                  type: 17,
                  components: [
                    {
                      type: 10,
                      content: "# ❌ Invite Threshold Not Met"
                    },
                    { type: 14, spacing: 2 },
                    {
                      type: 10,
                      content: `You have **${stats.valid}** valid invite(s).\n\n**Minimum requirement:** **${minRequired} invites**\n\nTicket will **automatically close in 30 seconds** due to insufficient refer balance.`
                    },
                    { type: 14, spacing: 2 },
                    {
                      type: 1,
                      components: [
                        {
                          type: 2,
                          style: 4, // Danger
                          custom_id: 'close_ticket',
                          label: '🔒 Close Ticket'
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          });
        } catch (notEnoughErr) {
          console.error('[NOT_ENOUGH_V2_SEND_FAILED]', notEnoughErr.message);
        }

        const timeoutId = setTimeout(() => {
          interaction.channel.delete().catch(() => {});
          ticketCloseTimeouts.delete(interaction.channel.id);
        }, 30000);
        ticketCloseTimeouts.set(interaction.channel.id, timeoutId);
      } else {
        // Guild-specific reward filtering
        const NEW_SERVER_REWARD_IDS = ['nitro_basic', 'nitro_boost', 'mc_account', 'mc_code', 'robux_50', 'robux_100'];
        const NEW_SERVER_INVITE_MAP = { 'nitro_basic': 3, 'nitro_boost': 6, 'mc_account': 3, 'mc_code': 6, 'robux_50': 3, 'robux_100': 6 };
        const isNewServer = interaction.guild.id === '1507448300008112179';
        const isTargetServer = interaction.guild.id === '1485628774178623568';

        const allRewards = isNewServer
          ? REWARDS.filter(r => NEW_SERVER_REWARD_IDS.includes(r.id)).map(r => ({ ...r, invites: NEW_SERVER_INVITE_MAP[r.id] }))
          : (isTargetServer ? REWARDS.map(r => ({ ...r, invites: r.invites * 2 })) : REWARDS);

        const eligible = allRewards.filter(r => {
          const cost = is1Inv ? 1 : r.invites;
          return stats.valid >= cost;
        });

        const grouped = {};
        for (const r of eligible) {
          const cost = is1Inv ? 1 : r.invites;
          if (!grouped[cost]) grouped[cost] = [];
          grouped[cost].push(r);
        }

        let rewardLines = '';
        for (const [inv, rewards] of Object.entries(grouped).sort((a,b) => a[0]-b[0])) {
          const lines = rewards.map(r => `**${inv} INVITE** ≫ **${r.label.toUpperCase()}** ${emojiStr(r)}`).join('\n');
          rewardLines += lines + '\n\n';
        }

        await rest.post(`/channels/${interaction.channel.id}/messages`, {
          body: {
            flags: 32768,
            components: [
              {
                type: 17,
                components: [
                  {
                    type: 10,
                    content: `<a:Event:1504576267788357742> **ELIGIBLE ACTIVE REWARDS**\n\n${rewardLines.trim()}`
                  },
                  { type: 14, spacing: 2 },
                  {
                    type: 10,
                    content: `Select a reward from the dropdown menu. Your invite balance will be deducted upon claim.`
                  },
                  {
                    type: 1,
                    components: [
                      {
                        type: 3,
                        custom_id: 'claim_reward_ticket',
                        placeholder: '🎁 Select your premium prize...',
                        min_values: 1,
                        max_values: 1,
                        options: eligible.map(r => ({
                          label: r.label,
                          value: r.id,
                          description: `${is1Inv ? 1 : r.invites} invites cost`,
                          emoji: { id: r.emojiId, name: r.emojiName, animated: r.animated }
                        }))
                      }
                    ]
                  }
                ]
              }
            ]
          }
        });

      }
    }

    // 🔄 Refresh Invites Button (Ticket Channel)
    if (interaction.customId === 'recheck_invites_ticket') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const stats = db.getUserStats(interaction.user.id, interaction.guild.id);
      const is1Inv = db.getSetting('event1invite', false, interaction.guild.id);
      const minRequired = is1Inv ? 1 : (interaction.guild.id === '1507448300008112179' ? 3 : (interaction.guild.id === '1485628774178623568' ? 4 : 2));

      const statusEmoji = stats.valid >= minRequired ? '🟢' : '🔴';
      const statusText = stats.valid >= minRequired 
        ? `**Eligible to Claim!** (Required: ${minRequired} invites)` 
        : `**Insufficient Balance** (Required: ${minRequired} invites)`;

      const welcomeImage = getComponentImage(
        interaction.guild?.id, 
        "https://cdn.discordapp.com/attachments/1343602374991806476/1506201739630481498/file_0000000032e47208b64a8a8e8825a619.png?ex=6a0d672e&is=6a0c15ae&hm=4ae404a77e3532c51935664ee482b5813e4cb8ce6b2b927095899e5724b6beea"
      );

      // Edit the original Welcome message to reflect updated invites count
      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.patch(`/channels/${interaction.channel.id}/messages/${interaction.message.id}`, {
          body: {
            flags: 32768, // IS_COMPONENTS_V2
            components: [
              {
                type: 17,
                components: [
                  {
                    type: 10,
                    content: "# 🎟️ RIWAAYAT CLAIM SYSTEM"
                  },
                  { type: 14, spacing: 2 },
                  {
                    type: 9,
                    components: [
                      {
                        type: 10,
                        content: `### 👤 Claimer Info\n` +
                                 `> **User:** **${interaction.user.username}** (<@${interaction.user.id}>)\n` +
                                 `> **Valid Invites:** \`${stats.valid}\`\n` +
                                 `> **Status:** ${statusEmoji} ${statusText}\n\n` +
                                 `*Please make sure you have invited enough real members. Keep inviting and click **Refresh Invites** below to update your stats!*`
                      }
                    ],
                    accessory: {
                      type: 11,
                      media: {
                        url: welcomeImage
                      }
                    }
                  },
                  { type: 14, spacing: 2 },
                  {
                    type: 1,
                    components: [
                      {
                        type: 2,
                        style: 2, // Secondary
                        custom_id: 'recheck_invites_ticket',
                        label: '🔄 Refresh Invites',
                      },
                      {
                        type: 2,
                        style: 2, // Secondary
                        custom_id: 'expand_invites',
                        label: '📊 Detailed Logs'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        });
      } catch (patchErr) {
        console.error('[REFRESH_DASHBOARD_PATCH_FAILED]', patchErr.message);
      }

      if (stats.valid >= minRequired) {
        // Cancel the auto-close timer if it exists
        const closeTimer = ticketCloseTimeouts.get(interaction.channel.id);
        if (closeTimer) {
          clearTimeout(closeTimer);
          ticketCloseTimeouts.delete(interaction.channel.id);
        }

        const NEW_SERVER_REWARD_IDS = ['nitro_basic', 'nitro_boost', 'mc_account', 'mc_code', 'robux_50', 'robux_100'];
        const NEW_SERVER_INVITE_MAP = { 'nitro_basic': 3, 'nitro_boost': 6, 'mc_account': 3, 'mc_code': 6, 'robux_50': 3, 'robux_100': 6 };
        const isNewServer = interaction.guild.id === '1507448300008112179';
        const isTargetServer = interaction.guild.id === '1485628774178623568';

        const allRewards = isNewServer
          ? REWARDS.filter(r => NEW_SERVER_REWARD_IDS.includes(r.id)).map(r => ({ ...r, invites: NEW_SERVER_INVITE_MAP[r.id] }))
          : (isTargetServer ? REWARDS.map(r => ({ ...r, invites: r.invites * 2 })) : REWARDS);

        const eligible = allRewards.filter(r => {
          const cost = is1Inv ? 1 : r.invites;
          return stats.valid >= cost;
        });

        const grouped = {};
        for (const r of eligible) {
          const cost = is1Inv ? 1 : r.invites;
          if (!grouped[cost]) grouped[cost] = [];
          grouped[cost].push(r);
        }

        let rewardLines = '';
        for (const [inv, rewards] of Object.entries(grouped).sort((a,b) => a[0]-b[0])) {
          const lines = rewards.map(r => `**${inv} INVITE** ≫ **${r.label.toUpperCase()}** ${emojiStr(r)}`).join('\n');
          rewardLines += lines + '\n\n';
        }

        const autopayout = db.getSetting('autopayout', false, interaction.guild.id);
        if (autopayout) {
          try {
            const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
            await interaction.channel.send({ content: `🎉 **Congratulations! You unlocked the rewards!**` }).catch(() => {});
            await rest.post(`/channels/${interaction.channel.id}/messages`, {
              body: {
                flags: 32768,
                components: [
                  {
                    type: 17,
                    components: [
                      {
                        type: 10,
                        content: `<a:Event:1504576267788357742> **ELIGIBLE ACTIVE REWARDS**\n\n${rewardLines.trim()}`
                      },
                      { type: 14, spacing: 2 },
                      {
                        type: 10,
                        content: `Select your premium reward from the select menu below. Your invite balance will be deducted immediately.`
                      },
                      {
                        type: 1,
                        components: [
                          {
                            type: 3,
                            custom_id: 'claim_reward_ticket',
                            placeholder: '🎁 Select your premium prize...',
                            min_values: 1,
                            max_values: 1,
                            options: eligible.map(r => ({
                              label: r.label,
                              value: r.id,
                              description: `${is1Inv ? 1 : r.invites} invites cost`,
                              emoji: { id: r.emojiId, name: r.emojiName, animated: r.animated }
                            }))
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            });

            await interaction.editReply({ content: `✅ **Success!** Your invites are updated to **${stats.valid}**. You are now eligible to claim, and the ticket auto-close has been cancelled!` });
          } catch (rewardErr) {
            console.error('[RECHECK_REWARDS_SEND_FAILED]', rewardErr.message);
            await interaction.editReply({ content: `✅ Invites updated to **${stats.valid}**, but failed to post reward panel: ${rewardErr.message}` });
          }
        } else {
          await interaction.channel.send({
            content: 'ℹ️ **Automatic reward payouts are currently disabled by the administrator.** A support team representative will assist you manually shortly!'
          }).catch(() => {});
          await interaction.editReply({ content: `✅ **Success!** Your invites are updated to **${stats.valid}** (Eligible). The ticket auto-close has been cancelled!` });
        }
      } else {
        // If they still don't have enough invites, reset the 60-second close timer to give them a fresh window
        const closeTimer = ticketCloseTimeouts.get(interaction.channel.id);
        if (closeTimer) {
          clearTimeout(closeTimer);
        }

        const newTimeoutId = setTimeout(() => {
          interaction.channel.delete().catch(() => {});
          ticketCloseTimeouts.delete(interaction.channel.id);
        }, 60000);
        ticketCloseTimeouts.set(interaction.channel.id, newTimeoutId);

        await interaction.editReply({ content: `❌ **Threshold not met!** You currently have **${stats.valid}** invites, but you need at least **${minRequired}** invites.\n\n⏱️ Auto-close timer has been reset to **60 seconds**.` });
      }
      return;
    }

    // Close Ticket action
    if (interaction.customId === 'close_ticket') {
      if (pendingVouches.has(interaction.channel.id)) {
        clearTimeout(pendingVouches.get(interaction.channel.id).timeout);
        pendingVouches.delete(interaction.channel.id);
      }
      const closeEmbed = new EmbedBuilder()
        .setColor('#ff4757')
        .setTitle('🔒 Ticket Closing')
        .setDescription('This ticket will be deleted in 5 seconds.')
        .setFooter({ text: 'RIWAAYAT • Ticket System' });
      await interaction.reply({ embeds: [closeEmbed] });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }

    // Stop ticket auto-close (Admins only)
    if (interaction.customId === 'stop_ticket_close') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Only admins can stop the ticket closing timer.', flags: MessageFlags.Ephemeral });
      }
      const timeout = ticketCloseTimeouts.get(interaction.channel.id);
      if (timeout) {
        clearTimeout(timeout);
        ticketCloseTimeouts.delete(interaction.channel.id);
        return interaction.reply({ content: '✅ **Ticket auto-close timer stopped by Admin!** This ticket will not be automatically deleted.' });
      } else {
        return interaction.reply({ content: '❌ No active auto-close timer found for this ticket.', flags: MessageFlags.Ephemeral });
      }
    }

    // 🔘 Trigger Claim Button (from button selection fallback)
    if (interaction.customId.startsWith('trigger_claim_')) {
      const rewardId = interaction.customId.replace('trigger_claim_', '');
      const reward = getRewardById(rewardId);
      if (!reward) return interaction.reply({ content: '❌ Invalid reward.', flags: MessageFlags.Ephemeral });

      const invCount = db.getInviteCount(interaction.user.id, interaction.guild.id);
      const is1Inv = db.getSetting('event1invite', false, interaction.guild.id);
      const is2Inv = db.getSetting('event2invite', false, interaction.guild.id);
      let cost = is1Inv ? 1 : (is2Inv ? 2 : reward.invites);
      if (interaction.guild?.id === '1507448300008112179') {
        const NEW_SERVER_INVITE_MAP = { 'nitro_basic': 3, 'nitro_boost': 6, 'mc_account': 3, 'mc_code': 6, 'robux_50': 3, 'robux_100': 6 };
        if (NEW_SERVER_INVITE_MAP[reward.id] !== undefined) {
          cost = is1Inv ? 1 : (is2Inv ? 2 : NEW_SERVER_INVITE_MAP[reward.id]);
        }
      } else if (interaction.guild?.id === '1485628774178623568') {
        cost = is1Inv ? 1 : (is2Inv ? 2 : reward.invites * 2);
      }

      if (invCount < cost) {
        try {
          const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
          await rest.post(
            Routes.interactionCallback(interaction.id, interaction.token),
            {
              body: {
                type: 4,
                data: {
                  flags: 32768 | 64, // Ephemeral V2
                  components: [
                    {
                      type: 17,
                      components: [
                        {
                          type: 10,
                          content: "# ❌ Not Enough Invites"
                        },
                        { type: 14, spacing: 2 },
                        {
                          type: 10,
                          content: `You need **${cost}** invites for **${reward.label}**.\nYou currently have **${invCount}** invite(s).\n\n📢 Invite **${cost - invCount}** more friend(s) to claim!`
                        }
                      ]
                    }
                  ]
                }
              }
            }
          );
          return;
        } catch (err) {
          console.error('[NOT_ENOUGH_INVITES_V2_ERROR]', err.message);
        }
      }

      if (reward.category === 'MINECRAFT_ACC') {
        const stockCount = db.getStockCount(reward.category);
        if (stockCount <= 0) {
          return interaction.reply({
            content: `❌ **Out of Stock!** The reward **${reward.label}** is currently out of stock. Please ask an admin to restock.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }

      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.post(
          Routes.interactionCallback(interaction.id, interaction.token),
          {
            body: {
              type: 4,
              data: {
                flags: 32768 | 64, // V2 Components & Ephemeral
                components: [
                  {
                    type: 17,
                    components: [
                      {
                        type: 10,
                        content: "# ⚠️ Claim Confirmation"
                      },
                      { type: 14, spacing: 2 },
                      {
                        type: 10,
                        content: `You are about to claim:\n\n🎉 **Reward:** **${reward.label}** ${emojiStr(reward)}\n📉 **Cost:** **${cost}** invites\n👥 **Current Balance:** **${invCount}** invites\n\n*Click **Confirm Claim** below to deduct invites and receive your prize. Or click **Change Selection** if you made a mistake!*`
                      },
                      { type: 14, spacing: 2 },
                      {
                        type: 1,
                        components: [
                          {
                            type: 2,
                            style: 3, // Success
                            custom_id: `confirm_claim_${reward.id}`,
                            label: 'Confirm Claim'
                          },
                          {
                            type: 2,
                            style: 2, // Secondary
                            custom_id: 'cancel_claim',
                            label: '❌ Change Selection / Cancel'
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          }
        );
        return;
      } catch (err) {
        console.error('[CONFIRM_CLAIM_V2_ERROR]', err.message);
      }
    }

    // ❌ Cancel Claim / Change Selection Button
    if (interaction.customId === 'cancel_claim') {
      await interaction.deferUpdate().catch(() => {});
      try {
        await interaction.message.delete();
      } catch {}
      return interaction.channel.send('❌ **Claim Cancelled.** You can select a different reward from the dropdown menu above!');
    }

    // 🎉 Confirm Claim Button
    if (interaction.customId.startsWith('confirm_claim_')) {
      const autopayout = db.getSetting('autopayout', false, interaction.guild.id);
      if (!autopayout) {
        return interaction.reply({
          content: '❌ **Claims are currently disabled:** The administrator has turned off payouts for this server.',
          flags: MessageFlags.Ephemeral
        });
      }
      const rewardId = interaction.customId.replace('confirm_claim_', '');
      const reward = getRewardById(rewardId);
      if (!reward) return interaction.reply({ content: '❌ Invalid reward selection.', flags: MessageFlags.Ephemeral });

      const invCount = db.getInviteCount(interaction.user.id, interaction.guild.id);
      const is1Inv = db.getSetting('event1invite', false, interaction.guild.id);
      const is2Inv = db.getSetting('event2invite', false, interaction.guild.id);
      let cost = is1Inv ? 1 : (is2Inv ? 2 : reward.invites);
      if (interaction.guild?.id === '1507448300008112179') {
        const NEW_SERVER_INVITE_MAP = { 'nitro_basic': 3, 'nitro_boost': 6, 'mc_account': 3, 'mc_code': 6, 'robux_50': 3, 'robux_100': 6 };
        if (NEW_SERVER_INVITE_MAP[reward.id] !== undefined) {
          cost = is1Inv ? 1 : (is2Inv ? 2 : NEW_SERVER_INVITE_MAP[reward.id]);
        }
      } else if (interaction.guild?.id === '1485628774178623568') {
        cost = is1Inv ? 1 : (is2Inv ? 2 : reward.invites * 2);
      }

      if (invCount < cost) {
        return interaction.reply({
          content: `❌ You do not have enough invites. You need **${cost}** but only have **${invCount}**.`,
          flags: MessageFlags.Ephemeral
        });
      }

      // Check stock availability (for Minecraft Account rewards)
      const isStockPayout = reward.category === 'MINECRAFT_ACC';
      if (isStockPayout) {
        const stockCount = db.getStockCount(reward.category);
        if (stockCount <= 0) {
          return interaction.reply({
            content: `❌ **Out of Stock!** The reward **${reward.label}** is currently out of stock. Please ask an admin to restock.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // Deduct invites
      const deducted = db.deductInvites(interaction.user.id, cost, interaction.guild.id);
      if (!deducted) {
        return interaction.reply({ content: '❌ Failed to process invite deduction. Try again.', flags: MessageFlags.Ephemeral });
      }



      // Claim code/account from stock OR dynamically generate
      let code;
      if (isStockPayout) {
        code = db.claimFromStock(reward.category, interaction.user.id);
        if (!code) {
          // Refund invites if stock claim somehow failed last second
          const dbData = db.loadDB();
          const user = db.getUser(dbData, interaction.user.id, null, interaction.guild.id);
          user.count += cost;
          db.saveDB(dbData);
          return interaction.reply({
            content: `❌ **Out of Stock!** Failed to retrieve item from stock. Your invites have been refunded.`,
            flags: MessageFlags.Ephemeral
          });
        }
      } else {
        code = db.generateCode();
      }

      // Save local redemption log
      const dbData = db.loadDB();
      if (!dbData.redemptions) dbData.redemptions = [];
      dbData.redemptions.push({
        discordId: interaction.user.id,
        username: interaction.user.username,
        category: reward.category,
        reward: reward.label,
        code: code,
        date: new Date().toISOString()
      });
      db.saveDB(dbData);

      // Delete the confirmation message
      try {
        await interaction.message.delete();
      } catch {}

      // Sync code to backend
      syncCodeToBackend(code, reward.category);

      // Payout content building based on reward type
      let payoutContent;
      if (reward.category === 'MINECRAFT_ACC') {
        const parts = code.split(':');
        const email = parts[0] || 'N/A';
        const pass = parts[1] || 'N/A';
        payoutContent = `<a:Event:1504576267788357742> **REWARD CLAIMED — ${reward.label.toUpperCase()}** ${emojiStr(reward)}\n\n**EMAIL =** || \`${email}\` ||\n**PASS = ** || \`${pass}\` ||`;
      } else {
        payoutContent = `<a:Event:1504576267788357742> **REWARD CLAIMED — ${reward.label.toUpperCase()}** ${emojiStr(reward)}\n\n**REDEEM CODE =** || \`${code}\` ||\n**CLAIM WEBSITE = ** || https://riwaayat-roan.vercel.app/ ||`;
      }

      // Send to ticket channel
      await interaction.reply({ content: payoutContent });

      // Send to user's DMs
      try {
        await interaction.user.send({
          content: `🎉 **Claim Successful!** Here is your premium reward details:\n\n${payoutContent}`
        });
      } catch (dmErr) {
        console.warn(`[DM_FAILED] Could not send DM to @${interaction.user.username}: ${dmErr.message}`);
        await interaction.channel.send(`⚠️ *Could not send DM to you. Please make sure your Direct Messages are turned on!*`);
      }

      // Note: Automatic invite revocation upon successful claim has been disabled as requested.
      // Admins can manage invite revocations manually via the /revoke command.


    }

    if (interaction.customId === 'p_303981356256333825' || interaction.customId === 'p_303981902858031113') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const threadId = interaction.channel.id;
      const giftVal = db.getSetting(threadId + '_gift_val');
      const giftLabel = db.getSetting(threadId + '_gift_label');
      const giftUserId = db.getSetting(threadId + '_gift_userId');

      if (!giftVal || !giftLabel) {
        return interaction.editReply({ content: '❌ Selected gift or thread metadata not found. Please try selecting your gift again.' });
      }

      // Check if it is the correct user
      if (giftUserId && interaction.user.id !== giftUserId) {
        return interaction.editReply({ content: '❌ Only the user who claimed this gift can check their invites!' });
      }

      const GIFT_MAPPINGS = {
        '3fxYIx1V74': { id: 'mc_code', category: 'MINECRAFT_CODE', label: 'Minecraft Redeem Code' },
        'hUTgTp1iwX': { id: 'robux_50', category: 'ROBUX_50', label: 'Roblox 50$ GiftCode' },
        'Zffm7CvzSv': { id: 'nitro_basic', category: 'NITRO_BASIC', label: 'Nitro Basic Giftlink - 1 Year' }
      };

      const giftInfo = GIFT_MAPPINGS[giftVal];
      const invites = db.getInviteCount(interaction.user.id, interaction.guild.id);
      const requiredInvites = 2;

      const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

      if (invites >= requiredInvites) {
        // ── SUCCESS FLOW ──

        const autopayout = db.getSetting('autopayout', false, interaction.guild.id);
        if (!autopayout) {
          return interaction.editReply({
            content: '❌ **Claims are currently disabled:** The administrator has turned off payouts for this server.'
          });
        }

        // Deduct invites
        const deducted = db.deductInvites(interaction.user.id, requiredInvites, interaction.guild.id);
        if (!deducted) {
          return interaction.editReply({ content: '❌ Failed to process invite deduction. Please try again.' });
        }

        // Generate the reward code
        const code = db.generateCode();

        // Save local redemption log
        const dbData = db.loadDB();
        if (!dbData.redemptions) dbData.redemptions = [];
        dbData.redemptions.push({
          discordId: interaction.user.id,
          username: interaction.user.username,
          category: giftInfo.category,
          reward: giftInfo.label,
          code: code,
          date: new Date().toISOString()
        });
        db.saveDB(dbData);

        // Sync code to backend
        syncCodeToBackend(code, giftInfo.category);

        const payoutContent = `<a:Event:1504576267788357742> **REWARD CLAIMED — ${giftInfo.label.toUpperCase()}**\n\n**REDEEM CODE =** || \`${code}\` ||\n**CLAIM WEBSITE = ** || https://riwaayat-roan.vercel.app/ ||`;

        // Post success message directly in the thread
        await interaction.channel.send({ content: payoutContent });

        // Send to user's DMs
        try {
          await interaction.user.send({
            content: `🎉 **Free Gift Successful!** Here is your premium reward details:\n\n${payoutContent}`
          });
        } catch (dmErr) {
          console.warn(`[DM_FAILED] Could not send DM to @${interaction.user.username}: ${dmErr.message}`);
          await interaction.channel.send(`⚠️ *Could not send DM to you. Please make sure your Direct Messages are turned on!*`);
        }

        // Note: Automatic invite revocation upon successful claim has been disabled as requested.
        // Admins can manage invite revocations manually via the /revoke command.



        // Clean up thread settings from DB
        const cleanDbData = db.loadDB();
        delete cleanDbData.settings[threadId + '_gift_val'];
        delete cleanDbData.settings[threadId + '_gift_label'];
        delete cleanDbData.settings[threadId + '_gift_userId'];
        db.saveDB(cleanDbData);

        return interaction.editReply({ content: '✅ Rewards successfully disbursed! Check the thread messages and DMs.' });
      } else {
        // ── FAILURE FLOW ──

        // Send Component message with "Not Enough Invites Yet"
        await rest.post(`/channels/${threadId}/messages`, {
          body: {
            flags: 32768,
            components: [
              {
                type: 17,
                components: [
                  {
                    type: 10,
                    content: "## <:emoji_90:1506374313589346355>  Not Enough Invites Yet <:emoji_90:1506374313589346355>"
                  },
                  {
                    type: 14,
                    spacing: 2
                  },
                  {
                    type: 10,
                    content: `\`Selected Gift\`    : **${giftLabel}**\n\`Required Invites\` : **2**\n\`Current Invites\`  : **${invites}**`
                  },
                  {
                    type: 14,
                    spacing: 2
                  },
                  {
                    type: 1,
                    components: [
                      {
                        style: 1,
                        type: 2,
                        label: "I invited, Check now",
                        flow: {
                          actions: []
                        },
                        custom_id: "p_303981902858031113"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        });

        // Set a timer to delete thread in 30 seconds
        await interaction.channel.send({ content: '⚠️ **Thread will be automatically deleted in 30 seconds** due to insufficient invites.' });
        const timeoutId3 = setTimeout(() => {
          interaction.channel.delete().catch(() => {});
          ticketCloseTimeouts.delete(interaction.channel.id);
        }, 30000);
        ticketCloseTimeouts.set(interaction.channel.id, timeoutId3);

        return interaction.editReply({ content: '❌ Threshold not met. Thread will be deleted in 30 seconds.' });
      }
    }
  }

  // ── SELECT MENU (REWARD CLAIM) ──
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'p_308533702541971458') {
      const selected = interaction.values[0];
      let explanation = '';
      if (selected === 'EvSdyPRL7B') { // Rejoin
        explanation = "# <:1504599011112255659:1510922629635379210> **REJOINS**\n\nUsers who **have rejoined the server** __within the last **`14`** days__ after leaving. These are not counted in the total invites.";
      } else if (selected === 'uAAuZfqqWv') { // Total/Valid
        explanation = "# <:1504599011112255659:1510922629635379210> **VALID INVITES**\n\nYour total invites after adjusting for **fake** and **leaves**. This is what counts for claiming rewards!";
      } else if (selected === 'uprOoL7ekm') { // Fake
        explanation = "# <:1504599011112255659:1510922629635379210> **FAKE INVITES**\n\nAccounts created less than **`14` days ago** are flagged as suspicious and don't count toward rewards.";
      } else if (selected === 'kFUPS1qPQj') { // Leaves
        explanation = "# <:1504599011112255659:1510922629635379210> **LEAVES**\n\nThese are users you invited who **left the server**. They subtract from your total.";
      }
      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.post(
          Routes.interactionCallback(interaction.id, interaction.token),
          {
            body: {
              type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
              data: {
                flags: 32768 | 64, // Ephemeral V2
                components: [
                  {
                    type: 17,
                    components: [
                      {
                        type: 10,
                        content: explanation
                      }
                    ]
                  }
                ]
              }
            }
          }
        );
        return;
      } catch (err) {
        console.error('[STATS_EXPLANATION_ERROR]', err.message);
      }
    }

    if (interaction.customId === 'p_308528383904452609') {
      const selectedValue = interaction.values[0];
      const REWARD_MAP = {
        'iPUmDyf4YD': { id: 'nitro_basic_1m', invites: 2, label: 'Nitro Basic (1 month)', category: 'NITRO_BASIC_1M' },
        'HFMnyfM5LE': { id: 'nitro_boost_1m', invites: 6, label: 'Nitro Boost (1 month)', category: 'NITRO_BOOST_1M' },
        'uSO125SX3C': { id: 'nitro_basic_1y', invites: 9, label: 'Nitro Basic (1 year)', category: 'NITRO_BASIC_1Y' },
        'TmwgjHEmnA': { id: 'nitro_boost_1y', invites: 12, label: 'Nitro Boost (1 year)', category: 'NITRO_BOOST_1Y' },
        'uk5mKfIu9d': { id: 'robux_450', invites: 3, label: '450 Robux', category: 'ROBUX_450' },
        '7PJd1LauyR': { id: 'robux_1500', invites: 6, label: '1,500 Robux', category: 'ROBUX_1500' },
        'Q8x25kTFnM': { id: 'robux_4500', invites: 9, label: '4,500 Robux', category: 'ROBUX_4500' }
      };

      const selected = REWARD_MAP[selectedValue];
      if (!selected) return interaction.reply({ content: '❌ Invalid selection.', flags: MessageFlags.Ephemeral });

      const stats = db.getUserStats(interaction.user.id, interaction.guild.id);
      const is1Inv = db.getSetting('event1invite', false, interaction.guild.id);
      const is2Inv = db.getSetting('event2invite', false, interaction.guild.id);
      let cost = is1Inv ? 1 : (is2Inv ? 2 : selected.invites);

      const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

      if (stats.valid < cost) {
        // NOT ENOUGH INVITES
        try {
          await rest.post(
            Routes.interactionCallback(interaction.id, interaction.token),
            {
              body: {
                type: 4,
                data: {
                  flags: 32768 | 64, // Ephemeral V2
                  components: [
                    {
                      type: 17,
                      components: [
                        {
                          type: 10,
                          content: "# NOT ENOUGH INVITES! "
                        },
                        {
                          type: 14,
                          spacing: 2
                        },
                        {
                          type: 10,
                          content: `<:emoji_28:1510933230230962206> You need **\`${cost}\`** invites to claim **__${selected.label}__**.\n<:emoji_28:1510933230230962206> You currently have **\`${stats.valid}\`** invites.\n\n> <:emoji_29:1510933924379885599> Click on __\"Pro Tip\"__ to learn how **to get invites faster!**\n> <:emoji_29:1510933924379885599> Invite your **Friends** We have limited stock`
                        }
                      ]
                    }
                  ]
                }
              }
            }
          );
          
          // Send the same message to the ticket channel as requested if it's a ticket channel
          if (interaction.channel.name?.startsWith('claim-') || interaction.channel.name?.startsWith('escalated-')) {
            await rest.post(`/channels/${interaction.channel.id}/messages`, {
              body: {
                flags: 32768,
                components: [
                  {
                    type: 17,
                    components: [
                      {
                        type: 10,
                        content: "# NOT ENOUGH INVITES! "
                      },
                      {
                        type: 14,
                        spacing: 2
                      },
                      {
                        type: 10,
                        content: `<:emoji_28:1510933230230962206> You need **\`${cost}\`** invites to claim **__${selected.label}__**.\n<:emoji_28:1510933230230962206> You currently have **\`${stats.valid}\`** invites.\n\n> <:emoji_29:1510933924379885599> Click on __\"Pro Tip\"__ to learn how **to get invites faster!**\n> <:emoji_29:1510933924379885599> Invite your **Friends** We have limited stock`
                      }
                    ]
                  }
                ]
              }
            });
          }
          return;
        } catch (err) {
          console.error('[CLAIM_NOT_ENOUGH_ERROR]', err.message);
        }
      }

      // SUFFICIENT INVITES - CLAIM SUCCESSFUL
      const deducted = db.deductInvites(interaction.user.id, cost, interaction.guild.id);
      if (!deducted) {
        return interaction.reply({ content: '❌ Failed to process invite deduction. Please try again.', flags: MessageFlags.Ephemeral });
      }

      // Claim code/account from stock OR dynamically generate
      let code = db.claimFromStock(selected.category, interaction.user.id);
      if (!code) {
        code = db.generateCode();
      }

      // Save local redemption log
      const dbData = db.loadDB();
      if (!dbData.redemptions) dbData.redemptions = [];
      dbData.redemptions.push({
        discordId: interaction.user.id,
        username: interaction.user.username,
        category: selected.category,
        reward: selected.label,
        code: code,
        date: new Date().toISOString()
      });
      db.saveDB(dbData);

      // Sync code to backend
      syncCodeToBackend(code, selected.category);

      const payoutContent = `<a:Event:1504576267788357742> **REWARD CLAIMED — ${selected.label.toUpperCase()}**\n\n**REDEEM CODE =** || \`${code}\` ||\n**CLAIM WEBSITE = ** || https://riwaayat-roan.vercel.app/ ||`;

      try {
        await rest.post(
          Routes.interactionCallback(interaction.id, interaction.token),
          {
            body: {
              type: 4,
              data: {
                content: `🎉 **Claim Successful!** Your reward details and redeem code have been sent to your **Direct Messages (DMs)**. Please check your DMs!`,
                flags: 64 // Ephemeral
              }
            }
          }
        );

        // Also post in the ticket channel of this user if one exists in the server!
        // Fetch channels first to ensure cache is fully populated
        try {
          await interaction.guild.channels.fetch();
        } catch (fetchErr) {
          console.warn('[CHANNELS_FETCH_FAILED_CLAIM]', fetchErr.message);
        }

        // First try: permission overwrites lookup
        let ticketChannel = interaction.guild.channels.cache.find(c => 
          (c.name.startsWith('claim-') || c.name.startsWith('escalated-')) &&
          c.type === ChannelType.GuildText &&
          c.permissionOverwrites.cache.get(interaction.user.id)?.allow.has(PermissionFlagsBits.ViewChannel)
        );

        // Fallback: search by channel topic (more reliable across bot restarts)
        if (!ticketChannel) {
          ticketChannel = interaction.guild.channels.cache.find(c => 
            c.type === ChannelType.GuildText &&
            c.topic?.includes(`riwaayat-ticket-${interaction.user.id}`)
          );
        }

        if (ticketChannel) {
          await ticketChannel.send({ content: payoutContent });
        } else if (interaction.channel.name?.startsWith('claim-') || interaction.channel.name?.startsWith('escalated-')) {
          await interaction.channel.send({ content: payoutContent });
        }

        // Send to user's DMs
        try {
          await interaction.user.send({
            content: `🎉 **Claim Successful!** Here is your premium reward details:\n\n${payoutContent}`
          });
        } catch (dmErr) {
          console.warn(`[DM_FAILED] Could not send DM to @${interaction.user.username}: ${dmErr.message}`);
          if (ticketChannel) {
            await ticketChannel.send(`⚠️ *Could not send DM to <@${interaction.user.id}>. The reward details have been posted in this ticket channel instead!*`);
          } else {
            await interaction.channel.send(`⚠️ *Could not send DM to <@${interaction.user.id}>. Please make sure your Direct Messages are turned on, or open a claim ticket!*`);
          }
        }

      } catch (err) {
        console.error('[CLAIM_SUCCESS_PROCESS_ERROR]', err.message);
      }
      return;
    }

    if (interaction.customId === 'bm_active_bot_select') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const selectedId = interaction.values[0];
      db.setSetting('lastSelectedBot', selectedId === 'none' ? null : selectedId);
      const panel = await buildBotManagerPanel(selectedId === 'none' ? null : selectedId);
      return interaction.update({ embeds: panel.embeds, components: panel.components });
    }

    if (interaction.customId === 'p_303978525872885766') {
      const selectedValue = interaction.values[0];
      const GIFT_MAPPINGS = {
        '3fxYIx1V74': { id: 'mc_code', category: 'MINECRAFT_CODE', label: 'Minecraft Redeem Code' },
        'hUTgTp1iwX': { id: 'robux_50', category: 'ROBUX_50', label: 'Roblox 50$ GiftCode' },
        'Zffm7CvzSv': { id: 'nitro_basic', category: 'NITRO_BASIC', label: 'Nitro Basic Giftlink - 1 Year' }
      };

      const giftInfo = GIFT_MAPPINGS[selectedValue];
      if (!giftInfo) {
        return interaction.reply({ content: '❌ Invalid gift selection.', flags: MessageFlags.Ephemeral });
      }

      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.post(
          Routes.interactionCallback(interaction.id, interaction.token),
          {
            body: {
              type: 7, // UPDATE_MESSAGE
              data: {
                flags: 32768, // IS_COMPONENTS_V2
                components: [
                  {
                    type: 17,
                    components: [
                      {
                        type: 10,
                        content: `## <:gwhiterules:1506382223333523488>  Invite Task <:gwhiterules:1506382223333523488>\n> <:emoji_89:1506374291204210810>  Hello <@${interaction.user.id}>! To receive **__${giftInfo.label}__**, you must first complete the invite task.`
                      },
                      {
                        type: 14,
                        spacing: 2
                      },
                      {
                        type: 10,
                        content: `\`Selected Gift\`    : **${giftInfo.label}**\n\`Required Invites\` : **2**\n\`Current Invites\`  : **0**`
                      },
                      {
                        type: 14,
                        spacing: 2
                      },
                      {
                        type: 1,
                        components: [
                          {
                            style: 5,
                            type: 2,
                            label: "Join Server & Complete Task",
                            emoji: {
                              id: "1506199270188122242",
                              name: "verification",
                              animated: false
                            },
                            url: "https://discord.gg/2wVgtAf4R"
                          }
                        ]
                      },
                      {
                        type: 14,
                        spacing: 2
                      },
                      {
                        type: 10,
                        content: "> - <:emoji_90:1506374313589346355>  Once you have completed your invites, press the **Join Server & Complete Task** button."
                      }
                    ]
                  }
                ]
              }
            }
          }
        );
      } catch (err) {
        console.error('[FREEGIFT_SELECT_ERROR]', err.message || err);
      }
    }

    if (interaction.customId === 'claim_reward_ticket' || interaction.customId === 'claim_reward_direct') {
      const autopayout = db.getSetting('autopayout', false, interaction.guild.id);
      if (!autopayout) {
        return interaction.reply({
          content: '❌ **Claims are currently disabled:** The administrator has turned off payouts for this server.',
          flags: MessageFlags.Ephemeral
        });
      }
      const rewardId = interaction.values[0];
      const reward = getRewardById(rewardId);
      if (!reward) return interaction.reply({ content: '❌ Invalid reward.', flags: MessageFlags.Ephemeral });

      const invCount = db.getInviteCount(interaction.user.id, interaction.guild.id);
      const is1Inv = db.getSetting('event1invite', false, interaction.guild.id);
      const is2Inv = db.getSetting('event2invite', false, interaction.guild.id);
      let cost = is1Inv ? 1 : (is2Inv ? 2 : reward.invites);
      if (interaction.guild?.id === '1507448300008112179') {
        const NEW_SERVER_INVITE_MAP = { 'nitro_basic': 3, 'nitro_boost': 6, 'mc_account': 3, 'mc_code': 6, 'robux_50': 3, 'robux_100': 6 };
        if (NEW_SERVER_INVITE_MAP[reward.id] !== undefined) {
          cost = is1Inv ? 1 : (is2Inv ? 2 : NEW_SERVER_INVITE_MAP[reward.id]);
        }
      } else if (interaction.guild?.id === '1485628774178623568') {
        cost = is1Inv ? 1 : (is2Inv ? 2 : reward.invites * 2);
      }

      if (invCount < cost) {
        try {
          const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
          await rest.post(
            Routes.interactionCallback(interaction.id, interaction.token),
            {
              body: {
                type: 4,
                data: {
                  flags: 32768 | 64, // Ephemeral V2
                  components: [
                    {
                      type: 17,
                      components: [
                        {
                          type: 10,
                          content: "# ❌ Not Enough Invites"
                        },
                        { type: 14, spacing: 2 },
                        {
                          type: 10,
                          content: `You need **${cost}** invites for **${reward.label}**.\nYou currently have **${invCount}** invite(s).\n\n📢 Invite **${cost - invCount}** more friend(s) to claim!`
                        }
                      ]
                    }
                  ]
                }
              }
            }
          );
          return;
        } catch (err) {
          console.error('[NOT_ENOUGH_INVITES_V2_ERROR]', err.message);
        }
      }

      // Check stock availability (for Minecraft Account rewards)
      if (reward.category === 'MINECRAFT_ACC') {
        const stockCount = db.getStockCount(reward.category);
        if (stockCount <= 0) {
          return interaction.reply({
            content: `❌ **Out of Stock!** The reward **${reward.label}** is currently out of stock. Please ask an admin to restock.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }

      try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        await rest.post(
          Routes.interactionCallback(interaction.id, interaction.token),
          {
            body: {
              type: 4,
              data: {
                flags: 32768 | 64, // V2 Components & Ephemeral
                components: [
                  {
                    type: 17,
                    components: [
                      {
                        type: 10,
                        content: "# ⚠️ Claim Confirmation"
                      },
                      { type: 14, spacing: 2 },
                      {
                        type: 10,
                        content: `You are about to claim:\n\n🎉 **Reward:** **${reward.label}** ${emojiStr(reward)}\n📉 **Cost:** **${cost}** invites\n👥 **Current Balance:** **${invCount}** invites\n\n*Click **Confirm Claim** below to deduct invites and receive your prize. Or click **Change Selection** if you made a mistake!*`
                      },
                      { type: 14, spacing: 2 },
                      {
                        type: 1,
                        components: [
                          {
                            type: 2,
                            style: 3, // Success
                            custom_id: `confirm_claim_${reward.id}`,
                            label: 'Confirm Claim'
                          },
                          {
                            type: 2,
                            style: 2, // Secondary
                            custom_id: 'cancel_claim',
                            label: '❌ Change Selection / Cancel'
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          }
        );
        return;
      } catch (err) {
        console.error('[CONFIRM_CLAIM_V2_ERROR]', err.message);
      }
    }
  }

  // ── MODAL SUBMISSIONS ──
  if (interaction.isModalSubmit()) {
    // Modal: Bulk Register Tokens
    if (interaction.customId === 'bm_modal_add_tokens') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const rawInput = interaction.fields.getTextInputValue('tokens_input') || '';
      
      const lines = rawInput.split(/[\n, ]+/).map(l => l.trim()).filter(l => l.length > 20);
      
      let tokens = db.getSetting('botTokens', []);
      if (!Array.isArray(tokens)) tokens = [];
      
      let successCount = 0;
      let alreadyRegistered = 0;
      let failedCount = 0;
      const logs = [];

      for (const t of lines) {
        if (tokens.includes(t)) {
          alreadyRegistered++;
          continue;
        }
        try {
          const response = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bot ${t}` }
          });
          if (response.ok) {
            const botData = await response.json();
            tokens.push(t);
            successCount++;
            logs.push(`✅ **@${botData.username}** successfully registered!`);
          } else {
            failedCount++;
            logs.push(`❌ Invalid Token (\`${t.slice(0, 15)}...\`)`);
          }
        } catch (err) {
          failedCount++;
          logs.push(`⚠️ Network Error validating (\`${t.slice(0, 15)}...\`)`);
        }
      }

      db.setSetting('botTokens', tokens);

      const logEmbed = new EmbedBuilder()
        .setColor('#10b981')
        .setTitle('🔌 BULK TOKEN REGISTER STATUS')
        .setDescription(`Processed **${lines.length}** token strings.`)
        .addFields(
          { name: '✅ Successfully Added', value: `\`${successCount}\` bot(s)`, inline: true },
          { name: '⚠️ Already Registered', value: `\`${alreadyRegistered}\` bot(s)`, inline: true },
          { name: '❌ Failed / Invalid', value: `\`${failedCount}\` token(s)`, inline: true }
        );

      if (logs.length > 0) {
        logEmbed.addFields({ name: '📝 Verification Details', value: logs.slice(0, 10).join('\n') });
      }

      await interaction.editReply({ embeds: [logEmbed] });
      
      // Update original dashboard message panel
      try {
        const lastSelected = db.getSetting('lastSelectedBot', null);
        const panel = await buildBotManagerPanel(lastSelected);
        await interaction.message.edit({ embeds: panel.embeds, components: panel.components });
      } catch {}
      return;
    }

    // Modal: Bulk Update Bot Profile Identities
    if (interaction.customId === 'bm_modal_bulk_update') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const newName = (interaction.fields.getTextInputValue('bulk_name') || '').trim();
      const avatarUrl = (interaction.fields.getTextInputValue('bulk_avatar') || '').trim();
      
      let tokens = db.getSetting('botTokens', []);
      if (!Array.isArray(tokens)) tokens = [];
      
      if (tokens.length === 0) {
        return interaction.editReply({ content: '❌ No bot tokens registered.' });
      }
      
      let avatarData = null;
      if (avatarUrl) {
        try {
          const imgRes = await fetch(avatarUrl);
          if (!imgRes.ok) throw new Error(`HTTP status ${imgRes.status}`);
          const buffer = await imgRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          let mime = imgRes.headers.get('content-type') || 'image/png';
          mime = mime.split(';')[0].trim();
          
          if (!mime.startsWith('image/')) {
            if (avatarUrl.toLowerCase().endsWith('.jpg') || avatarUrl.toLowerCase().endsWith('.jpeg')) {
              mime = 'image/jpeg';
            } else if (avatarUrl.toLowerCase().endsWith('.gif')) {
              mime = 'image/gif';
            } else {
              mime = 'image/png';
            }
          }
          avatarData = `data:${mime};base64,${base64}`;
        } catch (imgErr) {
          return interaction.editReply({ content: `❌ **Failed to download/parse avatar image**: ${imgErr.message}` });
        }
      }
      
      let successCount = 0;
      let failedCount = 0;
      const logs = [];
      
      for (let i = 0; i < tokens.length; i++) {
        const botToken = tokens[i];
        try {
          const payload = {};
          if (newName) {
            let sanitizedName = newName.replace(/[@#:`]/g, '').replace(/\s+/g, ' ').trim();
            const suffix = ` ${i + 1}`;
            if (sanitizedName.length + suffix.length > 32) {
              sanitizedName = sanitizedName.slice(0, 32 - suffix.length).trim();
            }
            payload.username = `${sanitizedName}${suffix}`;
          }
          if (avatarData) payload.avatar = avatarData;
          
          if (Object.keys(payload).length === 0) {
            continue;
          }
          
          const response = await fetch('https://discord.com/api/v10/users/@me', {
            method: 'PATCH',
            headers: {
              Authorization: `Bot ${botToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          
          if (response.ok) {
            const botData = await response.json();
            successCount++;
            logs.push(`✅ Updated Bot #${i + 1} to **@${botData.username}**`);
          } else {
            const errText = await response.text();
            let errMsg = errText.slice(0, 100);
            try {
              const errJson = JSON.parse(errText);
              if (errJson.message) {
                errMsg = errJson.message;
                if (errJson.errors && errJson.errors.username && errJson.errors.username._errors) {
                  errMsg += `: ${errJson.errors.username._errors[0].message}`;
                } else if (errJson.errors && errJson.errors.avatar && errJson.errors.avatar._errors) {
                  errMsg += `: ${errJson.errors.avatar._errors[0].message}`;
                }
              }
            } catch {}
            failedCount++;
            logs.push(`❌ Failed Bot #${i + 1}: ${errMsg}`);
          }
        } catch (err) {
          failedCount++;
          logs.push(`❌ Failed Bot #${i + 1}: ${err.message}`);
        }
        // Small delay to prevent hitting API rate limits on username/avatar changes
        await new Promise(r => setTimeout(r, 1000));
      }
      
      const updateEmbed = new EmbedBuilder()
        .setColor('#5865f2')
        .setTitle('✏️ BULK BOT IDENTITY UPDATE')
        .setDescription(`Successfully completed the bulk identity update campaign.`)
        .addFields(
          { name: '🟢 Successfully Updated', value: `\`${successCount}\` bot(s)`, inline: true },
          { name: '🔴 Failed to Update', value: `\`${failedCount}\` bot(s)`, inline: true }
        );
        
      if (logs.length > 0) {
        updateEmbed.addFields({ name: '📝 Execution Logs', value: logs.slice(0, 10).join('\n') });
      }
      
      await interaction.editReply({ embeds: [updateEmbed] });
      
      // Update dashboard
      try {
        const lastSelected = db.getSetting('lastSelectedBot', null);
        const panel = await buildBotManagerPanel(lastSelected);
        await interaction.message.edit({ embeds: panel.embeds, components: panel.components });
      } catch {}
      return;
    }

    // Modal: Broadcast Message Payload
    if (interaction.customId === 'bm_modal_send_msg') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const channelId = interaction.fields.getTextInputValue('channel_id').trim();
      const messageText = interaction.fields.getTextInputValue('message_text');
      const embedTitle = interaction.fields.getTextInputValue('embed_title');
      const embedDesc = interaction.fields.getTextInputValue('embed_desc');
      const rawJson = interaction.fields.getTextInputValue('raw_json').trim();
      
      const selectedId = db.getSetting('lastSelectedBot', null);
      if (!selectedId) {
        return interaction.editReply({ content: '❌ No active selected bot.' });
      }
      
      let tokens = db.getSetting('botTokens', []);
      if (!Array.isArray(tokens)) tokens = [];
      
      let botToken = null;
      for (const t of tokens) {
        try {
          const base64Part = t.split('.')[0];
          const cid = Buffer.from(base64Part, 'base64').toString('utf-8');
          if (cid === selectedId) {
            botToken = t;
            break;
          }
        } catch {}
      }
      
      if (!botToken) {
        return interaction.editReply({ content: '❌ Stored token not found.' });
      }
      
      let payload = {};
      if (rawJson) {
        try {
          payload = JSON.parse(rawJson);
        } catch (err) {
          return interaction.editReply({ content: `❌ **Invalid JSON syntax**: ${err.message}` });
        }
      } else {
        if (messageText) payload.content = messageText;
        if (embedTitle || embedDesc) {
          const emb = {
            title: embedTitle || undefined,
            description: embedDesc || undefined,
            color: 5814783 // Discord Blurple
          };
          payload.embeds = [emb];
        }
      }
      
      if (!payload.content && !payload.embeds && !payload.components) {
        return interaction.editReply({ content: '❌ Please provide at least text message content, embed descriptions, or custom JSON!' });
      }
      
      try {
        const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errText = await response.text();
          return interaction.editReply({ content: `❌ **Broadcast failed**: ${errText}` });
        }
        
        return interaction.editReply({ content: `🚀 **Success!** Message payload successfully broadcasted to channel <#${channelId}>!` });
      } catch (err) {
        return interaction.editReply({ content: `❌ **Broadcast failed**: ${err.message}` });
      }
      return;
    }
  }
});

// Helper to resolve the ticket opener by looking at allowed ViewChannel permission overwrites
function getTicketCreatorId(channel) {
  if (!channel || !channel.permissionOverwrites) return null;
  const overwrites = channel.permissionOverwrites.cache;
  for (const [id, overwrite] of overwrites.entries()) {
    if (id === channel.guild.id || id === channel.client.user.id) continue;
    if (overwrite.allow.has(PermissionFlagsBits.ViewChannel)) {
      return id;
    }
  }
  return null;
}

// ─── LEGIT & SUPPORT ESCALATION LISTENER ──────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // ─── MODULES INTEGRATION ───
  // 1. Anti-Nuke Mass Mention Check
  try {
    const punished = await antinukeModule.checkMassMention(message);
    if (punished) return;
  } catch (err) {
    console.error('[EVENT_ERR checkMassMention]', err.message);
  }

  // 2. AutoMod Check
  try {
    const automodTriggered = automodModule.processMessage(message);
    if (automodTriggered) return;
  } catch (err) {
    console.error('[EVENT_ERR processAutoMod]', err.message);
  }

  // 3. NQN Emoji Mirroring Check
  try {
    await nqnModule.processMessage(message);
  } catch (err) {
    console.error('[EVENT_ERR processNQN]', err.message);
  }

  if (!message.channel.name?.startsWith('claim-') && !message.channel.name?.startsWith('escalated-')) return;

  // ─── PREFIX COMMANDS ───
  if (message.content.trim().toLowerCase() === '$delete') {
    const isCreator = message.author.id === getTicketCreatorId(message.channel);
    const isAdminOrStaff = message.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                           message.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
                           message.member.permissions.has(PermissionFlagsBits.Administrator);
    
    if (isCreator || isAdminOrStaff) {
      if (pendingVouches.has(message.channel.id)) {
        clearTimeout(pendingVouches.get(message.channel.id).timeout);
        pendingVouches.delete(message.channel.id);
      }
      const closeEmbed = new EmbedBuilder()
        .setColor('#ff4757')
        .setTitle('🔒 Ticket Deleting')
        .setDescription('This ticket will be deleted in 5 seconds.')
        .setFooter({ text: 'RIWAAYAT • Ticket System' });
      await message.channel.send({ embeds: [closeEmbed] });
      setTimeout(() => message.channel.delete().catch(() => {}), 5000);
      return;
    }
  }

  // 1. Restrict Ticket messages/reactions ONLY to the ticket creator (ignore staff/admins)
  const creatorId = getTicketCreatorId(message.channel);
  if (creatorId && message.author.id !== creatorId) {
    return;
  }

  // 2. Determine if the user has already claimed a reward in this ticket
  let hasClaimed = false;
  try {
    const channelMsgs = await message.channel.messages.fetch({ limit: 20 });
    hasClaimed = channelMsgs.some(m => m.author.id === client.user.id && m.content.includes('REWARD CLAIMED'));
  } catch (err) {
    console.error('[CLAIMED_CHECK_ERROR]', err.message);
  }

  const content = message.content.toLowerCase();

  // 3. Dropdown Selection Fallback via chat keywords/numbers (ONLY if they haven't claimed yet)
  if (!hasClaimed) {
    const autopayout = db.getSetting('autopayout', false, message.guild.id);
    if (!autopayout) return;

    const stats = db.getUserStats(message.author.id, message.guild.id);
    const is1Inv = db.getSetting('event1invite', false, message.guild.id);
    const is2Inv = db.getSetting('event2invite', false, message.guild.id);
    
    // Guild-specific reward filtering
    const NS_IDS = ['nitro_basic', 'nitro_boost', 'mc_account', 'mc_code', 'robux_50', 'robux_100'];
    const NS_INV = { 'nitro_basic': 3, 'nitro_boost': 6, 'mc_account': 3, 'mc_code': 6, 'robux_50': 3, 'robux_100': 6 };
    const isNS = message.guild.id === '1507448300008112179';
    const isTargetServer = message.guild.id === '1485628774178623568';
    const msgAllRewards = isNS
      ? REWARDS.filter(r => NS_IDS.includes(r.id)).map(r => ({ ...r, invites: NS_INV[r.id] }))
      : (isTargetServer ? REWARDS.map(r => ({ ...r, invites: r.invites * 2 })) : REWARDS);

    const eligible = msgAllRewards.filter(r => {
      const cost = is1Inv ? 1 : (is2Inv ? 2 : r.invites);
      return stats.valid >= cost;
    });

    if (eligible.length > 0) {
      let matchedReward = null;

      const typedIndex = parseInt(content.trim(), 10);
      if (!isNaN(typedIndex) && typedIndex >= 1 && typedIndex <= eligible.length) {
        matchedReward = eligible[typedIndex - 1];
      } else {
        const lowerText = content.trim().toLowerCase();
        if (lowerText.includes('minecraft') || lowerText.includes('mc')) {
          matchedReward = eligible.find(r => r.category.includes('MINECRAFT'));
        } else if (lowerText.includes('nitro') || lowerText.includes('boost') || lowerText.includes('basic')) {
          matchedReward = eligible.find(r => r.category.includes('NITRO'));
        } else if (lowerText.includes('robux') || lowerText.includes('roblox') || lowerText.includes('robox')) {
          matchedReward = eligible.find(r => r.category.includes('ROBUX') || r.category.includes('ROBLOX'));
        } else if (lowerText.includes('youtube') || lowerText.includes('yt')) {
          matchedReward = eligible.find(r => r.category.includes('YT') || r.category.includes('YOUTUBE'));
        } else if (lowerText.includes('valorant') || lowerText.includes('vp')) {
          matchedReward = eligible.find(r => r.category.includes('VALORANT'));
        }
      }

      if (matchedReward) {
        const cost = is1Inv ? 1 : (is2Inv ? 2 : matchedReward.invites);
        const invCount = stats.valid;

        if (matchedReward.category === 'MINECRAFT_ACC') {
          const stockCount = db.getStockCount(matchedReward.category);
          if (stockCount <= 0) {
            return message.reply({
              content: `❌ **Out of Stock!** The reward **${matchedReward.label}** is currently out of stock. Please ask an admin to restock.`
            });
          }
        }
        try {
          await message.channel.send({ content: `🎯 **Auto-detected Reward Match!** You selected: **${matchedReward.label}**` }).catch(() => {});
          const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
          await rest.post(`/channels/${message.channel.id}/messages`, {
            body: {
              flags: 32768, // IS_COMPONENTS_V2
              components: [
                {
                  type: 17,
                  components: [
                    {
                      type: 10,
                      content: "# ⚠️ Claim Confirmation"
                    },
                    { type: 14, spacing: 2 },
                    {
                      type: 10,
                      content: `You are about to claim:\n\n🎉 **Reward:** **${matchedReward.label}** ${emojiStr(matchedReward)}\n📉 **Cost:** **${cost}** invites\n👥 **Current Balance:** **${invCount}** invites\n\n*Click **Confirm Claim** below to deduct invites and receive your prize. Or click **Change Selection** if you made a mistake!*`
                    },
                    { type: 14, spacing: 2 },
                    {
                      type: 1,
                      components: [
                        {
                          type: 2,
                          style: 3, // Success
                          custom_id: `confirm_claim_${matchedReward.id}`,
                          label: 'Confirm Claim'
                        },
                        {
                          type: 2,
                          style: 2, // Secondary
                          custom_id: 'cancel_claim',
                          label: '❌ Change Selection / Cancel'
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          });
          return;
        } catch (err) {
          console.error('[AUTO_DETECT_CONFIRM_V2_ERROR]', err.message);
        }
      }
    }
    // If they typed something else but haven't claimed, do not process feedback or escalation
    return;
  }

  // ─── POST-CLAIM VOUCH PROCESSING (ONLY after claim successful) ───

  // Clear pending warning timeout if they vouch
  if (pendingVouches.has(message.channel.id)) {
    const data = pendingVouches.get(message.channel.id);
    clearTimeout(data.timeout);
    pendingVouches.delete(message.channel.id);
    console.log(`[VOUCH_WARNING] Cleared pending vouch warning timer for channel ${message.channel.id}`);
  }

  // 1. Negative feedback / support needed (Checked first to prevent overlapping matches)
  const isNegative = 
    content.includes('not working') || 
    content.includes('no working') || 
    content.includes('not work') || 
    content.includes('no work') || 
    content.includes('work nhi') || 
    content.includes('work nahi') || 
    content.includes('work kr rha nhi') ||
    content.includes('not legit') || 
    content.includes('no legit') || 
    content.includes('fake') || 
    content.includes('scam') || 
    content.includes('fraud') || 
    content.includes('cheat') || 
    content.includes('negative') || 
    content.includes('bad') || 
    content.includes('worst') || 
    content.includes('problem') || 
    content.includes('error') || 
    content.includes('issue') ||
    content.includes('fault') ||
    content.includes('damaged') ||
    content.includes('broken');

  if (isNegative) {
    // Rename ticket to signal immediate staff attention
    if (message.channel.name.startsWith('claim-')) {
      const newName = `escalated-${message.channel.name.slice(6)}`;
      await message.channel.setName(newName).catch(err => console.error('[RENAME_FAILED]', err.message));
    }
    return;
  }

  // 2. Positive feedback (Checked only if negative keywords are absent)
  const isPositive = 
    content.includes('legit') || 
    content.includes('working') || 
    content.includes('work kar raha') || 
    content.includes('work kr rha') || 
    content.includes('work kar rha') ||
    content.includes('work kr raha') ||
    content.includes('perfect') ||
    content.includes('nice') ||
    content.includes('awesome') ||
    content.includes('thanks') ||
    content.includes('thank you');

  if (isPositive) {
    // 1. Fetch last 50 messages to identify and clean up intermediate messages
    try {
      const messages = await message.channel.messages.fetch({ limit: 50 });
      const sortedMsgs = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      
      const payoutIdx = sortedMsgs.findIndex(m => m.author.id === client.user.id && m.content.includes('REWARD CLAIMED'));
      const vouchIdx = sortedMsgs.findIndex(m => m.id === message.id);
      
      if (payoutIdx !== -1 && vouchIdx !== -1 && vouchIdx > payoutIdx) {
        const messagesToDelete = [];
        for (let i = payoutIdx + 1; i < vouchIdx; i++) {
          const m = sortedMsgs[i];
          if (m.content.includes('ARE WE LEGIT')) continue; // Exclude Legit prompt from deletions!
          messagesToDelete.push(m);
        }
        
        if (messagesToDelete.length > 0) {
          await message.channel.bulkDelete(messagesToDelete).catch(err => {
            console.error('[VOUCH_CLEANUP_BULK_FAILED] Deleting individually:', err.message);
            messagesToDelete.forEach(m => m.delete().catch(() => {}));
          });
        }
      }
    } catch (cleanupErr) {
      console.error('[VOUCH_CLEANUP_ERROR]', cleanupErr.message);
    }

    // 2. Upload the static vouch proof.png to the payment channel
    try {
      const proofChannel = getPaymentChannel(message.guild);
      if (proofChannel) {
        const proofPath = path.join(__dirname, '..', 'data', 'proof.png');
        if (fs.existsSync(proofPath)) {
          // Resolve user's latest claim category from database.json
          const dbData = db.loadDB();
          const userRedemptions = (dbData.redemptions || []).filter(r => r.discordId === message.author.id);
          userRedemptions.sort((a, b) => new Date(b.date) - new Date(a.date));
          const latestClaim = userRedemptions[0];

          let prizeLabel = 'Premium Reward';
          let prizeEmoji = '🎁';
          
          if (latestClaim) {
            const rewardObj = getRewardByCategory(latestClaim.category);
            if (rewardObj) {
              prizeLabel = rewardObj.label;
              prizeEmoji = emojiStr(rewardObj);
            } else {
              prizeLabel = latestClaim.category.replace(/_/g, ' ');
            }
          }

          const embed = new EmbedBuilder()
            .setColor('#57F287') // Green
            .setAuthor({
              name: `${message.author.username} • Verified Payout Vouch`,
              iconURL: message.author.displayAvatarURL({ dynamic: true })
            })
            .setTitle('✅ LEGIT CLAIM & VOUCH!')
            .setDescription(
              `✨ **User**: ${message.author}\n` +
              `🎁 **Claimed Reward**: ${prizeEmoji} **${prizeLabel}**\n` +
              `💬 **Vouch Feedback**: "${message.content}"\n\n` +
              `*Thank you for verifying! All premium rewards are instantly processed and delivered.*`
            )
            .setImage('attachment://proof.png')
            .setTimestamp()
            .setFooter({ 
              text: `${message.guild.name} Community Rewards • Legit Proof`, 
              iconURL: message.guild.iconURL() || undefined 
            });

          await proofChannel.send({
            embeds: [embed],
            files: [proofPath]
          });
        } else {
          console.warn(`[VOUCH_PROOF_MISSING] Staged proof file not found at ${proofPath}`);
        }
      }
    } catch (uploadErr) {
      console.error('[VOUCH_PROOF_UPLOAD_ERROR]', uploadErr.message);
    }

    // Automatically close the ticket after a short delay (5 seconds) to allow any DB saves or log updates to complete
    setTimeout(() => {
      message.channel.delete().catch(() => {});
    }, 5000);
    return;
  }
});

// ─── GLOBAL ERROR HANDLERS (prevent crashes) ───────────────────────
client.on('error', (err) => console.error('[BOT_ERROR]', err.message));
process.on('unhandledRejection', (err) => console.error('[UNHANDLED]', err.message || err));
process.on('uncaughtException', (err) => console.error('[UNCAUGHT]', err.message));

// ─── START BOT ─────────────────────────────────────────────────────
client.login(BOT_TOKEN).catch(err => {
  console.error('❌ Bot login failed:', err.message);
  console.log('Check your DISCORD_BOT_TOKEN in .env');
});
