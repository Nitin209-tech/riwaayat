const { PrismaClient } = require('@prisma/client');

let prisma;

try {
  prisma = new PrismaClient();
  // Quick test connection
  prisma.$connect()
    .then(() => console.log('📡 Database connection established successfully.'))
    .catch((err) => {
      console.warn('⚠️ PostgreSQL database is offline. Sandbox mock client mode active.');
      prisma = createMockPrisma();
    });
} catch (e) {
  console.warn('⚠️ Prisma engine error. Falling back to sandbox mock.');
  prisma = createMockPrisma();
}

function createMockPrisma() {
  const store = {
    visitors: [],
    users: [],
    rewards: [
      { id: '1', category: 'MINECRAFT', name: 'Minecraft Premium Key', description: 'Redeem full access Minecraft Java & Bedrock key.', inrPrice: 'Rs.2,499', coinsCost: 1500, stock: 10, maxStock: 25, imageUrl: 'https://images.unsplash.com/photo-1605901309584-818e25960a8f?q=80&w=300' },
      { id: '2', category: 'NITRO', name: 'Discord Nitro Premium (1 Month)', description: 'Gain custom emojis, larger uploads, and 2 server boosts.', inrPrice: 'Rs.350', coinsCost: 800, stock: 15, maxStock: 30, imageUrl: 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?q=80&w=300' }
    ],
    redeemCodes: [
      { id: 'c1', rewardId: '1', code: 'MC-FREE-KEY-2026', encryptedPayload: 'MC-AAAA-BBBB-CCCC', maxUses: 1, usedCount: 0 },
      { id: 'c2', rewardId: '2', code: 'NITRO-BOOST-GIFT', encryptedPayload: 'https://discord.gift/nitro-promo-test-link', maxUses: 5, usedCount: 0 }
    ],
    redeems: [],
    auditLogs: []
  };

  return {
    visitor: {
      create: async ({ data }) => {
        const item = { id: String(Date.now()), ...data, createdAt: new Date() };
        store.visitors.push(item);
        return item;
      },
      findMany: async () => store.visitors
    },
    user: {
      findUnique: async ({ where }) => store.users.find(u => u.discordId === where.discordId),
      upsert: async ({ where, update, create }) => {
        let u = store.users.find(x => x.discordId === where.discordId);
        if (u) {
          Object.assign(u, update);
        } else {
          u = { id: String(Date.now()), ...create, createdAt: new Date(), updatedAt: new Date() };
          store.users.push(u);
        }
        return u;
      },
      update: async ({ where, data }) => {
        const u = store.users.find(x => x.id === where.id);
        if (u) Object.assign(u, data);
        return u;
      }
    },
    reward: {
      findMany: async () => store.rewards,
      findUnique: async ({ where }) => store.rewards.find(r => r.id === where.id)
    },
    redeemCode: {
      findUnique: async ({ where }) => store.redeemCodes.find(c => c.code === where.code),
      update: async ({ where, data }) => {
        const c = store.redeemCodes.find(x => x.id === where.id);
        if (c) Object.assign(c, data);
        return c;
      },
      create: async ({ data }) => {
        const c = { id: String(Date.now()), ...data, usedCount: 0 };
        store.redeemCodes.push(c);
        return c;
      }
    },
    redeemHistory: {
      create: async ({ data }) => {
        const item = { id: String(Date.now()), ...data, claimedAt: new Date() };
        store.redeems.push(item);
        return item;
      },
      findMany: async ({ where }) => store.redeems.filter(r => r.userId === where.userId)
    },
    auditLog: {
      create: async ({ data }) => {
        const item = { id: String(Date.now()), ...data, createdAt: new Date() };
        store.auditLogs.push(item);
        return item;
      },
      findMany: async () => store.auditLogs
    }
  };
}

module.exports = prisma;
