const { Pool } = require('pg');

const url = "postgresql://postgres.yxliajsnkbumqgcslbms:Shubham%40123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
console.log('Testing IPv4 Session Pooler URL:', url);

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const client = await pool.connect();
    console.log('🎉 CONNECTION SUCCESSFUL ON SESSION POOLER!');
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
