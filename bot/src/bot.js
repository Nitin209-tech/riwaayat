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

// Global Map to track pending legit/vouch timeouts for ticket channels
const pendingVouches = new Map();

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

👉 **Please type "legit" or "working" in your ticket channel immediately!**
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
  const welcomeChannelId = db.getSetting('welcomeChannel');
  if (welcomeChannelId) {
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    if (welcomeChannel) {
      let rawMsg = db.getSetting('welcomeMessage', 'Welcome {user} to RIWAAYAT! You were invited by {inviter} (who now has {invites} invites).');
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
  const greetChannels = db.getSetting('greetChannels', []);
  if (Array.isArray(greetChannels) && greetChannels.length > 0) {
    const rawGreetMsg = db.getSetting('greetMessage', '⚡ Welcome {user}! You were invited by {inviter}.');
    const inviterText = inviterUser ? `@${inviterUser.username}` : 'Direct Join';

    const formattedGreet = rawGreetMsg
      .replace(/{user}/g, `${member}`)
      .replace(/{username}/g, member.user.username)
      .replace(/{inviter}/g, inviterText)
      .replace(/{invites}/g, inviterInvites.toString());

    for (const channelId of greetChannels) {
      const greetChannel = member.guild.channels.cache.get(channelId);
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
  const configuredId = db.getSetting('paymentChannelId');
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
  new SlashCommandBuilder().setName('sendevent')
    .setDescription('Post the premium styled event layout to this channel (Admin only)'),
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
          { name: '🎮 Roblox $100', value: 'ROBUX_100' }
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
          { name: '🎮 Roblox $100', value: 'ROBUX_100' }
        ))
      .addIntegerOption(opt => opt.setName('count').setDescription('How many codes to generate (1-50)').setRequired(true)))
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
        { name: '🎮 Roblox $100', value: 'ROBUX_100' }
      ))
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
    .setDescription('Set custom welcome greeting message (Admin only)')
    .addStringOption(opt => opt.setName('message').setDescription('Greeting string. Variables: {user}, {username}, {inviter}, {invites}').setRequired(true)),
  new SlashCommandBuilder().setName('welcomechannel')
    .setDescription('Set custom welcome greeting channel (Admin only)')
    .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true)),
  new SlashCommandBuilder().setName('greetmsg')
    .setDescription('Set custom 5-second self-deleting greet message (Admin only)')
    .addStringOption(opt => opt.setName('message').setDescription('Greeting template. Variables: {user}, {username}, {inviter}, {invites}').setRequired(true)),
  new SlashCommandBuilder().setName('greetchannels')
    .setDescription('Manage channels for 5-second self-deleting greets (Admin only)')
    .addStringOption(opt => opt.setName('action').setDescription('Add, remove, or view channels').setRequired(true)
      .addChoices(
        { name: '➕ Add Channel', value: 'add' },
        { name: '➖ Remove Channel', value: 'remove' },
        { name: '📋 View Channels', value: 'view' }
      ))
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to add or remove').setRequired(false)),
  new SlashCommandBuilder().setName('event1invite')
    .setDescription('Toggle 1-invite event (Admin only)')
    .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable 1-invite event').setRequired(true)),
  new SlashCommandBuilder().setName('event2invite')
    .setDescription('Toggle 2-invite event (Admin only)')
    .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable 2-invite event').setRequired(true)),
  new SlashCommandBuilder().setName('deletetickets')
    .setDescription('Bulk deletes all active ticket channels (Admin only)'),
  new SlashCommandBuilder().setName('revoke')
    .setDescription('Delete the oldest active invite codes (Admin only, skips Administrators)')
    .addIntegerOption(opt => opt.setName('count').setDescription('Number of oldest invites to revoke').setRequired(true)),
  new SlashCommandBuilder().setName('testvouch')
    .setDescription('Instantly post simulated payment proof screenshot for testing (Admin only)'),
  new SlashCommandBuilder().setName('testwelcome')
    .setDescription('Simulate a join event to test welcome and greet messages (Admin only)'),
  new SlashCommandBuilder().setName('serverpulling')
    .setDescription('Pull all authenticated database users into this server (Admin only)'),
  new SlashCommandBuilder().setName('dbstatus')
    .setDescription('Check if the bot is successfully connected to the PostgreSQL database (Admin only)'),
  new SlashCommandBuilder().setName('send1invite')
    .setDescription('Post the premium styled 1-invite promo banner (Admin only)'),
  new SlashCommandBuilder().setName('proofmake')
    .setDescription('Generate simulated payout proof conversation (Admin only)')
    .addUserOption(opt => opt.setName('user').setDescription('The target user to display in proof').setRequired(true))
    .addStringOption(opt => opt.setName('prize').setDescription('Choose the prize to payout')
      .setRequired(false)
      .addChoices(
        { name: '💎 Nitro Basic', value: 'nitro_basic' },
        { name: '🚀 Nitro Boost', value: 'nitro_boost' },
        { name: '⛏ Minecraft Account', value: 'minecraft' },
        { name: '🎮 Robux $50', value: 'robux_50' },
        { name: '🎮 Robux $100', value: 'robux_100' }
      )),
].map(cmd => cmd.toJSON());

// ─── BOT CLIENT ────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
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
};

client.once('ready', onReady);
client.once('clientReady', onReady);

