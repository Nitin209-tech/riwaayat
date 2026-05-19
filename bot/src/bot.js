const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const { Client, GatewayIntentBits, Partials, ActivityType, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ChannelType, PermissionFlagsBits, REST, Routes, SlashCommandBuilder, MessageFlags } = require('discord.js');
require('dotenv').config();
const db = require('./database');
const { REWARDS, getRewardById, emojiStr } = require('./rewards');
const https = require('https');
const http = require('http');

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

// ─── SLASH COMMAND DEFINITIONS ─────────────────────────────────────
const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Show all bot commands'),
  new SlashCommandBuilder().setName('invites').setDescription('Check your invite count'),
  new SlashCommandBuilder().setName('claim').setDescription('Claim a reward using your invites'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('View top inviters'),
  new SlashCommandBuilder().setName('panel')
    .setDescription('Post the claim ticket panel embed (Admin only)'),
  new SlashCommandBuilder().setName('sendevent')
    .setDescription('Post the premium styled event layout to this channel (Admin only)'),
  new SlashCommandBuilder().setName('stock')
    .setDescription('Manage reward stock (Admin only)')
    .addSubcommand(sub => sub.setName('add')
      .setDescription('Add a code to stock')
      .addStringOption(opt => opt.setName('category').setDescription('Reward category')
        .setRequired(true)
        .addChoices(
          { name: '⛏ Minecraft', value: 'MINECRAFT' },
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
          { name: '⛏ Minecraft', value: 'MINECRAFT' },
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
        { name: '⛏ Minecraft', value: 'MINECRAFT' },
        { name: '💎 Nitro Basic', value: 'NITRO_BASIC' },
        { name: '🚀 Nitro Boost', value: 'NITRO_BOOST' },
        { name: '📺 YT 10K Subs', value: 'YT_10K' },
        { name: '📺 YT 30K Subs', value: 'YT_30K' },
        { name: '🎮 Roblox $50', value: 'ROBUX_50' },
        { name: '🎮 Roblox $100', value: 'ROBUX_100' }
      ))
    .addIntegerOption(opt => opt.setName('count').setDescription('How many codes to generate (1-50)').setRequired(false)),
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
  new SlashCommandBuilder().setName('testwelcome')
    .setDescription('Simulate a join event to test welcome and greet messages (Admin only)'),
  new SlashCommandBuilder().setName('serverpulling')
    .setDescription('Pull the latest 10 prize redemptions claimed on the website (Admin only)'),
  new SlashCommandBuilder().setName('dbstatus')
    .setDescription('Check if the bot is successfully connected to the PostgreSQL database (Admin only)'),
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
      
      try {
        const redemptions = await pullRedemptionsDirectly();
        if (redemptions.length === 0) {
          const embed = new EmbedBuilder()
            .setColor('#3b82f6')
            .setTitle('🌐 RIWAAYAT WEBSITE REDEMPTIONS')
            .setDescription('❌ No redemptions found in the database yet. Get some users to claim rewards on the website!')
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] });
        }
        
        const embed = new EmbedBuilder()
          .setColor('#3b82f6')
          .setTitle('🌐 RIWAAYAT WEBSITE REDEMPTIONS')
          .setDescription(`📋 Successfully pulled the last **${redemptions.length}** prize claims directly from the PostgreSQL database.`)
          .setTimestamp();
          
        redemptions.forEach((r, idx) => {
          const formattedDate = new Date(r.claimedAt).toLocaleString('en-US');
          embed.addFields({
            name: `🔹 Claim #${idx + 1} — ${r.category} (${r.status})`,
            value: `👤 **Gamer**: @${r.extraField1}\n📧 **Email**: ${r.emailUsed}\n🔑 **Voucher Key**: \`${r.deliveredPayload}\`\n📍 **IP Address**: \`${r.ipAddress}\`\n📅 **Date**: ${formattedDate}`
          });
        });
        
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Failed to pull redemptions:', err);
        return interaction.editReply({ content: `❌ **Failed to pull from database**: ${err.message}` });
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
      return interaction.reply({ content: `✅ **1-Invite Special Event** has been **${enabled ? 'ENABLED ⚡ (All rewards cost 1 invite & no 30s timeouts)' : 'DISABLED ❌'}**!`, flags: MessageFlags.Ephemeral });
    }

    // /invites
    if (commandName === 'invites') {
      const count = db.getInviteCount(interaction.user.id);
      const is1Inv = db.getSetting('event1invite', false);
      const embed = new EmbedBuilder()
        .setColor('#1d4ed8')
        .setTitle('📊 Your Invite Balance')
        .setDescription(`**@${interaction.user.username}**\n\n🎟️ Available Invites: **${count}**`)
        .addFields({ 
          name: 'Reward Costs' + (is1Inv ? ' [⚡ 1-INVITE EVENT ACTIVE]' : ''), 
          value: REWARDS.map(r => `${r.emoji} ${r.label.split(' ').slice(1).join(' ')} — **${is1Inv ? 1 : r.invites} invites**`).join('\n') 
        })
        .setFooter({ text: 'Invite friends to earn more!' });
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // /claim
    if (commandName === 'claim') {
      const count = db.getInviteCount(interaction.user.id);
      const is1Inv = db.getSetting('event1invite', false);
      const options = REWARDS.map(r => {
        const cost = is1Inv ? 1 : r.invites;
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
      return interaction.reply({ content: '✅ Panel posted!', flags: MessageFlags.Ephemeral });
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
                        url: "https://discord.com/channels/1485628774178623568/1485628774665158760",
                        custom_id: "p_303796653519802370"
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
          return `${r.emoji} **${r.category}**: ${bar} **${s}** codes`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setColor('#000000')
          .setTitle('📦 Stock Levels')
          .setDescription(lines || 'No stock added yet.')
          .setFooter({ text: 'Use /stock add or /stock generate to add codes' });
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
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
  }

  // ── BUTTON INTERACTIONS ──
  if (interaction.isButton()) {

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
                flags: 32768, // Ephemeral
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

      const ticketName = `claim-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const existing = interaction.guild.channels.cache.find(c => c.name === ticketName);
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
          name: ticketName,
          type: ChannelType.GuildText,
          parent: parentId,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
          ]
        });

        // Step 1: Combined Ping & Welcome Embed in ONE message
        const welcomeEmbed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('<a:Event:1504576267788357742> RIWAAYAT — Welcome!')
          .setDescription(`<a:nyt_zwelcome:1504591019436544010> Hey **${interaction.user.username}**!\n<a:hwart:1504576453730242570> We're glad you're here!\n\nYour claim ticket has been created. Click **Continue** below to verify your invites, or **Expand** to view detailed referral telemetry logs.`);

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('continue_claim').setLabel('Continue').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('expand_invites').setLabel('Expand Logs').setStyle(ButtonStyle.Secondary)
        );

        await ticketChannel.send({
          content: `👋 Hey ${interaction.user}! Welcome to your claim ticket channel.`,
          embeds: [welcomeEmbed],
          components: [actionRow]
        });

        return interaction.editReply({ content: `✅ Ticket created: ${ticketChannel}` });
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

      const checkingEmbed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('<:member:1505974580626591976> Dispatching Invite Telemetry...')
        .setDescription(`Please wait while we cross-reference invite logs inside cores...`);

      const checkingMsg = await interaction.channel.send({ embeds: [checkingEmbed] });

      await new Promise(r => setTimeout(r, 1500));

      const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
      await rest.patch(`/channels/${interaction.channel.id}/messages/${checkingMsg.id}`, {
        body: {
          embeds: [],
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
      }).catch(err => {
        console.error('[TICKET_TELEMETRY_RESULTS_PATCH_FAILED]', err.message);
        // Fallback to updating with standard embeds in case REST patch fails
        const inviteEmbed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('<:member:1505974580626591976> Invite Telemetry Results')
          .setDescription(`<a:emoji_25:1504806993280503810> **Valid Referrals** — __**\`${stats.valid}\`**__\n\n> **Total Joins  = ** ${stats.total}\n> **Left Server = ** ${stats.left}\n> **Fake Joins   = ** ${stats.fake}\n> **Rejoined     = ** ${stats.rejoin}`);
        checkingMsg.edit({ embeds: [inviteEmbed] }).catch(() => {});
      });

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
          new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
        );
        await interaction.channel.send({ components: [btnRow] });
      }
    }

    // Close Ticket action
    if (interaction.customId === 'close_ticket') {
      await interaction.reply('🔒 Closing this ticket in 5 seconds...');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
  }

  // ── SELECT MENU (REWARD CLAIM) ──
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'claim_reward_ticket' || interaction.customId === 'claim_reward_direct') {
      const rewardId = interaction.values[0];
      const reward = getRewardById(rewardId);
      if (!reward) return interaction.reply({ content: '❌ Invalid reward.', flags: MessageFlags.Ephemeral });

      const invCount = db.getInviteCount(interaction.user.id);
      const is1Inv = db.getSetting('event1invite', false);
      const cost = is1Inv ? 1 : reward.invites;

      if (invCount < cost) {
        const embed = new EmbedBuilder()
          .setColor('#ef4444')
          .setTitle('❌ Not Enough Invites')
          .setDescription(`You need **${cost}** invites for **${reward.label}**.\nYou currently have **${invCount}** invite(s).\n\n📢 Invite **${cost - invCount}** more friend(s) to claim!`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      // Deduct invites
      const deducted = db.deductInvites(interaction.user.id, cost);
      if (!deducted) {
        return interaction.reply({ content: '❌ Failed to process. Try again.', flags: MessageFlags.Ephemeral });
      }

      // Generate code + local log
      const code = db.generateCode();
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

      // --- SYNC WITH BACKEND DATABASE ---
      syncCodeToBackend(code, reward.category);

      // ── PAYOUT in spoiler format ──
      await interaction.reply({
        content: `<a:Event:1504576267788357742> **REWARD CLAIMED — ${reward.label.toUpperCase()}**\n\n||redeem code - ${code}||\n\nclaim site ||https://riwaayat.dev/redeem/verify||`
      });

      // ── ARE WE LEGIT?? ──
      await new Promise(r => setTimeout(r, 2000));
      await interaction.channel.send('## ARE WE LEGIT??');
    }
  }
});

// ─── LEGIT LISTENER (30min timer + auto-close) ────────────────────
client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  if (!message.channel.name?.startsWith('claim-')) return;

  if (message.content.toLowerCase().includes('legit')) {
    message.reply(`✅ Thanks for confirming! This ticket will auto-close in **30 minutes**. ⏳`);
    setTimeout(() => {
      message.channel.delete().catch(() => {});
    }, 30 * 60 * 1000);
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
