const { PrismaClient } = require('@prisma/client');

const url = "postgresql://postgres:Shubham%40123@yxliajsnkbumqgcslbms.pooler.ap-northeast-1.supabase.com:6543/postgres?pgbouncer=true";
console.log('Testing NEW Supavisor Pooler URL:', url);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: url
    }
  }
});

async function main() {
  try {
    console.log('Attempting connection to Supavisor regional IPv4 Pooler...');
    await prisma.$connect();
    console.log('🎉 CONNECTION SUCCESSFUL ON NEW POOLER!');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Query result:', result);
  } catch (err) {
    console.error('❌ Connection failed with error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
