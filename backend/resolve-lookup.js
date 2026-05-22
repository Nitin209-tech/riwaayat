const dns = require('dns').promises;

async function main() {
  try {
    const host = 'db.yxliajsnkbumqgcslbms.supabase.co';
    console.log('Resolving host via lookup:', host);
    const result = await dns.lookup(host, { family: 4 });
    console.log('IPv4 Lookup Result:', result);
  } catch (err) {
    console.error('Lookup failed:', err);
  }
}

main();
