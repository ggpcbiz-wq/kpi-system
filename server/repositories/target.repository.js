const db = require('../config/db');

class TargetRepository {
  
  async findAll(userContext) {
    const { id, role, email } = userContext;

    const baseSelect = `
      SELECT 
        t.id, t.metric_name, t.objective, t.target_value, t.operator, t.unit,
        t.status, t.remarks, t.process_category, t.process_type, t.frequency, t.created_at,
        d.name as dept_name, s.name as section_name, COALESCE(t.section_code, s.code) as section_code, 
        u.name as proposer_name, u.plant       
      FROM kpi_targets t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN sections s ON t.section_id = s.id
      LEFT JOIN users u ON t.proposed_by = u.id
    `;

    try {
      if (role === 'Administrator') {
        const { rows } = await db.query(`${baseSelect} ORDER BY t.created_at DESC`);
        return rows;
      }

      if (role === 'Top Management') {
        const { rows } = await db.query(`
          ${baseSelect}
          WHERE u.div_head_email = $1 
             OR t.department_id IN (SELECT department_id FROM user_departments WHERE user_id = $2)
          ORDER BY t.created_at DESC
        `, [email, id]);
        return rows;
      }

      if (role === 'Supervisor' || role === 'Acting Supervisor') {
        const { rows } = await db.query(`
          ${baseSelect}
          WHERE t.status = 'Active' 
            AND t.section_id IN (SELECT section_id FROM user_sections WHERE user_id = $1)
          ORDER BY t.created_at DESC
        `, [id]);
        return rows;
      }

      const { rows } = await db.query(`
        ${baseSelect}
        WHERE t.department_id IN (SELECT department_id FROM user_departments WHERE user_id = $1)
           OR t.proposed_by = $1
        ORDER BY t.created_at DESC
      `, [id]);

      return rows;
    } catch (error) {
      console.error('[TargetRepository] Database error inside findAll:', error);
      throw error;
    }
  }

  // ✨ ARCHITECTURAL FIX: Extract the full record payload including relations for the Kintone push
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
      process_category, process_type, frequency 
    } = targetData;
    
    const { rows } = await db.query(`
      INSERT INTO kpi_targets (
        id, department_id, section_id, section_code, proposed_by, metric_name, objective, target_value, 
        status, remarks, operator, unit, process_category, process_type, frequency, 
        created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, (SELECT code FROM sections WHERE id = $2), $3, $4, $5, $6, 
        'Pending Top Management Approval', $7, $8, $9, $10, $11, $12, 
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
    `, [
      departmentId, sectionId, userId, metric_name, objective, target_value, remarks, operator, unit, 
      process_category, process_type, frequency
    ]);

    return rows[0];
  }

  async updateStatus(id, status, remarks) {
    const { rows } = await db.query(`
      UPDATE kpi_targets
      SET status = $1, remarks = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [status, remarks, id]);

    return rows[0];
  }
}

module.exports = new TargetRepository();