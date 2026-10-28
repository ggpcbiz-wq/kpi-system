const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); 
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5435,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD),
  database: process.env.DB_NAME,
  ssl: false
});

const sanitizeNumeric = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,\s]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

async function seedDatabase() {
  const client = await pool.connect();
  console.log('--- Initiating Idempotent CDPC Ingestion (Strict VARCHAR) ---');
  try {
    const dataPath = path.join(__dirname, 'cdpc_targets_with_type.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const targets = JSON.parse(rawData);
    
    await client.query('BEGIN');

    let systemUserId;
    const userCheck = await client.query('SELECT id FROM users LIMIT 1');
    if (userCheck.rows.length > 0) {
      systemUserId = userCheck.rows[0].id;
    } else {
      const newUser = await client.query(`
        INSERT INTO users (id, name, email, role, created_at, updated_at) 
        VALUES (gen_random_uuid(), 'System Migrator', 'admin@system.local', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        RETURNING id
      `);
      systemUserId = newUser.rows[0].id;
    }
    
    let count = 0;
    for (const record of targets) {
      let deptId;
      const deptCheck = await client.query(
        'SELECT id FROM departments WHERE name = $1 LIMIT 1', 
        [record.department]
      );

      if (deptCheck.rows.length > 0) {
        deptId = deptCheck.rows[0].id;
      } else {
        const newDept = await client.query(
          `INSERT INTO departments (id, name, plant, created_at, updated_at) 
           VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
           RETURNING id`,
          [record.department, record.plant]
        );
        deptId = newDept.rows[0].id;
      }

      const upsertTarget = `
        INSERT INTO kpi_targets (
          id, plant, process_category, department_id, proposed_by, kpi_no, objective, metric_name, operator, target_value, unit, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) 
        ON CONFLICT (kpi_no) 
        DO UPDATE SET 
          plant = EXCLUDED.plant,
          process_category = EXCLUDED.process_category,
          department_id = EXCLUDED.department_id,
          objective = EXCLUDED.objective,
          metric_name = EXCLUDED.metric_name,
          operator = EXCLUDED.operator,
          target_value = EXCLUDED.target_value,
          unit = EXCLUDED.unit,
          updated_at = CURRENT_TIMESTAMP
        RETURNING metric_name;
      `;
      
      const safeNumericTarget = sanitizeNumeric(record.target_value);
      const finalTargetValue = safeNumericTarget !== null ? safeNumericTarget : 0; 
      
      // FIX: Base36 alphanumeric string to guarantee length < 20 chars (e.g., TBD-4F8X1P)
      const shortFallbackHash = Math.random().toString(36).substring(2, 8).toUpperCase();
      const finalKpiNo = record.indicator_code || `TBD-${shortFallbackHash}`;

      const targetValues = [
        record.plant,
        record.process_category,
        deptId, 
        systemUserId, 
        finalKpiNo, 
        record.objective, 
        record.kpi_name, 
        record.operator || '=', 
        finalTargetValue, 
        record.target_unit || null
      ];
      
      const res = await client.query(upsertTarget, targetValues);
      console.log(`✔ UPSERTED [Cavite | ${record.process_category}]: ${res.rows[0].metric_name}`);
      count++;
    }
    
    await client.query('COMMIT');
    console.log(`--- Ingestion Complete: ${count} records processed ---`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database Ingestion Failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();