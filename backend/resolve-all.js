const dns = require('dns').promises;

async function main() {
  try {
    const host = 'db.yxliajsnkbumqgcslbms.supabase.co';
    console.log('Lookup all records for:', host);
    const result = await dns.lookup(host, { all: true });
    console.log('DNS Lookup results:', result);
  } catch (err) {
    console.error('All lookup failed:', err);
  }
}

main();
