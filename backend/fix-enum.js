require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    await client.query("ALTER TYPE \"Category\" ADD VALUE 'FORTNITE'");
    console.log("Added FORTNITE");
  } catch(e) {
    console.log("FORTNITE Error: ", e.message);
  }

  try {
    await client.query("ALTER TYPE \"Category\" ADD VALUE 'VALORANT'");
    console.log("Added VALORANT");
  } catch(e) {
    console.log("VALORANT Error: ", e.message);
  }
  
  await client.end();
}

main();
