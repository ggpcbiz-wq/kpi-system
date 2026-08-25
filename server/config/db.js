const { Pool } = require('pg');
const { Connector } = require('@google-cloud/cloud-sql-connector');

let pool;

/**
 * Initializes the database connection pool dynamically based on environment.
 * Development: Uses Google Cloud SQL Connector (Zero-config tunnel).
 * Production: Uses native Unix Sockets via Cloud Run.
 */
const initPool = async () => {
  if (pool) return pool;

  if (process.env.NODE_ENV === 'production') {
    console.log('[Database] Connecting via Cloud Run Native Unix Socket');
    pool = new Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
    });
  } else {
    console.log('[Database] Connecting via GCP Node.js Connector (Local Dev)');
    const connector = new Connector();
    
    // Auto-generates TLS certificates using your local Google SDK login
    const clientOpts = await connector.getOptions({
      instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME,
      ipType: 'PUBLIC', 
    });

    pool = new Pool({
      ...clientOpts,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
  }

  pool.on('error', (err) => {
    console.error('[Database Error] Unexpected error on idle client:', err);
  });

  return pool;
};

// Export an async query wrapper that ensures the pool is ready before executing
module.exports = {
  query: async (text, params) => {
    const currentPool = await initPool();
    return currentPool.query(text, params);
  }
};