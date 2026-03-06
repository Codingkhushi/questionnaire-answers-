const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
  connectionString: process.env.DATABASE_URL
};

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')) {
  dbConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(dbConfig);

module.exports = pool;