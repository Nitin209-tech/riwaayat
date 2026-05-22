const { PrismaClient } = require('@prisma/client');

const url = "postgresql://postgres.yxliajsnkbumqgcslbms:Shubham%40123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
console.log('Testing SG Pooler URL:', url);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: url
    }
  }
});

async function main() {
  try {
    console.log('Attempting connection to Supavisor Singapore pooler node...');
    await prisma.$connect();
    console.log('🎉 CONNECTION SUCCESSFUL ON SG POOLER NODE!');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Query result:', result);
  } catch (err) {
    console.error('❌ Connection failed with error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
