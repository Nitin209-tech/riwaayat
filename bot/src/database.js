const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'database.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {}
  return { invites: {}, stock: {}, tickets: [], redemptions: [], settings: {} };
}

function saveDB(data) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ─── KEY HELPERS ────────────────────────────────────────────────────
function inviteKey(discordId, guildId) {
  return guildId ? `${guildId}_${discordId}` : discordId;
}

function settingKey(key, guildId) {
  return guildId ? `${guildId}_${key}` : key;
}

function leftKey(memberId, guildId) {
  return guildId ? `${guildId}_${memberId}` : memberId;
}

// ─── USER HELPERS ────────────────────────────────────────────────────
function getUser(db, discordId, username, guildId) {
  const key = inviteKey(discordId, guildId);
  if (!db.invites[key]) {
    db.invites[key] = { username: username || 'Unknown', count: 0, totalEarned: 0, fake: 0, rejoin: 0 };
  }
  const u = db.invites[key];
  if (u.fake === undefined) u.fake = 0;
  if (u.rejoin === undefined) u.rejoin = 0;
  if (username) u.username = username;
  return u;
}

function getUserStats(discordId, guildId) {
  const db = loadDB();
  const key = inviteKey(discordId, guildId);
  const u = db.invites[key] || { count: 0, totalEarned: 0, fake: 0, rejoin: 0 };

  // Filter joinLogs by guildId if provided
  const allLogs = db.joinLogs || [];
  const logs = allLogs.filter(l =>
    l.inviterId === discordId &&
    (guildId ? l.guildId === guildId : true)
  );
  const leftCount = logs.filter(l => l.status === 'LEFT').length;
  return {
    valid: u.count,
    total: u.totalEarned,
    left: leftCount,
    fake: u.fake || 0,
    rejoin: u.rejoin || 0
  };
}

function addFakeInvite(discordId, username, guildId) {
  const db = loadDB();
  const user = getUser(db, discordId, username, guildId);
  user.fake += 1;
  saveDB(db);
}

function addRejoinInvite(discordId, username, guildId) {
  const db = loadDB();
  const user = getUser(db, discordId, username, guildId);
  user.rejoin += 1;
  saveDB(db);
}

function trackLeave(memberId, guildId) {
  const db = loadDB();
  if (!db.leftMembers) db.leftMembers = [];
  const key = leftKey(memberId, guildId);
  if (!db.leftMembers.includes(key)) db.leftMembers.push(key);
  saveDB(db);
}

function wasLeftMember(memberId, guildId) {
  const db = loadDB();
  const key = leftKey(memberId, guildId);
  return (db.leftMembers || []).includes(key);
}

function addInvite(discordId, username, guildId) {
  const db = loadDB();
  const user = getUser(db, discordId, username, guildId);
  user.count += 1;
  user.totalEarned += 1;
  saveDB(db);
  return user;
}

function getInviteCount(discordId, guildId) {
  const db = loadDB();
  const key = inviteKey(discordId, guildId);
  return db.invites[key]?.count || 0;
}

function deductInvites(discordId, amount, guildId) {
  const db = loadDB();
  const key = inviteKey(discordId, guildId);
  if (!db.invites[key] || db.invites[key].count < amount) return false;
  db.invites[key].count -= amount;
  saveDB(db);
  return true;
}

function addStock(category, code) {
  const db = loadDB();
  if (!db.stock[category]) db.stock[category] = [];
  db.stock[category].push({ code, claimed: false, claimedBy: null, claimedAt: null });
  saveDB(db);
}

function getStockCount(category) {
  const db = loadDB();
  if (!db.stock[category]) return 0;
  return db.stock[category].filter(s => !s.claimed).length;
}

function claimFromStock(category, discordId) {
  const db = loadDB();
  if (!db.stock[category]) return null;
  const available = db.stock[category].find(s => !s.claimed);
  if (!available) return null;
  available.claimed = true;
  available.claimedBy = discordId;
  available.claimedAt = new Date().toISOString();
  if (!db.redemptions) db.redemptions = [];
  db.redemptions.push({ discordId, category, code: available.code, date: available.claimedAt });
  saveDB(db);
  return available.code;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const parts = [];
  for (let i = 0; i < 5; i++) {
    let part = '';
    for (let j = 0; j < 5; j++) part += chars[Math.floor(Math.random() * chars.length)];
    parts.push(part);
  }
  return parts.join('-');
}

function getAllStockCounts() {
  const db = loadDB();
  const counts = {};
  for (const cat of Object.keys(db.stock || {})) {
    counts[cat] = (db.stock[cat] || []).filter(s => !s.claimed).length;
  }
  return counts;
}

function getLeaderboard(limit = 10, guildId) {
  const db = loadDB();
  const prefix = guildId ? `${guildId}_` : null;
  return Object.entries(db.invites)
    .filter(([key]) => prefix ? key.startsWith(prefix) : !key.includes('_'))
    .map(([key, data]) => {
      const discordId = prefix ? key.slice(prefix.length) : key;
      return { discordId, ...data };
    })
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .slice(0, limit);
}

function logJoin(inviterId, inviterUsername, inviteeId, inviteeUsername, code, status, guildId) {
  const db = loadDB();
  if (!db.joinLogs) db.joinLogs = [];
  db.joinLogs.push({
    inviterId,
    inviterUsername,
    inviteeId,
    inviteeUsername,
    code,
    status,
    guildId: guildId || null,
    timestamp: new Date().toISOString()
  });
  saveDB(db);
}

function handleLeaveAndGetInviter(inviteeId, guildId) {
  const db = loadDB();
  const key = leftKey(inviteeId, guildId);
  if (!db.leftMembers) db.leftMembers = [];
  if (!db.leftMembers.includes(key)) db.leftMembers.push(key);

  if (!db.joinLogs) db.joinLogs = [];
  const log = [...db.joinLogs].reverse().find(l =>
    l.inviteeId === inviteeId &&
    l.status === 'VALID' &&
    (guildId ? l.guildId === guildId : true)
  );
  if (log) {
    log.status = 'LEFT';
    const invKey = inviteKey(log.inviterId, guildId);
    if (db.invites[invKey] && db.invites[invKey].count > 0) {
      db.invites[invKey].count -= 1;
    }
    saveDB(db);
    return log;
  }
  saveDB(db);
  return null;
}

function getJoinLogs(inviterId, guildId) {
  const db = loadDB();
  return (db.joinLogs || []).filter(l =>
    l.inviterId === inviterId &&
    (guildId ? l.guildId === guildId : true)
  );
}

function setSetting(key, val, guildId) {
  const db = loadDB();
  if (!db.settings) db.settings = {};
  db.settings[settingKey(key, guildId)] = val;
  saveDB(db);
}

function getSetting(key, defaultVal, guildId) {
  const db = loadDB();
  if (!db.settings) return defaultVal;
  const k = settingKey(key, guildId);
  return db.settings[k] !== undefined ? db.settings[k] : defaultVal;
}

module.exports = {
  loadDB, saveDB, getUser, addInvite, getInviteCount, deductInvites,
  addStock, getStockCount, claimFromStock, generateCode, getAllStockCounts, getLeaderboard,
  getUserStats, addFakeInvite, addRejoinInvite, trackLeave, wasLeftMember,
  logJoin, handleLeaveAndGetInviter, getJoinLogs, setSetting, getSetting
};
