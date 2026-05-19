const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { encrypt } = require('../utils/encryption');

const JWT_SECRET = process.env.JWT_SECRET || 'cyber-riwaayat-premium-jwt-super-secret-key-256-change-me-in-production';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1485034551108702268';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'mock_secret';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'mock_bot_token';
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '';

/**
 * Capture Visitor IP, User Agent, and Country details
 */
async function captureVisitor(req, res) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const country = req.headers['cf-ipcountry'] || 'India';

    const visitor = await prisma.visitor.create({
      data: {
        ipAddress: ip,
        userAgent: userAgent,
        country: country
      }
    });

    return res.status(200).json({ success: true, visitorId: visitor.id, ip, country });
  } catch (err) {
    console.error('Visitor capture failure:', err);
    return res.status(500).json({ success: false, error: 'Database capture failed' });
  }
}

/**
 * Perform Discord OAuth callback handling & auto joining guild
 */
async function handleDiscordCallback(req, res) {
  const { code, redirect_uri } = req.query;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!code) {
    return res.status(400).json({ success: false, error: 'Authorization code missing' });
  }

  try {
    // Live OAuth2 Token Exchange
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri,
        scope: 'identify email guilds.join'
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      return res.status(400).json({ success: false, error: tokenData.error_description || 'OAuth token exchange failed' });
    }

    const { access_token, refresh_token } = tokenData;

    // Fetch user details from Discord API
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const userData = await userResponse.json();

    if (!userData.id) {
      return res.status(400).json({ success: false, error: 'Failed to retrieve Discord profile' });
    }

    // User has successfully authenticated, attempt to add user to the Discord server
    let joinedServer = false;
    if (DISCORD_BOT_TOKEN && DISCORD_GUILD_ID && userData.id) {
      try {
        const joinResponse = await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${userData.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            access_token: access_token
          })
        });

        if (joinResponse.status === 201 || joinResponse.status === 204) {
          joinedServer = true;
          console.log(`[DISCORD_AUTO_JOIN_SUCCESS] Successfully added user ${userData.username} to guild ${DISCORD_GUILD_ID}. Status: ${joinResponse.status}`);
        } else {
          const joinDetails = await joinResponse.json().catch(() => ({}));
          console.warn(`[DISCORD_AUTO_JOIN_FAILED] Discord API responded with status ${joinResponse.status}:`, joinDetails);
          // If the status is 204, the user was already a member of the guild
          if (joinResponse.status === 204) {
            joinedServer = true;
          }
        }
      } catch (joinErr) {
        console.error('[DISCORD_AUTO_JOIN_CRASH] Failed to auto-join guild:', joinErr);
      }
    }

    // Save/Upsert Discord user data securely
    const user = await prisma.user.upsert({
      where: { discordId: userData.id },
      update: {
        username: userData.username,
        globalName: userData.global_name,
        avatar: userData.avatar,
        email: encrypt(userData.email || ''),
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : null,
        joinedServer
      },
      create: {
        discordId: userData.id,
        username: userData.username,
        globalName: userData.global_name,
        avatar: userData.avatar,
        email: encrypt(userData.email || ''),
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : null,
        role: 'USER',
        coins: 100, // starting coins
        joinedServer
      }
    });

    // Write security audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        ipAddress: ip,
        details: `User ${user.username} logged in via Discord OAuth. Joined server: ${joinedServer}`
      }
    });

    // Sign session Token
    const token = jwt.sign(
      { id: user.id, discordId: user.discordId, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        discordId: user.discordId,
        username: user.username,
        role: user.role,
        coins: user.coins
      },
      token
    });
  } catch (err) {
    console.error('OAuth callback handler crashed:', err);
    return res.status(500).json({ success: false, error: 'Internal OAuth flow crash' });
  }
}

module.exports = { captureVisitor, handleDiscordCallback };
