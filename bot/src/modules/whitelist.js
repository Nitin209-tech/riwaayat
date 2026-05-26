// ─── PERMANENT WHITELIST SYSTEM ─────────────────────────────────────
// Master controller ID — only this user can manage permanent whitelist & extra owners
const MASTER_CONTROLLER_ID = '1490694641975164999';

const db = require('../database');

// ─── HELPERS ────────────────────────────────────────────────────────

function getPermanentWhitelist() {
  const list = db.getSetting('permanentWhitelist', []);
  return Array.isArray(list) ? list : [];
}

function savePermanentWhitelist(list) {
  db.setSetting('permanentWhitelist', list);
}

function getExtraOwners() {
  const list = db.getSetting('extraOwners', []);
  return Array.isArray(list) ? list : [];
}

function saveExtraOwners(list) {
  db.setSetting('extraOwners', list);
}

function getGuildWhitelist(guildId) {
  const list = db.getSetting('guildWhitelist', [], guildId);
  return Array.isArray(list) ? list : [];
}

function saveGuildWhitelist(list, guildId) {
  db.setSetting('guildWhitelist', list, guildId);
}

// ─── CHECK FUNCTIONS ────────────────────────────────────────────────

function isMasterController(userId) {
  return userId === MASTER_CONTROLLER_ID;
}

function isPermanentWhitelisted(userId) {
  if (isMasterController(userId)) return true;
  return getPermanentWhitelist().includes(userId);
}

function isExtraOwner(userId) {
  if (isMasterController(userId)) return true;
  return getExtraOwners().includes(userId);
}

function isWhitelisted(userId, guildId) {
  if (isPermanentWhitelisted(userId)) return true;
  if (isExtraOwner(userId)) return true;
  const whitelistAll = db.getSetting('whitelistAll', false, guildId);
  if (whitelistAll) return true;
  const whitelistedUsers = db.getSetting('whitelistedUsers', []);
  if (whitelistedUsers.includes(userId)) return true;
  return getGuildWhitelist(guildId).includes(userId);
}

// Checks if a user can bypass anti-nuke (only permanent whitelist + extra owners)
function canBypassProtection(userId) {
  return isPermanentWhitelisted(userId) || isExtraOwner(userId);
}

// ─── MANAGEMENT FUNCTIONS ───────────────────────────────────────────

function addPermanentWhitelist(userId) {
  const list = getPermanentWhitelist();
  if (list.includes(userId)) return false;
  list.push(userId);
  savePermanentWhitelist(list);
  return true;
}

function removePermanentWhitelist(userId) {
  const list = getPermanentWhitelist();
  const idx = list.indexOf(userId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  savePermanentWhitelist(list);
  return true;
}

function listPermanentWhitelist() {
  return getPermanentWhitelist();
}

function addExtraOwner(userId) {
  const list = getExtraOwners();
  if (list.includes(userId)) return false;
  list.push(userId);
  saveExtraOwners(list);
  return true;
}

function removeExtraOwner(userId) {
  const list = getExtraOwners();
  const idx = list.indexOf(userId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  saveExtraOwners(list);
  return true;
}

function listExtraOwners() {
  return getExtraOwners();
}

function addGuildWhitelist(userId, guildId) {
  const list = getGuildWhitelist(guildId);
  if (list.includes(userId)) return false;
  list.push(userId);
  saveGuildWhitelist(list, guildId);
  return true;
}

function removeGuildWhitelist(userId, guildId) {
  const list = getGuildWhitelist(guildId);
  const idx = list.indexOf(userId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  saveGuildWhitelist(list, guildId);
  return true;
}

function listGuildWhitelist(guildId) {
  return getGuildWhitelist(guildId);
}

function setWhitelistAll(enabled, guildId) {
  db.setSetting('whitelistAll', enabled, guildId);
}

function getWhitelistAll(guildId) {
  return db.getSetting('whitelistAll', false, guildId);
}

module.exports = {
  MASTER_CONTROLLER_ID,
  isMasterController,
  isPermanentWhitelisted,
  isExtraOwner,
  isWhitelisted,
  canBypassProtection,
  addPermanentWhitelist,
  removePermanentWhitelist,
  listPermanentWhitelist,
  addExtraOwner,
  removeExtraOwner,
  listExtraOwners,
  addGuildWhitelist,
  removeGuildWhitelist,
  listGuildWhitelist,
  setWhitelistAll,
  getWhitelistAll
};
