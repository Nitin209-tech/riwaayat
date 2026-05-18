const { Client, GatewayIntentBits, Partials, ActivityType, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ChannelType, PermissionFlagsBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const db = require('./database');
const { REWARDS, getRewardById, emojiStr } = require('./rewards');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

// ─── SLASH COMMAND DEFINITIONS ─────────────────────────────────────
const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Show all bot commands'),
  new SlashCommandBuilder().setName('invites').setDescription('Check your invite count'),
  new SlashCommandBuilder().setName('claim').setDescription('Claim a reward using your invites'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('View top inviters'),
  new SlashCommandBuilder().setName('panel')
    .setDescription('Post the claim ticket panel embed (Admin only)'),
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
  new SlashCommandBuilder().setName('addinvites')
    .setDescription('Manually add invites to a user (Admin only)')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of invites to add').setRequired(true)),
  new SlashCommandBuilder().setName('removeinvites')
    .setDescription('Remove invites from a user (Admin only)')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of invites to remove').setRequired(true)),
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

// ─── BOT READY ─────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`🤖 RIWAAYAT BOT ONLINE: ${client.user.tag}`);
  console.log('══════════════════════════════════════════════════════\n');
  client.user.setActivity('RIWAAYAT Rewards', { type: ActivityType.Watching });

  // Register slash commands for all guilds the bot is in
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
});

// ─── INVITE TRACKER ────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  try {
    // Check if this is a rejoin
    const isRejoin = db.wasLeftMember(member.user.id);

    const cached = guildInvites.get(member.guild.id);
    const current = await member.guild.invites.fetch();

    let inviterUser = null;
    for (const [code, invite] of current) {
      const prev = cached?.get(code) || 0;
      if (invite.uses > prev) {
        inviterUser = invite.inviter;
        cached?.set(code, invite.uses);
        break;
      }
    }

    if (inviterUser) {
      if (inviterUser.id === member.user.id) {
        // Self-invite = fake
        db.addFakeInvite(inviterUser.id, inviterUser.username);
        console.log(`[FAKE] @${inviterUser.username} self-invited (fake +1)`);
      } else if (isRejoin) {
        // Rejoin invite
        db.addRejoinInvite(inviterUser.id, inviterUser.username);
        console.log(`[REJOIN] @${member.user.username} rejoined (inviter: @${inviterUser.username})`);
      } else {
        // Valid invite
        const userData = db.addInvite(inviterUser.id, inviterUser.username);
        console.log(`[INVITE] @${inviterUser.username} gained +1 invite (total: ${userData.count})`);
      }
    }

    guildInvites.set(member.guild.id, new Map(current.map(inv => [inv.code, inv.uses])));
  } catch (err) {
    console.error('[INVITE_ERROR]', err.message);
  }
});

// ─── MEMBER LEAVE TRACKER (for rejoin detection) ───────────────────
client.on('guildMemberRemove', (member) => {
  db.trackLeave(member.user.id);
  console.log(`[LEAVE] @${member.user.username} left the server`);
});

