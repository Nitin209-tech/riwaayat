const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const codes = await prisma.redeemCode.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log('LATEST CODES IN DB:', codes.map(c => ({
    code: c.code, 
    usedCount: c.usedCount, 
    status: c.status 
  })));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
