const dns = require('dns').promises;

async function main() {
  try {
    const host = 'yxliajsnkbumqgcslbms.pooler.ap-northeast-1.supabase.com';
    console.log('Resolving host:', host);
    const result = await dns.lookup(host, { all: true });
    console.log('DNS Lookup results:', result);
  } catch (err) {
    console.error('Lookup failed:', err);
  }
}

main();
