
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); 
const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5435,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD),
  database: process.env.DB_NAME,
  ssl: false
});

async function syncExcelData() {
  const client = await pool.connect();
  console.log('--- Initiating Cavite Master Excel Synchronization ---');
  
  try {
    // 1. Target the updated master Excel sheet
    const excelPath = path.join(__dirname, '../1.3. Y2026 CDPC QMS KPI Monitoring Rev. 01_2.xlsx');
    console.log(`Reading source file: ${excelPath}`);
    const workbook = XLSX.readFile(excelPath);
    
    const sheetName = workbook.SheetNames.find(s => s.includes('KPI')) || workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    // 2. Dynamically resolve Column Headers
    let headerRowIdx = -1;
    let headers = [];
    for (let i = 0; i < 20; i++) {
      if (rows[i] && rows[i].some(cell => typeof cell === 'string' && cell.toLowerCase().includes('kpi'))) {
        headerRowIdx = i;
        headers = rows[i].map(h => String(h || '').toLowerCase().trim());
        break;
      }
    }

    if (headerRowIdx === -1) throw new Error('Could not find a valid header row in the Excel file.');

    const kpiIdx = headers.findIndex(h => h.includes('kpi') || h.includes('metric'));
    const qmsIdx = headers.findIndex(h => h === 'qms process' || h.includes('process type') || h === 'process');
    const ownerIdx = headers.findIndex(h => h.includes('owner') || h.includes('prepared by') || h.includes('in charge'));
    const secCodeIdx = headers.findIndex(h => h.includes('sec code') || h.includes('section code'));

    console.log(`Resolved Indices -> KPI: ${kpiIdx} | QMS Process: ${qmsIdx} | Owner: ${ownerIdx} | Section: ${secCodeIdx}`);

    await client.query('BEGIN');
    let updateCount = 0;

    // 3. Parse and Force-Update Database Records
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[kpiIdx]) continue;
      
      // Sanitize metric names to match the normalized ASCII DB strings
      let kpiName = String(row[kpiIdx]).trim().replace(/\n/g, ' ');
      kpiName = kpiName.replace(/≤/g, '<=').replace(/≥/g, '>=');
      
      if (kpiName === '' || kpiName === '-') continue;

      const qmsProcess = qmsIdx !== -1 && row[qmsIdx] ? String(row[qmsIdx]).trim() : null;
      const sectionCode = secCodeIdx !== -1 && row[secCodeIdx] ? String(row[secCodeIdx]).trim() : null;
      const rawOwner = ownerIdx !== -1 && row[ownerIdx] ? String(row[ownerIdx]).trim() : null;

      let ownerId = null;

      // Deterministically resolve or create the Process Owner UUID
      if (rawOwner && rawOwner !== '-' && rawOwner.toLowerCase() !== 'tbd') {
        const ownerName = rawOwner.replace(/\n/g, ' ');
        const userCheck = await client.query('SELECT id FROM users WHERE LOWER(name) = LOWER($1)', [ownerName]);
        
        if (userCheck.rows.length > 0) {
          ownerId = userCheck.rows[0].id;
        } else {
          const newEmail = ownerName.toLowerCase().replace(/[^a-z0-9]/g, '') + '@ggpc.local';
          const newUser = await client.query(`
            INSERT INTO users (id, name, email, role, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
          `, [ownerName, newEmail]);
          ownerId = newUser.rows[0].id;
        }
      }

      // Execute a strict overwrite based on the exact Excel definitions
      const updateRes = await client.query(`
        UPDATE kpi_targets
        SET 
          process_type = $1,
          section_code = COALESCE($2, section_code),
          proposed_by = COALESCE($3, proposed_by),
          updated_at = CURRENT_TIMESTAMP
        WHERE plant = 'Cavite' 
          AND LOWER(TRIM(metric_name)) = LOWER(TRIM($4))
        RETURNING id
      `, [qmsProcess, sectionCode, ownerId, kpiName]);

      if (updateRes.rowCount > 0) {
        updateCount++;
        console.log(`✔ Force-Synced: ${kpiName}`);
      }
    }

    await client.query('COMMIT');
    console.log(`--- Master Sync Complete: ${updateCount} records overridden from Excel ---`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Excel Sync Failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

syncExcelData();