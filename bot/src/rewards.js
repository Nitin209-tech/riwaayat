const REWARDS = [
  { id: 'mc_account',  label: 'Minecraft Account',     category: 'MINECRAFT_ACC',  invites: 2, emojiId: '1504591125501972481', emojiName: 'nyt_zminecraft', animated: true },
  { id: 'mc_code',     label: 'MC Redeem Code',         category: 'MINECRAFT_CODE', invites: 4, emojiId: '1504591125501972481', emojiName: 'nyt_zminecraft', animated: true },
  { id: 'nitro_basic', label: 'Nitro Basic Link',       category: 'NITRO_BASIC',    invites: 2, emojiId: '1504810251545743410', emojiName: 'Pz_NITRO', animated: true },
  { id: 'nitro_boost', label: 'Nitro Boost Link',       category: 'NITRO_BOOST',    invites: 4, emojiId: '1504810251545743410', emojiName: 'Pz_NITRO', animated: true },
  { id: 'robux_50',    label: '50$ Roblox Giftcard',    category: 'ROBUX_50',       invites: 2, emojiId: '1504606073502568578', emojiName: 'Robux_2019_Logo_gold', animated: false },
  { id: 'robux_100',   label: '100$ Roblox Giftcard',   category: 'ROBUX_100',      invites: 4, emojiId: '1504606073502568578', emojiName: 'Robux_2019_Logo_gold', animated: false },
  { id: 'yt_10k',      label: 'YT 10k Subs',           category: 'YT_10K',         invites: 2, emojiId: '1504591010888683600', emojiName: 'RG_yt', animated: true },
  { id: 'yt_30k',      label: 'YT 30k Subs',           category: 'YT_30K',         invites: 4, emojiId: '1504591010888683600', emojiName: 'RG_yt', animated: true },
];

function getRewardById(id) {
  return REWARDS.find(r => r.id === id);
}

function getRewardByCategory(category) {
  return REWARDS.find(r => r.category === category);
}

// Get emoji string for use in text content
function emojiStr(r) {
  return r.animated ? `<a:${r.emojiName}:${r.emojiId}>` : `<:${r.emojiName}:${r.emojiId}>`;
}

module.exports = { REWARDS, getRewardById, getRewardByCategory, emojiStr };
