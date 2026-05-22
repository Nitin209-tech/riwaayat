const { Pool } = require('pg');

const url = "postgresql://postgres.yxliajsnkbumqgcslbms:Shubham%409310@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
console.log('Testing NEW Password on Singapore Pooler:', url);

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const client = await pool.connect();
    console.log('🎉 CONNECTION SUCCESSFUL ON TOKYO POOLER WITH NEW PASSWORD!');
    const res = await client.query('SELECT 1 as test');
    console.log('Result:', res.rows);
    client.release();
  } catch (err) {
    console.error('❌ Connection Failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
