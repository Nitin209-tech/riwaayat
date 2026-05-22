const dns = require('dns').promises;

async function main() {
  try {
    const host = 'db.yxliajsnkbumqgcslbms.supabase.co';
    console.log('Resolving host:', host);
    const addresses = await dns.resolve4(host);
    console.log('IPv4 addresses:', addresses);
  } catch (err) {
    console.error('Resolution failed:', err);
  }
}

main();