// ─── INVITE TRACKER (With logging & telemetry) ────────────────────
client.on('guildMemberAdd', async (member) => {
  try {
    const isRejoin = db.wasLeftMember(member.user.id);
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
        db.addFakeInvite(inviterUser.id, inviterUser.username);
        db.logJoin(inviterUser.id, inviterUser.username, member.user.id, member.user.username, usedInviteCode, 'FAKE');
        console.log(`[FAKE] @${inviterUser.username} self-invited (fake +1)`);
        inviterInvites = db.getInviteCount(inviterUser.id);
      } else if (isRejoin) {
        db.addRejoinInvite(inviterUser.id, inviterUser.username);
        db.logJoin(inviterUser.id, inviterUser.username, member.user.id, member.user.username, usedInviteCode, 'REJOIN');
        console.log(`[REJOIN] @${member.user.username} rejoined (inviter: @${inviterUser.username})`);
        inviterInvites = db.getInviteCount(inviterUser.id);
      } else {
        const userData = db.addInvite(inviterUser.id, inviterUser.username);
        db.logJoin(inviterUser.id, inviterUser.username, member.user.id, member.user.username, usedInviteCode, 'VALID');
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
    const leaveLog = db.handleLeaveAndGetInviter(member.user.id);
    if (leaveLog) {
      console.log(`[LEAVE] @${member.user.username} left the server. Deducted 1 invite from inviter @${leaveLog.inviterUsername}`);
    } else {
      db.trackLeave(member.user.id);
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

    // /testwelcome
    if (commandName === 'testwelcome') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      
      const welcomeChannelId = db.getSetting('welcomeChannel') || interaction.channel.id;
      let greetChannels = db.getSetting('greetChannels', []);
      if (!Array.isArray(greetChannels) || greetChannels.length === 0) {
        greetChannels = [interaction.channel.id]; // fallback to current channel for testing
      }
      
      const mockInvites = db.getInviteCount(interaction.user.id);
      await interaction.reply({ content: '🧪 **Simulating join event...** Dispatches firing now inside channels!', flags: MessageFlags.Ephemeral });
      
      // Temporary override for testing
      const originalWelcomeId = db.getSetting('welcomeChannel');
      const originalGreetChannels = db.getSetting('greetChannels');
      
      db.setSetting('welcomeChannel', welcomeChannelId);
      db.setSetting('greetChannels', greetChannels);
      
      try {
        await triggerWelcomeAndGreets(interaction.member, client.user, mockInvites);
      } finally {
        // Restore original configuration immediately
        if (originalWelcomeId) db.setSetting('welcomeChannel', originalWelcomeId);
        else {
          const dbData = db.loadDB();
          delete dbData.settings.welcomeChannel;
          db.saveDB(dbData);
        }
        if (originalGreetChannels) db.setSetting('greetChannels', originalGreetChannels);
        else {
          const dbData = db.loadDB();
          delete dbData.settings.greetChannels;
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
      db.setSetting('welcomeMessage', msg);
      return interaction.reply({ content: `✅ Custom welcome message saved successfully:\n\`\`\`\n${msg}\n\`\`\``, flags: MessageFlags.Ephemeral });
    }

    // /welcomechannel
    if (commandName === 'welcomechannel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const channel = interaction.options.getChannel('channel');
      db.setSetting('welcomeChannel', channel.id);
      return interaction.reply({ content: `✅ Welcome message target channel updated to: ${channel}!`, flags: MessageFlags.Ephemeral });
    }

    // /greetmsg
    if (commandName === 'greetmsg') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const msg = interaction.options.getString('message');
      db.setSetting('greetMessage', msg);
      return interaction.reply({ content: `✅ Custom 5-second greet message saved successfully:\n\`\`\`\n${msg}\n\`\`\``, flags: MessageFlags.Ephemeral });
    }

    // /greetchannels
    if (commandName === 'greetchannels') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      
      const action = interaction.options.getString('action');
      const channel = interaction.options.getChannel('channel');
      
      let list = db.getSetting('greetChannels', []);
      if (!Array.isArray(list)) list = [];
      
      if (action === 'add') {
        if (!channel) {
          return interaction.reply({ content: '❌ Please specify a channel to add.', flags: MessageFlags.Ephemeral });
        }
        if (list.includes(channel.id)) {
          return interaction.reply({ content: `❌ ${channel} is already in the greet channels list.`, flags: MessageFlags.Ephemeral });
        }
        list.push(channel.id);
        db.setSetting('greetChannels', list);
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
        db.setSetting('greetChannels', list);
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
      db.setSetting('event1invite', enabled);
      if (enabled) db.setSetting('event2invite', false); // disable conflicting event
      return interaction.reply({ content: `✅ **1-Invite Special Event** has been **${enabled ? 'ENABLED ⚡ (All rewards cost 1 invite & no 30s timeouts)' : 'DISABLED ❌'}**!`, flags: MessageFlags.Ephemeral });
    }

    // /event2invite
    if (commandName === 'event2invite') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
      }
      const enabled = interaction.options.getBoolean('enabled');
      db.setSetting('event2invite', enabled);
      if (enabled) db.setSetting('event1invite', false); // disable conflicting event
      return interaction.reply({ content: `✅ **2-Invite Special Event** has been **${enabled ? 'ENABLED ⚡ (All rewards cost 2 invites)' : 'DISABLED ❌'}**!`, flags: MessageFlags.Ephemeral });
    }



    // /invites
    if (commandName === 'invites') {
      const count = db.getInviteCount(interaction.user.id);
      const is1Inv = db.getSetting('event1invite', false);
      const is2Inv = db.getSetting('event2invite', false);
      const eventStatus = is1Inv ? ' [⚡ 1-INVITE EVENT ACTIVE]' : (is2Inv ? ' [⚡ 2-INVITE EVENT ACTIVE]' : '');
      const embed = new EmbedBuilder()
        .setColor('#1d4ed8')
        .setTitle('📊 Your Invite Balance')
        .setDescription(`**@${interaction.user.username}**\n\n🎟️ Available Invites: **${count}**`)
        .addFields({ 
          name: 'Reward Costs' + eventStatus, 
          value: REWARDS.map(r => {
            const cost = is1Inv ? 1 : (is2Inv ? 2 : r.invites);
            return `${r.emoji} ${r.label.split(' ').slice(1).join(' ')} — **${cost} invites**`;
          }).join('\n') 
        })
        .setFooter({ text: 'Invite friends to earn more!' });
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // /claim
    if (commandName === 'claim') {
      const count = db.getInviteCount(interaction.user.id);
      const is1Inv = db.getSetting('event1invite', false);
      const is2Inv = db.getSetting('event2invite', false);
      const options = REWARDS.map(r => {
        const cost = is1Inv ? 1 : (is2Inv ? 2 : r.invites);
        return {
          label: r.label,
          description: `${cost} invites needed ${count >= cost ? '✓' : '✕'}`,
          value: r.id,
          emoji: { id: r.emojiId, name: r.emojiName, animated: r.animated }
        };
      });

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('claim_reward_direct')
          .setPlaceholder('🎁 Select a reward to claim...')
          .addOptions(options)
      );

      const embed = new EmbedBuilder()
        .setColor('#1d4ed8')
        .setTitle('🎁 Claim Your Reward')
        .setDescription(`Your Invites: **${count}**\n\nSelect a reward below. Invites will be deducted on claim.`)
        .setFooter({ text: 'RIWAAYAT Reward System' });

      return interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    }

    // /leaderboard
    if (commandName === 'leaderboard') {
      const top = db.getLeaderboard(10);
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

    // /sendevent
    if (commandName === 'sendevent') {
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
                    type: 12,
                    items: [
                      {
                        media: {
                          url: "https://cdn.discordapp.com/attachments/1343602374991806476/1506194924268425256/file_00000000f5a87207a97920ef212fa323.png?ex=6a0d60d5&is=6a0c0f55&hm=52ce26cf5212dc7c511446162d9218f7405d89b6771aae51b8bc9dbd29f598a8"
                        }
                      }
                    ]
                  },
                  {
                    type: 14,
                    spacing: 2
                  },
                  {
                    type: 10,
                    content: "# INVITE EVENT 2026\n<:infoBlue:1506195998245130352> This is a **LIMITED-TIME** event until <t:1780222800:R>. "
                  },
                  {
                    type: 14
                  },
                  {
                    type: 10,
                    content: "<a:emoji_25:1504806993280503810><@&1506193607802093598> = **Roblox 50$ GiftCard** <:Robux_2019_Logo_gold:1504606073502568578>\n<a:emoji_25:1504806993280503810><@&1506193757681487943> = **Roblox 100$ GiftCard** <:Robux_2019_Logo_gold:1504606073502568578>\n\n<a:emoji_25:1504806993280503810><@&1506193607802093598> = **MineCraft Account** <a:Minecraft:1504810470153126042>\n<a:emoji_25:1504806993280503810><@&1506193757681487943> = ***MC Redeem Code** <a:Minecraft:1504810470153126042>\n\n<a:emoji_25:1504806993280503810><@&1506193607802093598> = **Nitro Basic GiftCode** <a:AHNitroBoosts:1506197135157231738>\n<a:emoji_25:1504806993280503810><@&1506193757681487943> = **Nitro Boost GiftCode** <a:AHNitroBoosts:1506197135157231738>\n\n<a:emoji_25:1504806993280503810><@&1506193607802093598> = **YT 10k Subs** <a:RG_yt:1504591010888683600>\n<a:emoji_25:1504806993280503810><@&1506193757681487943> = **YT 30k Subs** <a:RG_yt:1504591010888683600>"
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

        return interaction.editReply({ content: '✅ Event panel posted!' });
      } catch (err) {
        console.error('[SENDEVENT_ERROR]', err.message || err);
        return interaction.editReply({ content: `❌ Failed to post event panel: ${err.message}` });
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
      const user = db.getUser(dbData, targetUser.id, targetUser.username);
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
      const user = db.getUser(dbData, targetUser.id, targetUser.username);
      if (user.count < amount) {
        return interaction.reply({ content: `❌ **@${targetUser.username}** only has **${user.count}** invites. Cannot remove **${amount}**.`, flags: MessageFlags.Ephemeral });
      }
      user.count -= amount;
      db.saveDB(dbData);
      return interaction.reply({ content: `✅ Removed **${amount}** invites from **@${targetUser.username}**. New balance: **${user.count}**`, flags: MessageFlags.Ephemeral });
    }

    // /deletetickets
    if (commandName === 'deletetickets') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply();

      try {
        const channels = interaction.guild.channels.cache.filter(c => 
          (c.name.startsWith('claim-') || c.name.startsWith('escalated-')) && 
          c.type === ChannelType.GuildText
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

    // /proofmake
    if (commandName === 'proofmake') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', flags: MessageFlags.Ephemeral });
      }

      const targetUser = interaction.options.getUser('user');
      const prize = interaction.options.getString('prize') || 'nitro_basic';

      if (!targetUser) {
        return interaction.reply({ content: '❌ Please select or provide a valid target user.', flags: MessageFlags.Ephemeral });
      }

      await interaction.reply({ content: '⏳ Rendering premium payout screenshot (Generating Canvas)...', flags: MessageFlags.Ephemeral });

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

        // Generate random invites and promo gift code
        const randomInvites = Math.floor(Math.random() * 4) + 2; // 2 to 5 invites
        const giftCode = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10); // 16 character alphanumeric

        // 1. Download Avatars and local Nitro card image
        const targetAvatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 128 });
        const executorAvatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
        const nitroGiftCardUrl = path.join(__dirname, 'fonts', 'wumpus.png');

        const [targetAvatarImg, executorAvatarImg, nitroGiftCardImg] = await Promise.all([
          loadImgSafely(targetAvatarUrl),
          loadImgSafely(executorAvatarUrl),
          loadImgSafely(nitroGiftCardUrl)
        ]);

        // 2. Select conversation texts randomly
        const conversationTemplates = [
          {
            first: [
              `🤬`,
              `i have made like ${randomInvites} invites`,
              `@${interaction.user.username} WHEN U PAY MY NITRO BASIC BITCH`,
              `HUH????`
            ],
            third: [
              `HAHAHAHAH GOOOD BOOY`,
              `REAL THOUGH BTW`
            ]
          },
          {
            first: [
              `plss nitro basic dedo maine ${randomInvites} invites pure kar liye`,
              `check fast @${interaction.user.username} plss`
            ],
            third: [
              `thankyou legit server!`,
              `proof vouch post kar diya hai 😭❤️`
            ]
          },
          {
            first: [
              `yo @${interaction.user.username} completed my ${randomInvites} invites`,
              `payout my nitro basic code plss send fast`
            ],
            third: [
              `thankyou legit payout received!!`
            ]
          }
        ];

        const template = conversationTemplates[Math.floor(Math.random() * conversationTemplates.length)];

        // Generate Canvas
        // Dimensions: Width = 720px, Height = 580px
        const canvas = createCanvas(720, 580);
        const ctx = canvas.getContext('2d');

        // Draw Discord dark theme background
        ctx.fillStyle = '#313338';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Timestamps
        const time1 = getFormattedTime(-1);
        const time2 = getFormattedTime(0);
        const time3 = getFormattedTime(0);

        // --- DRAW BLOCK 1 (Target User requesting) ---
        // Draw Avatar
        if (targetAvatarImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(45, 50, 20, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(targetAvatarImg, 25, 30, 40, 40);
          ctx.restore();
        } else {
          ctx.fillStyle = '#5865F2';
          ctx.beginPath();
          ctx.arc(45, 50, 20, 0, Math.PI * 2, true);
          ctx.fill();
        }

        // Draw Name
        ctx.font = '16px "gg sans bold"';
        ctx.fillStyle = '#F2F3F5';
        ctx.fillText(targetUser.username, 80, 46);
        const nameWidth1 = ctx.measureText(targetUser.username).width;

        // Draw Timestamp
        ctx.font = '12px "gg sans"';
        ctx.fillStyle = '#949BA4';
        ctx.fillText(time1, 80 + nameWidth1 + 10, 46);

        // Draw Message lines with golden mention highlight support
        let currentY = 74;
        for (const line of template.first) {
          if (line.includes(`@${interaction.user.username}`)) {
            const mentionStr = `@${interaction.user.username}`;
            const parts = line.split(mentionStr);
            const beforeStr = parts[0];
            const afterStr = parts[1];
            
            // Draw golden highlight background across the full width of the canvas
            ctx.fillStyle = 'rgba(250, 166, 26, 0.08)'; // Yellowish/golden highlight tint
            ctx.fillRect(0, currentY - 16, canvas.width, 24);
            
            // Draw golden vertical border on the left edge (width 2px)
            ctx.fillStyle = '#FAA61A'; // Discord golden mention color
            ctx.fillRect(0, currentY - 16, 2, 24);
            
            // Draw text components
            let startXText = 80;
            ctx.font = '15px "gg sans"';
            ctx.fillStyle = '#DBDEE1';
            
            if (beforeStr) {
              ctx.fillText(beforeStr, startXText, currentY);
              startXText += ctx.measureText(beforeStr).width;
            }
            
            // Draw mention badge
            const badgeWidth = ctx.measureText(mentionStr).width + 8;
            ctx.fillStyle = 'rgba(88, 101, 242, 0.3)'; // Blurple background
            drawRoundedRect(ctx, startXText, currentY - 14, badgeWidth, 18, 3);
            ctx.fill();
            
            ctx.fillStyle = '#E3E7FD'; // Light blurple text
            ctx.font = '15px "gg sans bold"';
            ctx.fillText(mentionStr, startXText + 4, currentY - 1);
            
            startXText += badgeWidth + 4;
            
            if (afterStr) {
              ctx.font = '15px "gg sans"';
              ctx.fillStyle = '#DBDEE1';
              ctx.fillText(afterStr, startXText, currentY);
            }
          } else {
            ctx.font = '15px "gg sans"';
            ctx.fillStyle = '#DBDEE1';
            ctx.fillText(line, 80, currentY);
          }
          currentY += 22;
        }

        // --- DRAW BLOCK 2 (Command Executor delivering prize) ---
        const block2StartY = currentY + 15;

        // Draw Avatar
        if (executorAvatarImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(45, block2StartY + 20, 20, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(executorAvatarImg, 25, block2StartY, 40, 40);
          ctx.restore();
        } else {
          ctx.fillStyle = '#5865F2';
          ctx.beginPath();
          ctx.arc(45, block2StartY + 20, 20, 0, Math.PI * 2, true);
          ctx.fill();
        }

        // Draw Name + Custom Tag 🎁 GIFT
        ctx.font = '16px "gg sans bold"';
        ctx.fillStyle = '#F2F3F5';
        ctx.fillText(interaction.user.username, 80, block2StartY + 16);
        const execNameWidth = ctx.measureText(interaction.user.username).width;

        // Draw 🎁 GIFT tag
        ctx.fillStyle = '#23A55A'; // Green tag background
        drawRoundedRect(ctx, 80 + execNameWidth + 8, block2StartY + 2, 62, 18, 3);
        ctx.fill();
        ctx.font = '10px "gg sans bold"';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('🎁 GIFT', 80 + execNameWidth + 14, block2StartY + 14);

        // Draw Timestamp
        ctx.font = '12px "gg sans"';
        ctx.fillStyle = '#949BA4';
        ctx.fillText(time2, 80 + execNameWidth + 78, block2StartY + 16);

        // Draw Message text
        ctx.font = '15px "gg sans"';
        ctx.fillStyle = '#DBDEE1';
        ctx.fillText('🎁 Thank you for inviting users to my server!', 80, block2StartY + 42);
        
        let prefixText = '';
        let codeText = '';
        let embedTitle = '';
        let embedDesc = '';
        let embedColor = '#4f46e5';

        if (prize === 'nitro_basic') {
          prefixText = '🌀 Here is your Nitro Basic 1 Month: ';
          codeText = `https://discord.gift/${giftCode}`;
          embedTitle = "You've been gifted a subscription!";
          embedDesc = "You've been gifted Nitro Basic for 1 month!";
          embedColor = '#4f46e5';
        } else if (prize === 'nitro_boost') {
          prefixText = '🌀 Here is your Nitro Boost 1 Month: ';
          codeText = `https://discord.gift/${giftCode}`;
          embedTitle = "You've been gifted a subscription!";
          embedDesc = "You've been gifted Nitro Boost for 1 month!";
          embedColor = '#ff73fa';
        } else if (prize === 'minecraft') {
          prefixText = '⛏ Here are your Minecraft Account credentials: ';
          codeText = `mc_play_${Math.floor(Math.random()*8999)+1000}@gmail.com`;
          embedTitle = "Minecraft Premium Account Info";
          embedDesc = `Email: mc_play_${Math.floor(Math.random()*8999)+1000}@gmail.com\nPassword: ${Math.random().toString(36).substring(2, 10).toUpperCase()}!`;
          embedColor = '#23A55A';
        } else if (prize === 'robux_50') {
          prefixText = '🎮 Here is your Roblox $50 Gift Card Code: ';
          codeText = `RBX-${giftCode.toUpperCase().substring(0, 12)}`;
          embedTitle = "Roblox $50 Premium Card";
          embedDesc = `Gift Card Pin: RBX-${giftCode.toUpperCase().substring(0, 12)}`;
          embedColor = '#f5be18';
        } else if (prize === 'robux_100') {
          prefixText = '🎮 Here is your Roblox $100 Gift Card Code: ';
          codeText = `RBX-${giftCode.toUpperCase().substring(0, 12)}`;
          embedTitle = "Roblox $100 Premium Card";
          embedDesc = `Gift Card Pin: RBX-${giftCode.toUpperCase().substring(0, 12)}`;
          embedColor = '#f5be18';
        }

        ctx.font = '15px "gg sans"';
        ctx.fillStyle = '#DBDEE1';
        ctx.fillText(prefixText, 80, block2StartY + 64);
        const prefixWidth = ctx.measureText(prefixText).width;

        // Draw inline code block background
        const codeWidth = ctx.measureText(codeText).width + 12;
        ctx.fillStyle = '#2B2D31'; // Darker gray pill background
        drawRoundedRect(ctx, 80 + prefixWidth, block2StartY + 49, codeWidth, 22, 3);
        ctx.fill();

        // Draw code text
        ctx.font = '14px "gg sans"';
        ctx.fillStyle = '#E3E5E8';
        ctx.fillText(codeText, 80 + prefixWidth + 6, block2StartY + 64);

        // Draw Embed Card Box
        const embedY = block2StartY + 80;
        ctx.fillStyle = '#2B2D31'; // Dark card color
        drawRoundedRect(ctx, 80, embedY, 520, 135, 8);
        ctx.fill();

        // Left accent border color bar
        ctx.fillStyle = embedColor;
        drawRoundedRect(ctx, 80, embedY, 4, 135, 2);
        ctx.fill();

        // Title
        ctx.font = '16px "gg sans bold"';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(embedTitle, 100, embedY + 32);

        // Description
        ctx.font = '14px "gg sans"';
        ctx.fillStyle = '#DBDEE1';
        const descLines = embedDesc.split('\n');
        let descY = embedY + 54;
        for (const line of descLines) {
          ctx.fillText(line, 100, descY);
          descY += 18;
        }

        // Draw Button "Open Gift" or "Claim Info"
        ctx.fillStyle = '#5865F2'; // Discord Blurple
        drawRoundedRect(ctx, 100, embedY + 86, 95, 34, 4);
        ctx.fill();

        ctx.font = '14px "gg sans bold"';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Open Gift', 118, embedY + 108);

        // Draw Expires text
        ctx.font = '12px "gg sans"';
        ctx.fillStyle = '#949BA4';
        ctx.fillText('Expires in 44 hours', 210, embedY + 107);

        // Draw Wumpus Nitro Graphic if successfully loaded
        if (nitroGiftCardImg) {
          ctx.drawImage(nitroGiftCardImg, 420, embedY + 10, 160, 115);
        }

        // --- DRAW BLOCK 3 (Target User saying thankyou legit) ---
        const block3StartY = embedY + 155;

        // Draw Avatar
        if (targetAvatarImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(45, block3StartY + 20, 20, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(targetAvatarImg, 25, block3StartY, 40, 40);
          ctx.restore();
        } else {
          ctx.fillStyle = '#5865F2';
          ctx.beginPath();
          ctx.arc(45, block3StartY + 20, 20, 0, Math.PI * 2, true);
          ctx.fill();
        }

        // Draw Name
        ctx.font = '16px "gg sans bold"';
        ctx.fillStyle = '#F2F3F5';
        ctx.fillText(targetUser.username, 80, block3StartY + 16);
        const nameWidth3 = ctx.measureText(targetUser.username).width;

        // Draw Timestamp
        ctx.font = '12px "gg sans"';
        ctx.fillStyle = '#949BA4';
        ctx.fillText(time3, 80 + nameWidth3 + 10, block3StartY + 16);

        // Draw Message text lines
        ctx.font = '15px "gg sans"';
        ctx.fillStyle = '#DBDEE1';
        let currentY3 = block3StartY + 42;
        for (const line of template.third) {
          ctx.fillText(line, 80, currentY3);
          currentY3 += 22;
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

    // 🔍 Check Invites Button from Event Panel
    if (interaction.customId === 'p_303796426524069889') {
      const count = db.getInviteCount(interaction.user.id);
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
                            url: "https://cdn.discordapp.com/attachments/1343602374991806476/1506201739630481498/file_0000000032e47208b64a8a8e8825a619.png?ex=6a0d672e&is=6a0c15ae&hm=4ae404a77e3532c51935664ee482b5813e4cb8ce6b2b927095899e5724b6beea"
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
      const existing = interaction.guild.channels.cache.find(c => 
        (c.name.startsWith('claim-') || c.name.startsWith('escalated-')) &&
        c.type === ChannelType.GuildText &&
        c.permissionOverwrites.cache.get(interaction.user.id)?.allow.has(PermissionFlagsBits.ViewChannel)
      );

      if (existing) {
        return interaction.editReply({ content: `❌ You already have an open ticket: ${existing}` });
      }

      try {
        // Parent category checks (Max 50 channels limit check)
        const parentCategory = interaction.guild.channels.cache.get('1485628775277269092');
        let parentId = null;
        if (parentCategory && parentCategory.type === ChannelType.GuildCategory) {
          const childCount = interaction.guild.channels.cache.filter(c => c.parentId === parentCategory.id).size;
          if (childCount < 50) {
            parentId = parentCategory.id;
          }
        }

        const ticketChannel = await interaction.guild.channels.create({
          name: `claim-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          type: ChannelType.GuildText,
          parent: parentId,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
          ]
        });

        // Inform user that their ticket is created
        await interaction.editReply({ content: `✅ Ticket created: ${ticketChannel}` });

        // Step 1: Send a clean Welcome message
        const welcomeEmbed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('<a:Event:1504576267788357742> RIWAAYAT — Welcome!')
          .setDescription(`<a:nyt_zwelcome:1504591019436544010> Hey **${interaction.user.username}**!\nWe are glad you are here.\n\n*Your invite balance is being verified automatically. Please select an option below if you wish to view detailed logs.*`);

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('expand_invites').setLabel('Expand Logs').setStyle(ButtonStyle.Secondary)
        );

        await ticketChannel.send({
          content: `👋 Hey ${interaction.user}! Welcome to your claim ticket channel.`,
          embeds: [welcomeEmbed],
          components: [actionRow]
        });

        // Step 2: Automate check invites, V2 invites widget, and rewards selection/countdown
        const stats = db.getUserStats(interaction.user.id);
        const is1Inv = db.getSetting('event1invite', false);
        const minRequired = is1Inv ? 1 : 2;

        // Post the custom V2 invite count component directly in the channel
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
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
                          url: "https://cdn.discordapp.com/attachments/1343602374991806476/1506201739630481498/file_0000000032e47208b64a8a8e8825a619.png?ex=6a0d672e&is=6a0c15ae&hm=4ae404a77e3532c51935664ee482b5813e4cb8ce6b2b927095899e5724b6beea"
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

        // Small delay for smooth transition
        await new Promise(r => setTimeout(r, 1000));

        if (stats.valid < minRequired) {
          const notEnoughEmbed = new EmbedBuilder()
            .setColor('#ef4444')
            .setTitle('❌ Invite Threshold Not Met')
            .setDescription(`You have **${stats.valid}** valid invite(s).\n\n**Minimum requirement:** **${minRequired} invites**\n\nTicket will **automatically close in 30 seconds** due to insufficient refer balance.`);

          await ticketChannel.send({ embeds: [notEnoughEmbed] });

          const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
          );
          await ticketChannel.send({ components: [closeRow] });

          setTimeout(() => {
            ticketChannel.delete().catch(() => {});
          }, 30000);
        } else {
          const eligible = REWARDS.filter(r => {
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

          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('show_reward_buttons').setLabel('🔘 Show Reward Buttons').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
          );
          await ticketChannel.send({ components: [btnRow] });
        }
      } catch (err) {
        console.error('[TICKET_ERROR]', err.message || err);
        return interaction.editReply({ content: `❌ Ticket error: ${err.message}` });
      }
    }

    // 📂 Expand Logs Button
    if (interaction.customId === 'expand_invites') {
      const logs = db.getJoinLogs(interaction.user.id);
      const stats = db.getUserStats(interaction.user.id);
      const is1Inv = db.getSetting('event1invite', false);

      const validList = logs.filter(l => l.status === 'VALID').map(l => `@${l.inviteeUsername} (Link: ${l.code})`).join('\n') || 'None';

      const expandEmbed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('📂 Detailed Referral Telemetry')
        .setDescription(`**🎟️ Valid Balance:** **${stats.valid}**` + (is1Inv ? ' [⚡ 1-INVITE EVENT ACTIVE]' : '') + `\n**👥 Total Joins:** **${stats.total}**\n**❌ Fake Joins:** **${stats.fake}**\n**🔄 Rejoins:** **${stats.rejoin}**`)
        .addFields({
          name: '✅ Active Referrals',
          value: `\`\`\`\n${validList.slice(0, 1000)}\n\`\`\``
        })
        .setFooter({ text: 'Select a filter category below to view specific users.' });

      const filterRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('filter_left').setLabel('Left Users').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('filter_rejoin').setLabel('Rejoined').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('filter_fake').setLabel('Fake Users').setStyle(ButtonStyle.Secondary)
      );

      const continueRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('continue_claim').setLabel('Continue to Payout').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({
        embeds: [expandEmbed],
        components: [filterRow, continueRow],
        flags: MessageFlags.Ephemeral
      });
    }

    // Filter left users
    if (interaction.customId === 'filter_left') {
      const logs = db.getJoinLogs(interaction.user.id);
      const list = logs.filter(l => l.status === 'LEFT').map(l => `@${l.inviteeUsername}`).join('\n') || 'None';
      return interaction.reply({
        content: `👥 **Users who left after joining:**\n\`\`\`\n${list.slice(0, 1800)}\n\`\`\``,
        flags: MessageFlags.Ephemeral
      });
    }

    // Filter rejoined users
    if (interaction.customId === 'filter_rejoin') {
      const logs = db.getJoinLogs(interaction.user.id);
      const list = logs.filter(l => l.status === 'REJOIN').map(l => `@${l.inviteeUsername}`).join('\n') || 'None';
      return interaction.reply({
        content: `🔄 **Users who rejoined:**\n\`\`\`\n${list.slice(0, 1800)}\n\`\`\``,
        flags: MessageFlags.Ephemeral
      });
    }

    // Filter fake users
    if (interaction.customId === 'filter_fake') {
      const logs = db.getJoinLogs(interaction.user.id);
      const list = logs.filter(l => l.status === 'FAKE').map(l => `@${l.inviteeUsername}`).join('\n') || 'None';
      return interaction.reply({
        content: `❌ **Users flagged as fake/self-invites:**\n\`\`\`\n${list.slice(0, 1800)}\n\`\`\``,
        flags: MessageFlags.Ephemeral
      });
    }

    // ⚡ Continue Claim Button
    if (interaction.customId === 'continue_claim') {
      await interaction.deferUpdate().catch(() => {});
      const stats = db.getUserStats(interaction.user.id);
      const is1Inv = db.getSetting('event1invite', false);
      const minRequired = is1Inv ? 1 : 2;

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
                        url: "https://cdn.discordapp.com/attachments/1343602374991806476/1506201739630481498/file_0000000032e47208b64a8a8e8825a619.png?ex=6a0d672e&is=6a0c15ae&hm=4ae404a77e3532c51935664ee482b5813e4cb8ce6b2b927095899e5724b6beea"
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
        const notEnoughEmbed = new EmbedBuilder()
          .setColor('#ef4444')
          .setTitle('❌ Invite Threshold Not Met')
          .setDescription(`You have **${stats.valid}** valid invite(s).\n\n**Minimum requirement:** **${minRequired} invites**\n\nTicket will **automatically close in 30 seconds** due to insufficient refer balance.`);

        await interaction.channel.send({ embeds: [notEnoughEmbed] });

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
        );
        await interaction.channel.send({ components: [closeRow] });

        setTimeout(() => {
          interaction.channel.delete().catch(() => {});
        }, 30000);
      } else {
        const eligible = REWARDS.filter(r => {
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

        const btnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('show_reward_buttons').setLabel('🔘 Show Reward Buttons').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
        );
        await interaction.channel.send({ components: [btnRow] });
      }
    }

    // Close Ticket action
    if (interaction.customId === 'close_ticket') {
      if (pendingVouches.has(interaction.channel.id)) {
        clearTimeout(pendingVouches.get(interaction.channel.id).timeout);
        pendingVouches.delete(interaction.channel.id);
      }
      await interaction.reply('🔒 Closing this ticket in 5 seconds...');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }

    // 🔘 Show Reward Buttons
    if (interaction.customId === 'show_reward_buttons') {
      const stats = db.getUserStats(interaction.user.id);
      const is1Inv = db.getSetting('event1invite', false);
      const is2Inv = db.getSetting('event2invite', false);
      
      const eligible = REWARDS.filter(r => {
        const cost = is1Inv ? 1 : (is2Inv ? 2 : r.invites);
        return stats.valid >= cost;
      });

      if (eligible.length === 0) {
        return interaction.reply({
          content: '❌ You do not have enough invites to claim any reward.',
          flags: MessageFlags.Ephemeral
        });
      }

      const rows = [];
      let currentRow = new ActionRowBuilder();
      
      for (let i = 0; i < eligible.length; i++) {
        const reward = eligible[i];
        const cost = is1Inv ? 1 : (is2Inv ? 2 : reward.invites);
        
        const button = new ButtonBuilder()
          .setCustomId(`trigger_claim_${reward.id}`)
          .setLabel(`${reward.label} (${cost} Inv)`)
          .setStyle(ButtonStyle.Success);
          
        if (reward.emojiId) {
          button.setEmoji({ id: reward.emojiId, animated: reward.animated });
        }
        
        currentRow.addComponents(button);
        
        if (currentRow.components.length === 5 || i === eligible.length - 1) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder();
        }
      }

      return interaction.reply({
        content: '🔘 **Select one of your eligible rewards using the buttons below:**',
        components: rows,
        flags: MessageFlags.Ephemeral
      });
    }

    // 🔘 Trigger Claim Button (from button selection fallback)
    if (interaction.customId.startsWith('trigger_claim_')) {
      const rewardId = interaction.customId.replace('trigger_claim_', '');
      const reward = getRewardById(rewardId);
      if (!reward) return interaction.reply({ content: '❌ Invalid reward.', flags: MessageFlags.Ephemeral });

      const invCount = db.getInviteCount(interaction.user.id);
      const is1Inv = db.getSetting('event1invite', false);
      const is2Inv = db.getSetting('event2invite', false);
      const cost = is1Inv ? 1 : (is2Inv ? 2 : reward.invites);

      if (invCount < cost) {
        const embed = new EmbedBuilder()
          .setColor('#ef4444')
          .setTitle('❌ Not Enough Invites')
          .setDescription(`You need **${cost}** invites for **${reward.label}**.\nYou currently have **${invCount}** invite(s).\n\n📢 Invite **${cost - invCount}** more friend(s) to claim!`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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

      const confirmEmbed = new EmbedBuilder()
        .setColor('#eab308')
        .setTitle('⚠️ Claim Confirmation')
        .setDescription(`You are about to claim:\n\n🎉 **Reward:** **${reward.label}** ${emojiStr(reward)}\n📉 **Cost:** **${cost}** invites\n👥 **Current Balance:** **${invCount}** invites\n\n*Click **Confirm Claim** below to deduct invites and receive your prize. Or click **Change Selection** if you made a mistake!*`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_claim_${reward.id}`)
          .setLabel('Confirm Claim')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel_claim`)
          .setLabel('❌ Change Selection / Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        embeds: [confirmEmbed],
        components: [row]
      });
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
      const rewardId = interaction.customId.replace('confirm_claim_', '');
      const reward = getRewardById(rewardId);
      if (!reward) return interaction.reply({ content: '❌ Invalid reward selection.', flags: MessageFlags.Ephemeral });

      const invCount = db.getInviteCount(interaction.user.id);
      const is1Inv = db.getSetting('event1invite', false);
      const is2Inv = db.getSetting('event2invite', false);
      const cost = is1Inv ? 1 : (is2Inv ? 2 : reward.invites);

      if (invCount < cost) {
        return interaction.reply({
          content: `❌ You do not have enough invites. You need **${cost}** but only have **${invCount}**.`,
          flags: MessageFlags.Ephemeral
        });
      }

      // Check stock availability (ONLY for Minecraft Account)
      const isMinecraft = reward.category === 'MINECRAFT_ACC';
      if (isMinecraft) {
        const stockCount = db.getStockCount(reward.category);
        if (stockCount <= 0) {
          return interaction.reply({
            content: `❌ **Out of Stock!** The reward **${reward.label}** is currently out of stock. Please ask an admin to restock.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // Deduct invites
      const deducted = db.deductInvites(interaction.user.id, cost);
      if (!deducted) {
        return interaction.reply({ content: '❌ Failed to process invite deduction. Try again.', flags: MessageFlags.Ephemeral });
      }

      // Claim code/account from stock OR dynamically generate
      let code;
      if (isMinecraft) {
        code = db.claimFromStock(reward.category, interaction.user.id);
        if (!code) {
          // Refund invites if stock claim somehow failed last second
          const dbData = db.loadDB();
          const user = db.getUser(dbData, interaction.user.id);
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
      if (isMinecraft) {
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

      // Legit Feedback prompt
      await new Promise(r => setTimeout(r, 2000));
      await interaction.channel.send('## ARE WE LEGIT??');

      // Start 2-minute pending vouch warning DM
      startLegitTimeout(interaction.channel.id, interaction.user, reward.label);
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
      const invites = db.getInviteCount(interaction.user.id);
      const requiredInvites = 2;

      const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

      if (invites >= requiredInvites) {
        // ── SUCCESS FLOW ──

        // Deduct invites
        const deducted = db.deductInvites(interaction.user.id, requiredInvites);
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

        // Legit Feedback prompt
        await new Promise(r => setTimeout(r, 2000));
        await interaction.channel.send('## ARE WE LEGIT??');

        // Start 2-minute pending vouch warning DM
        startLegitTimeout(interaction.channel.id, interaction.user, giftInfo.label);

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
        await interaction.channel.send('⚠️ **Thread will be automatically deleted in 30 seconds** due to insufficient invites.');
        setTimeout(() => {
          interaction.channel.delete().catch(() => {});
        }, 30000);

        return interaction.editReply({ content: '❌ Threshold not met. Thread will be deleted in 30 seconds.' });
      }
    }
  }

  // ── SELECT MENU (REWARD CLAIM) ──
  if (interaction.isStringSelectMenu()) {
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
      const rewardId = interaction.values[0];
      const reward = getRewardById(rewardId);
      if (!reward) return interaction.reply({ content: '❌ Invalid reward.', flags: MessageFlags.Ephemeral });

      const invCount = db.getInviteCount(interaction.user.id);
      const is1Inv = db.getSetting('event1invite', false);
      const is2Inv = db.getSetting('event2invite', false);
      const cost = is1Inv ? 1 : (is2Inv ? 2 : reward.invites);

      if (invCount < cost) {
        const embed = new EmbedBuilder()
          .setColor('#ef4444')
          .setTitle('❌ Not Enough Invites')
          .setDescription(`You need **${cost}** invites for **${reward.label}**.\nYou currently have **${invCount}** invite(s).\n\n📢 Invite **${cost - invCount}** more friend(s) to claim!`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      // Check stock availability (ONLY for Minecraft Account)
      if (reward.category === 'MINECRAFT_ACC') {
        const stockCount = db.getStockCount(reward.category);
        if (stockCount <= 0) {
          return interaction.reply({
            content: `❌ **Out of Stock!** The reward **${reward.label}** is currently out of stock. Please ask an admin to restock.`,
            flags: MessageFlags.Ephemeral
          });
        }
      }

      // Send confirmation screen
      const confirmEmbed = new EmbedBuilder()
        .setColor('#eab308')
        .setTitle('⚠️ Claim Confirmation')
        .setDescription(`You are about to claim:\n\n🎉 **Reward:** **${reward.label}** ${emojiStr(reward)}\n📉 **Cost:** **${cost}** invites\n👥 **Current Balance:** **${invCount}** invites\n\n*Click **Confirm Claim** below to deduct invites and receive your prize. Or click **Change Selection** if you made a mistake!*`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_claim_${reward.id}`)
          .setLabel('Confirm Claim')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel_claim`)
          .setLabel('❌ Change Selection / Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        embeds: [confirmEmbed],
        components: [row]
      });
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
  if (!message.channel.name?.startsWith('claim-') && !message.channel.name?.startsWith('escalated-')) return;

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
    const stats = db.getUserStats(message.author.id);
    const is1Inv = db.getSetting('event1invite', false);
    const is2Inv = db.getSetting('event2invite', false);
    
    const eligible = REWARDS.filter(r => {
      const cost = is1Inv ? 1 : (is2Inv ? 2 : r.invites);
      return stats.valid >= cost;
    });

    if (eligible.length > 0) {
      let matchedReward = null;

      const typedIndex = parseInt(content.trim(), 10);
      if (!isNaN(typedIndex) && typedIndex >= 1 && typedIndex <= eligible.length) {
        matchedReward = eligible[typedIndex - 1];
      } else {
        const lowerText = content.trim();
        if (lowerText.includes('minecraft') || lowerText.includes('mc')) {
          matchedReward = eligible.find(r => r.category.includes('MINECRAFT'));
        } else if (lowerText.includes('nitro') || lowerText.includes('boost') || lowerText.includes('basic')) {
          matchedReward = eligible.find(r => r.category.includes('NITRO'));
        } else if (lowerText.includes('robux') || lowerText.includes('roblox') || lowerText.includes('robox')) {
          matchedReward = eligible.find(r => r.category.includes('ROBUX') || r.category.includes('ROBLOX'));
        } else if (lowerText.includes('youtube') || lowerText.includes('yt')) {
          matchedReward = eligible.find(r => r.category.includes('YT') || r.category.includes('YOUTUBE'));
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

        const confirmEmbed = new EmbedBuilder()
          .setColor('#eab308')
          .setTitle('⚠️ Claim Confirmation')
          .setDescription(`You are about to claim:\n\n🎉 **Reward:** **${matchedReward.label}** ${emojiStr(matchedReward)}\n📉 **Cost:** **${cost}** invites\n👥 **Current Balance:** **${invCount}** invites\n\n*Click **Confirm Claim** below to deduct invites and receive your prize. Or click **Change Selection** if you made a mistake!*`);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_claim_${matchedReward.id}`)
            .setLabel('Confirm Claim')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`cancel_claim`)
            .setLabel('❌ Change Selection / Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

        return message.reply({
          content: `🎯 **Auto-detected Reward Match!** You selected: **${matchedReward.label}**`,
          embeds: [confirmEmbed],
          components: [row]
        });
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
    await message.reply(`⚠️ **We are sorry to hear that you are facing issues!**\n\nYour concern has been **escalated directly to our Support Admins** (<@&1506193757681487943> / <@&1506193607802093598>). A staff member will join this ticket shortly to help you resolve this issue manually!`);
    
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

    await message.reply(`✅ **Thank you for confirming!** We are thrilled that everything is working perfectly for you.\n\nThis ticket channel will **automatically close in 30 minutes** to keep our ticket queue clean. ⏳`);
    setTimeout(() => {
      message.channel.delete().catch(() => {});
    }, 30 * 60 * 1000);
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
