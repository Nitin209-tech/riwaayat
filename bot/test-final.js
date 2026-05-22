const { Pool } = require('pg');

const url = "postgresql://postgres.yxliajsnkbumqgcslbms:Shubham%409310@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
console.log('Testing ACTUAL Correct Pooler URL:', url);

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const client = await pool.connect();
    console.log('🎉 CONNECTION SUCCESSFUL ON AWS-1 TOKYO POOLER!!!');
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
