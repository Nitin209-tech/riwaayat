const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.yxliajsnkbumqgcslbms:Shubham%409310@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});
async function checkDB() {
  try {
    const res = await pool.query('SELECT code, "usedCount", status FROM "RedeemCode" ORDER BY id DESC LIMIT 5');
    console.log('LATEST CODES IN DB:', res.rows);
  } catch (err) {
    console.error('DB ERROR:', err);
  } finally {
    pool.end();
  }
}
checkDB();
