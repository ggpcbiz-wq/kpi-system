// require('dotenv').config({ path: __dirname + '/../.env' });
// const { Pool } = require('pg');

// if (!process.env.DB_PASSWORD) {
//   console.error("❌ CRITICAL ERROR: DB_PASSWORD is undefined.");
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
// const ORG_APP_ID = process.env.KINTONE_ORGANIZATION_APP_ID;
// const ORG_API_KEY = process.env.KINTONE_ORGANIZATION_API_KEY;

// // ⚠️ YOU WILL UPDATE THESE AFTER RUNNING THE SCRIPT ONCE
// const KINTONE_NAME_FIELD = 'Section'; 
// const KINTONE_CODE_FIELD = 'Code'; 

// async function syncSectionCodes() {
//   console.log('--- Initiating Production Section Code Synchronization ---');

//   let client;
//   try {
//     client = await pool.connect();
    
//     console.log('1. Fetching Organization Master Data from Kintone...');
//     const url = `https://${KINTONE_DOMAIN}/k/v1/records.json?app=${ORG_APP_ID}`;
//     const response = await fetch(url, {
//       method: 'GET',
//       headers: { 'X-Cybozu-API-Token': ORG_API_KEY }
//     });

//     if (!response.ok) throw new Error(`Kintone API rejected request: ${response.statusText}`);
//     const { records: kintoneOrgs } = await response.json();
//     console.log(`✔ Retrieved ${kintoneOrgs.length} organization records.`);

//     // ✨ DIAGNOSTIC INTERCEPTOR: Print the available field codes
//     if (kintoneOrgs.length > 0) {
//       console.log('\n======================================================');
//       console.log('🔍 KINTONE FIELD SCHEMA FOR APP 204:');
//       console.log('Look at the keys below to find the correct Field Codes for the section Name and Code.');
//       console.log(Object.keys(kintoneOrgs[0]));
//       console.log('======================================================\n');
//     }

//     console.log('2. Fetching production sections missing codes...');
//     const { rows: localSections } = await client.query(`
//       SELECT id, name FROM sections WHERE code IS NULL OR code = ''
//     `);

//     console.log(`3. Reconciling ${localSections.length} production sections...`);
//     let updateCount = 0;

//     for (const section of localSections) {
//       const match = kintoneOrgs.find(k => {
//         const kintoneValue = k[KINTONE_NAME_FIELD]?.value;
//         if (!kintoneValue) return false;
//         return kintoneValue.trim().toLowerCase() === section.name.trim().toLowerCase();
//       });

//       if (match && match[KINTONE_CODE_FIELD]?.value) {
//         const newCode = match[KINTONE_CODE_FIELD].value;
//         await client.query(`UPDATE sections SET code = $1 WHERE id = $2`, [newCode, section.id]);
//         console.log(`  -> Synced: [${section.name}] assigned code [${newCode}]`);
//         updateCount++;
//       } else {
//         console.log(`  -> ⚠️ No match found for: [${section.name}]`);
//       }
//     }
//     console.log(`--- Sync Complete: Successfully updated ${updateCount} sections ---`);

//   } catch (error) {
//     console.error('Fatal Error during synchronization:', error);
//   } finally {
//     if (client) client.release();
//     await pool.end();
//   }
// }

// syncSectionCodes();