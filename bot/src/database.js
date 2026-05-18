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

function getUser(db, discordId, username) {
  if (!db.invites[discordId]) {
    db.invites[discordId] = { username: username || 'Unknown', count: 0, totalEarned: 0, fake: 0, rejoin: 0 };
  }
  const u = db.invites[discordId];
  if (u.fake === undefined) u.fake = 0;
  if (u.rejoin === undefined) u.rejoin = 0;
  if (username) u.username = username;
  return u;
}

function getUserStats(discordId) {
  const db = loadDB();
  const u = db.invites[discordId] || { count: 0, totalEarned: 0, fake: 0, rejoin: 0 };
  return {
    valid: u.count,
    total: u.totalEarned,
    left: u.count,
    fake: u.fake || 0,
    rejoin: u.rejoin || 0
  };
}

function addFakeInvite(discordId, username) {
  const db = loadDB();
  const user = getUser(db, discordId, username);
  user.fake += 1;
  saveDB(db);
}

function addRejoinInvite(discordId, username) {
  const db = loadDB();
  const user = getUser(db, discordId, username);
  user.rejoin += 1;
  saveDB(db);
}

function trackLeave(memberId) {
  const db = loadDB();
  if (!db.leftMembers) db.leftMembers = [];
  if (!db.leftMembers.includes(memberId)) db.leftMembers.push(memberId);
  saveDB(db);
}

function wasLeftMember(memberId) {
  const db = loadDB();
  return (db.leftMembers || []).includes(memberId);
}

function addInvite(discordId, username) {
  const db = loadDB();
  const user = getUser(db, discordId, username);
  user.count += 1;
  user.totalEarned += 1;
  saveDB(db);
  return user;
}

function getInviteCount(discordId) {
  const db = loadDB();
  return db.invites[discordId]?.count || 0;
}

function deductInvites(discordId, amount) {
  const db = loadDB();
  if (!db.invites[discordId] || db.invites[discordId].count < amount) return false;
  db.invites[discordId].count -= amount;
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

function getLeaderboard(limit = 10) {
  const db = loadDB();
  return Object.entries(db.invites)
    .map(([id, data]) => ({ discordId: id, ...data }))
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .slice(0, limit);
}

module.exports = {
  loadDB, saveDB, getUser, addInvite, getInviteCount, deductInvites,
  addStock, getStockCount, claimFromStock, generateCode, getAllStockCounts, getLeaderboard,
  getUserStats, addFakeInvite, addRejoinInvite, trackLeave, wasLeftMember
};