// ─── SLASH COMMAND HANDLER ─────────────────────────────────────────
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
          { name: '➕ `/addinvites`', value: 'Give invites to a user (Admin)' }
        )
        .setFooter({ text: 'RIWAAYAT • Invite to Earn Platform' });
      return interaction.reply({ embeds: [embed] });
    }

    // /invites
    if (commandName === 'invites') {
      const count = db.getInviteCount(interaction.user.id);
      const embed = new EmbedBuilder()
        .setColor('#1d4ed8')
        .setTitle('📊 Your Invite Balance')
        .setDescription(`**@${interaction.user.username}**\n\n🎟️ Available Invites: **${count}**`)
        .addFields({ name: 'Reward Costs', value: REWARDS.map(r => `${r.emoji} ${r.label.split(' ').slice(1).join(' ')} — **${r.invites} invites**`).join('\n') })
        .setFooter({ text: 'Invite friends to earn more!' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /claim — show reward dropdown
    if (commandName === 'claim') {
      const count = db.getInviteCount(interaction.user.id);
      const options = REWARDS.map(r => ({
        label: r.label,
        description: `${r.invites} invites needed ${count >= r.invites ? '✓' : '✕'}`,
        value: r.id,
        emoji: { id: r.emojiId, name: r.emojiName, animated: r.animated }
      }));

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

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
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

    // /panel (Admin) — post claim panel embed with button
    if (commandName === 'panel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('⩩﹕ᨒ﹒click here to create ticket')
        .setDescription('<a:hwart:1504576453730242570> To create a ticket use the Create ticket button')
        .setFooter({ text: 'RIWAAYAT — Invite to Earn' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket')
          .setLabel('Create ticket')
          .setEmoji('📩')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: '✅ Panel posted!', ephemeral: true });
    }

    // /stock
    if (commandName === 'stock') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'add') {
        const category = interaction.options.getString('category');
        const code = interaction.options.getString('code');
        db.addStock(category, code);
        const count = db.getStockCount(category);
        return interaction.reply({ content: `✅ Code added to **${category}** stock! Current stock: **${count}**`, ephemeral: true });
      }

      if (sub === 'generate') {
        const category = interaction.options.getString('category');
        const count = Math.min(50, Math.max(1, interaction.options.getInteger('count')));
        const codes = [];
        for (let i = 0; i < count; i++) {
          const code = db.generateCode();
          db.addStock(category, code);
          codes.push(code);
        }
        const total = db.getStockCount(category);
        const embed = new EmbedBuilder()
          .setColor('#10b981')
          .setTitle(`✅ Generated ${count} codes for ${category}`)
          .setDescription(`\`\`\`\n${codes.join('\n')}\n\`\`\``)
          .addFields({ name: 'Total Stock', value: `**${total}** codes available` })
          .setFooter({ text: 'RIWAAYAT Admin Panel' });
        return interaction.reply({ embeds: [embed], ephemeral: true });
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
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    // /addinvites (Admin)
    if (commandName === 'addinvites') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
      }
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const dbData = db.loadDB();
      const user = db.getUser(dbData, targetUser.id, targetUser.username);
      user.count += amount;
      user.totalEarned += amount;
      db.saveDB(dbData);
      return interaction.reply({ content: `✅ Added **${amount}** invites to **@${targetUser.username}**. New balance: **${user.count}**`, ephemeral: true });
    }

    // /removeinvites (Admin)
    if (commandName === 'removeinvites') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
      }
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const dbData = db.loadDB();
      const user = db.getUser(dbData, targetUser.id, targetUser.username);
      if (user.count < amount) {
        return interaction.reply({ content: `❌ **@${targetUser.username}** only has **${user.count}** invites. Cannot remove **${amount}**.`, ephemeral: true });
      }
      user.count -= amount;
      db.saveDB(dbData);
      return interaction.reply({ content: `✅ Removed **${amount}** invites from **@${targetUser.username}**. New balance: **${user.count}**`, ephemeral: true });
    }
  }

  // ── BUTTON INTERACTIONS ──
  if (interaction.isButton()) {

    // Open Ticket button
    if (interaction.customId === 'open_ticket') {
      await interaction.deferReply({ ephemeral: true });

      const existing = interaction.guild.channels.cache.find(
        c => c.name === `claim-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`
      );
      if (existing) {
        return interaction.editReply({ content: `❌ You already have an open ticket: ${existing}` });
      }

      try {
        const ticketChannel = await interaction.guild.channels.create({
          name: `claim-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
          ]
        });

        // Ping user
        await ticketChannel.send({ content: `${interaction.user}` });

        const stats = db.getUserStats(interaction.user.id);
        const eligible = REWARDS.filter(r => stats.valid >= r.invites);

        // ── STEP 1: Welcome Embed ──
        const welcomeEmbed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('<a:Event:1504576267788357742> RIWAAYAT — Welcome!')
          .setDescription(`<a:nyt_zwelcome:1504591019436544010> Hey **${interaction.user.username}**!\n<a:hwart:1504576453730242570> We're glad you're here!\n\nYour claim ticket has been created. Please wait while we check your invites...`)
          .setTimestamp();
        await ticketChannel.send({ embeds: [welcomeEmbed] });

        // Small delay for effect
        await new Promise(r => setTimeout(r, 1500));

        // ── STEP 2: Invite Checking Embed ──
        const inviteEmbed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('<:member:1505974580626591976> Invite Dispatching')
          .setDescription(`<a:emoji_25:1504806993280503810> **Valid Invites** — __**\`${stats.valid}\`**__\n\n> <a:emoji_25:1504806993280503810>**Total  = ** ${stats.total}\n> <a:emoji_25:1504806993280503810>**Left =    ** ${stats.left}\n> <a:emoji_25:1504806993280503810>**Fake =   ** ${stats.fake}\n> <a:emoji_25:1504806993280503810>**Rejoin = ** ${stats.rejoin}`);
        await ticketChannel.send({ embeds: [inviteEmbed] });

        await new Promise(r => setTimeout(r, 1000));

        // ── STEP 3: Reward Selection or Not Enough ──
        if (eligible.length === 0) {
          // Not enough invites — inform user
          const noRewardEmbed = new EmbedBuilder()
            .setColor('#ef4444')
            .setTitle('❌ Not Enough Invites')
            .setDescription(`You have **${stats.valid}** invite(s). No rewards are available at this level.\n\n**Minimum requirement:** **2 invites**\n\nInvite **${2 - stats.valid}** more friend(s) to unlock rewards!`);
          await ticketChannel.send({ embeds: [noRewardEmbed] });

          const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
          );
          await ticketChannel.send({ components: [closeRow] });
        } else {
          // Build reward showcase — only eligible rewards
          const grouped = {};
          for (const r of eligible) {
            if (!grouped[r.invites]) grouped[r.invites] = [];
            grouped[r.invites].push(r);
          }
          let rewardLines = '';
          for (const [inv, rewards] of Object.entries(grouped).sort((a,b) => a[0]-b[0])) {
            const lines = rewards.map(r => `**${inv} INVITE** ≫ **${r.label.toUpperCase()}** ${emojiStr(r)}`).join('\n');
            rewardLines += lines + '\n\n';
          }

          // Component V2 with dropdown (only eligible rewards)
          const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
          await rest.post(`/channels/${ticketChannel.id}/messages`, {
            body: {
              flags: 32768,
              components: [
                {
                  type: 17,
                  components: [
                    {
                      type: 10,
                      content: `<a:Event:1504576267788357742> **AVAILABLE REWARDS**\n\n${rewardLines.trim()}`
                    },
                    { type: 14, spacing: 2 },
                    {
                      type: 10,
                      content: `Select a reward from the dropdown below. Your invites will be deducted upon claim.`
                    },
                    {
                      type: 1,
                      components: [
                        {
                          type: 3,
                          custom_id: 'claim_reward_ticket',
                          placeholder: 'Select your rewards',
                          min_values: 1,
                          max_values: 1,
                          options: eligible.map(r => ({
                            label: r.label,
                            value: r.id,
                            description: `${r.invites} invites needed`,
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
            new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('refresh_invites').setLabel('🔄 Refresh Invites').setStyle(ButtonStyle.Secondary)
          );
          await ticketChannel.send({ components: [btnRow] });
        }

        return interaction.editReply({ content: `✅ Ticket created: ${ticketChannel}` });
      } catch (err) {
        console.error('[TICKET_ERROR]', err.message || err);
        return interaction.editReply({ content: `❌ Ticket error: ${err.message}` });
      }
    }

    // Check Invites button (from panel)
    if (interaction.customId === 'check_invites_btn') {
      const count = db.getInviteCount(interaction.user.id);
      return interaction.reply({
        content: `📊 **@${interaction.user.username}** — You have **${count}** invite(s).`,
        ephemeral: true
      });
    }

    // Close ticket button
    if (interaction.customId === 'close_ticket') {
      await interaction.reply('🔒 Closing this ticket in 5 seconds...');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }

    // Refresh invites in ticket
    if (interaction.customId === 'refresh_invites') {
      const count = db.getInviteCount(interaction.user.id);
      return interaction.reply({ content: `📊 Updated invite count: **${count}**`, ephemeral: true });
    }
  }

  // ── SELECT MENU (REWARD CLAIM) ──
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'claim_reward_ticket' || interaction.customId === 'claim_reward_direct') {
      const rewardId = interaction.values[0];
      const reward = getRewardById(rewardId);
      if (!reward) return interaction.reply({ content: '❌ Invalid reward.', ephemeral: true });

      const invCount = db.getInviteCount(interaction.user.id);

      if (invCount < reward.invites) {
        const embed = new EmbedBuilder()
          .setColor('#ef4444')
          .setTitle('❌ Not Enough Invites')
          .setDescription(`You need **${reward.invites}** invites for **${reward.label}**.\nYou currently have **${invCount}** invite(s).\n\n📢 Invite **${reward.invites - invCount}** more friend(s) to claim!`);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Deduct invites
      const deducted = db.deductInvites(interaction.user.id, reward.invites);
      if (!deducted) {
        return interaction.reply({ content: '❌ Failed to process. Try again.', ephemeral: true });
      }

      // Generate code + save
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
