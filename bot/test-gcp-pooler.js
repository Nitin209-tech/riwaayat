const { Pool } = require('pg');

const url = "postgresql://postgres.yxliajsnkbumqgcslbms:Shubham%40123@gcp-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
console.log('Testing GCP Session Pooler URL:', url);

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const client = await pool.connect();
    console.log('🎉 CONNECTION SUCCESSFUL ON GCP POOLER!');
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
