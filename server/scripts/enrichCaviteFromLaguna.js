const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); 
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5435,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD),
  database: process.env.DB_NAME,
  ssl: false
});

async function enrichCaviteData() {
  const client = await pool.connect();
  console.log('--- Initiating Cavite Data Enrichment from Laguna Baseline ---');
  
  try {
    await client.query('BEGIN');

    // 1. Fetch Laguna baseline data with resolved department names
    const lagunaRes = await client.query(`
      SELECT k.metric_name, k.objective, k.process_type, k.proposed_by, 
             k.section_id, k.section_code, d.name AS dept_name
      FROM kpi_targets k
      JOIN departments d ON k.department_id = d.id
      WHERE k.plant = 'Laguna'
    `);
    const lagunaData = lagunaRes.rows;

    // 2. Fetch Cavite targets requiring enrichment
    const caviteRes = await client.query(`
      SELECT k.id, k.metric_name, k.objective, d.name AS dept_name
      FROM kpi_targets k
      JOIN departments d ON k.department_id = d.id
      WHERE k.plant = 'Cavite'
    `);
    const caviteData = caviteRes.rows;

    let updateCount = 0;

    // 3. Execute inference mapping
    for (const cavite of caviteData) {
      // Find Laguna targets in the exact same department
      const deptMatches = lagunaData.filter(l => l.dept_name === cavite.dept_name);
      
      if (deptMatches.length > 0) {
        // Fallback: Take the first match for department-level fields
        let processType = deptMatches[0].process_type;
        let sectionId = deptMatches[0].section_id;
        let sectionCode = deptMatches[0].section_code;
        let proposedBy = null; // Remains untouched if no exact KPI match is found

        // Exact Match: Check for identical KPI metric and objective for Process Owner mapping
        const exactMatch = deptMatches.find(l => 
          l.metric_name.trim().toLowerCase() === cavite.metric_name.trim().toLowerCase() && 
          l.objective.trim().toLowerCase() === cavite.objective.trim().toLowerCase()
        );

        if (exactMatch) {
          processType = exactMatch.process_type;
          sectionId = exactMatch.section_id;
          sectionCode = exactMatch.section_code;
          proposedBy = exactMatch.proposed_by;
        }

        // Build dynamic UPDATE query based on resolved parameters
        const updateQuery = `
          UPDATE kpi_targets 
          SET 
            process_type = COALESCE($1, process_type),
            section_id = COALESCE($2, section_id),
            section_code = COALESCE($3, section_code),
            proposed_by = COALESCE($4, proposed_by),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
          RETURNING metric_name;
        `;
        
        await client.query(updateQuery, [
          processType || null, 
          sectionId || null, 
          sectionCode || null, 
          proposedBy || null, 
          cavite.id
        ]);
        
        updateCount++;
      }
    }
    
    await client.query('COMMIT');
    console.log(`✔ Successfully enriched ${updateCount} Cavite records.`);
    console.log('--- Enrichment Complete ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Data Enrichment Failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

enrichCaviteData();