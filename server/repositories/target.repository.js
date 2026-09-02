const db = require('../config/db');

class TargetRepository {
  
  async findAll(userId, role) {
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

      const { rows } = await db.query(`
        SELECT 
          t.id, t.metric_name, t.objective, t.target_value, t.operator, t.unit,
          t.status, t.remarks, t.process_category, t.process_type, t.frequency, t.created_at,
          d.name as dept_name, s.name as section_name, u.name as proposer_name, u.plant       
        FROM kpi_targets t
        LEFT JOIN departments d ON t.department_id = d.id
        LEFT JOIN sections s ON t.section_id = s.id
        LEFT JOIN users u ON t.proposed_by = u.id
        WHERE t.department_id IN (
            SELECT department_id FROM user_departments WHERE user_id = $1
        )
        ORDER BY t.created_at DESC
      `, [userId]);

      return rows;
    } catch (error) {
      console.error('Database error inside TargetRepository.findAll:', error);
      throw error;
    }
  }

  async create(targetData) {
    const { 
      metric_name, objective, target_value, operator, unit, departmentId, sectionId, userId, remarks, 
      process_category, process_type, frequency 
    } = targetData;
    
    // ✨ Includes objective in the parameterized query
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