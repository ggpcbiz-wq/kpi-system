// require('dotenv').config({ path: __dirname + '/../.env' });
// const { Pool } = require('pg');

// if (!process.env.DB_PASSWORD) {
//   console.error("❌ CRITICAL ERROR: DB_PASSWORD is undefined. Check your server/.env file.");
//   process.exit(1);
// }

// const pool = new Pool({
//   host: process.env.DB_HOST || '127.0.0.1',
//   port: process.env.DB_PORT || 5435,
//   user: process.env.DB_USER,
//   password: String(process.env.DB_PASSWORD), 
//   database: process.env.DB_NAME,
//   ssl: false,
//   connectionTimeoutMillis: 5000
// });

// const KINTONE_DOMAIN = process.env.KINTONE_DOMAIN;
// const MASTER_KPI_APP_ID = process.env.KINTONE_MASTER_KPI_APP_ID;
// const MASTER_KPI_API_KEY = process.env.KINTONE_MASTER_KPI_API_KEY;

// async function runBackfill() {
//   console.log('--- Starting Kintone Master KPI Backfill ---');
//   if (!KINTONE_DOMAIN || !MASTER_KPI_APP_ID || !MASTER_KPI_API_KEY) {
//     console.error('❌ ERROR: Missing Kintone Master KPI environment variables.');
//     process.exit(1);
//   }

//   let client;
//   try {
//     client = await pool.connect();
//     console.log('1. Fetching Active KPI Targets from database...');
    
//     const { rows: targets } = await client.query(`
//       SELECT 
//         t.*,
//         d.name as dept_name, 
//         COALESCE(t.section_code, s.code) as section_code, 
//         u.name as proposer_name
//       FROM kpi_targets t
//       LEFT JOIN departments d ON t.department_id = d.id
//       LEFT JOIN sections s ON t.section_id = s.id
//       LEFT JOIN users u ON t.proposed_by = u.id
//       WHERE t.status = 'Active'
//     `);

//     if (targets.length === 0) {
//       console.log('No active targets found in the database. Exiting.');
//       process.exit(0);
//     }

//     console.log(`Found ${targets.length} active targets. Formatting for Kintone...`);

//     const kintoneRecords = targets.map(target => {
//       const formattedDate = target.created_at 
//         ? new Date(target.created_at).toISOString().split('T')[0] 
//         : '';

//       return {
//         kpi_no:           { value: target.kpi_no || '' },
//         department:       { value: target.dept_name || '' },
//         code:             { value: target.section_code || '' },
//         proposed_by:      { value: target.proposer_name || '' },
//         proposal_date:    { value: formattedDate },
//         process_category: { value: target.process_category || '' },
//         process_type:     { value: target.process_type || '' },
//         frequency:        { value: target.frequency || '' },
//         objective:        { value: target.objective || '' },
//         kpi:              { value: target.metric_name || '' },
//         operator:         { value: target.operator || '' },
//         target_value:     { value: String(target.target_value || '') },
//         unit:             { value: target.unit || '' },
//         remarks:          { value: target.remarks || '' }
//       };
//     });

//     const BATCH_SIZE = 100;
//     const url = `https://${KINTONE_DOMAIN}/k/v1/records.json`; 
//     console.log(`2. Pushing to Kintone in batches of ${BATCH_SIZE}...`);

//     for (let i = 0; i < kintoneRecords.length; i += BATCH_SIZE) {
//       const batch = kintoneRecords.slice(i, i + BATCH_SIZE);
//       const payload = { app: MASTER_KPI_APP_ID, records: batch };

//       const response = await fetch(url, {
//         method: 'POST',
//         headers: { 'X-Cybozu-API-Token': MASTER_KPI_API_KEY, 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload)
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         console.error(`❌ [Batch ${i/BATCH_SIZE + 1} Failed]:`, JSON.stringify(errorData, null, 2));
//         throw new Error('Kintone Bulk POST Rejected');
//       }
//       const result = await response.json();
//       console.log(`✔ Batch ${i/BATCH_SIZE + 1} Success: Inserted ${result.ids.length} records.`);
//     }
//     console.log('--- Backfill Complete ---');
//   } catch (error) {
//     console.error('Fatal Error during backfill:', error);
//   } finally {
//     if (client) client.release();
//     await pool.end();
//   }
// }

// runBackfill();