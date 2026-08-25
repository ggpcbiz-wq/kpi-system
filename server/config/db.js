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
  query: async (text, params) => {
    const currentPool = await initPool();
    return currentPool.query(text, params);
  },
};