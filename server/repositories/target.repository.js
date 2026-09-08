const db = require('../config/db');

class TargetRepository {
  
  // ✨ ARCHITECTURAL FIX: Expects full user context to route by email and ID
  async findAll(userContext) {
    const { id, role, email } = userContext;

    try {
      if (role === 'Administrator') {
        const { rows } = await db.query(`
          SELECT 
            t.id, t.metric_name, t.objective, t.target_value, t.operator, t.unit,
            t.status, t.remarks, t.process_category, t.process_type, t.frequency, t.created_at,
            d.name as dept_name, s.name as section_name, u.name as proposer_name, u.plant       
          FROM kpi_targets t
          LEFT JOIN departments d ON t.department_id = d.id
          LEFT JOIN sections s ON t.section_id = s.id
          LEFT JOIN users u ON t.proposed_by = u.id
          ORDER BY t.created_at DESC
        `);
        return rows;
      }

      // Route targets to Top Management if they are mapped globally OR are the explicit Division Head
      if (role === 'Top Management') {
        const { rows } = await db.query(`
          SELECT 
            t.id, t.metric_name, t.objective, t.target_value, t.operator, t.unit,
            t.status, t.remarks, t.process_category, t.process_type, t.frequency, t.created_at,
            d.name as dept_name, s.name as section_name, u.name as proposer_name, u.plant       
          FROM kpi_targets t
          LEFT JOIN departments d ON t.department_id = d.id
          LEFT JOIN sections s ON t.section_id = s.id
          LEFT JOIN users u ON t.proposed_by = u.id
          WHERE u.div_head_email = $1 
             OR t.department_id IN (SELECT department_id FROM user_departments WHERE user_id = $2)
          ORDER BY t.created_at DESC
        `, [email, id]);
        return rows;
      }

      // Route Active execution targets to Supervisors based on their assigned section
      if (role === 'Supervisor' || role === 'Acting Supervisor') {
        const { rows } = await db.query(`
          SELECT 
            t.id, t.metric_name, t.objective, t.target_value, t.operator, t.unit,
            t.status, t.remarks, t.process_category, t.process_type, t.frequency, t.created_at,
            d.name as dept_name, s.name as section_name, u.name as proposer_name, u.plant       
          FROM kpi_targets t
          LEFT JOIN departments d ON t.department_id = d.id
          LEFT JOIN sections s ON t.section_id = s.id
          LEFT JOIN users u ON t.proposed_by = u.id
          WHERE t.status = 'Active' 
            AND t.section_id IN (SELECT section_id FROM user_sections WHERE user_id = $1)
          ORDER BY t.created_at DESC
        `, [id]);
        return rows;
      }

      // Default Manager Query: View targets proposed by them or mapped to their departments
      const { rows } = await db.query(`
        SELECT 
          t.id, t.metric_name, t.objective, t.target_value, t.operator, t.unit,
          t.status, t.remarks, t.process_category, t.process_type, t.frequency, t.created_at,
          d.name as dept_name, s.name as section_name, u.name as proposer_name, u.plant       
        FROM kpi_targets t
        LEFT JOIN departments d ON t.department_id = d.id
        LEFT JOIN sections s ON t.section_id = s.id
        LEFT JOIN users u ON t.proposed_by = u.id
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

  async create(targetData) {
    const { 
      metric_name, objective, target_value, operator, unit, departmentId, sectionId, userId, remarks, 
      process_category, process_type, frequency 
    } = targetData;
    
    const { rows } = await db.query(`
      INSERT INTO kpi_targets (
        id, department_id, section_id, proposed_by, metric_name, objective, target_value, 
        status, remarks, operator, unit, process_category, process_type, frequency, 
        created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, 
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