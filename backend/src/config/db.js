const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// For local development, you might want to disable SSL if your local PG doesn't support it
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')) {
  delete pool.options.ssl;
}

module.exports = pool;