const db = require('../config/db');

class TargetRepository {
  
  async findAll(userContext) {
    const { id, role, email, plantFilter } = userContext;

    let baseSelect = `
      SELECT 
        t.id, t.metric_name, t.objective, t.target_value, t.operator, t.unit,
        t.process_category, t.process_type, t.status, t.remarks, t.frequency, t.created_at,
        d.name as dept_name, s.name as section_name, COALESCE(t.section_code, s.code) as section_code, 
        u.name as proposer_name, COALESCE(NULLIF(t.plant, ''), u.plant) as plant
      FROM kpi_targets t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN sections s ON t.section_id = s.id
      LEFT JOIN users u ON t.proposed_by = u.id
      WHERE 1=1
    `;

    const values = [];
    
    // Add plant filter if it is specified and not 'All Plants'
    if (plantFilter && plantFilter !== 'All Plants') {
        values.push(plantFilter);
        baseSelect += ` AND COALESCE(NULLIF(t.plant, ''), u.plant) = $${values.length}`;
    }

    try {
      if (role === 'Administrator') {
        const { rows } = await db.query(`${baseSelect} ORDER BY t.created_at DESC`, values);
        return rows;
      }
      
      if (role === 'Top Management') {
        values.push(email);
        const emailIdx = values.length;
        values.push(id);
        const idIdx = values.length;
        
        const { rows } = await db.query(`
          ${baseSelect}
          AND (u.div_head_email = $${emailIdx} 
             OR t.department_id IN (SELECT department_id FROM user_departments WHERE user_id = $${idIdx}))
          ORDER BY t.created_at DESC
        `, values);
        return rows;
      }
      
      if (role === 'Supervisor' || role === 'Senior Supervisor' || role === 'Acting Supervisor') {
        values.push(id);
        const idIdx = values.length;
        
        const { rows } = await db.query(`
          ${baseSelect}
          AND t.status = 'Active' 
          AND t.section_id IN (SELECT section_id FROM user_sections WHERE user_id = $${idIdx})
          ORDER BY t.created_at DESC
        `, values);
        return rows;
      }

      // Default (Manager)
      values.push(id);
      const idIdx = values.length;
      const { rows } = await db.query(`
        ${baseSelect}
        AND (t.department_id IN (SELECT department_id FROM user_departments WHERE user_id = $${idIdx})
           OR t.proposed_by = $${idIdx})
        ORDER BY t.created_at DESC
      `, values);

      return rows;
    } catch (error) {
      console.error('[TargetRepository] Database error inside findAll:', error);
      throw error;
    }
  }

  async findActiveForAnnualObjectives() {
    try {
      const { rows } = await db.query(`
        SELECT
          t.id, t.kpi_no, t.metric_name, t.objective, t.target_value, t.operator, t.unit,
          t.status, t.remarks, t.process_category, t.process_type, t.frequency, t.created_at,
          d.name as dept_name, s.name as section_name, COALESCE(t.section_code, s.code) as section_code,
          u.name as proposer_name, COALESCE(NULLIF(t.plant, ''), u.plant) as plant
        FROM kpi_targets t
        LEFT JOIN departments d ON t.department_id = d.id
        LEFT JOIN sections s ON t.section_id = s.id
        LEFT JOIN users u ON t.proposed_by = u.id
        WHERE t.status = 'Active'
        ORDER BY t.plant, d.name, s.name, t.process_category, t.process_type
      `);
      return rows;
    } catch (error) {
      console.error('[TargetRepository] Database error in findActiveForAnnualObjectives:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      const { rows } = await db.query(`
        SELECT 
          t.*,
          d.name as dept_name, 
          COALESCE(t.section_code, s.code) as section_code, 
          u.name as proposer_name
        FROM kpi_targets t
        LEFT JOIN departments d ON t.department_id = d.id
        LEFT JOIN sections s ON t.section_id = s.id
        LEFT JOIN users u ON t.proposed_by = u.id
        WHERE t.id = $1
      `, [id]);
      return rows[0];
    } catch (error) {
      console.error('[TargetRepository] Database error inside findById:', error);
      throw error;
    }
  }

  async create(targetData) {
    const { 
      metric_name, objective, target_value, operator, unit, departmentId, sectionId, userId, remarks, 
      process_category, process_type, frequency, plant // <-- Added plant
    } = targetData;
    
    // Extracted plant as $13 and mapped it to the plant column
    const { rows } = await db.query(`
      INSERT INTO kpi_targets (
        id, department_id, section_id, section_code, proposed_by, metric_name, objective, target_value, 
        status, remarks, operator, unit, process_category, process_type, frequency, plant,
        created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, (SELECT code FROM sections WHERE id = $2), $3, $4, $5, $6, 
        'Pending Top Management Approval', $7, $8, $9, $10, $11, $12, $13, 
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
    `, [
      departmentId, sectionId, userId, metric_name, objective, target_value, remarks, operator, unit, 
      process_category, process_type, frequency, plant
    ]);

    return rows[0];
  }

  async updateStatus(id, status, remarks) {
    try {
      if (status === 'Active') {
        const year = new Date().getFullYear();
        
        const { rows } = await db.query(`
          WITH seq_update AS (
            INSERT INTO kpi_sequences (year, last_value)
            VALUES ($1, 1)
            ON CONFLICT (year) DO UPDATE 
            SET last_value = kpi_sequences.last_value + 1
            RETURNING last_value
          ),
          target_update AS (
            UPDATE kpi_targets
            SET 
              status = $2, 
              remarks = $3, 
              kpi_no = 'KPI-' || $1 || '-' || LPAD((SELECT last_value FROM seq_update)::text, 4, '0'), 
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *
          )
          SELECT * FROM target_update;
        `, [year, status, remarks, id]);
        
        return rows[0];
      } else {
        const { rows } = await db.query(`
          UPDATE kpi_targets
          SET status = $1, remarks = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING *
        `, [status, remarks, id]);
        return rows[0];
      }
    } catch (error) {
      console.error('[TargetRepository] Database error inside updateStatus:', error);
      throw error;
    }
  }
}

module.exports = new TargetRepository();