/**
 * Database Configuration & Connection Pool
 * Handles standard queries and dedicated client checkout for ACID Transactions.
 */

const { Pool } = require('pg');
const { Connector } = require('@google-cloud/cloud-sql-connector');

let pool;

/**
 * Initializes PostgreSQL Pool targeting specified DB_NAME
 */
const initPool = async () => {
  if (pool) return pool;

  const dbName = process.env.DB_NAME || 'kpi_db_test';

  if (process.env.NODE_ENV === 'production') {
    console.log(`[Database] Connected to Cloud SQL via Unix Socket | Database: ${dbName}`);
    pool = new Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: dbName,
      host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
    });
  } else {
    console.log(`[Database] Connected to Cloud SQL via GCP Connector | Database: ${dbName}`);
    const connector = new Connector();
    const clientOpts = await connector.getOptions({
      instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME,
      ipType: 'PUBLIC',
    });

    pool = new Pool({
      ...clientOpts,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: dbName,
    });
  }

  pool.on('error', (err) => {
    console.error('[Database Error] Unexpected error on idle client:', err);
  });

  return pool;
};

module.exports = {
  // Use for standard, single-statement queries where atomicity is not a concern
  query: async (text, params) => {
    const currentPool = await initPool();
    return currentPool.query(text, params);
  },
  
  // Use for multi-statement ACID Transactions (Requires manual client.release() in a finally block)
  getClient: async () => {
    const currentPool = await initPool();
    return currentPool.connect(); 
  }
};