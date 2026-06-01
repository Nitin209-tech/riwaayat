const REWARDS = [
  { id: 'mc_account',  label: 'Minecraft Account',     category: 'MINECRAFT_ACC',  invites: 2, emojiId: '1504591125501972481', emojiName: 'nyt_zminecraft', animated: true },
  { id: 'mc_code',     label: 'MC Redeem Code',         category: 'MINECRAFT_CODE', invites: 4, emojiId: '1504591125501972481', emojiName: 'nyt_zminecraft', animated: true },
  { id: 'nitro_basic', label: 'Nitro Basic Link',       category: 'NITRO_BASIC',    invites: 2, emojiId: '1504810251545743410', emojiName: 'Pz_NITRO', animated: true },
  { id: 'nitro_boost', label: 'Nitro Boost Link',       category: 'NITRO_BOOST',    invites: 4, emojiId: '1504810251545743410', emojiName: 'Pz_NITRO', animated: true },
  { id: 'robux_50',    label: '50$ Roblox Giftcard',    category: 'ROBUX_50',       invites: 2, emojiId: '1504606073502568578', emojiName: 'Robux_2019_Logo_gold', animated: false },
  { id: 'robux_100',   label: '100$ Roblox Giftcard',   category: 'ROBUX_100',      invites: 4, emojiId: '1504606073502568578', emojiName: 'Robux_2019_Logo_gold', animated: false },
  { id: 'yt_10k',      label: 'YT 10k Subs',           category: 'YT_10K',         invites: 2, emojiId: '1504591010888683600', emojiName: 'RG_yt', animated: true },
  { id: 'yt_30k',      label: 'YT 30k Subs',           category: 'YT_30K',         invites: 4, emojiId: '1504591010888683600', emojiName: 'RG_yt', animated: true },
  { id: 'valorant_2500', label: 'Valorant 2500 Points', category: 'VALORANT_2500', invites: 2, emojiId: '1504591139695628340', emojiName: 'nyt_zvalo', animated: true },
  { id: 'valorant_5000', label: 'Valorant 5000 Points', category: 'VALORANT_5000', invites: 4, emojiId: '1504591139695628340', emojiName: 'nyt_zvalo', animated: true },
  
  // New Event Rewards
  { id: 'nitro_basic_1m', label: 'Nitro Basic (1 month)', category: 'NITRO_BASIC_1M', invites: 2, emojiId: '1510922581966852096', emojiName: '1504598957597392966', animated: false },
  { id: 'nitro_boost_1m', label: 'Nitro Boost (1 month)', category: 'NITRO_BOOST_1M', invites: 6, emojiId: '1510926623925469185', emojiName: '1504598960944320592', animated: false },
  { id: 'nitro_basic_1y', label: 'Nitro Basic (1 year)', category: 'NITRO_BASIC_1Y', invites: 9, emojiId: '1510922581966852096', emojiName: '1504598957597392966', animated: false },
  { id: 'nitro_boost_1y', label: 'Nitro Boost (1 year)', category: 'NITRO_BOOST_1Y', invites: 12, emojiId: '1510926623925469185', emojiName: '1504598960944320592', animated: false },
  { id: 'robux_450',     label: '450 Robux',              category: 'ROBUX_450',       invites: 3, emojiId: '1510922058723495968', emojiName: '1504598999800479905', animated: false },
  { id: 'robux_1500',    label: '1,500 Robux',            category: 'ROBUX_1500',      invites: 6, emojiId: '1510922058723495968', emojiName: '1504598999800479905', animated: false },
  { id: 'robux_4500',    label: '4,500 Robux',            category: 'ROBUX_4500',      invites: 9, emojiId: '1510922058723495968', emojiName: '1504598999800479905', animated: false }
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
