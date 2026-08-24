const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test the connection when the server starts
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring client from database pool:', err.stack);
  } else {
    console.log('Successfully connected to local PostgreSQL Database!');
  }
  if (client) release();
});

module.exports = {
  // This allows us to run db.query() cleanly from any file
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
};